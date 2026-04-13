import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Copy,
  Eye,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { FormularioModelo } from '../components/modelos/FormularioModelo'
import { ModalVisualizarModelo } from '../components/modelos/ModalVisualizarModelo'
import { Button, Card, EmptyState, Input, Select } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useModelosDocumentos } from '../hooks/useModelosDocumentos'
import { TipoModelo, type ModeloDocumento } from '../types/core'

type EstadoTela = 'LISTANDO' | 'CRIANDO' | 'EDITANDO'

const TIPO_MODELO_ROTULO: Record<TipoModelo, string> = {
  [TipoModelo.ATA_AIJ]: 'Ata de AIJ',
  [TipoModelo.ATA_CUSTODIA]: 'Ata de Custodia',
  [TipoModelo.ATA_PRELIMINAR]: 'Ata Preliminar',
  [TipoModelo.ATA_ANPP]: 'Ata ANPP',
  [TipoModelo.ATA_GENERICA]: 'Ata Generica',
  [TipoModelo.OUTRO]: 'Outro',
}

const VISIBILIDADE_ROTULO: Record<ModeloDocumento['visivelPara'], string> = {
  todos: 'Todos',
  magistrado: 'Magistrados',
  servidor: 'Servidores',
}

export default function Modelos() {
  const toast = useToast()
  const {
    modelos,
    carregando,
    erro,
    criarModelo,
    atualizarModelo,
    arquivarModelo,
    duplicarModelo,
    restaurarModelo,
  } = useModelosDocumentos()

  const [estado, setEstado] = useState<EstadoTela>('LISTANDO')
  const [modeloEditandoId, setModeloEditandoId] = useState<string | null>(null)
  const [modeloVisualizandoId, setModeloVisualizandoId] = useState<string | null>(null)
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | TipoModelo>('todos')
  const [exibirArquivados, setExibirArquivados] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [arquivandoId, setArquivandoId] = useState<string | null>(null)
  const [confirmarArquivarId, setConfirmarArquivarId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusca(buscaInput.trim().toLowerCase())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [buscaInput])

  const modeloEditando = useMemo(
    () => modelos.find((item) => item.id === modeloEditandoId) ?? null,
    [modeloEditandoId, modelos],
  )

  const modelosFiltrados = useMemo(() => {
    return modelos.filter((modelo) => {
      if (!exibirArquivados && modelo.arquivado) return false
      if (tipoFiltro !== 'todos' && modelo.tipo !== tipoFiltro) return false
      if (busca && !modelo.nome.toLowerCase().includes(busca)) return false
      return true
    })
  }, [busca, exibirArquivados, modelos, tipoFiltro])

  const filtroAtivo = Boolean(busca || tipoFiltro !== 'todos' || exibirArquivados)

  async function handleDuplicar(id: string, nome: string) {
    await duplicarModelo(id)
    toast.success(`Modelo duplicado como "${nome} (copia)".`)
  }

  async function handleArquivar(id: string) {
    setArquivandoId(id)
    try {
      await arquivarModelo(id)
      toast.success('Modelo arquivado.')
      setConfirmarArquivarId(null)
    } finally {
      setArquivandoId(null)
    }
  }

  if (estado === 'CRIANDO') {
    return (
      <div className="mx-auto w-full max-w-[1000px] space-y-4">
        <button
          type="button"
          className="text-sm text-aurora-primary hover:underline"
          onClick={() => setEstado('LISTANDO')}
        >
          &larr; Voltar para modelos
        </button>
        <Card className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-aurora-text-primary">Novo modelo</h1>
          </div>
          <FormularioModelo
            carregando={salvando}
            onCancelar={() => setEstado('LISTANDO')}
            onSalvar={async (dados) => {
              setSalvando(true)
              try {
                await criarModelo({ ...dados, criadoPor: '' })
                toast.success('Modelo criado.')
                setEstado('LISTANDO')
              } finally {
                setSalvando(false)
              }
            }}
          />
        </Card>
      </div>
    )
  }

  if (estado === 'EDITANDO' && modeloEditando) {
    return (
      <div className="mx-auto w-full max-w-[1000px] space-y-4">
        <button
          type="button"
          className="text-sm text-aurora-primary hover:underline"
          onClick={() => setEstado('LISTANDO')}
        >
          &larr; Voltar para modelos
        </button>
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold text-aurora-text-primary">
              Editar modelo - {modeloEditando.nome}
            </h1>
            <span className="rounded-full border border-aurora-border bg-aurora-elevated px-3 py-1 text-xs text-aurora-text-secondary">
              Versao {modeloEditando.versao}
            </span>
          </div>
          <FormularioModelo
            modelo={modeloEditando}
            carregando={salvando}
            onCancelar={() => setEstado('LISTANDO')}
            onSalvar={async (dados) => {
              setSalvando(true)
              try {
                await atualizarModelo(modeloEditando.id, dados)
                toast.success(`Modelo atualizado (v. ${modeloEditando.versao + 1}).`)
                setEstado('LISTANDO')
              } finally {
                setSalvando(false)
              }
            }}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-aurora-text-primary">Modelos de documentos</h1>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEstado('CRIANDO')}>
          Novo modelo
        </Button>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            placeholder="Buscar por nome..."
            value={buscaInput}
            onChange={(event) => setBuscaInput(event.target.value)}
          />
          <Select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value as 'todos' | TipoModelo)}>
            <option value="todos">Todos os tipos</option>
            {Object.entries(TIPO_MODELO_ROTULO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <input
              type="checkbox"
              checked={exibirArquivados}
              onChange={(event) => setExibirArquivados(event.target.checked)}
            />
            Exibir arquivados
          </label>
        </div>
        {filtroAtivo && (
          <div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setBuscaInput('')
                setBusca('')
                setTipoFiltro('todos')
                setExibirArquivados(false)
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </Card>

      {erro && (
        <Card className="border-red-400/40 bg-red-500/10 text-sm text-red-200">
          {erro}
        </Card>
      )}

      {carregando ? (
        <Card className="space-y-3">
          <div className="h-6 w-56 animate-pulse rounded bg-aurora-border" />
          <div className="h-20 animate-pulse rounded bg-aurora-border" />
          <div className="h-20 animate-pulse rounded bg-aurora-border" />
        </Card>
      ) : modelosFiltrados.length === 0 ? (
        filtroAtivo ? (
          <EmptyState
            icon={<FileText size={18} />}
            title="Nenhum modelo encontrado."
            action={(
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBuscaInput('')
                  setBusca('')
                  setTipoFiltro('todos')
                  setExibirArquivados(false)
                }}
              >
                Limpar filtros
              </Button>
            )}
          />
        ) : (
          <EmptyState
            icon={<FileText size={18} />}
            title="Nenhum modelo encontrado."
            description="Crie seu primeiro modelo para agilizar o preenchimento das atas."
            action={(
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setEstado('CRIANDO')}>
                Criar primeiro modelo
              </Button>
            )}
          />
        )
      ) : (
        <div className="space-y-3">
          {modelosFiltrados.map((modelo) => (
            <Card
              key={modelo.id}
              className={modelo.arquivado ? 'opacity-70' : ''}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-aurora-border bg-aurora-elevated px-2 py-0.5 text-2xs text-aurora-text-secondary">
                    {TIPO_MODELO_ROTULO[modelo.tipo]}
                  </span>
                  <span className="rounded-full border border-aurora-border bg-aurora-elevated px-2 py-0.5 text-2xs text-aurora-text-secondary">
                    {VISIBILIDADE_ROTULO[modelo.visivelPara]}
                  </span>
                  {modelo.arquivado && (
                    <span className="rounded-full border border-aurora-border bg-aurora-elevated px-2 py-0.5 text-2xs text-aurora-text-secondary">
                      Arquivado
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-aurora-text-primary">{modelo.nome}</div>
                    <div className="text-xs text-aurora-text-muted">
                      Criado em {new Intl.DateTimeFormat('pt-BR').format(modelo.criadoEm)}
                    </div>
                  </div>
                  <div className="text-xs text-aurora-text-muted">v. {modelo.versao}</div>
                </div>

                {confirmarArquivarId === modelo.id && !modelo.arquivado && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <div>Arquivar "{modelo.nome}"? O modelo nao ficara mais disponivel para selecao nas audiencias.</div>
                    <div className="mt-2 flex gap-2">
                      <Button size="xs" variant="ghost" onClick={() => setConfirmarArquivarId(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="xs"
                        variant="secondary"
                        loading={arquivandoId === modelo.id}
                        onClick={() => { void handleArquivar(modelo.id) }}
                      >
                        Arquivar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Eye size={13} />}
                    onClick={() => setModeloVisualizandoId(modelo.id)}
                  >
                    Visualizar
                  </Button>

                  {!modelo.arquivado && (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<Pencil size={13} />}
                      onClick={() => {
                        setModeloEditandoId(modelo.id)
                        setEstado('EDITANDO')
                      }}
                    >
                      Editar
                    </Button>
                  )}

                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Copy size={13} />}
                    onClick={() => { void handleDuplicar(modelo.id, modelo.nome) }}
                  >
                    Duplicar
                  </Button>

                  {modelo.arquivado ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<RotateCcw size={13} />}
                      onClick={async () => {
                        await restaurarModelo(modelo.id)
                        toast.success('Modelo restaurado.')
                      }}
                    >
                      Restaurar
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="ghost"
                      icon={<Archive size={13} />}
                      onClick={() => setConfirmarArquivarId(modelo.id)}
                    >
                      Arquivar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ModalVisualizarModelo
        modeloId={modeloVisualizandoId}
        aberto={Boolean(modeloVisualizandoId)}
        onFechar={() => setModeloVisualizandoId(null)}
      />
    </div>
  )
}
