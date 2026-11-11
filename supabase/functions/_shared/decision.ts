// The day-65 questions, their answers, and the one-line summary shown under "Decided".
// Pure and shared with the Edge Functions (see scripts/copy-shared.mjs).

/** The chip labels. The voice schema and the server's clean-up use these same lists. */
export const EFFORT = ['Never', 'Near the end', 'Around the middle', 'Early on'] as const
export const SURVIVE = ['Yes', 'Probably', 'Doubt it', 'No'] as const
export const COST = ['Not much', 'Time', 'Energy', 'Social life'] as const

export interface DecideAnswers {
  effort: string | null
  survive: string | null
  cost: string[]
  costNote: string
  change: string
}

export const BLANK_ANSWERS: DecideAnswers = { effort: null, survive: null, cost: [], costNote: '', change: '' }

/** The one-line summary saved with the decision. */
export function summarize(d: DecideAnswers): string {
  const parts: string[] = []
  if (d.effort) parts.push(`Stopped feeling like effort: ${d.effort.toLowerCase()}`)
  if (d.survive) parts.push(`Survives without tracking: ${d.survive.toLowerCase()}`)
  if (d.cost.length || d.costNote.trim())
    parts.push(`Cost: ${[...d.cost.map((x) => x.toLowerCase()), ...(d.costNote.trim() ? [d.costNote.trim()] : [])].join(', ')}`)
  if (d.change.trim()) parts.push(`Changed: ${d.change.trim()}`)
  return parts.join(' · ')
}
