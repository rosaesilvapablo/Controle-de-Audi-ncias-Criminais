import { X } from 'lucide-react'

export function corPorTexto(texto: string): string {
  const paleta = [
    '#3B4FBF', '#1D7A5F', '#7A3BBF', '#BF7A1D',
    '#BF3B3B', '#1D9E75', '#7A5F1D', '#3B7ABF',
  ]
  let hash = 0
  for (let i = 0; i < texto.length; i += 1) {
    hash = texto.charCodeAt(i) + ((hash << 5) - hash)
  }
  return paleta[Math.abs(hash) % paleta.length]
}

export function ChipEtiqueta({
  texto,
  onRemover,
  onClick,
}: {
  texto: string
  onRemover?: () => void
  onClick?: () => void
}) {
  const cor = corPorTexto(texto)
  const clickable = Boolean(onClick)

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white ${
        clickable ? 'cursor-pointer transition-opacity hover:opacity-90' : ''
      }`}
      style={{ backgroundColor: cor }}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (clickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onClick?.()
        }
      }}
    >
      <span>{texto}</span>
      {onRemover && (
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          onClick={(event) => {
            event.stopPropagation()
            onRemover()
          }}
          aria-label={`Remover etiqueta ${texto}`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  )
}
