/**
 * Screen composition: header (title + profile button + connection bar), the live tiles as the main
 * focus, trends below, then a collapsible debug section and the session controls in the footer.
 * Mobile-first single column that widens to a two-column grid on larger screens (see index.css).
 * The rider profile is a modal popup (ProfileDialog), off the main page — better on a phone.
 */
import './index.css'
import { useState } from 'react'
import { ConnectionBar } from './ui/ConnectionBar'
import { LiveTiles } from './ui/LiveTiles'
import { Graphs } from './ui/Graphs'
import { DebugLog } from './ui/DebugLog'
import { ProfileDialog } from './ui/ProfileDialog'
import { SessionControls } from './ui/SessionControls'
import { loadProfile, profileLabel, type UserProfile } from './profile/profile'

export function App() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile())

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-titlebar">
          <h1 className="app-title">Bikefit — ICG IC-6</h1>
          <button
            type="button"
            className={`btn btn-ghost profile-btn${profile ? '' : ' profile-btn--cta'}`}
            onClick={() => setProfileOpen(true)}
          >
            {profileLabel(profile)}
          </button>
        </div>
        <ConnectionBar />
      </header>

      <main className="app-main">
        <div className="col-main">
          <LiveTiles />
          <Graphs />
        </div>

        <div className="col-side">
          <details className="panel debug-panel" open>
            <summary className="panel-summary">Debug / Log</summary>
            <DebugLog />
          </details>

          <div className="panel">
            <SessionControls />
          </div>
        </div>
      </main>

      <ProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onChanged={() => setProfile(loadProfile())}
      />
    </div>
  )
}

export default App
