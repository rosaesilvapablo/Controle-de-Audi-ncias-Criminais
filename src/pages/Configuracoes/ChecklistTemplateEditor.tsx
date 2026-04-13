import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useChecklistTemplate } from '../../hooks'
import { Badge, Button, Card, Input, PageLoader, Select } from '../../components/ui'
import { FASES_LABELS, isAdmin, type FaseProcedimento, type ItemTemplate } from '../../types'

interface ItemTemplateDraft extends ItemTemplate {
  localId: string
}

function criarIdLocal() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function recalcularOrdens<T extends ItemTemplate>(itens: T[]): T[] {
  const porFase = new Map<number, T[]>()

  for (const item of itens) {
    const fase = Math.min(5, Math.max(1, Number(item.fase ?? 1)))
    const lista = porFase.get(fase) ?? []
    lista.push({ ...item, fase } as T)
    porFase.set(fase, lista)
  }

  return Array.from(porFase.entries())
    .sort(([faseA], [faseB]) => faseA - faseB)
    .flatMap(([, lista]) =>
      lista.map((item, index) => ({
        ...item,
        ordem: index + 1,
      })),
    )
}

function paraDraft(itens: ItemTemplate[]): ItemTemplateDraft[] {
  return recalcularOrdens(itens).map((item) => ({
    ...item,
    localId: criarIdLocal(),
  }))
}

function formatarData(data?: Date) {
  if (!data) return 'Data indisponivel'
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChecklistTemplateEditor() {
  const { usuario } = useAuth()
  const toast = useToast()
  const {
    templateAtivo,
    historico,
    loading,
    salvando,
    salvarNovaVersao,
  } = useChecklistTemplate()
  const [editando, setEditando] = useState(false)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [historicoExpandido, setHistoricoExpandido] = useState<string[]>([])
  const [itensDraft, setItensDraft] = useState<ItemTemplateDraft[]>([])
  const [idsComErro, setIdsComErro] = useState<string[]>([])
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const podeEditarTemplate = isAdmin(usuario?.perfil)
  const proximaVersao = (templateAtivo?.versao ?? 0) + 1

  useEffect(() => {
    if (!editando) {
      setItensDraft(paraDraft(templateAtivo?.itens ?? []))
      setIdsComErro([])
      setConfirmandoRemocao(null)
      setDraggedId(null)
    }
  }, [editando, templateAtivo])

  const itensAtivosPorFase = useMemo(() => {
    const grupos = new Map<number, ItemTemplate[]>()

    for (const item of templateAtivo?.itens ?? []) {
      const lista = grupos.get(item.fase) ?? []
      lista.push(item)
      grupos.set(item.fase, lista)
    }

    return grupos
  }, [templateAtivo])

  const itensDraftPorFase = useMemo(() => {
    const grupos = new Map<number, ItemTemplateDraft[]>()

    for (const item of recalcularOrdens(itensDraft)) {
      const lista = grupos.get(item.fase) ?? []
      lista.push(item)
      grupos.set(item.fase, lista)
    }

    return grupos
  }, [itensDraft])

  if (loading) return <PageLoader />

  const iniciarEdicao = () => {
    setItensDraft(paraDraft(templateAtivo?.itens ?? []))
    setIdsComErro([])
    setConfirmandoRemocao(null)
    setEditando(true)
  }

  const atualizarItem = (localId: string, patch: Partial<ItemTemplateDraft>) => {
    setItensDraft((atual) =>
      recalcularOrdens(
        atual.map((item) =>
          item.localId === localId
            ? { ...item, ...patch }
            : item,
        ),
      ),
    )
    setIdsComErro((atual) => atual.filter((id) => id !== localId))
  }

  const adicionarItemNaFase = (fase: FaseProcedimento) => {
    setItensDraft((atual) =>
      recalcularOrdens([
        ...atual,
        {
          localId: criarIdLocal(),
          ordem: 999,
          titulo: '',
          fase,
          critico: false,
          responsavelSugerido: '',
        },
      ]),
    )
  }

  const removerItem = (localId: string) => {
    if (confirmandoRemocao !== localId) {
      setConfirmandoRemocao(localId)
      return
    }

    setItensDraft((atual) =>
      recalcularOrdens(atual.filter((item) => item.localId !== localId)),
    )
    setConfirmandoRemocao(null)
    setIdsComErro((atual) => atual.filter((id) => id !== localId))
  }

  const salvar = async () => {
    const itensNormalizados = recalcularOrdens(itensDraft).map((item) => ({
      ordem: item.ordem,
      titulo: item.titulo.trim(),
      fase: item.fase,
      critico: item.critico,
      responsavelSugerido: item.responsavelSugerido?.trim() || undefined,
    }))

    if (itensNormalizados.length === 0) {
      toast.warning('O template precisa ter pelo menos 1 item.')
      return
    }

    const erros = itensDraft
      .filter((item) => !item.titulo.trim())
      .map((item) => item.localId)

    if (erros.length > 0) {
      setIdsComErro(erros)
      toast.warning('Preencha o titulo de todos os itens antes de salvar.')
      return
    }

    if (!usuario) return

    try {
      const versao = await salvarNovaVersao(itensNormalizados, {
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })
      toast.success(`Template v${versao} salvo com sucesso.`)
      setEditando(false)
    } catch {
      toast.error('Nao foi possivel salvar a nova versao do template.')
    }
  }

  const moverDentroDaFase = (fase: number, alvoId: string) => {
    if (!draggedId || draggedId === alvoId) return

    setItensDraft((atual) => {
      const dragged = atual.find((item) => item.localId === draggedId)
      const alvo = atual.find((item) => item.localId === alvoId)
      if (!dragged || !alvo || dragged.fase !== fase || alvo.fase !== fase) return atual

      const fixos = atual.filter((item) => item.fase !== fase)
      const faseItens = atual.filter((item) => item.fase === fase)
      const origem = faseItens.findIndex((item) => item.localId === draggedId)
      const destino = faseItens.findIndex((item) => item.localId === alvoId)
      if (origem < 0 || destino < 0) return atual

      const reordenados = [...faseItens]
      const [itemMovido] = reordenados.splice(origem, 1)
      reordenados.splice(destino, 0, itemMovido)

      return recalcularOrdens([...fixos, ...reordenados])
    })
  }

  const toggleHistorico = (id: string) => {
    setHistoricoExpandido((atual) =>
      atual.includes(id)
        ? atual.filter((item) => item !== id)
        : [...atual, id],
    )
  }

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-aurora-text-primary">
            Template de Checklist
          </p>
          <p className="mt-1 text-sm text-aurora-text-muted">
            Audiências novas usam a versão ativa como base. Snapshots antigos permanecem preservados.
          </p>
        </div>
        {templateAtivo ? (
          <Badge variant="success">v{templateAtivo.versao} - Ativo</Badge>
        ) : (
          <Badge variant="warning">Sem template ativo</Badge>
        )}
      </div>

      {!editando && (
        <div className="mt-4 space-y-4">
          {templateAtivo ? (
            ([1, 2, 3, 4, 5] as FaseProcedimento[]).map((fase) => {
              const itens = itensAtivosPorFase.get(fase) ?? []
              if (itens.length === 0) return null

              return (
                <div key={fase}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
                    {FASES_LABELS[fase]}
                  </div>
                  <div className="space-y-2">
                    {itens.map((item) => (
                      <div
                        key={`${fase}-${item.ordem}-${item.titulo}`}
                        className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-aurora-text-primary">
                              {item.ordem}. {item.titulo}
                            </div>
                            {item.responsavelSugerido && (
                              <div className="mt-1 text-xs text-aurora-text-muted">
                                Responsavel sugerido: {item.responsavelSugerido}
                              </div>
                            )}
                          </div>
                          {item.critico && <Badge variant="danger">Critico</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-5 text-sm text-aurora-text-muted">
              Nenhum template ativo cadastrado.
            </div>
          )}

          {podeEditarTemplate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={iniciarEdicao}>
                Editar template
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMostrarHistorico((atual) => !atual)}
              >
                {mostrarHistorico ? 'Ocultar historico' : 'Ver historico'}
              </Button>
            </div>
          )}
        </div>
      )}

      {editando && podeEditarTemplate && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-aurora-amber/30 bg-aurora-amber-pale px-4 py-3 text-sm text-aurora-text-secondary">
            Ao salvar, uma nova versão será criada (v{proximaVersao}). Audiências já agendadas preservam a versão atual.
          </div>

          {([1, 2, 3, 4, 5] as FaseProcedimento[]).map((fase) => {
            const itens = itensDraftPorFase.get(fase) ?? []

            return (
              <div key={fase} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
                    {FASES_LABELS[fase]}
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => adicionarItemNaFase(fase)}
                  >
                    + Adicionar item nesta fase
                  </Button>
                </div>

                {itens.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-aurora-border px-4 py-4 text-sm text-aurora-text-muted">
                    Nenhum item nesta fase.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {itens.map((item) => (
                      <div
                        key={item.localId}
                        className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3"
                        draggable
                        onDragStart={() => setDraggedId(item.localId)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => moverDentroDaFase(fase, item.localId)}
                        onDragEnd={() => setDraggedId(null)}
                      >
                        <div className="grid gap-3 md:grid-cols-[auto,1fr,120px,auto,1fr,auto] md:items-center">
                          <div className="flex items-center gap-2 text-aurora-text-muted">
                            <GripVertical size={14} />
                            <span className="text-xs font-medium">{item.ordem}</span>
                          </div>
                          <Input
                            label="Titulo"
                            value={item.titulo}
                            error={idsComErro.includes(item.localId) ? 'Titulo obrigatorio.' : undefined}
                            onChange={(event) =>
                              atualizarItem(item.localId, { titulo: event.target.value })
                            }
                          />
                          <Select
                            label="Fase"
                            value={String(item.fase)}
                            onChange={(event) =>
                              atualizarItem(item.localId, {
                                fase: Number(event.target.value),
                              })
                            }
                          >
                            {[1, 2, 3, 4, 5].map((faseOption) => (
                              <option key={faseOption} value={faseOption}>
                                Fase {faseOption}
                              </option>
                            ))}
                          </Select>
                          <label className="flex items-center gap-2 pt-5 text-sm text-aurora-text-secondary">
                            <input
                              type="checkbox"
                              checked={item.critico}
                              onChange={(event) =>
                                atualizarItem(item.localId, { critico: event.target.checked })
                              }
                            />
                            Critico
                          </label>
                          <Input
                            label="Responsavel sugerido"
                            value={item.responsavelSugerido ?? ''}
                            onChange={(event) =>
                              atualizarItem(item.localId, {
                                responsavelSugerido: event.target.value,
                              })
                            }
                          />
                          <Button
                            variant={confirmandoRemocao === item.localId ? 'danger' : 'ghost'}
                            size="xs"
                            className="mt-5"
                            onClick={() => removerItem(item.localId)}
                          >
                            {confirmandoRemocao === item.localId ? 'Confirmar' : 'X'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={salvando}
              onClick={() => void salvar()}
            >
              Salvar nova versao
            </Button>
          </div>
        </div>
      )}

      {podeEditarTemplate && mostrarHistorico && (
        <div className="mt-5 space-y-3 border-t border-aurora-border pt-5">
          <div className="text-sm font-medium text-aurora-text-primary">
            Historico de versoes
          </div>
          {historico.map((versao) => {
            const expandido = historicoExpandido.includes(versao.id)

            return (
              <div key={versao.id} className="rounded-2xl border border-aurora-border bg-aurora-elevated px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-aurora-text-primary">
                    v{versao.versao} - criada em {formatarData(versao.criadaEm?.toDate?.())} por {versao.criadaPor} - {versao.itens.length} itens
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    iconRight={expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    onClick={() => toggleHistorico(versao.id)}
                  >
                    Ver itens
                  </Button>
                </div>

                {expandido && (
                  <div className="mt-3 space-y-2">
                    {versao.itens.map((item) => (
                      <div
                        key={`${versao.id}-${item.fase}-${item.ordem}-${item.titulo}`}
                        className="rounded-xl border border-aurora-border bg-white px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-aurora-text-primary">
                            {FASES_LABELS[item.fase as FaseProcedimento]} - {item.ordem}. {item.titulo}
                          </div>
                          {item.critico && <Badge variant="danger">Critico</Badge>}
                        </div>
                        {item.responsavelSugerido && (
                          <div className="mt-1 text-xs text-aurora-text-muted">
                            Responsavel sugerido: {item.responsavelSugerido}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
