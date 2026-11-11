// The reminder dial behind the bell on Home (design/prototype.dc.html, `dialShown`).
import { useRef, type PointerEvent } from 'react'
import { DIAL, format12, fromMinutes, minutesAt, pointAt, ticks, toMinutes } from '../lib/dial.ts'
import { store, type Reminder } from '../store.ts'
import { BellIcon, C, haptic } from '../ui.tsx'

export type DialPhase = 'closed' | 'open' | 'closing'

export function BellDial({ phase, reminder, onToggle }: { phase: DialPhase; reminder: Reminder; onToggle: () => void }) {
  const dragging = useRef(false)
  const on = reminder.on
  const m = toMinutes(reminder.time)
  const knob = pointAt(m, DIAL.r)
  const closing = phase === 'closing'
  const dialAnim = closing
    ? 'dialShrink 300ms cubic-bezier(0.4, 0, 0.8, 0.4) both'
    : 'dialGrow 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both'
  const fadeAnim = closing ? 'dialFadeOut 160ms ease-in both' : 'dialFade 220ms ease-out 220ms both'

  const setFromPointer = (e: PointerEvent<SVGElement>) => {
    const el = e.currentTarget
    const svg = (el as SVGGraphicsElement).ownerSVGElement ?? el
    const rect = svg.getBoundingClientRect()
    const scale = rect.width / DIAL.size || 1
    const minutes = minutesAt((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale)
    const time = fromMinutes(minutes)
    const current = store.getState().reminder
    if (time !== current.time) haptic(minutes % 60 === 0 ? 'tap' : 'tick')
    store.setReminder({ on: true, time })
  }
  const down = (e: PointerEvent<SVGElement>) => {
    dragging.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setFromPointer(e)
  }
  const move = (e: PointerEvent<SVGElement>) => {
    if (dragging.current) setFromPointer(e)
  }
  const up = () => {
    dragging.current = false
  }
  const handlers = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up }

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 352,
        height: 352,
        background: C.greenDark,
        clipPath: 'circle(250px at 300px 300px)',
        animation: dialAnim,
        pointerEvents: 'auto',
        zIndex: 2,
      }}
    >
      <svg
        viewBox="0 0 352 352"
        width="352"
        height="352"
        role="img"
        aria-label="Daily reminder time. Drag along the arc: clockwise for later, counterclockwise for earlier."
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', animation: fadeAnim }}
      >
        <path d="M 74 300 A 226 226 0 0 1 300 74" fill="none" stroke={C.cream} strokeOpacity="0.25" strokeWidth="1" />
        {ticks(on).map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={C.cream}
            strokeOpacity={t.opacity}
            strokeWidth={t.width}
            strokeLinecap="round"
          />
        ))}
        <path
          d="M 74 300 A 226 226 0 0 1 300 74"
          fill="none"
          stroke="transparent"
          strokeWidth="64"
          style={{ pointerEvents: 'stroke', cursor: 'grab', touchAction: 'none' }}
          {...handlers}
        />
        <circle
          cx={knob.x}
          cy={knob.y}
          r="15"
          fill={C.cream}
          style={{ pointerEvents: 'all', cursor: 'grab', touchAction: 'none' }}
          {...handlers}
        />
        <circle cx={knob.x} cy={knob.y} r="5" fill={C.greenDark} style={{ pointerEvents: 'none' }} />
      </svg>
      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 92,
          width: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          textAlign: 'right',
          color: C.cream,
          animation: fadeAnim,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 }}>
          Daily reminder
        </span>
        <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.1 }}>{on ? format12(m) : 'Off'}</span>
        <button
          onClick={() => store.setReminder({ ...reminder, on: !on })}
          style={{
            minHeight: 32,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: C.cream,
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'underline',
            cursor: 'pointer',
            opacity: 0.85,
            pointerEvents: 'auto',
          }}
        >
          {on ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      <div style={{ position: 'absolute', right: 24, bottom: 24, height: 56, display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onToggle}
          aria-label="Close reminder"
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            borderRadius: 999,
            border: 0,
            background: C.cream,
            color: C.greenDark,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <BellIcon off={!on} />
        </button>
      </div>
    </div>
  )
}
