// All the maths for experiments, ported from the logic class in design/prototype.dc.html.
//
// Rules (see CLAUDE.md):
// - No React, no Supabase, and no clock: every function takes `today` as an argument.
// - Days are plain 'YYYY-MM-DD' strings in the user's own timezone. Date arithmetic runs
//   in UTC on those strings, so results never depend on the device's timezone or on
//   daylight-saving changes.

/** A calendar day, 'YYYY-MM-DD', in the user's local timezone. */
export type DateKey = string

/** 0 = Sunday … 6 = Saturday. */
export type Weekday = number

export type DayStatus = 'done' | 'missed' | 'pending'
export type Tier = 'new' | 'inconsistent' | 'semi' | 'mature'

export interface DayLog {
  done: boolean
  note?: string
}

export interface Decision {
  outcome: 'keep' | 'drop'
  date: DateKey
  summary?: string
}

export interface Experiment {
  id: string
  title: string
  /** Days of the week it is due, 0 = Sunday. */
  scheduleDays: Weekday[]
  /** Day 1 of the trial. */
  startDate: DateKey
  where?: string
  why?: string
  tracking?: 'check' | 'picture'
  logs: Record<DateKey, DayLog>
  decision?: Decision | null
}

/** Every trial lasts 65 days. */
export const TRIAL_DAYS = 65
/** The sliding window: the last 7 resolved scheduled days. */
export const WINDOW = 7
/** At most 3 new experiments may start per calendar week (Monday start). */
export const WEEKLY_START_LIMIT = 3

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toUtcMs(day: DateKey): number {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtcMs(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(day: DateKey, n: number): DateKey {
  return fromUtcMs(toUtcMs(day) + n * DAY_MS)
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS)
}

export function weekday(day: DateKey): Weekday {
  return new Date(toUtcMs(day)).getUTCDay()
}

export function dayOfMonth(day: DateKey): number {
  return Number(day.slice(8, 10))
}

/** The Monday on or before `day`. */
export function weekStart(day: DateKey): DateKey {
  return addDays(day, -((weekday(day) + 6) % 7))
}

/**
 * The local calendar day that `instant` falls on in `timeZone` (an IANA name such as
 * 'America/New_York', from profiles.timezone). This is the 12 am cutoff: the day changes
 * at local midnight.
 */
export function localDateKey(instant: Date, timeZone: string): DateKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 'Tue, Nov 10' */
export function formatDay(day: DateKey): string {
  return `${DAY_NAMES[weekday(day)]}, ${MONTH_NAMES[Number(day.slice(5, 7)) - 1]} ${dayOfMonth(day)}`
}

/** 'Tuesday, Nov 10' */
export function formatDayLong(day: DateKey): string {
  return `${DAY_NAMES_LONG[weekday(day)]}, ${MONTH_NAMES[Number(day.slice(5, 7)) - 1]} ${dayOfMonth(day)}`
}

/** 'Nov 10' */
export function formatDayShort(day: DateKey): string {
  return `${MONTH_NAMES[Number(day.slice(5, 7)) - 1]} ${dayOfMonth(day)}`
}

// ---------------------------------------------------------------------------
// Schedule and status
// ---------------------------------------------------------------------------

/** Day 65 of the trial. */
export function lastDay(ex: Experiment): DateKey {
  return addDays(ex.startDate, TRIAL_DAYS - 1)
}

export function isDue(ex: Experiment, day: DateKey): boolean {
  return ex.scheduleDays.includes(weekday(day))
}

/** Scheduled days from day 1 up to today (or day 65, whichever comes first), oldest first. */
export function occasions(ex: Experiment, today: DateKey): DateKey[] {
  const last = lastDay(ex)
  const stop = last < today ? last : today
  const out: DateKey[] = []
  for (let d = ex.startDate; d <= stop; d = addDays(d, 1)) {
    if (isDue(ex, d)) out.push(d)
  }
  return out
}

/**
 * A scheduled day is done if logged yes, missed if logged no, missed if it is in the past
 * with no log, and pending if it is today with no log.
 */
export function status(ex: Experiment, day: DateKey, today: DateKey): DayStatus {
  const log = ex.logs[day]
  if (log) return log.done ? 'done' : 'missed'
  return day < today ? 'missed' : 'pending'
}

/**
 * New = fewer than 7 resolved scheduled days. Otherwise, by misses in the window:
 * more than 3 is Inconsistent, 2 to 3 is Semimature, 1 or none is Mature.
 */
export function tierFor(resolvedCount: number, missesInWindow: number): Tier {
  if (resolvedCount < WINDOW) return 'new'
  if (missesInWindow > 3) return 'inconsistent'
  if (missesInWindow >= 2) return 'semi'
  return 'mature'
}

export const TIER_NAMES: Record<Tier, string> = {
  new: 'New Habit',
  inconsistent: 'Inconsistent Habit',
  semi: 'Semimature Habit',
  mature: 'Mature Habit',
}

/** The four Home sections, in order, with the rule line shown under each heading. */
export const TIERS: { id: Tier; name: string; rule: string }[] = [
  { id: 'new', name: 'New Habits', rule: `< ${WINDOW} scheduled days tracked` },
  { id: 'inconsistent', name: 'Inconsistent Habits', rule: `> 3 misses / last ${WINDOW}` },
  { id: 'semi', name: 'Semimature Habits', rule: `2–3 misses / last ${WINDOW}` },
  { id: 'mature', name: 'Mature Habits', rule: `≤ 1 miss / last ${WINDOW}` },
]

export function scheduleLabel(days: Weekday[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b).join(',')
  if (set === '0,1,2,3,4,5,6') return 'Every day'
  if (set === '1,2,3,4,5') return 'Weekdays'
  if (set === '0,6') return 'Weekends'
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d))
  return ordered.length ? ordered.map((d) => DAY_NAMES[d]).join(' · ') : 'No days picked'
}

/** The next scheduled day after today within the next week and within the trial, or null. */
export function nextDue(ex: Experiment, today: DateKey): DateKey | null {
  const last = lastDay(ex)
  for (let n = 1; n <= 7; n++) {
    const d = addDays(today, n)
    if (d > last) return null
    if (isDue(ex, d)) return d
  }
  return null
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export interface Occasion {
  day: DateKey
  status: DayStatus
}

/** One slot of the 7-slot strip. 'today' is the outlined pending slot; 'empty' is not yet tracked. */
export interface Segment {
  kind: 'done' | 'missed' | 'today' | 'empty'
  label: string
}

export interface TrendPoint {
  day: DateKey
  /** Sliding-window percentage as of this day. */
  pct: number
  /** True while fewer than 7 days fed the average (drawn in the paler colour). */
  warmingUp: boolean
}

export interface Phase {
  label: 'Initiation' | 'Momentum' | 'Integration'
  firstDay: number
  lastDay: number
  /** How much of this phase has passed, 0 to 100. */
  fill: number
  current: boolean
}

export interface Note {
  day: DateKey
  result: 'done' | 'missed'
  text: string
}

export interface Analysis {
  ex: Experiment
  title: string
  tier: Tier
  tierName: string
  /** Resolved (done or missed) scheduled days so far. */
  tracked: number
  resolved: Occasion[]
  /** The last 7 resolved scheduled days. */
  window: Occasion[]
  misses: number
  /** Window percentage. Only shown once the habit is no longer New. */
  pct: number
  /** 'n/7' for a New habit, otherwise 'pct%'. */
  pctLabel: string
  /** 'n/7 tracked' for a New habit, otherwise 'pct%'. */
  standingText: string
  heroLine: string
  segments: Segment[]
  /** Up to 6 resolved days before today, for the Log screen strip. */
  logBase: { done: boolean; label: string }[]
  dayNum: number
  dayLine: string
  phase: 'Initiation phase' | 'Momentum phase' | 'Integration phase' | 'Decision'
  phases: Phase[]
  journeyRight: string
  /** Longest run of done days. */
  best: number
  doneTotal: number
  dueTotal: number
  /** Done over all resolved days, e.g. '84%', or '—' before anything is tracked. */
  overallPct: string
  trend: TrendPoint[]
  dueToday: boolean
  loggedToday: boolean
  todayResult: 'Yes' | 'No' | ''
  /** Due today, not logged yet, trial still running. */
  dueNow: boolean
  notDue: boolean
  /** Today is day 65 and it has not been logged. */
  finalDay: boolean
  canEdit: boolean
  nextDue: DateKey | null
  /** Day 65 has passed or has been logged. Tracking stops. */
  complete: boolean
  readyToDecide: boolean
  decided: boolean
  decisionLine: string
  decisionText: string
  /** The 3 most recent notes, newest first. */
  notes: Note[]
}

export function analyze(ex: Experiment, today: DateKey): Analysis {
  const all: Occasion[] = occasions(ex, today).map((day) => ({ day, status: status(ex, day, today) }))
  const resolved = all.filter((o) => o.status !== 'pending')
  const pending = all.find((o) => o.status === 'pending') ?? null

  const window = resolved.slice(-WINDOW)
  const doneInWindow = window.filter((o) => o.status === 'done').length
  const misses = window.length - doneInWindow
  const pct = window.length ? Math.round((100 * doneInWindow) / window.length) : 0
  const tier = tierFor(resolved.length, misses)
  const isNew = tier === 'new'

  const segments: Segment[] = window.map((o) => ({
    kind: o.status === 'done' ? 'done' : 'missed',
    label: String(dayOfMonth(o.day)),
  }))
  if (pending && segments.length < WINDOW) segments.push({ kind: 'today', label: 'today' })
  while (segments.length < WINDOW) segments.push({ kind: 'empty', label: '' })

  let best = 0
  let run = 0
  for (const o of resolved) {
    run = o.status === 'done' ? run + 1 : 0
    if (run > best) best = run
  }
  const doneTotal = resolved.filter((o) => o.status === 'done').length

  const trend: TrendPoint[] = resolved.map((o, i) => {
    const w = resolved.slice(Math.max(0, i - WINDOW + 1), i + 1)
    return {
      day: o.day,
      pct: Math.round((100 * w.filter((x) => x.status === 'done').length) / w.length),
      warmingUp: i < WINDOW - 1,
    }
  })

  const rawDay = daysBetween(ex.startDate, today) + 1
  const dayNum = Math.min(TRIAL_DAYS, rawDay)
  const final = lastDay(ex)
  const complete = rawDay > TRIAL_DAYS || !!ex.logs[final]
  const finalDay = final === today && !complete
  const phase: Analysis['phase'] = complete
    ? 'Decision'
    : dayNum <= 21
      ? 'Initiation phase'
      : dayNum <= 43
        ? 'Momentum phase'
        : 'Integration phase'
  const phases: Phase[] = (
    [
      [1, 21, 'Initiation'],
      [22, 43, 'Momentum'],
      [44, 65, 'Integration'],
    ] as const
  ).map(([first, last, label]) => {
    const len = last - first + 1
    const fill = Math.max(0, Math.min(1, (dayNum - first + 1) / len))
    return {
      label,
      firstDay: first,
      lastDay: last,
      fill: Math.round(fill * 100),
      current: !complete && dayNum >= first && dayNum <= last,
    }
  })

  const todayLog = ex.logs[today]
  const dueToday = all.some((o) => o.day === today)
  const loggedToday = !!todayLog
  const dueNow = dueToday && !loggedToday && !complete
  const notDue = !dueToday && !loggedToday && !complete
  const nd = nextDue(ex, today)
  const dec = ex.decision ?? null

  const notes: Note[] = resolved
    .filter((o) => ex.logs[o.day]?.note)
    .slice(-3)
    .reverse()
    .map((o) => ({ day: o.day, result: ex.logs[o.day].done ? 'done' : 'missed', text: ex.logs[o.day].note! }))

  const standing = isNew ? `${resolved.length}/${WINDOW}` : `${pct}%`

  return {
    ex,
    title: ex.title,
    tier,
    tierName: TIER_NAMES[tier],
    tracked: resolved.length,
    resolved,
    window,
    misses,
    pct,
    pctLabel: standing,
    standingText: standing + (isNew ? ' tracked' : ''),
    heroLine: isNew
      ? `tracked so far. The average starts at ${WINDOW}.`
      : `Missed ${misses}/${window.length} recent scheduled days`,
    segments,
    logBase: resolved
      .filter((o) => o.day !== today)
      .slice(-(WINDOW - 1))
      .map((o) => ({ done: o.status === 'done', label: String(dayOfMonth(o.day)) })),
    dayNum,
    dayLine: `Day ${dayNum}/${TRIAL_DAYS}`,
    phase,
    phases,
    journeyRight: complete
      ? 'Trial over'
      : dueNow
        ? 'Due today'
        : loggedToday
          ? 'Logged today'
          : nd
            ? `Next: ${formatDay(nd)}`
            : '',
    best,
    doneTotal,
    dueTotal: resolved.length,
    overallPct: resolved.length ? `${Math.round((100 * doneTotal) / resolved.length)}%` : '—',
    trend,
    dueToday,
    loggedToday,
    todayResult: todayLog ? (todayLog.done ? 'Yes' : 'No') : '',
    dueNow,
    notDue,
    finalDay,
    canEdit: loggedToday && !complete,
    nextDue: nd,
    complete,
    readyToDecide: complete && !dec,
    decided: !!dec,
    decisionLine: dec ? `${dec.outcome === 'keep' ? 'Kept' : 'Dropped'} on ${formatDay(dec.date)}` : '',
    decisionText: dec ? dec.summary || 'No notes written.' : '',
    notes,
  }
}

/**
 * The line on the Home row after a log: '43% → 29%' when the standing changed,
 * otherwise the new standing.
 */
export function logFlash(before: Analysis | undefined, after: Analysis): string {
  return before && before.pctLabel !== after.pctLabel
    ? `${before.pctLabel} → ${after.pctLabel}`
    : after.standingText
}

/** What the Log screen previews for today's answer (`choice` is null before Yes or No is picked). */
export function logPreview(a: Analysis, choice: boolean | null): { isNew: boolean; yesPct: number; noPct: number; line: string } {
  const base = a.logBase
  const doneBase = base.filter((b) => b.done).length
  const pctWith = (v: boolean) => Math.round((100 * (doneBase + (v ? 1 : 0))) / (base.length + 1))
  const isNew = base.length + 1 < WINDOW
  const line = isNew
    ? choice === null
      ? `${base.length}/${WINDOW} tracked so far`
      : `${base.length + 1}/${WINDOW} tracked`
    : choice === null
      ? `Yes → ${pctWith(true)}% · Not today → ${pctWith(false)}%`
      : `${a.loggedToday ? '' : `${a.pct}% → `}${pctWith(choice)}%`
  return { isNew, yesPct: pctWith(true), noPct: pctWith(false), line }
}

/** How many experiments started this calendar week (Monday start), and whether another may start. */
export function weeklyStarts(
  exps: Pick<Experiment, 'startDate'>[],
  today: DateKey,
): { started: number; limitReached: boolean; nextWeekStart: DateKey; line: string } {
  const ws = weekStart(today)
  const started = exps.filter((e) => e.startDate >= ws).length
  const limitReached = started >= WEEKLY_START_LIMIT
  const nextWeekStart = addDays(ws, 7)
  return {
    started,
    limitReached,
    nextWeekStart,
    line: limitReached
      ? `${WEEKLY_START_LIMIT}/${WEEKLY_START_LIMIT} started this week. Next one can start ${formatDay(nextWeekStart)}.`
      : `${started}/${WEEKLY_START_LIMIT} new experiments started this week`,
  }
}
