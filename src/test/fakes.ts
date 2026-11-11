// A fake server and cache for testing the store's sync without Supabase or IndexedDB.
import type { Backend, Cache, Loaded, Op, SendResult, SessionState, Snapshot } from '../lib/backend.ts'

export function fakeCache(initial: Snapshot | null = null) {
  let snap: Snapshot | null = initial ? structuredClone(initial) : null
  const cache: Cache & { snap: () => Snapshot | null } = {
    snap: () => snap,
    read: async () => (snap ? structuredClone(snap) : null),
    write: async (s) => {
      snap = structuredClone(s)
    },
    clear: async () => {
      snap = null
    },
  }
  return cache
}

export function fakeBackend(opts: { session?: SessionState; loaded?: Loaded } = {}) {
  const fake = {
    session: (opts.session ?? { kind: 'user', userId: 'u1' }) as SessionState,
    loaded: opts.loaded ?? ({ experiments: [], profile: { timezone: 'UTC', reminder_on: true, reminder_time: '20:00:00' } } as Loaded),
    /** Whether the network is up. When down, sends return 'retry' and loads return null. */
    online: true,
    /** The token couldn't be refreshed even though data requests would get through. */
    sessionUnknown: false,
    /** Ops that reached the server, in order. */
    sent: [] as Op[],
    /** Override the result for an op (for example, to make the server reject it). */
    resultFor: (_op: Op): SendResult => 'ok',
    loads: 0,
    /** When set, loads wait for this before answering. */
    loadGate: null as Promise<void> | null,
    signedOutCallback: null as null | (() => void),
  }
  const backend: Backend = {
    session: async () => (fake.session.kind === 'none' || (fake.online && !fake.sessionUnknown) ? fake.session : { kind: 'unknown' }),
    onSignedOut: (cb) => {
      fake.signedOutCallback = cb
    },
    sendCode: async () => (fake.online ? { ok: true } : { ok: false, message: 'offline' }),
    verifyCode: async (_email, code) => {
      if (code !== '123456') return { ok: false, message: 'That code didn’t work. Check it, or send a new one.' }
      fake.session = { kind: 'user', userId: 'u1' }
      return { ok: true, userId: 'u1' }
    },
    load: async () => {
      fake.loads++
      if (fake.loadGate) await fake.loadGate
      return fake.online ? structuredClone(fake.loaded) : null
    },
    send: async (op) => {
      if (!fake.online) return 'retry'
      const r = fake.resultFor(op)
      if (r === 'ok') fake.sent.push(op)
      return r
    },
  }
  return { fake, backend }
}

/** Let pending promises settle. */
export const settle = () => new Promise((r) => setTimeout(r, 0))
