/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { seed } from './seed.ts'
import { localMinutes, reminderDay, reminderText, toLog, type ReminderProfile } from './reminder.ts'

const ny: ReminderProfile = { timezone: 'America/New_York', reminder_on: true, reminder_time: '20:00:00', last_reminded_on: null }
// 10 Nov 2026 (a Tuesday) in New York is UTC-5.
const at = (local: string) => new Date(`2026-11-10T${local}:00-05:00`)

describe('reminder: when it goes out', () => {
  it('on the first run at or after the reminder time, in the user’s own timezone', () => {
    expect(reminderDay(ny, at('19:45'))).toBeNull()
    expect(reminderDay(ny, at('20:00'))).toBe('2026-11-10')
    expect(reminderDay(ny, at('20:01'))).toBe('2026-11-10') // a run a minute late still catches it
    expect(reminderDay(ny, at('20:15'))).toBeNull() // the next run doesn't
  })

  it('a reminder set 5 minutes from now goes out on the next quarter-hour run', () => {
    const p = { ...ny, reminder_time: '20:30' }
    expect(reminderDay(p, at('20:15'))).toBeNull()
    expect(reminderDay(p, at('20:30'))).toBe('2026-11-10')
  })

  it('never twice in one day, and never when off', () => {
    expect(reminderDay({ ...ny, last_reminded_on: '2026-11-10' }, at('20:00'))).toBeNull()
    expect(reminderDay({ ...ny, last_reminded_on: '2026-11-09' }, at('20:00'))).toBe('2026-11-10')
    expect(reminderDay({ ...ny, reminder_on: false }, at('20:00'))).toBeNull()
  })

  it('uses the user’s day, not the server’s: 8 pm in New York is already tomorrow in UTC', () => {
    expect(at('20:00').toISOString().slice(0, 10)).toBe('2026-11-11')
    expect(reminderDay(ny, at('20:00'))).toBe('2026-11-10')
  })

  it('a midnight reminder goes out at 11:45 pm, still on its own day', () => {
    const p = { ...ny, reminder_time: '24:00:00' }
    expect(reminderDay(p, at('23:45'))).toBe('2026-11-10')
    expect(reminderDay(p, new Date('2026-11-11T00:00:00-05:00'))).toBeNull()
  })

  it('reads local minutes across daylight saving', () => {
    // 1 Nov 2026: New York falls back from UTC-4 to UTC-5.
    expect(localMinutes(new Date('2026-11-01T12:00:00Z'), 'America/New_York')).toBe(7 * 60)
    expect(localMinutes(new Date('2026-10-31T12:00:00Z'), 'America/New_York')).toBe(8 * 60)
  })
})

describe('reminder: what it says', () => {
  it('lists what’s due today and not logged, with the Today list’s own rule', () => {
    // Seed on Tue 10 Nov: meals, retainer, wake and stretch are due; gym isn't (Mon/Wed/Thu);
    // grandma is already logged today.
    const titles = toLog(seed('2026-11-10'), '2026-11-10')
    expect(titles).not.toContain('Gym session')
    expect(titles).toContain('Wear retainer')
    expect(reminderText(['Gym session', 'Eat 3 meals a day'])).toBe('2 to log: Gym session, Eat 3 meals a day')
  })

  it('says nothing when everything is logged', () => {
    const exps = seed('2026-11-10').map((e) => ({ ...e, logs: { ...e.logs, '2026-11-10': { done: true } } }))
    expect(toLog(exps, '2026-11-10')).toEqual([])
  })
})

describe('reminder: the server uses the same rules', () => {
  it('supabase/functions/_shared matches src/lib (run `npm run shared` after changing them)', () => {
    for (const f of ['consistency.ts', 'reminder.ts', 'decision.ts', 'voice.ts']) {
      const app = readFileSync(join(process.cwd(), 'src/lib', f), 'utf8')
      const server = readFileSync(join(process.cwd(), 'supabase/functions/_shared', f), 'utf8')
      expect(server, f).toBe(app)
    }
  })
})
