import { differenceInDays } from 'date-fns'
import type { Alerta, Intimacao, Prescricao, Processo } from '../types/core'
import { FormaIntimacao, TipoAlerta } from '../types/core'

export function calcularAlertasPrescricao(
  processoId: string,
  numeroProcesso: string,
  prescricao: Prescricao,
): Alerta[] {
  if (!prescricao.alertaAtivo || !prescricao.dataLimite) {
    return []
  }

  const hoje = new Date()
  const dias = differenceInDays(prescricao.dataLimite, hoje)

  if (dias < 0) {
    return [{
      tipo: TipoAlerta.PRESCRICAO_VENCIDA,
      processoId,
      numeroProcesso,
      dataReferencia: prescricao.dataLimite,
      mensagem: 'Prescrição vencida.',
    }]
  }

  if (dias <= 7) {
    return [{
      tipo: TipoAlerta.PRESCRICAO_7_DIAS,
      processoId,
      numeroProcesso,
      dataReferencia: prescricao.dataLimite,
      mensagem: `Prescrição em ${dias} dia(s).`,
    }]
  }

  if (dias <= 30) {
    return [{
      tipo: TipoAlerta.PRESCRICAO_30_DIAS,
      processoId,
      numeroProcesso,
      dataReferencia: prescricao.dataLimite,
      mensagem: `Prescrição em ${dias} dia(s).`,
    }]
  }

  if (dias <= 90) {
    return [{
      tipo: TipoAlerta.PRESCRICAO_90_DIAS,
      processoId,
      numeroProcesso,
      dataReferencia: prescricao.dataLimite,
      mensagem: `Prescrição em ${dias} dia(s).`,
    }]
  }

  return []
}

export function calcularAlertasCartaPrecatoria(
  processoId: string,
  numeroProcesso: string,
  intimacoes: Intimacao[],
): Alerta[] {
  const hoje = new Date()

  return intimacoes.flatMap<Alerta>((intimacao) => {
    if (
      intimacao.tipo !== FormaIntimacao.CARTA_PRECATORIA ||
      !intimacao.dataRemessa ||
      intimacao.dataDevolvida
    ) {
      return []
    }

    const dias = differenceInDays(hoje, intimacao.dataRemessa)

    if (dias >= 40) {
      return [{
        tipo: TipoAlerta.CARTA_PRECATORIA_40_DIAS,
        processoId,
        numeroProcesso,
        participanteId: intimacao.participanteId,
        participanteNome: intimacao.participanteNome,
        dataReferencia: intimacao.dataRemessa,
        diasDecorridos: dias,
        mensagem: `Carta precatória sem devolução há ${dias} dia(s).`,
      }]
    }

    if (dias >= 30) {
      return [{
        tipo: TipoAlerta.CARTA_PRECATORIA_30_DIAS,
        processoId,
        numeroProcesso,
        participanteId: intimacao.participanteId,
        participanteNome: intimacao.participanteNome,
        dataReferencia: intimacao.dataRemessa,
        diasDecorridos: dias,
        mensagem: `Carta precatória em alerta há ${dias} dia(s).`,
      }]
    }

    return []
  })
}

const SEVERIDADE: Record<TipoAlerta, number> = {
  [TipoAlerta.PRESCRICAO_VENCIDA]: 0,
  [TipoAlerta.CARTA_PRECATORIA_40_DIAS]: 0,
  [TipoAlerta.PRESCRICAO_7_DIAS]: 1,
  [TipoAlerta.PRESCRICAO_30_DIAS]: 1,
  [TipoAlerta.CARTA_PRECATORIA_30_DIAS]: 1,
  [TipoAlerta.PRESCRICAO_90_DIAS]: 2,
  [TipoAlerta.INTIMACAO_PENDENTE]: 3,
  [TipoAlerta.FASE_COM_PENDENCIA]: 3,
}

export function consolidarAlertas(
  processo: Processo,
  intimacoes: Intimacao[],
): Alerta[] {
  return [
    ...calcularAlertasPrescricao(
      processo.id,
      processo.numeroProcesso,
      processo.prescricao,
    ),
    ...calcularAlertasCartaPrecatoria(
      processo.id,
      processo.numeroProcesso,
      intimacoes,
    ),
  ].sort((a, b) => SEVERIDADE[a.tipo] - SEVERIDADE[b.tipo])
}
