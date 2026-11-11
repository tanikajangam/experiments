import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App, { isDemoLink } from './App.tsx'
import { idbCache } from './lib/idbCache.ts'
import { supabaseBackend } from './lib/supabaseBackend.ts'
import { store } from './store.ts'

// Start-screen links (?screen=…) run on seed data in memory; App sets that up. Otherwise go live.
if (!isDemoLink()) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (url && key) void store.start(supabaseBackend(url, key), idbCache())
  else store.unconfigured()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
