/**
 * Screen composition: header (title + connection bar), the live tiles as the main focus, trends
 * below, then a collapsible debug section and the session controls in the footer. Mobile-first
 * single column that widens to a two-column grid on larger screens (see index.css).
 */
import './index.css'
import { ConnectionBar } from './ui/ConnectionBar'
import { LiveTiles } from './ui/LiveTiles'
import { Graphs } from './ui/Graphs'
import { DebugLog } from './ui/DebugLog'
import { SessionControls } from './ui/SessionControls'

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Bikefit — ICG IC-6</h1>
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
    </div>
  )
}

export default App
