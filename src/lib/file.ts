export const MAX_FILE_BYTES = 10 * 1024 * 1024

export type FileCheck = { ok: true } | { ok: false; message: string }

/** Sprawdza plik przed odczytem: rozszerzenie/typ, rozmiar i naglowek %PDF-. */
export function checkFileBasics(file: { name: string; type: string; size: number }): FileCheck {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!looksLikePdf) return { ok: false, message: 'To nie jest plik PDF. Wybierz plik .pdf.' }
  if (file.size === 0) return { ok: false, message: 'Plik jest pusty.' }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1).replace('.', ',')
    return { ok: false, message: `Plik ma ${mb} MB, a limit to 10 MB.` }
  }
  return { ok: true }
}

/** Prawdziwy PDF zaczyna sie od "%PDF-" (dopuszczamy kilka bajtow smieci na poczatku). */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

export function formatBytes(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
