// After the first experiment: pick when the daily reminder comes.
import { store, useStore } from '../store.ts'
import { chip, eyebrow, haptic, primaryButton, screenRoot, serif, C } from '../ui.tsx'

const CHOICES: [label: string, time: string | null, shown: string][] = [
  ['Morning', '08:00', '8:00 am'],
  ['Midday', '12:30', '12:30 pm'],
  ['Evening', '20:00', '8:00 pm'],
  ['No reminder', null, 'Off'],
]

export function Setup({ title, onFinish }: { title: string; onFinish: () => void }) {
  const { reminder } = useStore()
  return (
    <div style={{ ...screenRoot, padding: '56px 24px max(24px, env(safe-area-inset-bottom))', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 48 }}>
        <span style={eyebrow}>Day 1/65 · {title}</span>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1.2, textWrap: 'balance' }}>When should I nudge you to log?</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: C.ink2 }}>One reminder a day, and only if something is left to log.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, paddingTop: 8 }}>
          {CHOICES.map(([label, time, shown]) => {
            const on = time === null ? !reminder.on : reminder.on && reminder.time === time
            const c = chip(on)
            return (
              <button
                key={label}
                aria-pressed={on}
                onClick={() => {
                  haptic('tick')
                  store.setReminder(time === null ? { on: false, time: reminder.time } : { on: true, time })
                }}
                style={{
                  minHeight: 84,
                  padding: '12px 14px',
                  borderRadius: 16,
                  border: `1.5px solid ${c.borderColor}`,
                  background: c.background,
                  color: c.color,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  gap: 4,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 22, lineHeight: 1.1, ...serif }}>{shown}</span>
              </button>
            )
          })}
        </div>
      </div>
      <span style={{ fontSize: 12, color: C.ink2, textAlign: 'center' }}>Change it any time from the bell on Home.</span>
      <button
        onClick={() => {
          haptic('tap')
          onFinish()
        }}
        style={{ ...primaryButton, padding: '0 20px' }}
      >
        See my experiment
      </button>
    </div>
  )
}
