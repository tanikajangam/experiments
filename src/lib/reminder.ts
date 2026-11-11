// When the daily reminder goes out, and what it says. Pure, like consistency.ts, and shared with the
// `remind` Edge Function: `npm run shared` copies this file and consistency.ts into
// supabase/functions/_shared/, and a test fails if the copies drift.
import { analyze, localDateKey, type DateKey, type Experiment } from './consistency.ts'

/** The cron job runs every 15 minutes, on the quarter hour; the dial snaps to quarter hours. */
export const SLOT_MINUTES = 15

export interface ReminderProfile {
  timezone: string
  reminder_on: boolean
  /** 'HH:MM' or 'HH:MM:SS'; the dial's last stop is '24:00' (midnight). */
  reminder_time: string
  last_reminded_on: DateKey | null
}

/** Minutes since local midnight, in a timezone. */
export function localMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return get('hour') * 60 + get('minute')
}

/**
 * The user's local day if their reminder is due on this run, else null. Due means: on, not already
 * sent today, and the reminder time passed less than one slot ago. A run a minute or two late still
 * catches it, and the next run doesn't send again. Midnight would fall on the next day, so a midnight
 * reminder goes out at the day's last run, 11:45 pm.
 */
export function reminderDay(p: ReminderProfile, now: Date): DateKey | null {
  if (!p.reminder_on) return null
  const today = localDateKey(now, p.timezone)
  if (p.last_reminded_on === today) return null
  const [h, m] = p.reminder_time.split(':').map(Number)
  const at = Math.min(h * 60 + m, 24 * 60 - SLOT_MINUTES)
  const since = localMinutes(now, p.timezone) - at
  return since >= 0 && since < SLOT_MINUTES ? today : null
}

/** Titles of experiments due today and not yet logged (the same rule as the Today list). */
export function toLog(experiments: Experiment[], today: DateKey): string[] {
  return experiments.filter((ex) => analyze(ex, today).dueNow).map((ex) => ex.title)
}

/** "2 to log: Gym session, Eat 3 meals a day" */
export function reminderText(titles: string[]): string {
  return `${titles.length} to log: ${titles.join(', ')}`
}
