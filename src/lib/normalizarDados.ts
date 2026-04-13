import { Timestamp } from 'firebase/firestore'
import type {
  Audiencia,
  Procedimento,
  ProcedimentoItem,
  ProcessoPendente,
  TipoAudiencia,
  TipoAudienciaPendente,
  ClasseProcessual,
  ObjetoDoFeito,
  MotivoCancelamento,
  StatusAudiencia,
  StatusProcedimento,
  TipoResposta,
  FaseProcedimento,
  ReuProcesso,
  AdvogadoProcesso,
  CargoMagistrado,
  SituacaoPendente,
} from '../types'

export function normalizarAudiencia(
  id: string,
  dados: Record<string, unknown>,
): Audiencia {
  return {
    id,
    numeroProcesso: String(dados.numeroProcesso ?? ''),
    tipo: (dados.tipo as TipoAudiencia) ?? 'outro',
    classeProcessual:
      (dados.classeProcessual as ClasseProcessual) ?? 'acao_penal',
    objetoDoFeito: (dados.objetoDoFeito as ObjetoDoFeito) ?? 'outro',
    dataHoraInicio: dados.dataHoraInicio as Timestamp,
    dataHoraFim: dados.dataHoraFim as Timestamp,
    salaId: String(dados.salaId ?? ''),
    salaNome: String(dados.salaNome ?? ''),
    magistradoId: String(dados.magistradoId ?? ''),
    magistradoNome: String(dados.magistradoNome ?? ''),
    status: (dados.status as StatusAudiencia) ?? 'agendada',
    reuPreso: Boolean(dados.reuPreso ?? false),
    reus: Array.isArray(dados.reus) ? (dados.reus as ReuProcesso[]) : [],
    vitimas: Array.isArray(dados.vitimas) ? (dados.vitimas as string[]) : [],
    advogados: Array.isArray(dados.advogados)
      ? (dados.advogados as AdvogadoProcesso[])
      : [],
    partes: dados.partes as string | undefined,
    observacoes: dados.observacoes as string | undefined,
    motivoCancelamento: dados.motivoCancelamento as MotivoCancelamento | undefined,
    motivoOutro: dados.motivoOutro as string | undefined,
    sigiloso: Boolean(dados.sigiloso ?? false),
    juizoDeprecante: dados.juizoDeprecante as string | undefined,
    audienciaOrigemId: dados.audienciaOrigemId as string | undefined,
    criadoEm: dados.criadoEm as Timestamp,
    criadoPor: String(dados.criadoPor ?? ''),
    atualizadoEm: dados.atualizadoEm as Timestamp | undefined,
    cargoMagistrado: dados.cargoMagistrado as string | undefined,
  } as Audiencia
}

export function normalizarProcedimento(
  id: string,
  dados: Record<string, unknown>,
): Procedimento {
  return {
    id,
    audienciaId: String(dados.audienciaId ?? ''),
    numeroProcesso: String(dados.numeroProcesso ?? ''),
    status: (dados.status as StatusProcedimento) ?? 'pendente',
    progresso: Number(dados.progresso ?? 0),
    totalItens: Number(dados.totalItens ?? 0),
    itensConcluidos: Number(dados.itensConcluidos ?? 0),
    itensCriticosPendentes: Number(dados.itensCriticosPendentes ?? 0),
    templateVersao: Number.isFinite(Number(dados.templateVersao))
      ? Number(dados.templateVersao)
      : undefined,
    criadoEm: dados.criadoEm as Timestamp,
    atualizadoEm: dados.atualizadoEm as Timestamp | undefined,
  }
}

export function normalizarItem(
  id: string,
  dados: Record<string, unknown>,
): ProcedimentoItem {
  return {
    id,
    procedimentoId: String(dados.procedimentoId ?? ''),
    fase: Number(dados.fase ?? 1) as FaseProcedimento,
    descricao: String(dados.descricao ?? ''),
    critico: Boolean(dados.critico ?? false),
    obrigatorio: Boolean(dados.obrigatorio ?? dados.critico ?? false),
    tipoResposta: (dados.tipoResposta as TipoResposta) ?? 'sim_nao',
    resetarNaRemarcacao: Boolean(dados.resetarNaRemarcacao ?? false),
    responsavel: dados.responsavel as string | undefined,
    resposta: dados.resposta as string | boolean | undefined,
    observacao: dados.observacao as string | undefined,
    idsPje: Array.isArray(dados.idsPje) ? (dados.idsPje as string[]) : [],
    respondidoEm: dados.respondidoEm as Timestamp | undefined,
    respondidoPor: dados.respondidoPor as string | undefined,
    ordem: Number(dados.ordem ?? 0),
  } as ProcedimentoItem
}

export function normalizarProcessoPendente(
  id: string,
  dados: Record<string, unknown>,
): ProcessoPendente {
  const r = Number(dados.quantidadeReus ?? 0)
  const t = Number(dados.quantidadeTestemunhas ?? 0)
  const p = Number(dados.quantidadePeritos ?? 0)
  const o = Number(dados.quantidadeOutros ?? 0)
  const mins = (r + t + p + o) * 15

  return {
    id,
    numeroProcesso: String(dados.numeroProcesso ?? ''),
    tipoAudiencia: (dados.tipoAudiencia as TipoAudienciaPendente) ?? 'outro',
    cargoMagistrado: (dados.cargoMagistrado as CargoMagistrado) ?? 'juiz_federal',
    quantidadeReus: r,
    quantidadeTestemunhas: t,
    quantidadePeritos: p,
    quantidadeOutros: o,
    minutosEstimados: Number(dados.minutosEstimados ?? mins),
    diasEstimados: Number(dados.diasEstimados ?? Math.max(1, Math.ceil(mins / 240))),
    reuPreso: Boolean(dados.reuPreso ?? false),
    observacoes: dados.observacoes as string | undefined,
    dataInclusao: dados.dataInclusao as Timestamp,
    situacao: (dados.situacao as SituacaoPendente) ?? 'aguardando',
    audienciaId: dados.audienciaId as string | undefined,
    sigiloso: Boolean(dados.sigiloso ?? false),
    criadoEm: dados.criadoEm as Timestamp,
    criadoPor: String(dados.criadoPor ?? ''),
    atualizadoEm: dados.atualizadoEm as Timestamp | undefined,
  }
}
