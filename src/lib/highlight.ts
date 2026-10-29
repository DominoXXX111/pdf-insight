import type { AiAnalysis } from './schema'

export type MarkKind = 'amount' | 'date' | 'party'
export type Mark = { start: number; end: number; kind: MarkKind }
export type Segment = { text: string; kind?: MarkKind }

const MONTHS: Record<string, number> = {
  stycznia: 1,
  lutego: 2,
  marca: 3,
  kwietnia: 4,
  maja: 5,
  czerwca: 6,
  lipca: 7,
  sierpnia: 8,
  września: 9,
  października: 10,
  listopada: 11,
  grudnia: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Wzorzec nazwy odporny na polska odmiane: dluzsze slowa dopasowujemy po rdzeniu
 * ("Marta Wiśniewska" pasuje do "Martę Wiśniewską", "Pracownia" do "Pracownią").
 */
export function namePattern(name: string): RegExp | null {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || name.trim().length < 3) return null
  const parts = tokens.map((token) =>
    token.length > 4 && /^\p{L}+$/u.test(token)
      ? `${escapeRegex(token.slice(0, token.length - 2))}\\p{L}{0,4}`
      : escapeRegex(token),
  )
  return new RegExp(`(?<![\\p{L}\\d])${parts.join('\\s+')}(?![\\p{L}\\d])`, 'gu')
}

/** "184 500,00" -> 184500, "4 800,00" -> 4800 */
function parseAmount(raw: string): number {
  return Number(raw.replace(/[\s\u00a0]/g, '').replace(',', '.'))
}

const AMOUNT_RE =
  /(?<![\d,.])(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:,(\d{1,2}))?(\s*(?:zł|PLN|EUR|€|USD|\$|GBP|£|CHF)(?:\s+(?:netto|brutto))?)/giu
const DATE_WORDS_RE = /(?<!\d)(\d{1,2})\s+(\p{L}+)\s+(\d{4})(\s*r\.)?/gu
const DATE_DOTS_RE = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(\s*r\.)?/g
const DATE_ISO_RE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g

/** Wyszukuje w podsumowaniu kwoty, daty i nazwy, ktore model wyciagnal tez jako dane. */
export function findMarks(summary: string, analysis: AiAnalysis): Mark[] {
  const marks: Mark[] = []
  const amountValues = new Set(analysis.amounts.map((a) => a.value))
  const dateValues = new Set([
    ...analysis.dates.map((d) => d.date),
    ...(analysis.document.date ? [analysis.document.date] : []),
  ])

  for (const m of summary.matchAll(AMOUNT_RE)) {
    const value = parseAmount(`${m[1] ?? ''}${m[2] ? `,${m[2]}` : ''}`)
    if (amountValues.has(value)) {
      marks.push({ start: m.index, end: m.index + m[0].length, kind: 'amount' })
    }
  }

  const pushDate = (index: number, length: number, y: number, mo: number, d: number) => {
    if (dateValues.has(`${y}-${pad(mo)}-${pad(d)}`)) {
      marks.push({ start: index, end: index + length, kind: 'date' })
    }
  }
  for (const m of summary.matchAll(DATE_WORDS_RE)) {
    const month = MONTHS[(m[2] ?? '').toLocaleLowerCase()]
    if (month) pushDate(m.index, m[0].length, Number(m[3]), month, Number(m[1]))
  }
  for (const m of summary.matchAll(DATE_DOTS_RE)) {
    pushDate(m.index, m[0].length, Number(m[3]), Number(m[2]), Number(m[1]))
  }
  for (const m of summary.matchAll(DATE_ISO_RE)) {
    pushDate(m.index, m[0].length, Number(m[1]), Number(m[2]), Number(m[3]))
  }

  for (const name of [...analysis.entities.organizations, ...analysis.entities.people]) {
    const pattern = namePattern(name)
    if (!pattern) continue
    for (const m of summary.matchAll(pattern)) {
      marks.push({ start: m.index, end: m.index + m[0].length, kind: 'party' })
    }
  }

  // Bez nakladania sie: wygrywa wczesniejsze, a przy tym samym poczatku - dluzsze zaznaczenie.
  marks.sort((a, b) => a.start - b.start || b.end - a.end)
  const result: Mark[] = []
  for (const mark of marks) {
    const last = result[result.length - 1]
    if (!last || mark.start >= last.end) result.push(mark)
  }
  return result
}

/** Dzieli tekst na fragmenty zwykle i zaznaczone (do renderowania bez innerHTML). */
export function toSegments(text: string, marks: Mark[]): Segment[] {
  const segments: Segment[] = []
  let pos = 0
  for (const mark of marks) {
    if (mark.start > pos) segments.push({ text: text.slice(pos, mark.start) })
    segments.push({ text: text.slice(mark.start, mark.end), kind: mark.kind })
    pos = mark.end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })
  return segments
}
