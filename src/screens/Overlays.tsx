// Shown over every screen (step 8; not in the prototype, see CLAUDE.md): the offline indicator, a toast
// when a save fails, and an "Update available" prompt when a new version has been deployed. They sit at
// the top, clear of the sticky bars and the bell dial at the bottom.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { store, useStore } from '../store.ts'
import { C, ease } from '../ui.tsx'

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

const column: CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top) + 8px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(390px, 100%)',
  boxSizing: 'border-box',
  padding: '0 16px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  zIndex: 10,
  pointerEvents: 'none',
}

const toastStyle: CSSProperties = {
  pointerEvents: 'auto',
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 10px 10px 16px',
  borderRadius: 16,
  background: C.ink,
  color: C.cream,
  boxShadow: '0 6px 20px rgba(43, 42, 38, 0.25)',
  animation: `riseIn 280ms ${ease} both`,
}

const toastButton = (primary: boolean): CSSProperties => ({
  minHeight: 44,
  minWidth: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: 0,
  background: primary ? C.green : 'transparent',
  color: primary ? '#FFFFFF' : C.cream,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  flexShrink: 0,
})

export function Toast({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div role="alert" style={toastStyle}>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{text}</span>
      {children}
    </div>
  )
}

/** The offline pill, plus the save-failed toast. Pure view of the store, so it can be tested on its own. */
export function SyncNotices({ online }: { online: boolean }) {
  const { status, offline, pending, problem } = useStore()
  if (status !== 'ready') return null
  const showOffline = !online || offline
  return (
    <>
      {showOffline && (
        <div
          role="status"
          style={{
            pointerEvents: 'auto',
            padding: '6px 14px',
            borderRadius: 999,
            background: C.ink,
            color: C.cream,
            fontSize: 12,
            fontWeight: 500,
            animation: `riseIn 280ms ${ease} both`,
          }}
        >
          Offline{pending > 0 ? ` · ${pending} ${pending === 1 ? 'change' : 'changes'} saved on this phone` : ''}
        </div>
      )}
      {problem && (
        <Toast text={problem.message}>
          {problem.kind === 'failed' ? (
            <button type="button" onClick={() => void store.retry()} style={toastButton(true)}>
              Retry
            </button>
          ) : (
            <button type="button" onClick={() => store.dismissProblem()} style={toastButton(true)}>
              OK
            </button>
          )}
        </Toast>
      )}
    </>
  )
}

export function UpdatePrompt({ onUpdate, onLater }: { onUpdate: () => void; onLater: () => void }) {
  return (
    <Toast text="A new version of the app is ready.">
      <button type="button" onClick={onLater} style={toastButton(false)}>
        Later
      </button>
      <button type="button" onClick={onUpdate} style={toastButton(true)}>
        Update
      </button>
    </Toast>
  )
}

export function Overlays() {
  const online = useOnline()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // A home-screen app that's resumed doesn't reload the page, so look for a new version on the way
      // back to the foreground, and hourly while it's open.
      const check = () => void registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, 60 * 60 * 1000)
    },
  })
  return (
    <div style={column}>
      <SyncNotices online={online} />
      {needRefresh && <UpdatePrompt onUpdate={() => void updateServiceWorker(true)} onLater={() => setNeedRefresh(false)} />}
    </div>
  )
}
