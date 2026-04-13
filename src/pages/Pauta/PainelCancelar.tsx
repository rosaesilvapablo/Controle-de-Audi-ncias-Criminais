import { useState } from 'react'
import { Button, Textarea } from '../../components/ui'
import type { Audiencia } from '../../types'
import { MOTIVOS_CANCELAMENTO } from '../../types'

interface PainelCancelarProps {
  audiencia: Audiencia
  processoPendenteId?: string
  onConfirmar: (
    motivo: string,
    motivoOutro: string | undefined,
    devolverFila: boolean
  ) => void
  onCancelar: () => void
}

const MOTIVO_BTN =
  'h-9 rounded-lg border text-xs font-medium transition-all duration-150'

export function PainelCancelar({
  audiencia,
  processoPendenteId,
  onConfirmar,
  onCancelar,
}: PainelCancelarProps) {
  const [motivo, setMotivo] =
    useState<(typeof MOTIVOS_CANCELAMENTO)[number] | ''>(
      audiencia.motivoCancelamento ?? '',
    )
  const [motivoOutro, setMotivoOutro] = useState(audiencia.motivoOutro ?? '')
  const [erro, setErro] = useState('')
  const [devolverFila, setDevolverFila] = useState(false)

  const confirmar = () => {
    if (!motivo) {
      setErro('Selecione o motivo do cancelamento.')
      return
    }
    if (motivo === 'Outro motivo' && !motivoOutro.trim()) {
      setErro('Descreva o motivo do cancelamento.')
      return
    }
    setErro('')
    onConfirmar(
      motivo,
      motivo === 'Outro motivo' ? motivoOutro.trim() : undefined,
      devolverFila,
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-red/20 bg-aurora-red-muted p-4">
        <h2 className="text-base font-semibold text-aurora-text-primary">
          Cancelar audiência
        </h2>
        <p className="mt-1 font-mono text-sm text-aurora-text-muted">
          {audiencia.numeroProcesso}
        </p>
        <p className="mt-1 text-xs text-aurora-text-muted">
          {audiencia.salaNome ?? 'Sala'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-aurora-text-primary">
            Motivo do cancelamento
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MOTIVOS_CANCELAMENTO.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMotivo(item)}
                className={`${MOTIVO_BTN} ${
                  motivo === item
                    ? 'border-aurora-red bg-aurora-red/15 text-aurora-red'
                    : 'border-aurora-border bg-aurora-elevated text-aurora-text-secondary'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          {motivo === 'Outro motivo' && (
            <Textarea
              label="Descreva o motivo"
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
            />
          )}
          {(processoPendenteId || audiencia.numeroProcesso) && (
            <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={devolverFila}
                  onChange={(e) => setDevolverFila(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-aurora-border bg-aurora-surface"
                />
                <div>
                  <div className="text-sm text-aurora-text-primary">
                    Devolver este processo à fila de designação
                  </div>
                  <div className="mt-1 text-xs text-aurora-text-muted">
                    O processo voltará com situação &apos;aguardando&apos; para ser remarcado posteriormente.
                  </div>
                </div>
              </label>
            </div>
          )}
          {erro && (
            <div className="rounded-xl border border-aurora-red/30 bg-aurora-red-muted p-3 text-sm text-aurora-red">
              {erro}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-aurora-border p-4">
        <Button variant="ghost" className="flex-1" onClick={onCancelar}>
          Voltar
        </Button>
        <Button variant="danger" className="flex-1" onClick={confirmar}>
          Confirmar cancelamento
        </Button>
      </div>
    </div>
  )
}
