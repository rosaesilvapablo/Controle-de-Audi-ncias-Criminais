import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { differenceInDays } from 'date-fns'
import { useToast } from '../contexts/ToastContext'
import { refIntimacao, refIntimacoes, refProcesso } from '../services/collections'
import {
  FormaIntimacao,
  StatusIntimacao,
  type Intimacao,
  type Participante,
} from '../types/core'

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function normalizarIntimacao(id: string, processoId: string, dados: Record<string, unknown>): Intimacao {
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

function calcularTotais(lista: Intimacao[]) {
  const hoje = new Date()
  const totalPendentes = lista.filter((item) =>
    item.status === StatusIntimacao.PENDENTE
    && item.tipo !== FormaIntimacao.NAO_REQUER_INTIMACAO,
  ).length

  const totalCartasPrecatoriasEmAlerta = lista.filter((item) =>
    item.tipo === FormaIntimacao.CARTA_PRECATORIA
    && item.dataRemessa
    && !item.dataDevolvida
    && differenceInDays(hoje, item.dataRemessa) >= 30,
  ).length

  return {
    totalPendentes,
    totalCartasPrecatoriasEmAlerta,
  }
}

export function useIntimacoes(processoId: string) {
  const toast = useToast()
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const intimacoesRef = useRef<Intimacao[]>([])

  useEffect(() => {
    intimacoesRef.current = intimacoes
  }, [intimacoes])

  const sincronizarContadores = useCallback(async (lista: Intimacao[]) => {
    const { totalPendentes, totalCartasPrecatoriasEmAlerta } = calcularTotais(lista)
    await setDoc(refProcesso(processoId), {
      totalIntimacoesPendentes: totalPendentes,
      totalCartasPrecatoriasEmAlerta,
      atualizadoEm: new Date(),
    }, { merge: true })
  }, [processoId])

  useEffect(() => {
    if (!processoId) {
      setIntimacoes([])
      setCarregando(false)
      setErro(null)
      return
    }

    const consulta = query(refIntimacoes(processoId), orderBy('criadoEm', 'asc'))
    const unsub = onSnapshot(
      consulta,
      (snapshot) => {
        const lista = snapshot.docs.map((item) =>
          normalizarIntimacao(item.id, processoId, item.data() as unknown as Record<string, unknown>),
        )
        setIntimacoes(lista)
        setCarregando(false)
        setErro(null)
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar as intimacoes do processo.')
        setCarregando(false)
      },
    )

    return unsub
  }, [processoId])

  const criarDeParticipante = useCallback(async (participante: Participante) => {
    if (participante.formaIntimacao === FormaIntimacao.NAO_REQUER_INTIMACAO) {
      return ''
    }

    try {
      const novoRef = doc(refIntimacoes(processoId))
      const agora = new Date()
      const novaIntimacao: Intimacao = {
        id: novoRef.id,
        processoId,
        participanteId: participante.id,
        participanteNome: participante.nome,
        participanteTipo: participante.tipo,
        tipo: participante.formaIntimacao,
        status: StatusIntimacao.PENDENTE,
        tribunalDeprecado: participante.tribunalDeprecado,
        numeroProcessoCarta: participante.numeroProcessoCarta,
        idCarta: participante.idCarta,
        idRemessa: participante.idRemessa,
        dataRemessa: participante.dataRemessa,
        dataDevolvida: participante.dataDevolvida,
        atoOrdinatorioIntimado: participante.atoOrdinatorioIntimado,
        criadoEm: agora,
        atualizadoEm: agora,
      }

      await setDoc(novoRef, novaIntimacao)
      const projetada = [...intimacoesRef.current, novaIntimacao]
      await sincronizarContadores(projetada)
      return novoRef.id
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel gerar a intimacao do participante.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const registrarCumprimento = useCallback(async (
    intimacaoId: string,
    status: StatusIntimacao,
    dataCumprimento?: Date,
  ) => {
    try {
      const dados: Partial<Intimacao> = {
        status,
        dataCumprimento: status === StatusIntimacao.POSITIVA ? (dataCumprimento ?? new Date()) : undefined,
        atualizadoEm: new Date(),
      }
      await setDoc(refIntimacao(processoId, intimacaoId), dados, { merge: true })

      const projetada = intimacoesRef.current.map((item) =>
        item.id === intimacaoId
          ? { ...item, ...dados }
          : item,
      )
      await sincronizarContadores(projetada)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel registrar o resultado da intimacao.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const atualizarCartaPrecatoria = useCallback(async (
    intimacaoId: string,
    dados: Pick<Intimacao, 'tribunalDeprecado' | 'numeroProcessoCarta' | 'idCarta' | 'idRemessa' | 'dataRemessa' | 'dataDevolvida'>,
  ) => {
    try {
      const payload: Partial<Intimacao> = {
        ...dados,
        atualizadoEm: new Date(),
      }
      await setDoc(refIntimacao(processoId, intimacaoId), payload, { merge: true })
      const projetada = intimacoesRef.current.map((item) => (
        item.id === intimacaoId ? { ...item, ...payload } : item
      ))
      await sincronizarContadores(projetada)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel atualizar os dados da carta precatoria.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const registrarAtoOrdinatorio = useCallback(async (intimacaoId: string, intimado: boolean) => {
    try {
      const payload: Partial<Intimacao> = {
        atoOrdinatorioIntimado: intimado,
        atualizadoEm: new Date(),
      }
      await setDoc(refIntimacao(processoId, intimacaoId), payload, { merge: true })
      const projetada = intimacoesRef.current.map((item) => (
        item.id === intimacaoId ? { ...item, ...payload } : item
      ))
      await sincronizarContadores(projetada)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel registrar o ato ordinatorio.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const atualizarIntimacao = useCallback(async (intimacaoId: string, dados: Partial<Intimacao>) => {
    try {
      const payload: Partial<Intimacao> = {
        ...dados,
        atualizadoEm: new Date(),
      }
      await setDoc(refIntimacao(processoId, intimacaoId), payload, { merge: true })
      const projetada = intimacoesRef.current.map((item) => (
        item.id === intimacaoId ? { ...item, ...payload } : item
      ))
      await sincronizarContadores(projetada)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel atualizar a intimacao.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const removerIntimacao = useCallback(async (intimacaoId: string) => {
    try {
      await deleteDoc(refIntimacao(processoId, intimacaoId))
      const projetada = intimacoesRef.current.filter((item) => item.id !== intimacaoId)
      await sincronizarContadores(projetada)
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel remover a intimacao.')
      throw error
    }
  }, [processoId, sincronizarContadores, toast])

  const pendentes = useMemo(() => intimacoes.filter((item) =>
    item.status === StatusIntimacao.PENDENTE
    && item.tipo !== FormaIntimacao.NAO_REQUER_INTIMACAO,
  ), [intimacoes])

  const comAlerta = useMemo(() => {
    const hoje = new Date()
    return intimacoes.filter((item) =>
      item.tipo === FormaIntimacao.CARTA_PRECATORIA
      && item.dataRemessa
      && !item.dataDevolvida
      && differenceInDays(hoje, item.dataRemessa) >= 30,
    )
  }, [intimacoes])

  return {
    intimacoes,
    carregando,
    erro,
    criarDeParticipante,
    registrarCumprimento,
    atualizarCartaPrecatoria,
    registrarAtoOrdinatorio,
    atualizarIntimacao,
    removerIntimacao,
    pendentes,
    comAlerta,
    totalPendentes: pendentes.length,
  }
}

