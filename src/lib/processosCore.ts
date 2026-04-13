import { Timestamp, type DocumentData } from 'firebase/firestore'
import {
  MetaCNJ,
  StatusFase,
  TipoAudiencia,
  type Fase1,
  type Processo,
} from '../types/core'
import type { CargoMagistrado, TipoAudienciaPendente } from '../types'
import { CARGO_MAGISTRADO_LABELS } from '../types'

type Primitive = string | number | boolean | null | undefined

type FirestoreLike =
  | Primitive
  | Date
  | Timestamp
  | FirestoreLike[]
  | { [key: string]: FirestoreLike }

export interface Fase1FirestoreExtras {
  checklistTimestamps?: Partial<Record<keyof Fase1['checklist'], Date>>
}

function toDateOrUndefined(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return undefined
}

function deepNormalize(value: FirestoreLike): FirestoreLike {
  if (value instanceof Timestamp) return value.toDate()
  if (Array.isArray(value)) return value.map((item) => deepNormalize(item))
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepNormalize(item as FirestoreLike)]),
    )
  }
  return value
}

export function normalizarProcessoCore(id: string, dados: DocumentData): Processo {
  const normalizado = deepNormalize(dados as FirestoreLike) as Record<string, unknown>
  const agora = new Date()

  return {
    id,
    numeroProcesso: String(normalizado.numeroProcesso ?? ''),
    tipoAudiencia: (normalizado.tipoAudiencia as TipoAudiencia) ?? TipoAudiencia.OUTRO,
    naturezaCrime: normalizado.naturezaCrime as string | undefined,
    metaCNJ: (normalizado.metaCNJ as MetaCNJ) ?? MetaCNJ.SEM_META,
    cargoMagistrado: String(normalizado.cargoMagistrado ?? 'Juiz Federal'),
    prioridades: Array.isArray(normalizado.prioridades)
      ? (normalizado.prioridades as Processo['prioridades'])
      : [],
    etiquetas: Array.isArray(normalizado.etiquetas)
      ? (normalizado.etiquetas as string[])
      : [],
    etiquetasSistemicas: Array.isArray(normalizado.etiquetasSistemicas)
      ? (normalizado.etiquetasSistemicas as MetaCNJ[])
      : [],
    prescricao: {
      dataLimite: toDateOrUndefined(normalizado.prescricao && typeof normalizado.prescricao === 'object'
        ? (normalizado.prescricao as Record<string, unknown>).dataLimite
        : undefined),
      dataPerspectiva: toDateOrUndefined(normalizado.prescricao && typeof normalizado.prescricao === 'object'
        ? (normalizado.prescricao as Record<string, unknown>).dataPerspectiva
        : undefined),
      alertaAtivo: Boolean(
        normalizado.prescricao && typeof normalizado.prescricao === 'object'
          ? (normalizado.prescricao as Record<string, unknown>).alertaAtivo ?? true
          : true,
      ),
      observacao:
        normalizado.prescricao && typeof normalizado.prescricao === 'object'
          ? ((normalizado.prescricao as Record<string, unknown>).observacao as string | undefined)
          : undefined,
    },
    fases: {
      fase1: (normalizado.fases as Processo['fases'] | undefined)?.fase1 ?? StatusFase.EM_ANDAMENTO,
      fase2: (normalizado.fases as Processo['fases'] | undefined)?.fase2 ?? StatusFase.NAO_INICIADA,
      fase3: (normalizado.fases as Processo['fases'] | undefined)?.fase3 ?? StatusFase.NAO_INICIADA,
    },
    totalParticipantes: Number(normalizado.totalParticipantes ?? 0),
    totalIntimacoesPendentes: Number(normalizado.totalIntimacoesPendentes ?? 0),
    totalCartasPrecatoriasEmAlerta: Number(normalizado.totalCartasPrecatoriasEmAlerta ?? 0),
    observacoes: normalizado.observacoes as string | undefined,
    criadoEm: toDateOrUndefined(normalizado.criadoEm) ?? agora,
    atualizadoEm: toDateOrUndefined(normalizado.atualizadoEm) ?? agora,
    criadoPor: String(normalizado.criadoPor ?? ''),
  }
}

export function criarFase1Padrao(processoId: string, agora = new Date()): Fase1 {
  return {
    id: 'fase1',
    processoId,
    quantidadeReus: 0,
    quantidadeTestemunhas: 0,
    quantidadeOutros: 0,
    checklist: {
      minutaDespachoElaborada: false,
      audienciaCadastradaCalendario: false,
      relatorioIntimacoeselaborado: false,
      etiquetaPjeAtualizada: false,
    },
    criadoEm: agora,
    atualizadoEm: agora,
  }
}

export function normalizarFase1Core(processoId: string, dados: DocumentData): Fase1 & Fase1FirestoreExtras {
  const normalizado = deepNormalize(dados as FirestoreLike) as Record<string, unknown>
  const padrao = criarFase1Padrao(processoId)

  return {
    ...padrao,
    id: String(normalizado.id ?? 'fase1'),
    sugestaoData: toDateOrUndefined(normalizado.sugestaoData),
    sugestaoHorario: normalizado.sugestaoHorario as string | undefined,
    quantidadeReus: Number(normalizado.quantidadeReus ?? 0),
    quantidadeTestemunhas: Number(normalizado.quantidadeTestemunhas ?? 0),
    quantidadeOutros: Number(normalizado.quantidadeOutros ?? 0),
    checklist: {
      minutaDespachoElaborada: Boolean(
        (normalizado.checklist as Fase1['checklist'] | undefined)?.minutaDespachoElaborada,
      ),
      audienciaCadastradaCalendario: Boolean(
        (normalizado.checklist as Fase1['checklist'] | undefined)?.audienciaCadastradaCalendario,
      ),
      relatorioIntimacoeselaborado: Boolean(
        (normalizado.checklist as Fase1['checklist'] | undefined)?.relatorioIntimacoeselaborado,
      ),
      etiquetaPjeAtualizada: Boolean(
        (normalizado.checklist as Fase1['checklist'] | undefined)?.etiquetaPjeAtualizada,
      ),
    },
    observacoes: normalizado.observacoes as string | undefined,
    concluidaEm: toDateOrUndefined(normalizado.concluidaEm),
    criadoEm: toDateOrUndefined(normalizado.criadoEm) ?? padrao.criadoEm,
    atualizadoEm: toDateOrUndefined(normalizado.atualizadoEm) ?? padrao.atualizadoEm,
    checklistTimestamps:
      normalizado.checklistTimestamps && typeof normalizado.checklistTimestamps === 'object'
        ? Object.fromEntries(
            Object.entries(normalizado.checklistTimestamps as Record<string, unknown>)
              .map(([key, value]) => [key, toDateOrUndefined(value)])
              .filter(([, value]) => Boolean(value)),
          ) as Fase1FirestoreExtras['checklistTimestamps']
        : undefined,
  }
}

export function criarProcessoPadrao(params: {
  id: string
  numeroProcesso: string
  tipoAudiencia: TipoAudiencia
  cargoMagistrado: string
  criadoPor: string
  naturezaCrime?: string
  observacoes?: string
  metaCNJ?: MetaCNJ
  prioridades?: Processo['prioridades']
  etiquetas?: string[]
  etiquetasSistemicas?: MetaCNJ[]
  prescricao?: Processo['prescricao']
  criadoEm?: Date
  atualizadoEm?: Date
}): Processo {
  const agora = params.criadoEm ?? new Date()

  return {
    id: params.id,
    numeroProcesso: params.numeroProcesso,
    tipoAudiencia: params.tipoAudiencia,
    naturezaCrime: params.naturezaCrime,
    metaCNJ: params.metaCNJ ?? MetaCNJ.SEM_META,
    cargoMagistrado: params.cargoMagistrado,
    prioridades: params.prioridades ?? [],
    etiquetas: params.etiquetas ?? [],
    etiquetasSistemicas: params.etiquetasSistemicas ?? [],
    prescricao: params.prescricao ?? {
      alertaAtivo: true,
    },
    fases: {
      fase1: StatusFase.EM_ANDAMENTO,
      fase2: StatusFase.NAO_INICIADA,
      fase3: StatusFase.NAO_INICIADA,
    },
    totalParticipantes: 0,
    totalIntimacoesPendentes: 0,
    totalCartasPrecatoriasEmAlerta: 0,
    observacoes: params.observacoes,
    criadoEm: agora,
    atualizadoEm: params.atualizadoEm ?? agora,
    criadoPor: params.criadoPor,
  }
}

export function mapearTipoAudienciaFilaParaCore(tipo: TipoAudienciaPendente): TipoAudiencia {
  switch (tipo) {
    case 'aij':
    case 'una':
      return TipoAudiencia.AIJ
    case 'custodia':
      return TipoAudiencia.CUSTODIA
    case 'interrogatorio':
    case 'oitiva':
      return TipoAudiencia.INSTRUCAO
    default:
      return TipoAudiencia.OUTRO
  }
}

export function mapearCargoMagistradoParaTexto(cargo: CargoMagistrado): string {
  return CARGO_MAGISTRADO_LABELS[cargo]
}
