import { describe, expect, it } from 'vitest'
import { aiAnalysisSchema, analysisResultSchema, isoDate, toExportJson } from './schema'

const valid = {
  document: { language: 'pl', type: 'umowa', title: 'Umowa serwisowa', date: '2026-09-01' },
  summary: 'Umowa określa zasady świadczenia usług serwisowych. Obowiązuje przez 12 miesięcy.',
  keyPoints: ['Okres umowy 12 mies.', 'Wynagrodzenie 12 500 zł', 'SLA 99,5%'],
  entities: { organizations: ['Przykład sp. z o.o.'], people: [] },
  amounts: [{ value: 12500, currency: 'PLN', context: 'wynagrodzenie' }],
  dates: [{ date: '2026-10-01', context: 'termin płatności' }],
  keywords: ['serwis', 'SLA'],
  warnings: [],
}

const withMeta = {
  ...valid,
  document: { ...valid.document, fileName: 'umowa.pdf', pages: 4 },
  meta: {
    model: 'gemini-2.5-flash',
    analyzedAt: '2026-10-29T20:00:00.000Z',
    chunks: 1,
    pagesWithoutText: [],
  },
}

describe('aiAnalysisSchema', () => {
  it('przyjmuje poprawna odpowiedz z briefu', () => {
    expect(aiAnalysisSchema.safeParse(valid).success).toBe(true)
  })

  it('dopuszcza null i puste listy, gdy brak informacji', () => {
    const empty = {
      ...valid,
      document: { ...valid.document, title: null, date: null },
      amounts: [],
      dates: [],
      entities: { organizations: [], people: [] },
    }
    expect(aiAnalysisSchema.safeParse(empty).success).toBe(true)
  })

  it('uzupelnia brakujace pole warnings pusta lista', () => {
    const rest: Partial<typeof valid> = { ...valid }
    delete rest.warnings
    const parsed = aiAnalysisSchema.parse(rest)
    expect(parsed.warnings).toEqual([])
  })

  it('odrzuca nieznany typ dokumentu', () => {
    const bad = { ...valid, document: { ...valid.document, type: 'list' } }
    expect(aiAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('odrzuca kwote zapisana jako tekst i walute spoza ISO 4217', () => {
    const textValue = { ...valid, amounts: [{ value: '12 500,00', currency: 'PLN', context: 'x' }] }
    const zl = { ...valid, amounts: [{ value: 12500, currency: 'zł', context: 'x' }] }
    expect(aiAnalysisSchema.safeParse(textValue).success).toBe(false)
    expect(aiAnalysisSchema.safeParse(zl).success).toBe(false)
  })

  it('odrzuca jezyk spoza ISO 639-1', () => {
    const bad = { ...valid, document: { ...valid.document, language: 'polski' } }
    expect(aiAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('wymaga 3-7 kluczowych punktow', () => {
    expect(aiAnalysisSchema.safeParse({ ...valid, keyPoints: ['a', 'b'] }).success).toBe(false)
  })

  it('pusty tytul i pusta data to brak informacji (null)', () => {
    const parsed = aiAnalysisSchema.parse({
      ...valid,
      document: { ...valid.document, title: ' ', date: '' },
    })
    expect(parsed.document.title).toBeNull()
    expect(parsed.document.date).toBeNull()
  })

  it('odrzuca wiecej niz 7 kluczowych punktow', () => {
    const bad = { ...valid, keyPoints: Array.from({ length: 8 }, (_, i) => `punkt ${i}`) }
    expect(aiAnalysisSchema.safeParse(bad).success).toBe(false)
  })

  it('odrzuca brakujace wymagane pole', () => {
    const rest: Partial<typeof valid> = { ...valid }
    delete rest.summary
    expect(aiAnalysisSchema.safeParse(rest).success).toBe(false)
  })
})

describe('isoDate', () => {
  it.each(['2026-03-12', '2024-02-29'])('przyjmuje %s', (d) => {
    expect(isoDate.safeParse(d).success).toBe(true)
  })

  it.each(['12.03.2026', '2026-3-12', '2026-02-30', '2025-02-29', '2026-13-01'])(
    'odrzuca %s',
    (d) => {
      expect(isoDate.safeParse(d).success).toBe(false)
    },
  )
})

describe('analysisResultSchema i eksport', () => {
  it('wymaga nazwy pliku i liczby stron', () => {
    expect(analysisResultSchema.safeParse(withMeta).success).toBe(true)
    const noPages = { ...withMeta, document: { ...withMeta.document, pages: 0 } }
    expect(analysisResultSchema.safeParse(noPages).success).toBe(false)
  })

  it('eksportuje JSON z kluczami w kolejnosci z briefu', () => {
    const result = analysisResultSchema.parse(withMeta)
    const exported: unknown = JSON.parse(toExportJson(result))
    expect(Object.keys(exported as object)).toEqual([
      'document',
      'summary',
      'keyPoints',
      'entities',
      'amounts',
      'dates',
      'keywords',
      'warnings',
      'meta',
    ])
    expect(Object.keys((exported as { document: object }).document)).toEqual([
      'fileName',
      'pages',
      'language',
      'type',
      'title',
      'date',
    ])
  })
})
