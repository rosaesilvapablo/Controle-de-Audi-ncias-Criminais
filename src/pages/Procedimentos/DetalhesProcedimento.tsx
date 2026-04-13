// ──────────────────────────────────────────────────────────
//  DetalhesProcedimento — stepper por fases + checklist
//  CORREÇÃO: handler salva idsPje (4º parâmetro)
// ──────────────────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft, Plus, Trash2, UserPlus, FileText,
  Check, AlertTriangle, ChevronDown, ChevronUp, Link, FileDown, User,
} from 'lucide-react'
import {
  collection, addDoc, deleteDoc, doc, getDoc, Timestamp, updateDoc, serverTimestamp,
  getDocs, query, where,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { temPermissao } from '../../lib/permissoes'
import { gerarPdfChecklist } from '../../lib/gerarPdfChecklist'
import { useProcedimentoDetalhe, useSigilo } from '../../hooks/index'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { registrarAcao, registrarEdicao } from '../../lib/auditoria'
import {
  Button, Badge, Card, Modal, Input, Select, Textarea,
  PageLoader, EmptyState, Divider, TrilhaAuditoria,
} from '../../components/ui'
import type {
  ProcedimentoItem, FaseProcedimento, TipoParticipante, TipoDocumento,
} from '../../types'
import {
  FASES_LABELS, TIPO_PARTICIPANTE_LABELS, STATUS_AUDIENCIA_LABELS,
  canEdit, isAdmin, isMagistrado,
} from '../../types'

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

export default function DetalhesProcedimento() {
  const { id: procedimentoId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const toast       = useToast()
  const { estaAutorizado, registrarAcessoSigiloso } = useSigilo()
  const podeGerenciarVinculos = temPermissao(
    usuario?.perfil,
    'gerenciar_participantes_documentos',
  )

  const { procedimento, audiencia, itens, participantes, documentos, loading } =
    useProcedimentoDetalhe(procedimentoId)

  const [faseAberta, setFaseAberta] = useState<FaseProcedimento | null>(1)
  const [modalParticipante, setModalParticipante] = useState(false)
  const [modalDocumento, setModalDocumento]       = useState(false)
  const [novoNome, setNovoNome]                   = useState('')
  const [novoTipo, setNovoTipo]                   = useState<TipoParticipante>('reu')
  const [novoDoc, setNovoDoc]                     = useState('')
  const [novoOab, setNovoOab]                     = useState('')
  const [docNome, setDocNome]                     = useState('')
  const [docTipo, setDocTipo]                     = useState<TipoDocumento>('ata')
  const [docIdPje, setDocIdPje]                   = useState('')
  const [salvando, setSalvando]                   = useState(false)
  const [gerando, setGerando]                     = useState(false)
  const [modalExcluirProcedimento, setModalExcluirProcedimento] = useState(false)
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('')
  const [excluindoProcedimento, setExcluindoProcedimento] = useState(false)
  const usuarioAutorizadoSigilo = Boolean(
    usuario && estaAutorizado(usuario.uid, usuario.perfil),
  )
  const podeEditarResponsavel = Boolean(
    usuario &&
    (
      canEdit(usuario.perfil) ||
      (isMagistrado(usuario.perfil) && audiencia?.magistradoId === usuario.uid)
    )
  )

  useEffect(() => {
    if (audiencia?.sigiloso !== true || !usuario || !usuarioAutorizadoSigilo) return

    const chaveSessao = `sigilo:procedimentos:${procedimentoId}`
    if (sessionStorage.getItem(chaveSessao)) return

    sessionStorage.setItem(chaveSessao, '1')
    void registrarAcessoSigiloso({
      colecao: 'procedimentos',
      documentId: procedimentoId,
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
    })
  }, [
    audiencia?.sigiloso,
    procedimentoId,
    registrarAcessoSigiloso,
    usuario,
    usuarioAutorizadoSigilo,
  ])

  // ── Itens agrupados por fase ───────────────────────────────
  const fases = ([1, 2, 3, 4, 5] as FaseProcedimento[]).map((fase) => ({
    fase,
    label: FASES_LABELS[fase],
    itens: itens.filter((i) => i.fase === fase),
    concluidos: itens.filter((i) => i.fase === fase && i.resposta !== undefined && i.resposta !== '').length,
    criticos:   itens.filter((i) => i.fase === fase && i.critico && (!i.resposta || i.resposta === '')).length,
  }))

  // ── Salvar resposta do item (CORRIGIDO: recebe e repassa idsPje) ──
  const handleSalvarItem = useCallback(
    async (
      itemId: string,
      resposta: string | boolean,
      observacao: string,
      idsPje: string[],           // ← parâmetro não se perde mais
    ) => {
      if (!usuario || !procedimento) return

      const itemRef = doc(db, 'procedimento_itens', itemId)
      const itemAntesSnap = await getDoc(itemRef)
      const itemAntes = itemAntesSnap.exists()
        ? (itemAntesSnap.data() as Record<string, unknown>)
        : {}
      const itemAtual = itens.find((item) => item.id === itemId)
      const concluidoAntes =
        itemAntes.resposta !== undefined &&
        itemAntes.resposta !== '' &&
        itemAntes.resposta !== null
      const concluidoDepois =
        resposta !== undefined && resposta !== '' && resposta !== null

      await updateDoc(itemRef, {
        resposta,
        observacao,
        idsPje,
        respondidoEm: Timestamp.now(),
        respondidoPor: usuario.uid,
        editadoEm: Timestamp.now(),
        editadoPor: usuario.uid,
      })

      await Promise.all(
        [
          ['resposta', itemAntes.resposta, resposta],
          ['observacao', itemAntes.observacao ?? '', observacao],
          ['idsPje', itemAntes.idsPje ?? [], idsPje],
        ]
          .filter(([, valorAnterior, valorNovo]) => valoresDiferentes(valorAnterior, valorNovo))
          .map(([campo, valorAnterior, valorNovo]) =>
            registrarEdicao({
              colecao: 'procedimento_itens',
              documentId: itemId,
              campo: String(campo),
              valorAnterior,
              valorNovo,
              usuarioUid: usuario.uid,
              usuarioNome: usuario.nome,
            }),
          ),
      )

      if (concluidoAntes !== concluidoDepois && itemAtual) {
        await registrarAcao({
          tipo: concluidoDepois ? 'checklist_concluido' : 'checklist_desmarcado',
          dados: {
            procedimentoId,
            itemId,
            tituloItem: itemAtual.descricao,
            fase: itemAtual.fase,
            documentId: itemId,
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }

      const itensAtualizados = itens.map((item) =>
        item.id === itemId ? { ...item, resposta, observacao, idsPje } : item,
      )
      const total = itensAtualizados.length
      const concluidos = itensAtualizados.filter((item) =>
        item.resposta !== undefined && item.resposta !== '' && item.resposta !== null,
      ).length
      const criticosPendentes = itensAtualizados.filter((item) =>
        item.critico && (item.resposta === undefined || item.resposta === '' || item.resposta === null),
      ).length
      const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0
      const status =
        criticosPendentes > 0 ? 'com_pendencias_criticas' :
        progresso === 100 ? 'concluido' :
        progresso > 0 ? 'em_andamento' : 'pendente'

      await updateDoc(doc(db, 'procedimentos', procedimentoId), {
        progresso,
        totalItens: total,
        itensConcluidos: concluidos,
        itensCriticosPendentes: criticosPendentes,
        status,
        atualizadoEm: Timestamp.now(),
        editadoEm: Timestamp.now(),
        editadoPor: usuario.uid,
      })
    },
    [itens, procedimento, procedimentoId, usuario],
  )

  // ── Adicionar participante ────────────────────────────────
  const adicionarParticipante = async () => {
    if (!novoNome.trim() || !usuario) return
    setSalvando(true)
    try {
      await addDoc(collection(db, 'procedimento_participantes'), {
        procedimentoId,
        nome:      novoNome.trim(),
        tipo:      novoTipo,
        documento: novoDoc.trim() || undefined,
        oab:       novoOab.trim() || undefined,
        presente:  false,
        criadoEm:  Timestamp.now(),
      })
      toast.success('Participante adicionado com sucesso.')
      setNovoNome(''); setNovoDoc(''); setNovoOab('')
      setModalParticipante(false)
    } catch { toast.error('Não foi possível adicionar o participante. Verifique os campos e tente novamente.') }
    finally { setSalvando(false) }
  }

  const excluirParticipante = async (id: string) => {
    await deleteDoc(doc(db, 'procedimento_participantes', id))
    toast.success('Participante excluído com sucesso.')
  }

  // ── Adicionar documento PJe ────────────────────────────────
  const adicionarDocumento = async () => {
    if (!docNome.trim() || !docIdPje.trim() || !usuario) return
    setSalvando(true)
    try {
      await addDoc(collection(db, 'procedimento_documentos'), {
        procedimentoId,
        nome:      docNome.trim(),
        tipo:      docTipo,
        idPje:     docIdPje.trim(),
        criadoEm:  Timestamp.now(),
        criadoPor: usuario.uid,
      })
      toast.success('Documento vinculado com sucesso.')
      setDocNome(''); setDocIdPje('')
      setModalDocumento(false)
    } catch { toast.error('Não foi possível vincular o documento. Verifique os campos e tente novamente.') }
    finally { setSalvando(false) }
  }

  const excluirDocumento = async (id: string) => {
    await deleteDoc(doc(db, 'procedimento_documentos', id))
    toast.success('Documento excluído com sucesso.')
  }

  const exportarPdf = async () => {
    if (!procedimento || !audiencia) return
    setGerando(true)
    try {
      await gerarPdfChecklist(procedimento, audiencia, itens, participantes, documentos)
      await registrarAcao({
        tipo: 'editar',
        dados: {
          colecao: 'procedimentos',
          documentId: procedimentoId,
          documentoId: procedimentoId,
          acao: 'editar',
          depois: { observacoes: 'Checklist exportado em PDF' },
        },
        usuarioUid: usuario?.uid ?? '',
        usuarioNome: usuario?.nome ?? '',
      })
      toast.success('PDF gerado e salvo com sucesso.')
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  const abrirExclusaoProcedimento = () => {
    if (!usuario || !isAdmin(usuario.perfil) || !procedimento) return
    setConfirmacaoExclusao('')
    setModalExcluirProcedimento(true)
  }

  const confirmarExclusaoProcedimento = async () => {
    if (!usuario || !procedimento) return
    if (!isAdmin(usuario.perfil)) return

    if (confirmacaoExclusao !== procedimento.numeroProcesso) {
      toast.warning('Digite o numero do processo exatamente como exibido para confirmar.')
      return
    }

    setExcluindoProcedimento(true)
    try {
      await registrarAcao({
        tipo: 'exclusao',
        dados: {
          colecao: 'procedimentos',
          documentId: procedimentoId,
          documentoId: procedimentoId,
          numeroProcesso: procedimento.numeroProcesso,
        },
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })

      const [itensSnap, participantesSnap, documentosSnap] = await Promise.all([
        getDocs(query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoId))),
        getDocs(query(collection(db, 'procedimento_participantes'), where('procedimentoId', '==', procedimentoId))),
        getDocs(query(collection(db, 'procedimento_documentos'), where('procedimentoId', '==', procedimentoId))),
      ])

      await Promise.all(itensSnap.docs.map((item) => deleteDoc(item.ref)))
      await Promise.all(participantesSnap.docs.map((item) => deleteDoc(item.ref)))
      await Promise.all(documentosSnap.docs.map((item) => deleteDoc(item.ref)))
      await deleteDoc(doc(db, 'procedimentos', procedimentoId))

      toast.success(`Processo ${procedimento.numeroProcesso} excluido permanentemente.`)
      navigate(-1)
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : 'Falha desconhecida.'
      toast.error(`Nao foi possivel excluir permanentemente. ${detalhe}`)
    } finally {
      setExcluindoProcedimento(false)
    }
  }

  if (loading) return <PageLoader />
  if (!procedimento) return (
    <EmptyState title="Procedimento não encontrado" icon={<FileText size={24} />} />
  )

  if (audiencia?.sigiloso && !usuarioAutorizadoSigilo) {
    return (
      <EmptyState
        title="Processo sigiloso"
        description="Este procedimento esta oculto para o seu perfil."
        icon={<AlertTriangle size={24} />}
      />
    )
  }

  const progresso = procedimento.progresso ?? 0

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={<ChevronLeft size={14} />} onClick={() => navigate(-1)}>
          Voltar
        </Button>
        {usuario && isAdmin(usuario.perfil) && (
          <Button
            variant="danger"
            size="sm"
            icon={<Trash2 size={14} />}
            title="Excluir permanentemente"
            onClick={abrirExclusaoProcedimento}
          >
            Excluir permanentemente
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={<FileDown size={14} />}
          loading={gerando}
          onClick={exportarPdf}
          disabled={!procedimento || !audiencia}
        >
          Exportar checklist em PDF
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-medium text-aurora-text-primary">
            Processo {procedimento.numeroProcesso}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge statusProcedimento={procedimento.status}
              pulse={procedimento.status === 'com_pendencias_criticas'}
            >
              {procedimento.status === 'com_pendencias_criticas' && '⚠ '}
              {procedimento.status.replace(/_/g, ' ')}
            </Badge>
            {audiencia?.sigiloso && <Badge variant="danger">Sigiloso</Badge>}
            <span className="text-2xs text-aurora-text-muted">
              {procedimento.itensConcluidos}/{procedimento.totalItens} itens
            </span>
          </div>
        </div>
      </div>

      {/* ── Progresso global ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-aurora-text-primary">Progresso geral</span>
          <span className="text-sm font-medium text-aurora-text-primary">{progresso}%</span>
        </div>
        <div className="h-2 bg-aurora-elevated rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progresso}%`,
              background: progresso === 100 ? '#1D9E75'
                : procedimento.itensCriticosPendentes > 0 ? '#E24B4A'
                : '#534AB7',
            }}
          />
        </div>
        {procedimento.itensCriticosPendentes > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertTriangle size={12} className="text-aurora-red" />
            <span className="text-xs text-aurora-red">
              {procedimento.itensCriticosPendentes} {procedimento.itensCriticosPendentes === 1 ? 'item obrigatório pendente' : 'itens obrigatórios pendentes'}
            </span>
          </div>
        )}

        {/* Stepper visual das 5 fases */}
        <div className="flex items-center gap-1 mt-5">
          {fases.map((f, idx) => {
            const done     = f.itens.length > 0 && f.concluidos === f.itens.length
            const partial  = f.concluidos > 0 && !done
            const hasCrit  = f.criticos > 0
            const color    = hasCrit ? '#E24B4A' : done ? '#1D9E75' : partial ? '#EF9F27' : '#1E1E45'

            return (
              <div key={f.fase} className="flex items-center flex-1">
                <button
                  onClick={() => setFaseAberta(faseAberta === f.fase ? null : f.fase)}
                  className="flex flex-col items-center gap-1 group"
                  title={f.label}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200"
                    style={{
                      background: color,
                      color:      '#fff',
                      boxShadow:  faseAberta === f.fase ? `0 0 0 3px ${color}40` : 'none',
                    }}
                  >
                    {done ? <Check size={14} /> : hasCrit ? '!' : f.fase}
                  </div>
                  <span className="text-2xs text-aurora-text-muted group-hover:text-aurora-text-secondary transition-colors hidden sm:block">
                    {f.label.split('-')[0]}
                  </span>
                </button>
                {idx < 4 && (
                  <div
                    className="flex-1 h-0.5 mx-1 rounded-full transition-all duration-300"
                    style={{ background: done ? '#1D9E75' : '#1E1E45' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Checklist por fase ── */}
      <div className="flex flex-col gap-2">
        {fases.map((f) => (
          <Card key={f.fase} padding="none" className="overflow-hidden">
            {/* Cabeçalho da fase */}
            <button
              onClick={() => setFaseAberta(faseAberta === f.fase ? null : f.fase)}
              className="
                w-full flex items-center gap-3 px-4 py-3
                hover:bg-aurora-elevated transition-colors text-left
              "
            >
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-medium text-aurora-text-primary">
                  Fase {f.fase} — {f.label}
                </span>
                {f.criticos > 0 && (
                  <Badge variant="danger" pulse className="text-2xs">
                    <AlertTriangle size={10} /> {f.criticos} obrigatório{f.criticos > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-aurora-text-muted">
                {f.concluidos}/{f.itens.length}
              </span>
              {faseAberta === f.fase ? <ChevronUp size={14} className="text-aurora-text-muted" /> : <ChevronDown size={14} className="text-aurora-text-muted" />}
            </button>

            {/* Itens */}
            {faseAberta === f.fase && (
              <div className="border-t border-aurora-border">
                {f.itens.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-aurora-text-muted">Nenhum item nesta fase.</p>
                ) : (
                  f.itens.map((item) => (
                    <ItemChecklist
                      key={item.id}
                      item={item}
                      onSalvar={handleSalvarItem}
                      podeEditarResponsavel={podeEditarResponsavel}
                    />
                  ))
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* ── Participantes ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-aurora-text-primary">Participantes</h3>
          {podeGerenciarVinculos && (
            <Button size="xs" variant="secondary" icon={<UserPlus size={12} />} onClick={() => setModalParticipante(true)}>
              Adicionar
            </Button>
          )}
        </div>
        {participantes.length === 0 ? (
          <p className="text-xs text-aurora-text-muted">Nenhum participante cadastrado. Adicione os envolvidos para acompanhar a audiência.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {participantes.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-aurora-border last:border-0">
                <div className="w-7 h-7 rounded-full bg-aurora-primary-muted flex items-center justify-center shrink-0">
                  <span className="text-2xs font-medium text-aurora-primary-light">
                    {p.nome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-aurora-text-primary truncate">{p.nome}</p>
                  <p className="text-2xs text-aurora-text-muted">{TIPO_PARTICIPANTE_LABELS[p.tipo]}</p>
                </div>
                {podeGerenciarVinculos && (
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Trash2 size={11} />}
                    onClick={() => excluirParticipante(p.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Documentos PJe ── */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-aurora-text-primary">Documentos PJe</h3>
          {podeGerenciarVinculos && (
            <Button size="xs" variant="secondary" icon={<Plus size={12} />} onClick={() => setModalDocumento(true)}>
              Vincular
            </Button>
          )}
        </div>
        {documentos.length === 0 ? (
          <p className="text-xs text-aurora-text-muted">Nenhum documento vinculado. Cadastre as identificações das peças para consulta rápida.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {documentos.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-aurora-border last:border-0">
                <FileText size={14} className="text-aurora-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-aurora-text-primary truncate">{d.nome}</p>
                  <p className="text-2xs text-aurora-text-muted font-mono">{d.idPje}</p>
                </div>
                {podeGerenciarVinculos && (
                  <Button size="xs" variant="ghost" icon={<Trash2 size={11} />} onClick={() => excluirDocumento(d.id)} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padding="md">
        <h3 className="mb-3 text-sm font-medium text-aurora-text-primary">
          Histórico do procedimento
        </h3>
        <TrilhaAuditoria
          colecao="procedimentos"
          documentoId={procedimentoId}
          maxItens={10}
        />
      </Card>

      {/* Modais */}
      <Modal open={podeGerenciarVinculos && modalParticipante} onClose={() => setModalParticipante(false)} title="Adicionar participante" size="sm"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setModalParticipante(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={salvando} onClick={adicionarParticipante} disabled={!novoNome.trim()}>Adicionar</Button>
        </>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nome completo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Informe o nome completo" />
          <Select label="Tipo" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoParticipante)}>
            {Object.entries(TIPO_PARTICIPANTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="CPF/RG (opcional)" value={novoDoc} onChange={(e) => setNovoDoc(e.target.value)} />
          <Input label="OAB (se advogado)" value={novoOab} onChange={(e) => setNovoOab(e.target.value)} />
        </div>
      </Modal>

      <Modal open={podeGerenciarVinculos && modalDocumento} onClose={() => setModalDocumento(false)} title="Vincular documento PJe" size="sm"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setModalDocumento(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={salvando} onClick={adicionarDocumento} disabled={!docNome.trim() || !docIdPje.trim()}>Vincular</Button>
        </>}
      >
        <div className="flex flex-col gap-3">
          <Input label="Nome do documento" value={docNome} onChange={(e) => setDocNome(e.target.value)} />
          <Select label="Tipo" value={docTipo} onChange={(e) => setDocTipo(e.target.value as TipoDocumento)}>
            {(['ata','termo','despacho','sentenca','oficio','outro'] as TipoDocumento[]).map((t) =>
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            )}
          </Select>
          <Input label="Identificação no PJe" value={docIdPje} onChange={(e) => setDocIdPje(e.target.value)} placeholder="Informe a identificação no PJe" iconLeft={<Link size={13} />} />
        </div>
      </Modal>

      <Modal
        open={modalExcluirProcedimento && !!procedimento && !!usuario && isAdmin(usuario.perfil)}
        onClose={() => {
          setModalExcluirProcedimento(false)
          setConfirmacaoExclusao('')
        }}
        title="Excluir permanentemente?"
        size="md"
        footer={<>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setModalExcluirProcedimento(false)
              setConfirmacaoExclusao('')
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={excluindoProcedimento}
            disabled={confirmacaoExclusao !== (procedimento?.numeroProcesso ?? '')}
            onClick={() => void confirmarExclusaoProcedimento()}
          >
            Confirmar exclusao
          </Button>
        </>}
      >
        {procedimento && (
          <div className="space-y-4">
            <div className="rounded-xl border border-aurora-red/30 bg-aurora-red-muted/20 p-4 text-sm text-aurora-text-secondary">
              <p>
                Esta acao e irreversivel. Todos os dados vinculados serao removidos:
                procedimentos, checklist, participantes e documentos.
              </p>
              <p className="mt-3">Para confirmar, digite o numero do processo:</p>
              <p className="mt-2 font-mono text-xs text-aurora-text-muted">
                {procedimento.numeroProcesso}
              </p>
            </div>
            <Input
              label="Numero do processo"
              value={confirmacaoExclusao}
              onChange={(event) => setConfirmacaoExclusao(event.target.value)}
              placeholder="Digite exatamente o numero do processo"
              className="font-mono"
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  Item do Checklist — com campo idsPje corrigido
// ══════════════════════════════════════════════════════════
interface ItemChecklistProps {
  item: ProcedimentoItem
  onSalvar: (itemId: string, resposta: string | boolean, observacao: string, idsPje: string[]) => Promise<void>
  podeEditarResponsavel: boolean
}

function ItemChecklist({ item, onSalvar, podeEditarResponsavel }: ItemChecklistProps) {
  const { usuario } = useAuth()
  const toast = useToast()
  const [editando, setEditando]   = useState(false)
  const [resposta, setResposta]   = useState<string | boolean>(item.resposta ?? '')
  const [obs, setObs]             = useState(item.observacao ?? '')
  const [pjeInput, setPjeInput]   = useState('')
  const [idsPje, setIdsPje]       = useState<string[]>(item.idsPje ?? [])
  const [salvando, setSalvando]   = useState(false)
  const [editandoResponsavel, setEditandoResponsavel] = useState(false)
  const [responsavelDraft, setResponsavelDraft] = useState(item.responsavel ?? '')
  const [salvandoResponsavel, setSalvandoResponsavel] = useState(false)

  const respondido = item.resposta !== undefined && item.resposta !== '' && item.resposta !== null

  useEffect(() => {
    if (!editandoResponsavel) {
      setResponsavelDraft(item.responsavel ?? '')
    }
  }, [editandoResponsavel, item.responsavel])

  const salvar = async () => {
    setSalvando(true)
    await onSalvar(item.id, resposta, obs, idsPje)
    setSalvando(false)
    setEditando(false)
  }

  const salvarResponsavel = async () => {
    if (!usuario) return

    const valorAnterior = item.responsavel ?? ''
    const valorNovo = responsavelDraft.trim()

    if (valorAnterior === valorNovo) {
      setEditandoResponsavel(false)
      return
    }

    setSalvandoResponsavel(true)
    try {
      await updateDoc(doc(db, 'procedimento_itens', item.id), {
        responsavel: valorNovo,
        editadoEm: serverTimestamp(),
        editadoPor: usuario.nome,
      })

      await registrarEdicao({
        colecao: 'procedimento_itens',
        documentId: item.id,
        campo: 'responsavel',
        valorAnterior,
        valorNovo,
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })

      toast.success('Responsavel atualizado.')
      setEditandoResponsavel(false)
    } catch {
      toast.error('Nao foi possivel atualizar o responsavel.')
    } finally {
      setSalvandoResponsavel(false)
    }
  }

  const adicionarPje = () => {
    if (!pjeInput.trim()) return
    setIdsPje((ids) => [...ids, pjeInput.trim()])
    setPjeInput('')
  }

  return (
    <div className={`border-b border-aurora-border last:border-0 ${item.critico && !respondido ? 'bg-aurora-red-muted/20' : ''}`}>
      <button
        onClick={() => setEditando((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-aurora-elevated/50 transition-colors"
      >
        <div
          className={`
            w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5
            transition-all duration-200
            ${respondido
              ? 'bg-aurora-green border-aurora-green'
              : item.critico
              ? 'border-aurora-red'
              : 'border-aurora-border'
            }
          `}
        >
          {respondido && <Check size={10} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${respondido ? 'text-aurora-text-muted line-through' : 'text-aurora-text-primary'}`}>
              {item.descricao}
            </span>
            {item.critico && (
              <span className="text-2xs text-aurora-red font-medium shrink-0">obrigatório</span>
            )}
          </div>
          <div className="mt-1">
            {editandoResponsavel ? (
              <Input
                value={responsavelDraft}
                placeholder="Defina o responsavel"
                disabled={salvandoResponsavel}
                autoFocus
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setResponsavelDraft(event.target.value)}
                onBlur={() => void salvarResponsavel()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void salvarResponsavel()
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setResponsavelDraft(item.responsavel ?? '')
                    setEditandoResponsavel(false)
                  }
                }}
              />
            ) : item.responsavel?.trim() ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-2xs text-aurora-text-muted hover:text-aurora-text-secondary"
                disabled={!podeEditarResponsavel}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!podeEditarResponsavel) return
                  setEditandoResponsavel(true)
                }}
              >
                <User size={11} />
                <span>{item.responsavel}</span>
              </button>
            ) : podeEditarResponsavel ? (
              <button
                type="button"
                className="text-2xs text-aurora-text-muted transition-colors hover:text-aurora-text-secondary"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setEditandoResponsavel(true)
                }}
              >
                + Designar responsavel
              </button>
            ) : null}
          </div>
          {respondido && item.observacao && (
            <p className="text-2xs text-aurora-text-muted mt-0.5 truncate">{item.observacao}</p>
          )}
        </div>
        {editando ? <ChevronUp size={13} className="text-aurora-text-muted shrink-0" /> : <ChevronDown size={13} className="text-aurora-text-muted shrink-0" />}
      </button>

      {editando && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {item.tipoResposta === 'sim_nao' ? (
            <div className="flex gap-2">
              {['Sim', 'Não', 'Não se aplica'].map((op) => (
                <button
                  key={op}
                  onClick={() => setResposta(op)}
                  className={`
                    px-3 h-7 rounded-lg text-xs font-medium border transition-all
                    ${resposta === op
                      ? 'bg-aurora-primary text-white border-aurora-primary'
                      : 'bg-aurora-elevated text-aurora-text-secondary border-aurora-border hover:border-aurora-border-light'
                    }
                  `}
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

          {/* IDs PJe — campo corrigido */}
          <div className="flex flex-col gap-1">
            <span className="text-2xs text-aurora-text-muted">Identificações do PJe vinculadas</span>
            {idsPje.map((id, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-2xs font-mono text-aurora-text-secondary bg-aurora-elevated px-2 py-1 rounded">{id}</span>
                <button onClick={() => setIdsPje((ids) => ids.filter((_, j) => j !== i))} className="text-aurora-red text-xs">✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="Informe a identificação no PJe"
                value={pjeInput}
                onChange={(e) => setPjeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionarPje()}
              />
              <Button size="sm" variant="secondary" onClick={adicionarPje}>+</Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button size="xs" variant="ghost" onClick={() => setEditando(false)}>Cancelar</Button>
            <Button size="xs" variant="primary" loading={salvando} onClick={salvar}>Salvar alterações</Button>
          </div>
        </div>
      )}
    </div>
  )
}
