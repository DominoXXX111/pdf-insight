import { z } from 'zod'

// Data w formacie ISO 8601 (RRRR-MM-DD), ktora naprawde istnieje w kalendarzu.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data musi mieć format RRRR-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }, 'Nieistniejąca data')

export const documentTypes = ['faktura', 'umowa', 'oferta', 'raport', 'inne'] as const

const nonEmpty = z.string().trim().min(1)

/** Czesc wyniku, ktora generuje model AI (bez danych znanych z samego pliku). */
export const aiAnalysisSchema = z.object({
  document: z.object({
    language: z.string().regex(/^[a-z]{2}$/, 'Język w ISO 639-1, np. "pl"'),
    type: z.enum(documentTypes),
    title: nonEmpty.nullable(),
    date: isoDate.nullable(),
  }),
  summary: z.string().trim().min(20, 'Podsumowanie jest za krótkie'),
  keyPoints: z.array(nonEmpty).min(1).max(7),
  entities: z.object({
    organizations: z.array(nonEmpty),
    people: z.array(nonEmpty),
  }),
  amounts: z.array(
    z.object({
      value: z.number().finite(),
      currency: z.string().regex(/^[A-Z]{3}$/, 'Waluta w ISO 4217, np. "PLN"'),
      context: nonEmpty,
    }),
  ),
  dates: z.array(z.object({ date: isoDate, context: nonEmpty })),
  keywords: z.array(nonEmpty),
  // Pole dodatkowe (schemat pozwala dodawac pola): uwagi o dokumencie, np. zignorowane polecenia dla AI.
  warnings: z.array(nonEmpty).default([]),
})

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>

/** Pelny wynik analizy - zgodny ze schematem z briefu, plus pole meta. */
export const analysisResultSchema = aiAnalysisSchema.extend({
  document: aiAnalysisSchema.shape.document.extend({
    fileName: nonEmpty,
    pages: z.number().int().positive(),
  }),
  meta: z.object({
    model: z.string(),
    analyzedAt: z.string().datetime(),
    chunks: z.number().int().positive(),
    pagesWithoutText: z.array(z.number().int().positive()),
  }),
})

export type AnalysisResult = z.infer<typeof analysisResultSchema>

/** Kolejnosc kluczy w eksporcie: najpierw pola z briefu, potem dodatkowe. */
export function toExportJson(result: AnalysisResult): string {
  const { document, summary, keyPoints, entities, amounts, dates, keywords, warnings, meta } =
    result
  const ordered = {
    document: {
      fileName: document.fileName,
      pages: document.pages,
      language: document.language,
      type: document.type,
      title: document.title,
      date: document.date,
    },
    summary,
    keyPoints,
    entities,
    amounts,
    dates,
    keywords,
    warnings,
    meta,
  }
  return JSON.stringify(ordered, null, 2)
}
