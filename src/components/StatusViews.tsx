import { useEffect, useState } from 'react'
import type { Stage } from '../lib/analyze'

function stageLabel(stage: Stage): string {
  switch (stage.step) {
    case 'reading':
      return 'Odczytuję tekst z PDF…'
    case 'analyzing':
      return stage.total > 1
        ? `Analiza AI: fragment ${Math.min(stage.done + 1, stage.total - 1)} z ${stage.total - 1}…`
        : 'Analiza AI: podsumowanie i dane…'
    case 'merging':
      return 'Łączę wyniki fragmentów…'
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
    <section className="card status" aria-live="polite" aria-busy="true">
      <ol className="steps">
        {steps.map((label, i) => (
          <li key={label} className={i < active ? 'done' : i === active ? 'active' : ''}>
            {label}
          </li>
        ))}
      </ol>
      <div className="spinner" aria-hidden="true" />
      <p className="status-title">{stageLabel(stage)}</p>
      <p className="muted small">
        {fileName} · {seconds} s
      </p>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Anuluj
      </button>
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
  return (
    <section className="card error" role="alert">
      <p className="status-title">Nie udało się przeanalizować pliku</p>
      <p>{message}</p>
      <div className="actions">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Spróbuj ponownie
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          Wybierz inny plik
        </button>
      </div>
    </section>
  )
}
