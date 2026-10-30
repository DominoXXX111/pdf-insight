import { useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { HistoryList } from './components/HistoryList'
import { ResultView } from './components/ResultView'
import { SampleSheet } from './components/SampleSheet'
import { ErrorBox, Progress } from './components/StatusViews'
import { AnalysisError, analyzePdf, type Stage } from './lib/analyze'
import { addToHistory, clearHistory, loadHistory, removeFromHistory } from './lib/history'
import { SAMPLE_RESULT } from './lib/sample'
import type { AnalysisResult } from './lib/schema'
import { applyTheme, saveTheme, storedTheme, systemTheme, type Theme } from './lib/theme'

type State =
  | { kind: 'idle' }
  | { kind: 'working'; file: File; stage: Stage }
  | { kind: 'error'; file: File; message: string; retryable: boolean }
  | { kind: 'done'; result: AnalysisResult; isSample: boolean }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [history, setHistory] = useState(loadHistory)
  const abortRef = useRef<AbortController | null>(null)
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    saveTheme(next)
    setTheme(next)
  }

  const run = async (file: File) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ kind: 'working', file, stage: { step: 'reading' } })
    try {
      const result = await analyzePdf(
        file,
        (stage) => {
          if (!controller.signal.aborted) setState({ kind: 'working', file, stage })
        },
        controller.signal,
      )
      if (controller.signal.aborted) return
      setHistory(addToHistory(result))
      setState({ kind: 'done', result, isSample: false })
    } catch (error) {
      if (controller.signal.aborted) return
      const known = error instanceof AnalysisError
      setState({
        kind: 'error',
        file,
        message: known ? error.message : 'Nieoczekiwany błąd. Spróbuj ponownie.',
        retryable: known ? error.retryable : true,
      })
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setState({ kind: 'idle' })
  }

  return (
    <>
      <header className="topbar">
        <button type="button" className="logo" onClick={reset}>
          <span className="logo-mark" aria-hidden="true" />
          PDF Insight
        </button>
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
          {theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
        </button>
      </header>

      <main className="page">
        {state.kind === 'idle' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <h1>Wgraj PDF. Ważne rzeczy zaznaczymy za{'\u00a0'}ciebie.</h1>
                <p className="lead">
                  Krótkie podsumowanie, kwoty, terminy i strony dokumentu, wyciągnięte z pliku w
                  kilka sekund i gotowe do pobrania jako JSON.
                </p>
                <DropZone
                  onFile={run}
                  onSample={() => setState({ kind: 'done', result: SAMPLE_RESULT, isSample: true })}
                />
                <p className="privacy">
                  <strong>To wersja demonstracyjna na darmowym planie Gemini API.</strong> Wysyłamy
                  tylko tekst z pliku, nie sam plik, przez nasz serwer do Google. Serwer niczego nie
                  zapisuje, a historia analiz zostaje tylko w tej przeglądarce. Na darmowym planie
                  Google może wykorzystywać przesłane treści, więc nie wgrywaj prawdziwych umów z
                  danymi osobowymi czy tajemnicą firmy. Przy płatnym planie Google nie wykorzystuje
                  danych do ulepszania usług.
                </p>
              </div>
              <SampleSheet />
            </section>
            <HistoryList
              entries={history}
              onOpen={(entry) => setState({ kind: 'done', result: entry.result, isSample: false })}
              onRemove={(id) => setHistory(removeFromHistory(id))}
              onClear={() => {
                clearHistory()
                setHistory([])
              }}
            />
          </>
        )}

        {state.kind === 'working' && (
          <Progress stage={state.stage} fileName={state.file.name} onCancel={reset} />
        )}

        {state.kind === 'error' && (
          <ErrorBox
            message={state.message}
            onRetry={state.retryable ? () => void run(state.file) : undefined}
            onReset={reset}
          />
        )}

        {state.kind === 'done' && (
          <ResultView result={state.result} isSample={state.isSample} onNew={reset} />
        )}
      </main>

      <footer className="footer muted">
        PDF Insight, zadanie rekrutacyjne. React, TypeScript, Cloudflare Workers i Gemini.
      </footer>
    </>
  )
}
