import { useRef, useState } from 'react'
import { DropZone } from './components/DropZone'
import { HistoryList } from './components/HistoryList'
import { ResultView } from './components/ResultView'
import { ErrorBox, Progress } from './components/StatusViews'
import { AnalysisError, analyzePdf, type Stage } from './lib/analyze'
import { addToHistory, clearHistory, loadHistory, removeFromHistory } from './lib/history'
import type { AnalysisResult } from './lib/schema'

type State =
  | { kind: 'idle' }
  | { kind: 'working'; file: File; stage: Stage }
  | { kind: 'error'; file: File; message: string; retryable: boolean }
  | { kind: 'done'; result: AnalysisResult }

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [history, setHistory] = useState(loadHistory)
  const abortRef = useRef<AbortController | null>(null)

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
      setState({ kind: 'done', result })
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
        <button type="button" className="brand" onClick={reset}>
          <span className="brand-mark" aria-hidden="true">
            PDF
          </span>
          Insight
        </button>
      </header>

      <main className="container">
        {state.kind === 'idle' && (
          <>
            <section className="intro">
              <h1>Podsumowanie i dane z PDF w kilka sekund</h1>
              <p className="lead">
                Wgraj dokument: umowę, fakturę, ofertę lub raport. Dostaniesz krótkie podsumowanie,
                najważniejsze punkty, kwoty, daty i strony dokumentu oraz plik JSON do pobrania.
              </p>
            </section>
            <DropZone onFile={run} />
            <p className="privacy small">
              Tekst z pliku jest wysyłany do analizy w Google Gemini API i nie jest zapisywany na
              naszym serwerze. W darmowym planie Google może wykorzystywać przesłane treści do
              ulepszania swoich usług, więc nie wgrywaj dokumentów poufnych.
            </p>
            <HistoryList
              entries={history}
              onOpen={(entry) => setState({ kind: 'done', result: entry.result })}
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

        {state.kind === 'done' && <ResultView result={state.result} onNew={reset} />}
      </main>

      <footer className="footer muted small">
        PDF Insight · React + TypeScript · Cloudflare Workers · Gemini
      </footer>
    </>
  )
}
