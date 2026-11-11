// The daily reminder. pg_cron calls this every 15 minutes with the x-cron-secret header. For each
// profile whose reminder time has just passed in their own timezone, and that hasn't been reminded
// today, it checks with the app's own rules (consistency.ts, via reminder.ts) whether anything is due
// and unlogged, and if so sends one web push. Returns counts only, never personal data.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import webpush from 'npm:web-push@3.6.7'
import type { Experiment } from '../_shared/consistency.ts'
import { reminderDay, reminderText, toLog } from '../_shared/reminder.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

/** The project's secret key: the new-style one if present, else the legacy service role key. */
function secretKey(): string {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>
    if (keys.default) return keys.default
  } catch {
    // Fall through to the legacy key.
  }
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface ProfileRow {
  id: string
  timezone: string
  reminder_on: boolean
  reminder_time: string
  push_subscription: webpush.PushSubscription | null
  last_reminded_on: string | null
}

interface ExperimentRow {
  id: string
  title: string
  schedule_days: number[]
  start_date: string
  logs: { day: string; done: boolean }[] | null
}

Deno.serve(async (req) => {
  const secret = env('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)

  // The subject identifies the sender to Apple and Google: the app's own https address.
  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'https://experiments-dob.pages.dev', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  const db = createClient(env('SUPABASE_URL'), secretKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const now = new Date()

  const { data, error } = await db
    .from('profiles')
    .select('id, timezone, reminder_on, reminder_time, push_subscription, last_reminded_on')
    .eq('reminder_on', true)
    .not('push_subscription', 'is', null)
  if (error) return json({ error: error.message }, 500)
  const profiles = data as ProfileRow[]

  const summary = { checked: profiles.length, due: 0, nothingToLog: 0, sent: 0, failed: 0, removed: 0 }
  for (const p of profiles) {
    const today = reminderDay(p, now)
    if (!today || !p.push_subscription) continue
    summary.due++

    const { data: rows, error: exError } = await db
      .from('experiments')
      .select('id, title, schedule_days, start_date, logs(day, done)')
      .eq('user_id', p.id)
    if (exError) {
      summary.failed++
      continue
    }
    const experiments: Experiment[] = (rows as ExperimentRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      scheduleDays: r.schedule_days,
      startDate: r.start_date,
      logs: Object.fromEntries((r.logs ?? []).map((l) => [l.day, { done: l.done }])),
    }))
    const titles = toLog(experiments, today)
    if (titles.length === 0) {
      summary.nothingToLog++
      continue
    }

    // Claim today before sending, so two overlapping runs can't both send.
    const { data: claimed } = await db
      .from('profiles')
      .update({ last_reminded_on: today })
      .eq('id', p.id)
      .or(`last_reminded_on.is.null,last_reminded_on.neq.${today}`)
      .select('id')
    if (!claimed?.length) continue

    try {
      await webpush.sendNotification(p.push_subscription, JSON.stringify({ title: 'Experiments', body: reminderText(titles), url: '/' }), {
        TTL: 4 * 60 * 60,
        urgency: 'normal',
      })
      summary.sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // The phone dropped this subscription (app deleted, permission revoked). Forget it.
        await db.from('profiles').update({ push_subscription: null, last_reminded_on: p.last_reminded_on }).eq('id', p.id)
        summary.removed++
      } else {
        // Give the day back, so the next run can try again.
        await db.from('profiles').update({ last_reminded_on: p.last_reminded_on }).eq('id', p.id)
        console.error('push failed', status, (e as Error).message)
        summary.failed++
      }
    }
  }
  return json(summary)
})
