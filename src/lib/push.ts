// Notification permission and the push subscription. Push only works in the installed (home-screen)
// app on iPhone, and iOS only shows the permission prompt in response to a tap.
import { store } from '../store.ts'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!PUBLIC_KEY
}

function installed(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

/**
 * Call straight from a tap (closing the bell dial, finishing Reminder setup), never after an await or a
 * timer: iOS only shows the prompt inside the tap. Asks once; after that it just keeps the subscription saved.
 */
export function askForReminders(): void {
  if (!supported() || !installed()) return
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') void saveSubscription()
    })
  } else if (Notification.permission === 'granted') {
    void saveSubscription()
  }
}

/** Subscribe (or reuse the subscription) and save it to the profile. Run on every open once allowed. */
export async function saveSubscription(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker.ready
    const key = keyBytes(PUBLIC_KEY)
    let sub = await reg.pushManager.getSubscription()
    // A subscription made with an older server key can't receive pushes any more.
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      await sub.unsubscribe()
      sub = null
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    store.setPushSubscription(sub.toJSON())
  } catch (e) {
    console.error('Could not turn on reminders', e)
  }
}
