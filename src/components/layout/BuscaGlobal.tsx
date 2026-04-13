import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { useProcessos } from '../../hooks/useProcessos'
import { ROTAS } from '../../router/rotas'
import { TipoAudiencia, type Processo } from '../../types/core'

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiência de instrução e julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiência de custódia',
  [TipoAudiencia.PRELIMINAR]: 'Audiência preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologação',
  [TipoAudiencia.INSTRUCAO]: 'Instrução',
  [TipoAudiencia.OUTRO]: 'Outro',
}

function destacar(texto: string, busca: string) {
  if (!busca.trim()) return texto
  const indice = texto.toLowerCase().indexOf(busca.toLowerCase())
  if (indice < 0) return texto

  return (
    <>
      {texto.slice(0, indice)}
      <mark className="rounded bg-aurora-primary/25 px-0.5 text-inherit">
        {texto.slice(indice, indice + busca.length)}
      </mark>
      {texto.slice(indice + busca.length)}
    </>
  )
}

function pontuarResultado(processo: Processo, termo: string) {
  const busca = termo.toLowerCase()
  const numero = processo.numeroProcesso.toLowerCase()
  const natureza = (processo.naturezaCrime ?? '').toLowerCase()
  const etiquetas = processo.etiquetas.map((etiqueta) => etiqueta.toLowerCase())

  if (numero === busca) return 100
  if (numero.startsWith(busca)) return 80
  if (numero.includes(busca)) return 60
  if (etiquetas.some((etiqueta) => etiqueta.includes(busca))) return 40
  if (natureza.includes(busca)) return 20
  return 0
}

export function BuscaGlobal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { processos } = useProcessos()
  const [termo, setTermo] = useState('')
  const [termoDebounced, setTermoDebounced] = useState('')
  const [selecionado, setSelecionado] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => setTermoDebounced(termo.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [termo])

  useEffect(() => {
    if (!open) {
      setTermo('')
      setTermoDebounced('')
      setSelecionado(0)
    }
  }, [open])

  const resultados = useMemo(() => {
    if (!termoDebounced) return []
    return [...processos]
      .map((processo) => ({ processo, score: pontuarResultado(processo, termoDebounced) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.processo.criadoEm.getTime() - a.processo.criadoEm.getTime())
      .slice(0, 8)
      .map((item) => item.processo)
  }, [processos, termoDebounced])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (!resultados.length && event.key === 'Enter' && termoDebounced) {
        navigate(`${ROTAS.FILA}?busca=${encodeURIComponent(termoDebounced)}`)
        onClose()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelecionado((atual) => (atual + 1) % Math.max(resultados.length, 1))
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelecionado((atual) => (atual - 1 + Math.max(resultados.length, 1)) % Math.max(resultados.length, 1))
      }

      if (event.key === 'Enter' && resultados[selecionado]) {
        navigate(ROTAS.processo(resultados[selecionado].id))
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, onClose, open, resultados, selecionado, termoDebounced])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] bg-[rgba(8,8,24,0.45)] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="mx-auto mt-16 w-full max-w-3xl px-4">
        <div className="overflow-hidden rounded-3xl border border-aurora-border-light bg-aurora-surface shadow-aurora-lg">
          <div className="border-b border-aurora-border p-4">
            <div className="flex items-center gap-3 rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
              <Search size={16} className="text-aurora-text-muted" />
              <input
                autoFocus
                value={termo}
                onChange={(event) => setTermo(event.target.value)}
                placeholder="Buscar número do processo, natureza do crime ou etiqueta"
                className="w-full bg-transparent text-sm text-aurora-text-primary outline-none placeholder:text-aurora-text-muted"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {termoDebounced && resultados.length === 0 ? (
              <div className="space-y-4 px-4 py-6 text-center">
                <div className="text-sm text-aurora-text-secondary">
                  Nenhum processo encontrado para "{termoDebounced}"
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-aurora-primary hover:underline"
                  onClick={() => {
                    navigate(`${ROTAS.FILA}?busca=${encodeURIComponent(termoDebounced)}`)
                    onClose()
                  }}
                >
                  Buscar na fila completa
                </button>
              </div>
            ) : (
              resultados.map((processo, index) => (
                <button
                  key={processo.id}
                  type="button"
                  onClick={() => {
                    navigate(ROTAS.processo(processo.id))
                    onClose()
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition-colors ${
                    index === selecionado
                      ? 'bg-aurora-primary/10'
                      : 'hover:bg-aurora-elevated'
                  }`}
                >
                  <div className="font-mono text-sm font-semibold text-aurora-text-primary">
                    {destacar(processo.numeroProcesso, termoDebounced)}
                  </div>
                  <div className="mt-1 text-sm text-aurora-text-secondary">
                    {TIPO_AUDIENCIA_LABELS[processo.tipoAudiencia]} · {processo.cargoMagistrado}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {processo.prioridades.slice(0, 2).map((prioridade) => (
                      <BadgePrioridade key={`${processo.id}-${prioridade}`} prioridade={prioridade} tamanho="sm" />
                    ))}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
