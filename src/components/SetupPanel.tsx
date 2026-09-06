import { useState } from 'react'
import type { FlexType } from '../types'
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
    applySuperflexPreset,
  } = useDraft()
  const { settings, teams } = state
  const [showAdvanced, setShowAdvanced] = useState(false)

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
        <div className="button-row" style={{ marginBottom: '0.75rem' }}>
          <button type="button" onClick={applySuperflexPreset}>
            Apply Superflex preset
          </button>
          <span className="muted">
            Sets SUPERFLEX=1 (QB/RB/WR/TE), FLEX=0 — like 2QB.
          </span>
        </div>
        <div className="form-grid starters">
          {(
            [
              'QB',
              'RB',
              'WR',
              'TE',
              'FLEX',
              'SUPERFLEX',
              'K',
              'DEF',
            ] as const
          ).map((pos) => (
            <label key={pos}>
              {pos === 'SUPERFLEX' ? 'Superflex' : pos}
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
        <label style={{ marginTop: '0.75rem' }}>
          FLEX eligibility
          <select
            value={settings.flexType}
            onChange={(e) =>
              updateSettings({ flexType: e.target.value as FlexType })
            }
          >
            <option value="WR/RB/TE">WR/RB/TE</option>
            <option value="WR/RB">WR/RB</option>
            <option value="WR/TE">WR/TE</option>
            <option value="QB/RB/WR/TE">QB/RB/WR/TE</option>
          </select>
        </label>

        <button
          type="button"
          className="linkish"
          style={{ marginTop: '1rem' }}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
        </button>

        {showAdvanced && (
          <div className="advanced-block">
            <h3>Keeper rules</h3>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.keepersCountAgainstBudget}
                onChange={(e) =>
                  updateSettings({
                    keepersCountAgainstBudget: e.target.checked,
                  })
                }
              />
              Keepers count against remaining budget
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.keepersExcludedFromSpendingPct}
                onChange={(e) =>
                  updateSettings({
                    keepersExcludedFromSpendingPct: e.target.checked,
                  })
                }
              />
              Exclude keepers from position spending %
            </label>

            <h3>Scoring (half-PPR defaults)</h3>
            <p className="muted">
              Stored for parity with elboberto / future revaluation. Auction board
              uses imported projected $ today.
            </p>
            <div className="form-grid">
              {(
                [
                  ['passTd', 'Pass TD'],
                  ['passYdsPerPoint', 'Pass yds / pt'],
                  ['passInt', 'INT'],
                  ['rushTd', 'Rush TD'],
                  ['rushYdsPerPoint', 'Rush yds / pt'],
                  ['recTd', 'Rec TD'],
                  ['recYdsPerPoint', 'Rec yds / pt'],
                  ['receptions', 'PPR'],
                  ['fumbleLost', 'Fumble lost'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    step="any"
                    value={settings.scoring[key]}
                    onChange={(e) =>
                      updateSettings({
                        scoring: {
                          ...settings.scoring,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Teams</h2>
        <p className="muted">
          Keep your team marked as Mine. Names appear in the Drafted By dropdown.
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
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm('Clear all picks? Players and settings stay.'))
                resetDraft()
            }}
          >
            Reset draft
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (confirm('Wipe everything including players?')) resetAll()
            }}
          >
            Reset all
          </button>
        </div>
      </section>
    </div>
  )
}
