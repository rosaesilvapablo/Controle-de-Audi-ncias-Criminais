import { cloneElement, isValidElement, useCallback } from 'react'
import { format, getDay, isSameDay, parse, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gavel,
  Mic,
  Plus,
  Scale,
  Users,
} from 'lucide-react'
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type Event,
  type SlotInfo,
  type ToolbarProps,
  type View,
} from 'react-big-calendar'
import type {
  ComponentType,
  CSSProperties,
  DragEvent as ReactDragEvent,
  ReactElement,
} from 'react'
import {
  isAudienciaAtrasada,
  isChecklistIncompletoCritico,
  isProximaAudiencia,
} from '../../lib/audienciaHelpers'
import {
  TIPO_AUDIENCIA_LABELS,
  type Audiencia,
  type Procedimento,
  type StatusAudiencia,
  type TipoAudiencia,
} from '../../types'
import { Button } from '../../components/ui'
import './calendario-pauta.css'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales: { 'pt-BR': ptBR },
})

export interface CalEvent extends Event {
  resource: Audiencia
}

export interface EventInteractionArgs<TEvent extends Event = Event> {
  event: TEvent
  start: string | Date
  end: string | Date
  isAllDay?: boolean
  resourceId?: string | number
}

export type ViewType = 'month' | 'week' | 'day' | 'agenda'

export interface CalendarioPautaProps {
  eventos: CalEvent[]
  procedimentos: Record<string, Procedimento>
  diasSemanaAtivos?: number[]
  view: ViewType
  date: Date
  podeEditar: boolean
  podeAgendar: boolean
  podeVerSigilo: boolean
  expedienteInicio: string
  expedienteFim: string
  onSelectEvent: (e: CalEvent) => void
  onSelectSlot: (slot: SlotInfo) => void
  onEventDrop: (args: EventInteractionArgs<CalEvent>) => void
  onViewChange: (v: ViewType) => void
  onNavigate: (d: Date) => void
  onNovaAudiencia: () => void
}

const AgendaCalendar = BigCalendar as ComponentType<any>
const DRAG_MIME_TYPE = 'application/x-scac-audiencia'

const EVENT_COLORS: Record<StatusAudiencia, string> = {
  agendada: '#534AB7',
  em_andamento: '#EF9F27',
  realizada: '#1D9E75',
  redesignada: '#7F77DD',
  cancelada: '#E24B4A',
  suspensa: '#4A4A7A',
}

type ClassificacaoEvento =
  | 'prestes_a_comecar'
  | 'atrasada'
  | 'checklist_critico'
  | 'normal'

function classificarEvento(
  audiencia: Audiencia,
  procedimento: Procedimento | null,
): ClassificacaoEvento {
  if (isAudienciaAtrasada(audiencia)) return 'atrasada'
  if (isProximaAudiencia(audiencia, 30)) return 'prestes_a_comecar'
  if (
    audiencia.status === 'em_andamento' &&
    isChecklistIncompletoCritico(procedimento)
  ) {
    return 'checklist_critico'
  }
  return 'normal'
}

const TIPO_ICONS: Record<TipoAudiencia, typeof Scale> = {
  instrucao: Scale,
  interrogatorio: Mic,
  oitiva: Users,
  julgamento: Gavel,
  audiencia_una: Users,
  sessao_juri: Gavel,
  outro: FileText,
}

function Toolbar({
  label,
  onNavigate,
  onNovaAudiencia,
  podeAgendar,
}: {
  label: string
  onNavigate?: (action: 'PREV' | 'TODAY' | 'NEXT') => void
  onNovaAudiencia: () => void
  podeAgendar: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aurora-border bg-aurora-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<ChevronLeft size={14} />}
          onClick={() => onNavigate?.('PREV')}
        >
          Anterior
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onNavigate?.('TODAY')}>
          Hoje
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={<ChevronRight size={14} />}
          onClick={() => onNavigate?.('NEXT')}
        >
          Próximo
        </Button>
      </div>

      <div className="text-sm font-semibold text-aurora-text-primary">
        {label}
      </div>

      <Button
        size="sm"
        variant="primary"
        icon={<Plus size={14} />}
        disabled={!podeAgendar}
        onClick={onNovaAudiencia}
      >
        Agendar audiência
      </Button>
    </div>
  )
}

function HeaderCell({
  date: headerDate,
  label,
}: {
  date?: Date
  label?: string
}) {
  const data = headerDate ?? new Date()
  const hoje = isSameDay(data, new Date())

  return (
    <div className="scac-calendar__header-cell">
      <span className="scac-calendar__header-label">
        {label ?? format(data, 'EEEEEE', { locale: ptBR })}
      </span>
      <span
        className={`scac-calendar__header-date ${hoje ? 'is-today' : ''}`}
        aria-label={hoje ? 'Hoje' : undefined}
      >
        {format(data, 'dd')}
      </span>
    </div>
  )
}

function MonthDateHeader({
  date: headerDate,
  label,
}: {
  date: Date
  label: string
}) {
  const hoje = isSameDay(headerDate, new Date())

  return (
    <div className="scac-calendar__month-date">
      <span className={`scac-calendar__month-date-number ${hoje ? 'is-today' : ''}`}>
        {label}
      </span>
    </div>
  )
}

function BaseEventCard({
  event,
  podeVerSigilo,
  checklistCritico = 0,
}: {
  event: CalEvent
  podeVerSigilo: boolean
  checklistCritico?: number
}) {
  const audiencia = event.resource
  const sigiloBloqueado = Boolean(audiencia.sigiloso && !podeVerSigilo)
  const Icon = TIPO_ICONS[audiencia.tipo] ?? FileText

  return (
    <div className="scac-event-card" title={sigiloBloqueado ? 'Reservado - Processo Sigiloso' : audiencia.numeroProcesso}>
      <div className="scac-event-card__top">
        <span className="scac-event-card__type">
          <Icon size={12} />
          <span>{sigiloBloqueado ? 'Sigiloso' : TIPO_AUDIENCIA_LABELS[audiencia.tipo]}</span>
        </span>
        {audiencia.sigiloso && (
          <span className="rounded-full bg-[#FDE2E2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#C53030]">
            Sigiloso
          </span>
        )}
        {checklistCritico > 0 && (
          <span className="scac-event-card__critical" title="Checklist obrigatório pendente">
            <AlertTriangle size={11} />
          </span>
        )}
      </div>
      <div className="scac-event-card__title" title={sigiloBloqueado ? 'Reservado - Processo Sigiloso' : audiencia.numeroProcesso}>
        {sigiloBloqueado ? 'Reservado - Processo Sigiloso' : audiencia.numeroProcesso}
      </div>
      <div className="scac-event-card__meta">
        {format(audiencia.dataHoraInicio.toDate(), 'HH:mm')} · {audiencia.salaNome ?? 'Sala'}
      </div>
    </div>
  )
}

function combinarDataHora(base: Date, horario: Date) {
  const combinado = new Date(base)
  combinado.setHours(
    horario.getHours(),
    horario.getMinutes(),
    horario.getSeconds(),
    horario.getMilliseconds(),
  )
  return combinado
}

function formatarHoraSlot(data: Date) {
  return data.toTimeString().slice(0, 5)
}

function slotForaExpediente(
  slotDate: Date,
  expedienteInicio: string,
  expedienteFim: string,
) {
  const horario = formatarHoraSlot(slotDate)
  const paraMinutos = (valor: string) => {
    const [horas, minutos] = valor.split(':').map(Number)
    return horas * 60 + minutos
  }

  const inicio = paraMinutos(horario)
  const expedienteIni = paraMinutos(expedienteInicio)
  const expedienteFimMin = paraMinutos(expedienteFim)

  return inicio < expedienteIni || inicio >= expedienteFimMin
}

function extrairDataDrop(
  x: number,
  y: number,
  inicioOriginal: Date,
) {
  const alvo = document.elementFromPoint(x, y)
  if (!(alvo instanceof HTMLElement)) return null

  const slot = alvo.closest<HTMLElement>('[data-slot-start]')
  if (slot?.dataset.slotStart) {
    const dataSlot = new Date(slot.dataset.slotStart)
    if (!Number.isNaN(dataSlot.getTime())) return dataSlot
  }

  const dia = alvo.closest<HTMLElement>('[data-day-start]')
  if (dia?.dataset.dayStart) {
    const dataDia = new Date(dia.dataset.dayStart)
    if (!Number.isNaN(dataDia.getTime())) {
      return combinarDataHora(dataDia, inicioOriginal)
    }
  }

  return null
}

function EventWrapper({
  children,
  event,
  podeEditar,
}: {
  children: ReactElement<any>
  event: CalEvent
  podeEditar: boolean
}) {
  if (!podeEditar || !isValidElement(children)) return children

  return cloneElement(children as ReactElement<any>, {
    draggable: true,
    onDragStart: (ev: ReactDragEvent<HTMLElement>) => {
      const inicio = event.resource.dataHoraInicio.toDate()
      const fim = event.resource.dataHoraFim.toDate()
      ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer.setData(
        DRAG_MIME_TYPE,
        JSON.stringify({
          audienciaId: event.resource.id,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
        }),
      )
    },
  })
}

export function CalendarioPauta({
  eventos,
  procedimentos,
  diasSemanaAtivos,
  view,
  date,
  podeEditar,
  podeAgendar,
  podeVerSigilo,
  expedienteInicio,
  expedienteFim,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onViewChange,
  onNavigate,
  onNovaAudiencia,
}: CalendarioPautaProps) {
  const eventStyleGetter = useCallback((event: CalEvent) => {
    const audiencia = event.resource
    const procedimento = procedimentos[audiencia.id] ?? null
    const classe = classificarEvento(audiencia, procedimento)
    const critico = isChecklistIncompletoCritico(procedimento)
    const sigiloBloqueado = Boolean(audiencia.sigiloso && !podeVerSigilo)

    return {
      className: [
        'scac-event',
        `scac-event--${audiencia.status}`,
        classe === 'prestes_a_comecar' ? 'is-near' : '',
        classe === 'atrasada' ? 'is-late' : '',
        critico ? 'has-critical' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        '--scac-event-accent': sigiloBloqueado
          ? '#64748B'
          : EVENT_COLORS[audiencia.status] ?? '#534AB7',
      } as CSSProperties,
    }
  }, [podeVerSigilo, procedimentos])

  const handleDragOver = useCallback((ev: ReactDragEvent<HTMLDivElement>) => {
    if (!podeEditar) return
    if (!ev.dataTransfer.types.includes(DRAG_MIME_TYPE)) return

    const bruto = ev.dataTransfer.getData(DRAG_MIME_TYPE)
    if (!bruto) return

    const payload = JSON.parse(bruto) as { inicio: string }
    const inicioOriginal = new Date(payload.inicio)
    const inicioDrop = extrairDataDrop(ev.clientX, ev.clientY, inicioOriginal)
    if (!inicioDrop) return

    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'move'
  }, [podeEditar])

  const handleDrop = useCallback((ev: ReactDragEvent<HTMLDivElement>) => {
    if (!podeEditar) return

    const bruto = ev.dataTransfer.getData(DRAG_MIME_TYPE)
    if (!bruto) return

    const payload = JSON.parse(bruto) as {
      audienciaId: string
      inicio: string
      fim: string
    }

    const evento = eventos.find((item) => item.resource.id === payload.audienciaId)
    if (!evento) return

    const inicioOriginal = new Date(payload.inicio)
    const fimOriginal = new Date(payload.fim)
    const novoInicio = extrairDataDrop(ev.clientX, ev.clientY, inicioOriginal)
    if (!novoInicio) return

    ev.preventDefault()

    const duracao = fimOriginal.getTime() - inicioOriginal.getTime()
    const novoFim = new Date(novoInicio.getTime() + duracao)

    onEventDrop({
      event: evento,
      start: novoInicio,
      end: novoFim,
    })
  }, [eventos, onEventDrop, podeEditar])

  return (
    <>
      <div
        className="scac-calendar-shell min-h-0 flex-1 overflow-hidden rounded-3xl border border-aurora-border bg-aurora-surface p-3"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <AgendaCalendar
          localizer={localizer}
          culture="pt-BR"
          events={eventos}
          date={date}
          view={view}
          min={new Date(0, 0, 0, 7, 0, 0)}
          max={new Date(0, 0, 0, 19, 0, 0)}
          scrollToTime={new Date(0, 0, 0, 8, 0, 0)}
          selectable={podeAgendar}
          resizable={false}
          popup
          step={30}
          timeslots={2}
          onView={(nextView: View) => onViewChange(nextView as ViewType)}
          onNavigate={onNavigate}
          onSelectEvent={(event: CalEvent) => onSelectEvent(event)}
          onSelectSlot={onSelectSlot}
          slotPropGetter={(slotDate: Date) => {
            const foraExpediente = slotForaExpediente(
              slotDate,
              expedienteInicio,
              expedienteFim,
            )
            const titles = [
              foraExpediente
                ? `Fora do expediente (${expedienteInicio} - ${expedienteFim})`
                : '',
            ].filter(Boolean)

            return {
              'data-slot-start': slotDate.toISOString(),
              title: titles.length > 0 ? titles.join(' | ') : undefined,
              className: [
                slotDate.getMinutes() === 0
                  ? 'scac-slot scac-slot--hour'
                  : 'scac-slot scac-slot--half',
                foraExpediente ? 'is-outside-business-hours' : '',
              ]
                .filter(Boolean)
                .join(' '),
              style:
                foraExpediente
                  ? {
                      cursor: 'not-allowed',
                      opacity: 0.58,
                      backgroundImage: foraExpediente
                        ? 'repeating-linear-gradient(135deg, rgba(15,23,42,0.08), rgba(15,23,42,0.08) 8px, rgba(15,23,42,0.16) 8px, rgba(15,23,42,0.16) 16px)'
                        : undefined,
                    }
                  : undefined,
            }
          }}
          dayPropGetter={(dayDate: Date) => ({
            'data-day-start': dayDate.toISOString(),
            className: [
              'scac-day',
              [0, 6].includes(dayDate.getDay()) ? 'is-weekend' : '',
              !(diasSemanaAtivos?.length ? diasSemanaAtivos : [1, 2, 3, 4, 5]).includes(dayDate.getDay())
                ? 'is-inactive-day'
                : '',
              isSameDay(dayDate, new Date()) ? 'is-today' : '',
            ]
              .filter(Boolean)
              .join(' '),
          })}
          eventPropGetter={eventStyleGetter}
          tooltipAccessor={(event: CalEvent) => {
            const a = event.resource
            if (a.sigiloso && !podeVerSigilo) {
              return `Reservado - Processo Sigiloso · ${a.salaNome ?? 'Sala'}`
            }
            const proc = procedimentos[a.id] ?? null
            const partes = []
            if (isAudienciaAtrasada(a)) {
              partes.push('Audiência atrasada — ainda não iniciada')
            }
            if (isProximaAudiencia(a, 30)) {
              partes.push('Começa em menos de 30 minutos')
            }
            if (isChecklistIncompletoCritico(proc)) {
              partes.push(
                `${proc?.itensCriticosPendentes} item(ns) obrigatório(s) pendente(s)`,
              )
            }
            if (a.reuPreso) {
              partes.push('Réu preso')
            }
            return partes.length > 0
              ? partes.join(' · ')
              : `${a.numeroProcesso} · ${a.salaNome}`
          }}
          messages={{
            next: 'Próximo',
            previous: 'Anterior',
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            agenda: 'Agenda',
            date: 'Data',
            time: 'Horário',
            event: 'Audiência',
            noEventsInRange:
              'Nenhuma audiência agendada para este período. Clique em um horário disponível para agendar.',
            showMore: (total: number) => `+${total} mais`,
          }}
          components={{
            toolbar: (props: ToolbarProps<CalEvent, object>) => (
              <Toolbar
                label={props.label}
                onNavigate={props.onNavigate}
                onNovaAudiencia={onNovaAudiencia}
                podeAgendar={podeAgendar}
              />
            ),
            header: (props: { date?: Date; label?: string }) => (
              <HeaderCell {...props} />
            ),
            month: {
              dateHeader: (props: { date: Date; label: string }) => (
                <MonthDateHeader {...props} />
              ),
            },
            event: (props: { event: CalEvent }) => (
              <BaseEventCard
                {...props}
                podeVerSigilo={podeVerSigilo}
                checklistCritico={procedimentos[props.event.resource.id]?.itensCriticosPendentes ?? 0}
              />
            ),
            eventWrapper: (props: { children: ReactElement; event: CalEvent }) => (
              <EventWrapper
                {...props}
                podeEditar={podeEditar}
              />
            ),
          }}
          className="scac-calendar h-full"
        />
      </div>

      <div className="space-y-2 text-xs text-aurora-text-muted">
        <div className="flex items-center gap-2">
          <Calendar size={14} />
          <span>
            Arraste uma audiência para remarcar a data · Clique em horário
            disponível para agendar
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-aurora-text-primary">Destaques:</span>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm border-2 border-[#BA7517] bg-[#EF9F27]"
              style={{ animation: 'pulsar 1.8s ease-in-out infinite' }}
            />
            <span>Prestes a começar (30 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border-2 border-[#A32D2D] bg-[#E24B4A]" />
            <span>Atrasada</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm border-2 border-dashed border-[#E24B4A] bg-[#534AB7]" />
            <span>Checklist com pendências obrigatórias</span>
          </div>
        </div>
      </div>
    </>
  )
}
