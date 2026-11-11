// Translation between the app's shapes and the Supabase tables (supabase/migrations/0001_init.sql).
// Pure: no Supabase client, no clock.
import type { Reminder, StoredExperiment } from '../store.ts'
import type { DateKey } from './consistency.ts'
import { summarize, type DecideAnswers } from './decision.ts'

export interface ExperimentRow {
  id: string
  user_id: string
  title: string
  where_note: string | null
  why_note: string | null
  schedule_days: number[]
  tracking: 'check' | 'picture'
  start_date: DateKey
}

export interface LogRow {
  experiment_id: string
  day: DateKey
  done: boolean
  note: string | null
}

export interface DecisionRow {
  experiment_id: string
  outcome: 'keep' | 'drop'
  effort: string | null
  survive: string | null
  cost: string[] | null
  cost_note: string | null
  change: string | null
  decided_on: DateKey
}

export interface ProfileRow {
  id: string
  timezone: string
  reminder_on: boolean
  /** Postgres `time`: 'HH:MM:SS' when read back, 'HH:MM' is accepted on write. */
  reminder_time: string
}

/** What a load returns: experiments with their logs and decision embedded. */
export interface LoadedExperiment extends Omit<ExperimentRow, 'user_id'> {
  logs: Omit<LogRow, 'experiment_id'>[] | null
  /** PostgREST embeds a one-to-one table as an object, but may send an array. */
  decisions: DecisionRow | DecisionRow[] | null
}

export const DEFAULT_REMINDER: Reminder = { on: true, time: '20:00' }

const blankToNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

export function experimentToRow(ex: StoredExperiment, userId: string): ExperimentRow {
  return {
    id: ex.id,
    user_id: userId,
    title: ex.title,
    where_note: blankToNull(ex.where),
    why_note: blankToNull(ex.why),
    schedule_days: [...ex.scheduleDays],
    tracking: ex.tracking ?? 'check',
    start_date: ex.startDate,
  }
}

export function logToRow(experimentId: string, day: DateKey, done: boolean, note: string): LogRow {
  return { experiment_id: experimentId, day, done, note: blankToNull(note) }
}

export function decisionToRow(experimentId: string, outcome: 'keep' | 'drop', answers: DecideAnswers, day: DateKey): DecisionRow {
  return {
    experiment_id: experimentId,
    outcome,
    effort: answers.effort,
    survive: answers.survive,
    cost: answers.cost.length ? [...answers.cost] : null,
    cost_note: blankToNull(answers.costNote),
    change: blankToNull(answers.change),
    // Sent explicitly: the column's default is the server's date, which may not be the user's.
    decided_on: day,
  }
}

export function experimentFromRow(row: LoadedExperiment): StoredExperiment {
  const logs: StoredExperiment['logs'] = {}
  for (const l of row.logs ?? []) logs[l.day] = { done: l.done, note: l.note ?? '' }
  const d = Array.isArray(row.decisions) ? (row.decisions[0] ?? null) : row.decisions
  let decision: StoredExperiment['decision'] = null
  if (d) {
    const answers: DecideAnswers = {
      effort: d.effort,
      survive: d.survive,
      cost: d.cost ?? [],
      costNote: d.cost_note ?? '',
      change: d.change ?? '',
    }
    decision = { outcome: d.outcome, date: d.decided_on, answers, summary: summarize(answers) }
  }
  return {
    id: row.id,
    title: row.title,
    scheduleDays: [...row.schedule_days],
    startDate: row.start_date,
    where: row.where_note ?? '',
    why: row.why_note ?? '',
    tracking: row.tracking,
    logs,
    decision,
  }
}

export function reminderFromProfile(p: Pick<ProfileRow, 'reminder_on' | 'reminder_time'> | null): Reminder {
  if (!p) return DEFAULT_REMINDER
  return { on: p.reminder_on, time: p.reminder_time.slice(0, 5) }
}
