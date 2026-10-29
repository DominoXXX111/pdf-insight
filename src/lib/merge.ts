import type { AiAnalysis } from './schema'

const norm = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const k = key(item)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Laczy listy z analiz poszczegolnych fragmentow (bez duplikatow).
 * Podsumowanie, kluczowe punkty i dane dokumentu bierze z analizy koncowej `overall`.
 */
export function mergeChunkResults(parts: AiAnalysis[], overall: AiAnalysis): AiAnalysis {
  const all = <T>(pick: (part: AiAnalysis) => T[]) => parts.flatMap(pick)
  return {
    document: overall.document,
    summary: overall.summary,
    keyPoints: overall.keyPoints,
    entities: {
      organizations: uniqueBy(
        all((p) => p.entities.organizations),
        norm,
      ),
      people: uniqueBy(
        all((p) => p.entities.people),
        norm,
      ),
    },
    amounts: uniqueBy(
      all((p) => p.amounts),
      (a) => `${a.value}|${a.currency}|${norm(a.context)}`,
    ),
    dates: uniqueBy(
      all((p) => p.dates),
      (d) => `${d.date}|${norm(d.context)}`,
    ),
    keywords: uniqueBy([...overall.keywords, ...all((p) => p.keywords)], norm).slice(0, 15),
    warnings: uniqueBy([...overall.warnings, ...all((p) => p.warnings)], norm),
  }
}

/** Tekst dla analizy koncowej dlugiego dokumentu: wyniki fragmentow zamiast pelnej tresci. */
export function describePartsForOverall(parts: AiAnalysis[]): string {
  return parts
    .map((p, i) =>
      [
        `[Fragment ${i + 1} z ${parts.length}]`,
        `Tytuł: ${p.document.title ?? 'brak'}; typ: ${p.document.type}; data: ${p.document.date ?? 'brak'}`,
        `Podsumowanie: ${p.summary}`,
        `Kluczowe punkty: ${p.keyPoints.join(' | ')}`,
        `Słowa kluczowe: ${p.keywords.join(', ')}`,
      ].join('\n'),
    )
    .join('\n\n')
}
