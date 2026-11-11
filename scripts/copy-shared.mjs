// Copies the pure rule files into the Edge Functions folder, so the server uses exactly the app's rules.
// Run with `npm run shared` after changing any file listed in SHARED.
import { copyFileSync, mkdirSync } from 'node:fs'

export const SHARED = ['consistency.ts', 'reminder.ts', 'decision.ts', 'voice.ts']
const out = new URL('../supabase/functions/_shared/', import.meta.url)
mkdirSync(out, { recursive: true })
for (const f of SHARED) copyFileSync(new URL(`../src/lib/${f}`, import.meta.url), new URL(f, out))
console.log(`Copied ${SHARED.join(', ')} to supabase/functions/_shared/`)
