import { useEffect, useRef, useState } from 'react'
import type { Stage } from '../lib/analyze'

function stageLabel(stage: Stage): string {
  switch (stage.step) {
    case 'reading':
      return 'Odczytuję tekst z PDF'
    case 'analyzing':
      return stage.total > 1
        ? `Analizuję fragment ${Math.min(stage.done + 1, stage.total - 1)} z ${stage.total - 1}`
        : 'Szukam kwot, dat i stron dokumentu'
    case 'merging':
      return 'Łączę wyniki fragmentów'
  }
}

export function Progress({
  stage,
  fileName,
  onCancel,
}: {
  stage: Stage
  fileName: string
  onCancel: () => void
}) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(timer)
  }, [])

  const steps = ['Wgranie', 'Odczyt tekstu', 'Analiza AI', 'Wynik']
  const active = stage.step === 'reading' ? 1 : 2

  return (
    <section className="status" aria-live="polite" aria-busy="true">
      {/* Jedyna animacja w aplikacji: zakreslacz przesuwa sie po "czytanym" arkuszu. */}
      <div className="sheet reading-sheet" aria-hidden="true">
        <span className="line" />
        <span className="line short" />
        <span className="line" />
        <span className="line mid" />
        <span className="line" />
      </div>
      <div className="status-text">
        <p className="status-title">{stageLabel(stage)}…</p>
        <p className="muted">
          {fileName}, {seconds} s
        </p>
        <ol className="steps">
          {steps.map((label, i) => (
            <li key={label} className={i < active ? 'done' : i === active ? 'active' : ''}>
              {label}
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </section>
  )
}

export function ErrorBox({
  message,
  onRetry,
  onReset,
}: {
  message: string
  onRetry?: () => void
  onReset: () => void
}) {
  const boxRef = useRef<HTMLElement>(null)
  useEffect(() => boxRef.current?.focus(), [])

  return (
    <section ref={boxRef} tabIndex={-1} className="error" role="alert">
      <h2>Nie udało się przeanalizować pliku</h2>
      <p>{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="btn btn-ink" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={onReset}>
          Wybierz inny plik
        </button>
      </div>
    </section>
  )
}
