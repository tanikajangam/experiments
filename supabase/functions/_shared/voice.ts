// Turning what someone said into a form's fields: the prompts, the JSON schemas the model must follow,
// and the clean-up that keeps only allowed values. Pure, and shared with the `transcribe` Edge Function
// (see scripts/copy-shared.mjs), so the app and the server agree on every chip label.
import { COST, EFFORT, SURVIVE } from './decision.ts'

export type VoiceForm = 'decide' | 'create' | 'log'
export const VOICE_FORMS: VoiceForm[] = ['decide', 'create', 'log']

/** Recording stops by itself after a minute. */
export const MAX_SECONDS = 60
/** A minute of phone audio is well under 2 MB; anything near this is not a voice note. */
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024

export const AUDIO_FORMATS = ['m4a', 'webm', 'ogg', 'wav', 'mp3', 'aac'] as const
export type AudioFormat = (typeof AUDIO_FORMATS)[number]

/** The format name OpenRouter expects, from the recorder's MIME type. iPhone records audio/mp4, which is m4a. */
export function audioFormat(mimeType: string): AudioFormat | null {
  const t = mimeType.toLowerCase()
  if (t.startsWith('audio/mp4') || t.startsWith('audio/x-m4a') || t.startsWith('audio/m4a')) return 'm4a'
  if (t.startsWith('audio/webm')) return 'webm'
  if (t.startsWith('audio/ogg')) return 'ogg'
  if (t.startsWith('audio/wav') || t.startsWith('audio/x-wav')) return 'wav'
  if (t.startsWith('audio/mpeg') || t.startsWith('audio/mp3')) return 'mp3'
  if (t.startsWith('audio/aac')) return 'aac'
  return null
}

export interface DecideFields {
  effort: string | null
  survive: string | null
  cost: string[] | null
  cost_note: string | null
  change: string | null
}

export interface CreateFields {
  title: string | null
  /** Days of the week, 0 = Sunday. */
  schedule_days: number[] | null
  where: string | null
  why: string | null
}

export interface LogFields {
  done: boolean | null
  note: string | null
}

export interface FieldsFor {
  decide: DecideFields
  create: CreateFields
  log: LogFields
}

const list = (xs: readonly string[]) => `[${xs.map((x) => `"${x}"`).join(', ')}]`

/** The prompt for each form. The Decide one is design/system-design.md's, word for word (a test checks). */
export function prompt(form: VoiceForm, transcript: string): string {
  if (form === 'decide') {
    return `You are filling a form from what a person said after finishing a 65-day habit trial.
Return only JSON with these keys. Use null when they did not address a question.
  effort:  one of ${list(EFFORT)}
  survive: one of ${list(SURVIVE)}
  cost:    array from ${list(COST)}
  cost_note: string or null
  change:  one sentence in their own words, or null
The trial lasted 65 days, about 9 weeks. For effort: "Early on" is weeks 1 to 2, "Around the middle" is weeks 3 to 6, "Near the end" is weeks 7 to 9, "Never" means it always felt like effort.
For cost, pick only what they said it cost. Lost sleep or tiredness is "Energy"; hours spent is "Time".
Transcript: """${transcript}"""`
  }
  if (form === 'create') {
    return `You are filling a form from what a person said about a habit they want to try for 65 days.
Return only JSON with these keys. Use null when they did not say.
  title: a short name for the habit in their words, like "Eat 3 meals a day", or null
  schedule_days: the days of the week it is due, as numbers, 0 = Sunday to 6 = Saturday. "Every day" is [0,1,2,3,4,5,6], "weekdays" is [1,2,3,4,5], "weekends" is [0,6]. Or null
  where: where or with whom, in their words, or null
  why: what they hope changes by the end, one sentence in their own words, or null
Transcript: """${transcript}"""`
  }
  return `You are filling a daily log from what a person said about one habit today.
Return only JSON with these keys. Use null when they did not say.
  done: true if they did it today, false if they did not, or null
  note: what is worth remembering, one or two sentences in their own words, or null
Transcript: """${transcript}"""`
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })
const str = nullable({ type: 'string' })

/** JSON schema for response_format, so the model can only answer with allowed values. */
export function schema(form: VoiceForm): Record<string, unknown> {
  const properties: Record<string, unknown> =
    form === 'decide'
      ? {
          effort: nullable({ type: 'string', enum: [...EFFORT] }),
          survive: nullable({ type: 'string', enum: [...SURVIVE] }),
          cost: nullable({ type: 'array', items: { type: 'string', enum: [...COST] } }),
          cost_note: str,
          change: str,
        }
      : form === 'create'
        ? {
            title: str,
            schedule_days: nullable({ type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }),
            where: str,
            why: str,
          }
        : { done: nullable({ type: 'boolean' }), note: str }
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t && t.toLowerCase() !== 'null' ? t.slice(0, max) : null
}
const oneOf = (v: unknown, allowed: readonly string[]): string | null =>
  typeof v === 'string' ? (allowed.find((a) => a.toLowerCase() === v.trim().toLowerCase()) ?? null) : null

/** Keep only allowed values. Whatever the model sends, the form only ever gets valid fields or null. */
export function sanitize<F extends VoiceForm>(form: F, raw: unknown): FieldsFor[F] {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (form === 'decide') {
    const cost = Array.isArray(r.cost) ? [...new Set(r.cost.map((c) => oneOf(c, COST)).filter((c): c is string => c !== null))] : []
    // "Not much" can't sit with a real cost (the screen's own rule).
    const costs = cost.length > 1 ? cost.filter((c) => c !== 'Not much') : cost
    const fields: DecideFields = {
      effort: oneOf(r.effort, EFFORT),
      survive: oneOf(r.survive, SURVIVE),
      cost: costs.length ? costs : null,
      cost_note: text(r.cost_note, 300),
      change: text(r.change, 300),
    }
    return fields as FieldsFor[F]
  }
  if (form === 'create') {
    const days = Array.isArray(r.schedule_days)
      ? [...new Set(r.schedule_days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : []
    const fields: CreateFields = {
      title: text(r.title, 80),
      schedule_days: days.length ? days : null,
      where: text(r.where, 200),
      why: text(r.why, 300),
    }
    return fields as FieldsFor[F]
  }
  const fields: LogFields = { done: typeof r.done === 'boolean' ? r.done : null, note: text(r.note, 500) }
  return fields as FieldsFor[F]
}

/** The model's reply as JSON, tolerating a ```json fence around it. */
export function parseReply(content: string): unknown {
  const body = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}
