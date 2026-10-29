import { useEffect, useId, useRef, useState, type DragEvent } from 'react'

type Props = { onFile: (file: File) => void; onSample: () => void }

export function DropZone({ onFile, onSample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  // Licznik wejsc/wyjsc - dragleave odpala sie tez nad elementami w srodku strefy.
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)

  // Plik upuszczony obok strefy nie moze otworzyc sie w karcie i skasowac stanu aplikacji.
  useEffect(() => {
    const block = (event: globalThis.DragEvent) => event.preventDefault()
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    depth.current = 0
    setDragging(false)
    pick(event.dataTransfer.files)
  }

  return (
    <div
      className={`drop${dragging ? ' is-dragging' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault()
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={onDrop}
      onClick={(event) => {
        // Klikniecie w puste miejsce strefy tez otwiera wybor pliku.
        if (event.target === event.currentTarget) inputRef.current?.click()
      }}
    >
      <p className="drop-title">
        {dragging ? (
          'Puść, żeby przeanalizować'
        ) : (
          <>
            <span className="on-pointer">Upuść tu plik PDF</span>
            <span className="on-touch">Wybierz plik PDF</span>
          </>
        )}
      </p>
      <p id={hintId} className="drop-hint">
        Umowa, faktura, oferta albo raport z tekstem (nie skan), do 10 MB.
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn-ink"
          onClick={() => inputRef.current?.click()}
          aria-describedby={hintId}
        >
          Wybierz plik
        </button>
        <button type="button" className="btn btn-outline" onClick={onSample}>
          Zobacz przykładowy wynik
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          pick(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
