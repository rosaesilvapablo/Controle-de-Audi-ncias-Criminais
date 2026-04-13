import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  Audiencia,
  DiaSemana,
  Procedimento,
  StatusAudiencia,
  TipoAudiencia,
  TipoAudienciaPendente,
} from '../types'

export function mapearTipoAudienciaPendente(
  tipo: TipoAudienciaPendente,
): TipoAudiencia {
  const mapa: Record<TipoAudienciaPendente, TipoAudiencia> = {
    aij: 'instrucao',
    interrogatorio: 'interrogatorio',
    oitiva: 'oitiva',
    admonitoria: 'outro',
    custodia: 'outro',
    una: 'audiencia_una',
    outro: 'outro',
  }

  return mapa[tipo] ?? 'outro'
}

export function calcularDuracaoMinutos(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / 60000)
}

export function calcularDataHoraFim(
  inicio: Date,
  duracaoMinutos: number,
): Date {
  return new Date(inicio.getTime() + duracaoMinutos * 60000)
}

export function isReuPressoPendente(
  audiencia: Audiencia,
  procedimento: Procedimento | null,
): boolean {
  return (
    audiencia.reuPreso === true &&
    ['agendada', 'em_andamento'].includes(audiencia.status) &&
    (procedimento?.itensCriticosPendentes ?? 0) > 0
  )
}

export function isProximaAudiencia(
  audiencia: Audiencia,
  minutosAntecedencia = 30,
): boolean {
  const agora = Date.now()
  const inicio = audiencia.dataHoraInicio.toDate().getTime()

  return (
    audiencia.status === 'agendada' &&
    inicio > agora &&
    inicio - agora <= minutosAntecedencia * 60000
  )
}

export function isAudienciaAtrasada(audiencia: Audiencia): boolean {
  return (
    audiencia.status === 'agendada' &&
    audiencia.dataHoraInicio.toDate().getTime() < Date.now()
  )
}

export function isChecklistIncompletoCritico(
  procedimento: Procedimento | null,
): boolean {
  return (procedimento?.itensCriticosPendentes ?? 0) > 0
}

export type AcaoAudiencia =
  | 'iniciar'
  | 'encerrar'
  | 'remarcar'
  | 'cancelar'

export interface ResultadoValidacao {
  permitido: boolean
  mensagem?: string
}

export function validarTransicaoEstado(
  acao: AcaoAudiencia,
  statusAtual: StatusAudiencia,
  procedimento: Procedimento | null,
): ResultadoValidacao {
  const bloqueios: Partial<Record<AcaoAudiencia, StatusAudiencia[]>> = {
    iniciar: ['em_andamento', 'realizada', 'cancelada', 'redesignada'],
    encerrar: ['agendada', 'realizada', 'cancelada', 'redesignada', 'suspensa'],
    remarcar: ['realizada', 'cancelada'],
    cancelar: ['realizada'],
  }

  const mensagensEstado: Partial<Record<StatusAudiencia, string>> = {
    em_andamento: 'A audiência já está em andamento.',
    realizada: 'Esta audiência já foi realizada.',
    cancelada: 'Esta audiência já está cancelada.',
    redesignada: 'Esta audiência já foi remarcada.',
    suspensa: 'Esta audiência está suspensa.',
    agendada: 'A audiência ainda não foi iniciada.',
  }

  void procedimento

  if (bloqueios[acao]?.includes(statusAtual)) {
    return {
      permitido: false,
      mensagem:
        mensagensEstado[statusAtual] ??
        'Esta ação não é permitida na situação atual da audiência.',
    }
  }

  return { permitido: true }
}

const MINS_POR_PESSOA = 15
const MINS_POR_DIA = 240

export function calcularMinutosEspera(
  reus: number,
  testemunhas: number,
  peritos: number,
  outros: number,
): number {
  return (reus + testemunhas + peritos + outros) * MINS_POR_PESSOA
}

export function calcularDiasEspera(minutos: number): number {
  return Math.max(1, Math.ceil(minutos / MINS_POR_DIA))
}

export function formatarDataExtenso(data: Date | Timestamp): string {
  const d = data instanceof Timestamp ? data.toDate() : data
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatarHorario(data: Date | Timestamp): string {
  const d = data instanceof Timestamp ? data.toDate() : data
  return format(d, 'HH:mm', { locale: ptBR })
}

export function formatarDataHora(data: Date | Timestamp): string {
  const d = data instanceof Timestamp ? data.toDate() : data
  return format(d, "dd/MM 'às' HH'h'mm", { locale: ptBR })
}

export const DIAS_SEMANA_LABELS: Record<DiaSemana, string> = {
  0: 'domingo',
  1: 'segunda-feira',
  2: 'terça-feira',
  3: 'quarta-feira',
  4: 'quinta-feira',
  5: 'sexta-feira',
  6: 'sábado',
}

export function diaSemanaAtivo(
  diaSemana: number,
  diasSemanaAtivos: number[] | undefined,
): boolean {
  const ativos =
    diasSemanaAtivos && diasSemanaAtivos.length > 0
      ? diasSemanaAtivos
      : [1, 2, 3, 4, 5]

  return ativos.includes(diaSemana)
}

export function mensagemDiaSemanaInativo(diaSemana: DiaSemana): string {
  return `Não é possível agendar para ${DIAS_SEMANA_LABELS[diaSemana]}. Esse dia está desativado nas configurações da pauta.`
}
