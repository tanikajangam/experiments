# Experiments App: System Design

Nov 7, 2026 · @Tanika Jangam

## Recommendation

Build it as a home-screen web app, not a native iOS app. A React + TypeScript PWA, hosted free, with Supabase (Postgres, file storage, auth, serverless functions) as the only backend, and OpenRouter for voice. You install it on your iPhone from Safari with Share → Add to Home Screen. No Apple developer account, no App Store, no Mac required, and the running cost is $0 a month plus a few cents of OpenRouter credit.

Why this over a native app: everything the prototype does works in a home-screen web app on current iOS, including push notifications (since iOS 16.4), the camera, and enough storage for photos. The two things it can't do, scheduling a notification on the phone without a server and running in the background, are handled by a tiny scheduled job on Supabase. The native route costs either $99 a year (Apple Developer Program) or a reinstall from a Mac every 7 days (free Apple ID), and buys you nothing this app needs yet.

| Layer | Choice | Cost |
| --- | --- | --- |
| App | Vite + React + TypeScript, PWA (service worker, manifest) | $0 |
| Hosting | Cloudflare Pages or Vercel, static files, free tier | $0 |
| Database, photos, auth, functions | Supabase Free plan: 500 MB Postgres, 1 GB file storage, 2 projects | $0 (Pro is $25/mo if you outgrow it) |
| Voice | OpenRouter: `openai/whisper-large-v3-turbo` for speech-to-text, then a small chat model to sort the transcript into fields | about $0.001 per use |
| Reminders | Supabase cron → Edge Function → Web Push to the phone | $0 |
| Phone | Add to Home Screen on iOS | $0 |

The one real catch: Supabase pauses free projects after 1 week of inactivity. A daily habit app you use daily never hits that, but a week away means the first open afterwards is slow while it restores. If that bothers you, Pro at $25 a month removes it; nothing else about the design changes.

## Getting it on your phone without the App Store

Four ways exist. Only the first costs nothing and needs no Apple account.

| Route | What you do | Cost | Expires | Needs a Mac | Push notifications | Camera |
| --- | --- | --- | --- | --- | --- | --- |
| Home-screen web app (PWA) | Open the site in Safari, Share → Add to Home Screen | $0 | Never | No | Yes, since iOS 16.4, once installed | Yes |
| Xcode with a free Apple ID | Build in Xcode, plug in the phone, run | $0 | Every 7 days; re-run from Xcode | Yes | Yes (native) | Yes |
| Apple Developer Program | Upload to TestFlight (internal testing, no App Review) or ad-hoc install | $99/year | TestFlight builds 90 days; ad-hoc 1 year | Yes, or a build service | Yes | Yes |
| Expo Go | Run the React Native project inside the Expo Go app from the App Store | $0 | While the project is published | No | Limited | Yes |

What the PWA can and can't do on iOS, as of 2026:

- Push: supported since iOS 16.4 for apps added to the home screen. Notifications must be visible (no silent push). Declarative Web Push arrived in iOS 18.4.
- Storage: no 50 MB cap any more. Since Safari 17 the quota comes from free disk space, and Safari's 7-day storage deletion does not apply to installed home-screen apps. Photos still go to Supabase, not the phone, so a reinstall never loses them.
- Camera: `<input type="file" accept="image/*" capture="environment">` opens the camera directly and is the reliable path. Live camera preview via `getUserMedia` also works in recent iOS but adds nothing here.
- No background work: the app can't run a timer while closed and can't schedule a notification on its own. The reminder has to come from a server push (see Reminders).
- iOS 26 made any site added to the home screen open as a standalone app by default, manifest or not. Keep the manifest anyway for the icon and name.

When to switch to native: if you later want the recap video rendered on the phone, true background photo sync, or widgets on the lock screen. At that point the code moves to Expo (React Native), and the consistency logic, data model and backend all carry over unchanged. Expect the $99 a year then.

Sources: [PWA on iPhone in 2026](https://synthetixis.com/writing/pwa-ios-2026), [PWA iOS limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [Testing on your own phone](https://newly.app/guides/test-on-your-own-phone), [Your own app on your iPhone](https://www.codestudy.net/blog/can-i-put-my-own-app-on-just-my-iphone/).

## Architecture

&#91;embedded content: system architecture: phone, Supabase, OpenRouter, push\]

The phone does almost all the work. It computes the sliding averages itself from a few dozen rows, so the database stays a plain store of what happened. Supabase does three things the phone can't: keep the data when the phone is wiped, hold the OpenRouter and push keys (an API key must never ship inside a web app), and wake up on a schedule to send the reminder. Row Level Security on every table means a signed-in user only ever sees their own rows, which is what makes it safe to call Postgres straight from the browser.

Offline: the service worker caches the app shell so it opens instantly, and the app keeps the last-loaded experiments in IndexedDB. Logging while offline is queued and sent on the next open. Photos upload when there's a connection; until then they sit in IndexedDB and still count toward the day.

## Data model

Five tables. Everything you see on the Analysis screen (sliding average, tier, streaks, trend bars) is computed on the phone from `logs` and `photos`; none of it is stored. That keeps the schema small and means a bug in the math is fixed by shipping new JavaScript, not by migrating data.

| Table | Field | Type | Notes |
| --- | --- | --- | --- |
| profiles | id | uuid, PK | Same as the auth user id |
| profiles | timezone | text | e.g. America/New\_York; needed so "today" and the reminder are in your time |
| profiles | reminder\_on | boolean | Default true |
| profiles | reminder\_time | time | Default 20:00 |
| profiles | push\_subscription | jsonb | Endpoint and keys from the browser's PushManager |
| experiments | id | uuid, PK |  |
| experiments | user\_id | uuid, FK | RLS filters on this |
| experiments | title | text |  |
| experiments | where\_note | text | The Where? field |
| experiments | why\_note | text |  |
| experiments | schedule\_days | smallint\[\] | Days of week it's due, 0 = Sunday. Every day is {0..6} |
| experiments | tracking | text | 'check' or 'picture' |
| experiments | photo\_target | smallint | Photos per day that count as done; only for picture |
| experiments | start\_date | date | Day 1 |
| experiments | length\_days | smallint | 65 |
| logs | id | uuid, PK |  |
| logs | experiment\_id | uuid, FK |  |
| logs | day | date | Unique with experiment\_id: one log per scheduled day |
| logs | done | boolean | The Yes/No |
| logs | note | text |  |
| photos | id | uuid, PK |  |
| photos | experiment\_id | uuid, FK |  |
| photos | day | date | The day it counts for, from taken\_at in the user's timezone |
| photos | taken\_at | timestamptz | From EXIF; falls back to upload time, flagged |
| photos | source | text | 'camera' or 'upload' |
| photos | path | text | Object key in the photos bucket |
| photos | thumb\_path | text | 320 px version, made on the phone |
| photos | bytes | integer |  |
| photos | sha256 | text | Unique per experiment; blocks double uploads |
| decisions | experiment\_id | uuid, PK, FK | One decision per experiment |
| decisions | outcome | text | 'keep' or 'drop' |
| decisions | effort | text | When it stopped feeling like effort |
| decisions | survive | text | Will it survive without tracking |
| decisions | cost | text\[\] | Not much, Time, Energy, Social life |
| decisions | cost\_note | text |  |
| decisions | change | text | What it quietly changed |
| decisions | decided\_on | date |  |

How photos are stored. The image bytes never go in Postgres. The phone resizes each photo to a 1600 px long edge (about 300 KB) and a 320 px thumbnail, reads the EXIF date first (the `exifr` library, before resizing strips it), and uploads both files to a private Supabase Storage bucket at `{user_id}/{experiment_id}/{day}/{photo_id}.jpg`. Then it inserts the `photos` row. Reads go through short-lived signed URLs, so nothing is public. At 300 KB a photo, a 65-day habit with 3 photos a day is about 60 MB, so the free plan's 1 GB holds roughly 15 such habits before you'd pay for storage.

Status of a day, in one place in the code:

```markdown
check habit:    log.done ? done : missed;  no log and past -> missed;  no log and today -> pending
picture habit:  photos on that day >= photo_target -> done;  fewer and past -> missed;  fewer and today -> pending
```

Row Level Security: every table gets a policy `user_id = auth.uid()` (for logs, photos and decisions, via a join to experiments). Sign-in is a magic link to your email, so there's no password and nothing to build.

## Database choice and cost

Supabase, because it's one account that covers the four things this app needs (Postgres, file storage, sign-in, a scheduled job) and Claude Code knows it well. The alternatives either cost money sooner or split the work across two or three services.

| Option | What it gives you | Free tier | When you'd pay | Why not |
| --- | --- | --- | --- | --- |
| Supabase (recommended) | Postgres + Storage + Auth + Edge Functions + cron | $0: 500 MB database, 1 GB storage, 5 GB egress, 2 projects; paused after 1 week idle | Pro $25/mo: 8 GB database, 100 GB storage, never paused; extra storage $0.0213/GB | The idle pause |
| Firebase (Firestore + Cloud Storage) | Document database + storage + auth + functions | Generous free tier, no idle pause | Pay as you go past free | Firestore's document model makes the per-day queries clumsier; functions need a card on file |
| SQLite on the phone only | No server at all | $0 | Never | A wiped phone or a reinstall loses everything; no reminders without a server; photos fill the phone |
| Cloudflare D1 + R2 + Workers | SQL + object storage + functions | $0 with generous limits, no pause | Rarely | More assembly: auth and the cron are yours to write |

What you'll actually pay for this app on Supabase Free: nothing, as long as you open it at least once a week. One habit of photos is about 60 MB of the 1 GB. Database rows for a year of daily habits are under a megabyte. Egress is the only limit worth watching: every time the Analysis screen loads 65 thumbnails it pulls about 2 MB, so 5 GB a month is around 80 full loads a day. Cache thumbnails on the phone and that never matters.

Source: [Supabase pricing](https://supabase.com/pricing), read Nov 7, 2026.

## Voice: model and how the call works

Use two cheap calls, not one clever one. First speech-to-text, then a small chat model turns the transcript into the form's fields. Both go through OpenRouter with one API key, and the key lives in a Supabase Edge Function, never in the app.

**Speech-to-text: `openai/whisper-large-v3-turbo`.** OpenRouter added a dedicated transcription endpoint in May 2026 (`POST /api/v1/audio/transcriptions`, OpenAI-compatible, so the OpenAI SDK works with the base URL changed). Whisper large v3 turbo is listed at $0.000003 per second, so a 60-second reflection costs $0.00018. It takes wav, mp3, m4a, webm and others up to 25 MB, auto-detects language, and returns plain text plus the cost in the response. If accuracy on a noisy recording ever bothers you, `openai/whisper-large-v3` is the same model un-sped-up at $0.000008 per second.

**Sorting into fields: a small chat model with JSON output.** Send the transcript plus the four questions and ask for strict JSON. Use google/gemini-3.5-flash-lite (released Jul 2026, $0.30 input / $2.50 output per 1M tokens, structured outputs supported), sending a JSON schema in response\_format so the reply can only contain the allowed chip values. A reflection is about 500 tokens in and 100 out, so roughly $0.0004 a call. The prompt is the whole feature:

```markdown
You are filling a form from what a person said after finishing a 65-day habit trial.
Return only JSON with these keys. Use null when they did not address a question.
  effort:  one of ["Never", "Near the end", "Around the middle", "Early on"]
  survive: one of ["Yes", "Probably", "Doubt it", "No"]
  cost:    array from ["Not much", "Time", "Energy", "Social life"]
  cost_note: string or null
  change:  one sentence in their own words, or null
The trial lasted 65 days, about 9 weeks. For effort: "Early on" is weeks 1 to 2, "Around the middle" is weeks 3 to 6, "Near the end" is weeks 7 to 9, "Never" means it always felt like effort.
For cost, pick only what they said it cost. Lost sleep or tiredness is "Energy"; hours spent is "Time".
Transcript: """{transcript}"""
```

The two lines before the transcript were added on Nov 11, 2026, after testing: without them "it stopped being hard around week three" came back as "Early on" (the model didn't know the trial is about 9 weeks), and lost sleep came back as both Time and Energy.

The same function serves the New Experiment screen with a different key list (title, schedule\_days, where, why, tracking, photo\_target). The app shows the filled chips and lets the person fix any of them before saving, so a wrong guess costs one tap.

Flow on the phone: record with `MediaRecorder` (webm/opus on iOS 17+, m4a fallback), POST the blob to the `transcribe` Edge Function, get JSON back, fill the form. About 2 to 4 seconds end to end. Cost per use is under a tenth of a cent, so $5 of OpenRouter credit is effectively unlimited for one person.

Sources: [OpenRouter speech-to-text docs](https://openrouter.ai/docs/guides/overview/multimodal/stt), [audio APIs announcement](https://openrouter.ai/blog/announcements/announcing-audio-apis/), [speech-to-text model list and prices](https://openrouter.ai/collections/speech-to-text-models), read Nov 7, 2026.

## Reminders

A home-screen web app can't set an alarm on the phone, so the nudge comes from the server. It's four small pieces:

1. On first open, the app asks for notification permission and saves the browser's push subscription to `profiles.push_subscription`. iOS only allows this after the app is on the home screen, so the prompt waits until then.
2. A Supabase cron job runs every 15 minutes and calls the `remind` Edge Function.
3. `remind` finds profiles whose `reminder_time` in their own timezone falls in this 15-minute slot, and for each checks whether anything is due today and not yet logged (same `schedule_days` rule the app uses).
4. If so, it sends one Web Push: "2 to log: Gym, 3 meals". Tapping it opens Home. Nothing is sent if everything's done, and nothing is ever sent twice.

If you later move to a native app, this whole section collapses to one line: schedule a local notification on the phone each morning. That's the single biggest thing native buys you.

One caveat worth knowing before you rely on it: iOS delivers web push reliably but not instantly, so "8:00 pm" can land at 8:03. For a habit nudge that's fine.

## From the canvas to code with Claude Code

The prototype already contains the hardest part: the consistency math (`occasions`, `status`, `analyze`, `scheduleLabel`, `nextDue`) and the seed data, both in `Main.dc.html`. Hand Claude Code that file and the two spec docs, and have it port the logic before it draws a single screen.

What to put in the repo before the first prompt:

- `design/Main.dc.html`: download it from the canvas (Share → Export, or copy the file). The screens, styles and logic are all in it.
- `design/picture-tracking.md` and `design/system-design.md`: these two docs, exported as Markdown.
- `CLAUDE.md` with the rules that must not drift: the colours (#DAD4C8 ground, #EDE9E0 card, #2F7A4B green, #96371C accent text, #245A3A dark green), Poppins, 390 px phone width, the one status rule from the Data model section, and "the sliding window is the last 7 scheduled days, never 7 calendar days."

The order of work, one Claude Code session each:

| Step | Ask Claude Code to | Done when |
| --- | --- | --- |
| 1. Scaffold | Create a Vite + React + TypeScript app with vite-plugin-pwa, Supabase client, and a Vitest setup | `npm run dev` opens a blank beige page on your phone over the local network |
| 2. Port the math | Move the DCLogic methods into `src/lib/consistency.ts` with types, and write tests from the seed data (3 meals = 1 miss in 3 = 67%, Stretch = complete, Gym = Mon/Wed/Thu occasions) | Tests pass; no UI yet |
| 3. Screens | Build Home, Create, Log, Analysis, Celebrate, Decide as React components matching the artboards, reading from a local in-memory store | Every screen matches the canvas on your phone |
| 4. Supabase | Create the project, apply the schema from this doc as a SQL migration with RLS, wire magic-link sign-in, replace the in-memory store | Logs survive a reload and a reinstall |
| 5. Photos | Camera input, resize, EXIF date, upload, the photos table, the day collage | The meals habit logs by photo |
| 6. Voice | The `transcribe` Edge Function with the OpenRouter key as a secret, and the mic on Create and Decide | Speaking fills the form |
| 7. Reminders | Push subscription, the `remind` function, the cron | The 8 pm nudge arrives on the phone |
| 8. Ship | Deploy to Cloudflare Pages, add to home screen | It's an app |

Two things to insist on in the prompts. First, the logic file has no React in it and no Supabase in it; it takes plain arrays and a date and returns numbers. That's what makes it testable and what makes a later move to Expo free. Second, build against the real phone from step 1 (Vite's `--host` flag plus your laptop's IP), because the whole point is how it feels in your hand, and a layout that works in Chrome's phone emulator often doesn't.

## Cost summary and open decisions

| Item | Monthly | Notes |
| --- | --- | --- |
| Cloudflare Pages or Vercel hosting | $0 | Static site, free tier |
| Supabase Free | $0 | Paused after a week unused; Pro is $25 if that ever bites |
| OpenRouter | about $0.01 | Prepaid credit; $5 lasts a very long time for one person |
| Apple | $0 | No developer account for a home-screen web app |
| Domain name (optional) | about $1 | A `*.pages.dev` or `*.vercel.app` address works without one |
| Total | $0 to $1 | $25 if you choose Supabase Pro |

Decisions still open:

- [ ] Decided Nov 7: web app now. Expo only if the recap video or lock-screen widgets matter later.
- [ ] Decided Nov 7: magic link, once. Supabase keeps the session on the phone and refreshes it in the background, so after the first sign-in inside the home-screen app you are never asked again unless you clear the app's data. Set the refresh-token lifetime to its maximum in the Supabase Auth settings. No-sign-in with a hard-coded user is not an option: anyone who found the URL could read and change your data.
- [ ] Decided Nov 7: accept the Supabase idle pause and stay on the free plan.
- [ ] Model to sort transcripts: google/gemini-3.5-flash-lite ($0.30 / $2.50 per 1M tokens, structured outputs supported). About $0.0004 per use.
- [ ] Decided Nov 7: the day ends at 12 am, local time, for photos, logs and reminders. No grace window.
