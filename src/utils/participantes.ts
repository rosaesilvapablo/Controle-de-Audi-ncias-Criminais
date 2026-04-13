import {
  ArroladoPor,
  FormaIntimacao,
  FormaParticipacao,
  TipoDefesa,
  TipoParticipante,
  type Participante,
  type ParticipanteDetalhes,
} from '../types/core'

export function camposAplicaveis(
  tipo: TipoParticipante,
): (keyof ParticipanteDetalhes)[] {
  switch (tipo) {
    case TipoParticipante.REU:
      return ['preso', 'tipoDefesa', 'nomeAdvogado']
    case TipoParticipante.VITIMA:
      return ['menor', 'possuiRepresentante', 'nomeRepresentante']
    case TipoParticipante.TESTEMUNHA:
    case TipoParticipante.INFORMANTE:
      return ['arroladoPor', 'reuVinculadoId', 'atoOrdinatorioIntimado']
    case TipoParticipante.PERITO:
      return ['especialidade', 'orgaoVinculo']
    case TipoParticipante.TRADUTOR:
      return ['idioma', 'linguagem']
    case TipoParticipante.ASSISTENTE_ACUSACAO:
      return ['nomeAdvogado']
    case TipoParticipante.OUTRO:
      return []
    default:
      return []
  }
}

export function requerIntimacao(p: Participante): boolean {
  return p.formaIntimacao !== FormaIntimacao.NAO_REQUER_INTIMACAO
}

export function pessoOrdemTipo(tipo: TipoParticipante): number {
  switch (tipo) {
    case TipoParticipante.REU:
      return 1
    case TipoParticipante.VITIMA:
      return 2
    case TipoParticipante.TESTEMUNHA:
      return 3
    case TipoParticipante.INFORMANTE:
      return 4
    case TipoParticipante.ASSISTENTE_ACUSACAO:
      return 5
    case TipoParticipante.PERITO:
      return 6
    case TipoParticipante.TRADUTOR:
      return 7
    case TipoParticipante.OUTRO:
    default:
      return 8
  }
}

export function metadadosTipo(tipo: TipoParticipante): {
  rotulo: string
  icone: string
} {
  switch (tipo) {
    case TipoParticipante.REU:
      return { rotulo: 'Reu', icone: 'user' }
    case TipoParticipante.VITIMA:
      return { rotulo: 'Vitima', icone: 'heart' }
    case TipoParticipante.TESTEMUNHA:
      return { rotulo: 'Testemunha', icone: 'message-square' }
    case TipoParticipante.PERITO:
      return { rotulo: 'Perito', icone: 'microscope' }
    case TipoParticipante.TRADUTOR:
      return { rotulo: 'Tradutor', icone: 'languages' }
    case TipoParticipante.INFORMANTE:
      return { rotulo: 'Informante', icone: 'info' }
    case TipoParticipante.ASSISTENTE_ACUSACAO:
      return { rotulo: 'Assistente de acusacao', icone: 'briefcase' }
    case TipoParticipante.OUTRO:
    default:
      return { rotulo: 'Outro', icone: 'more-horizontal' }
  }
}

export function validarParticipante(
  p: Partial<Participante>,
): string[] {
  const erros: string[] = []

  if (!p.nome || p.nome.trim().length < 2) {
    erros.push('Nome completo e obrigatorio (minimo de 2 caracteres).')
  }

  if (!p.tipo) {
    erros.push('Tipo de participante e obrigatorio.')
  }

  if (p.tipo === TipoParticipante.OUTRO && (!p.outroDescricao || p.outroDescricao.trim().length < 3)) {
    erros.push('Especifique o tipo quando participante for "Outro".')
  }

  if (!p.formaParticipacao) {
    erros.push('Forma de participacao e obrigatoria.')
  }

  if (!p.formaIntimacao) {
    erros.push('Forma de intimacao e obrigatoria.')
  }

  if (p.tipo === TipoParticipante.REU && !p.tipoDefesa) {
    erros.push('Tipo de defesa e obrigatorio para reu.')
  }

  if (
    (p.tipo === TipoParticipante.TESTEMUNHA || p.tipo === TipoParticipante.INFORMANTE)
    && !p.arroladoPor
  ) {
    erros.push('Arrolado por e obrigatorio para testemunha/informante.')
  }

  if (p.formaIntimacao === FormaIntimacao.CARTA_PRECATORIA && !p.dataRemessa) {
    erros.push('Data de remessa e obrigatoria para carta precatoria.')
  }

  return erros
}

function rotuloFormaParticipacao(forma?: FormaParticipacao) {
  switch (forma) {
    case FormaParticipacao.PRESENCIAL:
      return 'Presencial'
    case FormaParticipacao.VIRTUAL:
      return 'Virtual'
    case FormaParticipacao.A_DEFINIR:
      return 'A definir'
    default:
      return 'A definir'
  }
}

function rotuloTipoDefesa(defesa?: TipoDefesa, nomeAdvogado?: string) {
  if (defesa === TipoDefesa.DEFENSORIA) return 'Defensoria Publica'
  if (defesa === TipoDefesa.ADVOGADO_CONSTITUIDO) {
    return nomeAdvogado?.trim() ? `Adv. ${nomeAdvogado.trim()}` : 'Advogado constituido'
  }
  if (defesa === TipoDefesa.ADVOGADO_DATIVO) {
    return nomeAdvogado?.trim() ? `Adv. ${nomeAdvogado.trim()}` : 'Advogado dativo'
  }
  return null
}

function rotuloArroladoPor(arroladoPor?: ArroladoPor) {
  switch (arroladoPor) {
    case ArroladoPor.MPF:
      return 'MPF'
    case ArroladoPor.DEFESA:
      return 'Defesa'
    case ArroladoPor.JUIZO:
      return 'Juizo'
    default:
      return null
  }
}

export function resumoParticipante(p: Participante): string {
  const partes: string[] = [rotuloFormaParticipacao(p.formaParticipacao)]

  if (p.tipo === TipoParticipante.REU) {
    const defesa = rotuloTipoDefesa(p.tipoDefesa, p.nomeAdvogado)
    if (defesa) partes.push(defesa)
  }

  if (
    (p.tipo === TipoParticipante.TESTEMUNHA || p.tipo === TipoParticipante.INFORMANTE)
    && p.formaIntimacao === FormaIntimacao.CARTA_PRECATORIA
  ) {
    partes.push('Carta precatoria')
  }

  if (p.tipo === TipoParticipante.TESTEMUNHA || p.tipo === TipoParticipante.INFORMANTE) {
    const arrolado = rotuloArroladoPor(p.arroladoPor)
    if (arrolado) partes.push(arrolado)
  }

  if (p.tipo === TipoParticipante.PERITO && p.orgaoVinculo?.trim()) {
    partes.push(p.orgaoVinculo.trim())
  }

  if (p.tipo === TipoParticipante.TRADUTOR) {
    if (p.linguagem?.trim()) {
      partes.push(p.linguagem.trim())
    } else if (p.idioma?.trim()) {
      partes.push(p.idioma.trim())
    }
  }

  if (p.tipo === TipoParticipante.OUTRO && p.outroDescricao?.trim()) {
    partes.push(p.outroDescricao.trim())
  }

  return partes.join(' · ')
}

export function corDestaqueTipo(tipo: TipoParticipante): string {
  switch (tipo) {
    case TipoParticipante.REU:
      return 'var(--color-primary)'
    case TipoParticipante.VITIMA:
      return 'var(--color-red)'
    case TipoParticipante.TESTEMUNHA:
      return 'var(--color-green)'
    case TipoParticipante.PERITO:
    case TipoParticipante.TRADUTOR:
      return '#4A9EBF'
    case TipoParticipante.INFORMANTE:
    case TipoParticipante.ASSISTENTE_ACUSACAO:
      return 'var(--color-amber)'
    case TipoParticipante.OUTRO:
    default:
      return '#888888'
  }
}
