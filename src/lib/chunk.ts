/** Okolo 15 tys. tokenow na fragment - szybka odpowiedz modelu i zapas w limicie backendu. */
export const CHUNK_CHARS = 60_000

/**
 * Dzieli tekst dokumentu na fragmenty wzdluz granic stron.
 * Strona dluzsza niz limit jest cieta na kawalki. Kazda strona dostaje znacznik [Strona N].
 */
export function splitIntoChunks(pageTexts: string[], maxChars = CHUNK_CHARS): string[] {
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  pageTexts.forEach((text, index) => {
    if (!text.trim()) return
    const block = `[Strona ${index + 1}]\n${text.trim()}\n\n`
    if (block.length > maxChars) {
      flush()
      for (let start = 0; start < block.length; start += maxChars) {
        chunks.push(block.slice(start, start + maxChars).trim())
      }
      return
    }
    if (current.length + block.length > maxChars) flush()
    current += block
  })
  flush()
  return chunks
}
