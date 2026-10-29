import { buildUserPrompt, RESPONSE_SCHEMA, SYSTEM_PROMPT } from './prompt'

export interface Env {
  /** Sekret (wrangler secret put GEMINI_API_KEY) - nigdy w kodzie ani w repozytorium. */
  GEMINI_API_KEY: string
  GEMINI_MODEL: string
  /** Lista dozwolonych originow oddzielona przecinkami, np. https://user.github.io */
  ALLOWED_ORIGINS: string
  LIMITER: RateLimit
}

const MAX_BODY_BYTES = 300_000
const MAX_TEXT_CHARS = 120_000
const GEMINI_TIMEOUT_MS = 40_000

type AnalyzeInput = { fileName: string; pages: number; text: string; part?: string }

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function corsHeaders(origin: string | null, allowed: string): Record<string, string> | null {
  const list = allowed
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (!origin || !list.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function parseInput(raw: unknown): AnalyzeInput | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { fileName, pages, text, part } = raw as Record<string, unknown>
  if (typeof fileName !== 'string' || fileName.length === 0 || fileName.length > 300) return null
  if (typeof pages !== 'number' || !Number.isInteger(pages) || pages < 1 || pages > 5000) {
    return null
  }
  if (typeof text !== 'string' || text.trim().length === 0) return null
  if (
    part !== undefined &&
    (typeof part !== 'string' || !/^(summary|\d{1,3}\/\d{1,3})$/.test(part))
  ) {
    return null
  }
  return { fileName, pages, text, part }
}

function generationConfig(model: string) {
  return {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: 8192,
    // Modele 2.5 domyslnie "mysla" - wylaczamy to, zeby zmiescic sie w 30 s.
    ...(model.startsWith('gemini-2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
  }
}

type GeminiOutcome = { ok: true; result: unknown } | { ok: false; status: number }

async function callGemini(env: Env, input: AnalyzeInput): Promise<GeminiOutcome> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input) }] }],
    generationConfig: generationConfig(env.GEMINI_MODEL),
  })

  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      })
    } catch {
      return { ok: false, status: 504 }
    }

    // Przeciazenie po stronie Google - jedna szybka ponowna proba.
    if ((res.status === 503 || res.status === 500) && attempt === 1) {
      await new Promise((r) => setTimeout(r, 800))
      continue
    }
    if (res.status === 429 || res.status === 503) return { ok: false, status: 503 }
    if (!res.ok) return { ok: false, status: 502 }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    try {
      return { ok: true, result: JSON.parse(text) }
    } catch {
      // Uciety lub niepoprawny JSON - frontend potraktuje to jak bledna odpowiedz i ponowi.
      return { ok: true, result: null }
    }
  }
  return { ok: false, status: 503 }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request.headers.get('Origin'), env.ALLOWED_ORIGINS)

    if (url.pathname !== '/analyze') return json({ error: 'not_found' }, 404, {})
    if (!cors) return json({ error: 'origin_not_allowed' }, 403, {})
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const { success } = await env.LIMITER.limit({ key: ip })
    if (!success) return json({ error: 'rate_limited' }, 429, cors)

    const declared = Number(request.headers.get('Content-Length') ?? '0')
    if (declared > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, cors)
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413, cors)

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return json({ error: 'bad_json' }, 400, cors)
    }
    const input = parseInput(parsed)
    if (!input) return json({ error: 'bad_request' }, 400, cors)
    if (input.text.length > MAX_TEXT_CHARS) return json({ error: 'too_large' }, 413, cors)

    // Tresc dokumentu nie jest nigdzie zapisywana ani logowana.
    const outcome = await callGemini(env, input)
    if (!outcome.ok) return json({ error: 'ai_error' }, outcome.status, cors)
    return json({ model: env.GEMINI_MODEL, result: outcome.result }, 200, cors)
  },
} satisfies ExportedHandler<Env>
