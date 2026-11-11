// First open: what the app is, then "Start my first experiment".
import { C, ease, primaryButton, screenRoot, serif } from '../ui.tsx'

const steps = ['Pick one thing to try.', 'Log it on the days you choose. One tap.', 'On day 65, decide: keep it or drop it.']

export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ ...screenRoot, padding: '56px 24px max(24px, env(safe-area-inset-bottom))' }}>
      <span style={{ fontSize: 18, fontWeight: 500, color: C.headA }}>
        Tanki’s <span style={{ color: C.headB }}>Experiments</span>
      </span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, animation: `riseIn 500ms ${ease} 120ms both` }}>
          <span style={{ fontSize: 136, lineHeight: 0.9, fontWeight: 500, letterSpacing: -4, color: C.green, ...serif }}>65</span>
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 1.2, textTransform: 'uppercase', color: C.greenText }}>days</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 500, lineHeight: 1.2, textWrap: 'balance', animation: `riseIn 500ms ${ease} 220ms both` }}>
          Try a habit before you commit to it.
        </h1>
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            animation: `riseIn 500ms ${ease} 320ms both`,
          }}
        >
          {steps.map((text, i) => (
            <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
              <span style={{ fontSize: 22, color: C.red, minWidth: 18, ...serif }}>{i + 1}</span>
              <span style={{ fontSize: 16, lineHeight: 1.4, textWrap: i === 1 ? 'pretty' : undefined }}>{text}</span>
            </li>
          ))}
        </ol>
      </div>
      <button onClick={onStart} style={{ ...primaryButton, padding: '0 20px' }}>
        Start my first experiment
      </button>
    </div>
  )
}
