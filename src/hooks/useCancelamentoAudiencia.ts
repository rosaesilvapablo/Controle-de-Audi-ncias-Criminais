import {
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { registrarAcao } from '../lib/auditoria'
import type { RegistroCancelamento } from '../types'

interface CancelarAudienciaParams {
  audienciaId: string
  numeroProcesso: string
  motivoCancelamento: string
  justificativa: string
  devolverAFila: boolean
  processoPendenteId?: string
  usuarioUid: string
  usuarioNome: string
}

export function useCancelamentoAudiencia() {
  async function cancelarAudiencia(params: CancelarAudienciaParams): Promise<void> {
    const registroCancelamento: RegistroCancelamento = {
      motivoCancelamento: params.motivoCancelamento,
      justificativa: params.justificativa,
      canceladoEm: Timestamp.now(),
      canceladoPor: params.usuarioNome,
      canceladoPorUid: params.usuarioUid,
      devolvidaAFila: params.devolverAFila,
    }

    await updateDoc(doc(db, 'audiencias', params.audienciaId), {
      status: 'cancelada',
      cancelamento: registroCancelamento,
      historicoCancelamentos: arrayUnion(registroCancelamento),
    })

    if (params.devolverAFila && params.processoPendenteId) {
      await updateDoc(doc(db, 'processos_pendentes', params.processoPendenteId), {
        situacao: 'aguardando',
        reagendamento: true,
        audienciaCanceladaId: params.audienciaId,
        dataReinsercao: serverTimestamp(),
        audienciaId: deleteField(),
        historicoCancelamentos: arrayUnion(registroCancelamento),
      })
    }

    await registrarAcao({
      tipo: 'cancelamento',
      dados: {
        audienciaId: params.audienciaId,
        numeroProcesso: params.numeroProcesso,
        motivoCancelamento: params.motivoCancelamento,
        justificativa: params.justificativa,
        devolvidaAFila: params.devolverAFila,
      },
      usuarioUid: params.usuarioUid,
      usuarioNome: params.usuarioNome,
    })
  }

  return { cancelarAudiencia }
}
