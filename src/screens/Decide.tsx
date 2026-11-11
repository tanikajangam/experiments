// Day 65: four questions, then keep it or drop it. Tracking stops either way.
import { useState, type CSSProperties } from 'react'
import type { Analysis } from '../lib/consistency.ts'
import type { DecideAnswers } from '../lib/decision.ts'
import { BackIcon, C, MicIcon, chip, roundIconButton, screenRoot, stickyBar } from '../ui.tsx'

const EFFORT = ['Never', 'Near the end', 'Around the middle', 'Early on']
const SURVIVE = ['Yes', 'Probably', 'Doubt it', 'No']
const COST = ['Not much', 'Time', 'Energy', 'Social life']

const card: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: C.card, borderRadius: 16 }
const question: CSSProperties = { fontSize: 15, fontWeight: 500, lineHeight: 1.3 }
const chipStyle = (on: boolean, pad: number): CSSProperties => {
  const c = chip(on)
  return {
    minHeight: 40,
    padding: `0 ${pad}px`,
    borderRadius: 999,
    border: `1.5px solid ${c.borderColor}`,
    background: c.background,
    color: c.color,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}
const grid = (cols: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 })

interface Props {
  a: Analysis
  initial: DecideAnswers
  onBack: () => void
  onDecide: (outcome: 'keep' | 'drop', answers: DecideAnswers) => void
}

export function Decide({ a, initial, onBack, onDecide }: Props) {
  const [d, setD] = useState<DecideAnswers>(initial)
  const patch = (p: Partial<DecideAnswers>) => setD((cur) => ({ ...cur, ...p }))
  const toggleCost = (l: string) =>
    setD((cur) => {
      const on = cur.cost.includes(l)
      return {
        ...cur,
        cost: on ? cur.cost.filter((x) => x !== l) : l === 'Not much' ? ['Not much'] : [...cur.cost.filter((x) => x !== 'Not much'), l],
      }
    })

  return (
    <div style={screenRoot}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '24px 24px 22px', background: C.green, color: C.cream }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onBack} aria-label="Back to experiments" style={{ ...roundIconButton, color: C.cream }}>
            <BackIcon />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Day 65</span>
        </div>
        <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.2 }}>{a.title}</span>
        <span style={{ fontSize: 13, opacity: 0.9 }}>
          {a.overallPct} done · {a.doneTotal}/{a.dueTotal} scheduled days · best streak {a.best}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: C.card, borderRadius: 16 }}>
          <button
            aria-label="Answer all four by voice"
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 999, border: 0, background: C.green, color: C.cream, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <MicIcon />
          </button>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: C.ink }}>Say it in one go. Your answer gets sorted into the four questions below.</span>
        </div>

        <div style={card}>
          <span style={question}>When did it stop feeling like effort?</span>
          <div style={grid(2)}>
            {EFFORT.map((l) => (
              <button key={l} aria-pressed={d.effort === l} onClick={() => patch({ effort: l })} style={chipStyle(d.effort === l, 8)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <span style={question}>Will it survive without the tracking?</span>
          <div style={grid(4)}>
            {SURVIVE.map((l) => (
              <button key={l} aria-pressed={d.survive === l} onClick={() => patch({ survive: l })} style={chipStyle(d.survive === l, 4)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <span style={question}>What did it cost you?</span>
          <div style={grid(2)}>
            {COST.map((l) => (
              <button key={l} aria-pressed={d.cost.includes(l)} onClick={() => toggleCost(l)} style={chipStyle(d.cost.includes(l), 8)}>
                {l}
              </button>
            ))}
          </div>
          <input
            type="text"
            aria-label="More on what it cost"
            value={d.costNote}
            onChange={(e) => patch({ costNote: e.target.value })}
            placeholder="Anything else it cost? (optional)"
            style={{ minHeight: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 12, border: `1.5px solid ${C.rule}`, background: C.cream, fontSize: 14, color: C.ink, width: '100%' }}
          />
        </div>

        <div style={card}>
          <label htmlFor="decide-change" style={question}>
            What did it quietly change?
          </label>
          <textarea
            id="decide-change"
            value={d.change}
            onChange={(e) => patch({ change: e.target.value })}
            rows={2}
            placeholder="The thing you’d tell a friend"
            style={{ boxSizing: 'border-box', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${C.rule}`, background: C.cream, fontSize: 14, lineHeight: 1.4, color: C.ink, width: '100%', resize: 'none', display: 'block' }}
          />
        </div>
      </div>

      <div style={{ ...stickyBar, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: C.ink2, textAlign: 'center' }}>Either way, tracking stops here.</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => onDecide('drop', d)}
            style={{ flex: 1, minHeight: 56, borderRadius: 999, border: `1.5px solid ${C.red}`, background: 'transparent', color: C.red, fontSize: 17, fontWeight: 500, cursor: 'pointer' }}
          >
            Drop it
          </button>
          <button
            onClick={() => onDecide('keep', d)}
            style={{ flex: 1, minHeight: 56, borderRadius: 999, border: 0, background: C.green, color: '#FFFFFF', fontSize: 17, fontWeight: 500, cursor: 'pointer' }}
          >
            Keep it
          </button>
        </div>
      </div>
    </div>
  )
}
