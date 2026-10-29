const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Limit czasu na jedno wywolanie AI (cala analiza ma sie zmiescic w ~30 s). */
const REQUEST_TIMEOUT_MS = 45_000

export class ApiError extends Error {
  /** Czy ponowienie tego samego zapytania ma sens (np. chwilowy blad, a nie zly plik). */
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

export type AnalyzeRequest = { fileName: string; pages: number; text: string; part?: string }
export type AnalyzeResponse = { model: string; result: unknown }

const statusMessages: Record<number, string> = {
  400: 'Serwer odrzucił zapytanie (niepoprawne dane).',
  403: 'Ta strona nie ma dostępu do API.',
  413: 'Dokument jest za długi do analizy.',
  429: 'Za dużo analiz w krótkim czasie. Odczekaj minutę i spróbuj ponownie.',
  502: 'Model AI zwrócił błąd. Spróbuj ponownie.',
  503: 'Model AI jest chwilowo przeciążony lub wyczerpał limit. Spróbuj za chwilę.',
  504: 'Model AI nie odpowiedział na czas. Spróbuj ponownie.',
}

export async function requestAnalysis(
  body: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  if (!API_URL) throw new ApiError('Brak adresu API (VITE_API_URL) w konfiguracji.', false)

  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  try {
    response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: combined,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    if (timeout.aborted) throw new ApiError(statusMessages[504] ?? '', true)
    throw new ApiError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.', true)
  }

  if (!response.ok) {
    const message = statusMessages[response.status] ?? `Błąd serwera (${response.status}).`
    throw new ApiError(message, response.status !== 400 && response.status !== 403)
  }

  const data: unknown = await response.json().catch(() => null)
  if (
    typeof data !== 'object' ||
    data === null ||
    !('result' in data) ||
    !('model' in data) ||
    typeof data.model !== 'string'
  ) {
    throw new ApiError(statusMessages[502] ?? '', true)
  }
  return { model: data.model, result: data.result }
}
