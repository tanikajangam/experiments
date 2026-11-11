// The store in live mode, against a fake server and cache.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Snapshot } from './lib/backend.ts'
import type { LoadedExperiment } from './lib/rows.ts'
import { store } from './store.ts'
import { fakeBackend, fakeCache, settle } from './test/fakes.ts'

const TODAY = '2026-11-10' // a Tuesday
const form = { title: 'Read 10 pages', days: [0, 1, 2, 3, 4, 5, 6], where: '', why: '', tracking: 'check' as const }

const serverExperiment: LoadedExperiment = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Wear retainer',
  where_note: null,
  why_note: null,
  schedule_days: [0, 1, 2, 3, 4, 5, 6],
  tracking: 'check',
  start_date: '2026-11-01',
  logs: [{ day: '2026-11-09', done: true, note: null }],
  decisions: null,
}

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  userId: 'u1',
  experiments: [{ id: serverExperiment.id, title: 'Wear retainer', scheduleDays: [0, 1, 2, 3, 4, 5, 6], startDate: '2026-11-01', logs: {} }],
  reminder: { on: true, time: '20:00' },
  queue: [],
  ...over,
})

beforeEach(() => {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'UTC' } as Intl.ResolvedDateTimeFormatOptions)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sync: opening the app', () => {
  it('a fresh install waits on a loading state, then shows the server’s experiments', async () => {
    const { fake, backend } = fakeBackend({ loaded: { experiments: [serverExperiment], profile: { timezone: 'UTC', reminder_on: true, reminder_time: '08:00:00' } } })
    let open!: () => void
    fake.loadGate = new Promise((r) => (open = r))
    const cache = fakeCache()
    const started = store.start(backend, cache)
    await settle()
    expect(store.getState().status).toBe('loading')
    open()
    await started
    expect(store.getState()).toMatchObject({ status: 'ready', reminder: { on: true, time: '08:00' } })
    expect(store.getState().experiments.map((e) => e.title)).toEqual(['Wear retainer'])
    expect(cache.snap()?.experiments).toHaveLength(1)
  })

  it('offline with an offline copy: opens on the copy and stays signed in', async () => {
    const { fake, backend } = fakeBackend()
    fake.online = false
    await store.start(backend, fakeCache(snapshot()))
    expect(store.getState()).toMatchObject({ status: 'ready', offline: true })
    expect(store.getState().experiments[0].title).toBe('Wear retainer')
  })

  it('a session that can’t be confirmed never loads, so an anonymous empty answer can’t wipe the copy', async () => {
    const { fake, backend } = fakeBackend() // online, and the server would answer with nothing
    fake.sessionUnknown = true
    const cache = fakeCache(snapshot())
    await store.start(backend, cache)
    expect(fake.loads).toBe(0)
    expect(store.getState().experiments[0].title).toBe('Wear retainer')
    expect(cache.snap()?.experiments).toHaveLength(1)
  })

  it('no stored session: shows sign-in and clears the offline copy', async () => {
    const { backend } = fakeBackend({ session: { kind: 'none' } })
    const cache = fakeCache(snapshot())
    await store.start(backend, cache)
    expect(store.getState().status).toBe('signedOut')
    expect(cache.snap()).toBeNull()
  })

  it('the server ending the session signs out', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    fake.signedOutCallback!()
    await settle()
    expect(store.getState().status).toBe('signedOut')
  })

  it('a different account than the offline copy’s starts clean', async () => {
    const { backend } = fakeBackend({ session: { kind: 'user', userId: 'u2' } })
    const cache = fakeCache(snapshot({ queue: [{ kind: 'unlog', experimentId: 'x', day: TODAY }] }))
    await store.start(backend, cache)
    expect(store.getState().experiments).toEqual([])
    expect(cache.snap()).toMatchObject({ userId: 'u2' })
    expect(cache.snap()?.queue.every((op) => op.kind === 'profile')).toBe(true)
  })

  it('saves the device timezone to the profile on first sign-in', async () => {
    const { fake, backend } = fakeBackend({ loaded: { experiments: [], profile: null } })
    await store.start(backend, fakeCache())
    expect(fake.sent).toEqual([{ kind: 'profile', row: { id: 'u1', timezone: 'UTC' } }])
  })
})

describe('sync: writing', () => {
  it('sends writes in order: the experiment before its log', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    const id = store.createExperiment(form, TODAY)!
    store.writeLog(id, true, '', TODAY)
    await settle()
    await store.sync()
    expect(fake.sent.map((op) => op.kind)).toEqual(['experiment', 'log'])
    expect(fake.sent[0]).toMatchObject({ row: { id, user_id: 'u1', start_date: TODAY } })
    expect(fake.sent[1]).toMatchObject({ row: { experiment_id: id, day: TODAY, done: true } })
  })

  it('offline: the write shows at once, is kept on the device, and is sent when back online', async () => {
    const { fake, backend } = fakeBackend({ loaded: { experiments: [serverExperiment], profile: { timezone: 'UTC', reminder_on: true, reminder_time: '20:00:00' } } })
    const cache = fakeCache()
    await store.start(backend, cache)
    fake.online = false
    store.writeLog(serverExperiment.id, false, 'Forgot', TODAY)
    await settle()
    expect(store.getState().experiments[0].logs[TODAY]).toEqual({ done: false, note: 'Forgot' })
    expect(cache.snap()?.queue).toHaveLength(1)
    expect(cache.snap()?.experiments[0].logs[TODAY]).toEqual({ done: false, note: 'Forgot' })

    // Force-quit and reopen, still offline: the log is still there.
    await store.start(backend, cache)
    expect(store.getState().experiments[0].logs[TODAY]).toEqual({ done: false, note: 'Forgot' })

    // Back online: the queue is sent, then the server's copy is loaded.
    fake.online = true
    fake.loaded.experiments[0].logs = [...(fake.loaded.experiments[0].logs ?? []), { day: TODAY, done: false, note: 'Forgot' }]
    await store.sync()
    expect(fake.sent).toEqual([{ kind: 'log', row: { experiment_id: serverExperiment.id, day: TODAY, done: false, note: 'Forgot' } }])
    expect(cache.snap()?.queue).toEqual([])
    expect(store.getState()).toMatchObject({ offline: false })
  })

  it('a write the server rejects is dropped, so it can’t block the ones behind it', async () => {
    const { fake, backend } = fakeBackend()
    const cache = fakeCache()
    await store.start(backend, cache)
    fake.resultFor = (op) => (op.kind === 'experiment' ? 'drop' : 'ok')
    store.createExperiment(form, TODAY)
    store.setReminder({ on: true, time: '08:00' })
    await settle()
    await store.sync()
    expect(fake.sent.map((op) => op.kind)).toEqual(['profile'])
    expect(cache.snap()?.queue).toEqual([])
  })

  it('a load never overwrites a change made while it was running', async () => {
    const { fake, backend } = fakeBackend({ loaded: { experiments: [serverExperiment], profile: { timezone: 'UTC', reminder_on: true, reminder_time: '20:00:00' } } })
    await store.start(backend, fakeCache())
    let open!: () => void
    fake.loadGate = new Promise((r) => (open = r))
    const syncing = store.sync()
    await settle()
    store.writeLog(serverExperiment.id, true, '', TODAY)
    open()
    await syncing
    expect(store.getState().experiments[0].logs[TODAY]).toEqual({ done: true, note: '' })
  })

  it('the reminder is saved to the profile', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    store.setReminder({ on: false, time: '12:30' })
    await settle()
    await store.sync()
    expect(fake.sent).toContainEqual({ kind: 'profile', row: { id: 'u1', reminder_on: false, reminder_time: '12:30', last_reminded_on: null } })
  })

  it('dragging the dial sends one write with the final time, not one per tick', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    fake.online = false // hold the queue while dragging
    for (const time of ['20:15', '20:30', '20:45', '21:00']) store.setReminder({ on: true, time })
    fake.online = true
    await store.sync()
    const profiles = fake.sent.filter((op) => op.kind === 'profile')
    expect(profiles).toEqual([{ kind: 'profile', row: { id: 'u1', reminder_on: true, reminder_time: '21:00', last_reminded_on: null } }])
  })

  it('a write already on its way is never changed; the next change queues behind it', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const send = backend.send
    backend.send = async (op) => {
      await gate
      return send(op)
    }
    store.setReminder({ on: true, time: '07:00' })
    await settle() // the 07:00 write is now in flight
    store.setReminder({ on: true, time: '07:15' })
    release()
    await settle()
    await store.sync()
    expect(fake.sent.map((op) => op.kind === 'profile' && op.row.reminder_time)).toEqual(['07:00', '07:15'])
  })

  it('setting the reminder to what it already is sends nothing', async () => {
    const { fake, backend } = fakeBackend()
    await store.start(backend, fakeCache())
    store.setReminder({ on: true, time: '20:00' })
    await settle()
    expect(fake.sent).toEqual([])
  })
})

describe('sync: signing in', () => {
  it('a right code signs in and loads; a wrong one says so', async () => {
    const { fake, backend } = fakeBackend({ session: { kind: 'none' }, loaded: { experiments: [serverExperiment], profile: null } })
    await store.start(backend, fakeCache())
    expect(store.getState().status).toBe('signedOut')
    expect(await store.verifyCode('me@example.com', '000000')).toMatchObject({ ok: false })
    expect(await store.verifyCode('me@example.com', '123 456')).toEqual({ ok: true })
    await store.sync()
    expect(store.getState().status).toBe('ready')
    expect(store.getState().experiments).toHaveLength(1)
    expect(fake.loads).toBeGreaterThan(0)
  })
})

describe('sync: demo mode', () => {
  it('the start links’ seed data never reaches the server or the device', async () => {
    const { fake, backend } = fakeBackend()
    const cache = fakeCache()
    await store.start(backend, cache)
    const sentBefore = fake.sent.length
    store.reset({ experiments: [] })
    store.createExperiment(form, TODAY)
    await settle()
    await store.sync()
    expect(fake.sent.length).toBe(sentBefore)
    expect(cache.snap()?.experiments ?? []).toEqual([])
  })
})

describe('sync: telling the user (step 8)', () => {
  const setOnline = (on: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on })
  const loadedWith = () => ({ experiments: [structuredClone(serverExperiment)], profile: { timezone: 'UTC', reminder_on: true, reminder_time: '20:00:00' } })

  it('airplane mode: two logs wait on the phone (counted, no error toast), then reach the server', async () => {
    const second = { ...structuredClone(serverExperiment), id: '22222222-2222-4222-8222-222222222222', title: 'Gym session' }
    const { fake, backend } = fakeBackend({ loaded: { ...loadedWith(), experiments: [structuredClone(serverExperiment), second] } })
    await store.start(backend, fakeCache())
    setOnline(false)
    fake.online = false
    store.writeLog(serverExperiment.id, true, '', TODAY)
    store.writeLog(second.id, true, '', TODAY)
    await settle()
    expect(store.getState()).toMatchObject({ pending: 2, offline: true, problem: null })

    setOnline(true)
    fake.online = true
    await store.sync()
    expect(fake.sent.filter((op) => op.kind === 'log')).toHaveLength(2)
    expect(store.getState()).toMatchObject({ pending: 0, offline: false })
  })

  it('a write that fails while online shows the toast; Retry sends it and clears it', async () => {
    const { fake, backend } = fakeBackend({ loaded: loadedWith() })
    await store.start(backend, fakeCache())
    fake.resultFor = () => 'retry' // e.g. the server answered 503
    store.writeLog(serverExperiment.id, true, '', TODAY)
    await settle()
    expect(store.getState().problem).toMatchObject({ kind: 'failed' })
    expect(store.getState().pending).toBe(1)
    fake.resultFor = () => 'ok'
    await store.retry()
    expect(store.getState()).toMatchObject({ problem: null, pending: 0 })
  })

  it('keeps retrying on its own while something is waiting, without a new tap', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    try {
      const { fake, backend } = fakeBackend({ loaded: loadedWith() })
      await store.start(backend, fakeCache())
      fake.resultFor = () => 'retry'
      store.writeLog(serverExperiment.id, true, '', TODAY)
      await vi.advanceTimersByTimeAsync(0)
      fake.resultFor = () => 'ok'
      await vi.advanceTimersByTimeAsync(5_000)
      expect(fake.sent.filter((op) => op.kind === 'log')).toHaveLength(1)
      expect(store.getState().pending).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a refused write shows the toast and the screen goes back to what the server has', async () => {
    const { fake, backend } = fakeBackend({ loaded: loadedWith() })
    await store.start(backend, fakeCache())
    const loadsBefore = fake.loads
    fake.resultFor = (op) => (op.kind === 'log' ? 'drop' : 'ok')
    store.writeLog(serverExperiment.id, false, 'x', TODAY)
    await settle()
    await settle()
    await store.sync()
    expect(store.getState().problem).toMatchObject({ kind: 'rejected' })
    expect(fake.loads).toBeGreaterThan(loadsBefore)
    expect(store.getState().experiments[0].logs[TODAY]).toBeUndefined()
  })
})
