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

describe('teksty po polsku', () => {
  it('odmienia liczebniki', async () => {
    const { plural } = await import('./text')
    const f = (n: number) => `${n} ${plural(n, 'strona', 'strony', 'stron')}`
    expect([1, 2, 4, 5, 12, 13, 22, 25, 104, 112].map(f)).toEqual([
      '1 strona',
      '2 strony',
      '4 strony',
      '5 stron',
      '12 stron',
      '13 stron',
      '22 strony',
      '25 stron',
      '104 strony',
      '112 stron',
    ])
  })

  it('wiaze krotkie slowa i krotkie zaznaczenia twarda spacja', async () => {
    const { bindShortWords, keepTogether } = await import('./text')
    expect(bindShortWords('Umowa nr 7 z firmą a w nim')).toBe('Umowa nr 7 z firmą a w nim')
    expect(keepTogether('4 800,00 zł netto')).toBe('4 800,00 zł netto')
  })
})

describe('daty nieobecne w tekscie', () => {
  const text =
    'Zawarta 12.03.2026 r., start 1 kwietnia 2026 r., termin 2026-11-03. Dane za wrzesień 2025.'
  it('zostawia daty zapisane w tekscie w roznych formatach', async () => {
    const { dateAppearsIn } = await import('./clean')
    expect(['2026-03-12', '2026-04-01', '2026-11-03'].map((d) => dateAppearsIn(d, text))).toEqual([
      true,
      true,
      true,
    ])
  })

  it('odrzuca daty zgadniete przez model (sam miesiac, przesuniety rok)', async () => {
    const { dateAppearsIn, cleanAnalysis } = await import('./clean')
    expect(dateAppearsIn('2025-09-01', text)).toBe(false)
    expect(dateAppearsIn('2025-03-12', text)).toBe(false)
    const cleaned = cleanAnalysis(
      analysis({
        dates: [
          { date: '2026-03-12', context: 'zawarcie' },
          { date: '2025-09-01', context: 'wrzesień 2025' },
        ],
      }),
      text,
    )
    expect(cleaned.dates.map((d) => d.date)).toEqual(['2026-03-12'])
  })
})
