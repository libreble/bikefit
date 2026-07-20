/**
 * Screen composition: header (title + profile button + connection bar), the live tiles as the main
 * focus, trends below, and the session controls alongside. Mobile-first single column that widens
 * to a two-column grid on larger screens (see index.css). The rider profile is a modal popup
 * (ProfileDialog), off the main page — better on a phone.
 */
import './index.css'
import { useState } from 'react'
import { ConnectionBar } from './ui/ConnectionBar'
import { LiveTiles } from './ui/LiveTiles'
import { Graphs } from './ui/Graphs'
import { ProfileDialog } from './ui/ProfileDialog'
import { DashboardDialog } from './ui/DashboardDialog'
import { SessionControls } from './ui/SessionControls'
import { loadProfile, profileLabel, type UserProfile } from './profile/profile'
import { loadDashboard, type DashboardPrefs } from './prefs/dashboard'

export function App() {
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile())
  const [dashOpen, setDashOpen] = useState(false)
  const [dash, setDash] = useState<DashboardPrefs>(() => loadDashboard())

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-titlebar">
          <h1 className="app-title">Bikefit — ICG IC-6</h1>
          <div className="app-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDashOpen(true)}>
              Customize
            </button>
            <button
              type="button"
              className={`btn btn-ghost profile-btn${profile ? '' : ' profile-btn--cta'}`}
              onClick={() => setProfileOpen(true)}
            >
              {profileLabel(profile)}
            </button>
          </div>
        </div>
        <ConnectionBar />
      </header>

      <main className="app-main">
        <div className="col-main">
          <LiveTiles prefs={dash} />
          <Graphs />
        </div>

        <div className="col-side">
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
      <DashboardDialog
        open={dashOpen}
        onClose={() => setDashOpen(false)}
        onChanged={() => setDash(loadDashboard())}
      />
    </div>
  )
}

export default App
