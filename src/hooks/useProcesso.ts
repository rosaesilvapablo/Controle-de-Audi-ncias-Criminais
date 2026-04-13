import { useCallback, useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { useToast } from '../contexts/ToastContext'
import { criarFase1Padrao, normalizarFase1Core, normalizarProcessoCore } from '../lib/processosCore'
import {
  refFase1,
  refFase2,
  refFase3,
  refIntimacoes,
  refProcesso,
} from '../services/collections'
import {
  StatusFase,
  TipoAlerta,
  type Alerta,
  type Fase1,
  type Fase2,
  type Fase3,
  type Intimacao,
  type Processo,
} from '../types/core'
import { consolidarAlertas } from '../utils/alertas'
import { calcularStatusFase2, calcularStatusFase3 } from '../utils/fases'

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function criarFase2Padrao(processoId: string, agora = new Date()): Fase2 {
  return {
    id: 'fase2',
    processoId,
    checklist: {
      linksEnviados: false,
      certidaoEnvioLink: false,
    },
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

function criarFase3Padrao(processoId: string, agora = new Date()): Fase3 {
  return {
    id: 'fase3',
    processoId,
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

function normalizarFase2Core(processoId: string, dados: Record<string, unknown>): Fase2 {
  const padrao = criarFase2Padrao(processoId)
  const checklist = (dados.checklist as Fase2['checklist'] | undefined) ?? padrao.checklist
  const checklistTimestamps = (
    dados.checklistTimestamps
    && typeof dados.checklistTimestamps === 'object'
  )
    ? Object.fromEntries(
      Object.entries(dados.checklistTimestamps as Record<string, unknown>)
        .map(([key, value]) => [key, toDateOrUndefined(value)])
        .filter(([, value]) => Boolean(value)),
    )
    : undefined

  return {
    ...padrao,
    id: String(dados.id ?? 'fase2'),
    processoId,
    dataHoraInicio: toDateOrUndefined(dados.dataHoraInicio),
    dataHoraFim: toDateOrUndefined(dados.dataHoraFim),
    sala: dados.sala as string | undefined,
    magistradoFase2: dados.magistradoFase2 as string | undefined,
    checklist: {
      linksEnviados: Boolean(checklist.linksEnviados),
      certidaoEnvioLink: Boolean(checklist.certidaoEnvioLink),
    },
    observacoes: dados.observacoes as string | undefined,
    concluidaEm: toDateOrUndefined(dados.concluidaEm),
    criadoEm: toDateOrUndefined(dados.criadoEm) ?? padrao.criadoEm,
    atualizadoEm: toDateOrUndefined(dados.atualizadoEm) ?? padrao.atualizadoEm,
    ...(checklistTimestamps ? { checklistTimestamps } : {}),
  } as Fase2
}

function normalizarFase3Core(processoId: string, dados: Record<string, unknown>): Fase3 {
  const padrao = criarFase3Padrao(processoId)
  const checklistRealizacao = dados.checklistRealizacao as Fase3['checklistRealizacao'] | undefined
  const checklistNaoRealizacao = dados.checklistNaoRealizacao as Fase3['checklistNaoRealizacao'] | undefined
  const checklistRealizacaoTimestamps = (
    dados.checklistRealizacaoTimestamps
    && typeof dados.checklistRealizacaoTimestamps === 'object'
  )
    ? Object.fromEntries(
      Object.entries(dados.checklistRealizacaoTimestamps as Record<string, unknown>)
        .map(([key, value]) => [key, toDateOrUndefined(value)])
        .filter(([, value]) => Boolean(value)),
    )
    : undefined
  const checklistNaoRealizacaoTimestamps = (
    dados.checklistNaoRealizacaoTimestamps
    && typeof dados.checklistNaoRealizacaoTimestamps === 'object'
  )
    ? Object.fromEntries(
      Object.entries(dados.checklistNaoRealizacaoTimestamps as Record<string, unknown>)
        .map(([key, value]) => [key, toDateOrUndefined(value)])
        .filter(([, value]) => Boolean(value)),
    )
    : undefined

  return {
    ...padrao,
    id: String(dados.id ?? 'fase3'),
    processoId,
    realizada: typeof dados.realizada === 'boolean' ? dados.realizada : undefined,
    checklistRealizacao: checklistRealizacao
      ? {
        ataAssinada: Boolean(checklistRealizacao.ataAssinada),
        midiaJuntada: Boolean(checklistRealizacao.midiaJuntada),
        cadastroPjeRealizado: Boolean(checklistRealizacao.cadastroPjeRealizado),
        intimacoesRealizadas: Boolean(checklistRealizacao.intimacoesRealizadas),
        etiquetaPjeAtualizada: Boolean(checklistRealizacao.etiquetaPjeAtualizada),
      }
      : undefined,
    determinacoesAudiencia: dados.determinacoesAudiencia as string | undefined,
    modeloAtaUtilizadoId: dados.modeloAtaUtilizadoId as string | undefined,
    motivoNaoRealizacao: dados.motivoNaoRealizacao as Fase3['motivoNaoRealizacao'],
    novaData: toDateOrUndefined(dados.novaData),
    checklistNaoRealizacao: checklistNaoRealizacao
      ? {
        calendarioAtualizado: Boolean(checklistNaoRealizacao.calendarioAtualizado),
        relatorioIntimacoesElaborado: Boolean(checklistNaoRealizacao.relatorioIntimacoesElaborado),
        etiquetaPjeAtualizada: Boolean(checklistNaoRealizacao.etiquetaPjeAtualizada),
      }
      : undefined,
    observacoes: dados.observacoes as string | undefined,
    concluidaEm: toDateOrUndefined(dados.concluidaEm),
    criadoEm: toDateOrUndefined(dados.criadoEm) ?? padrao.criadoEm,
    atualizadoEm: toDateOrUndefined(dados.atualizadoEm) ?? padrao.atualizadoEm,
    ...(checklistRealizacaoTimestamps ? { checklistRealizacaoTimestamps } : {}),
    ...(checklistNaoRealizacaoTimestamps ? { checklistNaoRealizacaoTimestamps } : {}),
  } as Fase3
}

function normalizarIntimacaoCore(processoId: string, id: string, dados: Record<string, unknown>): Intimacao {
  return {
    ...(dados as unknown as Intimacao),
    id,
    processoId,
    criadoEm: toDateOrUndefined(dados.criadoEm) ?? new Date(),
    atualizadoEm: toDateOrUndefined(dados.atualizadoEm) ?? new Date(),
    dataCumprimento: toDateOrUndefined(dados.dataCumprimento),
    dataRemessa: toDateOrUndefined(dados.dataRemessa),
    dataDevolvida: toDateOrUndefined(dados.dataDevolvida),
  }
}

export function useProcesso(id: string) {
  const toast = useToast()
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [fase1, setFase1] = useState<Fase1 | null>(null)
  const [fase2, setFase2] = useState<Fase2 | null>(null)
  const [fase3, setFase3] = useState<Fase3 | null>(null)
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setProcesso(null)
      setFase1(null)
      setFase2(null)
      setFase3(null)
      setIntimacoes([])
      setCarregando(false)
      setErro(null)
      return
    }

    setCarregando(true)
    setErro(null)

    let processoCarregado = false
    let fase1Carregada = false
    let fase2Carregada = false
    let fase3Carregada = false
    let intimacoesCarregadas = false

    const finalizar = () => {
      if (processoCarregado && fase1Carregada && fase2Carregada && fase3Carregada && intimacoesCarregadas) {
        setCarregando(false)
      }
    }

    const unsubProcesso = onSnapshot(
      refProcesso(id),
      (snapshot) => {
        setProcesso(snapshot.exists() ? normalizarProcessoCore(snapshot.id, snapshot.data()) : null)
        processoCarregado = true
        finalizar()
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar os dados do processo.')
        processoCarregado = true
        fase1Carregada = true
        fase2Carregada = true
        fase3Carregada = true
        intimacoesCarregadas = true
        setCarregando(false)
      },
    )

    const unsubFase1 = onSnapshot(
      refFase1(id),
      (snapshot) => {
        setFase1(snapshot.exists() ? normalizarFase1Core(id, snapshot.data()) : null)
        fase1Carregada = true
        finalizar()
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar a Fase 1 do processo.')
        fase1Carregada = true
        finalizar()
      },
    )

    const unsubFase2 = onSnapshot(
      refFase2(id),
      (snapshot) => {
        setFase2(snapshot.exists() ? normalizarFase2Core(id, snapshot.data() as unknown as Record<string, unknown>) : null)
        fase2Carregada = true
        finalizar()
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar a Fase 2 do processo.')
        fase2Carregada = true
        finalizar()
      },
    )

    const unsubFase3 = onSnapshot(
      refFase3(id),
      (snapshot) => {
        setFase3(snapshot.exists() ? normalizarFase3Core(id, snapshot.data() as unknown as Record<string, unknown>) : null)
        fase3Carregada = true
        finalizar()
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar a Fase 3 do processo.')
        fase3Carregada = true
        finalizar()
      },
    )

    const unsubIntimacoes = onSnapshot(
      query(refIntimacoes(id), orderBy('criadoEm', 'asc')),
      (snapshot) => {
        const lista = snapshot.docs.map((item) =>
          normalizarIntimacaoCore(id, item.id, item.data() as unknown as Record<string, unknown>),
        )
        setIntimacoes(lista)
        intimacoesCarregadas = true
        finalizar()
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar as intimacoes do processo.')
        intimacoesCarregadas = true
        finalizar()
      },
    )

    return () => {
      unsubProcesso()
      unsubFase1()
      unsubFase2()
      unsubFase3()
      unsubIntimacoes()
    }
  }, [id])

  const alertas = useMemo<Alerta[]>(() => {
    if (!processo) return []
    const base = consolidarAlertas(processo, intimacoes)
    if (processo.totalIntimacoesPendentes <= 0) return base

    const jaTemPendente = base.some((item) => item.tipo === TipoAlerta.INTIMACAO_PENDENTE)
    if (jaTemPendente) return base

    return [
      ...base,
      {
        tipo: TipoAlerta.INTIMACAO_PENDENTE,
        processoId: processo.id,
        numeroProcesso: processo.numeroProcesso,
        mensagem: `${processo.totalIntimacoesPendentes} intimacao(oes) pendente(s).`,
      },
    ]
  }, [intimacoes, processo])

  const alertasIntimacoes = useMemo(() => alertas.filter((item) =>
    item.tipo === TipoAlerta.CARTA_PRECATORIA_30_DIAS
    || item.tipo === TipoAlerta.CARTA_PRECATORIA_40_DIAS
    || item.tipo === TipoAlerta.INTIMACAO_PENDENTE,
  ), [alertas])

  const atualizarProcesso = useCallback(async (dados: Partial<Processo>) => {
    try {
      await setDoc(
        refProcesso(id),
        {
          ...dados,
          atualizadoEm: new Date(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel salvar as alteracoes do processo.')
      throw error
    }
  }, [id, toast])

  useEffect(() => {
    if (!processo) return

    const novoStatusFase2 = calcularStatusFase2(
      fase2,
      processo.totalParticipantes,
      processo.totalIntimacoesPendentes,
    )
    const novoStatusFase3 = calcularStatusFase3(
      fase3,
      processo.totalIntimacoesPendentes,
    )

    if (
      processo.fases.fase2 === novoStatusFase2
      && processo.fases.fase3 === novoStatusFase3
    ) {
      return
    }

    void atualizarProcesso({
      fases: {
        ...processo.fases,
        fase2: novoStatusFase2,
        fase3: novoStatusFase3,
      },
    })
  }, [
    atualizarProcesso,
    fase2,
    fase3,
    intimacoes,
    processo,
  ])

  const atualizarFase1 = useCallback(async (dados: Partial<Fase1>) => {
    try {
      await setDoc(
        refFase1(id),
        {
          ...criarFase1Padrao(id),
          ...dados,
          processoId: id,
          atualizadoEm: new Date(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel salvar as alteracoes da Fase 1.')
      throw error
    }
  }, [id, toast])

  const atualizarFase2 = useCallback(async (dados: Partial<Fase2>) => {
    try {
      await setDoc(
        refFase2(id),
        {
          ...criarFase2Padrao(id),
          ...dados,
          processoId: id,
          atualizadoEm: new Date(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel salvar as alteracoes da Fase 2.')
      throw error
    }
  }, [id, toast])

  const atualizarFase3 = useCallback(async (dados: Partial<Fase3>) => {
    try {
      await setDoc(
        refFase3(id),
        {
          ...criarFase3Padrao(id),
          ...dados,
          processoId: id,
          atualizadoEm: new Date(),
        },
        { merge: true },
      )
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel salvar as alteracoes da Fase 3.')
      throw error
    }
  }, [id, toast])

  return {
    processo,
    fase1,
    fase2,
    fase3,
    intimacoes,
    alertas,
    alertasIntimacoes,
    carregando,
    erro,
    atualizarProcesso,
    atualizarFase1,
    atualizarFase2,
    atualizarFase3,
  }
}
