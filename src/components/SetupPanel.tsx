import { useDraft } from '../state/DraftContext'

export function SetupPanel() {
  const {
    state,
    updateSettings,
    setTeamCount,
    renameTeam,
    setMyTeam,
    exportJson,
    importJson,
    resetDraft,
    resetAll,
  } = useDraft()
  const { settings, teams } = state

  function downloadBackup() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auction-draft-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportBackup(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importJson(String(reader.result))
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed to import backup')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="panel-grid">
      <section className="card">
        <h2>League settings</h2>
        <div className="form-grid">
          <label>
            Teams
            <input
              type="number"
              min={2}
              max={20}
              value={settings.teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value))}
            />
          </label>
          <label>
            Budget / team
            <input
              type="number"
              min={1}
              value={settings.budget}
              onChange={(e) => updateSettings({ budget: Number(e.target.value) })}
            />
          </label>
          <label>
            Roster size
            <input
              type="number"
              min={1}
              value={settings.rosterSize}
              onChange={(e) =>
                updateSettings({ rosterSize: Number(e.target.value) })
              }
            />
          </label>
        </div>

        <h3>Starters</h3>
        <div className="form-grid starters">
          {(
            [
              'QB',
              'RB',
              'WR',
              'TE',
              'FLEX',
              'K',
              'DEF',
            ] as const
          ).map((pos) => (
            <label key={pos}>
              {pos}
              <input
                type="number"
                min={0}
                value={settings.starters[pos]}
                onChange={(e) =>
                  updateSettings({
                    starters: {
                      ...settings.starters,
                      [pos]: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Teams</h2>
        <p className="muted">
          Keep your team first (or mark it as Mine). Names appear in the Drafted
          By dropdown.
        </p>
        <div className="team-list">
          {teams.map((team) => (
            <div key={team.id} className="team-row">
              <input
                type="radio"
                name="myTeam"
                checked={settings.myTeamId === team.id}
                onChange={() => setMyTeam(team.id)}
                title="My team"
              />
              <input
                type="text"
                value={team.name}
                onChange={(e) => renameTeam(team.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Backup &amp; reset</h2>
        <div className="button-row">
          <button type="button" onClick={downloadBackup}>
            Export JSON
          </button>
          <label className="file-btn">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => onImportBackup(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="danger" onClick={() => {
            if (confirm('Clear all picks? Players and settings stay.')) resetDraft()
          }}>
            Reset draft
          </button>
          <button type="button" className="danger" onClick={() => {
            if (confirm('Wipe everything including players?')) resetAll()
          }}>
            Reset all
          </button>
        </div>
      </section>
    </div>
  )
}
