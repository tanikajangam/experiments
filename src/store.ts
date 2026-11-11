// The only module that reads or writes data. Screens call these functions, never storage directly.
//
// Every write changes the in-memory state at once (so the UI never waits), is saved to the on-device
// cache with a queue of pending server writes, and is sent to Supabase in order. If the phone is
// offline, the queue waits and is sent on the next open, when the connection comes back, or when the
// app returns to the foreground. A server load never replaces local data while writes are pending.
//
// Two modes: 'live' (started by main.tsx with Supabase and IndexedDB) and 'demo' (store.reset, used
// by tests and the ?screen= start links), which stays in memory and never touches the server or cache.
import { useSyncExternalStore } from 'react'
import type { Backend, Cache, Op, VoiceResult } from './lib/backend.ts'
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
import type { DecideAnswers } from './lib/decision.ts'
import type { AudioFormat, VoiceForm } from './lib/voice.ts'
import { buildExport } from './lib/exportData.ts'
import { DEFAULT_REMINDER, decisionToRow, experimentFromRow, experimentToRow, logToRow, reminderFromProfile } from './lib/rows.ts'

export type { DecideAnswers } from './lib/decision.ts'

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

/**
 * loading: waiting for the first load (no offline copy yet). signedOut: show sign-in.
 * ready: show the app. unconfigured: the build has no Supabase settings.
 */
export type Status = 'loading' | 'signedOut' | 'ready' | 'unconfigured'

export interface AppState {
  status: Status
  experiments: StoredExperiment[]
  reminder: Reminder
  /** True until the first experiment and its reminder are set up. */
  firstRun: boolean
  /** The last attempt to reach the server failed. */
  offline: boolean
  /** Changes made on this phone that the server doesn't have yet. */
  pending: number
  /** A write that failed while online (retry) or that the server refused (rejected), for the toast. */
  problem: SyncProblem | null
}

export interface SyncProblem {
  kind: 'failed' | 'rejected'
  message: string
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

const INITIAL: AppState = { status: 'loading', experiments: [], reminder: DEFAULT_REMINDER, firstRun: false, offline: false, pending: 0, problem: null }

let state: AppState = INITIAL
const listeners = new Set<() => void>()

let mode: 'demo' | 'live' = 'demo'
let backend: Backend | null = null
let cache: Cache | null = null
let userId: string | null = null
let queue: Op[] = []
/** Bumped on every local change, so a load that started before a change is thrown away. */
let version = 0
let flushing: Promise<void> | null = null
let flushAgain = false
/** The op being sent right now; it must not be changed while in flight. */
let inFlight: Op | null = null
let syncing: Promise<void> | null = null
let listening = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0
/** A write was refused, so the screen may show something the server doesn't have: reload after sending. */
let reloadAfterFlush = false
const RETRY_MS = 8000
const PENDING_SIGN_IN = 'experiments.signin'

export interface PendingSignIn {
  email: string
  step: 'email' | 'code'
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

/** Change the queue and keep the pending count on screen in step. */
function setQueue(q: Op[]) {
  queue = q
  if (state.pending !== q.length) set({ pending: q.length })
}

/** Retry sending with backoff while anything is waiting: 5 s, 10 s, 20 s… up to a minute. */
function scheduleRetry() {
  if (flushTimer || mode !== 'live') return
  const delay = Math.min(60_000, 5_000 * 2 ** retryAttempts)
  retryAttempts++
  flushTimer = setTimeout(() => {
    flushTimer = null
    if (queue.length > 0) void sync()
  }, delay)
}

function clearTimers() {
  if (flushTimer) clearTimeout(flushTimer)
  if (retryTimer) clearTimeout(retryTimer)
  flushTimer = retryTimer = null
  retryAttempts = 0
  reloadAfterFlush = false
}

function find(id: string): StoredExperiment | undefined {
  return state.experiments.find((e) => e.id === id)
}

function persist() {
  if (mode !== 'live' || !cache || !userId) return
  void cache.write({ userId, experiments: state.experiments, reminder: state.reminder, queue })
}

/** Apply a local change, then queue its server writes (live mode only). */
function commit(patch: Partial<AppState>, ops: (uid: string) => Op[]) {
  version++
  set(patch)
  if (mode !== 'live' || !userId) return
  for (const op of ops(userId)) setQueue(enqueue(queue, op))
  persist()
  void flush()
}

/**
 * Add an op to the queue. A profile change merges into a queued profile change that isn't being sent
 * yet, so dragging the reminder dial sends one write, not one per tick. (Profile writes don't depend on
 * the order of other writes, so merging into an earlier one is safe.)
 */
function enqueue(q: Op[], op: Op): Op[] {
  if (op.kind === 'profile') {
    let i = q.length - 1
    while (i >= 0 && (q[i].kind !== 'profile' || q[i] === inFlight)) i--
    if (i >= 0) {
      const prev = q[i] as Extract<Op, { kind: 'profile' }>
      return q.map((o, j) => (j === i ? { kind: 'profile', row: { ...prev.row, ...op.row } } : o))
    }
  }
  return [...q, op]
}

/**
 * Send queued writes in order. Stops at the first one that should be retried later. A flush asked for
 * while one is running makes it go round once more, so a write never waits on an attempt that started
 * before it was queued.
 */
function flush(): Promise<void> {
  if (flushing) {
    flushAgain = true
    return flushing
  }
  flushing = (async () => {
    do {
      flushAgain = false
      await flushOnce()
    } while (flushAgain)
  })().finally(() => {
    flushing = null
    if (reloadAfterFlush && queue.length === 0) {
      reloadAfterFlush = false
      setTimeout(() => void sync(), 0)
    }
  })
  return flushing
}

async function flushOnce() {
  const uid = userId
  if (!backend || !uid || queue.length === 0) return
  // Never send with a stale token: an anonymous write would be rejected and dropped.
  const s = await backend.session()
  if (s.kind !== 'user' || s.userId !== uid) {
    // Couldn't confirm the session (usually offline): keep the writes and try again later.
    if (s.kind === 'unknown') {
      set({ offline: true })
      scheduleRetry()
    }
    return
  }
  while (queue.length > 0 && userId === uid) {
    const op = queue[0]
    inFlight = op
    const result = await backend.send(op).finally(() => {
      inFlight = null
    })
    if (userId !== uid) return
    if (result === 'retry') {
      const online = typeof navigator === 'undefined' || navigator.onLine !== false
      set({
        offline: true,
        // Offline is shown by the offline indicator; a failure while online gets the toast.
        ...(online ? { problem: { kind: 'failed' as const, message: 'Couldn’t save to the server. Your change is kept on this phone.' } } : {}),
      })
      scheduleRetry()
      return
    }
    if (result === 'drop') {
      console.error('The server rejected a change; it was not saved.', op.kind)
      reloadAfterFlush = true
      set({ problem: { kind: 'rejected', message: 'The server refused a change, so it wasn’t saved. Showing what the server has.' } })
    } else {
      retryAttempts = 0
      if (state.offline) set({ offline: false })
    }
    setQueue(queue.filter((o) => o !== op))
    persist()
  }
  if (queue.length === 0 && state.problem?.kind === 'failed') set({ problem: null })
}

/** Switch to a signed-in account that has no offline copy here: wait for its first load. */
function adopt(id: string) {
  userId = id
  setQueue([])
  version++
  set({ status: 'loading', experiments: [], reminder: DEFAULT_REMINDER, firstRun: false })
}

async function signedOut() {
  userId = null
  setQueue([])
  version++
  set({ status: 'signedOut', experiments: [], reminder: DEFAULT_REMINDER, firstRun: false, offline: false })
  await cache?.clear()
}

/** The load failed. With nothing to show yet, keep trying every few seconds. */
function loadFailed() {
  set({ offline: true })
  if (state.status === 'loading' && !retryTimer) {
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (state.status === 'loading') void sync()
    }, RETRY_MS)
  }
}

/** Send pending writes, then (if none are left) load the server's copy. */
function sync(): Promise<void> {
  if (syncing) return syncing
  syncing = (async () => {
    if (mode !== 'live' || !backend) return
    if (!userId) {
      const s = await backend.session()
      if (s.kind === 'none') return signedOut()
      if (s.kind === 'unknown') return loadFailed()
      adopt(s.userId)
    }
    const uid = userId!
    await flush()
    if (queue.length > 0) return
    // Load only with a confirmed session for this user. Without one, supabase-js would ask as an
    // anonymous visitor, Row Level Security would answer with an empty list (not an error), and
    // that would wipe the offline copy.
    const s = await backend.session()
    if (s.kind === 'none') return signedOut()
    if (s.kind !== 'user' || s.userId !== uid) return loadFailed()
    const v = version
    const loaded = await backend.load(uid)
    if (!loaded) return loadFailed()
    // A change made during the load, or a different account, wins over what was loaded.
    if (v !== version || queue.length > 0 || userId !== uid || mode !== 'live') return
    set({
      status: 'ready',
      offline: false,
      experiments: loaded.experiments.map(experimentFromRow),
      reminder: reminderFromProfile(loaded.profile),
    })
    persist()
    // The profile's timezone sets when the server's day ends (for reminders). Keep it on this device's.
    const timezone = deviceTimeZone()
    if (!loaded.profile || loaded.profile.timezone !== timezone) {
      setQueue([...queue, { kind: 'profile', row: { id: uid, timezone } }])
      persist()
      await flush()
    }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

export const store = {
  getState: (): AppState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Demo mode: replace the state in memory only (tests and the ?screen= start links). */
  reset(next: Partial<AppState>) {
    mode = 'demo'
    clearTimers()
    userId = null
    setQueue([])
    version++
    set({ ...INITIAL, status: 'ready', ...next })
  },

  /** The build has no Supabase settings. */
  unconfigured() {
    mode = 'demo'
    set({ ...INITIAL, status: 'unconfigured' })
  },

  /**
   * Live mode. Shows the offline copy straight away if there is one, then checks the session and
   * syncs. Being offline never signs you out: only "no stored session" or the server ending it does.
   */
  async start(b: Backend, c: Cache) {
    mode = 'live'
    clearTimers()
    backend = b
    cache = c
    userId = null
    setQueue([])
    version++
    set(INITIAL)
    b.onSignedOut(() => void signedOut())
    if (!listening && typeof window !== 'undefined') {
      listening = true
      window.addEventListener('online', () => void sync())
      window.addEventListener('offline', () => set({ offline: true }))
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void sync()
      })
    }
    const snap = await c.read()
    if (snap) {
      userId = snap.userId
      setQueue(snap.queue)
      set({ status: 'ready', experiments: snap.experiments, reminder: snap.reminder })
    }
    const s = await b.session()
    if (s.kind === 'none') return signedOut()
    if (s.kind === 'user' && s.userId !== userId) adopt(s.userId)
    await sync()
  },

  /** Try again now: on reconnect, and when the app comes back to the foreground. */
  sync,

  /** The toast's Retry: try sending and loading again straight away. */
  retry() {
    retryAttempts = 0
    set({ problem: null })
    return sync()
  },

  /** All experiments, logs and decisions on this phone (including changes not yet sent), as JSON. */
  exportJson(now: Date = new Date()): string {
    return JSON.stringify(buildExport(state, now), null, 2)
  },

  dismissProblem() {
    set({ problem: null })
  },

  /**
   * The email and step of a sign-in in progress. The user leaves for Mail to read the code and iOS
   * may reload the app meanwhile, so this brings them back to the code box, not to a second send.
   */
  pendingSignIn(): PendingSignIn {
    try {
      const raw = localStorage.getItem(PENDING_SIGN_IN)
      if (raw) {
        const p = JSON.parse(raw) as { email?: unknown; step?: unknown }
        if (typeof p.email === 'string') return { email: p.email, step: p.step === 'code' ? 'code' : 'email' }
      }
    } catch {
      // Storage unavailable: start fresh.
    }
    return { email: '', step: 'email' }
  },

  setPendingSignIn(p: PendingSignIn | null) {
    try {
      if (p) localStorage.setItem(PENDING_SIGN_IN, JSON.stringify(p))
      else localStorage.removeItem(PENDING_SIGN_IN)
    } catch {
      // Not critical.
    }
  },

  /** Voice: a recording (base64) to fields for one form. Needs the live app and a connection. */
  async transcribe<F extends VoiceForm>(form: F, audio: string, format: AudioFormat): Promise<VoiceResult<F>> {
    if (mode !== 'live' || !backend) return { ok: false, message: 'Voice works in the signed-in app, not on a ?screen= preview link.' }
    return backend.transcribe(form, audio, format)
  },

  async sendCode(email: string) {
    if (!backend) return { ok: false as const, message: 'Not connected.' }
    return backend.sendCode(email.trim())
  },

  async verifyCode(email: string, code: string) {
    if (!backend) return { ok: false as const, message: 'Not connected.' }
    const result = await backend.verifyCode(email.trim(), code.replace(/\D/g, ''))
    if (!result.ok) return result
    store.setPendingSignIn(null)
    adopt(result.userId)
    void sync()
    return { ok: true as const }
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
    commit({ experiments: state.experiments.map((e) => (e.id === id ? after : e)) }, () => [
      { kind: 'log', row: logToRow(id, today, done, note) },
    ])
    return { flash: logFlash(before, analyze(after, today)), celebrate: done && lastDay(ex) === today }
  },

  /** Remove today's log, while the trial is still running. */
  clearLog(id: string, today: DateKey) {
    const ex = find(id)
    if (!ex || !ex.logs[today] || analyze(ex, today).complete) return
    const logs = { ...ex.logs }
    delete logs[today]
    commit({ experiments: state.experiments.map((e) => (e.id === id ? { ...e, logs } : e)) }, () => [
      { kind: 'unlog', experimentId: id, day: today },
    ])
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
    commit({ experiments: [...state.experiments, ex] }, (uid) => [{ kind: 'experiment', row: experimentToRow(ex, uid) }])
    return id
  },

  /** Keep or drop at the end of the trial. After this, tracking stops. */
  decide(id: string, outcome: 'keep' | 'drop', answers: DecideAnswers, summary: string, today: DateKey) {
    const ex = find(id)
    if (!ex || !analyze(ex, today).complete) return
    const decision: StoredDecision = { outcome, answers, summary, date: today }
    commit({ experiments: state.experiments.map((e) => (e.id === id ? { ...e, decision } : e)) }, () => [
      { kind: 'decision', row: decisionToRow(id, outcome, answers, today) },
    ])
  },

  setReminder(reminder: Reminder) {
    const before = state.reminder
    if (reminder.on === before.on && reminder.time === before.time) return
    // A new time (or turning it back on) clears "already reminded today", so the new time still fires today.
    const rearm = reminder.time !== before.time || (reminder.on && !before.on)
    commit({ reminder }, (uid) => [
      {
        kind: 'profile',
        row: { id: uid, reminder_on: reminder.on, reminder_time: reminder.time, ...(rearm ? { last_reminded_on: null } : {}) },
      },
    ])
  },

  /** Save this device's push subscription (or null when it's gone), so the server can send the reminder. */
  setPushSubscription(subscription: PushSubscriptionJSON | null) {
    commit({}, (uid) => [{ kind: 'profile', row: { id: uid, push_subscription: subscription } }])
  },

  setFirstRun(firstRun: boolean) {
    set({ firstRun })
  },
}

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState)
}
