import { useCallback } from 'react'
import {
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { AuditLog } from '../types'

export interface FiltrosAudit {
  tipo?: string
  usuarioUid?: string
  dataInicio?: Date
  dataFim?: Date
  numeroProcesso?: string
}

function inicioDoDia(data: Date) {
  const inicio = new Date(data)
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

function fimDoDia(data: Date) {
  const fim = new Date(data)
  fim.setHours(23, 59, 59, 999)
  return fim
}

function criarConstraints(filtros: FiltrosAudit): QueryConstraint[] {
  const constraints: QueryConstraint[] = []

  if (filtros.tipo) {
    constraints.push(where('tipo', '==', filtros.tipo))
  }

  if (filtros.usuarioUid) {
    constraints.push(where('usuarioUid', '==', filtros.usuarioUid))
  }

  if (filtros.dataInicio) {
    constraints.push(
      where('timestamp', '>=', Timestamp.fromDate(inicioDoDia(filtros.dataInicio))),
    )
  }

  if (filtros.dataFim) {
    constraints.push(
      where('timestamp', '<=', Timestamp.fromDate(fimDoDia(filtros.dataFim))),
    )
  }

  constraints.push(orderBy('timestamp', 'desc'))
  return constraints
}

function normalizarLog(
  id: string,
  dados: Record<string, unknown>,
): AuditLog {
  return {
    id,
    tipo: String(dados.tipo ?? ''),
    usuarioUid: String(dados.usuarioUid ?? ''),
    usuarioNome: String(dados.usuarioNome ?? ''),
    timestamp:
      (dados.timestamp as Timestamp | undefined) ??
      (dados.criadoEm as Timestamp | undefined),
    ...dados,
  } as AuditLog
}

function filtrarNumeroProcesso(log: AuditLog, numeroProcesso?: string) {
  if (!numeroProcesso?.trim()) return true

  const termo = numeroProcesso.trim().toLowerCase()
  return String(log.numeroProcesso ?? '')
    .toLowerCase()
    .includes(termo)
}

export function useAuditLog() {
  const buscarLogs = useCallback(async (
    filtros: FiltrosAudit,
    cursor?: DocumentSnapshot,
  ): Promise<{ logs: AuditLog[]; proximoCursor: DocumentSnapshot | null }> => {
    const logs: AuditLog[] = []
    let cursorAtual = cursor
    let proximoCursor: DocumentSnapshot | null = null
    let podeHaverMais = true

    while (logs.length < 20 && podeHaverMais) {
      const constraints = criarConstraints(filtros)
      const snapshot = await getDocs(query(
        collection(db, 'audit_logs'),
        ...constraints,
        ...(cursorAtual ? [startAfter(cursorAtual)] : []),
        limit(20),
      ))

      if (snapshot.empty) {
        proximoCursor = null
        break
      }

      const normalizados = snapshot.docs
        .map((item) => normalizarLog(item.id, item.data()))
        .filter((item) => filtrarNumeroProcesso(item, filtros.numeroProcesso))

      logs.push(...normalizados)
      cursorAtual = snapshot.docs[snapshot.docs.length - 1]
      podeHaverMais = snapshot.docs.length === 20
      proximoCursor = podeHaverMais ? cursorAtual : null
    }

    return {
      logs: logs.slice(0, 20),
      proximoCursor,
    }
  }, [])

  const buscarTodosParaExport = useCallback(async (
    filtros: FiltrosAudit,
  ): Promise<AuditLog[]> => {
    const logs: AuditLog[] = []
    let cursorAtual: DocumentSnapshot | undefined
    let podeHaverMais = true

    while (logs.length < 5000 && podeHaverMais) {
      const snapshot = await getDocs(query(
        collection(db, 'audit_logs'),
        ...criarConstraints(filtros),
        ...(cursorAtual ? [startAfter(cursorAtual)] : []),
        limit(500),
      ))

      if (snapshot.empty) break

      const normalizados = snapshot.docs
        .map((item) => normalizarLog(item.id, item.data()))
        .filter((item) => filtrarNumeroProcesso(item, filtros.numeroProcesso))

      logs.push(...normalizados)
      cursorAtual = snapshot.docs[snapshot.docs.length - 1]
      podeHaverMais = snapshot.docs.length === 500
    }

    return logs.slice(0, 5000)
  }, [])

  return {
    buscarLogs,
    buscarTodosParaExport,
  }
}
