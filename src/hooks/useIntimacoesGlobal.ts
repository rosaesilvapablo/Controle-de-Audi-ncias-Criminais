import { useEffect, useMemo, useRef, useState } from 'react'
import { collectionGroup, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { differenceInDays } from 'date-fns'
import { db } from '../lib/firebase'
import { refProcesso } from '../services/collections'
import {
  FormaIntimacao,
  StatusIntimacao,
  TipoParticipante,
  type Intimacao,
} from '../types/core'

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function normalizarIntimacao(id: string, dados: Record<string, unknown>): Intimacao {
  return {
    ...(dados as unknown as Intimacao),
    id,
    criadoEm: toDateOrUndefined(dados.criadoEm) ?? new Date(),
    atualizadoEm: toDateOrUndefined(dados.atualizadoEm) ?? new Date(),
    dataCumprimento: toDateOrUndefined(dados.dataCumprimento),
    dataRemessa: toDateOrUndefined(dados.dataRemessa),
    dataDevolvida: toDateOrUndefined(dados.dataDevolvida),
  }
}

export interface FiltroIntimacaoGlobal {
  tipo?: FormaIntimacao
  tipoParticipante?: TipoParticipante
  apenasEmAlerta?: boolean
  numeroProcesso?: string
}

type IntimacaoEnriquecida = Intimacao & { numeroProcesso: string }

export function useIntimacoesGlobal() {
  const [itens, setItens] = useState<IntimacaoEnriquecida[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltroState] = useState<FiltroIntimacaoGlobal>({})
  const cacheNumeroProcessoRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    // TODO: avaliar desnormalizacao se volume > 500 processos
    const consulta = query(
      collectionGroup(db, 'intimacoes'),
      where('status', '==', StatusIntimacao.PENDENTE),
      orderBy('criadoEm', 'desc'),
    )

    const unsub = onSnapshot(
      consulta,
      async (snapshot) => {
        try {
          const lista = snapshot.docs.map((item) =>
            normalizarIntimacao(item.id, item.data() as unknown as Record<string, unknown>),
          )

          const idsProcessosUnicos = [...new Set(lista.map((item) => item.processoId))]
          const idsNaoCacheados = idsProcessosUnicos.filter((id) => !cacheNumeroProcessoRef.current.has(id))

          await Promise.all(idsNaoCacheados.map(async (processoId) => {
            const snap = await getDoc(refProcesso(processoId))
            const numeroProcesso = snap.exists()
              ? String((snap.data() as { numeroProcesso?: string }).numeroProcesso ?? processoId)
              : processoId
            cacheNumeroProcessoRef.current.set(processoId, numeroProcesso)
          }))

          const enriquecidas = lista.map((item) => ({
            ...item,
            numeroProcesso: cacheNumeroProcessoRef.current.get(item.processoId) ?? item.processoId,
          }))

          setItens(enriquecidas)
          setCarregando(false)
          setErro(null)
        } catch (errorInterno) {
          console.error(errorInterno)
          setErro('Nao foi possivel montar o dashboard global de intimacoes.')
          setCarregando(false)
        }
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar as intimacoes globais.')
        setCarregando(false)
      },
    )

    return unsub
  }, [])

  const setFiltro = (dados: Partial<FiltroIntimacaoGlobal>) => {
    setFiltroState((atual) => ({ ...atual, ...dados }))
  }

  const filtradas = useMemo(() => {
    const termo = filtro.numeroProcesso?.trim().toLowerCase() ?? ''
    const hoje = new Date()

    return itens.filter((item) => {
      if (filtro.tipo && item.tipo !== filtro.tipo) return false
      if (filtro.tipoParticipante && item.participanteTipo !== filtro.tipoParticipante) return false
      if (termo && !item.numeroProcesso.toLowerCase().includes(termo)) return false

      if (filtro.apenasEmAlerta) {
        const emAlerta = item.tipo === FormaIntimacao.CARTA_PRECATORIA
          && item.dataRemessa
          && !item.dataDevolvida
          && differenceInDays(hoje, item.dataRemessa) >= 30
        if (!emAlerta) return false
      }

      return true
    })
  }, [filtro.apenasEmAlerta, filtro.numeroProcesso, filtro.tipo, filtro.tipoParticipante, itens])

  const cartasEmAlerta = useMemo(() => {
    const hoje = new Date()
    return filtradas
      .filter((item) =>
        item.tipo === FormaIntimacao.CARTA_PRECATORIA
        && item.dataRemessa
        && !item.dataDevolvida
        && differenceInDays(hoje, item.dataRemessa) >= 30,
      )
      .sort((a, b) => differenceInDays(hoje, b.dataRemessa as Date) - differenceInDays(hoje, a.dataRemessa as Date))
  }, [filtradas])

  const mandadosPendentes = useMemo(() => filtradas
    .filter((item) =>
      item.tipo === FormaIntimacao.MANDADO_CEMAN_LOCAL
      || item.tipo === FormaIntimacao.MANDADO_CEMAN_DIVERSA,
    )
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime()), [filtradas])

  const cartasPendentes = useMemo(() => filtradas
    .filter((item) => item.tipo === FormaIntimacao.CARTA_PRECATORIA), [filtradas])

  return {
    cartasEmAlerta,
    todasPendentes: filtradas,
    mandadosPendentes,
    cartasPendentes,
    carregando,
    erro,
    filtro,
    setFiltro,
  }
}
