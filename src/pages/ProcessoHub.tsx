import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button, Card, EmptyState, SkeletonLine } from '../components/ui'
import { ModalEditarProcesso } from '../components/processo/ModalEditarProcesso'
import { ModalEtiquetasPrioridades } from '../components/processo/ModalEtiquetasPrioridades'
import { SecaoPrescricao } from '../components/processo/SecaoPrescricao'
import { AlertaCard } from '../components/shared/AlertaCard'
import { BadgeMetaCNJ } from '../components/shared/BadgeMetaCNJ'
import { BadgePrioridade } from '../components/shared/BadgePrioridade'
import { BadgeStatusFase } from '../components/shared/BadgeStatusFase'
import { ChipEtiqueta } from '../components/shared/ChipEtiqueta'
import { useProcesso } from '../hooks/useProcesso'
import { ROTAS } from '../router/rotas'
import { StatusFase, TipoAlerta, TipoAudiencia, type Processo } from '../types/core'

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiencia de Instrucao e Julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiencia de Custodia',
  [TipoAudiencia.PRELIMINAR]: 'Audiencia Preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologacao',
  [TipoAudiencia.INSTRUCAO]: 'Instrucao',
  [TipoAudiencia.OUTRO]: 'Outro',
}

const FASES = [
  {
    numero: 1,
    chave: 'fase1',
    titulo: 'Fase 1',
    subtitulo: 'Pre-agendamento',
    rota: ROTAS.processoFase1,
  },
  {
    numero: 2,
    chave: 'fase2',
    titulo: 'Fase 2',
    subtitulo: 'Audiencia',
    rota: ROTAS.processoFase2,
  },
  {
    numero: 3,
    chave: 'fase3',
    titulo: 'Fase 3',
    subtitulo: 'Pos-audiencia',
    rota: ROTAS.processoFase3,
  },
] as const

function classNameCirculo(status: StatusFase) {
  switch (status) {
    case StatusFase.CONCLUIDA:
      return 'border-green-500 bg-green-500 text-white'
    case StatusFase.COM_PENDENCIA:
      return 'border-red-500 bg-red-500 text-white'
    case StatusFase.EM_ANDAMENTO:
      return 'border-amber-500 bg-amber-500 text-white'
    default:
      return 'border-slate-600 bg-slate-700/50 text-slate-200'
  }
}

function iconeCirculo(status: StatusFase, numero: number) {
  if (status === StatusFase.CONCLUIDA) {
    return <Check size={16} />
  }

  if (status === StatusFase.COM_PENDENCIA) {
    return <AlertTriangle size={16} />
  }

  return <span className="text-sm font-semibold">{numero}</span>
}

function ordenarAlertas(a: Processo['prescricao'], b: Processo['prescricao']) {
  return [a, b]
}

export default function ProcessoHub() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { processo, alertas, carregando, erro, atualizarProcesso } = useProcesso(id)
  const [modalProcessoAberto, setModalProcessoAberto] = useState(false)
  const [modalEtiquetasAberto, setModalEtiquetasAberto] = useState(false)
  const [prescricaoExpandida, setPrescricaoExpandida] = useState(false)
  const [mostrarTodosAlertas, setMostrarTodosAlertas] = useState(false)

  const alertasOrdenados = useMemo(() => {
    const pesos: Record<TipoAlerta, number> = {
      [TipoAlerta.PRESCRICAO_VENCIDA]: 0,
      [TipoAlerta.CARTA_PRECATORIA_40_DIAS]: 1,
      [TipoAlerta.PRESCRICAO_7_DIAS]: 2,
      [TipoAlerta.PRESCRICAO_30_DIAS]: 3,
      [TipoAlerta.CARTA_PRECATORIA_30_DIAS]: 4,
      [TipoAlerta.INTIMACAO_PENDENTE]: 5,
      [TipoAlerta.FASE_COM_PENDENCIA]: 6,
      [TipoAlerta.PRESCRICAO_90_DIAS]: 7,
    }

    return [...alertas].sort((a, b) => pesos[a.tipo] - pesos[b.tipo])
  }, [alertas])

  if (carregando) {
    return (
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
        <Card className="space-y-4">
          <SkeletonLine className="h-5 w-40" />
          <SkeletonLine className="h-10 w-72" />
          <SkeletonLine className="h-4 w-52" />
          <SkeletonLine className="h-4 w-64" />
        </Card>
        <Card className="space-y-3">
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="h-10 w-full" />
          <SkeletonLine className="h-10 w-3/4" />
        </Card>
        <Card className="space-y-4">
          <SkeletonLine className="h-5 w-28" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="rounded-2xl border border-aurora-border p-4">
                <SkeletonLine className="h-10 w-10 rounded-full" />
                <SkeletonLine className="mt-4 h-4 w-24" />
                <SkeletonLine className="mt-2 h-4 w-32" />
                <SkeletonLine className="mt-4 h-8 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <Card className="border-red-300 bg-red-50 text-red-700">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="space-y-4">
              <div>
                <div className="text-base font-semibold">Nao foi possivel carregar o processo</div>
                <div className="mt-1 text-sm">{erro}</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (!processo) {
    return (
      <div className="mx-auto w-full max-w-[900px]">
        <EmptyState
          icon={<AlertTriangle size={22} />}
          title="Processo nao encontrado"
          description="Nao localizamos um processo com este identificador."
          action={(
            <Button variant="primary" size="sm" onClick={() => navigate(ROTAS.FILA)}>
              Voltar para a fila
            </Button>
          )}
        />
      </div>
    )
  }

  const alertasVisiveis = mostrarTodosAlertas ? alertasOrdenados : alertasOrdenados.slice(0, 5)

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <Card className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-aurora-text-muted">
              Processo
            </div>
            <h1 className="mt-2 break-all text-3xl font-semibold text-aurora-primary">
              {processo.numeroProcesso}
            </h1>
            {processo.fases.fase3 === StatusFase.CONCLUIDA && (
              <span className="mt-2 inline-flex rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                Processo encerrado
              </span>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-aurora-text-secondary">
              <span className="rounded-full border border-aurora-border bg-aurora-elevated px-3 py-1">
                {TIPO_AUDIENCIA_LABELS[processo.tipoAudiencia]}
              </span>
              <span>{processo.cargoMagistrado}</span>
            </div>
            {processo.naturezaCrime && (
              <div className="mt-3 text-sm text-aurora-text-secondary">
                Natureza do crime: {processo.naturezaCrime}
              </div>
            )}
            {processo.totalParticipantes > 0 && (
              <div className="mt-2 text-sm text-aurora-text-muted">
                {processo.totalParticipantes} participante(s) cadastrado(s){' '}
                <Link to={ROTAS.processoFase2(id)} className="text-aurora-primary hover:underline">
                  Ver na Fase 2 →
                </Link>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate(ROTAS.FILA)}
          >
            Voltar para a fila
          </Button>
        </div>
      </Card>

      <Card className="space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
              Prioridades
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
              Etiquetas
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {processo.etiquetas.length > 0 ? (
                processo.etiquetas.map((etiqueta) => (
                  <ChipEtiqueta key={etiqueta} texto={etiqueta} />
                ))
              ) : (
                <span className="text-sm text-aurora-text-muted">Sem etiquetas</span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
              Meta CNJ
            </div>
            <div className="mt-3">
              <BadgeMetaCNJ meta={processo.metaCNJ} />
              {!processo.metaCNJ || processo.metaCNJ === 'sem_meta' ? (
                <span className="text-sm text-aurora-text-muted">Sem meta vinculada</span>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Fluxo do processo</div>
        <div className="grid gap-4 md:grid-cols-3">
          {FASES.map((fase) => {
            const status = processo.fases[fase.chave]
            const labelAcao = fase.chave === 'fase3' && status === StatusFase.CONCLUIDA
              ? 'Ver encerramento'
              : status === StatusFase.NAO_INICIADA
                ? 'Iniciar fase'
                : 'Acessar'

            return (
              <div key={fase.chave} className="rounded-2xl border border-aurora-border bg-aurora-elevated p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${classNameCirculo(status)}`}>
                  {iconeCirculo(status, fase.numero)}
                </div>
                <div className="mt-4 text-sm font-semibold text-aurora-text-primary">{fase.titulo}</div>
                <div className="mt-1 text-sm text-aurora-text-secondary">{fase.subtitulo}</div>
                <div className="mt-3">
                  <BadgeStatusFase status={status} rotulo={fase.titulo} />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                  iconRight={<ArrowRight size={14} />}
                  onClick={() => navigate(fase.rota(id))}
                >
                  {labelAcao}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-aurora-text-primary">Alertas ativos</div>
          {alertasOrdenados.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              icon={mostrarTodosAlertas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              onClick={() => setMostrarTodosAlertas((atual) => !atual)}
            >
              {mostrarTodosAlertas ? 'Mostrar menos' : 'Ver todos os alertas'}
            </Button>
          )}
        </div>

        {alertasOrdenados.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={16} />
            <span>Nenhum alerta ativo para este processo.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {alertasVisiveis.map((alerta, index) => (
              <AlertaCard key={`${alerta.tipo}-${index}`} alerta={alerta} />
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="text-sm font-semibold text-aurora-text-primary">Acoes rapidas</div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onClick={() => setModalProcessoAberto(true)}>
            Editar dados do processo
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setModalEtiquetasAberto(true)}>
            Editar etiquetas e prioridades
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPrescricaoExpandida((atual) => !atual)}
          >
            Ver prescricao
          </Button>
        </div>

        <SecaoPrescricao
          prescricao={processo.prescricao}
          alertas={alertasOrdenados}
          expandido={prescricaoExpandida}
          onAlternarExpandido={() => setPrescricaoExpandida((atual) => !atual)}
          onSalvar={async (dados) => {
            await atualizarProcesso({ prescricao: dados })
          }}
        />
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
