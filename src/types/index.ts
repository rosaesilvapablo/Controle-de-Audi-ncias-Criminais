import { Timestamp } from 'firebase/firestore'

export type Perfil =
  | 'diretor'
  | 'magistrado'
  | 'supervisor'
  | 'servidor'
  | 'estagiario'
  | 'convidado'

export type UserRole = Perfil

export interface Usuario {
  uid: string
  nome: string
  email: string
  perfil: Perfil
  ativo: boolean
  primeiroAcesso?: boolean
  criadoEm: Timestamp
  atualizadoEm?: Timestamp
  fotoUrl?: string
}

export interface Sala {
  id: string
  nome: string
  capacidade?: number
  ativa: boolean
  descricao?: string
  criadoEm: Timestamp
}

export type TipoFeriado = 'nacional' | 'estadual' | 'municipal' | 'recesso' | 'ponto_facultativo'

export interface Feriado {
  id: string
  descricao: string
  data: Timestamp
  tipo: TipoFeriado
  recorrente: boolean
  criadoEm: Timestamp
}

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Disponibilidade {
  id: string
  usuarioId: string
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
  criadoEm: Timestamp
}

export type StatusAudiencia =
  | 'agendada'
  | 'em_andamento'
  | 'realizada'
  | 'redesignada'
  | 'cancelada'
  | 'suspensa'

export type TipoAudiencia =
  | 'instrucao'
  | 'interrogatorio'
  | 'oitiva'
  | 'julgamento'
  | 'audiencia_una'
  | 'sessao_juri'
  | 'outro'

export type ClasseProcessual =
  | 'acao_penal'
  | 'carta_precatoria_criminal'
  | 'execucao_penal'
  | 'habeas_corpus'
  | 'medidas_cautelares'
  | 'inquerito_policial'
  | 'outro'

export const CLASSE_PROCESSUAL_LABELS: Record<ClasseProcessual, string> = {
  acao_penal: 'Ação Penal',
  carta_precatoria_criminal: 'Carta Precatória Criminal',
  execucao_penal: 'Execução Penal',
  habeas_corpus: 'Habeas Corpus',
  medidas_cautelares: 'Medidas Cautelares',
  inquerito_policial: 'Inquérito Policial',
  outro: 'Outro',
}

export type ObjetoDoFeito =
  | 'trafico_drogas'
  | 'estelionato_previdenciario'
  | 'estelionato_cef'
  | 'contrabando_descaminho'
  | 'moeda_falsa'
  | 'crimes_ambientais'
  | 'associacao_criminosa'
  | 'corrupcao'
  | 'outro'

export const OBJETO_FEITO_LABELS: Record<ObjetoDoFeito, string> = {
  trafico_drogas: 'Tráfico de drogas',
  estelionato_previdenciario: 'Estelionato previdenciário',
  estelionato_cef: 'Estelionato contra a CEF',
  contrabando_descaminho: 'Contrabando / Descaminho',
  moeda_falsa: 'Moeda falsa',
  crimes_ambientais: 'Crimes ambientais',
  associacao_criminosa: 'Associação criminosa',
  corrupcao: 'Corrupção',
  outro: 'Outro',
}

export interface ReuProcesso {
  nome: string
  preso: boolean
}

export interface AdvogadoProcesso {
  nome: string
  oab: string
  tipo: 'constituido' | 'dativo' | 'dpu'
}

export const ADVOGADO_TIPO_LABELS: Record<'constituido' | 'dativo' | 'dpu', string> = {
  constituido: 'Constituído',
  dativo: 'Dativo',
  dpu: 'DPU',
}

export const MOTIVOS_CANCELAMENTO = [
  'Pedido da Defesa',
  'Pedido do MPF',
  'Ausência de testemunha ou vítima',
  'Decisão do magistrado',
  'Problema técnico — videoconferência',
  'Réu não apresentado pela escolta',
  'Falta de defensor',
  'Outro motivo',
] as const

export type MotivoCancelamento = typeof MOTIVOS_CANCELAMENTO[number]

export interface Audiencia {
  id: string
  numeroProcesso: string
  tipo: TipoAudiencia
  classeProcessual: ClasseProcessual
  objetoDoFeito: ObjetoDoFeito
  dataHoraInicio: Timestamp
  dataHoraFim: Timestamp
  salaId: string
  salaNome?: string
  magistradoId: string
  magistradoNome?: string
  status: StatusAudiencia
  reuPreso: boolean
  juizoDeprecante?: string
  reus: ReuProcesso[]
  vitimas: string[]
  advogados: AdvogadoProcesso[]
  partes?: string
  observacoes?: string
  motivoCancelamento?: MotivoCancelamento
  motivoOutro?: string
  sigiloso?: boolean
  cancelamento?: RegistroCancelamento
  historicoCancelamentos?: RegistroCancelamento[]
  audienciaOrigemId?: string
  agendadoComAvisoAntecedencia?: boolean
  criadoEm: Timestamp
  criadoPor: string
  atualizadoEm?: Timestamp
}

export type StatusProcedimento =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'com_pendencias_criticas'

export type FaseProcedimento = 1 | 2 | 3 | 4 | 5

export const FASES_LABELS: Record<FaseProcedimento, string> = {
  1: 'Pré-audiência',
  2: 'Abertura',
  3: 'Instrução',
  4: 'Encerramento',
  5: 'Pós-ato',
}

export interface Procedimento {
  id: string
  audienciaId: string
  numeroProcesso: string
  status: StatusProcedimento
  progresso: number
  totalItens: number
  itensConcluidos: number
  itensCriticosPendentes: number
  templateVersao?: number
  criadoEm: Timestamp
  atualizadoEm?: Timestamp
}

export type TipoResposta = 'sim_nao' | 'texto' | 'numero' | 'data'

export interface ProcedimentoItem {
  id: string
  procedimentoId: string
  fase: FaseProcedimento
  descricao: string
  critico: boolean
  obrigatorio: boolean
  tipoResposta: TipoResposta
  responsavel?: string
  resposta?: string | boolean
  observacao?: string
  idsPje?: string[]
  respondidoEm?: Timestamp
  respondidoPor?: string
  resetarNaRemarcacao: boolean
  ordem: number
}

export type TipoParticipante =
  | 'reu'
  | 'advogado_defesa'
  | 'advogado_acusacao'
  | 'testemunha'
  | 'perito'
  | 'interprete'
  | 'outro'

export interface ProcedimentoParticipante {
  id: string
  procedimentoId: string
  nome: string
  tipo: TipoParticipante
  documento?: string
  oab?: string
  presente?: boolean
  criadoEm: Timestamp
}

export type TipoDocumento =
  | 'ata'
  | 'termo'
  | 'despacho'
  | 'sentenca'
  | 'oficio'
  | 'outro'

export interface ProcedimentoDocumento {
  id: string
  procedimentoId: string
  nome: string
  tipo: TipoDocumento
  idPje: string
  urlPje?: string
  criadoEm: Timestamp
  criadoPor: string
}

export interface Configuracoes {
  id: string
  nomeVara: string
  nomeJuizo: string
  cidade: string
  uf: string
  duracaoPadraoMinutos: number
  horarioInicioPauta: string
  horarioFimPauta: string
  diasSemanaAtivos: DiaSemana[]
  emailNotificacoes?: string
  logoUrl?: string
  atualizadoEm?: Timestamp
  atualizadoPor?: string
}

export type AuditAcao =
  | 'criar'
  | 'editar'
  | 'excluir'
  | 'cancelar'
  | 'redesignar'
  | 'iniciar'
  | 'encerrar'

export interface AuditLog {
  id: string
  tipo?: string
  colecao?: string
  documentId?: string
  documentoId?: string
  campo?: string
  acao?: AuditAcao | string
  antes?: Record<string, unknown>
  depois?: Record<string, unknown>
  valorAnterior?: unknown
  valorNovo?: unknown
  usuarioUid?: string
  usuarioId?: string
  usuarioNome: string
  timestamp?: Timestamp
  criadoEm?: Timestamp
  [key: string]: unknown
}

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon?: string
  category: 'acao' | 'pagina' | 'processo' | 'audiencia'
  shortcut?: string
  action: () => void
}

export interface FiltrosPauta {
  magistradoId?: string
  salaId?: string
  status?: StatusAudiencia[]
  tipo?: TipoAudiencia[]
  periodo?: 'dia' | 'semana' | 'mes'
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

export function isAdmin(perfil?: Perfil): boolean {
  return perfil === 'diretor'
}

export function canEdit(perfil?: Perfil): boolean {
  return perfil === 'diretor' || perfil === 'supervisor' || perfil === 'servidor'
}

export function isMagistrado(perfil?: Perfil): boolean {
  return perfil === 'magistrado'
}

export function canViewOnly(perfil?: Perfil): boolean {
  return perfil === 'estagiario' || perfil === 'convidado'
}

export function canView(perfil?: Perfil): boolean {
  return !!perfil
}

export const STATUS_AUDIENCIA_LABELS: Record<StatusAudiencia, string> = {
  agendada: 'Agendada',
  em_andamento: 'Em andamento',
  realizada: 'Realizada',
  redesignada: 'Redesignada',
  cancelada: 'Cancelada',
  suspensa: 'Suspensa',
}

export const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  instrucao: 'Instrução',
  interrogatorio: 'Interrogatório',
  oitiva: 'Oitiva',
  julgamento: 'Julgamento',
  audiencia_una: 'Audiência Una',
  sessao_juri: 'Sessão do Júri',
  outro: 'Outro',
}

export const TIPO_PARTICIPANTE_LABELS: Record<TipoParticipante, string> = {
  reu: 'Réu',
  advogado_defesa: 'Advogado de Defesa',
  advogado_acusacao: 'Advogado de Acusação',
  testemunha: 'Testemunha',
  perito: 'Perito',
  interprete: 'Intérprete',
  outro: 'Outro',
}
export type TipoAudienciaPendente =
  | 'aij'
  | 'interrogatorio'
  | 'oitiva'
  | 'admonitoria'
  | 'custodia'
  | 'una'
  | 'outro'

export const TIPO_AUDIENCIA_PENDENTE_LABELS: Record<TipoAudienciaPendente, string> = {
  aij: 'AIJ — Instrução e Julgamento',
  interrogatorio: 'Interrogatório',
  oitiva: 'Oitiva de testemunhas',
  admonitoria: 'Admonitória',
  custodia: 'Custódia',
  una: 'Una — Uma única audiência',
  outro: 'Outro tipo',
}

export type CargoMagistrado =
  | 'juiz_federal'
  | 'juiz_federal_substituto'
  | 'juiz_designado'

export const CARGO_MAGISTRADO_LABELS: Record<CargoMagistrado, string> = {
  juiz_federal: 'Juiz Federal',
  juiz_federal_substituto: 'Juiz Federal Substituto',
  juiz_designado: 'Juiz designado para o ato',
}

export type SituacaoPendente = 'aguardando' | 'agendado' | 'cancelado'

export interface ProcessoPendente {
  id: string
  numeroProcesso: string
  tipoAudiencia: TipoAudienciaPendente
  cargoMagistrado: CargoMagistrado
  quantidadeReus: number
  quantidadeTestemunhas: number
  quantidadePeritos: number
  quantidadeOutros: number
  minutosEstimados: number
  diasEstimados: number
  reuPreso: boolean
  observacoes?: string
  dataInclusao: Timestamp
  situacao: SituacaoPendente
  audienciaId?: string
  sigiloso?: boolean
  reagendamento?: boolean
  audienciaCanceladaId?: string
  dataReinsercao?: Timestamp
  historicoCancelamentos?: RegistroCancelamento[]
  criadoEm: Timestamp
  criadoPor: string
  atualizadoEm?: Timestamp
}

export interface RegistroCancelamento {
  motivoCancelamento: string
  justificativa: string
  canceladoEm: Timestamp
  canceladoPor: string
  canceladoPorUid: string
  devolvidaAFila: boolean
}

export interface AcessoSigiloso {
  uid: string
  nome: string
  perfil: UserRole
  autorizadoEm: Timestamp
  autorizadoPor: string
}

export interface ItemTemplate {
  ordem: number
  titulo: string
  fase: number
  critico: boolean
  responsavelSugerido?: string
}

export interface ChecklistTemplate {
  id: string
  versao: number
  ativa: boolean
  criadaEm: Timestamp
  criadaPor: string
  criadaPorUid: string
  itens: ItemTemplate[]
}
