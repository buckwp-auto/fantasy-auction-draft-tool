import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { applyAav, fetchAav, type AavProvider } from './lib/aav'
import {
  fetchAllProjections,
  fetchByeMap,
  halfPprPoints,
  normalizeNameKey,
} from './lib/fantasypros'
import {
  DEFAULT_VALUATION,
  valuePlayers,
  type RawProjectedPlayer,
} from './lib/valuation'
import type { Position } from '../src/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

loadEnv({ path: path.join(root, '.env') })

interface SeedPlayer {
  name: string
  pos: string
  nflTeam: string
  bye: number | string | null
  tier: string
  projectedDollars: number
  vbd: number
  aav: number
}

function mapPos(raw: string): Position | null {
  const p = raw.toUpperCase()
  if (p === 'DST' || p === 'DEF' || p === 'D/ST') return 'DEF'
  if (p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE' || p === 'K') return p
  return null
}

async function loadSeed(): Promise<SeedPlayer[]> {
  const seedPath = path.join(root, 'public', 'sample-players-2026.json')
  const raw = await readFile(seedPath, 'utf8')
  return JSON.parse(raw) as SeedPlayer[]
}

function isFreeTierLimited(projectionCount: number): boolean {
  // Free public keys hard-cap ~10 players per position × 6 positions ≈ 60
  return projectionCount > 0 && projectionCount <= 70
}

async function main() {
  const apiKey = process.env.FANTASYPROS_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing FANTASYPROS_API_KEY in .env — see .env.example and https://secure.fantasypros.com/api-keys/request',
    )
  }

  const season = Number(process.env.SEASON ?? DEFAULT_VALUATION.season)
  const aavProvider = (process.env.AAV_PROVIDER ?? 'yahoo') as AavProvider

  console.log(`Fetching FantasyPros projections for ${season}…`)
  const projections = await fetchAllProjections(season, apiKey)
  console.log(`  ${projections.length} projection rows`)

  const freeLimited = isFreeTierLimited(projections.length)
  if (freeLimited) {
    console.warn(
      '⚠️  FantasyPros key appears to be FREE tier (≈10 players/position).',
    )
    console.warn(
      '   Full live valuation needs Premium/HOF. Using Excel sample seed + FP overlays.',
    )
  }

  console.log('Fetching consensus rankings for bye/tier…')
  const byeMap = await fetchByeMap(season, apiKey)
  console.log(`  ${byeMap.size} ranking rows`)

  let outPlayers: Array<{
    name: string
    pos: Position
    nflTeam: string
    bye: number | null
    tier: string
    projectedDollars: number
    vbd: number
    aav: number
  }>
  let valuationMode: 'starter-bench' | 'seed-overlay'

  if (freeLimited) {
    valuationMode = 'seed-overlay'
    const seed = await loadSeed()
    const fpByKey = new Map<string, { fpts: number; team: string; pos: Position }>()
    for (const p of projections) {
      const pos = mapPos(p.position_id)
      if (!pos) continue
      fpByKey.set(`${pos}:${normalizeNameKey(p.name)}`, {
        fpts: halfPprPoints(p.stats ?? {}),
        team: p.team_id || '',
        pos,
      })
    }

    // Re-value only the FP subset for relative sanity checks, but keep seed dollars
    // as the auction board pool so inflation math stays sheet-realistic.
    outPlayers = seed
      .map((s) => {
        const pos = mapPos(s.pos)
        if (!pos) return null
        const key = `${pos}:${normalizeNameKey(s.name)}`
        const fp = fpByKey.get(key)
        const meta = byeMap.get(normalizeNameKey(s.name))
        const bye =
          meta?.bye ??
          (s.bye === null || s.bye === ''
            ? null
            : typeof s.bye === 'number'
              ? s.bye
              : Number(s.bye) || null)
        return {
          name: s.name,
          pos,
          nflTeam: fp?.team || s.nflTeam || '',
          bye: Number.isFinite(bye as number) ? (bye as number) : null,
          tier: meta?.tier || s.tier || '',
          projectedDollars: s.projectedDollars,
          vbd: s.vbd,
          aav: s.aav,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    console.log(
      `Seed overlay: ${outPlayers.length} players (${fpByKey.size} FP projection hits for metadata)`,
    )
  } else {
    valuationMode = 'starter-bench'
    const seen = new Set<string>()
    const raw: RawProjectedPlayer[] = []
    for (const p of projections) {
      const pos = mapPos(p.position_id)
      if (!pos) continue
      const key = `${pos}:${normalizeNameKey(p.name)}`
      if (seen.has(key)) continue
      seen.add(key)
      const meta = byeMap.get(normalizeNameKey(p.name))
      raw.push({
        fpid: p.fpid,
        name: p.name,
        pos,
        nflTeam: p.team_id || '',
        bye: meta?.bye ?? null,
        fpts: halfPprPoints(p.stats ?? {}),
        tier: meta?.tier,
      })
    }
    console.log(`Valuing ${raw.length} players (starter/bench)…`)
    const valued = valuePlayers(raw, { ...DEFAULT_VALUATION, season })
    outPlayers = valued.map((p) => ({
      name: p.name,
      pos: p.pos,
      nflTeam: p.nflTeam,
      bye: p.bye,
      tier: p.tier,
      projectedDollars: p.projectedDollars,
      vbd: p.vbd,
      aav: p.aav,
    }))
  }

  console.log(`Fetching AAV (${aavProvider})…`)
  const aavMap = await fetchAav(aavProvider)
  const applied = applyAav(outPlayers, aavMap)
  outPlayers = applied.players
  console.log(`  AAV map size ${aavMap.size}, newly matched ${applied.matched}`)

  outPlayers.sort(
    (a, b) => b.projectedDollars - a.projectedDollars || b.vbd - a.vbd,
  )

  const meta = {
    season,
    lastUpdated: new Date().toISOString(),
    sources: {
      projections: freeLimited
        ? 'fantasypros-free+excel-seed'
        : 'fantasypros',
      aav: aavProvider,
      valuation: valuationMode,
    },
    api: {
      tier: freeLimited ? 'free' : 'premium-or-full',
      projectionRows: projections.length,
      limited: freeLimited,
    },
    leagueDefaults: {
      teams: DEFAULT_VALUATION.teams,
      budget: DEFAULT_VALUATION.budget,
      rosterSize: DEFAULT_VALUATION.rosterSize,
      scoring: 'half-ppr',
      starterPct: DEFAULT_VALUATION.starterPct,
      benchPct: DEFAULT_VALUATION.benchPct,
    },
    counts: {
      players: outPlayers.length,
      aavMatched: applied.matched,
    },
    notes: freeLimited
      ? 'Free FantasyPros keys return ~10 players/position. Player pool $ / VBD come from the Excel seed; FP refreshes bye/tier metadata. Upgrade to HOF/Premium for full live projection valuation.'
      : 'Valued from FantasyPros projections with starter/bench dollar model.',
  }

  const dataDir = path.join(root, 'public', 'data')
  await mkdir(dataDir, { recursive: true })
  await writeFile(
    path.join(dataDir, 'players.json'),
    JSON.stringify(outPlayers, null, 2) + '\n',
  )
  await writeFile(path.join(dataDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n')

  const csvHeader = 'name,pos,team,bye,tier,projected$,vbd,aav'
  const csvRows = outPlayers.map(
    (p) =>
      `"${p.name.replaceAll('"', '""')}",${p.pos},${p.nflTeam},${p.bye ?? ''},${p.tier},${p.projectedDollars},${p.vbd},${p.aav}`,
  )
  await writeFile(
    path.join(dataDir, 'players.csv'),
    [csvHeader, ...csvRows].join('\n') + '\n',
  )

  console.log(`Wrote public/data/players.json (${outPlayers.length} players)`)
  console.log(`Wrote public/data/meta.json (lastUpdated ${meta.lastUpdated})`)
  console.log(
    `Top 5: ${outPlayers
      .slice(0, 5)
      .map((p) => `${p.name} $${p.projectedDollars}`)
      .join(', ')}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
