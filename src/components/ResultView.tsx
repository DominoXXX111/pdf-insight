import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { downloadJson, jsonFileName } from '../lib/download'
import { toExportJson, type AnalysisResult } from '../lib/schema'

const typeLabels: Record<AnalysisResult['document']['type'], string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Inny dokument',
}

type TabId = 'view' | 'json'
const tabs: { id: TabId; label: string }[] = [
  { id: 'view', label: 'Wyniki' },
  { id: 'json', label: 'Podgląd JSON' },
]

function formatAmount(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      useGrouping: 'always',
    }).format(value)
  } catch {
    return `${value.toLocaleString('pl-PL')} ${currency}`
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function TagList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="muted small">{empty}</p>
  return (
    <ul className="tags">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  )
}

export function ResultView({ result, onNew }: { result: AnalysisResult; onNew: () => void }) {
  const [tab, setTab] = useState<TabId>('view')
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  // Wzorzec ARIA tabs: strzalki, Home i End przelaczaja zakladki.
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === tab)
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = tabs[(target + tabs.length) % tabs.length]
    if (!next) return
    setTab(next.id)
    tabRefs.current[next.id]?.focus()
  }
  const [copied, setCopied] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Po pokazaniu wyniku fokus trafia na tytul - czytnik ekranu i klawiatura zaczynaja od wyniku.
  useEffect(() => headingRef.current?.focus(), [])
  const { document: doc } = result
  const json = toExportJson(result)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="result">
      <div className="card result-head">
        <div className="result-title">
          <span className="badge">{typeLabels[doc.type]}</span>
          <h2 ref={headingRef} tabIndex={-1}>
            {doc.title ?? doc.fileName}
          </h2>
          <p className="muted small">
            {doc.fileName} · {doc.pages} {doc.pages === 1 ? 'strona' : 'str.'} · język:{' '}
            {doc.language.toUpperCase()}
            {doc.date && ` · data: ${formatDate(doc.date)}`}
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => downloadJson(json, jsonFileName(doc.fileName))}
          >
            Pobierz JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNew}>
            Nowy plik
          </button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="card notice" role="note">
          <strong>Uwagi do dokumentu</strong>
          <ul>
            {result.warnings.map((w, i) => (
              <li key={`${i}-${w}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Widok wyniku" onKeyDown={onTabKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'view' ? (
        <div id="panel-view" role="tabpanel" aria-labelledby="tab-view" className="grid">
          <article className="card span-2">
            <h3>Podsumowanie</h3>
            <p className="summary">{result.summary}</p>
          </article>

          <article className="card span-2">
            <h3>Najważniejsze punkty</h3>
            <ul className="points">
              {result.keyPoints.map((point, i) => (
                <li key={`${i}-${point}`}>{point}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h3>Kwoty</h3>
            {result.amounts.length === 0 ? (
              <p className="muted small">Brak kwot w dokumencie.</p>
            ) : (
              <table className="table">
                <tbody>
                  {result.amounts.map((a, i) => (
                    <tr key={`${a.value}-${a.currency}-${i}`}>
                      <td className="num">{formatAmount(a.value, a.currency)}</td>
                      <td>{a.context}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="card">
            <h3>Daty</h3>
            {result.dates.length === 0 ? (
              <p className="muted small">Brak dat w dokumencie.</p>
            ) : (
              <table className="table">
                <tbody>
                  {result.dates.map((d, i) => (
                    <tr key={`${d.date}-${i}`}>
                      <td className="num">{formatDate(d.date)}</td>
                      <td>{d.context}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>

          <article className="card">
            <h3>Organizacje</h3>
            <TagList items={result.entities.organizations} empty="Brak organizacji." />
            <h3 className="mt">Osoby</h3>
            <TagList items={result.entities.people} empty="Brak osób." />
          </article>

          <article className="card">
            <h3>Słowa kluczowe</h3>
            <TagList items={result.keywords} empty="Brak słów kluczowych." />
          </article>
        </div>
      ) : (
        <div id="panel-json" role="tabpanel" aria-labelledby="tab-json" className="card">
          <div className="json-bar">
            <span className="muted small">Zwalidowany schematem · {json.length} znaków</span>
            <button type="button" className="btn btn-ghost btn-small" onClick={copy}>
              {copied ? 'Skopiowano' : 'Kopiuj'}
            </button>
          </div>
          <pre className="json" tabIndex={0}>
            {json}
          </pre>
        </div>
      )}
    </section>
  )
}
