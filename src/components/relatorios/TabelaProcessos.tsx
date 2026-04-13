import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine } from 'lucide-react'
import { Card, Button } from '../ui'
import { BadgePrioridade } from '../shared/BadgePrioridade'
import { ChipEtiqueta } from '../shared/ChipEtiqueta'
import { BadgeStatusFase } from '../shared/BadgeStatusFase'
import { ROTAS } from '../../router/rotas'
import { calcularAlertasPrescricao } from '../../utils/alertas'
import { exportarParaCSV, formatarDataRelatorio, processosParaCSV } from '../../utils/exportacao'
import { TipoAlerta, type Processo } from '../../types/core'

export type ColunaTabelaProcesso =
  | 'numeroProcesso'
  | 'tipoAudiencia'
  | 'cargoMagistrado'
  | 'naturezaCrime'
  | 'metaCNJ'
  | 'prioridades'
  | 'etiquetas'
  | 'statusFase1'
  | 'statusFase2'
  | 'statusFase3'
  | 'prescricao'
  | 'criadoEm'

const LABEL_COLUNAS: Record<ColunaTabelaProcesso, string> = {
  numeroProcesso: 'Nº Processo',
  tipoAudiencia: 'Tipo',
  cargoMagistrado: 'Cargo',
  naturezaCrime: 'Natureza do crime',
  metaCNJ: 'Meta CNJ',
  prioridades: 'Prioridades',
  etiquetas: 'Etiquetas',
  statusFase1: 'Fase 1',
  statusFase2: 'Fase 2',
  statusFase3: 'Fase 3',
  prescricao: 'Prescricao',
  criadoEm: 'Criado em',
}

function celulaPrescricao(processo: Processo) {
  const limite = processo.prescricao.dataLimite
  if (!limite) return <span className="text-aurora-text-muted">—</span>

  const alerta = calcularAlertasPrescricao(processo.id, processo.numeroProcesso, processo.prescricao)[0]
  let classe = 'text-aurora-text-secondary'
  if (alerta?.tipo === TipoAlerta.PRESCRICAO_VENCIDA || alerta?.tipo === TipoAlerta.PRESCRICAO_7_DIAS) classe = 'text-aurora-red'
  if (alerta?.tipo === TipoAlerta.PRESCRICAO_30_DIAS) classe = 'text-aurora-amber'
  if (alerta?.tipo === TipoAlerta.PRESCRICAO_90_DIAS) classe = 'text-yellow-300'

  return (
    <span className={classe}>
      {formatarDataRelatorio(limite)}
    </span>
  )
}

export function TabelaProcessos({
  processos,
  colunas,
  onClickProcesso,
  exportavel,
  nomeExportacao = 'relatorio-processos',
}: {
  processos: Processo[]
  colunas: ColunaTabelaProcesso[]
  onClickProcesso?: (id: string) => void
  exportavel?: boolean
  nomeExportacao?: string
}) {
  const navigate = useNavigate()

  if (!processos.length) {
    return (
      <Card>
        <p className="text-sm text-aurora-text-muted">Nenhum processo neste relatório.</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      {exportavel && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => exportarParaCSV(processosParaCSV(processos), nomeExportacao)}
          >
            Exportar CSV
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aurora-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-aurora-border bg-aurora-elevated text-left text-aurora-text-muted">
              {colunas.map((coluna) => (
                <th key={coluna} className="px-3 py-2">{LABEL_COLUNAS[coluna]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processos.map((processo) => (
              <tr
                key={processo.id}
                className="cursor-pointer border-b border-aurora-border/70 hover:bg-aurora-elevated/40"
                onClick={() => {
                  onClickProcesso?.(processo.id)
                  navigate(ROTAS.processo(processo.id))
                }}
              >
                {colunas.map((coluna) => (
                  <td key={`${processo.id}-${coluna}`} className="px-3 py-2 align-top">
                    {coluna === 'numeroProcesso' && <span className="font-mono">{processo.numeroProcesso}</span>}
                    {coluna === 'tipoAudiencia' && processo.tipoAudiencia}
                    {coluna === 'cargoMagistrado' && processo.cargoMagistrado}
                    {coluna === 'naturezaCrime' && (processo.naturezaCrime || '—')}
                    {coluna === 'metaCNJ' && processo.metaCNJ}
                    {coluna === 'prioridades' && (
                      <div className="flex flex-wrap gap-1">
                        {processo.prioridades.slice(0, 2).map((prioridade) => (
                          <BadgePrioridade key={prioridade} prioridade={prioridade} tamanho="sm" />
                        ))}
                        {processo.prioridades.length > 2 && (
                          <span className="text-xs text-aurora-text-muted">+{processo.prioridades.length - 2}</span>
                        )}
                      </div>
                    )}
                    {coluna === 'etiquetas' && (
                      <div className="flex flex-wrap gap-1">
                        {processo.etiquetas.slice(0, 2).map((etiqueta) => (
                          <ChipEtiqueta key={etiqueta} texto={etiqueta} />
                        ))}
                        {processo.etiquetas.length > 2 && (
                          <span className="text-xs text-aurora-text-muted">+{processo.etiquetas.length - 2}</span>
                        )}
                      </div>
                    )}
                    {coluna === 'statusFase1' && <BadgeStatusFase status={processo.fases.fase1} rotulo="Fase 1" />}
                    {coluna === 'statusFase2' && <BadgeStatusFase status={processo.fases.fase2} rotulo="Fase 2" />}
                    {coluna === 'statusFase3' && <BadgeStatusFase status={processo.fases.fase3} rotulo="Fase 3" />}
                    {coluna === 'prescricao' && celulaPrescricao(processo)}
                    {coluna === 'criadoEm' && formatarDataRelatorio(processo.criadoEm)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
