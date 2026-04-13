import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type {
  Fase1,
  Fase2,
  Fase3,
  Intimacao,
  ModeloDocumento,
  Participante,
  Processo,
} from '../types/core'

export const COLECOES = {
  PROCESSOS: 'processos',
  USUARIOS: 'usuarios',
  MODELOS_DOCUMENTOS: 'modelos_documentos',
  CONFIGURACOES: 'configuracoes',
} as const

export const SUBCOLECOES = {
  FASE1: 'fase1',
  FASE2: 'fase2',
  FASE3: 'fase3',
  PARTICIPANTES: 'participantes',
  INTIMACOES: 'intimacoes',
  DOCUMENTOS: 'documentos',
  AUDITORIA: 'auditoria',
} as const

export function refProcessos(): CollectionReference<Processo> {
  return collection(db, COLECOES.PROCESSOS) as CollectionReference<Processo>
}

export function refProcesso(id: string): DocumentReference<Processo> {
  return doc(db, COLECOES.PROCESSOS, id) as DocumentReference<Processo>
}

export function refFase1(processoId: string): DocumentReference<Fase1> {
  return doc(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.FASE1,
    SUBCOLECOES.FASE1,
  ) as DocumentReference<Fase1>
}

export function refFase2(processoId: string): DocumentReference<Fase2> {
  return doc(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.FASE2,
    SUBCOLECOES.FASE2,
  ) as DocumentReference<Fase2>
}

export function refFase3(processoId: string): DocumentReference<Fase3> {
  return doc(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.FASE3,
    SUBCOLECOES.FASE3,
  ) as DocumentReference<Fase3>
}

export function refParticipantes(
  processoId: string,
): CollectionReference<Participante> {
  return collection(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.PARTICIPANTES,
  ) as CollectionReference<Participante>
}

export function refParticipante(
  processoId: string,
  participanteId: string,
): DocumentReference<Participante> {
  return doc(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.PARTICIPANTES,
    participanteId,
  ) as DocumentReference<Participante>
}

export function refIntimacoes(
  processoId: string,
): CollectionReference<Intimacao> {
  return collection(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.INTIMACOES,
  ) as CollectionReference<Intimacao>
}

export function refIntimacao(
  processoId: string,
  intimacaoId: string,
): DocumentReference<Intimacao> {
  return doc(
    db,
    COLECOES.PROCESSOS,
    processoId,
    SUBCOLECOES.INTIMACOES,
    intimacaoId,
  ) as DocumentReference<Intimacao>
}

export function refModelosDocumentos(): CollectionReference<ModeloDocumento> {
  return collection(
    db,
    COLECOES.MODELOS_DOCUMENTOS,
  ) as CollectionReference<ModeloDocumento>
}

// ─── COLEÇÕES LEGADAS — manter até migração completa ───
// Não usar em código novo. Apenas para suporte ao script de migração.
export const COLECOES_LEGADAS = {
  PROCESSOS_PENDENTES: 'processos_pendentes',
  AUDIENCIAS: 'audiencias',
  PROCEDIMENTOS: 'procedimentos',
} as const
