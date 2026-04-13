import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  isSameDay,
  set,
  startOfWeek,
} from 'date-fns'
import { db } from './firebase'
import { normalizarAudiencia, normalizarProcessoPendente } from './normalizarDados'
import { diaSemanaAtivo } from './audienciaHelpers'
import type {
  Audiencia,
  Configuracoes,
  Feriado,
  ProcessoPendente,
  Sala,
} from '../types'

interface IntervaloOcupado {
  inicio: Date
  fim: Date
}

export interface SlotSugerido {
  data: string
  hora: string
  salaId: string
  salaNome: string
  dataHoraInicioIso: string
  dataHoraFimIso: string
}

export interface SugestaoAutomatica {
  processo: ProcessoPendente
  slotSugerido: SlotSugerido
}

function parseHorario(horario: string | undefined, fallbackHora: number): {
  horas: number
  minutos: number
} {
  if (!horario || !horario.includes(':')) {
    return { horas: fallbackHora, minutos: 0 }
  }

  const [horas, minutos] = horario.split(':').map(Number)
  return {
    horas: Number.isFinite(horas) ? horas : fallbackHora,
    minutos: Number.isFinite(minutos) ? minutos : 0,
  }
}

function arredondarParaProximoBloco(data: Date, blocoMinutos = 15): Date {
  const resultado = new Date(data)
  resultado.setSeconds(0, 0)

  const resto = resultado.getMinutes() % blocoMinutos
  if (resto !== 0) {
    resultado.setMinutes(resultado.getMinutes() + (blocoMinutos - resto))
  }

  return resultado
}

function dataEhBloqueada(data: Date, feriados: Feriado[]): boolean {
  return feriados.some((feriado) => {
    const dataFeriado = feriado.data.toDate()

    if (feriado.recorrente) {
      return (
        data.getDate() === dataFeriado.getDate() &&
        data.getMonth() === dataFeriado.getMonth()
      )
    }

    return isSameDay(data, dataFeriado)
  })
}

function chaveSalaDia(salaId: string, data: Date): string {
  return `${salaId}::${data.toISOString().slice(0, 10)}`
}

function obterIntervalosOrdenados(
  ocupacao: Map<string, IntervaloOcupado[]>,
  salaId: string,
  data: Date,
): IntervaloOcupado[] {
  return [...(ocupacao.get(chaveSalaDia(salaId, data)) ?? [])].sort(
    (a, b) => a.inicio.getTime() - b.inicio.getTime(),
  )
}

function registrarOcupacao(
  ocupacao: Map<string, IntervaloOcupado[]>,
  salaId: string,
  data: Date,
  inicio: Date,
  fim: Date,
) {
  const chave = chaveSalaDia(salaId, data)
  const atual = ocupacao.get(chave) ?? []
  atual.push({ inicio, fim })
  ocupacao.set(chave, atual)
}

function montarJanelaDia(
  data: Date,
  config: Pick<
    Configuracoes,
    'horarioInicioPauta' | 'horarioFimPauta' | 'diasSemanaAtivos'
  >,
  agora: Date,
): { inicio: Date; fim: Date } | null {
  if (!diaSemanaAtivo(data.getDay(), config.diasSemanaAtivos)) {
    return null
  }

  const inicioConfig = parseHorario(config.horarioInicioPauta, 7)
  const fimConfig = parseHorario(config.horarioFimPauta, 19)

  const inicio = set(data, {
    hours: inicioConfig.horas,
    minutes: inicioConfig.minutos,
    seconds: 0,
    milliseconds: 0,
  })
  const fim = set(data, {
    hours: fimConfig.horas,
    minutes: fimConfig.minutos,
    seconds: 0,
    milliseconds: 0,
  })

  if (fim <= inicio) return null

  if (!isSameDay(data, agora)) {
    return { inicio, fim }
  }

  const inicioHoje = arredondarParaProximoBloco(agora)
  if (inicioHoje >= fim) return null

  return {
    inicio: inicioHoje > inicio ? inicioHoje : inicio,
    fim,
  }
}

function encontrarPrimeiroIntervaloLivre(params: {
  janelaInicio: Date
  janelaFim: Date
  duracaoMinutos: number
  ocupados: IntervaloOcupado[]
}): { inicio: Date; fim: Date } | null {
  const { janelaInicio, janelaFim, duracaoMinutos, ocupados } = params
  const duracaoMs = duracaoMinutos * 60 * 1000
  let cursor = janelaInicio

  for (const intervalo of ocupados) {
    if (intervalo.fim <= cursor) continue

    if (intervalo.inicio.getTime() - cursor.getTime() >= duracaoMs) {
      return {
        inicio: cursor,
        fim: new Date(cursor.getTime() + duracaoMs),
      }
    }

    if (intervalo.inicio <= cursor && intervalo.fim > cursor) {
      cursor = intervalo.fim
    }
  }

  if (janelaFim.getTime() - cursor.getTime() >= duracaoMs) {
    return {
      inicio: cursor,
      fim: new Date(cursor.getTime() + duracaoMs),
    }
  }

  return null
}

export async function gerarSugestoesAutomaticas(): Promise<SugestaoAutomatica[]> {
  const agora = new Date()
  const inicioBusca = startOfWeek(agora, { weekStartsOn: 1 })
  const fimBusca = endOfWeek(addWeeks(agora, 1), { weekStartsOn: 1 })

  const [configSnap, pendentesSnap, salasSnap, feriadosSnap, audienciasSnap] =
    await Promise.all([
      getDoc(doc(db, 'configuracoes', 'sistema')),
      getDocs(
        query(
          collection(db, 'processos_pendentes'),
          where('situacao', '==', 'aguardando'),
        ),
      ),
      getDocs(query(collection(db, 'salas'), where('ativa', '==', true))),
      getDocs(collection(db, 'feriados')),
      getDocs(
        query(
          collection(db, 'audiencias'),
          where('dataHoraInicio', '>=', Timestamp.fromDate(inicioBusca)),
          where('dataHoraInicio', '<=', Timestamp.fromDate(fimBusca)),
        ),
      ),
    ])

  const config = (configSnap.data() ?? {}) as Partial<Configuracoes>
  const configuracoes: Pick<
    Configuracoes,
    'horarioInicioPauta' | 'horarioFimPauta' | 'diasSemanaAtivos'
  > = {
    horarioInicioPauta: config.horarioInicioPauta ?? '07:00',
    horarioFimPauta: config.horarioFimPauta ?? '19:00',
    diasSemanaAtivos: config.diasSemanaAtivos?.length
      ? config.diasSemanaAtivos
      : [1, 2, 3, 4, 5],
  }

  const pendentes = pendentesSnap.docs
    .map((item) => normalizarProcessoPendente(item.id, item.data()))
    .sort((a, b) => {
      if (a.reuPreso !== b.reuPreso) return a.reuPreso ? -1 : 1
      return a.dataInclusao.toDate().getTime() - b.dataInclusao.toDate().getTime()
    })

  const salas = salasSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Sala)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  const feriados = feriadosSnap.docs.map(
    (item) => ({ id: item.id, ...item.data() }) as Feriado,
  )

  const audiencias = audienciasSnap.docs
    .map((item) => normalizarAudiencia(item.id, item.data()))
    .filter(
      (audiencia) =>
        audiencia.status !== 'cancelada' && audiencia.status !== 'redesignada',
    )

  const ocupacao = new Map<string, IntervaloOcupado[]>()
  audiencias.forEach((audiencia: Audiencia) => {
    registrarOcupacao(
      ocupacao,
      audiencia.salaId,
      audiencia.dataHoraInicio.toDate(),
      audiencia.dataHoraInicio.toDate(),
      audiencia.dataHoraFim.toDate(),
    )
  })

  const diasCandidatos = eachDayOfInterval({ start: agora, end: fimBusca })
  const sugestoes: SugestaoAutomatica[] = []

  for (const processo of pendentes) {
    const duracaoMinutos = Math.max(15, processo.minutosEstimados || 60)
    let sugestaoEncontrada: SugestaoAutomatica | null = null

    for (const dia of diasCandidatos) {
      if (dataEhBloqueada(dia, feriados)) continue

      const janelaDia = montarJanelaDia(dia, configuracoes, agora)
      if (!janelaDia) continue

      for (const sala of salas) {
        const intervaloLivre = encontrarPrimeiroIntervaloLivre({
          janelaInicio: janelaDia.inicio,
          janelaFim: janelaDia.fim,
          duracaoMinutos,
          ocupados: obterIntervalosOrdenados(ocupacao, sala.id, dia),
        })

        if (!intervaloLivre) continue

        registrarOcupacao(
          ocupacao,
          sala.id,
          dia,
          intervaloLivre.inicio,
          intervaloLivre.fim,
        )

        sugestaoEncontrada = {
          processo,
          slotSugerido: {
            data: intervaloLivre.inicio.toISOString().slice(0, 10),
            hora: intervaloLivre.inicio.toTimeString().slice(0, 5),
            salaId: sala.id,
            salaNome: sala.nome,
            dataHoraInicioIso: intervaloLivre.inicio.toISOString(),
            dataHoraFimIso: intervaloLivre.fim.toISOString(),
          },
        }
        break
      }

      if (sugestaoEncontrada) break
    }

    if (sugestaoEncontrada) {
      sugestoes.push(sugestaoEncontrada)
    }
  }

  return sugestoes
}
