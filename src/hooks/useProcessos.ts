import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { db } from '../lib/firebase'
import { criarFase1Padrao, criarProcessoPadrao, normalizarProcessoCore } from '../lib/processosCore'
import { refFase1, refProcessos } from '../services/collections'
import { StatusFase, type Processo } from '../types/core'

export function useProcessos() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [processos, setProcessos] = useState<Processo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const consulta = query(refProcessos(), orderBy('criadoEm', 'desc'))

    const unsub = onSnapshot(
      consulta,
      (snapshot) => {
        setProcessos(snapshot.docs.map((item) => normalizarProcessoCore(item.id, item.data())))
        setCarregando(false)
        setErro(null)
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Não foi possível carregar a lista de processos.')
        setCarregando(false)
      },
    )

    return unsub
  }, [])

  const criarProcesso = useCallback(async (
    dados: Omit<Processo, 'id' | 'criadoEm' | 'atualizadoEm'>,
  ) => {
    if (!usuario) {
      throw new Error('Usuário não autenticado.')
    }

    try {
      const novoRef = doc(refProcessos())
      const agora = new Date()
      const processo = criarProcessoPadrao({
        id: novoRef.id,
        numeroProcesso: dados.numeroProcesso,
        tipoAudiencia: dados.tipoAudiencia,
        cargoMagistrado: dados.cargoMagistrado,
        criadoPor: usuario.uid,
        naturezaCrime: dados.naturezaCrime,
        observacoes: dados.observacoes,
        metaCNJ: dados.metaCNJ,
        prioridades: dados.prioridades,
        etiquetas: dados.etiquetas,
        etiquetasSistemicas: dados.etiquetasSistemicas,
        prescricao: dados.prescricao,
        criadoEm: agora,
        atualizadoEm: agora,
      })

      processo.fases = {
        fase1: StatusFase.EM_ANDAMENTO,
        fase2: StatusFase.NAO_INICIADA,
        fase3: StatusFase.NAO_INICIADA,
      }
      processo.totalParticipantes = 0
      processo.totalIntimacoesPendentes = 0
      processo.totalCartasPrecatoriasEmAlerta = 0

      const batch = writeBatch(db)
      batch.set(novoRef, processo)
      batch.set(refFase1(novoRef.id), criarFase1Padrao(novoRef.id, agora))
      await batch.commit()

      return novoRef.id
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível criar o processo.')
      throw error
    }
  }, [toast, usuario])

  return {
    processos,
    carregando,
    erro,
    criarProcesso,
  }
}
