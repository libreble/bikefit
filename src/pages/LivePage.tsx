/**
 * The live dashboard route (/): the tiles + trend graphs as the focus, with current-session export
 * and a compact "recent rides" preview alongside that links through to the full history.
 */
import { Link } from 'react-router-dom'
import { LiveTiles } from '../ui/LiveTiles'
import { Graphs } from '../ui/Graphs'
import { CurrentSessionExport } from '../ui/CurrentSessionExport'
import { SessionList } from '../ui/SessionList'
import { useSessions } from '../ui/useSessions'
import type { DashboardPrefs } from '../prefs/dashboard'

export function LivePage({ prefs }: { prefs: DashboardPrefs }) {
  const { sessions } = useSessions()
  const recent = sessions.slice(0, 3)

  return (
    <div className="app-main">
      <div className="col-main">
        <LiveTiles prefs={prefs} />
        <Graphs />
      </div>

      <div className="col-side">
        <CurrentSessionExport />

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-h">Recent rides</h3>
            <Link className="link" to="/sessions">
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="sessions-empty">No rides yet.</div>
          ) : (
            <SessionList sessions={recent} compact />
          )}
        </div>
      </div>
    </div>
  )
}
