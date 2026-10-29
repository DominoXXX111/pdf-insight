import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { downloadJson, jsonFileName } from '../lib/download'
import { findMarks, toSegments, type MarkKind } from '../lib/highlight'
import { toExportJson, type AnalysisResult } from '../lib/schema'

const typeLabels: Record<AnalysisResult['document']['type'], string> = {
  faktura: 'Faktura',
  umowa: 'Umowa',
  oferta: 'Oferta',
  raport: 'Raport',
  inne: 'Dokument',
}

const languageNames = new Intl.DisplayNames(['pl'], { type: 'language' })

const markLabels: Record<MarkKind, string> = {
  amount: 'Kwoty',
  date: 'Daty',
  party: 'Strony i osoby',
}

type TabId = 'view' | 'json'
const tabs: { id: TabId; label: string }[] = [
  { id: 'view', label: 'Wyniki' },
  { id: 'json', label: 'Podgląd JSON' },
]

/** Ile pozycji pokazac, zanim uzytkownik rozwinie liste. */
const AMOUNTS_PREVIEW = 6
const DATES_PREVIEW = 6
const PEOPLE_PREVIEW = 8

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

function languageName(code: string): string {
  try {
    return `język ${languageNames.of(code) ?? code}`
  } catch {
    return `język: ${code}`
  }
}

function MoreButton({
  open,
  total,
  noun,
  onClick,
}: {
  open: boolean
  total: number
  noun: string
  onClick: () => void
}) {
  return (
    <button type="button" className="link more" aria-expanded={open} onClick={onClick}>
      {open ? 'Pokaż mniej' : `Pokaż wszystkie ${noun} (${total})`}
    </button>
  )
}

function Amounts({ amounts }: { amounts: AnalysisResult['amounts'] }) {
  const [all, setAll] = useState(false)
  if (amounts.length === 0) return <p className="muted">W dokumencie nie ma kwot.</p>

  // Kolejnosc od modelu (najwazniejsze najpierw), pogrupowana wedlug waluty.
  const visible = all ? amounts : amounts.slice(0, AMOUNTS_PREVIEW)
  const currencies = [...new Set(visible.map((a) => a.currency))]
  return (
    <>
      {currencies.map((currency) => (
        <div key={currency}>
          {currencies.length > 1 && <p className="currency">{currency}</p>}
          <table className="amounts">
            <tbody>
              {visible
                .filter((a) => a.currency === currency)
                .map((a, i) => (
                  <tr key={`${a.value}-${i}`}>
                    <td className="num">{formatAmount(a.value, a.currency)}</td>
                    <td>{a.context}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
      {amounts.length > AMOUNTS_PREVIEW && (
        <MoreButton open={all} total={amounts.length} noun="kwoty" onClick={() => setAll(!all)} />
      )}
    </>
  )
}

function Timeline({ dates, from }: { dates: AnalysisResult['dates']; from: string | null }) {
  const [all, setAll] = useState(false)
  if (dates.length === 0) return <p className="muted">W dokumencie nie ma dat.</p>
  // W podgladzie najpierw daty od dnia dokumentu (terminy, okres obowiazywania), starsze tlo
  // dopiero po rozwinieciu; w obu widokach ulozone chronologicznie.
  const current = from ? dates.filter((d) => d.date >= from) : dates
  const background = from ? dates.filter((d) => d.date < from) : []
  const picked = all ? dates : [...current, ...background].slice(0, DATES_PREVIEW)
  const visible = [...picked].sort((a, b) => a.date.localeCompare(b.date))
  return (
    <>
      <ol className="timeline">
        {visible.map((d, i) => (
          <li key={`${d.date}-${i}`}>
            <time dateTime={d.date}>{formatDate(d.date)}</time>
            {d.context}
          </li>
        ))}
      </ol>
      {dates.length > DATES_PREVIEW && (
        <MoreButton open={all} total={dates.length} noun="daty" onClick={() => setAll(!all)} />
      )}
    </>
  )
}

function Parties({ entities }: { entities: AnalysisResult['entities'] }) {
  const [all, setAll] = useState(false)
  const { organizations, people } = entities
  if (organizations.length + people.length === 0) {
    return <p className="muted">W dokumencie nie ma nazw firm ani osób.</p>
  }
  const visiblePeople = all ? people : people.slice(0, PEOPLE_PREVIEW)
  const hidden = people.length - visiblePeople.length
  return (
    <>
      {organizations.length > 0 && (
        <ul className="chips chips-party" aria-label="Organizacje">
          {organizations.map((name, i) => (
            <li key={`${i}-${name}`}>{name}</li>
          ))}
        </ul>
      )}
      {people.length > 0 && (
        <ul className="chips chips-party" aria-label="Osoby">
          {visiblePeople.map((name, i) => (
            <li key={`${i}-${name}`}>{name}</li>
          ))}
          {hidden > 0 && (
            <li>
              <button type="button" className="link" onClick={() => setAll(true)}>
                +{hidden} {hidden === 1 ? 'osoba' : hidden < 5 ? 'osoby' : 'osób'}
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  )
}

export function ResultView({
  result,
  isSample,
  onNew,
}: {
  result: AnalysisResult
  isSample: boolean
  onNew: () => void
}) {
  const [tab, setTab] = useState<TabId>('view')
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState<Record<MarkKind, boolean>>({
    amount: true,
    date: true,
    party: true,
  })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const { document: doc } = result
  const json = toExportJson(result)
  const segments = toSegments(result.summary, findMarks(result.summary, result))

  // Po pokazaniu wyniku fokus trafia na tytul - czytnik ekranu i klawiatura zaczynaja od wyniku.
  useEffect(() => headingRef.current?.focus(), [])

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const facts = [
    `${doc.pages} ${doc.pages === 1 ? 'strona' : doc.pages < 5 ? 'strony' : 'stron'}`,
    languageName(doc.language),
    ...(doc.date ? [`z dnia ${formatDate(doc.date)}`] : []),
    doc.fileName,
  ]

  return (
    <section className="result">
      {isSample && (
        <p className="sample-note" role="note">
          To przykładowy wynik przygotowany wcześniej dla fikcyjnej umowy. Nic nie zostało wysłane
          do AI. Wgraj własny PDF, żeby zobaczyć analizę na żywo.
        </p>
      )}

      <header className="result-head">
        <span className="stamp">{typeLabels[doc.type]}</span>
        <div className="result-title">
          <h1 ref={headingRef} tabIndex={-1}>
            {doc.title ?? doc.fileName}
          </h1>
          <ul className="facts">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-pen"
            onClick={() => downloadJson(json, jsonFileName(doc.fileName))}
          >
            Pobierz JSON
          </button>
          <button type="button" className="btn btn-outline" onClick={onNew}>
            Nowy plik
          </button>
        </div>
      </header>

      {result.warnings.length > 0 && (
        <div className="warnings" role="note">
          <p>Do sprawdzenia</p>
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
        <div id="panel-view" role="tabpanel" aria-labelledby="tab-view">
          <div className="toggles" role="group" aria-label="Zaznaczenia w podsumowaniu">
            {(Object.keys(markLabels) as MarkKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`toggle toggle-${kind}`}
                aria-pressed={shown[kind]}
                onClick={() => setShown({ ...shown, [kind]: !shown[kind] })}
              >
                <span className="swatch" aria-hidden="true" />
                {markLabels[kind]}
              </button>
            ))}
          </div>
          <article className="sheet summary" aria-label="Podsumowanie">
            <p>
              {segments.map((s, i) =>
                s.kind && shown[s.kind] ? (
                  <mark key={i} className={`hl-${s.kind}`}>
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </p>
          </article>

          <div className="columns">
            <section className="block">
              <h2>Najważniejsze punkty</h2>
              <ul className="points">
                {result.keyPoints.map((point, i) => (
                  <li key={`${i}-${point}`}>{point}</li>
                ))}
              </ul>
            </section>

            <section className="block">
              <h2>
                <span className="swatch swatch-date" aria-hidden="true" />
                Daty <small>w kolejności</small>
              </h2>
              <Timeline dates={result.dates} from={doc.date} />
            </section>

            <section className="block">
              <h2>
                <span className="swatch swatch-amount" aria-hidden="true" />
                Kwoty{' '}
                <small>
                  {result.amounts.length}{' '}
                  {result.amounts.length === 1
                    ? 'pozycja'
                    : result.amounts.length % 10 >= 2 &&
                        result.amounts.length % 10 <= 4 &&
                        (result.amounts.length < 10 || result.amounts.length > 20)
                      ? 'pozycje'
                      : 'pozycji'}
                </small>
              </h2>
              <Amounts amounts={result.amounts} />
            </section>

            <section className="block">
              <h2>
                <span className="swatch swatch-party" aria-hidden="true" />
                Strony i osoby
              </h2>
              <Parties entities={result.entities} />
              {result.keywords.length > 0 && (
                <>
                  <h2 className="mt">
                    <span className="swatch swatch-key" aria-hidden="true" />
                    Słowa kluczowe
                  </h2>
                  <ul className="chips chips-key">
                    {result.keywords.map((k, i) => (
                      <li key={`${i}-${k}`}>{k}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        </div>
      ) : (
        <div id="panel-json" role="tabpanel" aria-labelledby="tab-json">
          <div className="json-bar">
            <span className="muted">Wynik sprawdzony schematem, {json.length} znaków</span>
            <button type="button" className="btn btn-outline btn-small" onClick={copy}>
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
