import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useCancelamentoAudiencia, useMotivoCancelamento } from '../../hooks'
import { Button, Modal, Select, Textarea } from '../ui'

interface ModalCancelamentoAudienciaProps {
  open: boolean
  onClose: () => void
  audienciaId: string
  numeroProcesso: string
  processoPendenteId?: string
  onCancelado?: () => void
}

export function ModalCancelamentoAudiencia({
  open,
  onClose,
  audienciaId,
  numeroProcesso,
  processoPendenteId,
  onCancelado,
}: ModalCancelamentoAudienciaProps) {
  const { usuario } = useAuth()
  const toast = useToast()
  const { cancelarAudiencia } = useCancelamentoAudiencia()
  const { motivos, loading, buscarMotivos } = useMotivoCancelamento()
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [devolverAFila, setDevolverAFila] = useState(true)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    void buscarMotivos()
  }, [buscarMotivos, open])

  useEffect(() => {
    if (!open) return
    setMotivoCancelamento('')
    setJustificativa('')
    setDevolverAFila(true)
    setSalvando(false)
  }, [open])

  const justificativaLimpa = justificativa.trim()
  const contador = justificativa.length
  const formularioValido = Boolean(motivoCancelamento) && justificativaLimpa.length >= 10
  const mensagemFila = useMemo(
    () =>
      devolverAFila
        ? 'O processo retornara a fila de designacao com indicacao de reagendamento.'
        : 'O processo ficara como cancelado sem reagendamento. Podera ser reagendado manualmente a qualquer momento.',
    [devolverAFila],
  )

  async function confirmarCancelamento() {
    if (!usuario || !formularioValido) return

    setSalvando(true)
    try {
      await cancelarAudiencia({
        audienciaId,
        numeroProcesso,
        motivoCancelamento,
        justificativa: justificativaLimpa,
        devolverAFila,
        processoPendenteId,
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })
      toast.success('Audiencia cancelada com sucesso.')
      onClose()
      onCancelado?.()
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : 'Falha desconhecida.'
      toast.error(`Nao foi possivel cancelar a audiencia. ${detalhe}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancelar audiencia"
      size="md"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={salvando}
            disabled={!formularioValido}
            onClick={() => void confirmarCancelamento()}
          >
            Confirmar cancelamento
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2">
          <div className="text-xs text-aurora-text-muted">Processo</div>
          <div className="mt-1 font-mono text-sm text-aurora-text-primary">
            {numeroProcesso}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-4 text-sm text-aurora-text-secondary">
            <Loader2 size={14} className="animate-spin" />
            Carregando motivos de cancelamento...
          </div>
        ) : (
          <Select
            label="Motivo do cancelamento"
            value={motivoCancelamento}
            onChange={(event) => setMotivoCancelamento(event.target.value)}
          >
            <option value="">Selecione um motivo</option>
            {motivos.map((motivo) => (
              <option key={motivo} value={motivo}>
                {motivo}
              </option>
            ))}
          </Select>
        )}

        <div className="space-y-1">
          <Textarea
            label="Justificativa"
            rows={4}
            value={justificativa}
            onChange={(event) => setJustificativa(event.target.value)}
            placeholder="Descreva o motivo com mais detalhes..."
          />
          <div className="text-right text-xs text-aurora-text-muted">
            {contador} caracteres
          </div>
        </div>

        <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={devolverAFila}
              onChange={(event) => setDevolverAFila(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-aurora-border bg-aurora-surface"
            />
            <div className="space-y-2">
              <div className="text-sm text-aurora-text-primary">
                Devolver processo para a fila de designacao
              </div>
              <div
                className={`text-xs ${
                  devolverAFila ? 'text-aurora-green' : 'text-aurora-amber'
                }`}
              >
                {mensagemFila}
              </div>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  )
}
