import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { registrarAcao } from '../lib/auditoria'

interface AutorizadosSigilosoDoc {
  uids?: string[]
}

function normalizarUids(uids?: string[]) {
  return Array.from(
    new Set((uids ?? []).filter((item): item is string => typeof item === 'string')),
  )
}

export function useAutorizadosSigiloso() {
  const { usuario } = useAuth()
  const [uids, setUids] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const buscarAutorizados = useCallback(async () => {
    setLoading(true)

    try {
      const snap = await getDoc(doc(db, 'configuracoes', 'autorizados_sigiloso'))

      if (!snap.exists()) {
        setUids([])
        return { uids: [] }
      }

      const dados = snap.data() as AutorizadosSigilosoDoc
      const normalizados = normalizarUids(dados.uids)
      setUids(normalizados)
      return { uids: normalizados }
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarAutorizados = useCallback(async (novosUids: string[]) => {
    const normalizados = normalizarUids(novosUids)
    setSalvando(true)

    try {
      await setDoc(
        doc(db, 'configuracoes', 'autorizados_sigiloso'),
        { uids: normalizados },
        { merge: true },
      )

      if (usuario) {
        await registrarAcao({
          tipo: 'config_alterada',
          dados: {
            configuracao: 'autorizados_sigiloso',
            valorNovo: { uids: normalizados },
            adminUid: usuario.uid,
            adminNome: usuario.nome,
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }

      setUids(normalizados)
      return { uids: normalizados }
    } finally {
      setSalvando(false)
    }
  }, [usuario])

  useEffect(() => {
    void buscarAutorizados()
  }, [buscarAutorizados])

  return {
    uids,
    loading,
    salvando,
    buscarAutorizados,
    salvarAutorizados,
  }
}
