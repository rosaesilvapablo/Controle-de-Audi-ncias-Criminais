import { format } from 'date-fns'
import { TipoAudiencia, type Fase2, type Processo } from '../types/core'

export interface ContextoModelo {
  numeroProcesso?: string
  tipoAudiencia?: string
  dataAudiencia?: string
  horaAudiencia?: string
  sala?: string
  cargoMagistrado?: string
  naturezaCrime?: string
  dataHoje: string
}

const REGEX_VARIAVEL = /{{\s*([a-zA-Z0-9_]+)\s*}}/g

const TIPO_AUDIENCIA_ROTULO: Record<TipoAudiencia, string> = {
  [TipoAudiencia.AIJ]: 'Audiencia de Instrucao e Julgamento',
  [TipoAudiencia.CUSTODIA]: 'Audiencia de Custodia',
  [TipoAudiencia.PRELIMINAR]: 'Audiencia Preliminar',
  [TipoAudiencia.ANPP]: 'ANPP',
  [TipoAudiencia.HOMOLOGACAO]: 'Homologacao',
  [TipoAudiencia.INSTRUCAO]: 'Instrucao',
  [TipoAudiencia.OUTRO]: 'Outro',
}

const CAMPOS_CONTEXTO = new Set<keyof ContextoModelo>([
  'numeroProcesso',
  'tipoAudiencia',
  'dataAudiencia',
  'horaAudiencia',
  'sala',
  'cargoMagistrado',
  'naturezaCrime',
  'dataHoje',
])

export function aplicarContexto(conteudo: string, contexto: ContextoModelo): string {
  if (!conteudo) return ''

  return conteudo.replace(REGEX_VARIAVEL, (_, nome: string) => {
    if (CAMPOS_CONTEXTO.has(nome as keyof ContextoModelo)) {
      const valor = contexto[nome as keyof ContextoModelo]
      return valor && valor.trim().length > 0 ? valor : `[${nome}]`
    }
    return `[${nome}]`
  })
}

export function extrairVariaveis(conteudo: string): string[] {
  if (!conteudo) return []

  const encontradas = new Set<string>()
  let match: RegExpExecArray | null = REGEX_VARIAVEL.exec(conteudo)
  while (match) {
    const nome = match[1]?.trim()
    if (nome) encontradas.add(nome)
    match = REGEX_VARIAVEL.exec(conteudo)
  }
  REGEX_VARIAVEL.lastIndex = 0
  return Array.from(encontradas)
}

export function contextoDeExemplo(): ContextoModelo {
  const hoje = new Date()
  return {
    numeroProcesso: '0001234-56.2024.4.01.3900',
    tipoAudiencia: 'Audiencia de Instrucao e Julgamento',
    dataAudiencia: format(hoje, 'dd/MM/yyyy'),
    horaAudiencia: '09:00',
    sala: 'Sala de Audiencias 1',
    cargoMagistrado: 'Juiz Federal',
    naturezaCrime: 'Trafico de entorpecentes',
    dataHoje: format(hoje, 'dd/MM/yyyy'),
  }
}

export function contextoDoProcesso(
  processo: Processo,
  fase2?: Fase2 | null,
): ContextoModelo {
  const dataAudiencia = fase2?.dataHoraInicio
  return {
    numeroProcesso: processo.numeroProcesso,
    tipoAudiencia: TIPO_AUDIENCIA_ROTULO[processo.tipoAudiencia],
    dataAudiencia: dataAudiencia ? format(dataAudiencia, 'dd/MM/yyyy') : undefined,
    horaAudiencia: dataAudiencia ? format(dataAudiencia, 'HH:mm') : undefined,
    sala: fase2?.sala,
    cargoMagistrado: processo.cargoMagistrado,
    naturezaCrime: processo.naturezaCrime,
    dataHoje: format(new Date(), 'dd/MM/yyyy'),
  }
}

