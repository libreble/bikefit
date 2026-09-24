import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Shown in the footer. Tag builds in CI use the tag (v1.2.0); elsewhere `git describe`
// (v1.2.0-3-gabc1234, or a bare sha on a shallow clone); `APP_VERSION` overrides; no git → "dev".
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME)
    return process.env.GITHUB_REF_NAME
  try {
    return execSync('git describe --tags --always', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// Relative base so the built app runs from any localhost path (e.g. `python3 -m http.server`
// over the `dist/` folder) — no cloud/host assumptions. The app is local-first: no network
// calls at runtime. https://vite.dev/config/
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
})
