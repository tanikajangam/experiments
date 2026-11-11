// The day-65 questions' answers, and the one-line summary shown under "Decided".

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
