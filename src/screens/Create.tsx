// New experiment form.
import { useState, type CSSProperties } from 'react'
import { weeklyStarts, type DateKey, type Weekday } from '../lib/consistency.ts'
import { store, useStore } from '../store.ts'
import { BackIcon, C, chip, haptic, primaryButton, roundIconButton, screenRoot, stickyBar } from '../ui.tsx'
import { VoiceButton, useVoice, voiceStatus } from '../voice.tsx'

const TYPES: [string, Weekday[]][] = [
  ['Every day', [0, 1, 2, 3, 4, 5, 6]],
  ['Weekdays', [1, 2, 3, 4, 5]],
  ['Weekends', [0, 6]],
]
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]
const SUGGESTIONS = ['Eat 3 meals a day', 'Stretch before bed', 'Wake up at 5:30']

const sameDays = (a: Weekday[], b: Weekday[]) => [...a].sort().join(',') === [...b].sort().join(',')

const label: CSSProperties = { fontSize: 14, fontWeight: 500 }
const field: CSSProperties = {
  minHeight: 46,
  boxSizing: 'border-box',
  padding: '0 14px',
  borderRadius: 12,
  border: `1.5px solid ${C.rule}`,
  background: C.card,
  fontSize: 15,
  color: C.ink,
  width: '100%',
}
const pill = (on: boolean): CSSProperties => {
  const c = chip(on)
  return {
    minHeight: 36,
    padding: '0 6px',
    borderRadius: 999,
    border: `1.5px solid ${c.borderColor}`,
    background: c.background,
    color: c.color,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

export function Create({ today, onBack, onCreated }: { today: DateKey; onBack: () => void; onCreated: (id: string) => void }) {
  const { experiments, firstRun } = useStore()
  const [title, setTitle] = useState('')
  const [days, setDays] = useState<Weekday[]>([0, 1, 2, 3, 4, 5, 6])
  const [where, setWhere] = useState('')
  const [why, setWhy] = useState('')

  // Voice fills only what was said; everything stays editable before Start experiment.
  const voice = useVoice('create', (f) => {
    if (f.title) setTitle(f.title)
    if (f.schedule_days) setDays(f.schedule_days)
    if (f.where) setWhere(f.where)
    if (f.why) setWhy(f.why)
  })
  const status = voiceStatus(voice.state)

  const limit = weeklyStarts(experiments, today)
  const valid = title.trim().length > 0 && days.length > 0 && !limit.limitReached

  const start = () => {
    if (!valid) return
    const id = store.createExperiment({ title, days, where, why, tracking: 'check' }, today)
    if (!id) return
    haptic('tap')
    onCreated(id)
  }

  return (
    <div style={screenRoot}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '48px 24px 24px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} aria-label="Back" style={roundIconButton}>
            <BackIcon />
          </button>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, lineHeight: 1.2, color: C.headA }}>
            <span>{firstRun ? 'Your first' : 'New'}</span>
            <span style={{ color: C.headB, marginLeft: '0.28em' }}>{firstRun ? 'experiment' : 'Experiment'}</span>
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="exp-title" style={label}>
            Experiment title
          </label>
          <input id="exp-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eat 3 meals a day" style={field} />
          {firstRun && title.trim().length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setTitle(s)}
                  style={{ minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1.5px dashed #A9A295', background: 'transparent', color: C.ink, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>When?</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {TYPES.map(([name, set]) => {
              const on = sameDays(days, set)
              return (
                <button key={name} aria-pressed={on} onClick={() => setDays([...set])} style={pill(on)}>
                  {name}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            {DAY_LABELS.map((l, i) => {
              const dow = DAY_IDX[i]
              const on = days.includes(dow)
              const c = chip(on)
              return (
                <button
                  key={i}
                  aria-pressed={on}
                  aria-label={DAY_FULL[i]}
                  onClick={() => setDays((cur) => (cur.includes(dow) ? cur.filter((x) => x !== dow) : [...cur, dow]))}
                  style={{ width: 36, height: 36, borderRadius: 999, border: `1.5px solid ${c.borderColor}`, background: c.background, color: c.color, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  {l}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="exp-where" style={label}>
            Where?
          </label>
          <input id="exp-where" type="text" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="At work, home, or with my bf" style={field} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="exp-why" style={label}>
            Why?
          </label>
          <textarea
            id="exp-why"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            rows={2}
            placeholder="What you hope changes by the end"
            style={{ ...field, minHeight: undefined, padding: '12px 14px', lineHeight: 1.4, resize: 'none', display: 'block' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={label}>How are you tracking it?</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <button aria-pressed={true} style={pill(true)}>
              Check-in
            </button>
            {['Picture · soon', 'Metric · soon'].map((l) => (
              <button key={l} aria-pressed={false} disabled style={{ ...pill(false), background: 'transparent', color: C.ink2, borderColor: C.rule }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...stickyBar, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span role="status" style={{ fontSize: 12, color: status ? status.color : limit.limitReached ? C.red : C.ink2, textAlign: 'center' }}>
          {status ? status.text : limit.line}
        </span>
        {/* Differs from the prototype on purpose: the mic sits in the bottom bar, under the thumb (see CLAUDE.md). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <button
            onClick={start}
            disabled={!valid}
            style={{ ...primaryButton, width: 'auto', flex: 1, background: valid ? C.green : C.disabledBg, color: valid ? '#FFFFFF' : C.disabledFg }}
          >
            Start experiment
          </button>
          <VoiceButton state={voice.state} onToggle={voice.toggle} label="Describe your experiment by voice" size={56} />
        </div>
      </div>
    </div>
  )
}
