import { describe, expect, it } from 'vitest'
import source from './consistency.ts?raw'
import {
  addDays,
  analyze,
  daysBetween,
  localDateKey,
  logFlash,
  logPreview,
  nextDue,
  occasions,
  scheduleLabel,
  status,
  tierFor,
  weekday,
  weekStart,
  weeklyStarts,
  type DateKey,
  type Experiment,
} from './consistency.ts'
import { seed } from './seed.ts'

const TODAY = '2026-11-10' // a Tuesday

function seeded(id: string): Experiment {
  const ex = seed(TODAY).find((e) => e.id === id)
  if (!ex) throw new Error(`no seed experiment ${id}`)
  return ex
}

/** An experiment with the given schedule and logs (day → done). */
function make(scheduleDays: number[], startDate: DateKey, logs: Record<DateKey, boolean> = {}): Experiment {
  return {
    id: 'x',
    title: 'Test',
    scheduleDays,
    startDate,
    logs: Object.fromEntries(Object.entries(logs).map(([d, done]) => [d, { done }])),
  }
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

describe('the prototype seed data, on Tue 10 Nov 2026', () => {
  it('Wear retainer is an Inconsistent habit at 43%', () => {
    const a = analyze(seeded('retainer'), TODAY)
    expect(a.tier).toBe('inconsistent')
    expect(a.pct).toBe(43)
    expect(a.pctLabel).toBe('43%')
    expect(a.misses).toBe(4)
  })

  it('Gym (Mon, Wed, Thu) is a Semimature habit at 71%', () => {
    const ex = seeded('gym')
    expect(scheduleLabel(ex.scheduleDays)).toBe('Mon · Wed · Thu')
    const a = analyze(ex, TODAY)
    expect(a.tier).toBe('semi')
    expect(a.pct).toBe(71)
    expect(a.pctLabel).toBe('71%')
  })

  it('Eat 3 meals is a New habit and shows 1/7, not a percentage', () => {
    const a = analyze(seeded('meals'), TODAY)
    expect(a.tier).toBe('new')
    expect(a.pctLabel).toBe('1/7')
    expect(a.standingText).toBe('1/7 tracked')
    expect(a.pctLabel).not.toContain('%')
  })

  it('Stretch before bed is on day 65, its final day', () => {
    const a = analyze(seeded('stretch'), TODAY)
    expect(a.dayNum).toBe(65)
    expect(a.dayLine).toBe('Day 65/65')
    expect(a.finalDay).toBe(true)
    expect(a.complete).toBe(false)
    expect(a.dueNow).toBe(true)
  })
})

describe('day status', () => {
  it('today with no log is pending and never counts as a miss', () => {
    // Every day for the past 7 days done, today not logged yet.
    const start = addDays(TODAY, -7)
    const logs: Record<DateKey, boolean> = {}
    for (let i = 0; i < 7; i++) logs[addDays(start, i)] = true
    const ex = make(EVERY_DAY, start, logs)

    expect(status(ex, TODAY, TODAY)).toBe('pending')
    const a = analyze(ex, TODAY)
    expect(a.misses).toBe(0)
    expect(a.pct).toBe(100)
    expect(a.tier).toBe('mature')
    expect(a.window.map((o) => o.day)).not.toContain(TODAY)
  })

  it('a past scheduled day with no log is a miss', () => {
    const ex = make(EVERY_DAY, addDays(TODAY, -2), { [addDays(TODAY, -1)]: true })
    expect(status(ex, addDays(TODAY, -2), TODAY)).toBe('missed')
    expect(analyze(ex, TODAY).resolved.map((o) => o.status)).toEqual(['missed', 'done'])
  })

  it('a day logged yes is done and a day logged no is missed, today included', () => {
    const ex = make(EVERY_DAY, addDays(TODAY, -1), { [addDays(TODAY, -1)]: true, [TODAY]: false })
    expect(status(ex, addDays(TODAY, -1), TODAY)).toBe('done')
    expect(status(ex, TODAY, TODAY)).toBe('missed')
  })

  it('only scheduled days count; unscheduled days are never misses', () => {
    // Mondays only, started 3 weeks ago on a Monday: three past Mondays, nothing else.
    const ex = make([1], '2026-10-19')
    expect(occasions(ex, TODAY)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
  })
})

describe('the sliding window', () => {
  it('is the last 7 scheduled days, not the last 7 calendar days', () => {
    const a = analyze(seeded('gym'), TODAY)
    expect(a.window).toHaveLength(7)
    // 7 Mon/Wed/Thu days reach back more than two calendar weeks.
    expect(daysBetween(a.window[0].day, TODAY)).toBeGreaterThan(14)
    for (const o of a.window) expect([1, 3, 4]).toContain(weekday(o.day))
  })

  it('drops older days as new ones are resolved', () => {
    // 7 misses, then 7 done: the window only sees the 7 done days.
    const start = addDays(TODAY, -14)
    const logs: Record<DateKey, boolean> = {}
    for (let i = 0; i < 14; i++) logs[addDays(start, i)] = i >= 7
    const a = analyze(make(EVERY_DAY, start, logs), TODAY)
    expect(a.pct).toBe(100)
    expect(a.tier).toBe('mature')
  })
})

describe('tiers', () => {
  it('a habit with fewer than 7 resolved scheduled days is New, whatever its misses', () => {
    expect(tierFor(6, 0)).toBe('new')
    expect(tierFor(6, 6)).toBe('new')
  })

  it('0 or 1 misses in the window is Mature', () => {
    expect(tierFor(7, 0)).toBe('mature')
    expect(tierFor(7, 1)).toBe('mature')
  })

  it('2 or 3 misses in the window is Semimature', () => {
    expect(tierFor(7, 2)).toBe('semi')
    expect(tierFor(30, 3)).toBe('semi')
  })

  it('more than 3 misses in the window is Inconsistent', () => {
    expect(tierFor(7, 4)).toBe('inconsistent')
    expect(tierFor(7, 7)).toBe('inconsistent')
  })

  it('a New habit shows "n/7 tracked"; any other shows the window percentage', () => {
    const start = addDays(TODAY, -7)
    const six: Record<DateKey, boolean> = {}
    for (let i = 1; i < 7; i++) six[addDays(start, i)] = true
    const newHabit = analyze(make(EVERY_DAY, addDays(start, 1), six), TODAY)
    expect(newHabit.standingText).toBe('6/7 tracked')

    const seven = { ...six, [start]: false }
    const settled = analyze(make(EVERY_DAY, start, seven), TODAY)
    expect(settled.standingText).toBe('86%')
  })
})

describe('the day boundary is local midnight', () => {
  it('a moment belongs to the calendar day in the user’s own timezone', () => {
    expect(localDateKey(new Date('2026-11-11T04:59:59Z'), 'America/New_York')).toBe('2026-11-10')
    expect(localDateKey(new Date('2026-11-11T05:00:00Z'), 'America/New_York')).toBe('2026-11-11')
    expect(localDateKey(new Date('2026-11-11T07:59:59Z'), 'America/Los_Angeles')).toBe('2026-11-10')
    expect(localDateKey(new Date('2026-11-10T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-11-10')
    expect(localDateKey(new Date('2026-11-10T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-11-11')
  })

  it('an unlogged day is pending until 11:59 pm and missed from 12 am', () => {
    const ex = make(EVERY_DAY, TODAY)
    const tz = 'America/New_York'
    const beforeMidnight = localDateKey(new Date('2026-11-11T04:59:59Z'), tz)
    const afterMidnight = localDateKey(new Date('2026-11-11T05:00:00Z'), tz)
    expect(status(ex, TODAY, beforeMidnight)).toBe('pending')
    expect(status(ex, TODAY, afterMidnight)).toBe('missed')
  })

  it('counts days correctly across a daylight-saving change', () => {
    // US clocks went back on 1 Nov 2026; the seed's Stretch started 64 days earlier.
    expect(daysBetween('2026-09-07', TODAY)).toBe(64)
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
  })
})

describe('the 65-day trial', () => {
  it('day 1 is the start date', () => {
    expect(analyze(make(EVERY_DAY, TODAY), TODAY).dayNum).toBe(1)
  })

  it('logging yes on day 65 completes the trial and makes it ready to decide', () => {
    const ex = seeded('stretch')
    ex.logs[TODAY] = { done: true }
    const a = analyze(ex, TODAY)
    expect(a.complete).toBe(true)
    expect(a.readyToDecide).toBe(true)
    expect(a.phase).toBe('Decision')
  })

  it('after day 65 nothing more is due and the trial is over', () => {
    const ex = seeded('stretch')
    const tomorrow = addDays(TODAY, 1)
    expect(occasions(ex, tomorrow)).toEqual(occasions(ex, TODAY))
    const a = analyze(ex, tomorrow)
    expect(a.complete).toBe(true)
    expect(a.dueNow).toBe(false)
    expect(a.dayNum).toBe(65)
    expect(a.journeyRight).toBe('Trial over')
  })

  it('once decided, it is no longer waiting for a decision', () => {
    const ex = seeded('stretch')
    ex.logs[TODAY] = { done: true }
    ex.decision = { outcome: 'keep', date: TODAY }
    const a = analyze(ex, TODAY)
    expect(a.readyToDecide).toBe(false)
    expect(a.decisionLine).toBe('Kept on Tue, Nov 10')
    expect(a.canEdit).toBe(false)
  })

  it('phases run 1–21 Initiation, 22–43 Momentum, 44–65 Integration', () => {
    const at = (day: number) => analyze(make(EVERY_DAY, addDays(TODAY, -(day - 1))), TODAY).phase
    expect(at(21)).toBe('Initiation phase')
    expect(at(22)).toBe('Momentum phase')
    expect(at(43)).toBe('Momentum phase')
    expect(at(44)).toBe('Integration phase')
  })
})

describe('schedule labels and the next due day', () => {
  it('names common schedules and lists the rest Monday first', () => {
    expect(scheduleLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(scheduleLabel([5, 1, 2, 3, 4])).toBe('Weekdays')
    expect(scheduleLabel([6, 0])).toBe('Weekends')
    expect(scheduleLabel([0, 2, 6])).toBe('Tue · Sat · Sun')
    expect(scheduleLabel([])).toBe('No days picked')
  })

  it('the next due day is the next scheduled day after today', () => {
    expect(nextDue(seeded('gym'), TODAY)).toBe('2026-11-11') // Wed
    expect(nextDue(seeded('grandma'), TODAY)).toBe('2026-11-14') // Tue → Sat
  })

  it('there is no next due day after day 65', () => {
    expect(nextDue(seeded('stretch'), TODAY)).toBeNull()
  })
})

describe('logging today', () => {
  it('the Home row shows the change, e.g. "43% → 29%", after a one-tap log', () => {
    const ex = seeded('retainer')
    const before = analyze(ex, TODAY)
    const after = analyze({ ...ex, logs: { ...ex.logs, [TODAY]: { done: false } } }, TODAY)
    expect(logFlash(before, after)).toBe('43% → 29%')
  })

  it('the Log screen previews both answers before one is picked', () => {
    const a = analyze(seeded('retainer'), TODAY)
    expect(logPreview(a, null).line).toBe('Yes → 43% · Not today → 29%')
    expect(logPreview(a, true).line).toBe('43% → 43%')
  })

  it('a New habit previews progress towards 7, not a percentage', () => {
    const a = analyze(seeded('meals'), TODAY)
    expect(logPreview(a, null).line).toBe('1/7 tracked so far')
    expect(logPreview(a, true).line).toBe('2/7 tracked')
  })
})

describe('the weekly start limit', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-09')).toBe('2026-11-09') // Mon
    expect(weekStart(TODAY)).toBe('2026-11-09')
    expect(weekStart('2026-11-15')).toBe('2026-11-09') // Sun
  })

  it('allows at most 3 new experiments started per calendar week', () => {
    const started = (days: DateKey[]) => days.map((startDate) => ({ startDate }))
    expect(weeklyStarts(started(['2026-11-08', '2026-11-09', '2026-11-10']), TODAY)).toMatchObject({
      started: 2,
      limitReached: false,
    })
    const full = weeklyStarts(started(['2026-11-09', '2026-11-09', '2026-11-10']), TODAY)
    expect(full.limitReached).toBe(true)
    expect(full.line).toBe('3/3 started this week. Next one can start Mon, Nov 16.')
  })
})

describe('consistency.ts stays pure', () => {
  it('never reads the clock or imports React or Supabase', () => {
    expect(source).not.toMatch(/Date\.now\s*\(/)
    expect(source).not.toMatch(/new Date\(\s*\)/)
    // It imports nothing at all, so no React and no Supabase.
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bimport\s*\(/)
  })
})
