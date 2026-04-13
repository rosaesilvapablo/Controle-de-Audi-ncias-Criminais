import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { registrarAcao } from '../lib/auditoria'

export const DURACOES_PADRAO: Record<string, number> = {
  aij: 120,
  interrogatorio: 60,
  oitiva: 90,
  admonitoria: 30,
  custodia: 30,
  una: 60,
  outro: 60,
}

function normalizarDuracoes(dados?: Record<string, unknown>) {
  const entradas = Object.entries({
    ...DURACOES_PADRAO,
    ...(dados ?? {}),
  })

  return Object.fromEntries(
    entradas.map(([tipo, valor]) => {
      const numero = Number(valor)
      const normalizado = Number.isFinite(numero)
        ? Math.min(480, Math.max(5, Math.round(numero)))
        : DURACOES_PADRAO[tipo] ?? 60

      return [tipo, normalizado]
    }),
  )
}

export function getDuracaoPorTipo(
  tipo: string,
  duracoes: Record<string, number>,
): number {
  return duracoes[tipo] ?? duracoes.outro ?? 60
}

export function useDuracaoPorTipo() {
  const { usuario } = useAuth()
  const [duracoes, setDuracoes] = useState<Record<string, number>>(DURACOES_PADRAO)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const buscarDuracoes = useCallback(async () => {
    setLoading(true)

    try {
      const ref = doc(db, 'configuracoes', 'duracoes_por_tipo')
      const snap = await getDoc(ref)

      if (!snap.exists()) {
        const padrao = { ...DURACOES_PADRAO }
        setDuracoes(padrao)
        return padrao
      }

      const normalizadas = normalizarDuracoes(snap.data() as Record<string, unknown>)
      setDuracoes(normalizadas)
      return normalizadas
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarDuracoes = useCallback(async (novasDuracoes: Record<string, number>) => {
    const normalizadas = normalizarDuracoes(novasDuracoes)
    setSalvando(true)

    try {
      await setDoc(
        doc(db, 'configuracoes', 'duracoes_por_tipo'),
        normalizadas,
        { merge: true },
      )

      if (usuario) {
        await registrarAcao({
          tipo: 'config_alterada',
          dados: {
            configuracao: 'duracoes_por_tipo',
            valorNovo: normalizadas,
            adminUid: usuario.uid,
            adminNome: usuario.nome,
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }

      setDuracoes(normalizadas)
    } finally {
      setSalvando(false)
    }
  }, [usuario])

  useEffect(() => {
    void buscarDuracoes()
  }, [buscarDuracoes])

  return {
    duracoes,
    loading,
    salvando,
    buscarDuracoes,
    salvarDuracoes,
    getDuracaoPorTipo,
  }
}
