import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Clock3, Save } from 'lucide-react'
import { Button, Card, EmptyState, Input, Textarea } from '../components/ui'
import { ModalEditarProcesso } from '../components/processo/ModalEditarProcesso'
import { ModalEtiquetasPrioridades } from '../components/processo/ModalEtiquetasPrioridades'
import { SecaoPrescricao } from '../components/processo/SecaoPrescricao'
import { BadgeMetaCNJ } from '../components/shared/BadgeMetaCNJ'
import { BadgePrioridade } from '../components/shared/BadgePrioridade'
import { BadgeStatusFase } from '../components/shared/BadgeStatusFase'
import { ChipEtiqueta } from '../components/shared/ChipEtiqueta'
import { useProcesso } from '../hooks/useProcesso'
import type { Fase1FirestoreExtras } from '../lib/processosCore'
import { ROTAS } from '../router/rotas'
import { StatusFase, TipoAudiencia, type Fase1 } from '../types/core'
import { verificarAntecedencia } from '../utils/validacoes'

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiencia de Instrucao e Julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiencia de Custodia',
  [TipoAudiencia.PRELIMINAR]: 'Audiencia Preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologacao',
  [TipoAudiencia.INSTRUCAO]: 'Instrucao',
  [TipoAudiencia.OUTRO]: 'Outro',
}

type ChecklistKey = keyof Fase1['checklist']

const CHECKLIST_ITEMS: Array<{ chave: ChecklistKey; rotulo: string }> = [
  { chave: 'minutaDespachoElaborada', rotulo: 'Minuta do despacho de designacao elaborada' },
  { chave: 'audienciaCadastradaCalendario', rotulo: 'Audiencia cadastrada no calendario' },
  { chave: 'relatorioIntimacoeselaborado', rotulo: 'Relatorio de intimacoes elaborado' },
  { chave: 'etiquetaPjeAtualizada', rotulo: 'Etiqueta atualizada no PJe' },
]

function formatarDataInput(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

function formatarHorarioTimestamp(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

export default function ProcessoFase1() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { processo, fase1, alertas, carregando, erro, atualizarProcesso, atualizarFase1 } = useProcesso(id)
  const fase1Extras = fase1 as (Fase1 & Fase1FirestoreExtras) | null

  const [modalProcessoAberto, setModalProcessoAberto] = useState(false)
  const [modalEtiquetasAberto, setModalEtiquetasAberto] = useState(false)
  const [quantidadeReus, setQuantidadeReus] = useState('0')
  const [quantidadeTestemunhas, setQuantidadeTestemunhas] = useState('0')
  const [quantidadeOutros, setQuantidadeOutros] = useState('0')
  const [salvoParticipantes, setSalvoParticipantes] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [sugestaoData, setSugestaoData] = useState('')
  const [sugestaoHorario, setSugestaoHorario] = useState('')
  const [salvandoPlanejamento, setSalvandoPlanejamento] = useState(false)
  const [avisoPlanejamento, setAvisoPlanejamento] = useState<string | null>(null)
  const [avisoAvanco, setAvisoAvanco] = useState<string[]>([])
  const [confirmarAvanco, setConfirmarAvanco] = useState(false)
  const participantesTimerRef = useRef<number | null>(null)
  const observacoesTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!fase1) return
    setQuantidadeReus(String(fase1.quantidadeReus))
    setQuantidadeTestemunhas(String(fase1.quantidadeTestemunhas))
    setQuantidadeOutros(String(fase1.quantidadeOutros))
    setObservacoes(fase1.observacoes ?? '')
    setSugestaoData(formatarDataInput(fase1.sugestaoData))
    setSugestaoHorario(fase1.sugestaoHorario ?? '')
  }, [fase1])

  useEffect(() => () => {
    if (participantesTimerRef.current) window.clearTimeout(participantesTimerRef.current)
    if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
  }, [])

  const checklistCompleto = useMemo(() => {
    if (!fase1) return false
    return Object.values(fase1.checklist).every(Boolean)
  }, [fase1])

  useEffect(() => {
    if (!fase1 || !processo) return

    const proximoStatus = checklistCompleto ? StatusFase.CONCLUIDA : StatusFase.EM_ANDAMENTO
    if (processo.fases.fase1 !== proximoStatus) {
      void atualizarProcesso({
        fases: {
          ...processo.fases,
          fase1: proximoStatus,
        },
      })
    }
  }, [atualizarProcesso, checklistCompleto, fase1, processo])

  const antecedencia = useMemo(() => {
    if (!sugestaoData) return null
    return verificarAntecedencia(new Date(`${sugestaoData}T12:00:00`))
  }, [sugestaoData])

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-[800px]">
        <Card className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded bg-aurora-border" />
          <div className="h-10 w-72 animate-pulse rounded bg-aurora-border" />
          <div className="h-5 w-32 animate-pulse rounded bg-aurora-border" />
        </Card>
      </div>
    )
  }

  if (erro || !processo || !fase1) {
    return (
      <div className="mx-auto w-full max-w-[800px]">
        <EmptyState
          title={erro ? 'Nao foi possivel carregar a Fase 1' : 'Processo nao encontrado'}
          description={erro ?? 'Nao localizamos os dados da Fase 1 para este processo.'}
          action={(
            <Button variant="primary" size="sm" onClick={() => navigate(ROTAS.FILA)}>
              Voltar para a fila
            </Button>
          )}
        />
      </div>
    )
  }

  const salvarContagens = () => {
    if (participantesTimerRef.current) window.clearTimeout(participantesTimerRef.current)

    participantesTimerRef.current = window.setTimeout(async () => {
      await atualizarFase1({
        quantidadeReus: Number(quantidadeReus || 0),
        quantidadeTestemunhas: Number(quantidadeTestemunhas || 0),
        quantidadeOutros: Number(quantidadeOutros || 0),
      })
      setSalvoParticipantes(true)
      window.setTimeout(() => setSalvoParticipantes(false), 2000)
    }, 800)
  }

  const salvarObservacoes = (valor: string) => {
    if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
    observacoesTimerRef.current = window.setTimeout(() => {
      void atualizarFase1({
        observacoes: valor.trim() || undefined,
      })
    }, 1500)
  }

  const checklistTimestamps = fase1Extras?.checklistTimestamps ?? {}

  const pendenciasAvanco = [
    !sugestaoData ? 'Definir a sugestao de data' : null,
    !sugestaoHorario ? 'Definir a sugestao de horario' : null,
    !checklistCompleto ? 'Completar o checklist pre-agendamento' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col gap-5">
      <Card className="sticky top-[calc(var(--topbar-height,112px)+0.5rem)] z-10 border-aurora-border-light bg-aurora-surface/95 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link to={ROTAS.processo(id)} className="font-mono text-lg font-semibold text-aurora-primary hover:underline">
              {processo.numeroProcesso}
            </Link>
            <div className="mt-1 text-sm text-aurora-text-secondary">Fase 1 - Pre-agendamento</div>
          </div>
          <BadgeStatusFase status={processo.fases.fase1} rotulo="Fase 1" />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Identificacao</div>
          <Button variant="ghost" size="sm" onClick={() => setModalProcessoAberto(true)}>
            Editar dados
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Numero do processo</div>
            <div className="mt-1 font-mono text-sm text-aurora-text-primary">{processo.numeroProcesso}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Cargo do magistrado</div>
            <div className="mt-1 text-sm text-aurora-text-primary">{processo.cargoMagistrado}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Tipo de audiencia</div>
            <div className="mt-1 text-sm text-aurora-text-primary">{TIPO_AUDIENCIA_LABELS[processo.tipoAudiencia]}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Natureza do crime</div>
            <div className="mt-1 text-sm text-aurora-text-primary">{processo.naturezaCrime || 'Nao informada'}</div>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Meta CNJ</div>
          <div className="mt-2">
            <BadgeMetaCNJ meta={processo.metaCNJ} />
            {processo.metaCNJ === 'sem_meta' && (
              <span className="text-sm text-aurora-text-muted">Sem meta vinculada</span>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Prioridades e etiquetas</div>
          <Button variant="ghost" size="sm" onClick={() => setModalEtiquetasAberto(true)}>
            Editar
          </Button>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Prioridades</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {processo.prioridades.length > 0 ? (
              processo.prioridades.map((prioridade) => (
                <BadgePrioridade key={prioridade} prioridade={prioridade} />
              ))
            ) : (
              <span className="text-sm text-aurora-text-muted">Nenhuma prioridade definida</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.16em] text-aurora-text-muted">Etiquetas</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {processo.etiquetas.length > 0 ? (
              processo.etiquetas.map((etiqueta) => <ChipEtiqueta key={etiqueta} texto={etiqueta} />)
            ) : (
              <span className="text-sm text-aurora-text-muted">Sem etiquetas</span>
            )}
          </div>
        </div>
      </Card>

      <SecaoPrescricao
        prescricao={processo.prescricao}
        alertas={alertas}
        onSalvar={async (dados) => {
          await atualizarProcesso({ prescricao: dados })
        }}
      />

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Participantes esperados</div>
          {salvoParticipantes && (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 size={14} />
              <span>Salvo</span>
            </div>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Numero de reus"
            type="number"
            min={0}
            value={quantidadeReus}
            onChange={(event) => {
              setQuantidadeReus(event.target.value)
              salvarContagens()
            }}
          />
          <Input
            label="Numero de testemunhas"
            type="number"
            min={0}
            value={quantidadeTestemunhas}
            onChange={(event) => {
              setQuantidadeTestemunhas(event.target.value)
              salvarContagens()
            }}
          />
          <Input
            label="Outros participantes"
            type="number"
            min={0}
            value={quantidadeOutros}
            onChange={(event) => {
              setQuantidadeOutros(event.target.value)
              salvarContagens()
            }}
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Planejamento</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Input
              label="Sugestao de data"
              type="date"
              value={sugestaoData}
              onChange={(event) => {
                setSugestaoData(event.target.value)
                if (!event.target.value) {
                  setAvisoPlanejamento(null)
                  return
                }
                const resultado = verificarAntecedencia(new Date(`${event.target.value}T12:00:00`))
                setAvisoPlanejamento(resultado.mensagemAviso)
              }}
            />
            {antecedencia?.mensagemAviso && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {antecedencia.mensagemAviso}
              </div>
            )}
          </div>

          <Input
            label="Sugestao de horario"
            type="time"
            value={sugestaoHorario}
            onChange={(event) => setSugestaoHorario(event.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            loading={salvandoPlanejamento}
            onClick={async () => {
              setSalvandoPlanejamento(true)
              try {
                await atualizarFase1({
                  sugestaoData: sugestaoData ? new Date(`${sugestaoData}T12:00:00`) : undefined,
                  sugestaoHorario: sugestaoHorario || undefined,
                })
              } finally {
                setSalvandoPlanejamento(false)
              }
            }}
          >
            Salvar planejamento
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Checklist pre-agendamento</div>
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item.chave} className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
              <label className="flex items-start gap-3 text-sm text-aurora-text-secondary">
                <input
                  type="checkbox"
                  checked={fase1.checklist[item.chave]}
                  onChange={async (event) => {
                    const marcado = event.target.checked
                    const proximoChecklist = {
                      ...fase1.checklist,
                      [item.chave]: marcado,
                    }
                    const proximosTimestamps = {
                      ...(checklistTimestamps ?? {}),
                      [item.chave]: marcado ? new Date() : undefined,
                    }
                    await atualizarFase1({
                      checklist: proximoChecklist,
                      // @ts-expect-error legado — migracao pendente
                      checklistTimestamps: proximosTimestamps,
                      concluidaEm: Object.values(proximoChecklist).every(Boolean) ? new Date() : undefined,
                    })
                  }}
                />
                <span>
                  <span className="block font-medium text-aurora-text-primary">{item.rotulo}</span>
                  {checklistTimestamps[item.chave] && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-aurora-text-muted">
                      <Clock3 size={12} />
                      Marcado em {formatarHorarioTimestamp(checklistTimestamps[item.chave] as Date)}
                    </span>
                  )}
                </span>
              </label>
            </div>
          ))}
        </div>

        {checklistCompleto && (
          <div className="rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
            Checklist completo
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="text-sm font-semibold text-aurora-text-primary">Observacoes</div>
        <Textarea
          rows={6}
          maxLength={2000}
          value={observacoes}
          onChange={(event) => {
            setObservacoes(event.target.value)
            salvarObservacoes(event.target.value)
          }}
        />
        <div className="text-right text-2xs text-aurora-text-muted">{observacoes.length}/2000</div>
      </Card>

      <Card className="space-y-4">
        {avisoAvanco.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <div className="font-medium">Antes de avancar, vale revisar:</div>
            <ul className="mt-2 list-disc pl-5">
              {avisoAvanco.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => navigate(ROTAS.processoFase2(id))}>
                Prosseguir mesmo assim
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROTAS.processo(id))}>
            ← Voltar ao processo
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconRight={<ChevronRight size={14} />}
            onClick={() => {
              if (pendenciasAvanco.length > 0 && !confirmarAvanco) {
                setAvisoAvanco(pendenciasAvanco)
                setConfirmarAvanco(true)
                return
              }
              setAvisoAvanco([])
              navigate(ROTAS.processoFase2(id))
            }}
          >
            Avancar para Fase 2
          </Button>
        </div>
      </Card>

      <ModalEditarProcesso
        processo={processo}
        aberto={modalProcessoAberto}
        onFechar={() => setModalProcessoAberto(false)}
        onSalvar={atualizarProcesso}
      />

      <ModalEtiquetasPrioridades
        processo={processo}
        aberto={modalEtiquetasAberto}
        onFechar={() => setModalEtiquetasAberto(false)}
        onSalvar={async (dados) => {
          await atualizarProcesso({
            ...dados,
            etiquetasSistemicas: dados.metaCNJ === 'sem_meta' ? [] : [dados.metaCNJ],
          })
        }}
      />
    </div>
  )
}
