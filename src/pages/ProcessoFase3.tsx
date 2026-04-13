import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Copy, Save, XCircle } from 'lucide-react'
import { ModalVisualizarModelo } from '../components/modelos/ModalVisualizarModelo'
import { BadgeStatusFase } from '../components/shared/BadgeStatusFase'
import { Button, Card, EmptyState, Input, Select, Textarea } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useIntimacoes } from '../hooks/useIntimacoes'
import { useModelosDocumentos } from '../hooks/useModelosDocumentos'
import { useProcesso } from '../hooks/useProcesso'
import { ROTAS } from '../router/rotas'
import {
  MotivoNaoRealizacao,
  StatusFase,
  StatusIntimacao,
  type Fase3,
} from '../types/core'
import { aplicarContexto, contextoDoProcesso, extrairVariaveis } from '../utils/modelos'
import { verificarAntecedencia } from '../utils/validacoes'

type ChecklistRealizacaoKey = keyof NonNullable<Fase3['checklistRealizacao']>
type ChecklistNaoRealizacaoKey = keyof NonNullable<Fase3['checklistNaoRealizacao']>
type Fase3Extras = {
  checklistRealizacaoTimestamps?: Partial<Record<ChecklistRealizacaoKey, Date>>
  checklistNaoRealizacaoTimestamps?: Partial<Record<ChecklistNaoRealizacaoKey, Date>>
}

const CHECKLIST_REALIZACAO: Array<{ chave: ChecklistRealizacaoKey; rotulo: string }> = [
  { chave: 'ataAssinada', rotulo: 'Ata assinada' },
  { chave: 'midiaJuntada', rotulo: 'Midia juntada' },
  { chave: 'cadastroPjeRealizado', rotulo: 'Cadastro no PJe realizado' },
  { chave: 'intimacoesRealizadas', rotulo: 'Intimacoes pos-audiencia realizadas' },
  { chave: 'etiquetaPjeAtualizada', rotulo: 'Etiqueta do PJe atualizada' },
]

const CHECKLIST_NAO_REALIZACAO: Array<{ chave: ChecklistNaoRealizacaoKey; rotulo: string }> = [
  { chave: 'calendarioAtualizado', rotulo: 'Calendario atualizado' },
  { chave: 'relatorioIntimacoesElaborado', rotulo: 'Relatorio de intimacoes elaborado' },
  { chave: 'etiquetaPjeAtualizada', rotulo: 'Etiqueta do PJe atualizada' },
]

function toDateInput(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

function toTimeInput(data?: Date) {
  return data ? data.toTimeString().slice(0, 5) : ''
}

function formatarDataHora(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data)
}

function combinarDataHora(data: string, hora: string) {
  if (!data) return undefined
  if (!hora) return new Date(`${data}T00:00:00`)
  return new Date(`${data}T${hora}:00`)
}

function fase3PossuiDados(fase3: Fase3 | null) {
  if (!fase3) return false

  const checklistRealizacaoPreenchido = Boolean(
    fase3.checklistRealizacao
    && Object.values(fase3.checklistRealizacao).some(Boolean),
  )
  const checklistNaoRealizacaoPreenchido = Boolean(
    fase3.checklistNaoRealizacao
    && Object.values(fase3.checklistNaoRealizacao).some(Boolean),
  )

  return Boolean(
    checklistRealizacaoPreenchido
    || checklistNaoRealizacaoPreenchido
    || fase3.determinacoesAudiencia
    || fase3.modeloAtaUtilizadoId
    || fase3.motivoNaoRealizacao
    || fase3.novaData
    || fase3.observacoes,
  )
}

export default function ProcessoFase3() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    processo,
    fase2,
    fase3,
    intimacoes,
    carregando,
    erro,
    atualizarFase3,
    atualizarProcesso,
  } = useProcesso(id)
  const { registrarCumprimento } = useIntimacoes(id)
  const { modelos, carregando: carregandoModelos } = useModelosDocumentos()

  const fase3ComExtras = fase3 as (Fase3 & Fase3Extras) | null
  const observacoesTimerRef = useRef<number | null>(null)
  const determinacoesTimerRef = useRef<number | null>(null)

  const [trocaPendente, setTrocaPendente] = useState<boolean | null>(null)
  const [novaDataInput, setNovaDataInput] = useState('')
  const [novaHoraInput, setNovaHoraInput] = useState('')
  const [salvandoNovaData, setSalvandoNovaData] = useState(false)
  const [avisoNovaData, setAvisoNovaData] = useState<string | null>(null)
  const [abrirModelo, setAbrirModelo] = useState(false)
  const [avisoFinalizacao, setAvisoFinalizacao] = useState<string[]>([])
  const [confirmarFinalizacao, setConfirmarFinalizacao] = useState(false)

  useEffect(() => {
    if (!fase3?.novaData) {
      setNovaDataInput('')
      setNovaHoraInput('')
      return
    }
    setNovaDataInput(toDateInput(fase3.novaData))
    setNovaHoraInput(toTimeInput(fase3.novaData))
  }, [fase3?.novaData])

  useEffect(() => () => {
    if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
    if (determinacoesTimerRef.current) window.clearTimeout(determinacoesTimerRef.current)
  }, [])

  const pendentesIntimacoes = useMemo(
    () => intimacoes.filter((item) => item.status === StatusIntimacao.PENDENTE),
    [intimacoes],
  )

  const checklistRealizacao = fase3?.checklistRealizacao ?? {
    ataAssinada: false,
    midiaJuntada: false,
    cadastroPjeRealizado: false,
    intimacoesRealizadas: false,
    etiquetaPjeAtualizada: false,
  }
  const checklistNaoRealizacao = fase3?.checklistNaoRealizacao ?? {
    calendarioAtualizado: false,
    relatorioIntimacoesElaborado: false,
    etiquetaPjeAtualizada: false,
  }

  const checklistRealizacaoCompleto = Object.values(checklistRealizacao).every(Boolean)
  const checklistNaoRealizacaoCompleto = Object.values(checklistNaoRealizacao).every(Boolean)

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <Card className="space-y-4">
          <div className="h-6 w-52 animate-pulse rounded bg-aurora-border" />
          <div className="h-10 w-64 animate-pulse rounded bg-aurora-border" />
          <div className="h-5 w-32 animate-pulse rounded bg-aurora-border" />
        </Card>
      </div>
    )
  }

  if (erro || !processo) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <EmptyState
          title={erro ? 'Nao foi possivel carregar a Fase 3' : 'Processo nao encontrado'}
          description={erro ?? 'Nao localizamos os dados da Fase 3 para este processo.'}
          action={(
            <Button variant="primary" size="sm" onClick={() => navigate(ROTAS.FILA)}>
              Voltar para a fila
            </Button>
          )}
        />
      </div>
    )
  }

  async function limparPorTrocaDesfecho(novaRealizada: boolean) {
    if (novaRealizada) {
      await atualizarFase3({
        realizada: true,
        motivoNaoRealizacao: undefined,
        novaData: undefined,
        checklistNaoRealizacao: undefined,
      } as Partial<Fase3>)
      return
    }

    await atualizarFase3({
      realizada: false,
      checklistRealizacao: undefined,
      determinacoesAudiencia: undefined,
      modeloAtaUtilizadoId: undefined,
    } as Partial<Fase3>)
  }

  const statusAtual = processo.fases.fase3
  const realizada = fase3?.realizada
  const modelosAtivos = useMemo(
    () => modelos.filter((item) => !item.arquivado),
    [modelos],
  )
  const selectedModelo = useMemo(
    () => modelos.find((item) => item.id === fase3?.modeloAtaUtilizadoId) ?? null,
    [fase3?.modeloAtaUtilizadoId, modelos],
  )
  const contextoModelo = useMemo(() => contextoDoProcesso(processo, fase2), [fase2, processo])
  const conteudoModeloPreenchido = useMemo(() => {
    if (!selectedModelo) return ''
    return aplicarContexto(selectedModelo.conteudo, contextoModelo)
  }, [contextoModelo, selectedModelo])
  const variaveisSemDados = useMemo(() => {
    if (!selectedModelo) return []

    const nomes = Array.from(new Set([
      ...extrairVariaveis(selectedModelo.conteudo),
      ...selectedModelo.variaveis,
    ]))

    return nomes.filter((nome) => {
      const valor = contextoModelo[nome as keyof typeof contextoModelo]
      return !valor || valor.trim().length === 0
    })
  }, [contextoModelo, selectedModelo])

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <Card className="sticky top-[calc(var(--topbar-height,112px)+0.5rem)] z-10 border-aurora-border-light bg-aurora-surface/95 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link to={ROTAS.processo(id)} className="font-mono text-lg font-semibold text-aurora-primary hover:underline">
              {processo.numeroProcesso}
            </Link>
            <div className="mt-1 text-sm text-aurora-text-secondary">Fase 3 - Pos-audiencia</div>
          </div>
          <BadgeStatusFase status={statusAtual} rotulo="Fase 3" />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">O que ocorreu com esta audiencia?</div>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className={`rounded-2xl border p-4 text-left transition ${realizada === true ? 'border-aurora-primary bg-aurora-primary/10' : 'border-aurora-border bg-aurora-elevated'}`}
            onClick={async () => {
              if (realizada === true) return
              if (fase3PossuiDados(fase3)) {
                setTrocaPendente(true)
                return
              }
              await atualizarFase3({ realizada: true })
            }}
          >
            <div className="flex items-center gap-2 text-aurora-text-primary">
              <CheckCircle2 size={18} /> Audiencia realizada
            </div>
          </button>

          <button
            type="button"
            className={`rounded-2xl border p-4 text-left transition ${realizada === false ? 'border-aurora-primary bg-aurora-primary/10' : 'border-aurora-border bg-aurora-elevated'}`}
            onClick={async () => {
              if (realizada === false) return
              if (fase3PossuiDados(fase3)) {
                setTrocaPendente(false)
                return
              }
              await atualizarFase3({ realizada: false })
            }}
          >
            <div className="flex items-center gap-2 text-aurora-text-primary">
              <XCircle size={18} /> Audiencia nao realizada
            </div>
          </button>
        </div>

        {trocaPendente !== null && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Alterar o desfecho limpara os dados ja preenchidos nesta fase. Confirmar?
            <div className="mt-3 flex gap-2">
              <Button size="xs" variant="ghost" onClick={() => setTrocaPendente(null)}>Cancelar</Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={async () => {
                  const novoValor = trocaPendente
                  setTrocaPendente(null)
                  await limparPorTrocaDesfecho(novoValor)
                }}
              >
                Confirmar troca
              </Button>
            </div>
          </div>
        )}
      </Card>

      {realizada === true && (
        <>
          <Card className="space-y-4">
            <div className="text-sm font-semibold text-aurora-text-primary">Providencias pos-audiencia</div>
            <div className="space-y-3">
              {CHECKLIST_REALIZACAO.map((item) => (
                <div key={item.chave} className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
                  <label className="flex items-start gap-3 text-sm text-aurora-text-secondary">
                    <input
                      type="checkbox"
                      checked={checklistRealizacao[item.chave]}
                      onChange={async (event) => {
                        const marcado = event.target.checked
                        const proximoChecklist = {
                          ...checklistRealizacao,
                          [item.chave]: marcado,
                        }
                        const proximosTimestamps = {
                          ...(fase3ComExtras?.checklistRealizacaoTimestamps ?? {}),
                          [item.chave]: marcado ? new Date() : undefined,
                        }

                        if (item.chave === 'intimacoesRealizadas' && marcado && pendentesIntimacoes.length > 0) {
                          for (const intimacao of pendentesIntimacoes) {
                            await registrarCumprimento(intimacao.id, StatusIntimacao.POSITIVA, new Date())
                          }
                        }

                        await atualizarFase3({
                          checklistRealizacao: proximoChecklist,
                          ...(proximosTimestamps ? { checklistRealizacaoTimestamps: proximosTimestamps } : {}),
                        } as Partial<Fase3>)
                      }}
                    />
                    <span>
                      <span className="block font-medium text-aurora-text-primary">{item.rotulo}</span>
                      {fase3ComExtras?.checklistRealizacaoTimestamps?.[item.chave] && (
                        <span className="mt-1 block text-xs text-aurora-text-muted">
                          Marcado em {formatarDataHora(fase3ComExtras.checklistRealizacaoTimestamps[item.chave] as Date)}
                        </span>
                      )}
                    </span>
                  </label>

                  {item.chave === 'intimacoesRealizadas' && (
                    <div className="mt-2">
                      {processo.totalIntimacoesPendentes > 0 ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          Atencao: ainda ha {processo.totalIntimacoesPendentes} intimacao(oes) pendente(s) neste processo.
                          <Link to={ROTAS.INTIMACOES} className="ml-1 font-medium underline">Ver intimacoes →</Link>
                        </div>
                      ) : (
                        <div className="text-sm text-green-700">Todas as intimacoes estao cumpridas ✓</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {checklistRealizacaoCompleto && (
              <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
                Checklist pos-audiencia completo
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Determinacoes feitas em audiencia</div>
            <p className="text-xs text-aurora-text-muted">
              Registre aqui as determinacoes e decisoes proferidas neste ato.
            </p>
            <Textarea
              rows={7}
              maxLength={3000}
              placeholder="Ex: Determinado o envio de oficio..."
              value={fase3?.determinacoesAudiencia ?? ''}
              onChange={(event) => {
                const valor = event.target.value
                if (determinacoesTimerRef.current) window.clearTimeout(determinacoesTimerRef.current)
                determinacoesTimerRef.current = window.setTimeout(() => {
                  void atualizarFase3({ determinacoesAudiencia: valor.trim() || undefined })
                }, 1500)
              }}
            />
            <div className="text-right text-2xs text-aurora-text-muted">
              {(fase3?.determinacoesAudiencia ?? '').length}/3000
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Modelo de ata utilizado</div>
            <p className="text-xs text-aurora-text-muted">
              Opcional - para registro do modelo aplicado neste ato.
            </p>
            {carregandoModelos ? (
              <div className="text-sm text-aurora-text-muted">Carregando modelos...</div>
            ) : modelosAtivos.length === 0 ? (
              <div className="text-sm text-aurora-text-muted">
                Nenhum modelo cadastrado ainda.{' '}
                <Link to={ROTAS.MODELOS} className="text-aurora-primary hover:underline">
                  Cadastrar modelo →
                </Link>
              </div>
            ) : (
              <>
                <Select
                  value={fase3?.modeloAtaUtilizadoId ?? ''}
                  onChange={(event) => {
                    void atualizarFase3({
                      modeloAtaUtilizadoId: event.target.value || undefined,
                    })
                  }}
                >
                  <option value="">Nenhum modelo selecionado</option>
                  {modelosAtivos.map((modelo) => (
                    <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>
                  ))}
                </Select>
                {selectedModelo && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-aurora-border bg-aurora-elevated px-3 py-1 text-xs text-aurora-text-secondary">
                        {selectedModelo.nome}
                      </span>
                      <Button size="xs" variant="ghost" onClick={() => setAbrirModelo(true)}>
                        Abrir modelo completo
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-aurora-border bg-aurora-elevated p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-aurora-text-primary">
                            Previa do modelo com dados do processo
                          </div>
                          <div className="text-xs text-aurora-text-muted">
                            Conteudo preenchido automaticamente.
                          </div>
                        </div>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={<Copy size={12} />}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(conteudoModeloPreenchido)
                              toast.success('Texto copiado para a area de transferencia.')
                            } catch {
                              toast.error('Nao foi possivel copiar o texto.')
                            }
                          }}
                        >
                          Copiar texto
                        </Button>
                      </div>

                      {variaveisSemDados.length > 0 && (
                        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          {variaveisSemDados.length} campo(s) sem dados: {variaveisSemDados.join(', ')}
                        </div>
                      )}

                      <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-aurora-border bg-aurora-surface p-3 text-sm leading-relaxed text-aurora-text-primary">
                        <pre className="whitespace-pre-wrap [font-family:inherit]">
                          {conteudoModeloPreenchido || 'Sem conteudo.'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Observacoes gerais</div>
            <Textarea
              rows={6}
              maxLength={2000}
              placeholder="Observacoes gerais sobre a audiencia realizada"
              value={fase3?.observacoes ?? ''}
              onChange={(event) => {
                const valor = event.target.value
                if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
                observacoesTimerRef.current = window.setTimeout(() => {
                  void atualizarFase3({ observacoes: valor.trim() || undefined })
                }, 1500)
              }}
            />
            <div className="text-right text-2xs text-aurora-text-muted">
              {(fase3?.observacoes ?? '').length}/2000
            </div>
          </Card>
        </>
      )}

      {realizada === false && (
        <>
          <Card className="space-y-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Motivo da nao realizacao</div>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left ${fase3?.motivoNaoRealizacao === MotivoNaoRealizacao.CANCELAMENTO ? 'border-aurora-primary bg-aurora-primary/10' : 'border-aurora-border bg-aurora-elevated'}`}
                onClick={() => { void atualizarFase3({ motivoNaoRealizacao: MotivoNaoRealizacao.CANCELAMENTO }) }}
              >
                Cancelamento
              </button>
              <button
                type="button"
                className={`rounded-2xl border p-3 text-left ${fase3?.motivoNaoRealizacao === MotivoNaoRealizacao.REDESIGNACAO ? 'border-aurora-primary bg-aurora-primary/10' : 'border-aurora-border bg-aurora-elevated'}`}
                onClick={() => { void atualizarFase3({ motivoNaoRealizacao: MotivoNaoRealizacao.REDESIGNACAO }) }}
              >
                Redesignacao
              </button>
            </div>
          </Card>

          {fase3?.motivoNaoRealizacao === MotivoNaoRealizacao.REDESIGNACAO && (
            <Card className="space-y-4">
              <div className="text-sm font-semibold text-aurora-text-primary">Nova data da audiencia</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Nova data designada"
                  type="date"
                  hint="Preencher se ja definida"
                  value={novaDataInput}
                  onChange={(event) => {
                    setNovaDataInput(event.target.value)
                    if (!event.target.value) {
                      setAvisoNovaData(null)
                      return
                    }
                    setAvisoNovaData(verificarAntecedencia(new Date(`${event.target.value}T12:00:00`)).mensagemAviso)
                  }}
                />
                <Input
                  label="Nova hora"
                  type="time"
                  value={novaHoraInput}
                  onChange={(event) => setNovaHoraInput(event.target.value)}
                />
              </div>
              {avisoNovaData && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {avisoNovaData}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Save size={14} />}
                  loading={salvandoNovaData}
                  onClick={async () => {
                    setSalvandoNovaData(true)
                    try {
                      await atualizarFase3({
                        novaData: combinarDataHora(novaDataInput, novaHoraInput),
                      })
                    } finally {
                      setSalvandoNovaData(false)
                    }
                  }}
                >
                  Salvar nova data
                </Button>
              </div>
            </Card>
          )}

          <Card className="space-y-4">
            <div className="text-sm font-semibold text-aurora-text-primary">Providencias apos nao realizacao</div>
            <div className="space-y-3">
              {CHECKLIST_NAO_REALIZACAO.map((item) => (
                <div key={item.chave} className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
                  <label className="flex items-start gap-3 text-sm text-aurora-text-secondary">
                    <input
                      type="checkbox"
                      checked={checklistNaoRealizacao[item.chave]}
                      onChange={async (event) => {
                        const marcado = event.target.checked
                        const proximoChecklist = {
                          ...checklistNaoRealizacao,
                          [item.chave]: marcado,
                        }
                        const proximosTimestamps = {
                          ...(fase3ComExtras?.checklistNaoRealizacaoTimestamps ?? {}),
                          [item.chave]: marcado ? new Date() : undefined,
                        }
                        await atualizarFase3({
                          checklistNaoRealizacao: proximoChecklist,
                          ...(proximosTimestamps ? { checklistNaoRealizacaoTimestamps: proximosTimestamps } : {}),
                        } as Partial<Fase3>)
                      }}
                    />
                    <span>
                      <span className="block font-medium text-aurora-text-primary">{item.rotulo}</span>
                      {fase3ComExtras?.checklistNaoRealizacaoTimestamps?.[item.chave] && (
                        <span className="mt-1 block text-xs text-aurora-text-muted">
                          Marcado em {formatarDataHora(fase3ComExtras.checklistNaoRealizacaoTimestamps[item.chave] as Date)}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              ))}
            </div>
            {checklistNaoRealizacaoCompleto && (
              <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
                Checklist pos-nao-realizacao completo
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold text-aurora-text-primary">Observacoes</div>
            <Textarea
              rows={6}
              maxLength={2000}
              placeholder="Observacoes sobre o motivo da nao realizacao e proximos passos"
              value={fase3?.observacoes ?? ''}
              onChange={(event) => {
                const valor = event.target.value
                if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
                observacoesTimerRef.current = window.setTimeout(() => {
                  void atualizarFase3({ observacoes: valor.trim() || undefined })
                }, 1500)
              }}
            />
            <div className="text-right text-2xs text-aurora-text-muted">
              {(fase3?.observacoes ?? '').length}/2000
            </div>
          </Card>
        </>
      )}

      <Card className="space-y-4">
        {avisoFinalizacao.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="font-medium">Antes de finalizar, vale revisar:</div>
            <ul className="mt-2 list-disc pl-5">
              {avisoFinalizacao.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await atualizarProcesso({
                    fases: {
                      ...processo.fases,
                      fase3: StatusFase.CONCLUIDA,
                    },
                  })
                  await atualizarFase3({ concluidaEm: new Date() })
                  setAvisoFinalizacao([])
                }}
              >
                Confirmar finalizacao mesmo assim
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROTAS.processo(id))}>
            ← Voltar ao processo
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(ROTAS.processoFase2(id))}>
              ← Fase 2
            </Button>
            {statusAtual === StatusFase.CONCLUIDA ? (
              <Button variant="success" size="sm" disabled>
                ✓ Processo encerrado
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                iconRight={<ChevronRight size={14} />}
                onClick={async () => {
                  const pendencias: string[] = []
                  if (realizada === true && !checklistRealizacaoCompleto) {
                    pendencias.push('Checklist pos-audiencia incompleto.')
                  }
                  if (realizada === false && !fase3?.motivoNaoRealizacao) {
                    pendencias.push('Definir motivo da nao realizacao.')
                  }
                  if (realizada === false && !checklistNaoRealizacaoCompleto) {
                    pendencias.push('Checklist pos-nao-realizacao incompleto.')
                  }
                  if (processo.totalIntimacoesPendentes > 0) {
                    pendencias.push(`Ainda ha ${processo.totalIntimacoesPendentes} intimacao(oes) pendente(s).`)
                  }

                  if (pendencias.length > 0 && !confirmarFinalizacao) {
                    setAvisoFinalizacao(pendencias)
                    setConfirmarFinalizacao(true)
                    return
                  }

                  setAvisoFinalizacao([])
                  await atualizarProcesso({
                    fases: {
                      ...processo.fases,
                      fase3: StatusFase.CONCLUIDA,
                    },
                  })
                  await atualizarFase3({ concluidaEm: new Date() })
                }}
              >
                Finalizar processo
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ModalVisualizarModelo
        modeloId={fase3?.modeloAtaUtilizadoId ?? null}
        aberto={abrirModelo}
        onFechar={() => setAbrirModelo(false)}
      />
    </div>
  )
}
