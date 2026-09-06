export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF'

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

export interface StartersByPos {
  QB: number
  RB: number
  WR: number
  TE: number
  FLEX: number
  K: number
  DEF: number
}

export interface LeagueSettings {
  teamCount: number
  budget: number
  rosterSize: number
  starters: StartersByPos
  myTeamId: string
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
  target: boolean
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
