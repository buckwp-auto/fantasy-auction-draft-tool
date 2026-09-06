import { useMemo, useState } from 'react'
import {
  inflatedDollars,
} from '../lib/calculations'
import { POSITIONS, type Position } from '../types'
import { useDraft } from '../state/DraftContext'

function money(n: number): string {
  return n.toFixed(1)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

export function AuctionPanel() {
  const {
    state,
    metrics,
    recordPick,
    clearPick,
    undoLastPick,
    cyclePlayerMark,
  } = useDraft()
  const [query, setQuery] = useState('')
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL')
  const [markFilter, setMarkFilter] = useState<'ALL' | 'target' | 'avoid'>('ALL')
  const [availableOnly, setAvailableOnly] = useState(true)
  const [draftPlayerId, setDraftPlayerId] = useState<string | null>(null)
  const [draftTeamId, setDraftTeamId] = useState(state.settings.myTeamId)
  const [draftPaid, setDraftPaid] = useState(1)
  const [draftKeeper, setDraftKeeper] = useState(false)

  const pickByPlayer = useMemo(
    () => new Map(state.picks.map((p) => [p.playerId, p])),
    [state.picks],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.players.filter((p) => {
      if (posFilter !== 'ALL' && p.pos !== posFilter) return false
      if (markFilter !== 'ALL' && (p.mark ?? 'none') !== markFilter) return false
      const pick = pickByPlayer.get(p.id)
      if (availableOnly && pick) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.nflTeam.toLowerCase().includes(q) ||
        p.tier.toLowerCase().includes(q)
      )
    })
  }, [state.players, query, posFilter, markFilter, availableOnly, pickByPlayer])

  const bestIds = useMemo(() => {
    const ids = new Set<string>()
    for (const m of metrics.byPosition) {
      if (!m.bestName) continue
      const p = state.players.find(
        (x) => x.name === m.bestName && x.pos === m.pos && !pickByPlayer.has(x.id),
      )
      if (p) ids.add(p.id)
    }
    return ids
  }, [metrics.byPosition, state.players, pickByPlayer])

  function openDraft(playerId: string) {
    const player = state.players.find((p) => p.id === playerId)
    if (!player) return
    const existing = pickByPlayer.get(playerId)
    setDraftPlayerId(playerId)
    setDraftTeamId(existing?.teamId ?? state.settings.myTeamId)
    setDraftPaid(
      existing?.paid ??
        Math.max(1, Math.round(inflatedDollars(player.projectedDollars, metrics.inflation))),
    )
    setDraftKeeper(existing?.keeper ?? false)
  }

  function submitDraft() {
    if (!draftPlayerId) return
    recordPick({
      playerId: draftPlayerId,
      teamId: draftTeamId,
      paid: Math.max(0, Number(draftPaid) || 0),
      keeper: draftKeeper,
    })
    setDraftPlayerId(null)
  }

  const draftPlayer = state.players.find((p) => p.id === draftPlayerId)

  return (
    <div className="auction-layout">
      <div className="metrics-bar">
        <div className="metric">
          <span className="label">Overall {metrics.inflationLabel}</span>
          <strong className={metrics.inflation >= 1 ? 'up' : 'down'}>
            {metrics.inflation.toFixed(3)}
          </strong>
        </div>
        <div className="metric">
          <span className="label">My remaining $</span>
          <strong>{money(metrics.remainingBudgetMine)}</strong>
        </div>
        <div className="metric">
          <span className="label">Max bid</span>
          <strong>{money(metrics.maxBidMine)}</strong>
        </div>
        <div className="metric">
          <span className="label">Avg $/spot left</span>
          <strong>{money(metrics.avgRemainingPerSpot)}</strong>
        </div>
        <div className="metric actions">
          <button type="button" onClick={undoLastPick} disabled={state.picks.length === 0}>
            Undo last
          </button>
        </div>
      </div>

      <div className="best-grid">
        {metrics.byPosition
          .filter((m) => ['QB', 'RB', 'WR', 'TE'].includes(m.pos))
          .map((m) => (
            <div
              key={m.pos}
              className={`best-card ${m.dropoff !== null && m.dropoff > 0.2 ? 'dropoff' : ''}`}
            >
              <header>
                <strong>{m.pos}</strong>
                <span>Spend {pct(m.spendingPct)}</span>
              </header>
              <p className="best-name">{m.bestName ?? '—'}</p>
              <p className="muted">
                ${money(m.bestInflated)} · VBD {money(m.bestVbd)}
              </p>
              <p className="muted small">
                2nd: {m.secondName ?? '—'} (${money(m.secondInflated)})
                {m.dropoff !== null ? ` · drop ${pct(m.dropoff)}` : ''}
              </p>
              <p className="muted small">Avg rem ${money(m.avgRemaining)}</p>
            </div>
          ))}
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value as Position | 'ALL')}
        >
          <option value="ALL">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={markFilter}
          onChange={(e) =>
            setMarkFilter(e.target.value as 'ALL' | 'target' | 'avoid')
          }
        >
          <option value="ALL">All marks</option>
          <option value="target">Targets only</option>
          <option value="avoid">Avoids only</option>
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available only
        </label>
        <span className="muted small">Click ★ to cycle none → target → avoid</span>
      </div>

      <div className="table-wrap">
        <table className="auction-table">
          <thead>
            <tr>
              <th title="Mark">★</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Bye</th>
              <th>Team</th>
              <th>Tier</th>
              <th>Proj $</th>
              <th>Inflated $</th>
              <th>Paid</th>
              <th>Skew</th>
              <th>AAV</th>
              <th>Drafted By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const pick = pickByPlayer.get(p.id)
              const inflated = inflatedDollars(p.projectedDollars, metrics.inflation)
              const paid = pick?.paid ?? 0
              const skew = pick ? inflated - paid : 0
              const teamName = pick
                ? state.teams.find((t) => t.id === pick.teamId)?.name
                : ''
              const isBest = bestIds.has(p.id)
              const mark = p.mark ?? 'none'
              return (
                <tr
                  key={p.id}
                  className={[
                    pick ? 'drafted' : '',
                    isBest ? 'best-available' : '',
                    mark === 'target' ? 'targeted' : '',
                    mark === 'avoid' ? 'avoided' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td>
                    <button
                      type="button"
                      className={`star mark-${mark}`}
                      title={`Mark: ${mark} (click to cycle)`}
                      onClick={() => cyclePlayerMark(p.id)}
                    >
                      {mark === 'avoid' ? '✕' : '★'}
                    </button>
                  </td>
                  <td>{p.name}</td>
                  <td>{p.pos}</td>
                  <td>{p.bye ?? '—'}</td>
                  <td>{p.nflTeam}</td>
                  <td>{p.tier}</td>
                  <td>{money(p.projectedDollars)}</td>
                  <td>{money(inflated)}</td>
                  <td>{pick ? money(paid) : ''}</td>
                  <td className={skew >= 0 ? 'up' : 'down'}>
                    {pick ? money(skew) : ''}
                  </td>
                  <td>{money(p.aav)}</td>
                  <td>
                    {teamName}
                    {pick?.keeper ? ' (K)' : ''}
                  </td>
                  <td className="row-actions">
                    {pick ? (
                      <button type="button" onClick={() => clearPick(p.id)}>
                        Undo
                      </button>
                    ) : (
                      <button type="button" className="primary" onClick={() => openDraft(p.id)}>
                        Draft
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {draftPlayer && (
        <div className="modal-backdrop" onClick={() => setDraftPlayerId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Draft {draftPlayer.name}</h3>
            <p className="muted">
              {draftPlayer.pos} · Proj ${money(draftPlayer.projectedDollars)} ·
              Inflated ${money(inflatedDollars(draftPlayer.projectedDollars, metrics.inflation))}
            </p>
            <label>
              Team
              <select
                value={draftTeamId}
                onChange={(e) => setDraftTeamId(e.target.value)}
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paid $
              <input
                type="number"
                min={0}
                value={draftPaid}
                onChange={(e) => setDraftPaid(Number(e.target.value))}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draftKeeper}
                onChange={(e) => setDraftKeeper(e.target.checked)}
              />
              Keeper (excluded from spending %)
            </label>
            <div className="button-row">
              <button type="button" className="primary" onClick={submitDraft}>
                Confirm
              </button>
              <button type="button" onClick={() => setDraftPlayerId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
