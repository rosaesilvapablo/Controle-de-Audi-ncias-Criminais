import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer, type Event } from 'react-big-calendar'
import {
  differenceInMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { useAudiencias } from '../../hooks/useAudiencias'
import { useAuth } from '../../contexts/AuthContext'
import { useProcedimentos } from '../../hooks/index'
import { Badge, Button, Card, PageLoader, StatCard } from '../../components/ui'
import type { Audiencia, StatusAudiencia } from '../../types'
import {
  ADVOGADO_TIPO_LABELS,
  CLASSE_PROCESSUAL_LABELS,
  OBJETO_FEITO_LABELS,
  STATUS_AUDIENCIA_LABELS,
  TIPO_AUDIENCIA_LABELS,
  canViewOnly,
  isMagistrado,
} from '../../types'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { locale: ptBR }),
  getDay,
  locales: { 'pt-BR': ptBR },
})

const COLORS: Record<StatusAudiencia, string> = {
  agendada: '#534AB7',
  em_andamento: '#EF9F27',
  realizada: '#1D9E75',
  redesignada: '#7F77DD',
  cancelada: '#E24B4A',
  suspensa: '#4A4A7A',
}

interface CalEvent extends Event {
  resource: Audiencia
}

type View = 'month' | 'week' | 'day' | 'agenda'

export default function MinhaAgenda() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { procedimentos } = useProcedimentos()

  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<View>('week')
  const [selected, setSelected] = useState<Audiencia | null>(null)

  const perfil = usuario?.perfil
  const bloqueado = canViewOnly(perfil)

  const periodo = useMemo(() => {
    if (view === 'day') {
      return {
        inicio: startOfDay(date),
        fim: endOfDay(date),
      }
    }

    if (view === 'week') {
      return {
        inicio: startOfWeek(date, { locale: ptBR }),
        fim: endOfWeek(date, { locale: ptBR }),
      }
    }

    return {
      inicio: startOfMonth(date),
      fim: endOfMonth(date),
    }
  }, [date, view])

  const { audiencias, loading } = useAudiencias({
    magistradoId: isMagistrado(perfil) ? usuario?.uid : undefined,
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
  })

  const procedimentoSelecionado = useMemo(
    () =>
      procedimentos.find((item) => item.audienciaId === selected?.id) ?? null,
    [procedimentos, selected?.id],
  )

  const events = useMemo<CalEvent[]>(
    () =>
      audiencias.map((audiencia) => ({
        title: `${format(audiencia.dataHoraInicio.toDate(), 'HH:mm')} · ${audiencia.numeroProcesso}`,
        start: audiencia.dataHoraInicio.toDate(),
        end: audiencia.dataHoraFim.toDate(),
        resource: audiencia,
      })),
    [audiencias],
  )

  const stats = useMemo(
    () => ({
      total: audiencias.length,
      realizadas: audiencias.filter((a) => a.status === 'realizada').length,
      pendentes: audiencias.filter((a) => a.status === 'agendada').length,
      canceladas: audiencias.filter((a) => a.status === 'cancelada').length,
    }),
    [audiencias],
  )

  const subtituloPerfil = useMemo(() => {
    if (isMagistrado(perfil)) {
      return 'Exibindo apenas as audiencias vinculadas ao magistrado logado no periodo selecionado.'
    }

    if (perfil === 'diretor') {
      return 'Exibindo a visao completa das audiencias no periodo selecionado.'
    }

    return 'Exibindo todas as audiencias disponiveis no periodo selecionado.'
  }, [perfil])

  const eventStyleGetter = useCallback(
    (event: CalEvent) => ({
      style: {
        background: COLORS[event.resource.status] ?? '#534AB7',
        border: 'none',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '500',
      },
    }),
    [],
  )

  const Toolbar = useCallback(
    ({ label, onNavigate, onView: onV }: any) => (
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronLeft size={14} />}
            onClick={() => onNavigate('PREV')}
          />
          <Button size="sm" variant="ghost" onClick={() => onNavigate('TODAY')}>
            Hoje
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronRight size={14} />}
            onClick={() => onNavigate('NEXT')}
          />
        </div>
        <h2 className="flex-1 text-md font-medium capitalize text-aurora-text-primary">
          {label}
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-aurora-border bg-aurora-elevated p-0.5">
          {(['week', 'day', 'month', 'agenda'] as const).map((valorView) => (
            <button
              key={valorView}
              onClick={() => onV(valorView)}
              className={`px-2.5 h-6 rounded-md text-xs font-medium transition-all ${
                view === valorView
                  ? 'bg-aurora-primary text-white'
                  : 'text-aurora-text-secondary hover:text-aurora-text-primary'
              }`}
            >
              {{ week: 'Semana', day: 'Dia', month: 'Mes', agenda: 'Lista' }[valorView]}
            </button>
          ))}
        </div>
      </div>
    ),
    [view],
  )

  if (loading) return <PageLoader />

  if (bloqueado) {
    return (
      <Card padding="lg" className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-medium text-aurora-text-primary">
              Acesso negado
            </h1>
            <p className="mt-1 text-sm text-aurora-text-muted">
              Seu perfil nao possui permissao para acessar Minha agenda.
            </p>
          </div>
          <div className="text-sm text-aurora-text-secondary">
            Se voce precisa visualizar esta tela, solicite a liberacao ao Diretor de Secretaria.
          </div>
          <div>
            <Button variant="primary" size="sm" onClick={() => navigate('/')}>
              Voltar para a pauta
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-medium text-aurora-text-primary">
          Minha agenda
        </h1>
        <p className="mt-0.5 text-sm text-aurora-text-muted">
          {format(date, "MMMM 'de' yyyy", { locale: ptBR })} · {usuario?.nome}
        </p>
        <p className="mt-1 text-xs text-aurora-text-secondary">
          {subtituloPerfil}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={stats.total}
          color="primary"
          icon={<CalendarDays size={14} />}
        />
        <StatCard label="Agendadas" value={stats.pendentes} color="amber" />
        <StatCard label="Realizadas" value={stats.realizadas} color="green" />
        <StatCard label="Canceladas" value={stats.canceladas} color="red" />
      </div>

      <Card padding="md" className="min-h-[560px]">
        <Calendar
          localizer={localizer}
          culture="pt-BR"
          events={events}
          view={view}
          date={date}
          onNavigate={setDate}
          onView={(nextView) => setView(nextView as View)}
          onSelectEvent={(event: CalEvent) => setSelected(event.resource)}
          eventPropGetter={eventStyleGetter}
          components={{ toolbar: Toolbar } as any}
          messages={{
            today: 'Hoje',
            previous: 'Anterior',
            next: 'Proximo',
            month: 'Mes',
            week: 'Semana',
            day: 'Dia',
            agenda: 'Lista',
            noEventsInRange:
              'Nenhuma audiencia agendada para este periodo. Consulte outra data para visualizar a pauta.',
            showMore: (n) => `+${n} mais`,
          }}
          style={{ minHeight: 540 }}
        />
      </Card>

      {selected && (
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-sm text-aurora-text-primary">
                {selected.numeroProcesso}
              </div>
              <div className="mt-1 text-xs text-aurora-text-muted">
                {CLASSE_PROCESSUAL_LABELS[selected.classeProcessual]} ·{' '}
                {OBJETO_FEITO_LABELS[selected.objetoDoFeito]}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="primary">
                  {TIPO_AUDIENCIA_LABELS[selected.tipo]}
                </Badge>
                <Badge statusAudiencia={selected.status}>
                  {STATUS_AUDIENCIA_LABELS[selected.status]}
                </Badge>
              </div>
            </div>
            <div className="text-right text-xs text-aurora-text-muted">
              <div>{format(selected.dataHoraInicio.toDate(), 'HH:mm')}</div>
              <div>
                {differenceInMinutes(
                  selected.dataHoraFim.toDate(),
                  selected.dataHoraInicio.toDate(),
                )}{' '}
                min
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Reus / Depoimentos pessoais
            </div>
            <Card padding="sm" className="space-y-2">
              {selected.reus?.length ? (
                selected.reus.map((reu, index) => (
                  <div
                    key={`${reu.nome}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-aurora-text-primary">
                      {reu.nome || `Reu ${index + 1}`}
                    </span>
                    {reu.preso && <Badge variant="danger">Preso</Badge>}
                  </div>
                ))
              ) : (
                <div className="text-sm text-aurora-text-muted">
                  Nenhum reu informado.
                </div>
              )}
            </Card>
          </div>

          {selected.vitimas?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
                Vitimas
              </div>
              <Card padding="sm" className="space-y-2">
                {selected.vitimas.map((vitima, index) => (
                  <div
                    key={`${vitima}-${index}`}
                    className="text-sm text-aurora-text-primary"
                  >
                    {vitima}
                  </div>
                ))}
              </Card>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Advogados
            </div>
            <Card padding="sm" className="space-y-2">
              {selected.advogados?.length ? (
                selected.advogados.map((advogado, index) => (
                  <div
                    key={`${advogado.nome}-${advogado.oab}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="text-aurora-text-primary">
                        {advogado.nome}
                      </div>
                      <div className="text-xs text-aurora-text-muted">
                        OAB {advogado.oab}
                      </div>
                    </div>
                    <div className="text-xs text-aurora-text-secondary">
                      {ADVOGADO_TIPO_LABELS[advogado.tipo]}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-aurora-text-muted">
                  Nenhum advogado informado.
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
              Situacao do checklist
            </div>
            <Card padding="sm">
              <div className="h-2 overflow-hidden rounded-full bg-aurora-elevated">
                <div
                  className="h-full rounded-full bg-aurora-primary"
                  style={{ width: `${procedimentoSelecionado?.progresso ?? 0}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-aurora-text-secondary">
                {procedimentoSelecionado?.itensConcluidos ?? 0} de{' '}
                {procedimentoSelecionado?.totalItens ?? 0} itens preenchidos ·{' '}
                {procedimentoSelecionado?.itensCriticosPendentes ?? 0}{' '}
                obrigatorio(s) em aberto
              </div>
              {procedimentoSelecionado && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      navigate(`/procedimentos/${procedimentoSelecionado.id}`)
                    }
                  >
                    Abrir checklist completo
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(null)}
            >
              Fechar detalhes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                navigate('/', { state: { audienciaSelecionadaId: selected.id } })
              }
            >
              Abrir na pauta
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {Object.entries(COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            <span className="text-2xs text-aurora-text-secondary">
              {STATUS_AUDIENCIA_LABELS[status as StatusAudiencia]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
