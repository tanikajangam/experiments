// The real Backend: supabase-js with the public URL and publishable key. Row Level Security on every
// table means this key can only ever reach the signed-in user's own rows.
import { createClient, isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { classify, type Backend, type Loaded } from './backend.ts'
import type { LoadedExperiment } from './rows.ts'

function authMessage(error: AuthError, step: 'send' | 'verify'): string {
  if (isAuthRetryableFetchError(error) || !error.status) return 'Can’t reach the server. Check your connection and try again.'
  if (error.status === 429 || error.code?.includes('rate_limit')) return 'Too many codes sent. Wait a few minutes, then try again.'
  if (step === 'verify') return 'That code didn’t work. Check it, or send a new one.'
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return 'That email address doesn’t look right.'
  return error.message
}

export function supabaseBackend(url: string, publishableKey: string): Backend {
  const client = createClient(url, publishableKey, {
    // The default localStorage session keeps the installed app signed in. Sign-in is by code,
    // so there is never a session in the URL to pick up.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  })

  return {
    async session() {
      const { data, error } = await client.auth.getSession()
      if (data.session) return { kind: 'user', userId: data.session.user.id }
      // An expired token that couldn't be refreshed (offline) comes back as no session plus an
      // error, while the session stays in storage. That isn't "signed out".
      if (error) return { kind: 'unknown' }
      return { kind: 'none' }
    },

    onSignedOut(callback) {
      client.auth.onAuthStateChange((event) => {
        // Supabase's advice: never await other Supabase calls inside this callback.
        if (event === 'SIGNED_OUT') setTimeout(callback, 0)
      })
    },

    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
      return error ? { ok: false, message: authMessage(error, 'send') } : { ok: true }
    },

    async verifyCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' })
      if (error || !data.user) return { ok: false, message: error ? authMessage(error, 'verify') : 'Sign-in failed. Try again.' }
      return { ok: true, userId: data.user.id }
    },

    async load(userId) {
      // Never load as an anonymous visitor: RLS would return an empty list, not an error.
      const { data } = await client.auth.getSession()
      if (data.session?.user.id !== userId) return null
      // Logs and the decision are embedded per experiment, so the 1000-row cap on a top-level
      // query applies to experiments (at most 3 a week), not to logs.
      const [experiments, profile] = await Promise.all([
        client
          .from('experiments')
          .select('id, title, where_note, why_note, schedule_days, tracking, start_date, logs(day, done, note), decisions(*)')
          .order('created_at'),
        client.from('profiles').select('timezone, reminder_on, reminder_time').eq('id', userId).maybeSingle(),
      ])
      if (experiments.error || profile.error) return null
      return { experiments: experiments.data as unknown as LoadedExperiment[], profile: profile.data } satisfies Loaded
    },

    async send(op) {
      const res =
        op.kind === 'experiment'
          ? await client.from('experiments').upsert(op.row)
          : op.kind === 'log'
            ? await client.from('logs').upsert(op.row, { onConflict: 'experiment_id,day' })
            : op.kind === 'unlog'
              ? await client.from('logs').delete().eq('experiment_id', op.experimentId).eq('day', op.day)
              : op.kind === 'decision'
                ? await client.from('decisions').upsert(op.row, { onConflict: 'experiment_id' })
                : await client.from('profiles').upsert(op.row, { onConflict: 'id' })
      if (res.error) console.error('Sync write failed', op.kind, res.status, res.error.message)
      return classify(res.status, res.error !== null)
    },
  }
}
