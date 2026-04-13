import type { Perfil } from '../types'

export type AcaoPermissao =
  | 'editar_checklist'
  | 'gerenciar_participantes_documentos'
  | 'gerenciar_salas'
  | 'gerenciar_feriados'

export function temPermissao(
  perfil: Perfil | undefined,
  acao: AcaoPermissao,
): boolean {
  if (!perfil) return false

  switch (acao) {
    case 'editar_checklist':
      return perfil !== 'estagiario' && perfil !== 'convidado'
    case 'gerenciar_participantes_documentos':
      return perfil !== 'estagiario' && perfil !== 'convidado'
    case 'gerenciar_salas':
      return (
        perfil === 'diretor' ||
        perfil === 'supervisor' ||
        perfil === 'servidor'
      )
    case 'gerenciar_feriados':
      return (
        perfil === 'diretor' ||
        perfil === 'supervisor' ||
        perfil === 'servidor'
      )
    default:
      return false
  }
}

export function isForaDoExpediente(
  horaInicio: string,
  expedienteInicio: string,
  expedienteFim: string,
): boolean {
  const paraMinutos = (valor: string) => {
    const [horas, minutos] = valor.split(':').map(Number)
    return horas * 60 + minutos
  }

  const inicioAudiencia = paraMinutos(horaInicio)
  const inicioExpediente = paraMinutos(expedienteInicio)
  const fimExpediente = paraMinutos(expedienteFim)

  return (
    inicioAudiencia < inicioExpediente ||
    inicioAudiencia >= fimExpediente
  )
}
