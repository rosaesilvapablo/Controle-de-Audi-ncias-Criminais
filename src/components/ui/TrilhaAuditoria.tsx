import { useEffect, useState } from 'react'
import {
  CheckCircle,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { formatarDataHora } from '../../lib/audienciaHelpers'
import type { AuditAcao, AuditLog, StatusAudiencia } from '../../types'
import { STATUS_AUDIENCIA_LABELS } from '../../types'

interface TrilhaAuditoriaProps {
  colecao: string
  documentoId: string
  maxItens?: number
}

const ACAO_LABELS: Record<AuditAcao, string> = {
  criar: 'Agendada',
  editar: 'Editada',
  iniciar: 'Iniciada',
  encerrar: 'Encerrada',
  redesignar: 'Remarcada',
  cancelar: 'Cancelada',
  excluir: 'Excluída',
}

const ACAO_META: Record<
  AuditAcao,
  { icon: typeof Plus; color: string }
> = {
  criar: { icon: Plus, color: 'text-aurora-primary-light' },
  editar: { icon: Pencil, color: 'text-aurora-text-muted' },
  iniciar: { icon: Play, color: 'text-aurora-green' },
  encerrar: { icon: CheckCircle, color: 'text-aurora-green' },
  redesignar: { icon: RefreshCw, color: 'text-aurora-amber' },
  cancelar: { icon: XCircle, color: 'text-aurora-red' },
  excluir: { icon: Trash2, color: 'text-aurora-red' },
}

const ACAO_FALLBACK: AuditAcao = 'editar'

function extrairTexto(
  entrada: AuditLog,
): { motivo?: string; observacao?: string; situacao?: string } {
  const depois = (entrada.depois ?? {}) as {
    motivoCancelamento?: string
    observacoes?: string
    status?: StatusAudiencia
  }

  return {
    motivo: depois.motivoCancelamento,
    observacao: depois.observacoes,
    situacao: depois.status ? STATUS_AUDIENCIA_LABELS[depois.status] : undefined,
  }
}

export function TrilhaAuditoria({
  colecao: nomeColecao,
  documentoId,
  maxItens = 10,
}: TrilhaAuditoriaProps) {
  const [itens, setItens] = useState<AuditLog[]>([])
  const [abertas, setAbertas] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const q = query(
      collection(db, 'audit_logs'),
      where('colecao', '==', nomeColecao),
      where('documentoId', '==', documentoId),
      orderBy('criadoEm', 'desc'),
      limit(maxItens),
    )

    return onSnapshot(q, (snapshot) => {
      setItens(
        snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditLog),
      )
    })
  }, [documentoId, maxItens, nomeColecao])

  if (!itens.length) {
    return (
      <div className="text-sm text-aurora-text-muted">
        Sem registros de auditoria.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {itens.map((item, index) => {
        const acao = (item.acao ?? ACAO_FALLBACK) as AuditAcao
        const meta = ACAO_META[acao] ?? ACAO_META[ACAO_FALLBACK]
        const Icon = meta.icon
        const detalhes = extrairTexto(item)
        const temDetalhes =
          !!detalhes.motivo || !!detalhes.observacao || !!detalhes.situacao
        const aberta = abertas[item.id] ?? false
        const dataRegistro = item.criadoEm ?? item.timestamp

        return (
          <div key={item.id} className="flex gap-3">
            <div className="flex w-6 flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border border-aurora-border bg-aurora-elevated ${meta.color}`}
              >
                <Icon size={12} />
              </div>
              {index < itens.length - 1 && (
                <div className="mt-1 w-px flex-1 bg-aurora-border" />
              )}
            </div>

            <div className="min-w-0 flex-1 pb-2">
              <button
                type="button"
                disabled={!temDetalhes}
                onClick={() =>
                  temDetalhes &&
                  setAbertas((atual) => ({ ...atual, [item.id]: !aberta }))
                }
                className="w-full text-left disabled:cursor-default"
              >
                <div className="text-sm text-aurora-text-primary">
                  {ACAO_LABELS[acao] ?? 'Atualizada'} por {item.usuarioNome}
                </div>
                <div className="mt-0.5 text-2xs text-aurora-text-muted">
                  {dataRegistro ? formatarDataHora(dataRegistro) : 'Sem data'}
                </div>
              </button>

              {aberta && temDetalhes && (
                <div className="mt-2 space-y-1 text-xs text-aurora-text-secondary">
                  {detalhes.motivo && <div>Motivo: {detalhes.motivo}</div>}
                  {detalhes.observacao && (
                    <div>Observação: {detalhes.observacao}</div>
                  )}
                  {detalhes.situacao && <div>Situação: {detalhes.situacao}</div>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
