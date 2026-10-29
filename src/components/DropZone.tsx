import { useId, useRef, useState, type DragEvent } from 'react'

type Props = { onFile: (file: File) => void; onSample: () => void }

export function DropZone({ onFile, onSample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files)
  }

  return (
    <div
      className={`drop${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p className="drop-title">{dragging ? 'Puść, żeby przeanalizować' : 'Upuść tu plik PDF'}</p>
      <p id={hintId} className="drop-hint">
        Umowa, faktura, oferta albo raport z warstwą tekstową, do 10 MB.
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
