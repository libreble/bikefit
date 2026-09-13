import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app runs from any localhost path (e.g. `python3 -m http.server`
// over the `dist/` folder) — no cloud/host assumptions. The app is local-first: no network
// calls at runtime. https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
  preview: { host: true },
})
