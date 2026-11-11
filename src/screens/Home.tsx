// Home: Ready to decide, Today, the four tiers, Decided, and the New Experiment bar with the bell.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { TIERS, analyze, formatDayLong, type Analysis, type DateKey, type Segment } from '../lib/consistency.ts'
import { format12, toMinutes } from '../lib/dial.ts'
import { useStore } from '../store.ts'
import { BellIcon, C, CheckIcon, CrossIcon, PlusIcon, ease, eyebrow, haptic, screenRoot, sectionHeading, serif } from '../ui.tsx'
import { BellDial, type DialPhase } from './BellDial.tsx'

const EMPTY_LINES: Record<string, string> = {
  new: 'Nothing new brewing. Room for a fresh experiment.',
  inconsistent: 'Nothing wobbling. Suspiciously steady.',
  semi: 'Nothing halfway there. Yet.',
  mature: 'Nothing on autopilot yet. Give it a few weeks.',
}

export function segmentColours(seg: Segment): { background: string; borderColor: string } {
  switch (seg.kind) {
    case 'done':
      return { background: C.green, borderColor: C.green }
    case 'missed':
      return { background: C.miss, borderColor: C.miss }
    case 'today':
      return { background: 'transparent', borderColor: C.green }
    default:
      return { background: 'transparent', borderColor: '#A9A295' }
  }
}

interface Props {
  today: DateKey
  flash: { id: string; text: string } | null
  dialStartsOpen?: boolean
  onOpen: (id: string) => void
  onQuickYes: (id: string) => void
  onNo: (id: string) => void
  onEdit: (id: string) => void
  onDecide: (id: string) => void
  onCreate: () => void
}

const headerRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }
const headerNote: CSSProperties = { fontSize: 11, color: C.ink2, textAlign: 'right' }
const emptyLine: CSSProperties = { margin: 0, fontSize: 16, fontStyle: 'italic', color: C.ink2, padding: '2px 0', ...serif }
const section: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10 }

export function Home({ today, flash, dialStartsOpen, onOpen, onQuickYes, onNo, onEdit, onDecide, onCreate }: Props) {
  const { experiments, reminder } = useStore()
  const analyzed = experiments.map((ex) => analyze(ex, today))

  const [dial, setDial] = useState<DialPhase>(dialStartsOpen ? 'open' : 'closed')
  const dialTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(dialTimer.current), [])
  const toggleDial = () => {
    if (dial === 'open') {
      setDial('closing')
      window.clearTimeout(dialTimer.current)
      dialTimer.current = window.setTimeout(() => setDial((p) => (p === 'closing' ? 'closed' : p)), 320)
    } else if (dial === 'closed') {
      haptic('open')
      setDial('open')
    }
  }

  const ready = analyzed.filter((a) => a.readyToDecide)
  const decided = analyzed.filter((a) => a.decided)
  const todayList = analyzed.filter((a) => a.dueToday && !a.complete)
  const loggedCount = todayList.filter((a) => a.loggedToday).length
  const todayNote =
    todayList.length === 0 ? 'Nothing scheduled today.' : loggedCount === todayList.length ? 'All logged. Go live your life.' : ''
  const bellLabel = reminder.on ? `Daily reminder, ${format12(toMinutes(reminder.time))}` : 'Daily reminder, off'

  return (
    <div style={{ ...screenRoot, position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '52px 24px 24px', flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={eyebrow}>{formatDayLong(today)}</span>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 500, lineHeight: 1.2, color: C.headA }}>
            Tanki’s <span style={{ color: C.headB }}>Experiments</span>
          </h1>
        </div>

        {ready.length > 0 && (
          <section style={section}>
            <div style={headerRow}>
              <h2 style={sectionHeading}>Ready to decide</h2>
              <span style={headerNote}>65 days done</span>
            </div>
            {ready.map((a) => (
              <article
                key={a.ex.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  background: C.card,
                  borderRadius: 16,
                  border: `1.5px solid ${C.green}`,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <button
                    onClick={() => onOpen(a.ex.id)}
                    style={{ minHeight: 32, textAlign: 'left', border: 0, background: 'transparent', padding: 0, fontSize: 15, fontWeight: 500, color: C.ink, cursor: 'pointer' }}
                  >
                    {a.title}
                  </button>
                  <span style={{ fontSize: 12, color: C.ink2 }}>
                    {a.overallPct} done · {a.doneTotal}/{a.dueTotal} scheduled days
                  </span>
                </div>
                <button
                  onClick={() => onDecide(a.ex.id)}
                  style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 0, background: C.green, color: '#FFFFFF', fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Decide
                </button>
              </article>
            ))}
          </section>
        )}

        <section style={section}>
          <div style={headerRow}>
            <h2 style={sectionHeading}>Today</h2>
            <span style={headerNote}>{todayList.length ? `${loggedCount}/${todayList.length} logged` : ''}</span>
          </div>
          {todayNote && <p style={emptyLine}>{todayNote}</p>}
          {todayList.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', background: C.card, borderRadius: 16, overflow: 'hidden' }}>
              {todayList.map((a, i) => (
                <TodayRow
                  key={a.ex.id}
                  a={a}
                  today={today}
                  first={i === 0}
                  delta={flash && flash.id === a.ex.id ? flash.text : a.standingText}
                  onOpen={onOpen}
                  onYes={onQuickYes}
                  onNo={onNo}
                  onEdit={onEdit}
                />
              ))}
            </div>
          )}
        </section>

        {TIERS.map((t, k) => {
          const items = analyzed.filter((a) => a.tier === t.id && !a.complete)
          return (
            <section key={t.id} style={section}>
              <div style={headerRow}>
                <h2 style={sectionHeading}>{t.name}</h2>
                <span style={headerNote}>{t.rule}</span>
              </div>
              {items.length === 0 ? (
                <p style={emptyLine}>{EMPTY_LINES[t.id]}</p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: C.card,
                    borderRadius: 16,
                    overflow: 'hidden',
                    animation: `riseIn 420ms ${ease} ${120 + 70 * k}ms both`,
                  }}
                >
                  {items.map((a, i) => (
                    <button
                      key={a.ex.id}
                      onClick={() => onOpen(a.ex.id)}
                      aria-label={`${a.title}, ${a.standingText}, ${a.dayLine}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px 14px',
                        border: 0,
                        borderTop: i ? `1px solid ${C.ground}` : 0,
                        background: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.title}
                        </span>
                        <span style={{ fontSize: 12, color: C.ink2, whiteSpace: 'nowrap' }}>{a.dayLine}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ display: 'flex', gap: 3, flex: 1 }}>
                          {a.segments.map((seg, j) => (
                            <span
                              key={j}
                              style={{
                                flex: 1,
                                height: 12,
                                borderRadius: 3,
                                boxSizing: 'border-box',
                                ...segmentColours(seg),
                                borderWidth: 1.5,
                                borderStyle: 'solid',
                                transformOrigin: '50% 100%',
                                animation: `growY 360ms ${ease} ${180 + 45 * j}ms both`,
                              }}
                            />
                          ))}
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 500, color: C.greenText, minWidth: 40, textAlign: 'right', ...serif }}>
                          {a.pctLabel}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}

        {decided.length > 0 && (
          <section style={section}>
            <h2 style={{ ...sectionHeading, color: C.ink2 }}>Decided</h2>
            {decided.map((a) => (
              <div
                key={a.ex.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 14, border: `1.5px solid ${C.rule}` }}
              >
                <button
                  onClick={() => onOpen(a.ex.id)}
                  style={{ minHeight: 44, textAlign: 'left', border: 0, background: 'transparent', padding: 0, fontSize: 14, color: C.ink, cursor: 'pointer' }}
                >
                  {a.title}
                </button>
                <span style={{ fontSize: 12, fontWeight: 500, color: a.ex.decision?.outcome === 'keep' ? C.greenText : C.red }}>
                  {a.decisionLine}
                </span>
              </div>
            ))}
          </section>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '12px 24px max(24px, env(safe-area-inset-bottom))', background: C.ground }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <button
            onClick={onCreate}
            style={{
              flex: 1,
              minHeight: 56,
              padding: '0 20px',
              borderRadius: 999,
              border: 0,
              background: C.green,
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <PlusIcon />
            New Experiment
          </button>
          <button
            onClick={toggleDial}
            aria-label={bellLabel}
            aria-expanded={dial === 'open'}
            style={{
              width: 56,
              height: 56,
              flexShrink: 0,
              borderRadius: 999,
              border: 0,
              background: C.green,
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BellIcon off={!reminder.on} />
          </button>
        </div>
        {dial !== 'closed' && <BellDial phase={dial} reminder={reminder} onToggle={toggleDial} />}
      </div>
    </div>
  )
}

function TodayRow({
  a,
  today,
  first,
  delta,
  onOpen,
  onYes,
  onNo,
  onEdit,
}: {
  a: Analysis
  today: DateKey
  first: boolean
  delta: string
  onOpen: (id: string) => void
  onYes: (id: string) => void
  onNo: (id: string) => void
  onEdit: (id: string) => void
}) {
  const logged = a.loggedToday
  const didIt = logged && a.ex.logs[today].done
  const sub = logged ? a.dayLine : `${a.finalDay ? 'Final day' : a.dayLine} · ${a.standingText}`
  const id = a.ex.id
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 14px', borderTop: first ? 0 : `1px solid ${C.ground}` }}>
      <button
        onClick={() => onOpen(id)}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          textAlign: 'left',
          border: 0,
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
          {a.title}
        </span>
        <span style={{ fontSize: 12, color: a.finalDay && !logged ? C.red : C.ink2 }}>{sub}</span>
      </button>
      {!logged ? (
        <>
          <button
            onClick={() => onNo(id)}
            aria-label={`Not today: ${a.title}`}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 999,
              border: `1.5px solid ${C.rule}`,
              background: 'transparent',
              color: C.ink2,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CrossIcon />
          </button>
          <button
            onClick={() => onYes(id)}
            aria-label={`Done today: ${a.title}`}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 999,
              border: 0,
              background: C.green,
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon />
          </button>
        </>
      ) : (
        <button
          onClick={() => onEdit(id)}
          aria-label={`Edit today’s log: ${a.title}`}
          style={{
            minHeight: 44,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 1,
            border: 0,
            background: 'transparent',
            padding: '0 2px',
            cursor: 'pointer',
            animation: 'badgeIn 280ms ease-out both',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: didIt ? C.greenText : C.red }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path
                d={didIt ? 'M20 6 9 17l-5-5' : 'M18 6 6 18M6 6l12 12'}
                style={{ strokeDasharray: 24, animation: 'drawCheck 420ms cubic-bezier(0.6, 0, 0.2, 1) 120ms both' }}
              />
            </svg>
            {didIt ? 'Done' : 'Missed'}
          </span>
          <span style={{ fontSize: 13, color: C.ink2, ...serif }}>{delta}</span>
        </button>
      )}
    </div>
  )
}
