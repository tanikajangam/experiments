// Everything the user has, as one JSON file they can keep: experiments, every log, every decision.
import type { AppState } from '../store.ts'
import { TRIAL_DAYS, type DateKey } from './consistency.ts'

export interface ExportFile {
  app: 'Experiments'
  version: 1
  exportedAt: string
  reminder: AppState['reminder']
  experiments: {
    id: string
    title: string
    scheduleDays: number[]
    startDate: DateKey
    lengthDays: number
    where: string
    why: string
    tracking: string
    logs: { day: DateKey; done: boolean; note: string }[]
    decision: { outcome: 'keep' | 'drop'; date: DateKey; summary: string; answers: unknown } | null
  }[]
}

export function buildExport(state: Pick<AppState, 'experiments' | 'reminder'>, now: Date): ExportFile {
  return {
    app: 'Experiments',
    version: 1,
    exportedAt: now.toISOString(),
    reminder: state.reminder,
    experiments: state.experiments.map((ex) => ({
      id: ex.id,
      title: ex.title,
      scheduleDays: [...ex.scheduleDays],
      startDate: ex.startDate,
      lengthDays: TRIAL_DAYS,
      where: ex.where ?? '',
      why: ex.why ?? '',
      tracking: ex.tracking ?? 'check',
      logs: Object.entries(ex.logs)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([day, l]) => ({ day, done: l.done, note: l.note ?? '' })),
      decision: ex.decision
        ? { outcome: ex.decision.outcome, date: ex.decision.date, summary: ex.decision.summary ?? '', answers: ex.decision.answers ?? null }
        : null,
    })),
  }
}

export function exportFileName(today: DateKey): string {
  return `experiments-${today}.json`
}
