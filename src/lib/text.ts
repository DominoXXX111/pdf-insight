const NBSP = ' '

/** Polska odmiana liczebnikow: 1 strona, 2-4 strony, 5+ stron (ale 22 strony, 12 stron). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one
  const lastDigit = n % 10
  const lastTwo = n % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}

/**
 * Typografia polska: jednoliterowe spojniki i skroty typu "nr" nie zostaja na koncu wiersza,
 * a krotkie zaznaczenia (kwota z waluta, data) nie lamia sie w srodku.
 */
export function bindShortWords(text: string): string {
  return text.replace(/(?<=^|[\s(\u00a0])([aiouwzAIOUWZ]|nr|ul\.|§)\s+/g, `$1${NBSP}`)
}

export function keepTogether(text: string, maxLength = 32): string {
  return text.length <= maxLength ? text.replace(/ /g, NBSP) : bindShortWords(text)
}
