/**
 * App shell: a header (title + actions, a Live/History nav, and the global connection bar) over a
 * routed content area. Routes: / live dashboard, /sessions history, /sessions/:id a bookmarkable
 * session. The rider profile and dashboard-customize dialogs are global modals. The BLE session and
 * store live in module singletons, so navigating between routes never interrupts a live ride.
 */
import './index.css'
import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ConnectionBar } from './ui/ConnectionBar'
import { ProfileDialog } from './ui/ProfileDialog'
import { DashboardDialog } from './ui/DashboardDialog'
import { LivePage } from './pages/LivePage'
import { HistoryPage } from './pages/HistoryPage'
import { SessionPage } from './pages/SessionPage'
import { loadProfile, profileLabel, type UserProfile } from './profile/profile'
import { loadDashboard, type DashboardPrefs } from './prefs/dashboard'

const navClass = ({ isActive }: { isActive: boolean }): string =>
  `nav-link${isActive ? ' nav-link--active' : ''}`

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

        <nav className="app-nav" aria-label="Sections">
          <NavLink to="/" end className={navClass}>
            Live
          </NavLink>
          <NavLink to="/sessions" className={navClass}>
            History
          </NavLink>
        </nav>

        <ConnectionBar />
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<LivePage prefs={dash} />} />
          <Route path="/sessions" element={<HistoryPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
