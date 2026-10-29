import { useId, useRef, useState, type DragEvent } from 'react'

type Props = { onFile: (file: File) => void; disabled?: boolean }

export function DropZone({ onFile, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file && !disabled) onFile(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files)
  }

  return (
    <div
      className={`dropzone${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3" />
      </svg>
      <p className="dropzone-title">Upuść tu plik PDF</p>
      <p className="dropzone-or">albo</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Wybierz plik
      </button>
      <p id={hintId} className="muted small">
        Tylko PDF z tekstem, maks. 10 MB
      </p>
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
