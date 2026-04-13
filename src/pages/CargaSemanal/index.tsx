import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CalendarDays, DoorOpen, Scale, UserRound } from 'lucide-react'
import { db } from '../../lib/firebase'
import { normalizarAudiencia } from '../../lib/normalizarDados'
import { useSalas, useUsuarios } from '../../hooks'
import { Badge, Button, Card, EmptyState, PageLoader, StatCard } from '../../components/ui'
import {
  formatarHorario,
  isAudienciaAtrasada,
  isProximaAudiencia,
} from '../../lib/audienciaHelpers'
import type { Audiencia, Sala, StatusAudiencia, Usuario } from '../../types'

function useAudienciasSemana(dataInicio: Date, dataFim: Date) {
  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'audiencias'),
      where('dataHoraInicio', '>=', Timestamp.fromDate(dataInicio)),
      where('dataHoraInicio', '<=', Timestamp.fromDate(dataFim)),
      where('status', 'not-in', ['cancelada', 'redesignada']),
    )

    return onSnapshot(q, (snapshot) => {
      setAudiencias(
        snapshot.docs.map((item) => normalizarAudiencia(item.id, item.data())),
      )
      setLoading(false)
    })
  }, [dataFim, dataInicio])

  return { audiencias, loading }
}

function inicioSemanaBase(data: Date) {
  return startOfWeek(data, { weekStartsOn: 1 })
}

function fimSemanaUtil(data: Date) {
  const domingo = endOfWeek(data, { weekStartsOn: 1 })
  return new Date(
    domingo.getFullYear(),
    domingo.getMonth(),
    domingo.getDate() - 2,
    23,
    59,
    59,
    999,
  )
}

function minutosComprometidos(audiencias: Audiencia[]) {
  return audiencias.reduce(
    (acc, item) =>
      acc +
      Math.round(
        (item.dataHoraFim.toDate().getTime() - item.dataHoraInicio.toDate().getTime()) /
          60000,
      ),
    0,
  )
}

function corStatus(status: StatusAudiencia) {
  if (status === 'em_andamento') return 'bg-aurora-amber'
  if (status === 'realizada') return 'bg-aurora-green'
  return 'bg-aurora-primary'
}

function temConflito(audiencias: Audiencia[]) {
  const ordenadas = [...audiencias].sort(
    (a, b) => a.dataHoraInicio.toDate().getTime() - b.dataHoraInicio.toDate().getTime(),
  )

  for (let i = 0; i < ordenadas.length - 1; i += 1) {
    const atual = ordenadas[i]
    const proxima = ordenadas[i + 1]
    if (atual.dataHoraFim.toDate().getTime() > proxima.dataHoraInicio.toDate().getTime()) {
      return true
    }
  }

  return false
}

function DiaColuna({
  dia,
  audiencias,
  tipo,
  onVerMais,
}: {
  dia: Date
  audiencias: Audiencia[]
  tipo: 'magistrado' | 'sala'
  onVerMais: (dia: Date) => void
}) {
  const excesso = audiencias.length > 3 ? audiencias.length - 3 : 0
  const lista = excesso > 0 ? audiencias.slice(0, 3) : audiencias
  const diaCheio = tipo === 'magistrado' && audiencias.length > 4
  const conflito = tipo === 'sala' && temConflito(audiencias)

  return (
    <div
      className={`rounded-xl border p-3 ${
        conflito
          ? 'border-aurora-red/30 bg-aurora-red-muted/30'
          : diaCheio
            ? 'border-aurora-amber/30 bg-aurora-amber-muted/30'
            : 'border-aurora-border bg-aurora-elevated'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className={`text-xs font-semibold ${
            isToday(dia) ? 'text-aurora-primary-light' : 'text-aurora-text-secondary'
          }`}
        >
          {format(dia, 'EEE dd/MM', { locale: ptBR })}
        </div>
        {diaCheio && <Badge variant="warning">Dia cheio</Badge>}
        {conflito && <Badge variant="danger">Verificar conflito</Badge>}
      </div>

      {!lista.length ? (
        <div className="py-6 text-center text-sm text-aurora-text-muted">-</div>
      ) : (
        <div className="space-y-2">
          {lista.map((audiencia) => (
            <div
              key={audiencia.id}
              className="rounded-lg border border-aurora-border-light bg-aurora-surface px-2 py-2 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${corStatus(audiencia.status)}`} />
                <span className="font-medium text-aurora-text-primary">
                  {formatarHorario(audiencia.dataHoraInicio)}
                </span>
                {isProximaAudiencia(audiencia) && <Badge variant="warning">Em breve</Badge>}
                {isAudienciaAtrasada(audiencia) && <Badge variant="danger">Atrasada</Badge>}
              </div>
              <div className="mt-1 truncate font-mono text-2xs text-aurora-text-secondary">
                {audiencia.numeroProcesso}
              </div>
            </div>
          ))}

          {excesso > 0 && (
            <button
              type="button"
              onClick={() => onVerMais(dia)}
              className="text-xs font-medium text-aurora-primary-light hover:text-aurora-text-primary"
            >
              +{excesso} mais
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PainelGrupo({
  titulo,
  diasUteis,
  grupos,
  tipo,
  onVerMais,
}: {
  titulo: string
  diasUteis: Date[]
  grupos: Array<{
    id: string
    nome: string
    subtitulo: string
    audiencias: Audiencia[]
  }>
  tipo: 'magistrado' | 'sala'
  onVerMais: (dia: Date) => void
}) {
  return (
    <Card className="space-y-4 border-aurora-border-light">
      <div className="text-base font-semibold text-aurora-text-primary">{titulo}</div>

      {!grupos.length ? (
        <EmptyState
          title={`Nenhuma audiência encontrada ${titulo === 'Por magistrado' ? 'para magistrados' : 'para salas'} nesta semana.`}
          description="Ajuste o período para visualizar outra distribuição."
        />
      ) : (
        <div className="space-y-4">
          {grupos.map((grupo) => (
            <Card key={grupo.id} padding="sm" className="space-y-3 border-aurora-border-light bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-aurora-text-primary">
                    {grupo.nome}
                  </div>
                  <div className="text-xs text-aurora-text-muted">{grupo.subtitulo}</div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-aurora-primary-light">
                    {grupo.audiencias.length} audiência(s)
                  </span>
                  <span className="text-aurora-text-muted">
                    {minutosComprometidos(grupo.audiencias)} min
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {diasUteis.map((dia) => (
                  <DiaColuna
                    key={`${grupo.id}-${dia.toISOString()}`}
                    dia={dia}
                    audiencias={grupo.audiencias.filter((item) =>
                      isSameDay(item.dataHoraInicio.toDate(), dia),
                    )}
                    tipo={tipo}
                    onVerMais={onVerMais}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function CargaSemanal() {
  const navigate = useNavigate()
  const [semanaBase, setSemanaBase] = useState(() => inicioSemanaBase(new Date()))
  const { usuarios } = useUsuarios()
  const { salas } = useSalas()

  const dataInicio = useMemo(() => inicioSemanaBase(semanaBase), [semanaBase])
  const dataFim = useMemo(() => fimSemanaUtil(semanaBase), [semanaBase])
  const diasUteis = useMemo(
    () => eachDayOfInterval({ start: dataInicio, end: dataFim }).slice(0, 5),
    [dataFim, dataInicio],
  )

  const { audiencias, loading } = useAudienciasSemana(dataInicio, dataFim)

  const magistradosComAudiencia = useMemo(() => {
    const mapa = new Map<string, Audiencia[]>()
    for (const audiencia of audiencias) {
      const chave = audiencia.magistradoId || audiencia.magistradoNome || 'sem-magistrado'
      const atual = mapa.get(chave) ?? []
      atual.push(audiencia)
      mapa.set(chave, atual)
    }

    return Array.from(mapa.entries())
      .map(([id, itens]) => {
        const magistrado = usuarios.find((item) => item.uid === id)
        return {
          id,
          nome: magistrado?.nome ?? itens[0]?.magistradoNome ?? 'Magistrado não identificado',
          subtitulo:
            magistrado?.perfil === 'magistrado' ? 'Magistrado' : 'Responsável pela pauta',
          audiencias: itens.sort(
            (a, b) =>
              a.dataHoraInicio.toDate().getTime() - b.dataHoraInicio.toDate().getTime(),
          ),
        }
      })
      .sort((a, b) => b.audiencias.length - a.audiencias.length)
  }, [audiencias, usuarios])

  const salasComAudiencia = useMemo(() => {
    const mapa = new Map<string, Audiencia[]>()
    for (const audiencia of audiencias) {
      const chave = audiencia.salaId || audiencia.salaNome || 'sem-sala'
      const atual = mapa.get(chave) ?? []
      atual.push(audiencia)
      mapa.set(chave, atual)
    }

    return Array.from(mapa.entries())
      .map(([id, itens]) => {
        const sala = salas.find((item) => item.id === id)
        return {
          id,
          nome: sala?.nome ?? itens[0]?.salaNome ?? 'Sala não identificada',
          subtitulo: sala?.descricao ?? 'Distribuição por sala',
          audiencias: itens.sort(
            (a, b) =>
              a.dataHoraInicio.toDate().getTime() - b.dataHoraInicio.toDate().getTime(),
          ),
        }
      })
      .sort((a, b) => b.audiencias.length - a.audiencias.length)
  }, [audiencias, salas])

  const resumo = useMemo(() => {
    const porDia = diasUteis.map((dia) => ({
      dia,
      quantidade: audiencias.filter((item) => isSameDay(item.dataHoraInicio.toDate(), dia))
        .length,
    }))
    const porMagistrado = magistradosComAudiencia.map((item) => ({
      nome: item.nome,
      quantidade: item.audiencias.length,
    }))

    const diaMais = [...porDia].sort((a, b) => b.quantidade - a.quantidade)[0]
    const magistradoMais = [...porMagistrado].sort((a, b) => b.quantidade - a.quantidade)[0]
    const salasUsadas = new Set(audiencias.map((item) => item.salaId)).size

    return {
      total: audiencias.length,
      diaMais,
      magistradoMais,
      salasUsadas,
    }
  }, [audiencias, diasUteis, magistradosComAudiencia])

  const verMais = (dia: Date) => {
    navigate('/', { state: { dataFiltro: dia.toISOString() } })
  }

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-aurora-border-light bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)] p-5">
        <div>
          <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
            Planejamento semanal
          </div>
          <h1 className="text-3xl font-semibold text-aurora-text-primary">
            Distribuição semanal de audiências
          </h1>
          <p className="text-sm text-aurora-text-muted">
            Semana de {format(dataInicio, 'dd/MM', { locale: ptBR })} a{' '}
            {format(dataFim, 'dd/MM', { locale: ptBR })} — use para planejar a
            pauta sem sobrecarga
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSemanaBase((atual) => subWeeks(atual, 1))}
          >
            ‹ Semana anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSemanaBase(inicioSemanaBase(new Date()))}
          >
            Semana atual
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSemanaBase((atual) => addWeeks(atual, 1))}
          >
            Semana seguinte ›
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de audiências na semana"
          value={resumo.total}
          color="primary"
          icon={<CalendarDays size={16} />}
        />
        <StatCard
          label="Dia com mais audiências"
          value={
            resumo.diaMais
              ? `${format(resumo.diaMais.dia, 'EEE', { locale: ptBR })} ${resumo.diaMais.quantidade}`
              : '-'
          }
          sub={resumo.diaMais ? `${format(resumo.diaMais.dia, 'dd/MM', { locale: ptBR })}` : undefined}
          color="amber"
          icon={<AlertTriangle size={16} />}
        />
        <StatCard
          label="Magistrado com mais audiências"
          value={resumo.magistradoMais?.quantidade ?? '-'}
          sub={resumo.magistradoMais?.nome}
          color="green"
          icon={<UserRound size={16} />}
        />
        <StatCard
          label="Salas utilizadas"
          value={`${resumo.salasUsadas} de ${salas.length}`}
          color="primary"
          icon={<DoorOpen size={16} />}
        />
      </div>

      {!audiencias.length ? (
        <EmptyState
          icon={<Scale size={24} />}
          title="Nenhuma audiência encontrada nesta semana."
          description="Use a navegação de semanas para consultar outro período."
        />
      ) : (
        <div className="space-y-4">
          <PainelGrupo
            titulo="Por magistrado"
            diasUteis={diasUteis}
            grupos={magistradosComAudiencia}
            tipo="magistrado"
            onVerMais={verMais}
          />

          <PainelGrupo
            titulo="Por sala"
            diasUteis={diasUteis}
            grupos={salasComAudiencia}
            tipo="sala"
            onVerMais={verMais}
          />
        </div>
      )}
    </div>
  )
}
