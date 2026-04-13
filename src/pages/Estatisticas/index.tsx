import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { format, subDays, startOfDay, addDays } from 'date-fns'
import { BarChart3, TrendingUp, Award, AlertCircle } from 'lucide-react'
import { useAudiencias } from '../../hooks/useAudiencias'
import { useProcedimentos } from '../../hooks/index'
import { Card, StatCard, PageLoader, EmptyState } from '../../components/ui'
import type { StatusAudiencia } from '../../types'
import {
  STATUS_AUDIENCIA_LABELS,
  TIPO_AUDIENCIA_LABELS,
  CLASSE_PROCESSUAL_LABELS,
  OBJETO_FEITO_LABELS,
} from '../../types'

const AURORA = {
  primary: '#3730A3',
  green: '#15803D',
  amber: '#B45309',
  red: '#C2410C',
  blue: '#1D4ED8',
  muted: '#94A3B8',
  text: '#64748B',
  textStrong: '#334155',
  grid: '#E2E8F0',
}

const STATUS_CORES: Record<StatusAudiencia, string> = {
  agendada: AURORA.blue,
  em_andamento: AURORA.amber,
  realizada: AURORA.green,
  redesignada: '#4F46E5',
  cancelada: AURORA.red,
  suspensa: AURORA.muted,
}

const tooltipStyle = {
  background: '#FFFFFF',
  border: '1px solid #D7DEEA',
  borderRadius: '12px',
  color: '#0F172A',
  fontSize: '12px',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
}

export default function Estatisticas() {
  const navigate = useNavigate()
  const { audiencias, loading } = useAudiencias()
  const { procedimentos, loading: loadingProcedimentos } = useProcedimentos()

  const stats = useMemo(() => {
    const total = audiencias.length
    const realizadas = audiencias.filter((a) => a.status === 'realizada').length
    const canceladas = audiencias.filter((a) => a.status === 'cancelada').length
    const reusPresos = audiencias.filter((a) => a.reuPreso === true).length
    const taxa = total > 0 ? Math.round((realizadas / total) * 100) : 0

    const porStatus = Object.entries(STATUS_AUDIENCIA_LABELS).map(([status, label]) => ({
      name: label,
      valor: audiencias.filter((a) => a.status === status).length,
      fill: STATUS_CORES[status as StatusAudiencia],
    })).filter((d) => d.valor > 0)

    const porTipo = Object.entries(TIPO_AUDIENCIA_LABELS).map(([tipo, label]) => ({
      name: label,
      valor: audiencias.filter((a) => a.tipo === tipo).length,
    })).filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor)

    const porClasse = Object.entries(CLASSE_PROCESSUAL_LABELS).map(([classe, label]) => ({
      name: label,
      valor: audiencias.filter((a) => a.classeProcessual === classe).length,
    })).filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor)

    const porObjeto = Object.entries(OBJETO_FEITO_LABELS).map(([objeto, label]) => ({
      name: label,
      valor: audiencias.filter((a) => a.objetoDoFeito === objeto).length,
    })).filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor)

    const ultimos14 = Array.from({ length: 14 }, (_, i) => {
      const dia = startOfDay(subDays(new Date(), 13 - i))
      const doDia = audiencias.filter((a) => startOfDay(a.dataHoraInicio.toDate()).getTime() === dia.getTime())
      return {
        dia: format(dia, 'dd/MM'),
        realizadas: doDia.filter((a) => a.status === 'realizada').length,
        canceladas: doDia.filter((a) => a.status === 'cancelada').length,
        total: doDia.length,
      }
    })

    return { total, realizadas, canceladas, reusPresos, taxa, porStatus, porTipo, porClasse, porObjeto, ultimos14 }
  }, [audiencias])

  const riscoReuPreso = useMemo(() => {
    const agora = new Date()
    const limite = addDays(agora, 30)
    const procedimentosPorAudiencia = new Map(procedimentos.map((procedimento) => [procedimento.audienciaId, procedimento]))

    const casos = audiencias
      .filter((audiencia) =>
        audiencia.reuPreso === true &&
        ['agendada', 'em_andamento'].includes(audiencia.status) &&
        audiencia.dataHoraInicio.toDate() >= agora &&
        audiencia.dataHoraInicio.toDate() <= limite,
      )
      .map((audiencia) => ({ audiencia, procedimento: procedimentosPorAudiencia.get(audiencia.id) }))
      .filter((caso) => !!caso.procedimento)

    return {
      emDia: casos.filter((caso) => (caso.procedimento?.itensCriticosPendentes ?? 0) <= 0),
      comPendencias: casos.filter((caso) => (caso.procedimento?.itensCriticosPendentes ?? 0) > 0),
    }
  }, [audiencias, procedimentos])

  if (loading || loadingProcedimentos) return <PageLoader />

  if (stats.total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Card padding="lg" className="bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)]">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Painel Analítico
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">Estatísticas</h1>
            <p className="mt-1 max-w-2xl text-sm text-aurora-text-secondary">
              Os indicadores passam a ser exibidos assim que a pauta começar a registrar audiências e procedimentos.
            </p>
          </div>
        </Card>

        <EmptyState
          icon={<BarChart3 size={24} />}
          title="Ainda não há dados para análise"
          description="Agende audiências e acompanhe procedimentos para visualizar os gráficos e indicadores deste painel."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Painel Analítico
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">Estatísticas</h1>
            <p className="mt-1 max-w-2xl text-sm text-aurora-text-secondary">
              Consulte indicadores de produtividade, risco operacional e distribuição da pauta com leitura mais clara e foco nos casos prioritários.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Audiências" value={stats.total} color="primary" icon={<BarChart3 size={14} />} />
            <StatCard label="Realizadas" value={stats.realizadas} color="green" icon={<Award size={14} />} />
            <StatCard label="Canceladas" value={stats.canceladas} color="red" icon={<AlertCircle size={14} />} />
            <StatCard label="Taxa" value={`${stats.taxa}%`} color="amber" icon={<TrendingUp size={14} />} />
            <StatCard label="Réus presos" value={stats.reusPresos} color={stats.reusPresos > 0 ? 'red' : 'green'} icon={<AlertCircle size={14} />} />
          </div>
        </div>
      </Card>

      <Card
        padding="md"
        className={riscoReuPreso.comPendencias.length > 0
          ? 'border-red-200 bg-red-50'
          : 'border-green-200 bg-green-50'}
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-aurora-text-primary">Painel de risco — réus presos</p>
            <p className="mt-1 text-xs text-aurora-text-secondary">Próximos 30 dias com foco em pendências obrigatórias do checklist</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-aurora-green">Réus presos — em dia</div>
              <div className="mt-2 text-3xl font-semibold text-aurora-text-primary">{riscoReuPreso.emDia.length}</div>
            </div>
            <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-aurora-red">Com pendências</div>
              <div className="mt-2 text-3xl font-semibold text-aurora-text-primary">{riscoReuPreso.comPendencias.length}</div>
            </div>
          </div>

          <div className="space-y-2">
            {riscoReuPreso.comPendencias.slice(0, 5).map(({ audiencia, procedimento }) => (
              <button
                key={audiencia.id}
                onClick={() => navigate(`/procedimentos/${procedimento?.id}`)}
                className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-left transition-colors hover:bg-red-50"
              >
                <span className="text-sm text-aurora-text-primary">
                  Proc {audiencia.numeroProcesso} · {format(audiencia.dataHoraInicio.toDate(), 'dd/MM')} às {format(audiencia.dataHoraInicio.toDate(), 'HH:mm')} · {procedimento?.itensCriticosPendentes ?? 0} item(ns) pendente(s)
                </span>
              </button>
            ))}

            {riscoReuPreso.comPendencias.length === 0 && (
              <div className="rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm text-aurora-text-secondary">
                Nenhuma audiência de réu preso com pendências obrigatórias.
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card padding="md" className="lg:col-span-3">
          <p className="mb-4 text-sm font-semibold text-aurora-text-primary">Últimos 14 dias</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.ultimos14} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AURORA.grid} />
              <XAxis dataKey="dia" tick={{ fill: AURORA.text, fontSize: 10 }} />
              <YAxis tick={{ fill: AURORA.text, fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: AURORA.textStrong }} />
              <Line type="monotone" dataKey="total" name="Total" stroke={AURORA.primary} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="realizadas" name="Realizadas" stroke={AURORA.green} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="canceladas" name="Canceladas" stroke={AURORA.red} strokeWidth={2.5} dot={false} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md" className="lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-aurora-text-primary">Por situação</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.porStatus} dataKey="valor" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {stats.porStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', color: AURORA.textStrong }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card padding="md">
        <p className="mb-4 text-sm font-semibold text-aurora-text-primary">Por tipo de audiência</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.porTipo} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AURORA.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: AURORA.text, fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: AURORA.textStrong, fontSize: 10 }} width={110} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="valor" name="Audiências" fill={AURORA.primary} radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padding="md">
          <p className="mb-4 text-sm font-semibold text-aurora-text-primary">Por classe processual</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.porClasse} layout="vertical" margin={{ top: 0, right: 16, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AURORA.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: AURORA.text, fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: AURORA.textStrong, fontSize: 10 }} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="valor" name="Audiências" fill={AURORA.blue} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card padding="md">
          <p className="mb-4 text-sm font-semibold text-aurora-text-primary">Por objeto do feito</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.porObjeto} layout="vertical" margin={{ top: 0, right: 16, left: 90, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AURORA.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: AURORA.text, fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: AURORA.textStrong, fontSize: 10 }} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="valor" name="Audiências" fill={AURORA.green} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
