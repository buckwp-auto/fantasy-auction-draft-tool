import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppState, LeagueSettings, Pick, Player, PlayerMark } from '../types'
import { calculateDraftMetrics, type DraftMetrics } from '../lib/calculations'
import {
  createDefaultTeams,
  createSuperflexSettings,
  exportStateJson,
  importStateJson,
  loadState,
  saveState,
  syncTeamsToCount,
} from '../lib/storage'

interface DraftContextValue {
  state: AppState
  metrics: DraftMetrics
  updateSettings: (patch: Partial<LeagueSettings>) => void
  setTeamCount: (count: number) => void
  renameTeam: (id: string, name: string) => void
  setMyTeam: (id: string) => void
  setPlayers: (players: Player[], mode: 'replace' | 'merge') => void
  setPlayerMark: (playerId: string, mark: PlayerMark) => void
  cyclePlayerMark: (playerId: string) => void
  recordPick: (pick: Pick) => void
  clearPick: (playerId: string) => void
  undoLastPick: () => void
  resetDraft: () => void
  resetAll: () => void
  applySuperflexPreset: () => void
  exportJson: () => string
  importJson: (json: string) => void
}

const MARK_CYCLE: PlayerMark[] = ['none', 'target', 'avoid']

const DraftContext = createContext<DraftContextValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const metrics = useMemo(() => calculateDraftMetrics(state), [state])

  const updateSettings = useCallback((patch: Partial<LeagueSettings>) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, ...patch },
    }))
  }, [])

  const setTeamCount = useCallback((count: number) => {
    const n = Math.min(20, Math.max(2, count))
    setState((s) => {
      const synced = syncTeamsToCount(s.teams, n, s.settings.myTeamId)
      return {
        ...s,
        teams: synced.teams,
        settings: {
          ...s.settings,
          teamCount: n,
          myTeamId: synced.myTeamId,
        },
      }
    })
  }, [])

  const renameTeam = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      teams: s.teams.map((t) => (t.id === id ? { ...t, name } : t)),
    }))
  }, [])

  const setMyTeam = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, myTeamId: id },
    }))
  }, [])

  const setPlayers = useCallback((players: Player[], mode: 'replace' | 'merge') => {
    setState((s) => {
      if (mode === 'replace') {
        const ids = new Set(players.map((p) => p.id))
        return {
          ...s,
          players,
          picks: s.picks.filter((p) => ids.has(p.playerId)),
        }
      }
      const map = new Map(s.players.map((p) => [p.id, p]))
      for (const p of players) {
        const existing = map.get(p.id)
        map.set(
          p.id,
          existing ? { ...p, mark: existing.mark ?? p.mark ?? 'none' } : p,
        )
      }
      const merged = [...map.values()].sort(
        (a, b) => b.projectedDollars - a.projectedDollars || b.vbd - a.vbd,
      )
      return { ...s, players: merged }
    })
  }, [])

  const setPlayerMark = useCallback((playerId: string, mark: PlayerMark) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => (p.id === playerId ? { ...p, mark } : p)),
    }))
  }, [])

  const cyclePlayerMark = useCallback((playerId: string) => {
    setState((s) => ({
      ...s,
      players: s.players.map((p) => {
        if (p.id !== playerId) return p
        const cur = p.mark ?? 'none'
        const next = MARK_CYCLE[(MARK_CYCLE.indexOf(cur) + 1) % MARK_CYCLE.length]
        return { ...p, mark: next }
      }),
    }))
  }, [])

  const recordPick = useCallback((pick: Pick) => {
    setState((s) => {
      const without = s.picks.filter((p) => p.playerId !== pick.playerId)
      return { ...s, picks: [...without, pick] }
    })
  }, [])

  const clearPick = useCallback((playerId: string) => {
    setState((s) => ({
      ...s,
      picks: s.picks.filter((p) => p.playerId !== playerId),
    }))
  }, [])

  const undoLastPick = useCallback(() => {
    setState((s) => ({
      ...s,
      picks: s.picks.slice(0, -1),
    }))
  }, [])

  const resetDraft = useCallback(() => {
    setState((s) => ({ ...s, picks: [] }))
  }, [])

  const resetAll = useCallback(() => {
    const settings = createSuperflexSettings(12)
    const teams = createDefaultTeams(12)
    setState({
      settings: { ...settings, myTeamId: teams[0].id },
      teams,
      players: [],
      picks: [],
    })
  }, [])

  const applySuperflexPreset = useCallback(() => {
    setState((s) => ({
      ...s,
      settings: {
        ...createSuperflexSettings(s.settings.teamCount),
        myTeamId: s.settings.myTeamId,
        budget: s.settings.budget,
        rosterSize: s.settings.rosterSize,
        scoring: s.settings.scoring,
        keepersCountAgainstBudget: s.settings.keepersCountAgainstBudget,
        keepersExcludedFromSpendingPct: s.settings.keepersExcludedFromSpendingPct,
      },
    }))
  }, [])

  const exportJson = useCallback(() => exportStateJson(state), [state])

  const importJson = useCallback((json: string) => {
    setState(importStateJson(json))
  }, [])

  const value: DraftContextValue = {
    state,
    metrics,
    updateSettings,
    setTeamCount,
    renameTeam,
    setMyTeam,
    setPlayers,
    setPlayerMark,
    cyclePlayerMark,
    recordPick,
    clearPick,
    undoLastPick,
    resetDraft,
    resetAll,
    applySuperflexPreset,
    exportJson,
    importJson,
  }

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used within DraftProvider')
  return ctx
}
