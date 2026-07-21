import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { registerServiceWorker } from './pwa/register'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

// HashRouter (not BrowserRouter): the app deploys to a GitHub Pages subpath with a relative Vite
// base and no SPA fallback, so hash routes give bookmarkable, refresh-safe deep links with zero
// server config. See DECISIONS.md.
createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

registerServiceWorker()
