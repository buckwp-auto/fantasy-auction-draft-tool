import { readFileSync, writeFileSync } from 'node:fs'
import {
  baselinesFromSettings,
  revaluePlayersFromSettings,
} from '../src/lib/valuation'
import type { LeagueSettings, Player } from '../src/types'
import { DEFAULT_SCORING, SUPERFLEX_STARTERS } from '../src/types'

const fptsMap = JSON.parse(
  readFileSync('public/data/fpts-by-id.json', 'utf8'),
) as Record<string, number>
const sample = JSON.parse(
  readFileSync('public/sample-players-2026.json', 'utf8'),
) as Array<Record<string, unknown>>

function pid(name: string, pos: string) {
  return `${pos}:${name.trim().toLowerCase()}`
}

const enriched = sample.map((p) => {
  const id = pid(String(p.name), String(p.pos))
  return { ...p, fpts: fptsMap[id] ?? p.fpts }
})
writeFileSync(
  'public/sample-players-2026.json',
  JSON.stringify(enriched, null, 2) + '\n',
)
console.log(
  'sample with fpts',
  enriched.filter((p) => p.fpts != null).length,
  '/',
  enriched.length,
)

const settings: LeagueSettings = {
  teamCount: 12,
  budget: 200,
  rosterSize: 15,
  starters: { ...SUPERFLEX_STARTERS },
  flexType: 'QB/RB/WR/TE',
  myTeamId: 'team-3',
  keepersCountAgainstBudget: true,
  keepersExcludedFromSpendingPct: true,
  scoring: { ...DEFAULT_SCORING },
}

const players: Player[] = enriched.map((p) => ({
  id: pid(String(p.name), String(p.pos)),
  name: String(p.name),
  pos: p.pos as Player['pos'],
  nflTeam: String(p.nflTeam ?? ''),
  bye: p.bye === '' || p.bye == null ? null : (p.bye as number),
  tier: String(p.tier ?? ''),
  projectedDollars: Number(p.projectedDollars ?? 0),
  vbd: Number(p.vbd ?? 0),
  aav: Number(p.aav ?? 0),
  fpts: typeof p.fpts === 'number' ? p.fpts : undefined,
  mark: 'none',
}))

const before = players.find((p) => p.name === 'Josh Allen')
const result = revaluePlayersFromSettings(players, settings)
const after = result.players.find((p) => p.name === 'Josh Allen')
const gibbs = result.players.find((p) => p.name === 'Jahmyr Gibbs')
console.log('baselines', baselinesFromSettings(settings).starters)
console.log(
  'Allen before',
  before?.projectedDollars,
  'after',
  after?.projectedDollars,
  'vbd',
  after?.vbd,
)
console.log('Gibbs after', gibbs?.projectedDollars)
console.log(
  'top 8',
  result.players
    .slice(0, 8)
    .map((p) => `${p.name} ${p.pos} $${p.projectedDollars}`),
)

const teamsSpec: Array<[string, Array<[string, number]>]> = [
  ['Allen, Tyler', [['Jaxon Smith-Njigba', 21], ['Emeka Egbuka', 10]]],
  ['Bodner, Bill', [['Tetairoa McMillan', 19], ['Bucky Irving', 14]]],
  ['Buck, Will', [['Brock Purdy', 32], ['J.K. Dobbins', 8]]],
  ['Burkhardt, Kyle', [['Brock Bowers', 15]]],
  ['Enfield, Alec', [['Nico Collins', 16], ['Bo Nix', 32]]],
  ['Maharaj, Val', [['Javonte Williams', 8]]],
  ['McCaan, Adam', [['Chris Olave', 9], ["De'Von Achane", 22]]],
  ["O'Brien, Collin", [['Drake Maye', 16], ['Matthew Stafford', 20]]],
  ['Palm, David', [['Puka Nacua', 38], ['Jaxson Dart', 9]]],
  ['Priddy, Dean', [['Jayden Daniels', 52]]],
  ['Scholz, Taylor', [['Chase Brown', 17], ['Amon-Ra St. Brown', 47]]],
  ['Seidel, Adam', [['Jahmyr Gibbs', 61], ['Jacoby Brissett', 1]]],
]

const teams = teamsSpec.map((t, i) => ({ id: `team-${i + 1}`, name: t[0] }))
const picks: Array<{
  playerId: string
  teamId: string
  paid: number
  keeper: boolean
}> = []
for (let i = 0; i < teamsSpec.length; i++) {
  const tid = `team-${i + 1}`
  for (const [name, price] of teamsSpec[i][1]) {
    const pl = result.players.find(
      (p) => p.name.replace(/’/g, "'") === name.replace(/’/g, "'"),
    )
    if (!pl) throw new Error('missing ' + name)
    picks.push({ playerId: pl.id, teamId: tid, paid: price, keeper: true })
  }
}

writeFileSync(
  'draft-2026-keepers.json',
  JSON.stringify({ settings, teams, players: result.players, picks }, null, 2) +
    '\n',
)
writeFileSync(
  'public/data/players.json',
  JSON.stringify(
    result.players.map((p) => ({
      name: p.name,
      pos: p.pos,
      nflTeam: p.nflTeam,
      bye: p.bye,
      tier: p.tier,
      projectedDollars: p.projectedDollars,
      vbd: p.vbd,
      aav: p.aav,
      fpts: p.fpts,
      mark: p.mark,
    })),
    null,
    2,
  ) + '\n',
)
console.log('wrote draft-2026-keepers.json and public/data/players.json')
