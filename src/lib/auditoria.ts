import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

function dadosCompatibilidade(documentId?: string, extra?: Record<string, unknown>) {
  return {
    ...(documentId ? { documentoId: documentId } : {}),
    ...extra,
    criadoEm: serverTimestamp(),
  }
}

export function formatarAuditLog(params: {
  tipo: string
  dados?: Record<string, unknown>
  usuarioUid: string
  usuarioNome: string
}): Record<string, unknown> {
  const dados = params.dados ?? {}
  const documentId =
    typeof dados.documentId === 'string' ? dados.documentId : undefined

  return {
    tipo: params.tipo,
    ...dados,
    usuarioUid: params.usuarioUid,
    usuarioNome: params.usuarioNome,
    timestamp: serverTimestamp(),
    ...dadosCompatibilidade(documentId),
  }
}

export async function registrarEdicao(params: {
  colecao: string
  documentId: string
  campo: string
  valorAnterior: unknown
  valorNovo: unknown
  usuarioUid: string
  usuarioNome: string
}): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), formatarAuditLog({
      tipo: 'edicao',
      dados: {
        colecao: params.colecao,
        documentId: params.documentId,
        campo: params.campo,
        valorAnterior: params.valorAnterior,
        valorNovo: params.valorNovo,
        acao: 'editar',
      },
      usuarioUid: params.usuarioUid,
      usuarioNome: params.usuarioNome,
    }))
  } catch {
    // Auditoria nao deve quebrar o fluxo principal
  }
}

export async function registrarAcao(params: {
  tipo: string
  dados: Record<string, unknown>
  usuarioUid: string
  usuarioNome: string
}): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), formatarAuditLog(params))
  } catch {
    // Auditoria nao deve quebrar o fluxo principal
  }
}
