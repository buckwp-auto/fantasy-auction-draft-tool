import type { FlexType, LeagueSettings, Player, Position } from '../types'
import { POSITIONS } from '../types'

export interface BaselineCounts {
  starters: Record<Position, number>
  benchExtra: Record<Position, number>
}

/** Split regular FLEX slots across eligible positions (league-wide counts). */
function flexAllocation(
  flexType: FlexType,
  flexLeagueSlots: number,
): Record<Position, number> {
  const z = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
    Position,
    number
  >
  if (flexLeagueSlots <= 0) return z
  const add = (weights: Partial<Record<Position, number>>) => {
    const total = Object.values(weights).reduce((s, n) => s + (n ?? 0), 0) || 1
    for (const [pos, w] of Object.entries(weights) as [Position, number][]) {
      z[pos] += (flexLeagueSlots * w) / total
    }
  }
  switch (flexType) {
    case 'WR/RB':
      add({ RB: 0.45, WR: 0.55 })
      break
    case 'WR/TE':
      add({ WR: 0.7, TE: 0.3 })
      break
    case 'QB/RB/WR/TE':
      // Rare: treating FLEX as another superflex-like slot
      add({ QB: 0.55, RB: 0.2, WR: 0.2, TE: 0.05 })
      break
    case 'WR/RB/TE':
    default:
      add({ RB: 0.4, WR: 0.45, TE: 0.15 })
      break
  }
  return z
}

/**
 * League-wide starter baselines from roster settings.
 * Superflex slots count fully toward QB scarcity (standard SF auction treatment).
 */
export function baselinesFromSettings(settings: LeagueSettings): BaselineCounts {
  const t = settings.teamCount
  const s = settings.starters
  const flexLeague = t * s.FLEX
  const flex = flexAllocation(settings.flexType, flexLeague)

  const starters: Record<Position, number> = {
    // Superflex ≈ second QB for auction scarcity
    QB: t * (s.QB + s.SUPERFLEX) + flex.QB,
    RB: t * s.RB + flex.RB,
    WR: t * s.WR + flex.WR,
    TE: t * s.TE + flex.TE,
    K: t * s.K,
    DEF: t * s.DEF,
  }

  // Bench-quality depth ~85% of starter count (sheet-ish QB 10/12, RB 26/30)
  const benchExtra = Object.fromEntries(
    POSITIONS.map((pos) => {
      if (pos === 'K' || pos === 'DEF') return [pos, 0]
      return [pos, Math.max(0, Math.round(starters[pos] * 0.85))]
    }),
  ) as Record<Position, number>

  return { starters, benchExtra }
}

function nthFpts(sortedDesc: number[], n: number): number {
  if (n <= 0 || sortedDesc.length === 0) return 0
  const idx = Math.min(Math.max(1, Math.round(n)), sortedDesc.length) - 1
  return sortedDesc[idx] ?? 0
}

export interface RevalueResult {
  players: Player[]
  baselines: BaselineCounts
  skippedNoFpts: number
  topQbs: Array<{ name: string; projectedDollars: number; vbd: number }>
}

/**
 * Recompute projected$ / VBD from FPTS using current league settings (Superflex-aware).
 */
export function revaluePlayersFromSettings(
  players: Player[],
  settings: LeagueSettings,
): RevalueResult {
  const baselines = baselinesFromSettings(settings)
  const withFpts = players.filter((p) => typeof p.fpts === 'number' && !Number.isNaN(p.fpts))
  const skippedNoFpts = players.length - withFpts.length

  const byPos = new Map<Position, Player[]>()
  for (const p of withFpts) {
    const list = byPos.get(p.pos) ?? []
    list.push(p)
    byPos.set(p.pos, list)
  }

  const startVbd = new Map<string, number>()
  const benchVbd = new Map<string, number>()
  const rank = new Map<string, number>()

  for (const [pos, list] of byPos) {
    const sorted = [...list].sort((a, b) => (b.fpts ?? 0) - (a.fpts ?? 0))
    const fptsList = sorted.map((p) => p.fpts ?? 0)
    const starterN = baselines.starters[pos]
    const benchN = starterN + baselines.benchExtra[pos]
    const starterBaseline = nthFpts(fptsList, starterN)
    const benchBaseline = nthFpts(fptsList, Math.max(benchN, starterN))

    sorted.forEach((p, i) => {
      const f = p.fpts ?? 0
      startVbd.set(p.id, Math.max(f - starterBaseline, 0))
      benchVbd.set(p.id, Math.max(f - benchBaseline, 0))
      rank.set(p.id, i + 1)
    })
  }

  const available =
    settings.teamCount * settings.budget -
    settings.teamCount * settings.starters.K -
    settings.teamCount * settings.starters.DEF

  let sumStart = 0
  let sumBenchExtra = 0
  for (const p of withFpts) {
    if (p.pos === 'K' || p.pos === 'DEF') continue
    const s = startVbd.get(p.id) ?? 0
    const b = benchVbd.get(p.id) ?? 0
    sumStart += s
    sumBenchExtra += Math.max(b - s, 0)
  }

  const starterShare = clampShare(settings.starterPct, 0.88)
  const benchShare = clampShare(settings.benchPct, 0.12)
  const shareSum = starterShare + benchShare
  const starterPct = shareSum > 0 ? starterShare / shareSum : 0.88
  const benchPct = shareSum > 0 ? benchShare / shareSum : 0.12

  const starterPF = sumStart > 0 ? (available * starterPct) / sumStart : 0
  const benchPF = sumBenchExtra > 0 ? (available * benchPct) / sumBenchExtra : 0

  const idpPool =
    settings.teamCount * (settings.starters.K + settings.starters.DEF)
  const idpPlayers = withFpts.filter((p) => p.pos === 'K' || p.pos === 'DEF')
  const idpFpts = idpPlayers.reduce((s, p) => s + Math.max(p.fpts ?? 0, 0), 0)

  const valuedIds = new Set(withFpts.map((p) => p.id))
  const next = players.map((p) => {
    if (!valuedIds.has(p.id)) return p
    const s = startVbd.get(p.id) ?? 0
    const b = benchVbd.get(p.id) ?? 0
    const avgVbd = (s + b) / 2
    const r = rank.get(p.id) ?? 99
    let projectedDollars = 0
    if (p.pos === 'K' || p.pos === 'DEF') {
      const share =
        idpFpts > 0 ? (Math.max(p.fpts ?? 0, 0) / idpFpts) * idpPool : 0
      projectedDollars = Math.max(
        share,
        r <= baselines.starters[p.pos] ? 1 : 0,
      )
    } else {
      projectedDollars = s * starterPF + Math.max(b - s, 0) * benchPF
    }
    return {
      ...p,
      projectedDollars: Math.round(projectedDollars * 100) / 100,
      vbd: Math.round(avgVbd * 100) / 100,
    }
  })

  next.sort(
    (a, b) => b.projectedDollars - a.projectedDollars || b.vbd - a.vbd,
  )

  const topQbs = next
    .filter((p) => p.pos === 'QB')
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      projectedDollars: p.projectedDollars,
      vbd: p.vbd,
    }))

  return { players: next, baselines, skippedNoFpts, topQbs }
}

function clampShare(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

export function describeBaselines(b: BaselineCounts): string {
  return POSITIONS.map(
    (p) => `${p} starters~${Math.round(b.starters[p])}`,
  ).join(', ')
}
