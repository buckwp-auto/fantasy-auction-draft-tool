import type { Position } from '../../src/types'

export interface LeagueValuationConfig {
  season: number
  teams: number
  budget: number
  rosterSize: number
  starters: Record<Position, number> & { FLEX: number }
  starterPct: number
  benchPct: number
  /** League-wide starter baselines (sheet-style counts including flex share). */
  baselineStarters: Record<Position, number>
  /** League-wide bench-quality counts for BenchVBD. */
  baselineBench: Record<Position, number>
}

/** Defaults aligned with elboberto LeagueInfo (12 team, $200, half-PPR flex). */
export const DEFAULT_VALUATION: LeagueValuationConfig = {
  season: 2026,
  teams: 12,
  budget: 200,
  rosterSize: 15,
  starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 },
  starterPct: 0.88,
  benchPct: 0.12,
  // From LeagueInfo starter totals with flex allocation (~30 RB/WR, 12 QB/TE)
  baselineStarters: { QB: 12, RB: 30, WR: 30, TE: 12, K: 12, DEF: 12 },
  baselineBench: { QB: 10, RB: 26, WR: 26, TE: 10, K: 0, DEF: 0 },
}

export interface RawProjectedPlayer {
  fpid: number
  name: string
  pos: Position
  nflTeam: string
  bye: number | null
  fpts: number
  tier?: string
}

export interface ValuedPlayer {
  name: string
  pos: Position
  nflTeam: string
  bye: number | null
  tier: string
  projectedDollars: number
  vbd: number
  aav: number
  fpts: number
  startVbd: number
  benchVbd: number
}

function nthFpts(sortedDesc: number[], n: number): number {
  if (n <= 0 || sortedDesc.length === 0) return 0
  const idx = Math.min(n, sortedDesc.length) - 1
  return sortedDesc[idx] ?? 0
}

function tierLabel(pos: Position, rank: number): string {
  if (pos === 'K' || pos === 'DEF') return `${pos}${Math.min(Math.ceil(rank / 4), 8)}`
  const band = Math.min(Math.ceil(rank / 6), 8)
  return `${pos}${band}`
}

/**
 * Starter/Bench valuation modeled on the sheet:
 * dollars = startVbd * starterPF + (benchVbd - startVbd) * benchPF
 */
export function valuePlayers(
  raw: RawProjectedPlayer[],
  config: LeagueValuationConfig = DEFAULT_VALUATION,
): ValuedPlayer[] {
  const byPos = new Map<Position, RawProjectedPlayer[]>()
  for (const p of raw) {
    const list = byPos.get(p.pos) ?? []
    list.push(p)
    byPos.set(p.pos, list)
  }

  const startVbdById = new Map<number, number>()
  const benchVbdById = new Map<number, number>()
  const rankById = new Map<number, number>()

  for (const [pos, list] of byPos) {
    const sorted = [...list].sort((a, b) => b.fpts - a.fpts)
    const fptsList = sorted.map((p) => p.fpts)
    const starterN = config.baselineStarters[pos] ?? 0
    const benchExtra = config.baselineBench[pos] ?? 0
    const benchN = starterN + benchExtra
    const starterBaseline = nthFpts(fptsList, starterN)
    const benchBaseline = nthFpts(fptsList, Math.max(benchN, starterN))

    sorted.forEach((p, i) => {
      const startVbd = Math.max(p.fpts - starterBaseline, 0)
      const benchVbd = Math.max(p.fpts - benchBaseline, 0)
      startVbdById.set(p.fpid, startVbd)
      benchVbdById.set(p.fpid, benchVbd)
      rankById.set(p.fpid, i + 1)
    })
  }

  // Available $ for skill+IDP-style pool: total budget minus $1 min for K+DEF starters league-wide
  // (matches LeagueInfo H2 pattern: teams*budget - K*teams - DEF*teams)
  const available =
    config.teams * config.budget -
    config.teams * config.starters.K -
    config.teams * config.starters.DEF

  let sumStart = 0
  let sumBenchExtra = 0
  for (const p of raw) {
    if (p.pos === 'K' || p.pos === 'DEF') continue
    const s = startVbdById.get(p.fpid) ?? 0
    const b = benchVbdById.get(p.fpid) ?? 0
    sumStart += s
    sumBenchExtra += Math.max(b - s, 0)
  }

  const starterBudget = available * config.starterPct
  const benchBudget = available * config.benchPct
  const starterPF = sumStart > 0 ? starterBudget / sumStart : 0
  const benchPF = sumBenchExtra > 0 ? benchBudget / sumBenchExtra : 0

  // Residual dollars for K/DEF ranked by fpts within small pool ($1 + share of leftover ~ teams*(K+DEF))
  const idpPool = config.teams * (config.starters.K + config.starters.DEF)
  const idpPlayers = raw.filter((p) => p.pos === 'K' || p.pos === 'DEF')
  const idpFpts = idpPlayers.reduce((s, p) => s + Math.max(p.fpts, 0), 0)

  const valued: ValuedPlayer[] = raw.map((p) => {
    const startVbd = startVbdById.get(p.fpid) ?? 0
    const benchVbd = benchVbdById.get(p.fpid) ?? 0
    const avgVbd = (startVbd + benchVbd) / 2
    const rank = rankById.get(p.fpid) ?? 99

    let projectedDollars = 0
    if (p.pos === 'K' || p.pos === 'DEF') {
      const share = idpFpts > 0 ? (Math.max(p.fpts, 0) / idpFpts) * idpPool : 0
      projectedDollars = Math.max(share, rank <= config.baselineStarters[p.pos] ? 1 : 0)
    } else {
      projectedDollars =
        startVbd * starterPF + Math.max(benchVbd - startVbd, 0) * benchPF
    }

    return {
      name: p.name,
      pos: p.pos,
      nflTeam: p.nflTeam,
      bye: p.bye,
      tier: p.tier || tierLabel(p.pos, rank),
      projectedDollars: Math.round(projectedDollars * 100) / 100,
      vbd: Math.round(avgVbd * 100) / 100,
      aav: 0,
      fpts: Math.round(p.fpts * 100) / 100,
      startVbd: Math.round(startVbd * 100) / 100,
      benchVbd: Math.round(benchVbd * 100) / 100,
    }
  })

  valued.sort(
    (a, b) =>
      b.projectedDollars - a.projectedDollars || b.vbd - a.vbd || b.fpts - a.fpts,
  )
  return valued
}
