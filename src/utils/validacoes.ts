import { differenceInDays } from 'date-fns'

/**
 * Verifica se uma data de audiência está dentro do prazo
 * de antecedência recomendada (15 dias).
 * Retorna aviso - nunca bloqueia o agendamento.
 */
export function verificarAntecedencia(dataAudiencia: Date): {
  dentroDoPrazo: boolean
  diasRestantes: number
  mensagemAviso: string | null
} {
  const hoje = new Date()
  const diasAte = differenceInDays(dataAudiencia, hoje)

  if (diasAte < 0) {
    return {
      dentroDoPrazo: false,
      diasRestantes: diasAte,
      mensagemAviso: 'A data selecionada é anterior à data atual.',
    }
  }

  if (diasAte < 15) {
    return {
      dentroDoPrazo: false,
      diasRestantes: diasAte,
      mensagemAviso: `Esta audiência está sendo designada com ${diasAte} dia(s) de antecedência, abaixo do prazo recomendado de 15 dias. Deseja prosseguir mesmo assim?`,
    }
  }

  return {
    dentroDoPrazo: true,
    diasRestantes: diasAte,
    mensagemAviso: null,
  }
}
