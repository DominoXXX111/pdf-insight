/** "Umowa 14-2026.pdf" -> "Umowa 14-2026.insight.json" */
export function jsonFileName(pdfName: string): string {
  const base = pdfName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .trim()
  return `${base || 'dokument'}.insight.json`
}

export function downloadJson(json: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
