// Voice: audio in, form fields out. The app sends a recording (base64) and which form it's for. This
// turns it into text with Whisper, then asks a small model to sort the text into that form's fields,
// and cleans the answer so only allowed values come back. The OpenRouter key never leaves this function.
// Only a signed-in user can call it. Transcripts are never logged.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { AUDIO_FORMATS, MAX_AUDIO_BYTES, VOICE_FORMS, parseReply, prompt, sanitize, schema, type AudioFormat, type VoiceForm } from '../_shared/voice.ts'

const STT_MODEL = 'openai/whisper-large-v3-turbo'
const SORT_MODEL = 'google/gemini-3.5-flash-lite'
const OPENROUTER = 'https://openrouter.ai/api/v1'

const env = (name: string) => Deno.env.get(name) ?? ''

// The browser calls this directly from the app's origin, so every response carries CORS headers.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** The project's secret key (new-style, else legacy). Used only to check the caller's session token. */
function serverKey(): string {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>
    if (keys.default) return keys.default
  } catch {
    // Fall through to the legacy key.
  }
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

async function openrouter(path: string, body: unknown): Promise<Response> {
  return await fetch(`${OPENROUTER}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('OPENROUTER_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  // Signed-in users only, so nobody else can spend the OpenRouter credit.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await createClient(env('SUPABASE_URL'), serverKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'unauthorized' }, 401)

  if (!env('OPENROUTER_API_KEY')) return json({ error: 'not_configured', stage: 'setup' }, 503)

  let body: { form?: string; audio?: string; format?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const form = body.form as VoiceForm
  const format = body.format as AudioFormat
  if (!VOICE_FORMS.includes(form) || !AUDIO_FORMATS.includes(format) || typeof body.audio !== 'string' || !body.audio) {
    return json({ error: 'bad_request' }, 400)
  }
  if (body.audio.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4) return json({ error: 'too_long' }, 413)

  // 1. Speech to text.
  const stt = await openrouter('/audio/transcriptions', { model: STT_MODEL, input_audio: { data: body.audio, format } })
  if (!stt.ok) {
    console.error('transcription failed', stt.status, format)
    return json({ error: 'upstream', stage: 'transcribe', status: stt.status }, 502)
  }
  const transcript = String(((await stt.json()) as { text?: unknown }).text ?? '').trim()
  if (!transcript) return json({ error: 'empty', stage: 'transcribe' }, 422)

  // 2. Sort the words into the form's fields. Strict JSON schema first; some models reject it, so fall
  //    back to plain JSON mode. Either way, sanitize() keeps only allowed values.
  const messages = [{ role: 'user', content: prompt(form, transcript) }]
  let sort = await openrouter('/chat/completions', {
    model: SORT_MODEL,
    messages,
    temperature: 0,
    response_format: { type: 'json_schema', json_schema: { name: `${form}_fields`, strict: true, schema: schema(form) } },
  })
  if (sort.status === 400) {
    sort = await openrouter('/chat/completions', { model: SORT_MODEL, messages, temperature: 0, response_format: { type: 'json_object' } })
  }
  if (!sort.ok) {
    console.error('sorting failed', sort.status)
    return json({ error: 'upstream', stage: 'sort', status: sort.status }, 502)
  }
  const reply = (await sort.json()) as { choices?: { message?: { content?: string } }[] }
  const fields = sanitize(form, parseReply(reply.choices?.[0]?.message?.content ?? ''))
  return json({ transcript, fields })
})
