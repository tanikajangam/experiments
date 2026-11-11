// Sign in with a code sent by email (not a magic link, which would open Safari instead of the
// installed app). Not in the prototype; styled like Welcome.
import { useState, type CSSProperties, type FormEvent } from 'react'
import { store, type PendingSignIn } from '../store.ts'
import { C, ease, primaryButton, screenRoot, serif } from '../ui.tsx'

const field: CSSProperties = {
  minHeight: 52,
  boxSizing: 'border-box',
  padding: '0 16px',
  borderRadius: 12,
  border: `1.5px solid ${C.rule}`,
  background: C.card,
  fontSize: 16,
  color: C.ink,
  width: '100%',
}

const linkButton: CSSProperties = {
  minHeight: 44,
  padding: '0 8px',
  border: 0,
  background: 'transparent',
  color: C.greenText,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

export function SignIn() {
  const [{ email, step }, setPending] = useState(store.pendingSignIn)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sentAgain, setSentAgain] = useState(false)

  const goTo = (next: PendingSignIn) => {
    setPending(next)
    store.setPendingSignIn(next)
    setError('')
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const digits = code.replace(/\D/g, '')
  const validCode = digits.length >= 6

  const send = async (again = false) => {
    if (!validEmail || busy) return
    setBusy(true)
    setError('')
    const r = await store.sendCode(email)
    setBusy(false)
    if (!r.ok) return setError(r.message)
    setCode('')
    setSentAgain(again)
    goTo({ email: email.trim(), step: 'code' })
  }

  const verify = async () => {
    if (!validCode || busy) return
    setBusy(true)
    setError('')
    const r = await store.verifyCode(email, digits)
    setBusy(false)
    if (!r.ok) return setError(r.message)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void (step === 'email' ? send() : verify())
  }

  const enabled = !busy && (step === 'email' ? validEmail : validCode)

  return (
    <form onSubmit={submit} noValidate style={{ ...screenRoot, padding: '56px 24px max(24px, env(safe-area-inset-bottom))' }}>
      <span style={{ fontSize: 18, fontWeight: 500, color: C.headA }}>
        Tanki’s <span style={{ color: C.headB }}>Experiments</span>
      </span>

      <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, animation: `riseIn 500ms ${ease} 120ms both` }}>
        {step === 'email' ? (
          <>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1.2 }}>Sign in</h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: C.ink2 }}>We’ll email you a code. No password.</p>
            <label htmlFor="signin-email" style={{ fontSize: 14, fontWeight: 500, paddingTop: 8 }}>
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setPending({ email: e.target.value, step })}
              placeholder="you@example.com"
              style={field}
            />
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1.2 }}>Check your email</h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: C.ink2, overflowWrap: 'anywhere' }}>
              {sentAgain ? 'New code sent' : 'We sent a code'} to <span style={{ color: C.ink, fontWeight: 500 }}>{email}</span>.
            </p>
            <label htmlFor="signin-code" style={{ fontSize: 14, fontWeight: 500, paddingTop: 8 }}>
              Code
            </label>
            <input
              id="signin-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              style={{ ...field, ...serif, fontSize: 28, letterSpacing: 6, textAlign: 'center' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button type="button" onClick={() => goTo({ email, step: 'email' })} style={{ ...linkButton, paddingLeft: 0 }}>
                Use a different email
              </button>
              <button type="button" disabled={busy} onClick={() => void send(true)} style={{ ...linkButton, paddingRight: 0 }}>
                Send a new code
              </button>
            </div>
          </>
        )}
        <p role="alert" style={{ margin: 0, minHeight: 20, fontSize: 13, lineHeight: 1.45, color: C.red }}>
          {error}
        </p>
      </div>

      <button
        type="submit"
        disabled={!enabled}
        style={{ ...primaryButton, padding: '0 20px', background: enabled ? C.green : C.disabledBg, color: enabled ? '#FFFFFF' : C.disabledFg }}
      >
        {busy ? (step === 'email' ? 'Sending…' : 'Signing in…') : step === 'email' ? 'Send code' : 'Sign in'}
      </button>
    </form>
  )
}
