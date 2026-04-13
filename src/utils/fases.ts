import { StatusFase, type Fase2, type Fase3 } from '../types/core'

export function calcularStatusFase3(
  fase3: Fase3 | null,
  totalIntimacoesPendentes: number,
): StatusFase {
  if (!fase3) return StatusFase.NAO_INICIADA

  if (typeof fase3.realizada === 'undefined') {
    return StatusFase.EM_ANDAMENTO
  }

  if (fase3.realizada) {
    const checklist = fase3.checklistRealizacao
    if (!checklist) return StatusFase.EM_ANDAMENTO

    const todosMarcados = checklist.ataAssinada
      && checklist.midiaJuntada
      && checklist.cadastroPjeRealizado
      && checklist.intimacoesRealizadas
      && checklist.etiquetaPjeAtualizada

    if (!todosMarcados) return StatusFase.EM_ANDAMENTO
    if (totalIntimacoesPendentes > 0) return StatusFase.COM_PENDENCIA
    return StatusFase.CONCLUIDA
  }

  if (!fase3.motivoNaoRealizacao) return StatusFase.EM_ANDAMENTO
  const checklist = fase3.checklistNaoRealizacao
  if (!checklist) return StatusFase.EM_ANDAMENTO

  const todosMarcados = checklist.calendarioAtualizado
    && checklist.relatorioIntimacoesElaborado
    && checklist.etiquetaPjeAtualizada

  return todosMarcados ? StatusFase.CONCLUIDA : StatusFase.EM_ANDAMENTO
}

export function calcularStatusFase2(
  fase2: Fase2 | null,
  totalParticipantes: number,
  totalIntimacoesPendentes: number,
): StatusFase {
  if (!fase2) return StatusFase.NAO_INICIADA

  const checklistCompleto = fase2.checklist.linksEnviados && fase2.checklist.certidaoEnvioLink
  const checklistNaoAplicavel = totalParticipantes === 0
  const inicioDefinido = Boolean(fase2.dataHoraInicio)

  if (
    inicioDefinido
    && totalIntimacoesPendentes === 0
    && (checklistCompleto || checklistNaoAplicavel)
  ) {
    return StatusFase.CONCLUIDA
  }

  if (totalIntimacoesPendentes > 0) {
    return StatusFase.COM_PENDENCIA
  }

  const qualquerDado = Boolean(
    fase2.dataHoraInicio
    || fase2.dataHoraFim
    || fase2.sala
    || fase2.magistradoFase2
    || fase2.observacoes
    || fase2.checklist.linksEnviados
    || fase2.checklist.certidaoEnvioLink,
  )

  if (qualquerDado) return StatusFase.EM_ANDAMENTO
  return StatusFase.NAO_INICIADA
}

