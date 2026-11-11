# Experiments

A personal habit-experiment app. Each experiment is a 65-day trial of one habit on chosen days of the week. The app tracks a sliding average of consistency and, on day 65, asks the user to keep or drop the habit.

The source of truth for every screen, style and number is `design/prototype.dc.html` (the Version 2 prototype). When anything here or in the docs is unclear, match the prototype.

## Stack

- Vite + React + TypeScript, installed as a PWA (vite-plugin-pwa). Phone-first, 390 px wide layout.
- Supabase: Postgres, email one-time-code sign-in, Storage, Edge Functions, pg_cron.
- Hosting: Cloudflare Pages from the `main` branch. Build `npm run build`, output `dist/`.
- Voice: OpenRouter, called only from a Supabase Edge Function. Never put an API key in client code.
- Tests: Vitest.

## Rules that must not drift

- **Schedule:** an experiment is due on a set of days of the week (`schedule_days`, 0 = Sunday). No other schedule types.
- **Trial:** always 65 days. Day 1 is `start_date`. The day ends at 12 am local time (the user's `profiles.timezone`). Store days as plain dates, never UTC timestamps.
- **Day status:** a scheduled day is `done` if logged yes, `missed` if logged no, `missed` if it's in the past with no log, and `pending` if it's today with no log. Pending never counts as a miss.
- **Sliding window:** the last 7 *scheduled* days that are resolved (done or missed), never the last 7 calendar days.
- **Tiers:** New = fewer than 7 resolved scheduled days. Otherwise, counting misses in the window: Inconsistent > 3, Semimature 2 to 3, Mature ≤ 1.
- **Showing numbers:** a New habit shows "n/7 tracked", never a percentage. Others show the window percentage.
- **No backfill:** a late log or photo never turns a past missed day into done.
- **Day 65:** logging yes on the last day opens the celebration. After the decision, tracking stops.
- **Limit:** at most 3 new experiments started per calendar week (Monday start).

## Code structure

- `src/lib/consistency.ts` holds all the maths: occasions, status, analyze, tiers, scheduleLabel, nextDue. It must not import React or Supabase, and must not read the clock: every function takes `today` as an argument. Every number on screen comes from here.
- `src/store.ts` is the only module that reads or writes data. Screens call the store, never Supabase directly.
- Keep the last-loaded data in IndexedDB so the app opens offline. Queue offline writes and send them on the next open.

## Look

- Colours: ground `#DAD4C8`, card `#EDE9E0`, cream `#F3F0E9`, green `#2F7A4B`, dark green `#245A3A`, text green `#2E5A2B`, accent red `#96371C`, miss orange `#E0875A`, ink `#2B2A26`, secondary text `#5D5A52`, rule `#C9C2B3`.
- Type: Poppins for everything; Fraunces only for numbers and the italic empty-state and "Why" lines.
- Tap targets at least 44 px. Respect `prefers-reduced-motion`. Copy the prototype's animations and their timings.
- Icons are inline stroke SVGs as in the prototype. No emoji in the UI.

## Deliberate differences from the prototype

Keep these; don't "fix" them back to the prototype.

- **Create screen:** the voice (mic) button is in the bottom bar, a 56 px round button to the right of "Start experiment" (like the bell on Home), so it sits under the thumb. The prototype's "Say it and the form fills itself in." card at the top is removed.

## Working style

- Run `npm test` before saying a step is done. Add a test for every rule you touch.
- Test on the deployed `pages.dev` URL on an iPhone for anything involving notifications, the microphone or installing.
- Docs in `design/`: `system-design.md`, `picture-tracking.md`, `deployment-plan.md`. Where they disagree, `deployment-plan.md` wins, then the prototype.
