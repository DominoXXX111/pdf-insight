import type { AiAnalysis } from './schema'

// Dane rejestrowe firmy to nie warunki finansowe dokumentu - model czasem je podaje mimo instrukcji.
const REGISTRY_AMOUNT = /kapita[łl]\w*\s+zak[łl]adow|share\s+capital|capital\s+stock/i

const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

/**
 * Deterministyczne poprawki wyniku AI (po walidacji schematem): bez kapitalu zakladowego
 * w kwotach i bez powtorzen tej samej kwoty lub daty o tym samym znaczeniu.
 */
export function cleanAnalysis(analysis: AiAnalysis): AiAnalysis {
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
    const key = `${d.date}|${norm(d.context)}`
    if (seenDates.has(key)) return false
    seenDates.add(key)
    return true
  })

  return { ...analysis, amounts, dates }
}
