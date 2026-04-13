import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { ClipboardList, Plus } from 'lucide-react'
import { Button, Card, EmptyState, PageLoader } from '../../components/ui'
import { CardProcessoFila } from '../../components/fila/CardProcessoFila'
import { ModalCriarProcesso } from '../../components/fila/ModalCriarProcesso'
import { PainelFiltros } from '../../components/fila/PainelFiltros'
import { filtrarProcessosFila, ordenarProcessosFila, useFilaProcessos } from '../../hooks/useFilaProcessos'
import { useProcessos } from '../../hooks/useProcessos'
import { db } from '../../lib/firebase'
import { mapearCargoMagistradoParaTexto, mapearTipoAudienciaFilaParaCore } from '../../lib/processosCore'
import { normalizarProcessoPendente } from '../../lib/normalizarDados'
import { ROTAS } from '../../router/rotas'
import { MetaCNJ, Prioridade, StatusFase, type Processo } from '../../types/core'
import type { ProcessoPendente } from '../../types'

function usePendentesLegados() {
  const [pendentes, setPendentes] = useState<ProcessoPendente[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const consulta = query(
      collection(db, 'processos_pendentes'),
      where('situacao', '==', 'aguardando'),
      orderBy('dataInclusao', 'desc'),
    )

    return onSnapshot(consulta, (snapshot) => {
      setPendentes(snapshot.docs.map((item) =>
        normalizarProcessoPendente(item.id, item.data() as Record<string, unknown>),
      ))
      setCarregando(false)
    })
  }, [])

  return { pendentes, carregando }
}

function normalizarNumeroProcesso(valor: string) {
  return valor.replace(/\s+/g, '').toLowerCase()
}

function legadoParaProcesso(pendente: ProcessoPendente): Processo {
  const criadoEm = pendente.dataInclusao.toDate()
  const prioridades = pendente.reuPreso ? [Prioridade.REU_PRESO] : []

  return {
    id: pendente.id,
    numeroProcesso: pendente.numeroProcesso,
    tipoAudiencia: mapearTipoAudienciaFilaParaCore(pendente.tipoAudiencia),
    naturezaCrime: undefined,
    metaCNJ: MetaCNJ.SEM_META,
    cargoMagistrado: mapearCargoMagistradoParaTexto(pendente.cargoMagistrado),
    prioridades,
    etiquetas: [],
    etiquetasSistemicas: [],
    prescricao: {
      alertaAtivo: true,
    },
    fases: {
      fase1: StatusFase.EM_ANDAMENTO,
      fase2: StatusFase.NAO_INICIADA,
      fase3: StatusFase.NAO_INICIADA,
    },
    totalParticipantes: 0,
    totalIntimacoesPendentes: 0,
    totalCartasPrecatoriasEmAlerta: 0,
    observacoes: pendente.observacoes,
    criadoEm,
    atualizadoEm: criadoEm,
    criadoPor: pendente.criadoPor ?? 'legado',
  }
}

function filtrosAtivos(filtro: ReturnType<typeof useFilaProcessos>['filtro']) {
  return Boolean(
    filtro.busca?.trim()
    || filtro.prioridades?.length
    || filtro.metaCNJ
    || filtro.etiquetas?.length
    || filtro.tipoAudiencia
    || filtro.statusFase1
    || filtro.apenasComAlerta,
  )
}

export default function ListaEspera() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    filtro,
    ordenacao,
    carregando: carregandoFila,
    erro,
    setFiltro,
    setOrdenacao,
    limparFiltros,
  } = useFilaProcessos()
  const { processos: processosNovosBase } = useProcessos()
  const { pendentes, carregando: carregandoLegados } = usePendentesLegados()
  const [modalAberto, setModalAberto] = useState(false)

  useEffect(() => {
    const busca = new URLSearchParams(location.search).get('busca')
    if (busca && busca !== (filtro.busca ?? '')) {
      setFiltro({ busca })
    }
  }, [filtro.busca, location.search, setFiltro])

  const legadosComoProcesso = useMemo(() => {
    const numerosNovos = new Set(processosNovosBase.map((processo) =>
      normalizarNumeroProcesso(processo.numeroProcesso),
    ))

    // TODO: remover após validação completa da migração
    return pendentes
      .filter((pendente) => !numerosNovos.has(normalizarNumeroProcesso(pendente.numeroProcesso)))
      .map(legadoParaProcesso)
  }, [pendentes, processosNovosBase])

  const processosCombinados = useMemo(() => {
    const unicos = new Map<string, Processo>()
    for (const processo of [...processosNovosBase, ...legadosComoProcesso]) {
      const chave = normalizarNumeroProcesso(processo.numeroProcesso)
      if (!unicos.has(chave)) {
        unicos.set(chave, processo)
      }
    }
    return [...unicos.values()]
  }, [legadosComoProcesso, processosNovosBase])

  const processosFiltrados = useMemo(() => {
    const filtrados = filtrarProcessosFila(processosCombinados, filtro)
    return ordenarProcessosFila(filtrados, ordenacao)
  }, [filtro, ordenacao, processosCombinados])

  const carregando = carregandoFila || carregandoLegados
  const total = processosCombinados.length
  const totalFiltrado = processosFiltrados.length
  const haFiltros = filtrosAtivos(filtro)

  if (carregando) {
    return <PageLoader />
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-aurora-text-primary">Fila de processos</h1>
          <p className="mt-1 text-sm text-aurora-text-secondary">
            Visualize, filtre e acompanhe os processos aguardando andamento.
          </p>
        </div>

        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setModalAberto(true)}>
          Novo processo
        </Button>
      </div>

      <PainelFiltros
        filtro={filtro}
        ordenacao={ordenacao}
        total={total}
        totalFiltrado={totalFiltrado}
        onFiltroChange={setFiltro}
        onOrdenacaoChange={setOrdenacao}
        onLimpar={() => {
          limparFiltros()
          navigate(ROTAS.FILA, { replace: true })
        }}
      />

      {processosFiltrados.length === 0 ? (
        haFiltros ? (
          <EmptyState
            icon={<ClipboardList size={24} />}
            title="Nenhum processo encontrado com os filtros aplicados."
            action={(
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  limparFiltros()
                  navigate(ROTAS.FILA, { replace: true })
                }}
              >
                Limpar filtros
              </Button>
            )}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList size={24} />}
            title="Nenhum processo na fila."
            action={(
              <Button variant="primary" size="sm" onClick={() => setModalAberto(true)}>
                Adicionar primeiro processo
              </Button>
            )}
          />
        )
      ) : (
        <div className="space-y-4">
          {processosFiltrados.map((processo) => (
            <CardProcessoFila
              key={processo.id}
              processo={processo}
              onClick={() => navigate(ROTAS.processo(processo.id))}
            />
          ))}
        </div>
      )}

      <ModalCriarProcesso
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onCriado={(id) => navigate(ROTAS.processo(id))}
      />

      {erro && (
        <Card className="border-red-300 bg-red-50 text-sm text-red-700">
          {erro}
        </Card>
      )}
    </div>
  )
}
