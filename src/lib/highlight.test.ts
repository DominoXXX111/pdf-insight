import { describe, expect, it } from 'vitest'
import { findMarks, namePattern, toSegments } from './highlight'
import type { AiAnalysis } from './schema'

const analysis = (over: Partial<AiAnalysis> = {}): AiAnalysis => ({
  document: { language: 'pl', type: 'umowa', title: 'Umowa', date: '2026-03-12' },
  summary: 'x',
  keyPoints: ['a', 'b', 'c'],
  entities: { organizations: ['Alfa Serwis sp. z o.o.'], people: ['Marta Wiśniewska'] },
  amounts: [
    { value: 184500, currency: 'PLN', context: 'wdrożenie netto' },
    { value: 4800, currency: 'PLN', context: 'abonament' },
  ],
  dates: [{ date: '2026-12-01', context: 'start' }],
  keywords: [],
  warnings: [],
  ...over,
})

const marked = (text: string, a = analysis()) =>
  toSegments(text, findMarks(text, a))
    .filter((s) => s.kind)
    .map((s) => `${s.kind}:${s.text}`)

describe('zaznaczenia w podsumowaniu', () => {
  it('zaznacza kwoty z waluta i dopiskiem netto, tylko gdy sa w danych', () => {
    expect(marked('Wynagrodzenie 184 500,00 zł netto, a 99 999,00 zł nie ma w danych.')).toEqual([
      'amount:184 500,00 zł netto',
    ])
  })

  it('nie zaznacza liczb bez waluty', () => {
    expect(marked('Dla 4800 użytkowników.')).toEqual([])
  })

  it('zaznacza daty slowne, z kropkami i ISO, jesli sa w danych lub sa data dokumentu', () => {
    expect(
      marked('Zawarta 12 marca 2026 r., start 01.12.2026 r., a 2026-12-01 to ten sam dzień.'),
    ).toEqual(['date:12 marca 2026 r.', 'date:01.12.2026 r.', 'date:2026-12-01'])
    expect(marked('Spotkanie 5 maja 2026 r.')).toEqual([])
  })

  it('zaznacza nazwy takze w odmianie', () => {
    expect(marked('Umowę z Alfa Serwis sp. z o.o. podpisała Martę Wiśniewską.')).toEqual([
      'party:Alfa Serwis sp. z o.o.',
      'party:Martę Wiśniewską',
    ])
  })

  it('nie naklada zaznaczen i zachowuje caly tekst', () => {
    const text = 'Kwota 4 800,00 zł od 1 grudnia 2026 r. dla Marty Wiśniewskiej.'
    const segments = toSegments(text, findMarks(text, analysis()))
    expect(segments.map((s) => s.text).join('')).toBe(text)
    expect(segments.filter((s) => s.kind).length).toBe(3)
  })

  it('wzorzec nazwy pomija zbyt krotkie nazwy', () => {
    expect(namePattern('AB')).toBeNull()
  })
})

describe('przykladowy wynik', () => {
  it('jest zgodny ze schematem i ma zaznaczenia w podsumowaniu', async () => {
    const { SAMPLE_RESULT } = await import('./sample')
    const { analysisResultSchema } = await import('./schema')
    expect(analysisResultSchema.safeParse(SAMPLE_RESULT).success).toBe(true)
    const kinds = findMarks(SAMPLE_RESULT.summary, SAMPLE_RESULT).map((m) => m.kind)
    expect(kinds).toEqual(expect.arrayContaining(['amount', 'date', 'party']))
  })
})

describe('cleanAnalysis', () => {
  it('usuwa kapital zakladowy i powtorzenia, zostawia reszte', async () => {
    const { cleanAnalysis } = await import('./clean')
    const cleaned = cleanAnalysis(
      analysis({
        amounts: [
          { value: 2500000, currency: 'PLN', context: 'kapitał zakładowy Alfa sp. z o.o.' },
          { value: 184500, currency: 'PLN', context: 'wdrożenie netto' },
          { value: 184500, currency: 'PLN', context: 'Wdrożenie  netto' },
          { value: 184500, currency: 'EUR', context: 'wdrożenie netto' },
        ],
        dates: [
          { date: '2026-12-01', context: 'start' },
          { date: '2026-12-01', context: 'Start' },
          { date: '2026-12-01', context: 'inny kontekst' },
        ],
      }),
    )
    expect(cleaned.amounts.map((a) => `${a.value} ${a.currency}`)).toEqual([
      '184500 PLN',
      '184500 EUR',
    ])
    expect(cleaned.dates).toHaveLength(2)
  })
})
