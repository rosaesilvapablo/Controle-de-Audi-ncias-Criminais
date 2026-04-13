import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Play, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Badge, Button, Card, TrilhaAuditoria } from '../../components/ui'
import {
  formatarHorario,
  validarTransicaoEstado,
} from '../../lib/audienciaHelpers'
import type { Audiencia, Procedimento } from '../../types'
import {
  ADVOGADO_TIPO_LABELS,
  CLASSE_PROCESSUAL_LABELS,
  OBJETO_FEITO_LABELS,
  STATUS_AUDIENCIA_LABELS,
  TIPO_AUDIENCIA_LABELS,
} from '../../types'

interface PainelAudienciaProps {
  audiencia: Audiencia
  procedimento: Procedimento | null
  podeEditar: boolean
  podeEditarAudiencia: boolean
  podeCancelarAudiencia: boolean
  podeExcluirAudiencia: boolean
  podeVerSigilo: boolean
  podeAlterarSigilo: boolean
  onIniciar: () => void
  onEncerrar: () => void
  onEditar: () => void
  onExcluir: () => void
  onRemarcar: () => void
  onCancelar: () => void
  onChecklist: () => void
  onAlternarSigilo: (sigiloso: boolean) => void
  onVoltar: () => void
}

function campo(label: string, valor: string, destaque?: string) {
  return (
    <div className="rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2">
      <div className="text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
        {label}
      </div>
      <div className={`mt-1 text-sm ${destaque ?? 'text-aurora-text-primary'}`}>
        {valor}
      </div>
    </div>
  )
}

export function PainelAudiencia({
  audiencia,
  procedimento,
  podeEditar,
  podeEditarAudiencia,
  podeCancelarAudiencia,
  podeExcluirAudiencia,
  podeVerSigilo,
  podeAlterarSigilo,
  onIniciar,
  onEncerrar,
  onEditar,
  onExcluir,
  onRemarcar,
  onCancelar,
  onChecklist,
  onAlternarSigilo,
  onVoltar,
}: PainelAudienciaProps) {
  const navigate = useNavigate()
  const [trilhaAberta, setTrilhaAberta] = useState(false)

  const iniciarEstado = validarTransicaoEstado(
    'iniciar',
    audiencia.status,
    procedimento,
  )
  const encerrarEstado = validarTransicaoEstado(
    'encerrar',
    audiencia.status,
    procedimento,
  )
  const remarcarEstado = validarTransicaoEstado(
    'remarcar',
    audiencia.status,
    procedimento,
  )
  const cancelarEstado = validarTransicaoEstado(
    'cancelar',
    audiencia.status,
    procedimento,
  )

  const duracao = Math.round(
    (audiencia.dataHoraFim.toDate().getTime() -
      audiencia.dataHoraInicio.toDate().getTime()) /
      60000,
  )

  const progresso = procedimento?.progresso ?? 0
  const itensConcluidos = procedimento?.itensConcluidos ?? 0
  const totalItens = procedimento?.totalItens ?? 0
  const obrigatoriosPendentes = procedimento?.itensCriticosPendentes ?? 0
  const sigiloBloqueado = Boolean(audiencia.sigiloso && !podeVerSigilo)

  if (sigiloBloqueado) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-aurora-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-sm text-aurora-text-primary">
                Reservado - Processo Sigiloso
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge statusAudiencia={audiencia.status}>
                  {STATUS_AUDIENCIA_LABELS[audiencia.status]}
                </Badge>
                <Badge variant="danger">Sigiloso</Badge>
              </div>
            </div>

            <div className="text-right text-xs text-aurora-text-muted">
              <div className="font-semibold text-aurora-text-primary">
                {formatarHorario(audiencia.dataHoraInicio)} as{' '}
                {formatarHorario(audiencia.dataHoraFim)}
              </div>
              <div className="mt-1">{audiencia.salaNome ?? 'Sala'}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <Card padding="sm" className="border-aurora-border bg-aurora-elevated">
              <div className="text-sm text-aurora-text-secondary">
                Este processo esta marcado como sigiloso. Apenas horario e sala permanecem visiveis para este perfil.
              </div>
            </Card>
            <div className="grid gap-2">
              {campo('Sala', audiencia.salaNome ?? 'Nao informada')}
              {campo('Horario', `${formatarHorario(audiencia.dataHoraInicio)} as ${formatarHorario(audiencia.dataHoraFim)}`)}
            </div>
          </div>
        </div>

        <div className="border-t border-aurora-border p-4">
          <Button size="sm" variant="ghost" onClick={onVoltar}>
            ← Voltar a pauta
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-sm text-aurora-text-primary">
              {audiencia.numeroProcesso}
            </div>
            <div className="mt-1 text-xs text-aurora-text-muted">
              {CLASSE_PROCESSUAL_LABELS[audiencia.classeProcessual]} ·{' '}
              {OBJETO_FEITO_LABELS[audiencia.objetoDoFeito]}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="primary">
                {TIPO_AUDIENCIA_LABELS[audiencia.tipo]}
              </Badge>
              <Badge statusAudiencia={audiencia.status}>
                {STATUS_AUDIENCIA_LABELS[audiencia.status]}
              </Badge>
              {audiencia.sigiloso && <Badge variant="danger">Sigiloso</Badge>}
            </div>
          </div>

          <div className="text-right text-xs text-aurora-text-muted">
            <div className="font-semibold text-aurora-text-primary">
              {formatarHorario(audiencia.dataHoraInicio)} às{' '}
              {formatarHorario(audiencia.dataHoraFim)}
            </div>
            <div className="mt-1">{audiencia.salaNome ?? 'Sala'}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          <div>
            {podeAlterarSigilo && (
              <Card padding="sm" className="mb-4 border-aurora-border bg-aurora-elevated">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-aurora-text-primary">
                      Sigilo
                    </div>
                    <div className="mt-1 text-xs text-aurora-text-muted">
                      Processo ficara oculto para usuarios nao autorizados.
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-aurora-text-secondary">
                    <input
                      type="checkbox"
                      checked={Boolean(audiencia.sigiloso)}
                      onChange={(event) => onAlternarSigilo(event.target.checked)}
                    />
                    Marcar sigilo
                  </label>
                </div>
              </Card>
            )}
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              O que deseja fazer
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {podeEditarAudiencia && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onEditar}
                  >
                    Editar audiencia
                  </Button>
                )}
                {podeEditar && iniciarEstado.permitido && (
                  <Button
                    variant="success"
                    size="sm"
                    icon={<Play size={14} />}
                    onClick={onIniciar}
                  >
                    Iniciar audiência
                  </Button>
                )}
                {podeEditar && encerrarEstado.permitido && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Square size={14} />}
                    onClick={onEncerrar}
                  >
                    Encerrar
                  </Button>
                )}
                {podeEditar && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<RefreshCw size={14} />}
                    onClick={onRemarcar}
                    disabled={!remarcarEstado.permitido}
                    title={remarcarEstado.mensagem}
                  >
                    Remarcar
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={onChecklist}>
                  Abrir checklist
                </Button>
                {podeExcluirAudiencia && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    title="Excluir permanentemente"
                    onClick={onExcluir}
                  >
                    Excluir
                  </Button>
                )}
                {podeCancelarAudiencia && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={onCancelar}
                    disabled={!cancelarEstado.permitido}
                    title={cancelarEstado.mensagem}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Dados da audiência
            </div>
            <div className="grid gap-2">
              {campo('Magistrado', audiencia.magistradoNome ?? 'Não informado')}
              {campo('Sala', audiencia.salaNome ?? 'Não informada')}
              {campo('Duração estimada', `${duracao} minutos`)}
              {audiencia.classeProcessual === 'carta_precatoria_criminal' &&
                audiencia.juizoDeprecante &&
                campo('Juízo Deprecante', audiencia.juizoDeprecante)}
              {campo(
                'Réu preso',
                audiencia.reuPreso ? 'Sim' : 'Não',
                audiencia.reuPreso ? 'text-aurora-red' : 'text-aurora-green',
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Réus / Depoimentos pessoais
            </div>
            <Card padding="sm">
              {audiencia.reus?.length ? (
                <div className="space-y-2">
                  {audiencia.reus.map((reu, index) => (
                    <div
                      key={`${reu.nome}-${index}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-aurora-text-primary">
                        {reu.nome}
                      </span>
                      {reu.preso && <Badge variant="danger">Preso</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-aurora-text-muted">
                  Nenhum réu informado.
                </div>
              )}
            </Card>
          </div>

          {audiencia.vitimas?.length > 0 && (
            <div>
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
                Vítimas
              </div>
              <Card padding="sm">
                <div className="space-y-2 text-sm text-aurora-text-primary">
                  {audiencia.vitimas.map((vitima, index) => (
                    <div key={`${vitima}-${index}`}>{vitima}</div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Advogados
            </div>
            <Card padding="sm">
              {audiencia.advogados?.length ? (
                <div className="space-y-2">
                  {audiencia.advogados.map((advogado, index) => (
                    <div
                      key={`${advogado.nome}-${advogado.oab}-${index}`}
                      className="text-sm text-aurora-text-primary"
                    >
                      <div>{advogado.nome}</div>
                      <div className="text-xs text-aurora-text-muted">
                        OAB {advogado.oab} · {ADVOGADO_TIPO_LABELS[advogado.tipo]}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-aurora-text-muted">
                  Nenhum advogado informado.
                </div>
              )}
            </Card>
          </div>

          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Situação do checklist
            </div>
            <Card padding="sm">
              <div className="h-2 overflow-hidden rounded-full bg-aurora-elevated">
                <div
                  className="h-full rounded-full bg-aurora-primary"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-aurora-text-secondary">
                {itensConcluidos} de {totalItens} itens preenchidos ·{' '}
                {obrigatoriosPendentes} obrigatório(s) em aberto
              </div>
              {procedimento && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/procedimentos/${procedimento.id}`)}
                  >
                    Abrir checklist completo
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setTrilhaAberta((atual) => !atual)}
              className="flex w-full items-center justify-between rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-3 text-left"
            >
              <span className="text-sm font-medium text-aurora-text-primary">
                Histórico de alterações
              </span>
              {trilhaAberta ? (
                <ChevronUp size={14} className="text-aurora-text-muted" />
              ) : (
                <ChevronDown size={14} className="text-aurora-text-muted" />
              )}
            </button>

            {trilhaAberta && (
              <div className="mt-3">
                <TrilhaAuditoria
                  colecao="audiencias"
                  documentoId={audiencia.id}
                  maxItens={8}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-aurora-border p-4">
        <Button size="sm" variant="ghost" onClick={onVoltar}>
          ← Voltar à pauta
        </Button>
      </div>
    </div>
  )
}
