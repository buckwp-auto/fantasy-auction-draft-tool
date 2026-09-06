import type { AppState, Pick, Player, Position, Team } from '../types'
import { POSITIONS } from '../types'

export interface PositionMetrics {
  pos: Position
  spendingPct: number
  avgRemaining: number
  bestName: string | null
  bestVbd: number
  bestInflated: number
  secondName: string | null
  secondVbd: number
  secondInflated: number
  dropoff: number | null
}

export interface TeamMetrics {
  teamId: string
  remainingBudget: number
  maxBid: number
  draftedCount: number
  byPos: Record<Position, number>
  spendByPos: Record<Position, number>
}

export interface DraftMetrics {
  inflation: number
  inflationLabel: 'Inflation' | 'Deflation'
  remainingBudgetMine: number
  maxBidMine: number
  avgRemainingPerSpot: number
  byPosition: PositionMetrics[]
  teamMetrics: TeamMetrics[]
}

function pickMap(picks: Pick[]): Map<string, Pick> {
  return new Map(picks.map((p) => [p.playerId, p]))
}

/** Auction!A2: (Σ projected$ − Σ paid) / Σ projected$ of undrafted */
export function calculateInflation(players: Player[], picks: Pick[]): number {
  const drafted = pickMap(picks)
  let totalProjected = 0
  let totalPaid = 0
  let undraftedProjected = 0

  for (const player of players) {
    if (player.projectedDollars <= 0) continue
    totalProjected += player.projectedDollars
    const pick = drafted.get(player.id)
    if (pick) {
      totalPaid += pick.paid
    } else {
      undraftedProjected += player.projectedDollars
    }
  }

  if (undraftedProjected <= 0) return 1
  return (totalProjected - totalPaid) / undraftedProjected
}

export function inflatedDollars(projected: number, inflation: number): number {
  return projected * inflation
}

export function calculateTeamMetrics(state: AppState): TeamMetrics[] {
  const { settings, teams, players, picks } = state
  const playerById = new Map(players.map((p) => [p.id, p]))

  return teams.map((team) => {
    const teamPicks = picks.filter((p) => p.teamId === team.id)
    const spent = teamPicks
      .filter((p) => settings.keepersCountAgainstBudget || !p.keeper)
      .reduce((sum, p) => sum + p.paid, 0)
    const remainingBudget = settings.budget - spent
    const draftedCount = teamPicks.filter((p) => p.paid > 0 || p.keeper).length
    const spotsLeft = Math.max(settings.rosterSize - draftedCount, 0)
    const maxBid = remainingBudget - Math.max(spotsLeft - 1, 0)

    const byPos = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
      Position,
      number
    >
    const spendByPos = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
      Position,
      number
    >

    for (const pick of teamPicks) {
      const player = playerById.get(pick.playerId)
      if (!player || pick.paid <= 0) continue
      byPos[player.pos] += 1
      const excludeKeeperSpend =
        settings.keepersExcludedFromSpendingPct && pick.keeper
      if (!excludeKeeperSpend) spendByPos[player.pos] += pick.paid
    }

    return {
      teamId: team.id,
      remainingBudget,
      maxBid,
      draftedCount,
      byPos,
      spendByPos,
    }
  })
}

export function calculatePositionMetrics(
  players: Player[],
  picks: Pick[],
  inflation: number,
): PositionMetrics[] {
  const drafted = pickMap(picks)

  return POSITIONS.map((pos) => {
    const atPos = players.filter((p) => p.pos === pos)
    const paidPicks = atPos
      .map((p) => ({ player: p, pick: drafted.get(p.id) }))
      .filter((x): x is { player: Player; pick: Pick } => {
        if (!x.pick || x.pick.paid <= 0) return false
        // spending % excludes keepers (sheet default); inflation still uses all paid
        return true
      })

    const paidForPct = paidPicks.filter((x) => !x.pick.keeper)
    const paidSum = paidForPct.reduce((s, x) => s + x.pick.paid, 0)
    const projectedPaidSum = paidForPct.reduce(
      (s, x) => s + x.player.projectedDollars,
      0,
    )
    const spendingPct =
      projectedPaidSum > 0 ? paidSum / projectedPaidSum : 0

    const undrafted = atPos.filter((p) => !drafted.has(p.id))

    const remainingWithValue = undrafted.filter(
      (p) => inflatedDollars(p.projectedDollars, inflation) > 0,
    )
    const avgRemaining =
      remainingWithValue.length > 0
        ? remainingWithValue.reduce(
            (s, p) => s + inflatedDollars(p.projectedDollars, inflation),
            0,
          ) / remainingWithValue.length
        : 0

    const byVbd = [...undrafted].sort((a, b) => b.vbd - a.vbd)
    const best = byVbd[0]
    const second = byVbd[1]
    const dropoff =
      best && second && best.vbd > 0
        ? (best.vbd - second.vbd) / best.vbd
        : null

    return {
      pos,
      spendingPct,
      avgRemaining,
      bestName: best?.name ?? null,
      bestVbd: best?.vbd ?? 0,
      bestInflated: best
        ? inflatedDollars(best.projectedDollars, inflation)
        : 0,
      secondName: second?.name ?? null,
      secondVbd: second?.vbd ?? 0,
      secondInflated: second
        ? inflatedDollars(second.projectedDollars, inflation)
        : 0,
      dropoff,
    }
  })
}

export function calculateDraftMetrics(state: AppState): DraftMetrics {
  const inflation = calculateInflation(state.players, state.picks)
  const teamMetrics = calculateTeamMetrics(state)
  const mine = teamMetrics.find((t) => t.teamId === state.settings.myTeamId)
  const remainingBudgetMine = mine?.remainingBudget ?? state.settings.budget
  const maxBidMine = mine?.maxBid ?? state.settings.budget
  const draftedMine = mine?.draftedCount ?? 0
  const spotsLeft = Math.max(state.settings.rosterSize - draftedMine, 1)
  const avgRemainingPerSpot = remainingBudgetMine / spotsLeft

  return {
    inflation,
    inflationLabel: inflation >= 1 ? 'Inflation' : 'Deflation',
    remainingBudgetMine,
    maxBidMine,
    avgRemainingPerSpot,
    byPosition: calculatePositionMetrics(state.players, state.picks, inflation),
    teamMetrics,
  }
}

export function getTeamRoster(
  state: AppState,
  teamId: string,
  inflation: number,
): Array<{
  player: Player
  pick: Pick
  inflated: number
  value: number
}> {
  const playerById = new Map(state.players.map((p) => [p.id, p]))
  return state.picks
    .filter((p) => p.teamId === teamId)
    .map((pick) => {
      const player = playerById.get(pick.playerId)
      if (!player) return null
      const inflated = inflatedDollars(player.projectedDollars, inflation)
      return {
        player,
        pick,
        inflated,
        value: inflated - pick.paid,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.inflated - a.inflated)
}

export function findTeam(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id)
}
