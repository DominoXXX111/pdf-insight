import { z } from 'zod'
import { analysisResultSchema, type AnalysisResult } from './schema'

const KEY = 'pdf-insight:history:v1'
export const HISTORY_LIMIT = 8

export type HistoryEntry = { id: string; savedAt: string; result: AnalysisResult }

const entrySchema = z.object({ id: z.string(), savedAt: z.string(), result: analysisResultSchema })

/** Wyniki z localStorage tez sa walidowane - uszkodzone lub stare wpisy sa pomijane. */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item) => {
      const parsed = entrySchema.safeParse(item)
      return parsed.success ? [parsed.data] : []
    })
  } catch {
    return []
  }
}

function save(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Tryb prywatny lub pelny magazyn - historia jest tylko udogodnieniem.
  }
}

export function addToHistory(result: AnalysisResult): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    result,
  }
  const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT)
  save(next)
  return next
}

export function removeFromHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id)
  save(next)
  return next
}

export function clearHistory(): void {
  save([])
}
