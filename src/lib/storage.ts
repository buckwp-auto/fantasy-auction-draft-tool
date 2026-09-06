import type { AppState, LeagueSettings, Position, Team } from '../types'

const STORAGE_KEY = 'fantasy-auction-draft-v1'

export function createDefaultTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: i === 0 ? 'My Team' : `Team ${i + 1}`,
  }))
}

export function createDefaultSettings(teamCount = 12): LeagueSettings {
  const teams = createDefaultTeams(teamCount)
  return {
    teamCount,
    budget: 200,
    rosterSize: 15,
    starters: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 },
    myTeamId: teams[0].id,
  }
}

export function createInitialState(): AppState {
  const settings = createDefaultSettings(12)
  return {
    settings,
    teams: createDefaultTeams(12),
    players: [],
    picks: [],
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.settings || !Array.isArray(parsed.teams)) return createInitialState()
    return {
      settings: { ...createDefaultSettings(), ...parsed.settings },
      teams: parsed.teams,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      picks: Array.isArray(parsed.picks) ? parsed.picks : [],
    }
  } catch {
    return createInitialState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function importStateJson(json: string): AppState {
  const parsed = JSON.parse(json) as AppState
  if (!parsed.settings || !Array.isArray(parsed.teams)) {
    throw new Error('Invalid backup JSON')
  }
  return {
    settings: { ...createDefaultSettings(), ...parsed.settings },
    teams: parsed.teams,
    players: Array.isArray(parsed.players) ? parsed.players : [],
    picks: Array.isArray(parsed.picks) ? parsed.picks : [],
  }
}

export function playerIdFromName(name: string, pos: Position): string {
  return `${pos}:${name.trim().toLowerCase()}`
}

export function syncTeamsToCount(teams: Team[], count: number, myTeamId: string): {
  teams: Team[]
  myTeamId: string
} {
  const next = [...teams]
  while (next.length < count) {
    const n = next.length + 1
    next.push({ id: `team-${n}-${crypto.randomUUID().slice(0, 8)}`, name: `Team ${n}` })
  }
  const trimmed = next.slice(0, count)
  const myStillExists = trimmed.some((t) => t.id === myTeamId)
  return {
    teams: trimmed,
    myTeamId: myStillExists ? myTeamId : trimmed[0]?.id ?? '',
  }
}
