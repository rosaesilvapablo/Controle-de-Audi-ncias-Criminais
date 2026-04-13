// ──────────────────────────────────────────────────────────
//  Hooks auxiliares: auditoria, procedimentos, usuários,
//  salas, feriados, configurações
// ──────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, deleteDoc,
  Timestamp, getDocs, getDoc, setDoc, limit,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { registrarAcao, registrarEdicao } from '../lib/auditoria'
import {
  normalizarAudiencia,
  normalizarItem,
  normalizarProcedimento,
} from '../lib/normalizarDados'
import { gerarUsuarioPlaceholderId, normalizarEmail } from '../lib/usuarios'
export { useMotivoCancelamento } from './useMotivoCancelamento'
export { useCancelamentoAudiencia } from './useCancelamentoAudiencia'
export { useDuracaoPorTipo, getDuracaoPorTipo } from './useDuracaoPorTipo'
export { useRegrasAgendamento, isDataBloqueada } from './useRegrasAgendamento'
export { useSigilo } from './useSigilo'
export { useAutorizadosSigiloso } from './useAutorizadosSigiloso'
export { useChecklistTemplate } from './useChecklistTemplate'
export { useAuditLog } from './useAuditLog'
export { useRelatorios } from './useRelatorios'
export { useProcesso } from './useProcesso'
export { useProcessos } from './useProcessos'
export { useFilaProcessos } from './useFilaProcessos'
export { useParticipantes } from './useParticipantes'
export type { FiltrosAudit } from './useAuditLog'
export type { FiltrosRelatorio } from './useRelatorios'
import type {
  AuditAcao, Procedimento, ProcedimentoItem,
  ProcedimentoParticipante, ProcedimentoDocumento,
  Usuario, Sala, Feriado, Configuracoes, FaseProcedimento, Audiencia,
} from '../types'

// ══════════════════════════════════════════════════════════
//  AUDITORIA
// ══════════════════════════════════════════════════════════
export async function registrarAuditoria(params: {
  colecao: string
  documentoId: string
  acao: AuditAcao
  antes?: Record<string, unknown>
  depois?: Record<string, unknown>
  usuarioId: string
  usuarioNome: string
}) {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...params,
      criadoEm: Timestamp.now(),
    })
  } catch {
    // Auditoria não deve quebrar fluxo principal
  }
}

function valorComparableAuditoria(valor: unknown): unknown {
  if (valor instanceof Timestamp) return valor.toMillis()
  if (Array.isArray(valor)) return valor.map((item) => valorComparableAuditoria(item))
  if (valor && typeof valor === 'object') {
    if ('seconds' in (valor as Record<string, unknown>) && 'nanoseconds' in (valor as Record<string, unknown>)) {
      const timestamp = valor as { seconds: number; nanoseconds: number }
      return `${timestamp.seconds}:${timestamp.nanoseconds}`
    }

    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        valorComparableAuditoria(item),
      ]),
    )
  }

  return valor
}

function valoresDiferentesAuditoria(valorAnterior: unknown, valorNovo: unknown) {
  return JSON.stringify(valorComparableAuditoria(valorAnterior)) !== JSON.stringify(valorComparableAuditoria(valorNovo))
}

// ══════════════════════════════════════════════════════════
//  PROCEDIMENTOS
// ══════════════════════════════════════════════════════════
export function useProcedimentos() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'procedimentos'), orderBy('criadoEm', 'desc'))
    return onSnapshot(q, (snap) => {
      setProcedimentos(snap.docs.map((d) => normalizarProcedimento(d.id, d.data())))
      setLoading(false)
    })
  }, [])

  return { procedimentos, loading }
}

export function useProcedimentoDetalhe(procedimentoId: string) {
  const [procedimento, setProcedimento] = useState<Procedimento | null>(null)
  const [audiencia, setAudiencia] = useState<Audiencia | null>(null)
  const [itens, setItens]               = useState<ProcedimentoItem[]>([])
  const [participantes, setParticipantes] = useState<ProcedimentoParticipante[]>([])
  const [documentos, setDocumentos]     = useState<ProcedimentoDocumento[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (!procedimentoId) return

    const unsubs = [
      onSnapshot(doc(db, 'procedimentos', procedimentoId), async (snap) => {
        if (snap.exists()) {
          const procedimentoAtual = normalizarProcedimento(snap.id, snap.data())
          setProcedimento(procedimentoAtual)

          if (procedimentoAtual.audienciaId) {
            const audienciaSnap = await getDoc(doc(db, 'audiencias', procedimentoAtual.audienciaId))
            if (audienciaSnap.exists()) {
              setAudiencia(normalizarAudiencia(audienciaSnap.id, audienciaSnap.data()))
            } else {
              setAudiencia(null)
            }
          } else {
            setAudiencia(null)
          }
        } else {
          setProcedimento(null)
          setAudiencia(null)
        }
        setLoading(false)
      }),
      onSnapshot(
        query(
          collection(db, 'procedimento_itens'),
          where('procedimentoId', '==', procedimentoId),
          orderBy('fase'), orderBy('ordem'),
        ),
        (snap) => setItens(snap.docs.map((d) => normalizarItem(d.id, d.data()))),
      ),
      onSnapshot(
        query(collection(db, 'procedimento_participantes'), where('procedimentoId', '==', procedimentoId)),
        (snap) => setParticipantes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProcedimentoParticipante)),
      ),
      onSnapshot(
        query(collection(db, 'procedimento_documentos'), where('procedimentoId', '==', procedimentoId)),
        (snap) => setDocumentos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProcedimentoDocumento)),
      ),
    ]

    return () => unsubs.forEach((u) => u())
  }, [procedimentoId])

  return { procedimento, audiencia, itens, participantes, documentos, loading }
}

// CORREÇÃO: handler agora recebe e salva idsPje (4º parâmetro)
export function useAtualizarItemChecklist() {
  const { usuario } = useAuth()
  const toast = useToast()

  const atualizar = useCallback(
    async (
      itemId: string,
      resposta: string | boolean,
      observacao: string,
      idsPje: string[],          // ← BUG CORRIGIDO: parâmetro não era recebido
      procedimentoId: string,
    ) => {
      if (!usuario) return
      try {
        // Atualizar o item
        await updateDoc(doc(db, 'procedimento_itens', itemId), {
          resposta,
          observacao,
          idsPje,                // ← salvo corretamente
          respondidoEm:  Timestamp.now(),
          respondidoPor: usuario.uid,
        })

        // Recalcular progresso do procedimento
        const itensSnap = await getDocs(
          query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoId)),
        )
        const todosItens = itensSnap.docs.map((d) => normalizarItem(d.id, d.data()))
        const total      = todosItens.length
        const concluidos = todosItens.filter((i) =>
          i.resposta !== undefined && i.resposta !== '' && i.resposta !== null,
        ).length
        const criticosPendentes = todosItens.filter(
          (i) => i.critico && (i.resposta === undefined || i.resposta === ''),
        ).length
        const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0

        await updateDoc(doc(db, 'procedimentos', procedimentoId), {
          progresso,
          totalItens:             total,
          itensConcluidos:        concluidos,
          itensCriticosPendentes: criticosPendentes,
          status:
            criticosPendentes > 0 ? 'com_pendencias_criticas' :
            progresso === 100     ? 'concluido' :
            progresso > 0         ? 'em_andamento' : 'pendente',
          atualizadoEm: Timestamp.now(),
        })
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível salvar o item do checklist. Verifique os dados e tente novamente.')
      }
    },
    [usuario, toast],
  )

  return { atualizar }
}

// ══════════════════════════════════════════════════════════
//  USUÁRIOS
// ══════════════════════════════════════════════════════════
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'usuarios'), orderBy('nome'))
    return onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Usuario)
      )
      setLoading(false)
    })
  }, [])

  return { usuarios, loading }
}

export function useCriarUsuario() {
  const toast = useToast()
  const [salvando, setSalvando] = useState(false)

  const criar = useCallback(async (dados: {
    nome: string
    email: string
    perfil: Usuario['perfil']
  }) => {
    setSalvando(true)
    try {
      const email = normalizarEmail(dados.email)
      const existente = await getDocs(
        query(collection(db, 'usuarios'), where('email', '==', email), limit(1)),
      )
      if (!existente.empty) {
        toast.error('Já existe um usuário cadastrado com este e-mail.')
        return null
      }

      const placeholderId = gerarUsuarioPlaceholderId(email)
      await setDoc(doc(db, 'usuarios', placeholderId), {
        nome: dados.nome,
        email,
        perfil: dados.perfil,
        ativo: true,
        primeiroAcesso: true,
        criadoEm: Timestamp.now(),
      })

      toast.success(`Usuário "${dados.nome}" cadastrado. O primeiro acesso será concluído pelo próprio usuário.`)
      return placeholderId
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/invalid-email': 'E-mail inválido.',
      }
      toast.error(msgs[err.code] ?? 'Não foi possível cadastrar o usuário. Verifique os dados e tente novamente.')
      return null
    } finally {
      setSalvando(false)
    }
  }, [toast])

  return { criar, salvando }
}

export function useEditarUsuario() {
  const toast = useToast()

  const editar = useCallback(async (uid: string, dados: Partial<Usuario>) => {
    try {
      await updateDoc(doc(db, 'usuarios', uid), {
        ...dados,
        atualizadoEm: Timestamp.now(),
      })
      toast.success('Usuário atualizado com sucesso.')
    } catch {
      toast.error('Não foi possível salvar as alterações do usuário. Tente novamente.')
    }
  }, [toast])

  return { editar }
}

// ══════════════════════════════════════════════════════════
//  SALAS
// ══════════════════════════════════════════════════════════
export function useSalas(apenasAtivas = false) {
  const [salas, setSalas] = useState<Sala[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const constraints = apenasAtivas
      ? [where('ativa', '==', true), orderBy('nome')]
      : [orderBy('nome')]
    const q = query(collection(db, 'salas'), ...constraints)
    return onSnapshot(q, (snap) => {
      setSalas(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sala))
      setLoading(false)
    })
  }, [apenasAtivas])

  return { salas, loading }
}

// ══════════════════════════════════════════════════════════
//  FERIADOS
// ══════════════════════════════════════════════════════════
export function useFeriados() {
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [loading, setLoading]   = useState(true)
  const toast = useToast()

  useEffect(() => {
    const q = query(collection(db, 'feriados'), orderBy('data'))
    return onSnapshot(q, (snap) => {
      setFeriados(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Feriado))
      setLoading(false)
    })
  }, [])

  const criar = useCallback(async (dados: Omit<Feriado, 'id' | 'criadoEm'>) => {
    try {
      await addDoc(collection(db, 'feriados'), { ...dados, criadoEm: Timestamp.now() })
      toast.success('Feriado cadastrado com sucesso.')
    } catch { toast.error('Não foi possível cadastrar o feriado. Verifique os campos e tente novamente.') }
  }, [toast])

  const excluir = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'feriados', id))
      toast.success('Feriado excluído com sucesso.')
    } catch { toast.error('Não foi possível excluir o feriado. Tente novamente.') }
  }, [toast])

  return { feriados, loading, criar, excluir }
}

// ══════════════════════════════════════════════════════════
//  CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════
export function useConfiguracoes() {
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    return onSnapshot(doc(db, 'configuracoes', 'sistema'), (snap) => {
      if (snap.exists()) setConfig({ id: snap.id, ...snap.data() } as Configuracoes)
      setLoading(false)
    })
  }, [])

  const salvar = useCallback(async (dados: Partial<Configuracoes>, uid: string) => {
    try {
      await setDoc(doc(db, 'configuracoes', 'sistema'), {
        ...dados,
        atualizadoEm:  Timestamp.now(),
        atualizadoPor: uid,
      }, { merge: true })
      toast.success('Configurações salvas com sucesso.')
    } catch { toast.error('Não foi possível salvar as configurações. Verifique os campos e tente novamente.') }
  }, [toast])

  return { config, loading, salvar }
}
