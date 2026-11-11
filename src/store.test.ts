import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, analyze } from './lib/consistency.ts'
import { seed } from './lib/seed.ts'
import { store } from './store.ts'

const TODAY = '2026-11-10'
const exp = (id: string) => store.getState().experiments.find((e) => e.id === id)!

beforeEach(() => {
  store.reset({ experiments: seed(TODAY), firstRun: false })
})

describe('store: logging', () => {
  it('a one-tap yes logs today and returns the Home row text', () => {
    expect(store.writeLog('meals', true, '', TODAY)).toEqual({ flash: '1/7 → 2/7', celebrate: false })
    expect(exp('meals').logs[TODAY]).toEqual({ done: true, note: '' })
  })

  it('logging a miss on Wear retainer moves it from 43% to 29%', () => {
    expect(store.writeLog('retainer', false, 'Forgot', TODAY)?.flash).toBe('43% → 29%')
  })

  it('no backfill: only today can be logged, so a past missed day stays missed', () => {
    const yesterday = addDays(TODAY, -1)
    const before = exp('retainer').logs[yesterday]
    expect(before.done).toBe(false)
    store.writeLog('retainer', true, '', TODAY)
    expect(exp('retainer').logs[yesterday]).toEqual(before)
    expect(analyze(exp('retainer'), TODAY).resolved.find((o) => o.day === yesterday)?.status).toBe('missed')
  })

  it('nothing is written on a day that is not scheduled', () => {
    // Gym is Mon/Wed/Thu; 10 Nov 2026 is a Tuesday.
    expect(store.writeLog('gym', true, '', TODAY)).toBeNull()
    expect(exp('gym').logs[TODAY]).toBeUndefined()
  })

  it('logging yes on day 65 opens the celebration; logging no does not', () => {
    expect(store.writeLog('stretch', false, '', TODAY)?.celebrate).toBe(false)
    store.clearLog('stretch', TODAY) // no effect: a log on day 65 ends the trial
    store.reset({ experiments: seed(TODAY) })
    expect(store.writeLog('stretch', true, '', TODAY)?.celebrate).toBe(true)
  })

  it('after the trial ends, tracking stops: no more logs and no clearing', () => {
    store.writeLog('stretch', true, '', TODAY)
    expect(store.writeLog('stretch', false, '', TODAY)).toBeNull()
    store.clearLog('stretch', TODAY)
    expect(exp('stretch').logs[TODAY]).toEqual({ done: true, note: '' })
  })

  it('clearing today’s log makes today pending again', () => {
    store.writeLog('meals', false, '', TODAY)
    store.clearLog('meals', TODAY)
    expect(exp('meals').logs[TODAY]).toBeUndefined()
    expect(analyze(exp('meals'), TODAY).dueNow).toBe(true)
  })
})

describe('store: starting experiments', () => {
  const form = { title: 'Read 10 pages', days: [1, 3, 5], where: '', why: '', tracking: 'check' as const }

  it('a new experiment starts today, on day 1', () => {
    const id = store.createExperiment(form, TODAY)!
    expect(exp(id).startDate).toBe(TODAY)
    expect(analyze(exp(id), TODAY).dayNum).toBe(1)
  })

  it('at most 3 new experiments can start in one calendar week', () => {
    // The seed's Eat 3 meals started this week (Mon 9 Nov), so two more fit.
    expect(store.createExperiment(form, TODAY)).not.toBeNull()
    expect(store.createExperiment(form, TODAY)).not.toBeNull()
    expect(store.createExperiment(form, TODAY)).toBeNull()
    // Next Monday is a new week.
    expect(store.createExperiment(form, '2026-11-16')).not.toBeNull()
  })

  it('needs a title and at least one day', () => {
    expect(store.createExperiment({ ...form, title: '  ' }, TODAY)).toBeNull()
    expect(store.createExperiment({ ...form, days: [] }, TODAY)).toBeNull()
  })
})

describe('store: deciding', () => {
  const answers = { effort: 'Around the middle', survive: 'Yes', cost: ['Energy'], costNote: '', change: '' }

  it('a decision can only be made once the trial is complete', () => {
    store.decide('stretch', 'keep', answers, '', TODAY)
    expect(exp('stretch').decision).toBeUndefined()
    store.writeLog('stretch', true, '', TODAY)
    store.decide('stretch', 'keep', answers, 'summary', TODAY)
    expect(exp('stretch').decision).toMatchObject({ outcome: 'keep', date: TODAY, summary: 'summary' })
  })
})
