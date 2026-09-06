import { useEffect, useState } from 'react'
import { CSV_TEMPLATE, parsePlayersCsv, playersFromSampleJson } from '../lib/csv'
import { useDraft } from '../state/DraftContext'

interface DataMeta {
  season?: number
  lastUpdated?: string
  notes?: string
  api?: { tier?: string; limited?: boolean; projectionRows?: number }
  sources?: { projections?: string; aav?: string; valuation?: string }
  counts?: { players?: number }
}

export function PlayersPanel() {
  const { state, setPlayers } = useDraft()
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<DataMeta | null>(null)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}data/meta.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => setMeta(m))
      .catch(() => setMeta(null))
  }, [])

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

  async function loadCurrentData() {
    setLoading(true)
    setErrors([])
    try {
      const base = import.meta.env.BASE_URL
      const [playersRes, metaRes] = await Promise.all([
        fetch(`${base}data/players.json`),
        fetch(`${base}data/meta.json`),
      ])
      if (!playersRes.ok) {
        throw new Error(
          `No refreshed data yet (${playersRes.status}). Run npm run refresh-data locally, commit public/data/, then redeploy.`,
        )
      }
      const data = await playersRes.json()
      const nextMeta = metaRes.ok ? ((await metaRes.json()) as DataMeta) : null
      setMeta(nextMeta)
      const players = playersFromSampleJson(data)
      setPlayers(players, 'replace')
      const updated = nextMeta?.lastUpdated
        ? new Date(nextMeta.lastUpdated).toLocaleString()
        : 'unknown'
      setStatus(`Loaded ${players.length} players (updated ${updated}).`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load current data')
    } finally {
      setLoading(false)
    }
  }

  async function loadLegacySample() {
    setLoading(true)
    setErrors([])
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}sample-players-2026.json`)
      if (!res.ok) throw new Error(`Failed to load sample (${res.status})`)
      const data = await res.json()
      const players = playersFromSampleJson(data)
      setPlayers(players, 'replace')
      setStatus(`Loaded ${players.length} legacy Excel sample players.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load sample')
    } finally {
      setLoading(false)
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
        {meta?.lastUpdated && (
          <p className="status">
            Current data last updated:{' '}
            <strong>{new Date(meta.lastUpdated).toLocaleString()}</strong>
            {meta.api?.limited ? ' · FP API free tier (seed overlay)' : ''}
            {meta.counts?.players != null ? ` · ${meta.counts.players} players` : ''}
          </p>
        )}
        {meta?.notes && <p className="muted">{meta.notes}</p>}
        <p className="muted">
          CSV columns: <code>name,pos,team,bye,tier,projected$,vbd,aav</code>.
          To refresh from FantasyPros: set <code>FANTASYPROS_API_KEY</code> in{' '}
          <code>.env</code>, run <code>npm run refresh-data</code>, commit{' '}
          <code>public/data/</code>, and redeploy.
        </p>
        <div className="button-row">
          <button type="button" className="primary" disabled={loading} onClick={loadCurrentData}>
            {loading ? 'Loading…' : 'Load current data'}
          </button>
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
          <button type="button" disabled={loading} onClick={loadLegacySample}>
            Load legacy Excel sample
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
          <p className="muted">No players yet. Load current data or import a CSV.</p>
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
