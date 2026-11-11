// One experiment in detail: sliding consistency, the 65-day journey, the trend, notes, the decision.
import type { CSSProperties } from 'react'
import { WINDOW, formatDay, formatDayShort, scheduleLabel, type Analysis as A } from '../lib/consistency.ts'
import { BackIcon, C, ease, eyebrow, primaryButton, roundIconButton, screenRoot, serif, stickyBar } from '../ui.tsx'
import { segmentColours } from './Home.tsx'

const card: CSSProperties = { display: 'flex', flexDirection: 'column', padding: 16, background: C.card, borderRadius: 16 }
const cardHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }

export function Analysis({ a, onBack, onLog, onDecide, onExport }: { a: A; onBack: () => void; onLog: () => void; onDecide: () => void; onExport: () => void }) {
  const n = a.resolved.length
  return (
    <div style={screenRoot}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '48px 24px 28px', flex: 1 }}>
        <button onClick={onBack} aria-label="Back to experiments" style={roundIconButton}>
          <BackIcon />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={eyebrow}>
            {scheduleLabel(a.ex.scheduleDays)} · {a.ex.where || 'anywhere'}
          </span>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 500, lineHeight: 1.15, color: C.ink, textWrap: 'balance' }}>{a.title}</h1>
          {a.ex.why && <span style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.35, color: C.ink2, ...serif }}>{a.ex.why}</span>}
        </div>

        <div style={{ ...card, gap: 14 }}>
          <div style={cardHead}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Sliding consistency</span>
            <span style={{ fontSize: 11, color: C.ink2 }}>last {WINDOW} scheduled days</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 64, fontWeight: 500, lineHeight: 0.85, letterSpacing: -1, color: C.greenText, ...serif }}>{a.pctLabel}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, textAlign: 'right' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.red }}>{a.tierName}</span>
              <span style={{ fontSize: 12, color: C.ink2, lineHeight: 1.35, textWrap: 'balance' }}>{a.heroLine}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {a.segments.map((seg, k) => (
              <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                <span
                  style={{
                    width: '100%',
                    height: 26,
                    borderRadius: 5,
                    boxSizing: 'border-box',
                    ...segmentColours(seg),
                    borderWidth: 1.5,
                    borderStyle: 'solid',
                    animation: `pop 380ms ${ease} ${180 + 45 * k}ms both`,
                  }}
                />
                <span style={{ fontSize: 10, minHeight: 14, color: C.ink2 }}>{seg.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, gap: 10 }}>
          <div style={cardHead}>
            <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1 }}>
              Day <span style={{ fontSize: 32, ...serif }}>{a.dayNum}</span>
              <span style={{ fontSize: 17, color: C.ink2, ...serif }}>/65</span>
            </span>
            <span style={{ fontSize: 12, color: C.ink2 }}>{a.journeyRight}</span>
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {a.phases.map((ph, k) => (
              <div key={ph.label} style={{ flex: ph.lastDay - ph.firstDay + 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <div style={{ height: 8, borderRadius: 4, background: C.ground, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 4,
                      background: C.green,
                      width: `${ph.fill}%`,
                      transformOrigin: '0 50%',
                      animation: `growX 600ms ${ease} ${150 + 180 * k}ms both`,
                    }}
                  />
                </div>
                <span style={{ fontSize: 10, color: ph.current ? C.ink : C.ink2, fontWeight: ph.current ? 600 : 400 }}>{ph.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, gap: 12 }}>
          <div style={cardHead}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Sliding average over time</span>
            <span style={{ fontSize: 11, color: C.ink2 }}>
              overall {a.overallPct} · {a.doneTotal}/{a.dueTotal}
            </span>
          </div>
          {a.trend.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 96, borderBottom: `1.5px solid ${C.rule}` }}>
                {a.trend.map((b, i) => (
                  <span
                    key={b.day}
                    title={`${formatDayShort(b.day)}: ${b.pct}%`}
                    style={{
                      flex: 1,
                      maxWidth: 16,
                      borderRadius: '2px 2px 0 0',
                      background: b.warmingUp ? '#A9B9A4' : C.green,
                      height: `${Math.max(4, b.pct)}%`,
                      transformOrigin: '50% 100%',
                      animation: `growY 500ms ${ease} ${Math.round(250 + (600 * i) / Math.max(1, n))}ms both`,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: C.ink2 }}>{formatDayShort(a.trend[0].day)}</span>
                <span style={{ fontSize: 10, color: C.ink2 }}>{formatDayShort(a.trend[a.trend.length - 1].day)}</span>
              </div>
              <span style={{ fontSize: 12, color: C.ink2, lineHeight: 1.4 }}>
                Each bar is your last {WINDOW} scheduled days as of that day. Paler bars had fewer than {WINDOW} to go on.
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: C.ink2 }}>No scheduled days have passed yet.</span>
          )}
        </div>

        {a.notes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Notes</span>
            {a.notes.map((note) => (
              <div key={note.day} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 14px', background: C.card, borderRadius: 14 }}>
                <span style={{ fontSize: 11, color: C.ink2 }}>
                  {formatDay(note.day)} · {note.result}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.4 }}>{note.text}</span>
              </div>
            ))}
          </div>
        )}

        {a.decided && (
          <div style={{ ...card, gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: a.ex.decision?.outcome === 'keep' ? C.greenText : C.red }}>{a.decisionLine}</span>
            <span style={{ fontSize: 13, lineHeight: 1.4 }}>{a.decisionText}</span>
          </div>
        )}

        {/* Not in the prototype (step 8, see CLAUDE.md): a copy of everything, as a file to keep. */}
        <button
          type="button"
          onClick={onExport}
          style={{ alignSelf: 'center', minHeight: 44, padding: '0 20px', borderRadius: 999, border: `1.5px solid ${C.rule}`, background: 'transparent', color: C.ink2, fontSize: 14, cursor: 'pointer' }}
        >
          Export all my data
        </button>
      </div>

      {a.dueNow && (
        <div style={stickyBar}>
          <button onClick={onLog} style={primaryButton}>
            Log today
          </button>
        </div>
      )}
      {a.canEdit && (
        <div style={{ ...stickyBar, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 14, color: C.greenText, fontWeight: 500 }}>Logged today: {a.todayResult}</span>
          <button
            onClick={onLog}
            style={{ minHeight: 44, padding: '0 20px', borderRadius: 999, border: `1.5px solid ${C.rule}`, background: C.card, color: C.ink, fontSize: 14, cursor: 'pointer' }}
          >
            Edit
          </button>
        </div>
      )}
      {a.readyToDecide && (
        <div style={stickyBar}>
          <button onClick={onDecide} style={primaryButton}>
            Decide: keep it or drop it
          </button>
        </div>
      )}
    </div>
  )
}
