/**
 * App shell: a header (title + a Live/History/Settings nav and the global connection bar) over a
 * routed content area. Routes: / live dashboard, /sessions history, /sessions/:id a bookmarkable
 * session, /settings the language/profile/dashboard config (once header buttons + modals, now a
 * tab — keeps the top bar clean on a phone). The BLE session and store live in module singletons,
 * so navigating between routes never interrupts a live ride.
 */
import './index.css'
import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ConnectionBar } from './ui/ConnectionBar'
import { LanguageSwitcher } from './ui/LanguageSwitcher'
import { LivePage } from './pages/LivePage'
import { HistoryPage } from './pages/HistoryPage'
import { SessionPage } from './pages/SessionPage'
import { SettingsPage } from './pages/SettingsPage'
import { loadProfile, type UserProfile } from './profile/profile'
import { loadDashboard, type DashboardPrefs } from './prefs/dashboard'
import { useT } from './i18n/i18n'

const navClass = ({ isActive }: { isActive: boolean }): string =>
  `nav-link${isActive ? ' nav-link--active' : ''}`

export function App() {
  const t = useT()
  const [profile, setProfile] = useState<UserProfile | null>(() => loadProfile())
  const [dash, setDash] = useState<DashboardPrefs>(() => loadDashboard())

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-titlebar">
          <h1 className="app-title">{t('app.title')}</h1>
          <LanguageSwitcher />
        </div>

        <nav className="app-nav" aria-label={t('nav.label')}>
          <NavLink to="/" end className={navClass}>
            {t('nav.live')}
          </NavLink>
          <NavLink to="/sessions" className={navClass}>
            {t('nav.history')}
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            {t('nav.settings')}
          </NavLink>
        </nav>

        <ConnectionBar />
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<LivePage prefs={dash} maxHr={profile?.maxHr} />} />
          <Route path="/sessions" element={<HistoryPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
          <Route
            path="/settings"
            element={
              <SettingsPage
                onProfileChanged={() => setProfile(loadProfile())}
                onDashChanged={() => setDash(loadDashboard())}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
