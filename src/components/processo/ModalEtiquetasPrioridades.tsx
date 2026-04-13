import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal } from '../ui'
import { BadgeMetaCNJ } from '../shared/BadgeMetaCNJ'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { ChipEtiqueta } from '../shared/ChipEtiqueta'
import { MetaCNJ, Prioridade, type Processo } from '../../types/core'

const PRIORIDADES_ORDEM = [
  Prioridade.REU_PRESO,
  Prioridade.CRIANCA,
  Prioridade.IDOSO_70,
  Prioridade.VITIMA,
  Prioridade.JUIZO,
  Prioridade.IDOSO_60,
] as const

const META_LABELS: Record<MetaCNJ, string> = {
  [MetaCNJ.META_1]: 'Meta CNJ 1',
  [MetaCNJ.META_2]: 'Meta CNJ 2',
  [MetaCNJ.META_4]: 'Meta CNJ 4',
  [MetaCNJ.META_5]: 'Meta CNJ 5',
  [MetaCNJ.META_6]: 'Meta CNJ 6',
  [MetaCNJ.META_30]: 'Meta CNJ 30',
  [MetaCNJ.SEM_META]: 'Sem meta vinculada',
}

export function ModalEtiquetasPrioridades({
  processo,
  aberto,
  onFechar,
  onSalvar,
}: {
  processo: Processo
  aberto: boolean
  onFechar: () => void
  onSalvar: (dados: Pick<Processo, 'prioridades' | 'etiquetas' | 'metaCNJ'>) => Promise<void>
}) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [prioridades, setPrioridades] = useState<Prioridade[]>(processo.prioridades)
  const [metaCNJ, setMetaCNJ] = useState<MetaCNJ>(processo.metaCNJ)
  const [etiquetas, setEtiquetas] = useState<string[]>(processo.etiquetas)
  const [novaEtiqueta, setNovaEtiqueta] = useState('')

  useEffect(() => {
    if (!aberto) return
    setPrioridades(processo.prioridades)
    setMetaCNJ(processo.metaCNJ)
    setEtiquetas(processo.etiquetas)
    setNovaEtiqueta('')
    setErro(null)
  }, [aberto, processo])

  useEffect(() => {
    if (!aberto) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onFechar()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [aberto, onFechar])

  const limiteAtingido = etiquetas.length >= 20

  const adicionarEtiqueta = () => {
    const texto = novaEtiqueta.trim()
    if (!texto) {
      setNovaEtiqueta('')
      return
    }
    if (etiquetas.some((item) => item.toLowerCase() === texto.toLowerCase()) || limiteAtingido) {
      setNovaEtiqueta('')
      return
    }
    setEtiquetas((atual) => [...atual, texto])
    setNovaEtiqueta('')
  }

  const footer = useMemo(() => (
    <>
      <Button variant="ghost" size="sm" onClick={onFechar}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        size="sm"
        loading={salvando}
        onClick={async () => {
          setSalvando(true)
          setErro(null)
          try {
            await onSalvar({ prioridades, etiquetas, metaCNJ })
            onFechar()
          } catch {
            setErro('Não foi possível salvar prioridades e etiquetas.')
          } finally {
            setSalvando(false)
          }
        }}
      >
        Salvar
      </Button>
    </>
  ), [etiquetas, metaCNJ, onFechar, onSalvar, prioridades, salvando])

  return (
    <Modal open={aberto} onClose={onFechar} title="Etiquetas e prioridades" size="lg" footer={footer}>
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Prioridades</div>
          <div className="grid gap-3 md:grid-cols-2">
            {PRIORIDADES_ORDEM.map((prioridade) => {
              const marcada = prioridades.includes(prioridade)
              return (
                <label
                  key={prioridade}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                    marcada
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-aurora-border bg-aurora-surface'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setPrioridades((atual) => [...atual, prioridade])
                      } else {
                        setPrioridades((atual) => atual.filter((item) => item !== prioridade))
                      }
                    }}
                  />
                  <BadgePrioridade prioridade={prioridade} />
                </label>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Meta CNJ</div>
          <div className="grid gap-2">
            {(Object.keys(META_LABELS) as MetaCNJ[]).map((meta) => (
              <label
                key={meta}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
                  metaCNJ === meta
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-aurora-border bg-aurora-surface'
                }`}
              >
                <input
                  type="radio"
                  name="metaCNJ"
                  checked={metaCNJ === meta}
                  onChange={() => setMetaCNJ(meta)}
                />
                {meta === MetaCNJ.SEM_META ? (
                  <span className="text-sm text-aurora-text-secondary">{META_LABELS[meta]}</span>
                ) : (
                  <BadgeMetaCNJ meta={meta} />
                )}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Etiquetas livres</div>
          <div title={limiteAtingido ? 'Limite de 20 etiquetas atingido' : undefined}>
            <Input
              placeholder="Adicionar etiqueta..."
              value={novaEtiqueta}
              disabled={limiteAtingido}
              onChange={(event) => setNovaEtiqueta(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  adicionarEtiqueta()
                }
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {etiquetas.map((etiqueta) => (
              <ChipEtiqueta
                key={etiqueta}
                texto={etiqueta}
                onRemover={() => setEtiquetas((atual) => atual.filter((item) => item !== etiqueta))}
              />
            ))}
            {!etiquetas.length && (
              <span className="text-sm text-aurora-text-muted">Sem etiquetas.</span>
            )}
          </div>
        </section>

        {erro && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}
      </div>
    </Modal>
  )
}
