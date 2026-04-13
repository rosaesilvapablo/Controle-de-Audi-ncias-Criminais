import { ArrowRight, Bell, Clock3, Mail } from 'lucide-react'
import { Button, Card } from '../ui'
import { BadgeMetaCNJ } from '../shared/BadgeMetaCNJ'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { BadgeStatusFase } from '../shared/BadgeStatusFase'
import { ChipEtiqueta } from '../shared/ChipEtiqueta'
import { consolidarAlertas } from '../../utils/alertas'
import { Prioridade, StatusFase, TipoAlerta, TipoAudiencia, type Processo } from '../../types/core'

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiência de instrução e julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiência de custódia',
  [TipoAudiencia.PRELIMINAR]: 'Audiência preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologação',
  [TipoAudiencia.INSTRUCAO]: 'Instrução',
  [TipoAudiencia.OUTRO]: 'Outro',
}

function bordaPorPrioridade(prioridades: Prioridade[], encerrado: boolean) {
  if (encerrado) {
    return '#1D9E75'
  }
  if (prioridades.includes(Prioridade.REU_PRESO) || prioridades.includes(Prioridade.CRIANCA)) {
    return '#E05252'
  }
  if (prioridades.includes(Prioridade.IDOSO_70) || prioridades.includes(Prioridade.VITIMA)) {
    return '#EF9F27'
  }
  if (prioridades.includes(Prioridade.JUIZO)) {
    return '#534AB7'
  }
  if (prioridades.includes(Prioridade.IDOSO_60)) {
    return '#D79A2B'
  }
  return 'transparent'
}

export function CardProcessoFila({
  processo,
  onClick,
}: {
  processo: Processo
  onClick: () => void
}) {
  const prioridadesVisiveis = processo.prioridades.slice(0, 3)
  const excessoPrioridades = Math.max(0, processo.prioridades.length - prioridadesVisiveis.length)
  const etiquetasVisiveis = processo.etiquetas.slice(0, 3)
  const excessoEtiquetas = Math.max(0, processo.etiquetas.length - etiquetasVisiveis.length)
  const alertas = consolidarAlertas(processo, [])
  const encerrado = processo.fases.fase3 === StatusFase.CONCLUIDA
  const corBorda = bordaPorPrioridade(processo.prioridades, encerrado)

  const alertaPrescricao = alertas.find((alerta) =>
    alerta.tipo === TipoAlerta.PRESCRICAO_VENCIDA
    || alerta.tipo === TipoAlerta.PRESCRICAO_7_DIAS
    || alerta.tipo === TipoAlerta.PRESCRICAO_30_DIAS
    || alerta.tipo === TipoAlerta.PRESCRICAO_90_DIAS,
  )

  const alertaCarta = alertas.find((alerta) =>
    alerta.tipo === TipoAlerta.CARTA_PRECATORIA_40_DIAS
    || alerta.tipo === TipoAlerta.CARTA_PRECATORIA_30_DIAS,
  )
  const tituloCartaGenerica = processo.totalCartasPrecatoriasEmAlerta > 0
    ? `${processo.totalCartasPrecatoriasEmAlerta} carta(s) precatória(s) em alerta`
    : null

  const temLinhaAlertas = Boolean(alertaPrescricao || alertaCarta || tituloCartaGenerica || processo.totalIntimacoesPendentes > 0)

  return (
    <div className="rounded-[28px] border-l-4 transition-transform duration-150 hover:-translate-y-0.5" style={{ borderLeftColor: corBorda }}>
      <Card className="cursor-pointer border-aurora-border-light hover:border-aurora-primary/30 hover:shadow-aurora-md" onClick={onClick}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {prioridadesVisiveis.map((prioridade) => (
              <BadgePrioridade key={prioridade} prioridade={prioridade} tamanho="sm" />
            ))}
            {excessoPrioridades > 0 && (
              <span className="inline-flex items-center rounded-full border border-aurora-border bg-aurora-elevated px-2 py-1 text-[11px] font-medium text-aurora-text-secondary">
                +{excessoPrioridades}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="break-all font-mono text-lg font-semibold text-aurora-text-primary">
                {processo.numeroProcesso}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <BadgeMetaCNJ meta={processo.metaCNJ} />
              </div>
              <div className="mt-2 text-sm text-aurora-text-secondary">
                {TIPO_AUDIENCIA_LABELS[processo.tipoAudiencia]} · {processo.cargoMagistrado}
              </div>
              {processo.naturezaCrime && (
                <div className="mt-1 text-sm text-aurora-text-secondary">{processo.naturezaCrime}</div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {etiquetasVisiveis.map((etiqueta) => (
              <ChipEtiqueta key={etiqueta} texto={etiqueta} />
            ))}
            {excessoEtiquetas > 0 && (
              <span className="inline-flex items-center rounded-full border border-aurora-border bg-aurora-elevated px-3 py-1 text-xs font-medium text-aurora-text-secondary">
                +{excessoEtiquetas} etiquetas
              </span>
            )}
          </div>

          <div className="border-t border-aurora-border pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-aurora-text-secondary">
              Fase 1: <span className="inline-flex align-middle"><BadgeStatusFase status={processo.fases.fase1} rotulo="Fase 1" /></span>
              {encerrado && (
                <span className="inline-flex rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-2xs font-medium text-green-700">
                  Encerrado
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {temLinhaAlertas ? (
              <div className="flex flex-wrap items-center gap-2">
                {alertaPrescricao && (
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                      alertaPrescricao.tipo === TipoAlerta.PRESCRICAO_VENCIDA || alertaPrescricao.tipo === TipoAlerta.PRESCRICAO_7_DIAS
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : alertaPrescricao.tipo === TipoAlerta.PRESCRICAO_30_DIAS
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : 'border-yellow-300 bg-yellow-50 text-yellow-700'
                    }`}
                    title={alertaPrescricao.mensagem}
                  >
                    <Clock3 size={14} />
                  </span>
                )}

                {(alertaCarta || tituloCartaGenerica) && (
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                      alertaCarta?.tipo === TipoAlerta.CARTA_PRECATORIA_40_DIAS
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : 'border-amber-300 bg-amber-50 text-amber-700'
                    }`}
                    title={alertaCarta?.mensagem ?? tituloCartaGenerica ?? ''}
                  >
                    <Mail size={14} />
                  </span>
                )}

                {processo.totalIntimacoesPendentes > 0 && (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700"
                    title={`${processo.totalIntimacoesPendentes} intimação(ões) pendente(s)`}
                  >
                    <Bell size={14} />
                  </span>
                )}
              </div>
            ) : (
              <div />
            )}

            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={14} />} onClick={onClick}>
              Abrir
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
