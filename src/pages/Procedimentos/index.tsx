import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClipboardList, Search, AlertTriangle, ChevronRight } from 'lucide-react'
import { useProcedimentos, useSigilo } from '../../hooks/index'
import { useAudiencias } from '../../hooks/useAudiencias'
import { useAuth } from '../../contexts/AuthContext'
import { Badge, Button, Card, Input, Select, PageLoader, EmptyState, StatCard } from '../../components/ui'
import type { StatusProcedimento } from '../../types'

const STATUS_LABELS: Record<StatusProcedimento, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  com_pendencias_criticas: 'Com pendências obrigatórias',
}

export default function Procedimentos() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [params] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') ?? '')
  const [filtroStatus, setFiltroStatus] = useState<StatusProcedimento | ''>('')
  const { procedimentos, loading } = useProcedimentos()
  const { audiencias, loading: loadingAudiencias } = useAudiencias()
  const { estaAutorizado } = useSigilo()

  const audienciasPorId = useMemo(
    () => new Map(audiencias.map((audiencia) => [audiencia.id, audiencia])),
    [audiencias],
  )
  const usuarioAutorizadoSigilo = Boolean(
    usuario && estaAutorizado(usuario.uid, usuario.perfil),
  )

  const filtrados = useMemo(
    () => procedimentos.filter((p) => {
      const audiencia = audienciasPorId.get(p.audienciaId)
      if (audiencia?.sigiloso && !usuarioAutorizadoSigilo) return false
      const matchBusca = !busca || p.numeroProcesso.toLowerCase().includes(busca.toLowerCase())
      const matchStatus = !filtroStatus || p.status === filtroStatus
      return matchBusca && matchStatus
    }),
    [procedimentos, audienciasPorId, usuarioAutorizadoSigilo, busca, filtroStatus],
  )

  const stats = useMemo(() => ({
    total: procedimentos.length,
    pendenciasObrigatorias: procedimentos.filter((p) => p.status === 'com_pendencias_criticas').length,
    andamento: procedimentos.filter((p) => p.status === 'em_andamento').length,
    concluidos: procedimentos.filter((p) => p.status === 'concluido').length,
  }), [procedimentos])

  if (loading || loadingAudiencias) return <PageLoader />

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Controle de Procedimentos
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">Acompanhamentos</h1>
            <p className="mt-1 max-w-2xl text-sm text-aurora-text-secondary">
              Acompanhe o avanço dos checklists, as pendências obrigatórias e o histórico operacional de cada audiência.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={stats.total} color="primary" icon={<ClipboardList size={14} />} />
            <StatCard label="Pendências" value={stats.pendenciasObrigatorias} color="red" />
            <StatCard label="Em andamento" value={stats.andamento} color="amber" />
            <StatCard label="Concluídos" value={stats.concluidos} color="green" />
          </div>
        </div>
      </Card>

      <Card padding="md" className="border-aurora-border-light bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Input
            label="Buscar por número do processo"
            placeholder="Informe o número do processo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            iconLeft={<Search size={13} />}
            className="flex-1"
          />
          <div className="lg:w-[280px]">
            <Select
              label="Filtrar por situação"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as StatusProcedimento | '')}
            >
              <option value="">Todas as situações</option>
              {(Object.entries(STATUS_LABELS) as [StatusProcedimento, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={24} />}
          title="Nenhum acompanhamento localizado"
          description={busca
            ? 'Tente buscar pelo número do processo.'
            : 'Nenhum acompanhamento disponível neste momento. Agende uma audiência para iniciar o fluxo.'}
          action={
            (busca || filtroStatus) ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBusca('')
                  setFiltroStatus('')
                }}
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtrados.map((p) => {
            const audiencia = audienciasPorId.get(p.audienciaId)
            const sigiloso = Boolean(audiencia?.sigiloso)

            return (
            <Card
              key={p.id}
              hover
              padding="md"
              className="border-l-4 border-l-aurora-primary/60"
              onClick={() => navigate(`/procedimentos/${p.id}`)}
            >
              <div className="flex items-center gap-4">
                {p.status === 'com_pendencias_criticas' && (
                  <AlertTriangle size={15} className="shrink-0 text-aurora-red animate-pulse-critical" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-aurora-text-primary">{p.numeroProcesso}</span>
                    <Badge statusProcedimento={p.status} pulse={p.status === 'com_pendencias_criticas'}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                    {sigiloso && <Badge variant="danger">Sigiloso</Badge>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="h-2 max-w-[280px] flex-1 overflow-hidden rounded-full bg-aurora-elevated">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${p.progresso}%`,
                          background: p.status === 'concluido' ? '#15803D' : p.itensCriticosPendentes > 0 ? '#C2410C' : '#3730A3',
                        }}
                      />
                    </div>
                    <span className="whitespace-nowrap text-2xs font-medium text-aurora-text-muted">
                      {p.itensConcluidos}/{p.totalItens} · {p.progresso}%
                    </span>
                    {p.itensCriticosPendentes > 0 && (
                      <span className="text-2xs font-medium text-aurora-red">
                        {p.itensCriticosPendentes} obrigatório{p.itensCriticosPendentes > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="shrink-0 text-aurora-text-muted" />
              </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
