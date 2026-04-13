import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { refModelosDocumentos } from '../services/collections'
import type { ModeloDocumento } from '../types/core'

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function normalizarModelo(id: string, dados: Record<string, unknown>): ModeloDocumento {
  return {
    ...(dados as unknown as ModeloDocumento),
    id,
    criadoEm: toDateOrUndefined(dados.criadoEm) ?? new Date(),
    atualizadoEm: toDateOrUndefined(dados.atualizadoEm) ?? new Date(),
  }
}

export function useModelosDocumentos() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [modelos, setModelos] = useState<ModeloDocumento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const consulta = query(refModelosDocumentos(), orderBy('nome', 'asc'))

    const unsub = onSnapshot(
      consulta,
      (snapshot) => {
        setModelos(snapshot.docs.map((item) => normalizarModelo(item.id, item.data() as unknown as Record<string, unknown>)))
        setCarregando(false)
        setErro(null)
      },
      (snapshotErro) => {
        console.error(snapshotErro)
        setErro('Nao foi possivel carregar os modelos de documento.')
        setCarregando(false)
      },
    )

    return unsub
  }, [])

  const buscarPorId = useCallback(async (id: string): Promise<ModeloDocumento | null> => {
    const referencia = doc(refModelosDocumentos(), id)
    const snap = await getDoc(referencia)
    if (!snap.exists()) return null
    return normalizarModelo(snap.id, snap.data() as unknown as Record<string, unknown>)
  }, [])

  const criarModelo = useCallback(async (
    dados: Omit<ModeloDocumento, 'id' | 'criadoEm' | 'atualizadoEm' | 'versao' | 'arquivado'>,
  ) => {
    if (!usuario) throw new Error('Usuario nao autenticado.')

    try {
      const referencia = doc(refModelosDocumentos())
      const agora = new Date()
      const novoModelo: ModeloDocumento = {
        id: referencia.id,
        nome: dados.nome.trim(),
        tipo: dados.tipo,
        conteudo: dados.conteudo,
        variaveis: dados.variaveis,
        visivelPara: dados.visivelPara,
        criadoPor: usuario.uid,
        versao: 1,
        arquivado: false,
        criadoEm: agora,
        atualizadoEm: agora,
      }

      await setDoc(referencia, novoModelo)
      return referencia.id
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel criar o modelo.')
      throw error
    }
  }, [toast, usuario])

  const atualizarModelo = useCallback(async (
    id: string,
    dados: Partial<ModeloDocumento>,
  ) => {
    try {
      const referencia = doc(refModelosDocumentos(), id)
      const snap = await getDoc(referencia)
      if (!snap.exists()) throw new Error('Modelo nao encontrado.')

      const atual = normalizarModelo(snap.id, snap.data() as unknown as Record<string, unknown>)
      const { id: _id, criadoEm: _criadoEm, criadoPor: _criadoPor, versao: _versao, ...restante } = dados

      await setDoc(referencia, {
        ...restante,
        versao: (atual.versao ?? 0) + 1,
        atualizadoEm: new Date(),
      }, { merge: true })
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel atualizar o modelo.')
      throw error
    }
  }, [toast])

  const arquivarModelo = useCallback(async (id: string) => {
    try {
      await setDoc(doc(refModelosDocumentos(), id), {
        arquivado: true,
        atualizadoEm: new Date(),
      }, { merge: true })
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel arquivar o modelo.')
      throw error
    }
  }, [toast])

  const restaurarModelo = useCallback(async (id: string) => {
    try {
      await setDoc(doc(refModelosDocumentos(), id), {
        arquivado: false,
        atualizadoEm: new Date(),
      }, { merge: true })
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel restaurar o modelo.')
      throw error
    }
  }, [toast])

  const duplicarModelo = useCallback(async (id: string) => {
    const original = await buscarPorId(id)
    if (!original) throw new Error('Modelo nao encontrado.')

    if (!usuario) throw new Error('Usuario nao autenticado.')

    try {
      const referencia = doc(refModelosDocumentos())
      const agora = new Date()
      const copia: ModeloDocumento = {
        ...original,
        id: referencia.id,
        nome: `${original.nome} (copia)`,
        versao: 1,
        arquivado: false,
        criadoPor: usuario.uid,
        criadoEm: agora,
        atualizadoEm: agora,
      }

      await setDoc(referencia, copia)
      return referencia.id
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel duplicar o modelo.')
      throw error
    }
  }, [buscarPorId, toast, usuario])

  return {
    modelos,
    carregando,
    erro,
    buscarPorId,
    criarModelo,
    atualizarModelo,
    arquivarModelo,
    duplicarModelo,
    restaurarModelo,
  }
}
