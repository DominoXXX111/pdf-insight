import { ApiError, requestAnalysis, type AnalyzeRequest, type AnalyzeResponse } from '../api/client'
import { splitIntoChunks } from './chunk'
import { cleanAnalysis } from './clean'
import { checkFileBasics, hasPdfHeader } from './file'
import { describePartsForOverall, mergeChunkResults } from './merge'
import { normalizeAiResult } from './normalize'
import { extractPdfText, PdfReadError } from './pdf'
import {
  aiAnalysisSchema,
  analysisResultSchema,
  type AiAnalysis,
  type AnalysisResult,
} from './schema'

export type Stage =
  { step: 'reading' } | { step: 'analyzing'; done: number; total: number } | { step: 'merging' }

export class AnalysisError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

type RequestFn = (body: AnalyzeRequest, signal?: AbortSignal) => Promise<AnalyzeResponse>

/**
 * Wywoluje AI i waliduje odpowiedz schematem Zod.
 * Odpowiedz niezgodna ze schematem: jedna ponowna proba, potem blad.
 */
export async function analyzeValidated(
  body: AnalyzeRequest,
  signal?: AbortSignal,
  request: RequestFn = requestAnalysis,
): Promise<{ model: string; analysis: AiAnalysis }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { model, result } = await request(body, signal)
    const parsed = aiAnalysisSchema.safeParse(normalizeAiResult(result))
    if (parsed.success) return { model, analysis: parsed.data }
  }
  throw new AnalysisError(
    'Model AI dwukrotnie zwrócił dane niezgodne ze schematem. Spróbuj ponownie.',
    true,
  )
}

/** Zadania po kolei w malych grupach - nie przekraczamy limitu zapytan backendu. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index] as T)
    }
  })
  await Promise.all(workers)
  return results
}

export async function analyzePdf(
  file: File,
  onStage: (stage: Stage) => void,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const basic = checkFileBasics(file)
  if (!basic.ok) throw new AnalysisError(basic.message, false)

  try {
    onStage({ step: 'reading' })
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!hasPdfHeader(bytes)) {
      throw new AnalysisError('Plik ma rozszerzenie .pdf, ale nie jest prawidłowym PDF-em.', false)
    }
    const pdf = await extractPdfText(bytes)
    const chunks = splitIntoChunks(pdf.pageTexts)
    if (chunks.length === 0) {
      throw new AnalysisError(
        'Ten PDF nie ma warstwy tekstowej (to prawdopodobnie skan). Obsługiwane są dokumenty z tekstem.',
        false,
      )
    }

    const base = { fileName: file.name, pages: pdf.pages }
    let done = 0
    const total = chunks.length === 1 ? 1 : chunks.length + 1
    onStage({ step: 'analyzing', done, total })

    const numbered = chunks.map((text, index) => ({ text, index }))
    const parts = await mapLimited(numbered, 2, async ({ text, index }) => {
      const part = chunks.length > 1 ? `${index + 1}/${chunks.length}` : undefined
      const res = await analyzeValidated({ ...base, text, part }, signal)
      onStage({ step: 'analyzing', done: ++done, total })
      return res
    })

    let model = parts[0]?.model ?? ''
    let analysis = parts[0]?.analysis
    if (parts.length > 1) {
      onStage({ step: 'merging' })
      const overall = await analyzeValidated(
        { ...base, text: describePartsForOverall(parts.map((p) => p.analysis)), part: 'summary' },
        signal,
      )
      model = overall.model
      analysis = mergeChunkResults(
        parts.map((p) => p.analysis),
        overall.analysis,
      )
    }
    if (!analysis) throw new AnalysisError('Brak wyniku analizy.', true)
    analysis = cleanAnalysis(analysis, pdf.pageTexts.join('\n'))

    const warnings = [...analysis.warnings]
    if (pdf.pagesWithoutText.length > 0) {
      warnings.unshift(
        `Strony bez warstwy tekstowej (pominięte w analizie): ${pdf.pagesWithoutText.join(', ')}.`,
      )
    }

    return analysisResultSchema.parse({
      ...analysis,
      document: { fileName: file.name, pages: pdf.pages, ...analysis.document },
      warnings,
      meta: {
        model,
        analyzedAt: new Date().toISOString(),
        chunks: chunks.length,
        pagesWithoutText: pdf.pagesWithoutText,
      },
    })
  } catch (error) {
    if (error instanceof AnalysisError) throw error
    if (error instanceof ApiError) throw new AnalysisError(error.message, error.retryable)
    if (error instanceof PdfReadError) throw new AnalysisError(error.message, false)
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AnalysisError('Coś poszło nie tak podczas analizy. Spróbuj ponownie.', true)
  }
}
