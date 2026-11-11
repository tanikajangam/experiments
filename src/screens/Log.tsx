// Log today: yes or not today, with an optional note.
import { useState, type ReactNode } from 'react'
import { WINDOW, formatDay, logPreview, type Analysis, type DateKey } from '../lib/consistency.ts'
import { BackIcon, C, CheckIcon, CrossIcon, ease, eyebrow, haptic, primaryButton, roundIconButton, screenRoot, serif, stickyBar } from '../ui.tsx'
import { VoiceButton, useVoice, voiceStatus } from '../voice.tsx'

const PHASE_PROMPTS: Record<string, string> = {
  'Initiation phase': 'What made today easier or harder?',
  'Momentum phase': 'Did it take less effort than last week?',
  'Integration phase': 'Did you have to think about it today?',
  Decision: 'Anything worth remembering?',
}

interface Props {
  a: Analysis
  today: DateKey
  /** Starting answer: today's log if there is one, otherwise what was tapped on Home. */
  initialDone: boolean | null
  initialNote: string
  onBack: () => void
  onSubmit: (done: boolean, note: string) => void
  onClear: () => void
}

export function Log({ a, today, initialDone, initialNote, onBack, onSubmit, onClear }: Props) {
  const [done, setDone] = useState<boolean | null>(initialDone)
  const [note, setNote] = useState(initialNote)
  const yes = done === true
  const no = done === false

  // Voice sets yes or not today if that was said, and adds the note; nothing is saved until Log it.
  const voice = useVoice('log', (f) => {
    if (f.done !== null) setDone(f.done)
    if (f.note) setNote((cur) => (cur.trim() ? `${cur.trim()} ${f.note}` : f.note!))
  })
  const status = voiceStatus(voice.state)

  const pick = (v: boolean) => () => {
    haptic(v ? 'yes' : 'no')
    setDone(v)
  }

  const strip: { h: number; bg: string; bd: string; bs: string; label: string; labelColor: string; labelWeight: number }[] = [
    ...a.logBase.map((b) => ({
      h: 40,
      bg: b.done ? C.green : C.miss,
      bd: b.done ? C.green : C.miss,
      bs: 'solid',
      label: b.label,
      labelColor: C.ink2,
      labelWeight: 400,
    })),
    {
      h: 56,
      bg: yes ? C.green : no ? C.miss : 'transparent',
      bd: yes ? C.green : no ? C.miss : C.green,
      bs: 'solid',
      label: 'today',
      labelColor: C.greenText,
      labelWeight: 600,
    },
  ]
  while (strip.length < WINDOW) strip.push({ h: 40, bg: 'transparent', bd: '#B9B3A6', bs: 'dashed', label: '', labelColor: C.ink2, labelWeight: 400 })

  const preview = logPreview(a, done)
  const canClear = a.loggedToday && !a.complete

  return (
    <div style={{ ...screenRoot, position: 'relative', overflow: 'clip' }}>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 14,
          top: 26,
          fontSize: 140,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: -5,
          ...serif,
          color: '#CBC4B5',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {a.dayNum}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, padding: '48px 24px 24px', flex: 1, position: 'relative' }}>
        <button onClick={onBack} aria-label="Back" style={roundIconButton}>
          <BackIcon />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 38 }}>
          <span style={eyebrow}>
            Day {a.dayNum}/65 · {a.phase}
          </span>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, lineHeight: 1.15, color: C.ink, textWrap: 'balance' }}>{a.title}</h1>
          <span style={{ fontSize: 14, color: C.ink2 }}>{formatDay(today)}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {strip.map((seg, k) => (
              <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: '100%',
                    height: seg.h,
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    background: seg.bg,
                    border: `1.5px ${seg.bs} ${seg.bd}`,
                    transition: 'background-color 260ms ease, border-color 260ms ease',
                    animation: `growY 360ms ${ease} ${120 + 40 * k}ms both`,
                    transformOrigin: '50% 100%',
                  }}
                />
                <span style={{ fontSize: 10, minHeight: 14, color: seg.labelColor, fontWeight: seg.labelWeight }}>{seg.label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: C.ink2 }}>
            Last {WINDOW} scheduled days · <span style={{ fontWeight: 600, color: no ? C.red : C.greenText }}>{preview.line}</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>Did you do it?</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <ChoiceButton pressed={yes} onClick={pick(true)} bg={yes ? C.green : C.card} fg={yes ? '#FFFFFF' : C.ink} bd={yes ? C.green : C.card}>
              <CheckIcon size={26} width={2.4} />
              Yes
            </ChoiceButton>
            <ChoiceButton pressed={no} onClick={pick(false)} bg={no ? C.red : C.card} fg={no ? '#FFFFFF' : C.ink} bd={no ? C.red : C.card}>
              <CrossIcon size={26} width={2.4} />
              Not today
            </ChoiceButton>
          </div>
        </div>

        {no && a.ex.why && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 14, borderLeft: `2px solid ${C.rule}`, animation: `riseIn 320ms ${ease} both` }}>
            <span style={{ fontSize: 12, color: C.ink2 }}>Why you started</span>
            <span style={{ fontSize: 17, fontStyle: 'italic', lineHeight: 1.35, color: C.ink, ...serif }}>{a.ex.why}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label htmlFor="log-note" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3, color: C.ink2 }}>
            A note for future you <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              id="log-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={no ? 'What got in the way?' : PHASE_PROMPTS[a.phase] || 'How it went, what got in the way'}
              style={{
                boxSizing: 'border-box',
                padding: '14px 60px 14px 16px',
                borderRadius: 16,
                border: 0,
                background: C.card,
                fontSize: 15,
                lineHeight: 1.45,
                color: C.ink,
                width: '100%',
                resize: 'none',
                display: 'block',
              }}
            />
            <VoiceButton
              state={voice.state}
              onToggle={voice.toggle}
              label="Record a voice note"
              size={44}
              iconSize={20}
              style={{ position: 'absolute', right: 8, bottom: 8 }}
            />
          </div>
          {status && (
            <span role="status" style={{ fontSize: 13, lineHeight: 1.4, color: status.color }}>
              {status.text}
            </span>
          )}
        </div>
      </div>

      <div style={{ ...stickyBar, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => done !== null && onSubmit(done, note)}
          disabled={done === null}
          style={{ ...primaryButton, background: done === null ? C.disabledBg : C.green, color: done === null ? C.disabledFg : '#FFFFFF' }}
        >
          {yes ? 'Log it' : no ? 'Log the miss' : 'Choose one to log'}
        </button>
        {canClear && (
          <button
            onClick={onClear}
            style={{ minHeight: 44, padding: '0 16px', border: 0, background: 'transparent', color: C.ink2, fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
          >
            Clear today’s log
          </button>
        )}
      </div>
    </div>
  )
}

function ChoiceButton({ pressed, onClick, bg, fg, bd, children }: { pressed: boolean; onClick: () => void; bg: string; fg: string; bd: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      style={{
        flex: 1,
        minHeight: 88,
        borderRadius: 18,
        border: `1.5px solid ${bd}`,
        background: bg,
        color: fg,
        fontSize: 17,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}
