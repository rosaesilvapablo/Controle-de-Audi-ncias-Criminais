import { useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import { useIntimacoesGlobal } from './useIntimacoesGlobal'
import { useProcessos } from './useProcessos'
import { calcularAlertasPrescricao } from '../utils/alertas'
import {
  FormaIntimacao,
  MetaCNJ,
  Prioridade,
  StatusFase,
  StatusIntimacao,
  TipoAlerta,
  TipoAudiencia,
  type Intimacao,
  type Processo,
  type TipoParticipante,
} from '../types/core'

export type FiltrosRelatorio = FiltroRelatorioIntimacoes

export interface RelatorioEtiqueta {
  etiqueta: string
  processos: Processo[]
  total: number
  porStatus: Record<string, number>
  porTipoAudiencia: Record<TipoAudiencia, number>
}

export interface RelatorioPrioridade {
  prioridades: Prioridade[]
  processos: Processo[]
  total: number
  porPrioridade: Record<Prioridade, number>
  comMultiplasPrioridades: number
}

export interface RelatorioMetaCNJ {
  meta: MetaCNJ
  processos: Processo[]
  total: number
  encerrados: number
  emAndamento: number
  porTipoAudiencia: Record<TipoAudiencia, number>
}

export interface FiltroRelatorioIntimacoes {
  tipo?: FormaIntimacao
  status?: StatusIntimacao
  tipoParticipante?: TipoParticipante
  apenasEmAlerta?: boolean
  dataInicio?: Date
  dataFim?: Date
}

export interface RelatorioIntimacoes {
  filtro: FiltroRelatorioIntimacoes
  intimacoes: (Intimacao & { numeroProcesso: string })[]
  total: number
  porStatus: Record<StatusIntimacao, number>
  porTipo: Record<FormaIntimacao, number>
  cartasEmAlerta30: number
  cartasEmAlerta40: number
}

export interface RelatorioPrescricao {
  diasAteVencer: number
  processos: (Processo & {
    diasRestantes: number
    alertaAtual: string
  })[]
  total: number
  vencidos: number
  ate7dias: number
  ate30dias: number
  ate90dias: number
}

export interface ResumoRelatorios {
  totalProcessos: number
  processosEncerrados: number
  processosEmAndamento: number
  processosComPrescricaoProxima: number
  totalIntimacoespendentes: number
  totalCartasEmAlerta: number
  porMetaCNJ: Record<MetaCNJ, number>
  porPrioridade: Record<Prioridade, number>
}

const TODOS_TIPOS_AUDIENCIA = [
  TipoAudiencia.AIJ,
  TipoAudiencia.CUSTODIA,
  TipoAudiencia.PRELIMINAR,
  TipoAudiencia.ANPP,
  TipoAudiencia.HOMOLOGACAO,
  TipoAudiencia.INSTRUCAO,
  TipoAudiencia.OUTRO,
] as const

const TODAS_METAS = [
  MetaCNJ.META_1,
  MetaCNJ.META_2,
  MetaCNJ.META_4,
  MetaCNJ.META_5,
  MetaCNJ.META_6,
  MetaCNJ.META_30,
  MetaCNJ.SEM_META,
] as const

const TODAS_PRIORIDADES = [
  Prioridade.REU_PRESO,
  Prioridade.CRIANCA,
  Prioridade.IDOSO_70,
  Prioridade.VITIMA,
  Prioridade.JUIZO,
  Prioridade.IDOSO_60,
] as const

const TODOS_STATUS_INTIMACAO = [
  StatusIntimacao.PENDENTE,
  StatusIntimacao.POSITIVA,
  StatusIntimacao.NEGATIVA_NAO_LOCALIZADO,
  StatusIntimacao.NEGATIVA_DEVOLVIDA,
] as const

const TODOS_TIPOS_INTIMACAO = [
  FormaIntimacao.MANDADO_CEMAN_LOCAL,
  FormaIntimacao.MANDADO_CEMAN_DIVERSA,
  FormaIntimacao.CARTA_PRECATORIA,
  FormaIntimacao.NAO_REQUER_INTIMACAO,
] as const

function criarContadorTiposAudiencia() {
  return {
    [TipoAudiencia.AIJ]: 0,
    [TipoAudiencia.CUSTODIA]: 0,
    [TipoAudiencia.PRELIMINAR]: 0,
    [TipoAudiencia.ANPP]: 0,
    [TipoAudiencia.HOMOLOGACAO]: 0,
    [TipoAudiencia.INSTRUCAO]: 0,
    [TipoAudiencia.OUTRO]: 0,
  } as Record<TipoAudiencia, number>
}

function classificarStatusRelatorio(processo: Processo): 'fase1' | 'fase2' | 'fase3' | 'encerrado' {
  if (processo.fases.fase3 === StatusFase.CONCLUIDA) return 'encerrado'
  if (processo.fases.fase2 !== StatusFase.NAO_INICIADA) return 'fase2'
  if (processo.fases.fase1 !== StatusFase.NAO_INICIADA) return 'fase1'
  return 'fase1'
}

function emAlertaCarta(item: Intimacao) {
  return Boolean(
    item.tipo === FormaIntimacao.CARTA_PRECATORIA
    && item.dataRemessa
    && !item.dataDevolvida
    && differenceInDays(new Date(), item.dataRemessa) >= 30,
  )
}

function dataReferenciaIntimacao(item: Intimacao) {
  return item.dataCumprimento ?? item.dataRemessa
}

export function useRelatorios() {
  const { processos, carregando: carregandoProcessos, erro: erroProcessos } = useProcessos()
  const {
    todasPendentes,
    cartasEmAlerta,
    carregando: carregandoIntimacoes,
    erro: erroIntimacoes,
  } = useIntimacoesGlobal()

  const etiquetasDisponiveis = useMemo(() => {
    const unicas = new Set<string>()
    processos.forEach((processo) => {
      processo.etiquetas.forEach((etiqueta) => {
        if (etiqueta.trim()) unicas.add(etiqueta.trim())
      })
    })
    return Array.from(unicas).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [processos])

  const resumo = useMemo<ResumoRelatorios>(() => {
    const porMetaCNJ = TODAS_METAS.reduce<Record<MetaCNJ, number>>((acc, meta) => {
      acc[meta] = 0
      return acc
    }, {} as Record<MetaCNJ, number>)
    const porPrioridade = TODAS_PRIORIDADES.reduce<Record<Prioridade, number>>((acc, prioridade) => {
      acc[prioridade] = 0
      return acc
    }, {} as Record<Prioridade, number>)

    let processosEncerrados = 0
    let processosComPrescricaoProxima = 0
    let totalIntimacoespendentes = 0
    let totalCartasEmAlerta = 0

    processos.forEach((processo) => {
      porMetaCNJ[processo.metaCNJ] += 1
      processo.prioridades.forEach((prioridade) => {
        porPrioridade[prioridade] += 1
      })

      if (processo.fases.fase3 === StatusFase.CONCLUIDA) {
        processosEncerrados += 1
      }

      if (processo.prescricao.dataLimite) {
        const dias = differenceInDays(processo.prescricao.dataLimite, new Date())
        if (dias >= 0 && dias <= 30) {
          processosComPrescricaoProxima += 1
        }
      }

      totalIntimacoespendentes += processo.totalIntimacoesPendentes
      totalCartasEmAlerta += processo.totalCartasPrecatoriasEmAlerta
    })

    return {
      totalProcessos: processos.length,
      processosEncerrados,
      processosEmAndamento: processos.length - processosEncerrados,
      processosComPrescricaoProxima,
      totalIntimacoespendentes,
      totalCartasEmAlerta,
      porMetaCNJ,
      porPrioridade,
    }
  }, [processos])

  function relatorioEtiqueta(etiqueta: string): RelatorioEtiqueta {
    const alvo = etiqueta.trim().toLowerCase()
    const filtrados = processos.filter((processo) =>
      processo.etiquetas.some((item) => item.trim().toLowerCase() === alvo),
    )
    const porStatus = {
      fase1: 0,
      fase2: 0,
      fase3: 0,
      encerrado: 0,
    } as Record<string, number>
    const porTipoAudiencia = criarContadorTiposAudiencia()

    filtrados.forEach((processo) => {
      porStatus[classificarStatusRelatorio(processo)] += 1
      porTipoAudiencia[processo.tipoAudiencia] += 1
    })

    return {
      etiqueta,
      processos: filtrados,
      total: filtrados.length,
      porStatus,
      porTipoAudiencia,
    }
  }

  function relatorioPrioridade(prioridades: Prioridade[]): RelatorioPrioridade {
    const selecionadas = prioridades.length ? prioridades : [...TODAS_PRIORIDADES]
    const filtrados = processos.filter((processo) =>
      processo.prioridades.some((prioridade) => selecionadas.includes(prioridade)),
    )

    const porPrioridade = TODAS_PRIORIDADES.reduce<Record<Prioridade, number>>((acc, prioridade) => {
      acc[prioridade] = filtrados.filter((processo) => processo.prioridades.includes(prioridade)).length
      return acc
    }, {} as Record<Prioridade, number>)

    return {
      prioridades: selecionadas,
      processos: filtrados,
      total: filtrados.length,
      porPrioridade,
      comMultiplasPrioridades: filtrados.filter((processo) => processo.prioridades.length >= 2).length,
    }
  }

  function relatorioMetaCNJ(meta: MetaCNJ): RelatorioMetaCNJ {
    const filtrados = processos.filter((processo) => processo.metaCNJ === meta)
    const encerrados = filtrados.filter((processo) => processo.fases.fase3 === StatusFase.CONCLUIDA).length
    const porTipoAudiencia = criarContadorTiposAudiencia()
    filtrados.forEach((processo) => {
      porTipoAudiencia[processo.tipoAudiencia] += 1
    })

    return {
      meta,
      processos: filtrados,
      total: filtrados.length,
      encerrados,
      emAndamento: filtrados.length - encerrados,
      porTipoAudiencia,
    }
  }

  function relatorioIntimacoes(filtro: FiltroRelatorioIntimacoes): RelatorioIntimacoes {
    const inicio = filtro.dataInicio ? new Date(filtro.dataInicio) : undefined
    const fim = filtro.dataFim ? new Date(filtro.dataFim) : undefined
    if (inicio) inicio.setHours(0, 0, 0, 0)
    if (fim) fim.setHours(23, 59, 59, 999)

    const filtradas = todasPendentes.filter((item) => {
      if (filtro.tipo && item.tipo !== filtro.tipo) return false
      if (filtro.status && item.status !== filtro.status) return false
      if (filtro.tipoParticipante && item.participanteTipo !== filtro.tipoParticipante) return false
      if (filtro.apenasEmAlerta && !emAlertaCarta(item)) return false

      if (inicio || fim) {
        const dataRef = dataReferenciaIntimacao(item)
        if (!dataRef) return false
        if (inicio && dataRef < inicio) return false
        if (fim && dataRef > fim) return false
      }

      return true
    })

    const porStatus = TODOS_STATUS_INTIMACAO.reduce<Record<StatusIntimacao, number>>((acc, status) => {
      acc[status] = filtradas.filter((item) => item.status === status).length
      return acc
    }, {} as Record<StatusIntimacao, number>)

    const porTipo = TODOS_TIPOS_INTIMACAO.reduce<Record<FormaIntimacao, number>>((acc, tipo) => {
      acc[tipo] = filtradas.filter((item) => item.tipo === tipo).length
      return acc
    }, {} as Record<FormaIntimacao, number>)

    const cartasEmAlerta30 = filtradas.filter((item) =>
      item.tipo === FormaIntimacao.CARTA_PRECATORIA
      && item.dataRemessa
      && !item.dataDevolvida
      && differenceInDays(new Date(), item.dataRemessa) >= 30,
    ).length
    const cartasEmAlerta40 = filtradas.filter((item) =>
      item.tipo === FormaIntimacao.CARTA_PRECATORIA
      && item.dataRemessa
      && !item.dataDevolvida
      && differenceInDays(new Date(), item.dataRemessa) >= 40,
    ).length

    return {
      filtro,
      intimacoes: filtradas,
      total: filtradas.length,
      porStatus,
      porTipo,
      cartasEmAlerta30,
      cartasEmAlerta40,
    }
  }

  function relatorioPrescricao(diasAteVencer: number): RelatorioPrescricao {
    const comData = processos.filter((processo) => processo.prescricao.dataLimite)
    const enrich = comData.map((processo) => {
      const dataLimite = processo.prescricao.dataLimite as Date
      const diasRestantes = differenceInDays(dataLimite, new Date())
      const alerta = calcularAlertasPrescricao(
        processo.id,
        processo.numeroProcesso,
        processo.prescricao,
      )[0]

      let alertaAtual = 'Sem alerta'
      if (alerta?.tipo === TipoAlerta.PRESCRICAO_VENCIDA) alertaAtual = 'Vencida'
      if (alerta?.tipo === TipoAlerta.PRESCRICAO_7_DIAS) alertaAtual = 'Ate 7 dias'
      if (alerta?.tipo === TipoAlerta.PRESCRICAO_30_DIAS) alertaAtual = 'Ate 30 dias'
      if (alerta?.tipo === TipoAlerta.PRESCRICAO_90_DIAS) alertaAtual = 'Ate 90 dias'

      return { ...processo, diasRestantes, alertaAtual }
    })

    const filtrados = enrich
      .filter((processo) => {
        if (diasAteVencer < 0) return processo.diasRestantes < 0
        if (diasAteVencer >= 9999) return true
        return processo.diasRestantes >= 0 && processo.diasRestantes <= diasAteVencer
      })
      .sort((a, b) => {
        const dataA = (a.prescricao.dataLimite as Date).getTime()
        const dataB = (b.prescricao.dataLimite as Date).getTime()
        return dataA - dataB
      })

    return {
      diasAteVencer,
      processos: filtrados,
      total: filtrados.length,
      vencidos: enrich.filter((item) => item.diasRestantes < 0).length,
      ate7dias: enrich.filter((item) => item.diasRestantes >= 0 && item.diasRestantes <= 7).length,
      ate30dias: enrich.filter((item) => item.diasRestantes >= 0 && item.diasRestantes <= 30).length,
      ate90dias: enrich.filter((item) => item.diasRestantes >= 0 && item.diasRestantes <= 90).length,
    }
  }

  return {
    processos,
    carregando: carregandoProcessos || carregandoIntimacoes,
    erro: erroProcessos ?? erroIntimacoes,
    relatorioEtiqueta,
    relatorioPrioridade,
    relatorioMetaCNJ,
    relatorioIntimacoes,
    relatorioPrescricao,
    etiquetasDisponiveis,
    resumo: {
      ...resumo,
      totalCartasEmAlerta: resumo.totalCartasEmAlerta || cartasEmAlerta.length,
    },
  }
}

export { TODOS_TIPOS_AUDIENCIA, TODAS_METAS, TODAS_PRIORIDADES }

