import { describe, expect, it, vi } from 'vitest'
import { analyzeValidated, AnalysisError } from './analyze'
import { splitIntoChunks } from './chunk'
import { checkFileBasics, hasPdfHeader, MAX_FILE_BYTES } from './file'
import { jsonFileName } from './download'
import { mergeChunkResults } from './merge'
import type { AiAnalysis } from './schema'

const analysis = (over: Partial<AiAnalysis> = {}): AiAnalysis => ({
  document: { language: 'pl', type: 'umowa', title: 'Umowa', date: '2026-03-12' },
  summary: 'Pierwsze zdanie podsumowania. Drugie zdanie podsumowania. Trzecie zdanie podsumowania.',
  keyPoints: ['a', 'b', 'c'],
  entities: { organizations: [], people: [] },
  amounts: [],
  dates: [],
  keywords: [],
  warnings: [],
  ...over,
})

describe('walidacja pliku', () => {
  it('odrzuca inne typy i za duze pliki', () => {
    expect(checkFileBasics({ name: 'a.docx', type: 'application/msword', size: 10 }).ok).toBe(false)
    expect(checkFileBasics({ name: 'a.pdf', type: '', size: MAX_FILE_BYTES + 1 }).ok).toBe(false)
    expect(checkFileBasics({ name: 'a.pdf', type: 'application/pdf', size: 0 }).ok).toBe(false)
    expect(checkFileBasics({ name: 'A.PDF', type: '', size: 1000 }).ok).toBe(true)
  })

  it('rozpoznaje naglowek PDF', () => {
    expect(hasPdfHeader(new TextEncoder().encode('%PDF-1.7\n...'))).toBe(true)
    expect(hasPdfHeader(new TextEncoder().encode('PK\u0003\u0004 zip'))).toBe(false)
  })

  it('tworzy bezpieczna nazwe pliku JSON', () => {
    expect(jsonFileName('Umowa 14/2026.PDF')).toBe('Umowa 14_2026.insight.json')
  })
})

describe('dzielenie na fragmenty', () => {
  it('krotki dokument to jeden fragment ze znacznikami stron i bez pustych stron', () => {
    const chunks = splitIntoChunks(['Strona pierwsza', '   ', 'Strona trzecia'])
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toContain('[Strona 1]')
    expect(chunks[0]).toContain('[Strona 3]')
    expect(chunks[0]).not.toContain('[Strona 2]')
  })

  it('dzieli na granicach stron i tnie zbyt dlugie strony', () => {
    const chunks = splitIntoChunks(['a'.repeat(60), 'b'.repeat(60), 'c'.repeat(250)], 100)
    expect(chunks.length).toBeGreaterThanOrEqual(4)
    expect(chunks.every((c) => c.length <= 100)).toBe(true)
  })

  it('pusty dokument nie daje fragmentow', () => {
    expect(splitIntoChunks(['', '  '])).toEqual([])
  })
})

describe('laczenie wynikow fragmentow', () => {
  it('usuwa duplikaty niezaleznie od wielkosci liter', () => {
    const merged = mergeChunkResults(
      [
        analysis({
          entities: { organizations: ['Kwadrat Software S.A.'], people: ['Anna Kowalczyk'] },
          amounts: [{ value: 100, currency: 'PLN', context: 'opłata' }],
        }),
        analysis({
          entities: { organizations: ['kwadrat software s.a.'], people: ['Jan Nowak'] },
          amounts: [
            { value: 100, currency: 'PLN', context: 'Opłata' },
            { value: 100, currency: 'EUR', context: 'opłata' },
          ],
        }),
      ],
      analysis({ summary: 'Całość dokumentu. Zdanie drugie. Zdanie trzecie.' }),
    )
    expect(merged.entities.organizations).toEqual(['Kwadrat Software S.A.'])
    expect(merged.entities.people).toEqual(['Anna Kowalczyk', 'Jan Nowak'])
    expect(merged.amounts).toHaveLength(2)
    expect(merged.summary).toBe('Całość dokumentu. Zdanie drugie. Zdanie trzecie.')
  })
})

describe('analyzeValidated - ponowna proba', () => {
  const body = { fileName: 'a.pdf', pages: 1, text: 'tekst' }

  it('po blednej odpowiedzi ponawia raz i zwraca poprawny wynik', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ model: 'm', result: { ...analysis(), keyPoints: ['jeden'] } })
      .mockResolvedValueOnce({ model: 'm', result: analysis() })
    const res = await analyzeValidated(body, undefined, request)
    expect(request).toHaveBeenCalledTimes(2)
    expect(res.analysis.document.type).toBe('umowa')
  })

  it('po dwoch blednych odpowiedziach zglasza blad', async () => {
    const request = vi.fn().mockResolvedValue({ model: 'm', result: null })
    await expect(analyzeValidated(body, undefined, request)).rejects.toBeInstanceOf(AnalysisError)
    expect(request).toHaveBeenCalledTimes(2)
  })
})

describe('normalizacja odpowiedzi AI przed walidacja', () => {
  it('zamienia zl na PLN i usuwa kwoty z nieznana waluta, reszta przechodzi schemat', async () => {
    const { normalizeAiResult } = await import('./normalize')
    const { aiAnalysisSchema } = await import('./schema')
    const raw = {
      ...analysis(),
      document: { ...analysis().document, language: 'PL' },
      amounts: [
        { value: 184500, currency: 'zł', context: 'wdrożenie' },
        { value: 10, currency: '€', context: 'opłata' },
        { value: 5, currency: 'punkty', context: 'nie waluta' },
      ],
    }
    expect(aiAnalysisSchema.safeParse(raw).success).toBe(false)
    const parsed = aiAnalysisSchema.parse(normalizeAiResult(raw))
    expect(parsed.amounts.map((a) => a.currency)).toEqual(['PLN', 'EUR'])
    expect(parsed.document.language).toBe('pl')
  })

  it('odpowiedz z waluta zl przechodzi bez ponownej proby', async () => {
    const request = vi.fn().mockResolvedValue({
      model: 'm',
      result: { ...analysis(), amounts: [{ value: 1, currency: 'zł', context: 'x' }] },
    })
    await analyzeValidated({ fileName: 'a.pdf', pages: 1, text: 't' }, undefined, request)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
