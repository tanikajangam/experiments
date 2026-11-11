// The mic: tap to start, tap to stop (stops by itself at 60 s). While listening the button turns accent
// red, shows a stop square and pulses, and a "Listening… 0:12" timer shows (see CLAUDE.md). The
// recording goes to the store, which sends it to the `transcribe` Edge Function; the screen gets back
// only the fields that were said, fills them in, and the user fixes anything before saving.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { store } from './store.ts'
import { C, MicIcon, haptic } from './ui.tsx'
import { MAX_SECONDS, audioFormat, type FieldsFor, type VoiceForm } from './lib/voice.ts'

export type VoiceState = { phase: 'idle' } | { phase: 'recording'; seconds: number } | { phase: 'working' } | { phase: 'error'; message: string }

// iPhone records audio/mp4; Chrome and Firefox record webm or ogg.
const MIME_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Record, send, and hand the fields to `onFields`. A result that arrives after the screen has gone is dropped. */
export function useVoice<F extends VoiceForm>(form: F, onFields: (fields: FieldsFor[F]) => void) {
  const [state, setState] = useState<VoiceState>({ phase: 'idle' })
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)
  const take = useRef(0) // bumped on every start and on cancel; a stale result is ignored
  const mounted = useRef(true)
  const apply = useRef(onFields)
  apply.current = onFields

  const release = useCallback(() => {
    window.clearInterval(timer.current)
    stream.current?.getTracks().forEach((t) => t.stop()) // turns off the iPhone's recording indicator
    stream.current = null
  }, [])

  const cancel = useCallback(() => {
    take.current++
    const r = recorder.current
    recorder.current = null
    if (r && r.state !== 'inactive') {
      r.onstop = null
      r.stop()
    }
    release()
  }, [release])

  const finish = useCallback(
    async (mimeType: string, id: number) => {
      release()
      const blob = new Blob(chunks.current, { type: mimeType })
      chunks.current = []
      const format = audioFormat(blob.type)
      if (!format) return setState({ phase: 'error', message: 'This browser records audio in a format voice can’t read.' })
      if (blob.size < 1000) return setState({ phase: 'error', message: 'Didn’t catch anything. Try again, a little closer.' })
      setState({ phase: 'working' })
      const result = await store.transcribe(form, await toBase64(blob), format)
      if (!mounted.current || id !== take.current) return
      if (!result.ok) return setState({ phase: 'error', message: result.message })
      haptic('yes')
      apply.current(result.fields)
      setState({ phase: 'idle' })
    },
    [form, release],
  )

  const stop = useCallback(() => {
    const r = recorder.current
    if (r && r.state !== 'inactive') r.stop()
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return setState({ phase: 'error', message: 'Voice isn’t available in this browser.' })
    }
    const id = ++take.current
    let s: MediaStream
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return setState({ phase: 'error', message: 'The microphone is blocked. Allow it for Experiments in Settings.' })
    }
    if (!mounted.current || id !== take.current) return s.getTracks().forEach((t) => t.stop())
    stream.current = s
    const mimeType = pickMimeType()
    const r = new MediaRecorder(s, mimeType ? { mimeType } : undefined)
    recorder.current = r
    chunks.current = []
    r.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data)
    }
    r.onstop = () => {
      recorder.current = null
      void finish(r.mimeType || mimeType || '', id)
    }
    r.start()
    haptic('tap')
    const started = Date.now()
    setState({ phase: 'recording', seconds: 0 })
    timer.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000)
      if (seconds >= MAX_SECONDS) stop()
      else setState((cur) => (cur.phase === 'recording' && cur.seconds !== seconds ? { phase: 'recording', seconds } : cur))
    }, 250)
  }, [finish, stop])

  /** Tap: start, or stop if listening. Ignored while the recording is being sorted. */
  const toggle = useCallback(() => {
    if (state.phase === 'recording') {
      haptic('tap')
      stop()
    } else if (state.phase !== 'working') {
      void start()
    }
  }, [state.phase, start, stop])

  // Never leave the mic open: stop on leaving the screen, and when the app goes to the background.
  useEffect(() => {
    mounted.current = true
    const onHide = () => {
      if (document.visibilityState === 'hidden' && recorder.current) {
        cancel()
        setState({ phase: 'idle' })
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', onHide)
      cancel()
    }
  }, [cancel])

  return { state, toggle }
}

/** The line shown next to the mic: the timer while listening, then progress or what went wrong. */
export function voiceStatus(state: VoiceState): { text: string; color: string } | null {
  if (state.phase === 'recording') return { text: `Listening… 0:${String(state.seconds).padStart(2, '0')}`, color: C.red }
  if (state.phase === 'working') return { text: 'Filling it in…', color: C.ink2 }
  if (state.phase === 'error') return { text: state.message, color: C.red }
  return null
}

function StopIcon({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  )
}

export function VoiceButton({
  state,
  onToggle,
  label,
  size,
  iconSize = 24,
  style,
}: {
  state: VoiceState
  onToggle: () => void
  /** What the mic does, for screen readers, e.g. "Describe your experiment by voice". */
  label: string
  size: number
  iconSize?: number
  style?: CSSProperties
}) {
  const recording = state.phase === 'recording'
  const working = state.phase === 'working'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={recording ? 'Stop recording' : working ? 'Filling it in' : label}
      aria-pressed={recording}
      aria-busy={working}
      data-recording={recording ? 'true' : undefined}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 999,
        border: 0,
        background: recording ? C.red : C.green,
        color: '#FFFFFF',
        opacity: working ? 0.6 : 1,
        cursor: working ? 'progress' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 160ms ease',
        animation: recording ? 'micPulse 1.4s ease-out infinite' : undefined,
        ...style,
      }}
    >
      {recording ? <StopIcon size={iconSize} /> : <MicIcon size={iconSize} />}
    </button>
  )
}
