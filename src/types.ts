export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

/** Regular FLEX eligibility (Superflex is a separate starter slot). */
export type FlexType = 'WR/RB/TE' | 'WR/RB' | 'WR/TE' | 'QB/RB/WR/TE'

export type PlayerMark = 'none' | 'target' | 'avoid'

export interface StartersByPos {
  QB: number
  RB: number
  WR: number
  TE: number
  FLEX: number
  /** QB/RB/WR/TE flex — “Superflex” */
  SUPERFLEX: number
  K: number
  DEF: number
}

/** Scoring knobs mirrored from elboberto LeagueInfo (used for display + future revaluation). */
export interface ScoringSettings {
  passTd: number
  passYdsPerPoint: number
  passInt: number
  rushTd: number
  rushYdsPerPoint: number
  recTd: number
  recYdsPerPoint: number
  receptions: number
  fumbleLost: number
}

export interface LeagueSettings {
  teamCount: number
  budget: number
  rosterSize: number
  starters: StartersByPos
  /** Eligibility for the FLEX slot(s) */
  flexType: FlexType
  myTeamId: string
  /** When true, keeper prices count against remaining budget (normal auction). */
  keepersCountAgainstBudget: boolean
  /** When true, keeper spends are excluded from position spending % (sheet behavior). */
  keepersExcludedFromSpendingPct: boolean
  /**
   * Share of available auction $ allocated to starter VBD (elboberto default 0.88).
   * Bench gets the remainder when using complementary editing; both are stored.
   */
  starterPct: number
  /** Share of available auction $ for bench-extra VBD (default 0.12). */
  benchPct: number
  scoring: ScoringSettings
}

export interface Team {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  pos: Position
  nflTeam: string
  bye: number | null
  tier: string
  projectedDollars: number
  vbd: number
  aav: number
  /** Season projected fantasy points (half-PPR seed) — required to revalue. */
  fpts?: number
  /** @deprecated prefer `mark` — kept for older backups */
  target?: boolean
  mark: PlayerMark
}

export interface Pick {
  playerId: string
  teamId: string
  paid: number
  keeper: boolean
}

export interface AppState {
  settings: LeagueSettings
  teams: Team[]
  players: Player[]
  picks: Pick[]
}

export type TabId = 'setup' | 'players' | 'auction' | 'teams'

export const DEFAULT_SCORING: ScoringSettings = {
  passTd: 4,
  passYdsPerPoint: 25, // 0.04 pts/yd
  passInt: -2,
  rushTd: 6,
  rushYdsPerPoint: 10, // 0.1
  recTd: 6,
  recYdsPerPoint: 10,
  receptions: 0.5,
  fumbleLost: -2,
}

export const DEFAULT_STARTERS: StartersByPos = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DEF: 1,
}

/** This league: Superflex (QB/RB/WR/TE), no separate WR/RB/TE flex required. */
export const SUPERFLEX_STARTERS: StartersByPos = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 0,
  SUPERFLEX: 1,
  K: 1,
  DEF: 1,
}
