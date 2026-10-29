import type { AiAnalysis } from './schema'

// Dane rejestrowe firmy to nie warunki finansowe dokumentu - model czasem je podaje mimo instrukcji.
const REGISTRY_AMOUNT = /kapita[łl]\w*\s+zak[łl]adow|share\s+capital|capital\s+stock/i

const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

const MONTHS_PL = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]
const MONTHS_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

/**
 * Czy dzien z daty ISO jest zapisany w tekscie dokumentu (12.03.2026, 2026-03-12, 12/03/2026,
 * "12 marca 2026", "12 March 2026", "March 12, 2026"). Chroni przed datami zgadnietymi przez
 * model, np. "wrzesien 2025" zamienionym na 2025-09-01.
 */
export function dateAppearsIn(iso: string, text: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return false
  const day = `0?${d}`
  const month = `0?${m}`
  const pl = MONTHS_PL[m - 1] ?? ''
  const en = MONTHS_EN[m - 1] ?? ''
  const patterns = [
    `(?<!\\d)${day}\\s*[./-]\\s*${month}\\s*[./-]\\s*${y}(?!\\d)`,
    `(?<!\\d)${y}-0?${m}-0?${d}(?!\\d)`,
    `(?<!\\d)${day}\\s+(?:${pl}|${en})\\s+${y}(?!\\d)`,
    `${en}\\s+${day},?\\s+${y}(?!\\d)`,
  ]
  const haystack = text.toLocaleLowerCase()
  return patterns.some((p) => new RegExp(p, 'u').test(haystack))
}

/**
 * Deterministyczne poprawki wyniku AI (po walidacji schematem): bez kapitalu zakladowego
 * w kwotach, bez dat, ktorych nie ma w tekscie dokumentu, i bez powtorzen.
 */
export function cleanAnalysis(analysis: AiAnalysis, sourceText?: string): AiAnalysis {
  const seenAmounts = new Set<string>()
  const amounts = analysis.amounts.filter((a) => {
    if (REGISTRY_AMOUNT.test(a.context)) return false
    const key = `${a.value}|${a.currency}|${norm(a.context)}`
    if (seenAmounts.has(key)) return false
    seenAmounts.add(key)
    return true
  })

  const seenDates = new Set<string>()
  const dates = analysis.dates.filter((d) => {
    if (sourceText !== undefined && !dateAppearsIn(d.date, sourceText)) return false
    const key = `${d.date}|${norm(d.context)}`
    if (seenDates.has(key)) return false
    seenDates.add(key)
    return true
  })

  return { ...analysis, amounts, dates }
}
