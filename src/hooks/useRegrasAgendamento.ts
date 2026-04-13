import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { registrarAcao } from '../lib/auditoria'

export interface RegrasAgendamento {
  prazoMinimoUteis: number
  expedienteInicio: string
  expedienteFim: string
}

const REGRAS_PADRAO: RegrasAgendamento = {
  prazoMinimoUteis: 10,
  expedienteInicio: '08:00',
  expedienteFim: '18:00',
}

function normalizarRegras(dados?: Partial<RegrasAgendamento>): RegrasAgendamento {
  return {
    prazoMinimoUteis: Math.min(60, Math.max(1, Number(dados?.prazoMinimoUteis ?? REGRAS_PADRAO.prazoMinimoUteis))),
    expedienteInicio: dados?.expedienteInicio ?? REGRAS_PADRAO.expedienteInicio,
    expedienteFim: dados?.expedienteFim ?? REGRAS_PADRAO.expedienteFim,
  }
}

function inicioDoDia(data: Date) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

function chaveData(data: Date) {
  return inicioDoDia(data).toISOString().slice(0, 10)
}

function ehDiaUtil(data: Date, feriados: Set<string>) {
  const diaSemana = data.getDay()
  return diaSemana !== 0 && diaSemana !== 6 && !feriados.has(chaveData(data))
}

export function isDataBloqueada(data: Date, prazoMinimo: Date): boolean {
  return inicioDoDia(data).getTime() < inicioDoDia(prazoMinimo).getTime()
}

export function useRegrasAgendamento() {
  const { usuario } = useAuth()
  const [regras, setRegras] = useState<RegrasAgendamento>(REGRAS_PADRAO)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [prazoMinimoData, setPrazoMinimoData] = useState<Date | null>(null)

  const calcularPrazoMinimo = useCallback(async (prazoUteis: number) => {
    const feriadosSnap = await getDocs(collection(db, 'feriados'))
    const feriados = new Set(
      feriadosSnap.docs.map((item) => chaveData((item.data().data as Timestamp).toDate())),
    )

    let cursor = inicioDoDia(new Date())
    let uteisContados = 0

    while (uteisContados < prazoUteis) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)

      if (ehDiaUtil(cursor, feriados)) {
        uteisContados += 1
      }
    }

    return cursor
  }, [])

  const buscarRegras = useCallback(async () => {
    setLoading(true)

    try {
      const snap = await getDoc(doc(db, 'configuracoes', 'regras_agendamento'))
      const normalizadas = snap.exists()
        ? normalizarRegras(snap.data() as Partial<RegrasAgendamento>)
        : { ...REGRAS_PADRAO }

      setRegras(normalizadas)
      const prazo = await calcularPrazoMinimo(normalizadas.prazoMinimoUteis)
      setPrazoMinimoData(prazo)
      return normalizadas
    } finally {
      setLoading(false)
    }
  }, [calcularPrazoMinimo])

  const salvarRegras = useCallback(async (novasRegras: RegrasAgendamento) => {
    const normalizadas = normalizarRegras(novasRegras)
    setSalvando(true)

    try {
      await setDoc(
        doc(db, 'configuracoes', 'regras_agendamento'),
        normalizadas,
        { merge: true },
      )

      if (usuario) {
        await registrarAcao({
          tipo: 'config_alterada',
          dados: {
            configuracao: 'regras_agendamento',
            valorNovo: normalizadas,
            adminUid: usuario.uid,
            adminNome: usuario.nome,
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }

      setRegras(normalizadas)
      const prazo = await calcularPrazoMinimo(normalizadas.prazoMinimoUteis)
      setPrazoMinimoData(prazo)
    } finally {
      setSalvando(false)
    }
  }, [calcularPrazoMinimo, usuario])

  useEffect(() => {
    void buscarRegras()
  }, [buscarRegras])

  return {
    regras,
    loading,
    salvando,
    prazoMinimoData,
    buscarRegras,
    salvarRegras,
    calcularPrazoMinimo,
    isDataBloqueada,
  }
}
