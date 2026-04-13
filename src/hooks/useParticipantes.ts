import { useCallback, useEffect, useState } from 'react'
import {
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useToast } from '../contexts/ToastContext'
import { refParticipante, refParticipantes, refProcesso } from '../services/collections'
import type { Participante } from '../types/core'

function normalizarData(valor: unknown) {
  if (valor instanceof Date) return valor
  if (valor && typeof valor === 'object' && 'toDate' in valor && typeof (valor as { toDate: () => Date }).toDate === 'function') {
    return (valor as { toDate: () => Date }).toDate()
  }
  return undefined
}

function normalizarParticipante(id: string, processoId: string, dados: Record<string, unknown>): Participante {
  return {
    ...(dados as unknown as Participante),
    id,
    processoId,
    criadoEm: normalizarData(dados.criadoEm) ?? new Date(),
    atualizadoEm: normalizarData(dados.atualizadoEm) ?? new Date(),
  }
}

export function useParticipantes(processoId: string) {
  const toast = useToast()
  const [participantes, setParticipantes] = useState<Participante[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!processoId) {
      setParticipantes([])
      setCarregando(false)
      setErro(null)
      return
    }

    const consulta = query(refParticipantes(processoId), orderBy('ordem', 'asc'))
    const unsub = onSnapshot(
      consulta,
      (snapshot) => {
        setParticipantes(snapshot.docs.map((item) =>
          normalizarParticipante(item.id, processoId, item.data() as unknown as Record<string, unknown>),
        ))
        setCarregando(false)
        setErro(null)
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Não foi possível carregar os participantes.')
        setCarregando(false)
      },
    )

    return unsub
  }, [processoId])

  const atualizarTotalParticipantes = useCallback(async (total: number) => {
    await setDoc(refProcesso(processoId), {
      totalParticipantes: total,
      atualizadoEm: new Date(),
    }, { merge: true })
  }, [processoId])

  const adicionarParticipante = useCallback(async (
    dados: Omit<Participante, 'id' | 'processoId' | 'criadoEm' | 'atualizadoEm'>,
  ) => {
    try {
      const novoRef = doc(refParticipantes(processoId))
      const agora = new Date()
      await setDoc(novoRef, {
        ...dados,
        id: novoRef.id,
        processoId,
        ordem: participantes.length,
        criadoEm: agora,
        atualizadoEm: agora,
      })
      await atualizarTotalParticipantes(participantes.length + 1)
      return novoRef.id
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível adicionar o participante.')
      throw error
    }
  }, [atualizarTotalParticipantes, participantes.length, processoId, toast])

  const atualizarParticipante = useCallback(async (id: string, dados: Partial<Participante>) => {
    try {
      await setDoc(refParticipante(processoId, id), {
        ...dados,
        atualizadoEm: new Date(),
      }, { merge: true })
      await atualizarTotalParticipantes(participantes.length)
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível atualizar o participante.')
      throw error
    }
  }, [atualizarTotalParticipantes, participantes.length, processoId, toast])

  const removerParticipante = useCallback(async (id: string) => {
    try {
      await deleteDoc(refParticipante(processoId, id))
      await atualizarTotalParticipantes(Math.max(0, participantes.length - 1))
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível remover o participante.')
      throw error
    }
  }, [atualizarTotalParticipantes, participantes.length, processoId, toast])

  const reordenarParticipantes = useCallback(async (ids: string[]) => {
    try {
      const batch = writeBatch(db)
      ids.forEach((id, index) => {
        batch.set(refParticipante(processoId, id), {
          ordem: index,
          atualizadoEm: new Date(),
        }, { merge: true })
      })
      batch.set(refProcesso(processoId), {
        totalParticipantes: participantes.length,
        atualizadoEm: new Date(),
      }, { merge: true })
      await batch.commit()
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível reordenar os participantes.')
      throw error
    }
  }, [participantes.length, processoId, toast])

  return {
    participantes,
    carregando,
    erro,
    adicionarParticipante,
    atualizarParticipante,
    removerParticipante,
    reordenarParticipantes,
  }
}
