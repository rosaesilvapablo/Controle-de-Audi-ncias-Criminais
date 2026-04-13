export enum TipoParticipante {
  REU = 'reu',
  VITIMA = 'vitima',
  TESTEMUNHA = 'testemunha',
  PERITO = 'perito',
  TRADUTOR = 'tradutor',
  INFORMANTE = 'informante',
  ASSISTENTE_ACUSACAO = 'assistente_acusacao',
  OUTRO = 'outro',
}

export enum FormaParticipacao {
  PRESENCIAL = 'presencial',
  VIRTUAL = 'virtual',
  A_DEFINIR = 'a_definir',
}

export enum FormaIntimacao {
  MANDADO_CEMAN_LOCAL = 'mandado_ceman_local',
  MANDADO_CEMAN_DIVERSA = 'mandado_ceman_diversa',
  CARTA_PRECATORIA = 'carta_precatoria',
  NAO_REQUER_INTIMACAO = 'nao_requer_intimacao',
}

export enum StatusIntimacao {
  PENDENTE = 'pendente',
  POSITIVA = 'positiva',
  NEGATIVA_NAO_LOCALIZADO = 'negativa_nao_localizado',
  NEGATIVA_DEVOLVIDA = 'negativa_devolvida',
}

export enum TipoDefesa {
  DEFENSORIA = 'defensoria',
  ADVOGADO_CONSTITUIDO = 'advogado_constituido',
  ADVOGADO_DATIVO = 'advogado_dativo',
}

export enum ArroladoPor {
  MPF = 'mpf',
  DEFESA = 'defesa',
  JUIZO = 'juizo',
}

export enum Prioridade {
  REU_PRESO = 'reu_preso',
  CRIANCA = 'crianca',
  IDOSO_70 = 'idoso_70',
  VITIMA = 'vitima',
  JUIZO = 'juizo',
  IDOSO_60 = 'idoso_60',
}

export enum MetaCNJ {
  META_1 = 'meta_1',
  META_2 = 'meta_2',
  META_4 = 'meta_4',
  META_5 = 'meta_5',
  META_6 = 'meta_6',
  META_30 = 'meta_30',
  SEM_META = 'sem_meta',
}

export enum TipoAudiencia {
  AIJ = 'aij',
  CUSTODIA = 'custodia',
  PRELIMINAR = 'preliminar',
  ANPP = 'anpp',
  HOMOLOGACAO = 'homologacao',
  INSTRUCAO = 'instrucao',
  OUTRO = 'outro',
}

export enum FaseProcesso {
  FASE1 = 'fase1',
  FASE2 = 'fase2',
  FASE3 = 'fase3',
}

export enum StatusFase {
  NAO_INICIADA = 'nao_iniciada',
  EM_ANDAMENTO = 'em_andamento',
  CONCLUIDA = 'concluida',
  COM_PENDENCIA = 'com_pendencia',
}

export enum MotivoNaoRealizacao {
  CANCELAMENTO = 'cancelamento',
  REDESIGNACAO = 'redesignacao',
}

export interface ParticipanteBase {
  id: string
  processoId: string
  tipo: TipoParticipante
  outroDescricao?: string
  nome: string
  formaParticipacao: FormaParticipacao
  formaIntimacao: FormaIntimacao
  ordem: number
  observacao?: string
  criadoEm: Date
  atualizadoEm: Date
}

export interface ParticipanteDetalhes {
  preso?: boolean
  tipoDefesa?: TipoDefesa
  nomeAdvogado?: string
  menor?: boolean
  possuiRepresentante?: boolean
  nomeRepresentante?: string
  arroladoPor?: ArroladoPor
  reuVinculadoId?: string
  especialidade?: string
  orgaoVinculo?: string
  idioma?: string
  linguagem?: string
  tribunalDeprecado?: string
  numeroProcessoCarta?: string
  idCarta?: string
  idRemessa?: string
  dataRemessa?: Date
  dataDevolvida?: Date
  atoOrdinatorioIntimado?: boolean
}

export type Participante = ParticipanteBase & ParticipanteDetalhes

export interface Intimacao {
  id: string
  processoId: string
  participanteId: string
  participanteNome: string
  participanteTipo: TipoParticipante
  tipo: FormaIntimacao
  status: StatusIntimacao
  dataCumprimento?: Date
  tribunalDeprecado?: string
  numeroProcessoCarta?: string
  idCarta?: string
  idRemessa?: string
  dataRemessa?: Date
  dataDevolvida?: Date
  atoOrdinatorioIntimado?: boolean
  observacao?: string
  criadoEm: Date
  atualizadoEm: Date
}

export interface Prescricao {
  dataLimite?: Date
  dataPerspectiva?: Date
  alertaAtivo: boolean
  observacao?: string
}

export interface Processo {
  id: string
  numeroProcesso: string
  tipoAudiencia: TipoAudiencia
  naturezaCrime?: string
  metaCNJ: MetaCNJ
  cargoMagistrado: string
  prioridades: Prioridade[]
  etiquetas: string[]
  etiquetasSistemicas: MetaCNJ[]
  prescricao: Prescricao
  fases: {
    fase1: StatusFase
    fase2: StatusFase
    fase3: StatusFase
  }
  totalParticipantes: number
  totalIntimacoesPendentes: number
  totalCartasPrecatoriasEmAlerta: number
  observacoes?: string
  criadoEm: Date
  atualizadoEm: Date
  criadoPor: string
}

export interface Fase1 {
  id: string
  processoId: string
  sugestaoData?: Date
  sugestaoHorario?: string
  quantidadeReus: number
  quantidadeTestemunhas: number
  quantidadeOutros: number
  checklist: {
    minutaDespachoElaborada: boolean
    audienciaCadastradaCalendario: boolean
    relatorioIntimacoeselaborado: boolean
    etiquetaPjeAtualizada: boolean
  }
  observacoes?: string
  concluidaEm?: Date
  criadoEm: Date
  atualizadoEm: Date
}

export interface Fase2 {
  id: string
  processoId: string
  dataHoraInicio?: Date
  dataHoraFim?: Date
  sala?: string
  magistradoFase2?: string
  checklist: {
    linksEnviados: boolean
    certidaoEnvioLink: boolean
  }
  observacoes?: string
  concluidaEm?: Date
  criadoEm: Date
  atualizadoEm: Date
}

export interface Fase3 {
  id: string
  processoId: string
  realizada?: boolean
  checklistRealizacao?: {
    ataAssinada: boolean
    midiaJuntada: boolean
    cadastroPjeRealizado: boolean
    intimacoesRealizadas: boolean
    etiquetaPjeAtualizada: boolean
  }
  determinacoesAudiencia?: string
  modeloAtaUtilizadoId?: string
  motivoNaoRealizacao?: MotivoNaoRealizacao
  novaData?: Date
  checklistNaoRealizacao?: {
    calendarioAtualizado: boolean
    relatorioIntimacoesElaborado: boolean
    etiquetaPjeAtualizada: boolean
  }
  observacoes?: string
  concluidaEm?: Date
  criadoEm: Date
  atualizadoEm: Date
}

export enum TipoModelo {
  ATA_AIJ = 'ata_aij',
  ATA_CUSTODIA = 'ata_custodia',
  ATA_PRELIMINAR = 'ata_preliminar',
  ATA_ANPP = 'ata_anpp',
  ATA_GENERICA = 'ata_generica',
  OUTRO = 'outro',
}

export interface ModeloDocumento {
  id: string
  nome: string
  tipo: TipoModelo
  conteudo: string
  variaveis: string[]
  criadoPor: string
  visivelPara: 'todos' | 'magistrado' | 'servidor'
  arquivado: boolean
  versao: number
  criadoEm: Date
  atualizadoEm: Date
}

export enum TipoAlerta {
  PRESCRICAO_90_DIAS = 'prescricao_90_dias',
  PRESCRICAO_30_DIAS = 'prescricao_30_dias',
  PRESCRICAO_7_DIAS = 'prescricao_7_dias',
  PRESCRICAO_VENCIDA = 'prescricao_vencida',
  CARTA_PRECATORIA_30_DIAS = 'carta_precatoria_30_dias',
  CARTA_PRECATORIA_40_DIAS = 'carta_precatoria_40_dias',
  INTIMACAO_PENDENTE = 'intimacao_pendente',
  FASE_COM_PENDENCIA = 'fase_com_pendencia',
}

export interface Alerta {
  tipo: TipoAlerta
  processoId: string
  numeroProcesso: string
  participanteId?: string
  participanteNome?: string
  dataReferencia?: Date
  diasDecorridos?: number
  mensagem: string
}
