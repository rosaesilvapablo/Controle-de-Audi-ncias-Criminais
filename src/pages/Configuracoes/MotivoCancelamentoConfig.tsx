import { useEffect, useMemo, useState, type DragEvent as ReactDragEvent } from 'react'
import { GripVertical, Info, Plus, Save, Trash2 } from 'lucide-react'
import { useMotivoCancelamento } from '../../hooks/useMotivoCancelamento'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Card, Input } from '../../components/ui'

const DRAG_MIME_TYPE = 'application/x-scac-motivo-cancelamento'

function moverItem(lista: string[], origem: number, destino: number) {
  const atualizada = [...lista]
  const [item] = atualizada.splice(origem, 1)
  atualizada.splice(destino, 0, item)
  return atualizada
}

export default function MotivoCancelamentoConfig() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { motivos, loading, salvando, salvarMotivos } = useMotivoCancelamento()
  const [itens, setItens] = useState<string[]>([])
  const [novoMotivo, setNovoMotivo] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  useEffect(() => {
    setItens(motivos)
  }, [motivos])

  const isAdmin = usuario?.perfil === 'diretor'
  const motivoNormalizado = novoMotivo.trim()

  const duplicado = useMemo(() => {
    const alvo = motivoNormalizado.toLocaleLowerCase()
    return itens.some((item) => item.trim().toLocaleLowerCase() === alvo)
  }, [itens, motivoNormalizado])

  const houveAlteracoes = useMemo(() => {
    if (itens.length !== motivos.length) return true
    return itens.some((item, index) => item !== motivos[index])
  }, [itens, motivos])

  if (!isAdmin) return null

  const adicionarMotivo = () => {
    if (!motivoNormalizado) {
      toast.warning('Informe um motivo antes de adicionar.')
      return
    }

    if (duplicado) {
      toast.warning('Esse motivo já está cadastrado.')
      return
    }

    setItens((atual) => [...atual, motivoNormalizado])
    setNovoMotivo('')
  }

  const excluirMotivo = (index: number) => {
    if (itens.length <= 1) return
    setItens((atual) => atual.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleDragStart = (index: number) => (event: ReactDragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(DRAG_MIME_TYPE, String(index))
    setDragIndex(index)
    setDropIndex(index)
  }

  const handleDragOver = (index: number) => (event: ReactDragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIndex(index)
  }

  const handleDrop = (index: number) => (event: ReactDragEvent<HTMLDivElement>) => {
    const bruto = event.dataTransfer.getData(DRAG_MIME_TYPE)
    if (!bruto) return

    const origem = Number(bruto)
    if (Number.isNaN(origem) || origem === index) {
      setDragIndex(null)
      setDropIndex(null)
      return
    }

    event.preventDefault()
    setItens((atual) => moverItem(atual, origem, index))
    setDragIndex(null)
    setDropIndex(null)
  }

  const limparDrag = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  const salvarAlteracoes = async () => {
    toast.info('Salvando motivos de cancelamento...')

    try {
      await salvarMotivos(itens)
      toast.success('Motivos de cancelamento salvos com sucesso.')
    } catch {
      toast.error('Não foi possível salvar os motivos de cancelamento. Tente novamente.')
    }
  }

  return (
    <Card padding="md">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-aurora-text-primary">
              Motivos de Cancelamento
            </p>
            <p className="mt-1 text-xs text-aurora-text-muted">
              Gerencie a lista exibida ao cancelar audiencias. Arraste os itens para reordenar.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            loading={salvando}
            disabled={loading || !houveAlteracoes}
            onClick={() => void salvarAlteracoes()}
          >
            Salvar alteracoes
          </Button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-aurora-border bg-aurora-elevated/60 px-4 py-5 text-sm text-aurora-text-muted">
            Carregando motivos cadastrados...
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {itens.map((item, index) => {
              const ultimoItem = itens.length === 1

              return (
                <div
                  key={`${item}-${index}`}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={limparDrag}
                  className={[
                    'flex items-center gap-3 rounded-2xl border border-aurora-border bg-white px-3 py-3 transition-all',
                    dragIndex === index ? 'drag-ghost' : '',
                    dropIndex === index ? 'drop-active' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-aurora-border bg-aurora-elevated text-aurora-text-muted"
                    title="Arrastar para reordenar"
                  >
                    <GripVertical size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-aurora-text-primary">{item}</p>
                  </div>
                  <span title={ultimoItem ? 'Mínimo 1 motivo' : 'Excluir motivo'}>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      icon={<Trash2 size={13} />}
                      disabled={ultimoItem}
                      aria-label={ultimoItem ? 'Mínimo 1 motivo' : `Excluir ${item}`}
                      className="text-aurora-red hover:bg-aurora-red-muted/30"
                      onClick={() => excluirMotivo(index)}
                    />
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-2xl border border-aurora-border bg-aurora-elevated/40 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              label="Novo motivo"
              placeholder="Ex.: ausencia de interprete"
              value={novoMotivo}
              onChange={(event) => setNovoMotivo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  adicionarMotivo()
                }
              }}
              hint={duplicado ? 'Esse motivo já existe na lista.' : 'Motivos em branco ou duplicados não são aceitos.'}
              error={!motivoNormalizado && novoMotivo.length > 0 ? 'Digite um texto válido.' : undefined}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                icon={<Plus size={14} />}
                className="w-full md:w-auto"
                onClick={adicionarMotivo}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-2xs text-aurora-text-muted">
          <Info size={12} />
          <span>O sistema exige pelo menos um motivo ativo.</span>
        </div>
      </div>
    </Card>
  )
}
