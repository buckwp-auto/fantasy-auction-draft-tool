import type {
  AppState,
  LeagueSettings,
  Player,
  PlayerMark,
  Position,
  Team,
} from '../types'
import {
  DEFAULT_SCORING,
  DEFAULT_STARTERS,
  SUPERFLEX_STARTERS,
} from '../types'

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
    starters: { ...DEFAULT_STARTERS },
    flexType: 'WR/RB/TE',
    myTeamId: teams[0].id,
    keepersCountAgainstBudget: true,
    keepersExcludedFromSpendingPct: true,
    starterPct: 0.88,
    benchPct: 0.12,
    scoring: { ...DEFAULT_SCORING },
  }
}

/** Preset matching this league’s Superflex format. */
export function createSuperflexSettings(teamCount = 12): LeagueSettings {
  const base = createDefaultSettings(teamCount)
  return {
    ...base,
    starters: { ...SUPERFLEX_STARTERS },
    flexType: 'QB/RB/WR/TE',
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

function normalizeMark(p: Partial<Player>): PlayerMark {
  if (p.mark === 'target' || p.mark === 'avoid' || p.mark === 'none') return p.mark
  if (p.target) return 'target'
  return 'none'
}

function normalizePlayer(p: Player): Player {
  return {
    ...p,
    mark: normalizeMark(p),
    target: undefined,
  }
}

function normalizeSettings(raw: Partial<LeagueSettings>): LeagueSettings {
  const defaults = createDefaultSettings()
  const starters = {
    ...defaults.starters,
    ...(raw.starters ?? {}),
    SUPERFLEX: raw.starters?.SUPERFLEX ?? defaults.starters.SUPERFLEX,
  }
  return {
    ...defaults,
    ...raw,
    starters,
    scoring: { ...defaults.scoring, ...(raw.scoring ?? {}) },
    flexType: raw.flexType ?? defaults.flexType,
    keepersCountAgainstBudget:
      raw.keepersCountAgainstBudget ?? defaults.keepersCountAgainstBudget,
    keepersExcludedFromSpendingPct:
      raw.keepersExcludedFromSpendingPct ??
      defaults.keepersExcludedFromSpendingPct,
    starterPct:
      typeof raw.starterPct === 'number' && Number.isFinite(raw.starterPct)
        ? clampPct(raw.starterPct)
        : defaults.starterPct,
    benchPct:
      typeof raw.benchPct === 'number' && Number.isFinite(raw.benchPct)
        ? clampPct(raw.benchPct)
        : defaults.benchPct,
  }
}

function clampPct(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.settings || !Array.isArray(parsed.teams)) return createInitialState()
    return {
      settings: normalizeSettings(parsed.settings),
      teams: parsed.teams,
      players: Array.isArray(parsed.players)
        ? parsed.players.map(normalizePlayer)
        : [],
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
    settings: normalizeSettings(parsed.settings),
    teams: parsed.teams,
    players: Array.isArray(parsed.players)
      ? parsed.players.map(normalizePlayer)
      : [],
    picks: Array.isArray(parsed.picks) ? parsed.picks : [],
  }
}

export function playerIdFromName(name: string, pos: Position): string {
  return `${pos}:${name.trim().toLowerCase()}`
}

export function syncTeamsToCount(
  teams: Team[],
  count: number,
  myTeamId: string,
): {
  teams: Team[]
  myTeamId: string
} {
  const next = [...teams]
  while (next.length < count) {
    const n = next.length + 1
    next.push({
      id: `team-${n}-${crypto.randomUUID().slice(0, 8)}`,
      name: `Team ${n}`,
    })
  }
  const trimmed = next.slice(0, count)
  const myStillExists = trimmed.some((t) => t.id === myTeamId)
  return {
    teams: trimmed,
    myTeamId: myStillExists ? myTeamId : (trimmed[0]?.id ?? ''),
  }
}
