// The only module that reads or writes data. Screens call these functions, never storage directly.
// Step 3: in memory, seeded with the prototype's seed data. Step 4 swaps this for Supabase + IndexedDB.
import { useSyncExternalStore } from 'react'
import {
  analyze,
  lastDay,
  localDateKey,
  logFlash,
  weeklyStarts,
  type DateKey,
  type Decision,
  type Experiment,
  type Weekday,
} from './lib/consistency.ts'
import { seed } from './lib/seed.ts'

export interface DecideAnswers {
  effort: string | null
  survive: string | null
  cost: string[]
  costNote: string
  change: string
}

export interface StoredDecision extends Decision {
  answers?: DecideAnswers
}

export interface StoredExperiment extends Experiment {
  decision?: StoredDecision | null
}

export interface Reminder {
  on: boolean
  /** 'HH:MM', 24-hour. */
  time: string
}

export interface AppState {
  experiments: StoredExperiment[]
  reminder: Reminder
  /** True until the first experiment and its reminder are set up. */
  firstRun: boolean
}

export interface NewExperiment {
  title: string
  days: Weekday[]
  where: string
  why: string
  tracking: 'check'
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** Today in the user's timezone. The day changes at local midnight. */
export function currentDay(now: Date = new Date()): DateKey {
  return localDateKey(now, deviceTimeZone())
}

let state: AppState = {
  experiments: seed(currentDay()),
  reminder: { on: true, time: '20:00' },
  firstRun: false,
}
const listeners = new Set<() => void>()

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function update(id: string, change: (ex: StoredExperiment) => StoredExperiment) {
  set({ experiments: state.experiments.map((e) => (e.id === id ? change(e) : e)) })
}

function find(id: string): StoredExperiment | undefined {
  return state.experiments.find((e) => e.id === id)
}

export const store = {
  getState: (): AppState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Replace the whole state (used by tests and the prototype's start-screen links). */
  reset(next: Partial<AppState>) {
    set(next)
  },

  /**
   * Log today for one experiment. Only today can be logged, so a late log never turns a past
   * missed day into done. Returns the Home row text ("43% → 29%") and whether this was a yes
   * on day 65 (which opens the celebration), or null if nothing was written.
   */
  writeLog(id: string, done: boolean, note: string, today: DateKey): { flash: string; celebrate: boolean } | null {
    const ex = find(id)
    if (!ex) return null
    const before = analyze(ex, today)
    if (!before.dueToday || before.complete) return null
    const after: StoredExperiment = { ...ex, logs: { ...ex.logs, [today]: { done, note } } }
    update(id, () => after)
    return { flash: logFlash(before, analyze(after, today)), celebrate: done && lastDay(ex) === today }
  },

  /** Remove today's log, while the trial is still running. */
  clearLog(id: string, today: DateKey) {
    const ex = find(id)
    if (!ex || !ex.logs[today] || analyze(ex, today).complete) return
    const logs = { ...ex.logs }
    delete logs[today]
    update(id, (e) => ({ ...e, logs }))
  },

  /** Start a new experiment today. Returns its id, or null if invalid or 3 have started this week. */
  createExperiment(form: NewExperiment, today: DateKey): string | null {
    const title = form.title.trim()
    if (!title || form.days.length === 0) return null
    if (weeklyStarts(state.experiments, today).limitReached) return null
    const id = crypto.randomUUID()
    const ex: StoredExperiment = {
      id,
      title,
      scheduleDays: [...form.days],
      startDate: today,
      where: form.where.trim(),
      why: form.why.trim(),
      tracking: form.tracking,
      logs: {},
    }
    set({ experiments: [...state.experiments, ex] })
    return id
  },

  /** Keep or drop at the end of the trial. After this, tracking stops. */
  decide(id: string, outcome: 'keep' | 'drop', answers: DecideAnswers, summary: string, today: DateKey) {
    const ex = find(id)
    if (!ex || !analyze(ex, today).complete) return
    update(id, (e) => ({ ...e, decision: { outcome, answers, summary, date: today } }))
  },

  setReminder(reminder: Reminder) {
    set({ reminder })
  },

  setFirstRun(firstRun: boolean) {
    set({ firstRun })
  },
}

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState)
}
