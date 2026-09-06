import { useMemo, useState } from 'react'
import { getTeamRoster } from '../lib/calculations'
import { POSITIONS } from '../types'
import { useDraft } from '../state/DraftContext'

function money(n: number): string {
  return n.toFixed(1)
}

export function TeamsPanel() {
  const { state, metrics } = useDraft()
  const [selectedId, setSelectedId] = useState(state.settings.myTeamId)

  const teamId = state.teams.some((t) => t.id === selectedId)
    ? selectedId
    : state.settings.myTeamId

  const roster = useMemo(
    () => getTeamRoster(state, teamId, metrics.inflation),
    [state, teamId, metrics.inflation],
  )

  const tm = metrics.teamMetrics.find((t) => t.teamId === teamId)

  return (
    <div className="panel-grid">
      <section className="card">
        <h2>Team overview</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th>Rem $</th>
                <th>Max bid</th>
                <th>#</th>
                {POSITIONS.map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.teams.map((team) => {
                const m = metrics.teamMetrics.find((x) => x.teamId === team.id)
                const isMine = team.id === state.settings.myTeamId
                return (
                  <tr
                    key={team.id}
                    className={[
                      team.id === teamId ? 'selected-row' : '',
                      isMine ? 'my-team-row' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedId(team.id)}
                  >
                    <td>
                      {team.name}
                      {isMine ? ' ★' : ''}
                    </td>
                    <td>{money(m?.remainingBudget ?? state.settings.budget)}</td>
                    <td>{money(m?.maxBid ?? state.settings.budget)}</td>
                    <td>{m?.draftedCount ?? 0}</td>
                    {POSITIONS.map((p) => (
                      <td key={p}>{m?.byPos[p] ?? 0}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>
          Roster — {state.teams.find((t) => t.id === teamId)?.name ?? 'Team'}
        </h2>
        <p className="muted">
          Remaining ${money(tm?.remainingBudget ?? 0)} · Max bid $
          {money(tm?.maxBid ?? 0)}
        </p>
        {roster.length === 0 ? (
          <p className="muted">No players drafted for this team yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Player</th>
                  <th>Cost</th>
                  <th>Inflated</th>
                  <th>Value</th>
                  <th>Bye</th>
                  <th>Keeper</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(({ player, pick, inflated, value }) => (
                  <tr key={player.id}>
                    <td>{player.pos}</td>
                    <td>{player.name}</td>
                    <td>{money(pick.paid)}</td>
                    <td>{money(inflated)}</td>
                    <td className={value >= 0 ? 'up' : 'down'}>{money(value)}</td>
                    <td>{player.bye ?? '—'}</td>
                    <td>{pick.keeper ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
