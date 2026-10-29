import type { TextContent } from 'pdfjs-dist/types/src/display/api'

export type ExtractedPdf = {
  pages: number
  pageTexts: string[]
  /** Numery stron (od 1) bez warstwy tekstowej, np. skany. */
  pagesWithoutText: number[]
}

/** Strona z mniej niz tyloma znakami (bez bialych) traktowana jest jako skan bez tekstu. */
const MIN_PAGE_CHARS = 20

export class PdfReadError extends Error {}

/** pdf.js jest ladowany dopiero przy pierwszym pliku, zeby strona startowa byla lekka. */
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  // Adres workera z bundlera uwzglednia base '/pdf-insight/' - wazne na GitHub Pages.
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

export function textContentToString(content: TextContent): string {
  let out = ''
  for (const item of content.items) {
    if (!('str' in item)) continue
    out += item.str
    if (item.hasEOL) out += '\n'
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdf> {
  const pdfjs = await loadPdfJs()
  const task = pdfjs.getDocument({ data })
  let doc
  try {
    doc = await task.promise
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'PasswordException') {
      throw new PdfReadError('PDF jest zabezpieczony hasłem. Zdejmij hasło i spróbuj ponownie.')
    }
    throw new PdfReadError('Nie udało się otworzyć pliku. Plik PDF może być uszkodzony.')
  }

  try {
    const pageTexts: string[] = []
    const pagesWithoutText: number[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const text = textContentToString(await page.getTextContent())
      pageTexts.push(text)
      if (text.replace(/\s/g, '').length < MIN_PAGE_CHARS) pagesWithoutText.push(n)
      page.cleanup()
    }
    return { pages: doc.numPages, pageTexts, pagesWithoutText }
  } finally {
    void task.destroy()
  }
}
