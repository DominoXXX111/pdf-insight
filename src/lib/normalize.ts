// Symbole i nazwy walut, ktore model czasem zwraca zamiast kodu ISO 4217.
const CURRENCY_ALIASES: Record<string, string> = {
  ZŁ: 'PLN',
  ZL: 'PLN',
  ZŁOTY: 'PLN',
  ZŁOTYCH: 'PLN',
  '€': 'EUR',
  EURO: 'EUR',
  $: 'USD',
  US$: 'USD',
  '£': 'GBP',
  FR: 'CHF',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function normalizeCurrency(raw: string): string {
  const upper = raw.trim().toLocaleUpperCase('pl')
  return CURRENCY_ALIASES[upper] ?? upper
}

/**
 * Deterministyczne poprawki surowej odpowiedzi AI PRZED walidacja schematem:
 * waluta "zł" -> "PLN", kod jezyka malymi literami. Kwota z waluta, ktorej nie da sie
 * zamienic na kod ISO, wypada - zamiast odrzucac (i ponawiac) cala odpowiedz.
 */
export function normalizeAiResult(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const result: Record<string, unknown> = { ...raw }

  if (Array.isArray(raw.amounts)) {
    result.amounts = raw.amounts.flatMap((item: unknown) => {
      if (!isRecord(item) || typeof item.currency !== 'string') return [item]
      const currency = normalizeCurrency(item.currency)
      return /^[A-Z]{3}$/.test(currency) ? [{ ...item, currency }] : []
    })
  }

  if (isRecord(raw.document) && typeof raw.document.language === 'string') {
    result.document = { ...raw.document, language: raw.document.language.trim().toLowerCase() }
  }
  return result
}
