import type { HistoryEntry } from '../lib/history'

type Props = {
  entries: HistoryEntry[]
  onOpen: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

const dateTime = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' })

export function HistoryList({ entries, onOpen, onRemove, onClear }: Props) {
  if (entries.length === 0) return null
  return (
    <section className="card history" aria-labelledby="history-title">
      <div className="history-head">
        <h2 id="history-title">Ostatnie analizy</h2>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClear}>
          Wyczyść
        </button>
      </div>
      <p className="muted small">Zapisane tylko w tej przeglądarce.</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" className="history-open" onClick={() => onOpen(entry)}>
              <span className="history-name">
                {entry.result.document.title ?? entry.result.document.fileName}
              </span>
              <span className="muted small">
                {entry.result.document.fileName} · {dateTime.format(new Date(entry.savedAt))}
              </span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => onRemove(entry.id)}
              aria-label={`Usuń z historii: ${entry.result.document.fileName}`}
            >
              Usuń
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
