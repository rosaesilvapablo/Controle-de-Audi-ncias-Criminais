import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, getDocFromServer, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { registrarAcao } from '../lib/auditoria'
import type { UserRole } from '../types'

const AUTORIZADOS_SIGILOSO_REF = doc(db, 'configuracoes', 'autorizados_sigiloso')

export function useSigilo() {
  const { usuario } = useAuth()
  const [uidsAutorizados, setUidsAutorizados] = useState<string[]>([])
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    let ativo = true
    setLoadingAuth(true)
    setUidsAutorizados([])

    async function carregarAutorizados() {
      try {
        const snapshot = await getDocFromServer(AUTORIZADOS_SIGILOSO_REF)
        if (!ativo) return

        const dados = snapshot.exists()
          ? (snapshot.data() as { uids?: unknown })
          : undefined

        setUidsAutorizados(
          Array.isArray(dados?.uids)
            ? dados.uids.filter((item): item is string => typeof item === 'string')
            : [],
        )
      } catch {
        if (ativo) {
          setUidsAutorizados([])
        }
      } finally {
        if (ativo) setLoadingAuth(false)
      }
    }

    void carregarAutorizados()

    return () => {
      ativo = false
    }
  }, [])

  const estaAutorizado = useCallback(
    (uid: string, perfil: UserRole): boolean => {
      return (
        perfil === 'diretor' ||
        perfil === 'magistrado' ||
        uidsAutorizados.includes(uid)
      )
    },
    [uidsAutorizados],
  )

  const marcarSigilo = useCallback(
    async (params: {
      colecao: 'audiencias' | 'processos_pendentes'
      documentId: string
      sigiloso: boolean
      usuarioUid: string
      usuarioNome: string
    }) => {
      await updateDoc(doc(db, params.colecao, params.documentId), {
        sigiloso: params.sigiloso,
      })

      await registrarAcao({
        tipo: params.sigiloso ? 'sigilo_ativado' : 'sigilo_desativado',
        dados: {
          colecao: params.colecao,
          documentId: params.documentId,
        },
        usuarioUid: params.usuarioUid,
        usuarioNome: params.usuarioNome,
      })
    },
    [],
  )

  const registrarAcessoSigiloso = useCallback(
    async (params: {
      colecao: string
      documentId: string
      usuarioUid: string
      usuarioNome: string
    }) => {
      await registrarAcao({
        tipo: 'acesso_sigiloso',
        dados: {
          colecao: params.colecao,
          documentId: params.documentId,
        },
        usuarioUid: params.usuarioUid,
        usuarioNome: params.usuarioNome,
      })
    },
    [],
  )

  const autorizado = useMemo(() => {
    if (!usuario) return false
    return estaAutorizado(usuario.uid, usuario.perfil)
  }, [estaAutorizado, usuario])

  return {
    autorizado,
    loadingAuth,
    estaAutorizado,
    marcarSigilo,
    registrarAcessoSigiloso,
  }
}
