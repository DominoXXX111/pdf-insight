import type { AnalysisResult } from './schema'

/**
 * Przykladowy wynik dla fikcyjnej umowy pokazanej na stronie startowej.
 * Przygotowany recznie - pokazuje format wyniku bez wysylania czegokolwiek do AI.
 */
export const SAMPLE_RESULT: AnalysisResult = {
  document: {
    fileName: 'przyklad-umowa-serwisowa-7-2026.pdf',
    pages: 3,
    language: 'pl',
    type: 'umowa',
    title: 'Umowa serwisowa nr 7/2026',
    date: '2026-11-02',
  },
  summary:
    'Umowa serwisowa zawarta 2 listopada 2026 r. pomiędzy Alfa Serwis sp. z o.o. a Pracownią Delta S.A. dotyczy obsługi sprzętu biurowego w dwóch oddziałach Zleceniodawcy. Za obsługę Zleceniodawca płaci 4 800,00 zł netto miesięcznie, począwszy od 1 grudnia 2026 r. Wykonawca reaguje na zgłoszenia awarii w ciągu 8 godzin roboczych, a za każdy dzień zwłoki płaci karę 300,00 zł. Umowa obowiązuje do 30 listopada 2027 r.',
  keyPoints: [
    'Abonament 4 800,00 zł netto miesięcznie, płatny do 10. dnia miesiąca.',
    'Reakcja na awarię w ciągu 8 godzin roboczych.',
    'Kara 300,00 zł za każdy dzień zwłoki w usunięciu awarii.',
    'Umowa na 12 miesięcy z jednomiesięcznym okresem wypowiedzenia.',
  ],
  entities: {
    organizations: ['Alfa Serwis sp. z o.o.', 'Pracownia Delta S.A.'],
    people: ['Marta Wiśniewska', 'Krzysztof Lis'],
  },
  amounts: [
    { value: 4800, currency: 'PLN', context: 'abonament miesięczny, netto' },
    { value: 5904, currency: 'PLN', context: 'abonament miesięczny, brutto' },
    { value: 300, currency: 'PLN', context: 'kara za każdy dzień zwłoki' },
    { value: 57600, currency: 'PLN', context: 'wartość umowy za 12 miesięcy, netto' },
    {
      value: 120,
      currency: 'EUR',
      context: 'części sprowadzane z zagranicy, ryczałt za zamówienie',
    },
  ],
  dates: [
    { date: '2026-11-02', context: 'zawarcie umowy' },
    { date: '2026-12-01', context: 'początek świadczenia usług' },
    { date: '2026-12-10', context: 'termin pierwszej płatności' },
    { date: '2027-11-30', context: 'koniec obowiązywania umowy' },
  ],
  keywords: ['serwis', 'sprzęt biurowy', 'abonament', 'awaria', 'kara umowna'],
  warnings: [],
  meta: {
    model: 'przykład przygotowany ręcznie (bez AI)',
    analyzedAt: '2026-10-29T21:00:00.000Z',
    chunks: 1,
    pagesWithoutText: [],
  },
}
