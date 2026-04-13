import { useCallback, useMemo, useState } from 'react'
import { useProcessos } from './useProcessos'
import { calcularAlertasPrescricao } from '../utils/alertas'
import {
  MetaCNJ,
  Prioridade,
  StatusFase,
  TipoAlerta,
  TipoAudiencia,
  type Processo,
} from '../types/core'

export interface FiltroFila {
  busca?: string
  prioridades?: Prioridade[]
  metaCNJ?: MetaCNJ
  etiquetas?: string[]
  tipoAudiencia?: TipoAudiencia
  statusFase1?: StatusFase
  apenasComAlerta?: boolean
}

export interface OpcaoOrdenacao {
  campo: 'criadoEm' | 'prescricao' | 'prioridade' | 'alertas'
  direcao: 'asc' | 'desc'
}

export const FILTRO_FILA_INICIAL: FiltroFila = {
  busca: '',
  prioridades: [],
  etiquetas: [],
  apenasComAlerta: false,
}

export const ORDENACAO_FILA_INICIAL: OpcaoOrdenacao = {
  campo: 'criadoEm',
  direcao: 'desc',
}

const PESO_PRIORIDADE: Record<Prioridade, number> = {
  [Prioridade.REU_PRESO]: 6,
  [Prioridade.CRIANCA]: 5,
  [Prioridade.IDOSO_70]: 4,
  [Prioridade.VITIMA]: 3,
  [Prioridade.JUIZO]: 2,
  [Prioridade.IDOSO_60]: 1,
}

function normalizarTexto(valor?: string) {
  return (valor ?? '').trim().toLowerCase()
}

export function pesoPrioridadeProcesso(processo: Processo) {
  if (!processo.prioridades.length) return 0
  return Math.max(...processo.prioridades.map((prioridade) => PESO_PRIORIDADE[prioridade] ?? 0))
}

export function severidadeAlertaProcesso(processo: Processo) {
  const alertas = calcularAlertasPrescricao(
    processo.id,
    processo.numeroProcesso,
    processo.prescricao,
  )

  if (processo.totalCartasPrecatoriasEmAlerta > 0) {
    return 2
  }

  if (
    alertas.some((alerta) =>
      alerta.tipo === TipoAlerta.PRESCRICAO_VENCIDA || alerta.tipo === TipoAlerta.PRESCRICAO_7_DIAS,
    )
  ) {
    return 2
  }

  if (alertas.some((alerta) => alerta.tipo === TipoAlerta.PRESCRICAO_30_DIAS)) {
    return 1
  }

  if (alertas.some((alerta) => alerta.tipo === TipoAlerta.PRESCRICAO_90_DIAS)) {
    return 0.5
  }

  return 0
}

export function filtrarProcessosFila(processos: Processo[], filtro: FiltroFila) {
  const busca = normalizarTexto(filtro.busca)

  return processos.filter((processo) => {
    if (busca) {
      const numero = normalizarTexto(processo.numeroProcesso)
      const natureza = normalizarTexto(processo.naturezaCrime)
      if (!numero.includes(busca) && !natureza.includes(busca)) {
        return false
      }
    }

    if (filtro.prioridades?.length) {
      const temPrioridade = processo.prioridades.some((prioridade) =>
        filtro.prioridades?.includes(prioridade),
      )
      if (!temPrioridade) return false
    }

    if (filtro.metaCNJ && processo.metaCNJ !== filtro.metaCNJ) {
      return false
    }

    if (filtro.etiquetas?.length) {
      const contemTodas = filtro.etiquetas.every((etiqueta) =>
        processo.etiquetas.includes(etiqueta),
      )
      if (!contemTodas) return false
    }

    if (filtro.tipoAudiencia && processo.tipoAudiencia !== filtro.tipoAudiencia) {
      return false
    }

    if (filtro.statusFase1 && processo.fases.fase1 !== filtro.statusFase1) {
      return false
    }

    if (filtro.apenasComAlerta) {
      const temAlertaPrescricao = calcularAlertasPrescricao(
        processo.id,
        processo.numeroProcesso,
        processo.prescricao,
      ).length > 0
      if (!temAlertaPrescricao && processo.totalCartasPrecatoriasEmAlerta <= 0) {
        return false
      }
    }

    return true
  })
}

export function ordenarProcessosFila(processos: Processo[], ordenacao: OpcaoOrdenacao) {
  const fator = ordenacao.direcao === 'asc' ? 1 : -1

  return [...processos].sort((a, b) => {
    switch (ordenacao.campo) {
      case 'prescricao': {
        const dataA = a.prescricao.dataLimite?.getTime()
        const dataB = b.prescricao.dataLimite?.getTime()
        if (dataA && dataB) return (dataA - dataB) * fator
        if (dataA) return -1
        if (dataB) return 1
        return (a.criadoEm.getTime() - b.criadoEm.getTime()) * fator
      }
      case 'prioridade':
        return (pesoPrioridadeProcesso(a) - pesoPrioridadeProcesso(b)) * fator
      case 'alertas':
        return (severidadeAlertaProcesso(a) - severidadeAlertaProcesso(b)) * fator
      case 'criadoEm':
      default:
        return (a.criadoEm.getTime() - b.criadoEm.getTime()) * fator
    }
  })
}

export function useFilaProcessos() {
  const { processos: base, carregando, erro, criarProcesso } = useProcessos()
  const [filtro, setFiltroState] = useState<FiltroFila>(FILTRO_FILA_INICIAL)
  const [ordenacao, setOrdenacao] = useState<OpcaoOrdenacao>(ORDENACAO_FILA_INICIAL)

  const processos = useMemo(() => {
    const filtrados = filtrarProcessosFila(base, filtro)
    return ordenarProcessosFila(filtrados, ordenacao)
  }, [base, filtro, ordenacao])

  const setFiltro = useCallback((parcial: Partial<FiltroFila>) => {
    setFiltroState((atual) => ({ ...atual, ...parcial }))
  }, [])

  const limparFiltros = useCallback(() => {
    setFiltroState(FILTRO_FILA_INICIAL)
    setOrdenacao(ORDENACAO_FILA_INICIAL)
  }, [])

  return {
    processos,
    total: base.length,
    totalFiltrado: processos.length,
    filtro,
    ordenacao,
    carregando,
    erro,
    setFiltro,
    setOrdenacao,
    limparFiltros,
    criarProcesso,
  }
}
