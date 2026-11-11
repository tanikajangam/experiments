// Day 65 logged yes: the celebration.
import type { Analysis } from '../lib/consistency.ts'
import { C, CloseIcon, ease, serif } from '../ui.tsx'

export function Celebrate({ a, onClose, onReflect }: { a: Analysis; onClose: () => void; onReflect: () => void }) {
  const n = a.resolved.length
  const ring = a.resolved.map((o, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, n)
    return {
      x: Math.round(150 + 138 * Math.cos(angle) - 4.5),
      y: Math.round(150 + 138 * Math.sin(angle) - 4.5),
      bg: o.status === 'done' ? C.cream : 'transparent',
      delay: Math.round(150 + (850 * i) / Math.max(1, n)),
    }
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        boxSizing: 'border-box',
        background: C.green,
        color: C.cream,
        padding: '24px 24px max(32px, env(safe-area-inset-bottom))',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ width: 44, height: 44, borderRadius: 999, border: 0, background: 'rgba(243, 240, 233, 0.14)', color: C.cream, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <CloseIcon />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <div style={{ position: 'relative', width: 300, height: 300 }}>
          {ring.map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                width: 9,
                height: 9,
                borderRadius: 999,
                boxSizing: 'border-box',
                left: d.x,
                top: d.y,
                background: d.bg,
                border: `1.5px solid ${C.cream}`,
                animation: `pop 300ms ${ease} ${d.delay}ms both`,
              }}
            />
          ))}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <span style={{ fontSize: 112, fontWeight: 500, lineHeight: 1, letterSpacing: -3, ...serif, animation: `bigPop 600ms ${ease} 1000ms both` }}>65</span>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85, animation: 'riseIn 400ms ease-out 1250ms both' }}>
              days
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', animation: `riseIn 500ms ${ease} 1450ms both` }}>
          <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>You actually did it.</span>
          <span style={{ fontSize: 16, lineHeight: 1.4, opacity: 0.9, textWrap: 'balance' }}>
            65 days of {a.title}. You showed up on {a.doneTotal}/{a.dueTotal} scheduled days, {a.best} in a row at your best.
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onReflect}
          style={{
            minHeight: 56,
            padding: '0 36px',
            borderRadius: 999,
            border: 0,
            background: C.cream,
            color: C.greenText,
            fontSize: 18,
            fontWeight: 500,
            animation: 'riseIn 400ms ease-out 1750ms both, breathe 2400ms ease-in-out 2400ms infinite',
            cursor: 'pointer',
          }}
        >
          Reflect on it
        </button>
        <button
          onClick={onClose}
          style={{ minHeight: 44, padding: '0 16px', border: 0, background: 'transparent', color: C.cream, fontSize: 14, cursor: 'pointer', opacity: 0.85 }}
        >
          Later
        </button>
      </div>
    </div>
  )
}
