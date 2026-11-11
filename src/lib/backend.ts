// What the store needs from the server and from the on-device cache. The real implementations are
// src/lib/supabaseBackend.ts and src/lib/idbCache.ts; tests pass fakes.
import type { Reminder, StoredExperiment } from '../store.ts'
import type { DateKey } from './consistency.ts'
import type { DecisionRow, ExperimentRow, LoadedExperiment, LogRow, ProfileRow } from './rows.ts'

/** One write, queued until the server has it. Every op is idempotent, so sending one twice is harmless. */
export type Op =
  | { kind: 'experiment'; row: ExperimentRow }
  | { kind: 'log'; row: LogRow }
  | { kind: 'unlog'; experimentId: string; day: DateKey }
  | { kind: 'decision'; row: DecisionRow }
  | { kind: 'profile'; row: Partial<ProfileRow> & { id: string } }

/** ok: written. retry: offline or a server hiccup, keep it queued. drop: the server will never accept it. */
export type SendResult = 'ok' | 'retry' | 'drop'

/**
 * user: signed in, token fresh. none: nobody is signed in on this device.
 * unknown: a stored session exists but couldn't be checked (usually offline), so keep using the cache.
 */
export type SessionState = { kind: 'user'; userId: string } | { kind: 'none' } | { kind: 'unknown' }

export interface Loaded {
  experiments: LoadedExperiment[]
  profile: Pick<ProfileRow, 'timezone' | 'reminder_on' | 'reminder_time'> | null
}

export type AuthResult = { ok: true } | { ok: false; message: string }

export interface Backend {
  session(): Promise<SessionState>
  /** Called when the server ends the session (for example, the refresh token was revoked). */
  onSignedOut(callback: () => void): void
  sendCode(email: string): Promise<AuthResult>
  verifyCode(email: string, code: string): Promise<{ ok: true; userId: string } | { ok: false; message: string }>
  /** Everything for this user, or null if it couldn't be loaded (offline, server error). */
  load(userId: string): Promise<Loaded | null>
  send(op: Op): Promise<SendResult>
}

/** The last-loaded data plus writes not yet on the server, kept so the app opens offline. */
export interface Snapshot {
  userId: string
  experiments: StoredExperiment[]
  reminder: Reminder
  queue: Op[]
}

export interface Cache {
  read(): Promise<Snapshot | null>
  write(snapshot: Snapshot): Promise<void>
  clear(): Promise<void>
}

/**
 * Whether a failed write is worth retrying. Status 0 is a network failure (supabase-js reports it that
 * way); 401 is an expired token; 408, 429 and 5xx are temporary. Any other 4xx is a rejection that
 * would fail forever and block the queue behind it, so it is dropped.
 */
export function classify(status: number, failed: boolean): SendResult {
  if (!failed) return 'ok'
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return 'retry'
  return 'drop'
}
