# Experiments App: Deployment Plan

Nov 10, 2026 · @Tanika Jangam

## Overview

You'll turn the Version 2 prototype into a web app on your iPhone's home screen in 8 Claude Code sessions, for $0 a month plus a few cents of OpenRouter credit. Steps 1 to 4 give you a working daily app; 5 to 8 add reminders, voice, photos and polish, and can wait.

The one change from earlier plans: deploy in step 1, not at the end. iPhone only allows notifications, the microphone and installing to the home screen on a real HTTPS site, so every step after the first is tested on the live URL from your phone.

What you'll have after step 4: open the app from its home-screen icon, see Today, tap the check, and your logs survive a phone restart or a reinstall.

## Before you start

About 30 minutes, once. Nothing here needs a credit card except the OpenRouter top-up.

| What | Why | What to copy for later |
| --- | --- | --- |
| GitHub account + a new private repo called `experiments` | Cloudflare deploys from it on every push | The repo URL |
| Cloudflare account (free) | Hosts the app at `experiments-xxx.pages.dev` | Nothing yet; you connect it in step 1 |
| Supabase account, one project (free) | Database, sign-in, photo storage, the reminder job | Project URL and anon key (Settings, API). Keep the service role key private |
| OpenRouter account, $5 credit, one API key | Voice transcription and form-filling | The key, starting `sk-or-` |
| Node.js 20 or newer on your laptop | Runs the dev server and build | Check with `node -v` |
| Git, and the GitHub CLI (`gh`) | Push code | `gh auth login` once |
| Claude Code | Does the building | Run `claude` inside the repo folder |
| Supabase CLI | Applies the schema and deploys the two server functions | `npx supabase login` once |

On the iPhone: iOS 17 or newer, and Safari (home-screen apps can only be added from Safari).

## Set up the repo

Clone the empty repo, then add these before your first Claude Code prompt. Claude Code reads `CLAUDE.md` at the start of every session, so it is how the rules survive from one session to the next.

```markdown
experiments/
  CLAUDE.md                     ← the rules (file sent in chat)
  design/
    prototype.dc.html           ← the Version 2 prototype (file sent in chat)
    system-design.md            ← export of the System Design doc
    picture-tracking.md         ← export of the Picture Tracking Spec
    deployment-plan.md          ← export of this doc
```

`prototype.dc.html` is the whole Version 2 canvas in one file: every screen's markup and styles, plus the logic class at the bottom (`occasions`, `status`, `analyze`, `writeLog`, the dial maths, the seed data). It is the source of truth for how the app looks and behaves. The three docs export from their Share menu as Markdown.

The `CLAUDE.md` I've sent you holds the colours, fonts and sizes, the day-status rule, the sliding-window rule, the midnight cutoff, the tier thresholds, and the instruction that `src/lib/consistency.ts` must never import React or Supabase. Read it once and change anything that's wrong before you start; every later session follows it.

Commit these files on their own first (`git add . && git commit -m "Design and rules" && git push`), so every later change Claude Code makes is a clean diff against them.

## Build steps 1 to 4: a working daily app

One Claude Code session per step. Paste the prompt, let it work, check the "done when" on your phone, commit, push. Start each session fresh (`/clear`) so it re-reads `CLAUDE.md`.

### Step 1. Scaffold and deploy (about 1 hour)

```markdown
Read CLAUDE.md and design/prototype.dc.html. Scaffold the app: Vite + React + TypeScript, vite-plugin-pwa
(manifest named "Experiments", theme colour #2F7A4B, background #DAD4C8, standalone display, a simple green
icon at 192 and 512 px), Vitest, and the Poppins + Fraunces fonts from the prototype. Render one beige page
with the "Tanki's Experiments" heading styled exactly as in the prototype. No other screens yet.
Add an .env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Make `npm run build` output to dist/.
```

Then connect hosting yourself: Cloudflare dashboard, Workers and Pages, Create, Pages, Connect to Git, pick the repo. Build command `npm run build`, output directory `dist`. Every push to `main` now redeploys in about a minute.

Done when: the `pages.dev` URL opens on your iPhone in Safari and shows the heading in Poppins on beige.

### Step 2. Port the math, with tests (about 1 hour)

```markdown
Port the logic class from design/prototype.dc.html into src/lib/consistency.ts as plain typed functions:
occasions, status, analyze, scheduleLabel, nextDue, and the tier rule. No React, no Supabase, no Date.now()
inside: every function takes `today` as an argument. Then write Vitest tests using the prototype's seed data
with a fixed today of 2026-11-10: Wear retainer is Inconsistent at 43%, Gym (Mon/Wed/Thu) is Semimature at
71%, Eat 3 meals is New and shows 1/7, Stretch before bed is on day 65. Add tests for: today pending never
counts as a miss, a past day with no log is a miss, the window is the last 7 scheduled days not calendar days,
and the day boundary is local midnight.
```

Done when: `npm test` passes, and you've read the test names and they describe the rules as you'd say them.

### Step 3. All the screens, on fake data (2 to 3 hours, maybe two sessions)

```markdown
Build the screens from design/prototype.dc.html as React components, matching it exactly (spacing, sizes,
colours, animations, reduced-motion): Welcome, First experiment, Reminder setup, Home (Today list with
one-tap check and x, tiers, Decided), Create, Log, Analysis, Celebrate, Decide, and the bell dial.
Keep all state in a single store module (src/store.ts) seeded with the prototype's seed data, so the
screens never touch storage directly. Use the functions from src/lib/consistency.ts for every number.
```

Done when: on your phone, every screen matches its canvas frame side by side, and the one-tap check updates the row to "43% → 29%"-style text.

### Step 4. Real data in Supabase (about 2 hours)

First do the Supabase setup section below (the SQL, sign-in settings, the two env vars in Cloudflare). Then:

```markdown
Replace the seeded store with Supabase. Use supabase-js with the env vars. Sign-in: email one-time code
(signInWithOtp, then verifyOtp with the 6-digit code), not a magic link. Keep the session in the default
localStorage so the installed app stays signed in. On first sign-in, upsert a profiles row with the browser's
timezone. Map the store to the experiments, logs and decisions tables in design/deployment-plan.md. Keep
the last-loaded data in IndexedDB so the app opens instantly and works offline, and queue writes made
offline until the next open. Show the Welcome flow when the user has no experiments.
```

Done when: you sign in once inside the home-screen app, log something, force-quit the app, reopen it, and the log is still there. Then delete the app from your home screen, re-add it, sign in, and the log is still there.

After step 4 you can stop and just use it. The rest is additive.

## Build steps 5 to 8: the extras

### Step 5. The daily reminder (about 2 hours)

Generate push keys once on your laptop: `npx web-push generate-vapid-keys`. Put the public key in Cloudflare as `VITE_VAPID_PUBLIC_KEY`, and both keys in Supabase as secrets (below).

```markdown
Add the daily reminder. In the app: after the user has the app on the home screen, ask for notification
permission when they first close the bell dial or finish Reminder setup (never on launch), subscribe with
PushManager using VITE_VAPID_PUBLIC_KEY, and save the subscription, reminder_on and reminder_time to profiles.
On the server: a Supabase Edge Function `remind` that, when called with the CRON_SECRET header, finds
profiles whose reminder_time in their own timezone falls in the current 15-minute slot and that have not been
reminded today, checks with the same schedule rule as consistency.ts whether anything is due and unlogged,
and if so sends one web push ("2 to log: Gym, Eat 3 meals") using the npm web-push package and the VAPID
secrets, then sets last_reminded_on. Tapping the notification opens Home. Remove subscriptions that return 410.
```

Done when: set the dial to 5 minutes from now, close the app, and the notification arrives within about 15 minutes; log everything and confirm the next day's reminder is skipped.

### Step 6. Voice (about 1.5 hours)

```markdown
Add voice to Create, Log and Decide. Record with MediaRecorder (audio/mp4 on iOS, webm elsewhere), max 60 s,
with a visible recording state and a stop button. Send the audio to a Supabase Edge Function `transcribe`
that holds OPENROUTER_API_KEY as a secret: it calls POST https://openrouter.ai/api/v1/audio/transcriptions with
model openai/whisper-large-v3-turbo, then calls chat completions with google/gemini-3.5-flash-lite and a JSON
schema response_format to fill the form's fields (the prompt is in design/system-design.md). Return the JSON;
the app fills the chips and text and lets the user fix anything before saving. Never put the key in the client.
```

Done when: on the Decide screen you say "it stopped being hard around week three, I'll keep it, it cost some sleep" and the chips land on Around the middle, Yes and Energy.

### Step 7. Photos (2 to 3 hours, when you want it)

Follow design/picture-tracking.md. Add the `photos` table and the `photos` bucket from the Supabase section first, then ask Claude Code to build that spec: photo target per day, camera and multi-upload, EXIF dates, the day collage, the 12 am cutoff and the no-backfill rule.

### Step 8. Make it safe to rely on (about 1 hour)

```markdown
Harden for daily use: an Export button (on Analysis) that downloads all experiments, logs and decisions as
JSON; a visible offline indicator; an error toast when a write fails with a retry; and an update prompt when
a new version of the app is deployed (vite-plugin-pwa's prompt mode). Add a weekly GitHub Action that calls the
Supabase REST API once so the free project never pauses.
```

Done when: you turn on airplane mode, log two habits, turn it off, and both appear in the Supabase table editor.

## Supabase setup

Do this just before step 4. Paste the SQL into the Supabase SQL Editor and run it, or ask Claude Code to save it as `supabase/migrations/0001_init.sql` and apply it with `npx supabase db push`.

```sql
-- Profiles: one row per person
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/New_York',
  reminder_on boolean not null default true,
  reminder_time time not null default '20:00',
  push_subscription jsonb,
  last_reminded_on date
);

-- Experiments: schedule is days of the week, 0 = Sunday
create table experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  where_note text,
  why_note text,
  schedule_days smallint[] not null check (cardinality(schedule_days) > 0),
  tracking text not null default 'check' check (tracking in ('check', 'picture')),
  photo_target smallint,
  start_date date not null,
  length_days smallint not null default 65,
  created_at timestamptz not null default now()
);

-- Logs: one per scheduled day; clearing a log deletes the row
create table logs (
  experiment_id uuid not null references experiments on delete cascade,
  day date not null,
  done boolean not null,
  note text,
  logged_at timestamptz not null default now(),
  primary key (experiment_id, day)
);

-- Decisions: written once at day 65
create table decisions (
  experiment_id uuid primary key references experiments on delete cascade,
  outcome text not null check (outcome in ('keep', 'drop')),
  effort text,
  survive text,
  cost text[],
  cost_note text,
  change text,
  decided_on date not null default current_date
);

-- Each person sees only their own rows
alter table profiles enable row level security;
alter table experiments enable row level security;
alter table logs enable row level security;
alter table decisions enable row level security;

create policy own_profile on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy own_experiments on experiments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_logs on logs for all
  using (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()));
create policy own_decisions on decisions for all
  using (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()));
```

Sign-in settings (Authentication in the dashboard):

- Providers, Email: on. Turn on "Confirm email".
- Email templates, both Magic Link and Confirm signup: replace the link with the code, so each email reads "Your code is {{ .Token }}" (the first sign-in uses Confirm signup, later ones use Magic Link). The app asks for the 6 digits, which keeps sign-in inside the home-screen app.
- URL configuration: Site URL is your `pages.dev` address.
- Sessions: leave time-boxing and inactivity timeouts off, so you stay signed in.

Environment variables:

| Where | Name | Value |
| --- | --- | --- |
| Cloudflare Pages, Settings, Variables | `VITE_SUPABASE_URL` | Project URL |
| Cloudflare Pages | `VITE_SUPABASE_ANON_KEY` | anon public key |
| Cloudflare Pages (step 5) | `VITE_VAPID_PUBLIC_KEY` | from `web-push generate-vapid-keys` |
| Supabase secrets (step 5) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` | the key pair; any long random string |
| Supabase secrets (step 6) | `OPENROUTER_API_KEY` | `sk-or-…` |

Set Supabase secrets with `npx supabase secrets set NAME=value`. Redeploy Cloudflare after changing its variables.

The reminder job (step 5). In Database, Extensions, turn on `pg_cron` and `pg_net`, then run:

```sql
select cron.schedule('remind-every-15-min', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET')
  );
$$);
```

Photos (step 7). Storage, New bucket, `photos`, private. Then add the `photos` table from the System Design doc, with the same join-based policy as `logs`, and a storage policy allowing each user to read and write only under their own `user_id/` folder.

## Putting it on your phone

Do this the first time at the end of step 1, and again whenever you want a fresh install.

1. Open the `pages.dev` URL in Safari on the iPhone. Not Chrome: only Safari can add a home-screen app.
2. Tap Share, then Add to Home Screen, then Add. An "Experiments" icon appears.
3. Open the app from that icon from now on, never from the Safari tab. The installed app and Safari keep separate storage, so signing in or logging in Safari does nothing for the app.
4. From step 4 on: enter your email, then type the 6-digit code from the email. You stay signed in from then on.
5. From step 5 on: when the app asks, allow notifications. If you said no by accident, go to Settings, Notifications, Experiments.

When you push a new version, it arrives the next time you open the app (after step 8, the app shows an "Update available" prompt instead).

A quick test after each step:

- [ ] Opens from the home-screen icon with no Safari address bar
- [ ] Today shows what's due; the check logs it and the row shows the change
- [ ] Force-quit and reopen: the log is still there
- [ ] Airplane mode: the app still opens and shows yesterday's data
- [ ] The reminder arrives at the dial time, and not at all when everything's logged
- [ ] Day 65 opens the celebration

## Gotchas, and what changed since the System Design doc

Things that will bite if you don't know them:

- **Test on the live URL, not your laptop's IP.** Notifications, the microphone and Add to Home Screen need HTTPS. `npm run dev -- --host` is fine for layout, but anything in steps 5 and 6 only works on `pages.dev`.
- **Keys.** The Supabase anon key is meant to be public and is safe in the app because Row Level Security guards the data. The service role key, the OpenRouter key and the VAPID private key must only ever live in Supabase secrets.
- **Free-plan pause.** Supabase pauses a free project after a week with no use. Step 8's weekly ping prevents it; until then, a week away means one slow first open.
- **Haptics on iPhone.** The prototype's vibration calls do nothing in iPhone Safari. Leave them in (they work on Android) and treat iPhone haptics as a later, native-only extra.
- **Dates.** Store `day` as a plain date in your own timezone, never a UTC timestamp, or logs near midnight land on the wrong day.

Where this plan overrides the System Design doc (written before Version 2):

| Topic | System Design doc said | Now |
| --- | --- | --- |
| Sign-in | Magic link | 6-digit email code, because a magic link opens Safari instead of the installed app |
| Schedules | Days of the week, plus other types in the canvas sticky | Days of the week only (`schedule_days`) |
| Home | Tier list | Today list with one-tap logging, then tiers |
| First run | Not covered | Welcome, first experiment, reminder time |
| Reminder | 6 am to midnight dial, or a menu setting | 4 am to midnight tick dial behind the bell, plus a 4-choice picker at setup |
| Deploy | Last step | First step, so every step is tested on the phone |
| Photos table | In the core schema | Added in step 7 |

When something goes wrong mid-build, paste the error and the relevant screen's canvas frame name into Claude Code and ask it to compare against `design/prototype.dc.html`. The prototype is the tie-breaker.
