import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Clock3, Save } from 'lucide-react'
import { PainelIntimacoesProcesso } from '../components/intimacoes/PainelIntimacoesProcesso'
import { ListaParticipantes } from '../components/participantes/ListaParticipantes'
import { BadgeStatusFase } from '../components/shared/BadgeStatusFase'
import { Button, Card, EmptyState, Input, Select, Textarea } from '../components/ui'
import { useParticipantes } from '../hooks/useParticipantes'
import { useProcesso } from '../hooks/useProcesso'
import { ROTAS } from '../router/rotas'
import {
  FormaIntimacao,
  FormaParticipacao,
  StatusFase,
  type Fase2,
} from '../types/core'
import { verificarAntecedencia } from '../utils/validacoes'

type ChecklistKey = keyof Fase2['checklist']
type Fase2Extras = { checklistTimestamps?: Partial<Record<ChecklistKey, Date>> }

const CHECKLIST_ITENS: Array<{ chave: ChecklistKey; rotulo: string }> = [
  { chave: 'linksEnviados', rotulo: 'Links de videoconferencia enviados para participantes virtuais' },
  { chave: 'certidaoEnvioLink', rotulo: 'Certidao de envio de link emitida' },
]

const OPCOES_MAGISTRADO = [
  'Juiz Federal',
  'Juiz Federal Substituto',
  'Juiz designado para o ato',
] as const

function dataParaInput(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

function horaParaInput(data?: Date) {
  return data ? data.toTimeString().slice(0, 5) : ''
}

function formatarDataHora(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

function combinarDataHora(data?: string, hora?: string) {
  if (!data) return undefined
  if (!hora) return new Date(`${data}T00:00:00`)
  return new Date(`${data}T${hora}:00`)
}

export default function ProcessoFase2() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { processo, fase2, carregando, erro, atualizarFase2 } = useProcesso(id)
  const { participantes } = useParticipantes(id)
  const fase2ComExtras = fase2 as (Fase2 & Fase2Extras) | null
  const observacoesTimerRef = useRef<number | null>(null)

  const [inicioData, setInicioData] = useState('')
  const [inicioHora, setInicioHora] = useState('')
  const [fimData, setFimData] = useState('')
  const [fimHora, setFimHora] = useState('')
  const [sala, setSala] = useState('')
  const [magistradoAto, setMagistradoAto] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [salvandoAudiencia, setSalvandoAudiencia] = useState(false)
  const [avisoAntecedencia, setAvisoAntecedencia] = useState<string | null>(null)
  const [avisoAvanco, setAvisoAvanco] = useState<string[]>([])
  const [confirmarAvanco, setConfirmarAvanco] = useState(false)

  useEffect(() => {
    if (!fase2) return
    setInicioData(dataParaInput(fase2.dataHoraInicio))
    setInicioHora(horaParaInput(fase2.dataHoraInicio))
    setFimData(dataParaInput(fase2.dataHoraFim))
    setFimHora(horaParaInput(fase2.dataHoraFim))
    setSala(fase2.sala ?? '')
    setMagistradoAto(fase2.magistradoFase2 ?? '')
    setObservacoes(fase2.observacoes ?? '')
  }, [fase2])

  useEffect(() => () => {
    if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
  }, [])

  const existeParticipanteVirtual = useMemo(
    () => participantes.some((item) => item.formaParticipacao === FormaParticipacao.VIRTUAL),
    [participantes],
  )
  const checklistCompleto = useMemo(() => {
    if (!fase2) return false
    if (!existeParticipanteVirtual) return true
    return Object.values(fase2.checklist).every(Boolean)
  }, [existeParticipanteVirtual, fase2])

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

  if (erro || !processo || !fase2) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <EmptyState
          title={erro ? 'Nao foi possivel carregar a Fase 2' : 'Processo nao encontrado'}
          description={erro ?? 'Nao localizamos os dados da Fase 2 para este processo.'}
          action={(
            <Button variant="primary" size="sm" onClick={() => navigate(ROTAS.FILA)}>
              Voltar para a fila
            </Button>
          )}
        />
      </div>
    )
  }

  const checklistTimestamps = fase2ComExtras?.checklistTimestamps ?? {}

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <Card className="sticky top-[calc(var(--topbar-height,112px)+0.5rem)] z-10 border-aurora-border-light bg-aurora-surface/95 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link to={ROTAS.processo(id)} className="font-mono text-lg font-semibold text-aurora-primary hover:underline">
              {processo.numeroProcesso}
            </Link>
            <div className="mt-1 text-sm text-aurora-text-secondary">Fase 2 - Audiencia designada</div>
          </div>
          <BadgeStatusFase status={processo.fases.fase2} rotulo="Fase 2" />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Dados da audiencia</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Data de inicio"
            type="date"
            value={inicioData}
            onChange={(event) => setInicioData(event.target.value)}
          />
          <Input
            label="Hora de inicio"
            type="time"
            value={inicioHora}
            onChange={(event) => setInicioHora(event.target.value)}
          />
          <Input
            label="Data de fim (opcional)"
            type="date"
            value={fimData}
            onChange={(event) => setFimData(event.target.value)}
          />
          <Input
            label="Hora de fim (opcional)"
            type="time"
            value={fimHora}
            onChange={(event) => setFimHora(event.target.value)}
          />
          <Input
            label="Sala / local"
            placeholder="Ex: Sala de audiencias 1, Sala virtual"
            value={sala}
            onChange={(event) => setSala(event.target.value)}
          />
          <Select
            label="Magistrado para este ato"
            value={magistradoAto || 'mesmo'}
            onChange={(event) => setMagistradoAto(event.target.value === 'mesmo' ? '' : event.target.value)}
          >
            <option value="mesmo">Mesmo do processo</option>
            {OPCOES_MAGISTRADO.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </Select>
        </div>
        <p className="text-2xs text-aurora-text-muted">
          Preencher apenas se diferente do magistrado responsavel pelo processo.
        </p>

        {avisoAntecedencia && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {avisoAntecedencia}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            loading={salvandoAudiencia}
            icon={<Save size={14} />}
            onClick={async () => {
              setSalvandoAudiencia(true)
              try {
                if (inicioData) {
                  const resultado = verificarAntecedencia(new Date(`${inicioData}T12:00:00`))
                  setAvisoAntecedencia(resultado.mensagemAviso)
                } else {
                  setAvisoAntecedencia(null)
                }

                await atualizarFase2({
                  dataHoraInicio: combinarDataHora(inicioData, inicioHora),
                  dataHoraFim: combinarDataHora(fimData, fimHora),
                  sala: sala.trim() || undefined,
                  magistradoFase2: magistradoAto || undefined,
                })

              } finally {
                setSalvandoAudiencia(false)
              }
            }}
          >
            Salvar
          </Button>
        </div>
      </Card>

      <ListaParticipantes processoId={id} modoEdicao />

      <Card className="space-y-4 border-aurora-border-light">
        <div className="border-t border-aurora-border pt-1" />
        <div className="text-sm font-semibold text-aurora-text-primary">Intimacoes</div>
        <PainelIntimacoesProcesso processoId={id} />
        <div className="border-b border-aurora-border pb-1" />
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Checklist operacional</div>
        {!existeParticipanteVirtual ? (
          <p className="text-sm text-aurora-text-muted">
            Nenhum participante virtual - itens de videoconferencia nao aplicaveis.
          </p>
        ) : (
          <div className="space-y-3">
            {CHECKLIST_ITENS.map((item) => (
              <div key={item.chave} className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
                <label className="flex items-start gap-3 text-sm text-aurora-text-secondary">
                  <input
                    type="checkbox"
                    checked={fase2.checklist[item.chave]}
                    onChange={async (event) => {
                      const marcado = event.target.checked
                      const proximoChecklist = {
                        ...fase2.checklist,
                        [item.chave]: marcado,
                      }
                      const proximosTimestamps = {
                        ...(checklistTimestamps ?? {}),
                        [item.chave]: marcado ? new Date() : undefined,
                      }
                      await atualizarFase2({
                        checklist: proximoChecklist,
                        concluidaEm: (
                          fase2.dataHoraInicio
                          && Object.values(proximoChecklist).every(Boolean)
                        ) ? new Date() : undefined,
                        ...(proximosTimestamps ? { checklistTimestamps: proximosTimestamps } : {}),
                      } as Partial<Fase2>)
                    }}
                  />
                  <span>
                    <span className="block font-medium text-aurora-text-primary">{item.rotulo}</span>
                    {checklistTimestamps[item.chave] && (
                      <span className="mt-1 flex items-center gap-1 text-xs text-aurora-text-muted">
                        <Clock3 size={12} />
                        Marcado em {formatarDataHora(checklistTimestamps[item.chave] as Date)}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            ))}
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
            const valor = event.target.value
            setObservacoes(valor)
            if (observacoesTimerRef.current) window.clearTimeout(observacoesTimerRef.current)
            observacoesTimerRef.current = window.setTimeout(() => {
              void atualizarFase2({ observacoes: valor.trim() || undefined })
            }, 1500)
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
              <Button variant="secondary" size="sm" onClick={() => navigate(ROTAS.processoFase3(id))}>
                Prosseguir mesmo assim
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROTAS.processo(id))}>
            ← Voltar ao processo
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(ROTAS.processoFase1(id))}>
              ← Fase 1
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconRight={<ChevronRight size={14} />}
              onClick={() => {
                const pendencias = !fase2.dataHoraInicio ? ['Preencher data/hora de inicio da audiencia'] : []
                if (pendencias.length > 0 && !confirmarAvanco) {
                  setAvisoAvanco(pendencias)
                  setConfirmarAvanco(true)
                  return
                }
                setAvisoAvanco([])
                navigate(ROTAS.processoFase3(id))
              }}
            >
              Avancar para Fase 3
            </Button>
          </div>
        </div>
      </Card>

      {processo.fases.fase2 === StatusFase.CONCLUIDA && (
        <div className="flex items-center justify-end gap-2 text-xs text-green-700">
          <CheckCircle2 size={14} />
          Fase 2 concluida
        </div>
      )}
    </div>
  )
}
