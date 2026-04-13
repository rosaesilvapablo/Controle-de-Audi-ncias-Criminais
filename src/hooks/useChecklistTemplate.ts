import { useCallback, useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { registrarAcao } from '../lib/auditoria'
import type { ChecklistTemplate, ItemTemplate } from '../types'

function normalizarItemTemplate(item: unknown): ItemTemplate | null {
  if (!item || typeof item !== 'object') return null

  const dados = item as Record<string, unknown>
  const titulo = String(dados.titulo ?? '').trim()
  const fase = Math.min(5, Math.max(1, Number(dados.fase ?? 1)))

  return {
    ordem: Math.max(1, Number(dados.ordem ?? 1)),
    titulo,
    fase,
    critico: Boolean(dados.critico ?? false),
    responsavelSugerido: String(dados.responsavelSugerido ?? '').trim() || undefined,
  }
}

function normalizarItens(itens: unknown): ItemTemplate[] {
  if (!Array.isArray(itens)) return []

  return itens
    .map((item) => normalizarItemTemplate(item))
    .filter((item): item is ItemTemplate => Boolean(item))
    .sort((a, b) => (a.fase - b.fase) || (a.ordem - b.ordem))
}

function normalizarTemplate(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): ChecklistTemplate {
  const dados = snapshot.data()

  return {
    id: snapshot.id,
    versao: Number(dados.versao ?? 1),
    ativa: Boolean(dados.ativa ?? false),
    criadaEm: dados.criadaEm,
    criadaPor: String(dados.criadaPor ?? ''),
    criadaPorUid: String(dados.criadaPorUid ?? ''),
    itens: normalizarItens(dados.itens),
  } as ChecklistTemplate
}

function normalizarItensParaSalvar(itens: ItemTemplate[]): ItemTemplate[] {
  const porFase = new Map<number, ItemTemplate[]>()

  for (const item of itens) {
    const fase = Math.min(5, Math.max(1, Number(item.fase ?? 1)))
    const lista = porFase.get(fase) ?? []
    lista.push({
      ordem: 1,
      titulo: String(item.titulo ?? '').trim(),
      fase,
      critico: Boolean(item.critico),
      responsavelSugerido: String(item.responsavelSugerido ?? '').trim() || undefined,
    })
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

export async function buscarTemplateAtivoChecklist(): Promise<ChecklistTemplate | null> {
  const snapshot = await getDocs(
    query(
      collection(db, 'checklist_templates'),
      where('ativa', '==', true),
      limit(1),
    ),
  )

  if (snapshot.empty) return null
  return normalizarTemplate(snapshot.docs[0])
}

export async function buscarHistoricoChecklist(): Promise<ChecklistTemplate[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'checklist_templates'),
      orderBy('versao', 'desc'),
    ),
  )

  return snapshot.docs.map((item) => normalizarTemplate(item))
}

export async function salvarNovaVersaoChecklist(
  itens: ItemTemplate[],
  params: {
    usuarioUid: string
    usuarioNome: string
  },
): Promise<number> {
  const itensNormalizados = normalizarItensParaSalvar(itens)
  const templateAtivo = await buscarTemplateAtivoChecklist()
  const historico = await buscarHistoricoChecklist()
  const versaoBase = templateAtivo?.versao ?? historico[0]?.versao ?? 0
  const novaVersao = versaoBase + 1

  if (templateAtivo) {
    await updateDoc(doc(db, 'checklist_templates', templateAtivo.id), {
      ativa: false,
    })
  }

  await addDoc(collection(db, 'checklist_templates'), {
    versao: novaVersao,
    ativa: true,
    criadaEm: serverTimestamp(),
    criadaPor: params.usuarioNome,
    criadaPorUid: params.usuarioUid,
    itens: itensNormalizados,
  })

  await registrarAcao({
    tipo: 'checklist_nova_versao',
    dados: {
      versao: novaVersao,
      totalItens: itensNormalizados.length,
    },
    usuarioUid: params.usuarioUid,
    usuarioNome: params.usuarioNome,
  })

  return novaVersao
}

export async function gerarSnapshotParaProcedimentoChecklist(
  procedimentoId: string,
  versao: number,
  itens: ItemTemplate[],
  params: {
    usuarioUid: string
    usuarioNome: string
  },
): Promise<void> {
  const itensNormalizados = normalizarItensParaSalvar(itens)
  const batch = writeBatch(db)
  const totalCriticos = itensNormalizados.filter((item) => item.critico).length

  for (const item of itensNormalizados) {
    const itemRef = doc(collection(db, 'procedimento_itens'))
    batch.set(itemRef, {
      procedimentoId,
      ordem: item.ordem,
      titulo: item.titulo,
      descricao: item.titulo,
      fase: item.fase,
      critico: item.critico,
      obrigatorio: item.critico,
      responsavel: item.responsavelSugerido ?? '',
      tipoResposta: 'sim_nao',
      resetarNaRemarcacao: false,
      concluido: false,
      criadoEm: serverTimestamp(),
    })
  }

  batch.update(doc(db, 'procedimentos', procedimentoId), {
    templateVersao: versao,
    totalItens: itensNormalizados.length,
    itensConcluidos: 0,
    itensCriticosPendentes: totalCriticos,
    progresso: 0,
    atualizadoEm: serverTimestamp(),
    editadoEm: serverTimestamp(),
    editadoPor: params.usuarioUid,
  })

  await batch.commit()
}

export function useChecklistTemplate() {
  const [templateAtivo, setTemplateAtivo] = useState<ChecklistTemplate | null>(null)
  const [historico, setHistorico] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const carregarDados = useCallback(async () => {
    setLoading(true)

    try {
      const [ativo, lista] = await Promise.all([
        buscarTemplateAtivoChecklist(),
        buscarHistoricoChecklist(),
      ])
      setTemplateAtivo(ativo)
      setHistorico(lista)
      return { ativo, lista }
    } finally {
      setLoading(false)
    }
  }, [])

  const buscarTemplateAtivo = useCallback(async () => {
    const ativo = await buscarTemplateAtivoChecklist()
    setTemplateAtivo(ativo)
    return ativo
  }, [])

  const buscarHistorico = useCallback(async () => {
    const lista = await buscarHistoricoChecklist()
    setHistorico(lista)
    return lista
  }, [])

  const salvarNovaVersao = useCallback(async (
    itens: ItemTemplate[],
    params: {
      usuarioUid: string
      usuarioNome: string
    },
  ) => {
    setSalvando(true)

    try {
      const versao = await salvarNovaVersaoChecklist(itens, params)
      await carregarDados()
      return versao
    } finally {
      setSalvando(false)
    }
  }, [carregarDados])

  const gerarSnapshotParaProcedimento = useCallback(async (
    procedimentoId: string,
    versao: number,
    itens: ItemTemplate[],
    params: {
      usuarioUid: string
      usuarioNome: string
    },
  ) => {
    await gerarSnapshotParaProcedimentoChecklist(procedimentoId, versao, itens, params)
  }, [])

  useEffect(() => {
    void carregarDados()
  }, [carregarDados])

  return {
    templateAtivo,
    historico,
    loading,
    salvando,
    buscarTemplateAtivo,
    buscarHistorico,
    salvarNovaVersao,
    gerarSnapshotParaProcedimento,
  }
}
