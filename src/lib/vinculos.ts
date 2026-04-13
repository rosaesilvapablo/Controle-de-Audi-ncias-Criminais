import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  doc,
  Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export async function verificarVinculosAudiencia(
  audienciaId: string,
): Promise<{
  temProcedimento: boolean
  procedimentoId: string | null
  temProcessoPendente: boolean
  processoPendenteId: string | null
}> {
  const [snapProc, snapPend] = await Promise.all([
    getDocs(query(
      collection(db, 'procedimentos'),
      where('audienciaId', '==', audienciaId),
    )),
    getDocs(query(
      collection(db, 'processos_pendentes'),
      where('audienciaId', '==', audienciaId),
    )),
  ])

  return {
    temProcedimento: !snapProc.empty,
    procedimentoId: snapProc.empty ? null : snapProc.docs[0].id,
    temProcessoPendente: !snapPend.empty,
    processoPendenteId: snapPend.empty ? null : snapPend.docs[0].id,
  }
}

export async function garantirProcedimentoVinculado(
  audienciaId: string,
  numeroProcesso: string,
  criadoPor: string,
): Promise<string> {
  const snap = await getDocs(query(
    collection(db, 'procedimentos'),
    where('audienciaId', '==', audienciaId),
  ))

  if (!snap.empty) return snap.docs[0].id

  const ref = await addDoc(collection(db, 'procedimentos'), {
    audienciaId,
    numeroProcesso,
    status: 'pendente',
    progresso: 0,
    totalItens: 0,
    itensConcluidos: 0,
    itensCriticosPendentes: 0,
    criadoEm: Timestamp.now(),
    criadoPor,
  })

  return ref.id
}

export async function limparVinculosOrfaos(): Promise<void> {
  if (import.meta.env.PROD) {
    console.warn('[SCAC] limparVinculosOrfaos não roda em produção.')
    return
  }

  const todosProc = await getDocs(collection(db, 'procedimentos'))
  for (const docProc of todosProc.docs) {
    const audId = docProc.data().audienciaId
    if (!audId) {
      console.warn(`[SCAC] Procedimento órfão (sem audienciaId): ${docProc.id}`)
      continue
    }

    const audSnap = await getDoc(doc(db, 'audiencias', audId))
    if (!audSnap.exists()) {
      console.warn(`[SCAC] Procedimento ${docProc.id} aponta para audiência inexistente: ${audId}`)
    }
  }

  const todosPend = await getDocs(
    query(collection(db, 'processos_pendentes'), where('situacao', '==', 'agendado')),
  )
  for (const docPend of todosPend.docs) {
    const audId = docPend.data().audienciaId
    if (!audId) {
      console.warn(`[SCAC] Processo pendente agendado sem audienciaId: ${docPend.id}`)
      continue
    }

    const audSnap = await getDoc(doc(db, 'audiencias', audId))
    if (!audSnap.exists()) {
      console.warn(`[SCAC] Processo pendente ${docPend.id} aponta para audiência inexistente: ${audId}`)
    }
  }

  console.info('[SCAC] Verificação de vínculos concluída.')
}
