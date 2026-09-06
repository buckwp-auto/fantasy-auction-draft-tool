import { useState } from 'react'
import { AuctionPanel } from './components/AuctionPanel'
import { PlayersPanel } from './components/PlayersPanel'
import { SetupPanel } from './components/SetupPanel'
import { TeamsPanel } from './components/TeamsPanel'
import { DraftProvider, useDraft } from './state/DraftContext'
import type { TabId } from './types'
import './App.css'

const TABS: { id: TabId; label: string }[] = [
  { id: 'setup', label: 'Setup' },
  { id: 'players', label: 'Players' },
  { id: 'auction', label: 'Auction' },
  { id: 'teams', label: 'Teams' },
]

function Shell() {
  const [tab, setTab] = useState<TabId>('setup')
  const { state, metrics } = useDraft()

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Fantasy Auction Draft</h1>
          <p className="subtitle">
            {state.settings.teamCount} teams · ${state.settings.budget} ·{' '}
            {state.players.length} players · {state.picks.length} picked ·{' '}
            {metrics.inflationLabel} {metrics.inflation.toFixed(3)}
          </p>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'setup' && <SetupPanel />}
        {tab === 'players' && <PlayersPanel />}
        {tab === 'auction' && <AuctionPanel />}
        {tab === 'teams' && <TeamsPanel />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DraftProvider>
      <Shell />
    </DraftProvider>
  )
}
