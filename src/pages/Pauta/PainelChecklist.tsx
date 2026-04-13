import { useEffect, useMemo, useState } from 'react'
import { doc, Timestamp, updateDoc } from 'firebase/firestore'
import { Check, Eye, Square } from 'lucide-react'
import { Badge, Button, Card, Input, PageLoader, Textarea } from '../../components/ui'
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { temPermissao } from '../../lib/permissoes'
import { registrarAcao, registrarEdicao } from '../../lib/auditoria'
import {
  isChecklistIncompletoCritico,
  validarTransicaoEstado,
} from '../../lib/audienciaHelpers'
import type {
  Audiencia,
  FaseProcedimento,
  Procedimento,
  ProcedimentoItem,
} from '../../types'
import { FASES_LABELS } from '../../types'

function valorComparable(valor: unknown): unknown {
  if (valor instanceof Timestamp) return valor.toMillis()
  if (Array.isArray(valor)) return valor.map((item) => valorComparable(item))
  if (valor && typeof valor === 'object') {
    if ('seconds' in (valor as Record<string, unknown>) && 'nanoseconds' in (valor as Record<string, unknown>)) {
      const timestamp = valor as { seconds: number; nanoseconds: number }
      return `${timestamp.seconds}:${timestamp.nanoseconds}`
    }

    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        valorComparable(item),
      ]),
    )
  }

  return valor
}

function valoresDiferentes(valorAnterior: unknown, valorNovo: unknown) {
  return JSON.stringify(valorComparable(valorAnterior)) !== JSON.stringify(valorComparable(valorNovo))
}

interface PainelChecklistProps {
  audiencia: Audiencia
  procedimento: Procedimento | null
  itens: ProcedimentoItem[]
  onEncerrar: () => void
  onVoltar: () => void
  onSalvarItem: (
    itemId: string,
    resposta: string | boolean,
    observacao: string,
    idsPje: string[],
  ) => Promise<void>
}

interface ItemChecklistProps {
  item: ProcedimentoItem
  onSalvar: (
    item: ProcedimentoItem,
    resposta: string | boolean,
    observacao: string,
    idsPje: string[],
  ) => Promise<void>
  somenteLeitura?: boolean
}

const respondeu = (item: { resposta?: string | boolean }) =>
  item.resposta !== undefined && item.resposta !== '' && item.resposta !== null

function ItemChecklist({
  item,
  onSalvar,
  somenteLeitura = false,
}: ItemChecklistProps) {
  const [editando, setEditando] = useState(false)
  const [resposta, setResposta] = useState<string | boolean>(item.resposta ?? '')
  const [obs, setObs] = useState(item.observacao ?? '')
  const [pjeInput, setPjeInput] = useState('')
  const [idsPje, setIdsPje] = useState<string[]>(item.idsPje ?? [])
  const [salvando, setSalvando] = useState(false)

  const respondido = respondeu(item)

  const salvar = async () => {
    setSalvando(true)
    await onSalvar(item, resposta, obs, idsPje)
    setSalvando(false)
    setEditando(false)
  }

  const adicionarPje = () => {
    if (!pjeInput.trim()) return
    setIdsPje((ids) => [...ids, pjeInput.trim()])
    setPjeInput('')
  }

  const respostaTexto =
    typeof item.resposta === 'boolean'
      ? item.resposta
        ? 'Sim'
        : 'Não'
      : item.resposta || ''

  return (
    <div
      className={`border-b border-aurora-border last:border-0 ${
        item.critico && !respondido ? 'bg-aurora-red-muted/20' : ''
      }`}
    >
      <button
        onClick={() => {
          if (!somenteLeitura) setEditando((atual) => !atual)
        }}
        className="w-full px-4 py-3 text-left hover:bg-aurora-elevated/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              respondido
                ? 'border-aurora-green bg-aurora-green text-white'
                : 'border-aurora-border bg-transparent text-transparent'
            }`}
          >
            <Check size={12} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm ${
                  respondido
                    ? 'text-aurora-text-muted line-through'
                    : 'text-aurora-text-primary'
                }`}
              >
                {item.descricao}
              </span>
              {item.obrigatorio && !respondido && (
                <div className="mt-1 inline-flex rounded-full bg-aurora-red-muted px-2 py-0.5 text-2xs font-medium text-aurora-red">
                  obrigatório
                </div>
              )}
            </div>

            {respondido && item.observacao && (
              <p className="mt-0.5 truncate text-2xs text-aurora-text-muted">
                {item.observacao}
              </p>
            )}
          </div>
        </div>
      </button>

      {somenteLeitura ? (
        <div className="px-4 pb-4">
          {respondido ? (
            <div className="space-y-2 rounded-xl border border-aurora-border bg-aurora-elevated/70 p-3">
              <div className="text-xs font-medium text-aurora-text-secondary">
                Resposta registrada
              </div>
              <div className="text-sm text-aurora-text-primary">{respostaTexto}</div>
              {item.observacao && (
                <div className="text-xs text-aurora-text-muted">
                  Observação: {item.observacao}
                </div>
              )}
              {!!item.idsPje?.length && (
                <div className="flex flex-wrap gap-1.5">
                  {item.idsPje.map((id) => (
                    <span
                      key={id}
                      className="rounded-full border border-aurora-border bg-white px-2 py-1 font-mono text-2xs text-aurora-text-secondary"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-aurora-border bg-aurora-elevated/50 p-3 text-xs text-aurora-text-muted">
              Nenhuma resposta registrada para este item até o momento.
            </div>
          )}
        </div>
      ) : (
        editando && (
          <div className="flex flex-col gap-3 px-4 pb-4">
            {item.tipoResposta === 'sim_nao' ? (
              <div className="flex gap-2">
                {['Sim', 'Não', 'Não se aplica'].map((op) => (
                  <button
                    key={op}
                    onClick={() => setResposta(op)}
                    className={`px-3 h-7 rounded-lg text-xs font-medium border transition-all ${
                      resposta === op
                        ? 'bg-aurora-primary text-white border-aurora-primary'
                        : 'bg-aurora-elevated text-aurora-text-secondary border-aurora-border hover:border-aurora-border-light'
                    }`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            ) : (
              <Input
                placeholder="Descreva a resposta"
                value={resposta as string}
                onChange={(e) => setResposta(e.target.value)}
              />
            )}

            <Textarea
              placeholder="Observações adicionais (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
            />

            <div className="flex flex-col gap-1">
              <span className="text-2xs text-aurora-text-muted">
                Identificações do PJe vinculadas
              </span>
              {idsPje.map((id, i) => (
                <div key={`${id}-${i}`} className="flex items-center gap-2">
                  <span className="flex-1 rounded bg-aurora-elevated px-2 py-1 font-mono text-2xs text-aurora-text-secondary">
                    {id}
                  </span>
                  <button
                    onClick={() =>
                      setIdsPje((atual) => atual.filter((_, j) => j !== i))
                    }
                    className="text-xs text-aurora-red"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  placeholder="Informe a identificação no PJe"
                  value={pjeInput}
                  onChange={(e) => setPjeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarPje()}
                />
                <Button size="sm" variant="secondary" onClick={adicionarPje}>
                  +
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Button>
              <Button
                size="xs"
                variant="primary"
                loading={salvando}
                onClick={salvar}
              >
                Salvar alterações
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

export function PainelChecklist({
  audiencia,
  procedimento,
  itens,
  onEncerrar,
  onVoltar,
  onSalvarItem,
}: PainelChecklistProps) {
  const { usuario } = useAuth()
  const [faseAtiva, setFaseAtiva] = useState<FaseProcedimento>(1)
  const [rascunhos, setRascunhos] = useState<Record<string, string | boolean>>({})
  const [mostrarConfirmacaoEncerramento, setMostrarConfirmacaoEncerramento] =
    useState(false)
  const [motivoEncerramento, setMotivoEncerramento] = useState('')
  const [erroEncerramento, setErroEncerramento] = useState('')

  const podeEditarChecklist = temPermissao(usuario?.perfil, 'editar_checklist')

  useEffect(() => {
    setRascunhos((atual) => {
      const next = { ...atual }
      for (const item of itens) {
        if (!(item.id in next) && item.resposta !== undefined) {
          next[item.id] = item.resposta
        }
      }
      return next
    })
  }, [itens])

  useEffect(() => {
    const primeiraPendente = ([1, 2, 3, 4, 5] as FaseProcedimento[]).find(
      (fase) =>
        itens.some(
          (item) => item.fase === fase && item.obrigatorio && !respondeu(item),
        ),
    )
    setFaseAtiva(primeiraPendente ?? 1)
  }, [itens])

  const itensDaFase = useMemo(
    () => itens.filter((item) => item.fase === faseAtiva),
    [faseAtiva, itens],
  )

  const salvar = async (item: ProcedimentoItem, valor: string | boolean) => {
    setRascunhos((atual) => ({ ...atual, [item.id]: valor }))
    const idsPje =
      typeof valor === 'string' &&
      item.descricao.toLowerCase().includes('identificação das peças')
        ? valor
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : item.idsPje ?? []

    await onSalvarItem(item.id, valor, item.observacao ?? '', idsPje)
  }

  const solicitarEncerramento = () => {
    const resultado = validarTransicaoEstado(
      'encerrar',
      audiencia.status,
      procedimento,
    )

    if (!resultado.permitido) {
      setErroEncerramento(
        resultado.mensagem ??
          'Esta ação não é permitida na situação atual da audiência.',
      )
      setMostrarConfirmacaoEncerramento(false)
      return
    }

    if (isChecklistIncompletoCritico(procedimento)) {
      setMostrarConfirmacaoEncerramento(true)
      setErroEncerramento('')
      return
    }

    void onEncerrar()
  }

  const confirmarEncerramentoComPendencias = async () => {
    if (!procedimento || !usuario) {
      void onEncerrar()
      return
    }

    if (!motivoEncerramento.trim()) {
      setErroEncerramento('Informe o motivo para encerrar com pendências.')
      return
    }

    const procedimentoComObservacoes = procedimento as Procedimento & {
      observacoes?: string
    }

    await updateDoc(doc(db, 'procedimentos', procedimento.id), {
      observacoes: [
        procedimentoComObservacoes.observacoes,
        `Encerramento com pendências: ${motivoEncerramento.trim()}`,
      ]
        .filter(Boolean)
        .join('\n'),
      atualizadoEm: Timestamp.now(),
      editadoEm: Timestamp.now(),
      editadoPor: usuario.uid,
    })

    const novaObservacao = [
      procedimentoComObservacoes.observacoes,
      `Encerramento com pendências: ${motivoEncerramento.trim()}`,
    ]
      .filter(Boolean)
      .join('\n')

    if (valoresDiferentes(procedimentoComObservacoes.observacoes ?? '', novaObservacao)) {
      await registrarEdicao({
        colecao: 'procedimentos',
        documentId: procedimento.id,
        campo: 'observacoes',
        valorAnterior: procedimentoComObservacoes.observacoes ?? '',
        valorNovo: novaObservacao,
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })
    }

    await registrarAcao({
      tipo: 'editar',
      dados: {
        colecao: 'procedimentos',
        documentId: procedimento.id,
        documentoId: procedimento.id,
        acao: 'editar',
        depois: { observacoes: novaObservacao },
      },
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
    })

    setMostrarConfirmacaoEncerramento(false)
    setErroEncerramento('')
    void onEncerrar()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-green/20 bg-aurora-green-muted p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-sm text-aurora-text-primary">
              {audiencia.numeroProcesso}
            </div>
            <div className="mt-2">
              <Badge statusAudiencia="em_andamento" pulse>
                Em andamento
              </Badge>
            </div>
          </div>

          {podeEditarChecklist ? (
            <Button
              size="sm"
              variant="danger"
              icon={<Square size={14} />}
              onClick={solicitarEncerramento}
            >
              Encerrar
            </Button>
          ) : (
            <Badge variant="info">
              <Eye size={10} />
              Somente leitura
            </Badge>
          )}
        </div>

        {!podeEditarChecklist && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-aurora-text-secondary">
            Seu perfil pode acompanhar o checklist, mas não pode alterar respostas nesta tela.
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          {([1, 2, 3, 4, 5] as FaseProcedimento[]).map((fase) => {
            const itensFase = itens.filter((item) => item.fase === fase)
            const concluida =
              itensFase.length > 0 && itensFase.every((item) => respondeu(item))

            return (
              <button
                key={fase}
                type="button"
                onClick={() => setFaseAtiva(fase)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                  concluida
                    ? 'border-aurora-green bg-aurora-green text-white'
                    : fase === faseAtiva
                      ? 'border-aurora-primary bg-aurora-primary text-white'
                      : 'border-aurora-border bg-aurora-elevated text-aurora-text-muted'
                }`}
              >
                {concluida ? <Check size={16} /> : fase}
              </button>
            )
          })}
        </div>

        {podeEditarChecklist && mostrarConfirmacaoEncerramento && procedimento && (
          <div className="mt-4 rounded-xl border border-aurora-red/30 bg-aurora-red-muted/60 p-3">
            <div className="text-sm text-aurora-text-primary">
              Há {procedimento.itensCriticosPendentes} item(ns) obrigatório(s)
              não preenchido(s). Informe o motivo para encerrar mesmo assim:
            </div>
            <div className="mt-3">
              <Textarea
                value={motivoEncerramento}
                onChange={(e) => setMotivoEncerramento(e.target.value)}
                placeholder="Descreva o motivo do encerramento com pendências."
              />
            </div>
            {erroEncerramento && (
              <div className="mt-3 text-sm text-aurora-red">{erroEncerramento}</div>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => void confirmarEncerramentoComPendencias()}
              >
                Encerrar com pendências
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMostrarConfirmacaoEncerramento(false)
                  setErroEncerramento('')
                }}
              >
                Voltar ao checklist
              </Button>
            </div>
          </div>
        )}

        {podeEditarChecklist &&
          !mostrarConfirmacaoEncerramento &&
          erroEncerramento && (
            <div className="mt-4 rounded-xl border border-aurora-red/30 bg-aurora-red-muted/60 p-3 text-sm text-aurora-red">
              {erroEncerramento}
            </div>
          )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!procedimento ? (
          <PageLoader />
        ) : (
          <>
            <div className="mb-4 text-sm font-semibold text-aurora-text-primary">
              Fase {faseAtiva} — {FASES_LABELS[faseAtiva]}
            </div>
            <div className="space-y-3">
              {itensDaFase.map((item) => {
                return (
                  <Card key={item.id} padding="none" className="overflow-hidden">
                    <ItemChecklist
                      item={{
                        ...item,
                        resposta: rascunhos[item.id] ?? item.resposta ?? '',
                      }}
                      onSalvar={salvar}
                      somenteLeitura={!podeEditarChecklist}
                    />
                  </Card>
                )
              })}

              {!itensDaFase.length && (
                <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3 text-sm text-aurora-text-muted">
                  Nenhum item cadastrado nesta fase.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-aurora-border p-4">
        <Button size="sm" variant="ghost" onClick={onVoltar}>
          ← Voltar à pauta
        </Button>
      </div>
    </div>
  )
}
