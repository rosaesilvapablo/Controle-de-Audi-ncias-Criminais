import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, SkeletonLine } from '../ui'
import { useModelosDocumentos } from '../../hooks/useModelosDocumentos'
import { ROTAS } from '../../router/rotas'
import type { ModeloDocumento } from '../../types/core'

interface Props {
  modeloId: string | null
  aberto: boolean
  onFechar: () => void
}

export function ModalVisualizarModelo({
  modeloId,
  aberto,
  onFechar,
}: Props) {
  const navigate = useNavigate()
  const { buscarPorId } = useModelosDocumentos()
  const [carregando, setCarregando] = useState(false)
  const [modelo, setModelo] = useState<ModeloDocumento | null>(null)

  useEffect(() => {
    if (!aberto) return

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [aberto, onFechar])

  useEffect(() => {
    if (!aberto) return
    if (!modeloId) {
      setModelo(null)
      return
    }

    setCarregando(true)
    setModelo(null)
    void buscarPorId(modeloId)
      .then((encontrado) => setModelo(encontrado))
      .finally(() => setCarregando(false))
  }, [aberto, buscarPorId, modeloId])

  return (
    <Modal
      open={aberto}
      onClose={onFechar}
      title="Visualizar modelo de ata"
      size="lg"
      footer={(
        <>
          <Button variant="ghost" size="sm" onClick={onFechar}>Fechar</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(ROTAS.MODELOS)}
          >
            Ir para edicao
          </Button>
        </>
      )}
    >
      {carregando ? (
        <div className="space-y-3">
          <SkeletonLine className="h-5 w-2/3" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-40 w-full" />
        </div>
      ) : !modeloId || !modelo ? (
        <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-4 text-sm text-aurora-text-secondary">
          Modelo nao encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-lg font-semibold text-aurora-text-primary">{modelo.nome}</div>
            <div className="text-xs text-aurora-text-muted">{modelo.tipo}</div>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-2xl border border-aurora-border bg-aurora-elevated p-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-aurora-text-primary [font-family:Georgia,Times,'Times_New_Roman',serif]">
              {modelo.conteudo || 'Sem conteudo.'}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

