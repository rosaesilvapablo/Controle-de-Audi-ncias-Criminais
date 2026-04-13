import type { AuditAcao } from '../types'
import { registrarAcao } from '../lib/auditoria'

interface AuditoriaParams {
  colecao: string
  documentoId: string
  acao: AuditAcao
  antes?: Record<string, unknown>
  depois?: Record<string, unknown>
  usuarioId: string
  usuarioNome: string
}

export async function registrarAuditoria(params: AuditoriaParams): Promise<void> {
  await registrarAcao({
    tipo: params.acao,
    dados: {
      colecao: params.colecao,
      documentId: params.documentoId,
      documentoId: params.documentoId,
      acao: params.acao,
      antes: params.antes,
      depois: params.depois,
    },
    usuarioUid: params.usuarioId,
    usuarioNome: params.usuarioNome,
  })
}
