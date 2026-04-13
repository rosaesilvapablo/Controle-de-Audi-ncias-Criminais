import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, FilterX } from 'lucide-react'
import { Button, Input, Select } from '../ui'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { BadgeMetaCNJ } from '../shared/BadgeMetaCNJ'
import type { FiltroFila, OpcaoOrdenacao } from '../../hooks/useFilaProcessos'
import { FILTRO_FILA_INICIAL } from '../../hooks/useFilaProcessos'
import { MetaCNJ, Prioridade, StatusFase, TipoAudiencia } from '../../types/core'

const STORAGE_KEY = 'scac_filtros_expandido'

const PRIORIDADES = [
  Prioridade.REU_PRESO,
  Prioridade.CRIANCA,
  Prioridade.IDOSO_70,
  Prioridade.VITIMA,
  Prioridade.JUIZO,
  Prioridade.IDOSO_60,
] as const

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiência de instrução e julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiência de custódia',
  [TipoAudiencia.PRELIMINAR]: 'Audiência preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologação',
  [TipoAudiencia.INSTRUCAO]: 'Instrução',
  [TipoAudiencia.OUTRO]: 'Outro',
}

const STATUS_LABELS: Record<StatusFase, string> = {
  [StatusFase.NAO_INICIADA]: 'Não iniciada',
  [StatusFase.EM_ANDAMENTO]: 'Em andamento',
  [StatusFase.CONCLUIDA]: 'Concluída',
  [StatusFase.COM_PENDENCIA]: 'Com pendência',
}

function temFiltroAtivo(filtro: FiltroFila) {
  return Boolean(
    filtro.busca?.trim()
    || filtro.prioridades?.length
    || filtro.metaCNJ
    || filtro.etiquetas?.length
    || filtro.tipoAudiencia
    || filtro.statusFase1
    || filtro.apenasComAlerta,
  )
}

export function PainelFiltros({
  filtro,
  ordenacao,
  totalFiltrado,
  total,
  onFiltroChange,
  onOrdenacaoChange,
  onLimpar,
}: {
  filtro: FiltroFila
  ordenacao: OpcaoOrdenacao
  totalFiltrado: number
  total: number
  onFiltroChange: (f: Partial<FiltroFila>) => void
  onOrdenacaoChange: (o: OpcaoOrdenacao) => void
  onLimpar: () => void
}) {
  const [expandido, setExpandido] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  })
  const [buscaLocal, setBuscaLocal] = useState(filtro.busca ?? '')

  useEffect(() => {
    setBuscaLocal(filtro.busca ?? '')
  }, [filtro.busca])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onFiltroChange({ busca: buscaLocal })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [buscaLocal, onFiltroChange])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, expandido ? '1' : '0')
  }, [expandido])

  const filtrosAtivos = useMemo(() => temFiltroAtivo(filtro), [filtro])

  return (
    <div className="rounded-3xl border border-aurora-border-light bg-aurora-surface p-4 shadow-aurora-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <Input
            placeholder="Buscar processo..."
            value={buscaLocal}
            onChange={(event) => setBuscaLocal(event.target.value)}
          />
        </div>

        <div className="w-full lg:w-[220px]">
          <Select
            value={`${ordenacao.campo}:${ordenacao.direcao}`}
            onChange={(event) => {
              const [campo, direcao] = event.target.value.split(':') as [OpcaoOrdenacao['campo'], OpcaoOrdenacao['direcao']]
              onOrdenacaoChange({ campo, direcao })
            }}
          >
            <option value="criadoEm:desc">Mais recentes primeiro</option>
            <option value="criadoEm:asc">Mais antigos primeiro</option>
            <option value="prescricao:asc">Prescrição mais próxima</option>
            <option value="prioridade:desc">Maior prioridade</option>
            <option value="alertas:desc">Alertas mais críticos</option>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          iconRight={expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          onClick={() => setExpandido((atual) => !atual)}
        >
          Filtros avançados
        </Button>

        <div className="text-sm text-aurora-text-secondary">
          {totalFiltrado} de {total} processos
        </div>
      </div>

      {expandido && (
        <div className="mt-4 space-y-5 border-t border-aurora-border pt-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
              Prioridades
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRIORIDADES.map((prioridade) => {
                const marcada = filtro.prioridades?.includes(prioridade) ?? false
                return (
                  <label
                    key={prioridade}
                    className={`cursor-pointer rounded-2xl border px-2 py-2 transition-colors ${
                      marcada
                        ? 'border-aurora-primary/40 bg-aurora-primary/10'
                        : 'border-aurora-border bg-aurora-elevated'
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="checkbox"
                      checked={marcada}
                      onChange={(event) => {
                        const atuais = filtro.prioridades ?? []
                        const prioridades = event.target.checked
                          ? [...atuais, prioridade]
                          : atuais.filter((item) => item !== prioridade)
                        onFiltroChange({ prioridades })
                      }}
                    />
                    <BadgePrioridade prioridade={prioridade} />
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
              Meta CNJ
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2 text-sm text-aurora-text-secondary">
                <input
                  type="radio"
                  checked={!filtro.metaCNJ}
                  onChange={() => onFiltroChange({ metaCNJ: undefined })}
                />
                <span>Todas</span>
              </label>
              {[MetaCNJ.META_1, MetaCNJ.META_2, MetaCNJ.META_4, MetaCNJ.META_5, MetaCNJ.META_6, MetaCNJ.META_30].map((meta) => (
                <label
                  key={meta}
                  className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2"
                >
                  <input
                    type="radio"
                    checked={filtro.metaCNJ === meta}
                    onChange={() => onFiltroChange({ metaCNJ: meta })}
                  />
                  <BadgeMetaCNJ meta={meta} />
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Tipo de audiência"
              value={filtro.tipoAudiencia ?? ''}
              onChange={(event) => onFiltroChange({
                tipoAudiencia: (event.target.value || undefined) as TipoAudiencia | undefined,
              })}
            >
              <option value="">Todos</option>
              {Object.entries(TIPO_AUDIENCIA_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </Select>

            <Select
              label="Status da Fase 1"
              value={filtro.statusFase1 ?? ''}
              onChange={(event) => onFiltroChange({
                statusFase1: (event.target.value || undefined) as StatusFase | undefined,
              })}
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>{label}</option>
              ))}
            </Select>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-3 text-sm text-aurora-text-secondary">
            <input
              type="checkbox"
              checked={Boolean(filtro.apenasComAlerta)}
              onChange={(event) => onFiltroChange({ apenasComAlerta: event.target.checked })}
            />
            <span>
              <span className="block font-medium text-aurora-text-primary">
                Apenas processos com alerta
              </span>
              <span className="mt-1 block text-xs text-aurora-text-muted">
                Considera alertas de prescrição e cartas precatórias em atraso.
              </span>
            </span>
          </label>

          {filtrosAtivos && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                icon={<FilterX size={14} />}
                onClick={() => {
                  setBuscaLocal(FILTRO_FILA_INICIAL.busca ?? '')
                  onLimpar()
                }}
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
