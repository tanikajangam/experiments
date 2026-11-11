import { describe, expect, it } from 'vitest'
import { classify } from './backend.ts'
import { BLANK_ANSWERS } from './decision.ts'
import { decisionToRow, experimentFromRow, experimentToRow, logToRow, reminderFromProfile, type LoadedExperiment } from './rows.ts'

const loaded: LoadedExperiment = {
  id: 'e1',
  title: 'Gym session',
  where_note: null,
  why_note: 'Feel stronger',
  schedule_days: [1, 3, 4],
  tracking: 'check',
  start_date: '2026-10-03',
  logs: [
    { day: '2026-11-09', done: true, note: null },
    { day: '2026-11-05', done: false, note: 'Sick' },
  ],
  decisions: null,
}

describe('rows: experiments and logs', () => {
  it('reads an experiment with its logs keyed by day', () => {
    const ex = experimentFromRow(loaded)
    expect(ex).toMatchObject({ id: 'e1', title: 'Gym session', scheduleDays: [1, 3, 4], startDate: '2026-10-03', where: '', why: 'Feel stronger' })
    expect(ex.logs).toEqual({ '2026-11-09': { done: true, note: '' }, '2026-11-05': { done: false, note: 'Sick' } })
    expect(ex.decision).toBeNull()
  })

  it('writes an experiment with its owner and blank notes as null', () => {
    const row = experimentToRow(experimentFromRow(loaded), 'u1')
    expect(row).toEqual({
      id: 'e1',
      user_id: 'u1',
      title: 'Gym session',
      where_note: null,
      why_note: 'Feel stronger',
      schedule_days: [1, 3, 4],
      tracking: 'check',
      start_date: '2026-10-03',
    })
  })

  it('a log is a plain date, never a timestamp', () => {
    expect(logToRow('e1', '2026-11-10', true, '  ')).toEqual({ experiment_id: 'e1', day: '2026-11-10', done: true, note: null })
  })
})

describe('rows: decisions', () => {
  const answers = { effort: 'Early on', survive: 'Yes', cost: ['Time'], costNote: '', change: 'More energy' }

  it('sends the user’s own day as decided_on, not the server’s', () => {
    expect(decisionToRow('e1', 'keep', answers, '2026-11-10')).toEqual({
      experiment_id: 'e1',
      outcome: 'keep',
      effort: 'Early on',
      survive: 'Yes',
      cost: ['Time'],
      cost_note: null,
      change: 'More energy',
      decided_on: '2026-11-10',
    })
  })

  it('reads a decision back with its summary, whether embedded as an object or an array', () => {
    const row = decisionToRow('e1', 'drop', answers, '2026-11-10')
    for (const decisions of [row, [row]]) {
      const ex = experimentFromRow({ ...loaded, decisions })
      expect(ex.decision).toMatchObject({ outcome: 'drop', date: '2026-11-10', answers })
      expect(ex.decision?.summary).toBe('Stopped feeling like effort: early on · Survives without tracking: yes · Cost: time · Changed: More energy')
    }
  })

  it('a decision with no answers reads back as blank answers', () => {
    const ex = experimentFromRow({ ...loaded, decisions: decisionToRow('e1', 'keep', BLANK_ANSWERS, '2026-11-10') })
    expect(ex.decision?.answers).toEqual(BLANK_ANSWERS)
    expect(ex.decision?.summary).toBe('')
  })
})

describe('rows: reminder', () => {
  it('reads Postgres time as HH:MM, and defaults to 8 pm with no profile', () => {
    expect(reminderFromProfile({ reminder_on: false, reminder_time: '08:00:00' })).toEqual({ on: false, time: '08:00' })
    expect(reminderFromProfile(null)).toEqual({ on: true, time: '20:00' })
  })
})

describe('sync: which failed writes are retried', () => {
  it('retries network failures, expired tokens and server errors; drops other rejections', () => {
    expect(classify(201, false)).toBe('ok')
    for (const s of [0, 401, 408, 429, 500, 503]) expect(classify(s, true)).toBe('retry')
    for (const s of [400, 403, 404, 409]) expect(classify(s, true)).toBe('drop')
  })
})
