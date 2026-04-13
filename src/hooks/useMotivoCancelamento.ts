import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { registrarAcao } from '../lib/auditoria'

const MOTIVOS_CANCELAMENTO_PADRAO = [
  'Pedido das partes',
  'Impossibilidade do magistrado',
  'Réu não apresentado',
  'Feriado/recesso superveniente',
  'Força maior',
  'Outro',
]

interface MotivosCancelamentoDoc {
  itens?: string[]
}

function normalizarItens(itens: string[] | undefined) {
  const validos = (itens ?? [])
    .map((item) => item.trim())
    .filter(Boolean)

  return validos.length ? validos : [...MOTIVOS_CANCELAMENTO_PADRAO]
}

export function useMotivoCancelamento() {
  const { usuario } = useAuth()
  const [motivos, setMotivos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const buscarMotivos = useCallback(async () => {
    setLoading(true)

    try {
      const ref = doc(db, 'configuracoes', 'motivos_cancelamento')
      const snap = await getDoc(ref)

      if (!snap.exists()) {
        const padrao = [...MOTIVOS_CANCELAMENTO_PADRAO]
        setMotivos(padrao)
        return padrao
      }

      const dados = snap.data() as MotivosCancelamentoDoc
      const itens = normalizarItens(dados.itens)
      setMotivos(itens)
      return itens
    } finally {
      setLoading(false)
    }
  }, [])

  const salvarMotivos = useCallback(async (itens: string[]) => {
    const normalizados = normalizarItens(itens)
    setSalvando(true)

    try {
      await setDoc(
        doc(db, 'configuracoes', 'motivos_cancelamento'),
        { itens: normalizados },
        { merge: true },
      )

      if (usuario) {
        await registrarAcao({
          tipo: 'config_alterada',
          dados: {
            configuracao: 'motivos_cancelamento',
            valorNovo: normalizados,
            adminUid: usuario.uid,
            adminNome: usuario.nome,
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }

      setMotivos(normalizados)
      return normalizados
    } finally {
      setSalvando(false)
    }
  }, [usuario])

  useEffect(() => {
    void buscarMotivos()
  }, [buscarMotivos])

  return {
    motivos,
    loading,
    salvando,
    buscarMotivos,
    salvarMotivos,
  }
}
