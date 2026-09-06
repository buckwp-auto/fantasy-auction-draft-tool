import { useState } from 'react'
import { CSV_TEMPLATE, parsePlayersCsv, playersFromSampleJson } from '../lib/csv'
import { useDraft } from '../state/DraftContext'

export function PlayersPanel() {
  const { state, setPlayers } = useDraft()
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [loadingSample, setLoadingSample] = useState(false)

  function handleCsv(file: File | null, mode: 'replace' | 'merge') {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parsePlayersCsv(String(reader.result))
      setErrors(result.errors)
      if (result.players.length === 0) {
        setStatus('No players imported.')
        return
      }
      setPlayers(result.players, mode)
      setStatus(
        `${mode === 'replace' ? 'Replaced with' : 'Merged'} ${result.players.length} players.`,
      )
    }
    reader.readAsText(file)
  }

  async function loadSample() {
    setLoadingSample(true)
    setErrors([])
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}sample-players-2026.json`)
      if (!res.ok) throw new Error(`Failed to load sample (${res.status})`)
      const data = await res.json()
      const players = playersFromSampleJson(data)
      setPlayers(players, 'replace')
      setStatus(`Loaded ${players.length} sample players (2026 from elboberto sheet).`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load sample')
    } finally {
      setLoadingSample(false)
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'players-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="panel-grid">
      <section className="card">
        <h2>Import players</h2>
        <p className="muted">
          CSV columns: <code>name,pos,team,bye,tier,projected$,vbd,aav</code>.
          Season updates: export fresh values from your sheet or projections
          source and replace here. Live FantasyPros/ESPN scrape is a follow-up
          (proxy) — not in this static build.
        </p>
        <div className="button-row">
          <button type="button" onClick={downloadTemplate}>
            Download template
          </button>
          <label className="file-btn">
            Replace from CSV
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => handleCsv(e.target.files?.[0] ?? null, 'replace')}
            />
          </label>
          <label className="file-btn">
            Merge CSV
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => handleCsv(e.target.files?.[0] ?? null, 'merge')}
            />
          </label>
          <button type="button" disabled={loadingSample} onClick={loadSample}>
            {loadingSample ? 'Loading…' : 'Load 2026 sample'}
          </button>
        </div>
        {status && <p className="status">{status}</p>}
        {errors.length > 0 && (
          <ul className="error-list">
            {errors.slice(0, 12).map((err) => (
              <li key={err}>{err}</li>
            ))}
            {errors.length > 12 && <li>…and {errors.length - 12} more</li>}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Player pool ({state.players.length})</h2>
        {state.players.length === 0 ? (
          <p className="muted">No players yet. Load the sample or import a CSV.</p>
        ) : (
          <div className="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Bye</th>
                  <th>Tier</th>
                  <th>$</th>
                  <th>VBD</th>
                  <th>AAV</th>
                </tr>
              </thead>
              <tbody>
                {state.players.slice(0, 100).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.pos}</td>
                    <td>{p.nflTeam}</td>
                    <td>{p.bye ?? '—'}</td>
                    <td>{p.tier}</td>
                    <td>{p.projectedDollars.toFixed(1)}</td>
                    <td>{p.vbd.toFixed(1)}</td>
                    <td>{p.aav.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.players.length > 100 && (
              <p className="muted">Showing first 100 of {state.players.length}.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
