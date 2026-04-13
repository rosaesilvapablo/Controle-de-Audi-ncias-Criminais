import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as admin from 'firebase-admin'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import nodemailer from 'nodemailer'
import {
  gerarAssuntoAlertaAudiencias,
  gerarHtmlAlertaAudiencias,
  type AlertaAudienciaEmailItem,
} from '../../src/lib/emailTemplates'

admin.initializeApp()

const SMTP_HOST = defineSecret('SMTP_HOST')
const SMTP_PORT = defineSecret('SMTP_PORT')
const SMTP_USER = defineSecret('SMTP_USER')
const SMTP_PASS = defineSecret('SMTP_PASS')
const SMTP_FROM = defineSecret('SMTP_FROM')
const SMTP_SECURE = defineSecret('SMTP_SECURE')

type StatusAudiencia =
  | 'agendada'
  | 'em_andamento'
  | 'realizada'
  | 'redesignada'
  | 'cancelada'
  | 'suspensa'

type TipoAudiencia =
  | 'instrucao'
  | 'interrogatorio'
  | 'oitiva'
  | 'julgamento'
  | 'audiencia_una'
  | 'sessao_juri'
  | 'outro'

interface TimestampLike {
  toDate: () => Date
}

interface AudienciaDoc {
  numeroProcesso?: string
  tipo?: TipoAudiencia
  dataHoraInicio?: TimestampLike
  status?: StatusAudiencia
  reuPreso?: boolean
  salaNome?: string
}

interface ProcedimentoDoc {
  audienciaId?: string
  itensCriticosPendentes?: number
}

interface ConfiguracoesDoc {
  emailNotificacoes?: string
  nomeVara?: string
}

const TIPO_AUDIENCIA_LABELS: Record<TipoAudiencia, string> = {
  instrucao: 'Instrução',
  interrogatorio: 'Interrogatório',
  oitiva: 'Oitiva',
  julgamento: 'Julgamento',
  audiencia_una: 'Audiência una',
  sessao_juri: 'Sessão do júri',
  outro: 'Outro',
}

function normalizarBoolean(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true'
}

function iniciarTransport() {
  const host = SMTP_HOST.value()
  const port = Number(SMTP_PORT.value() || '587')
  const user = SMTP_USER.value()
  const pass = SMTP_PASS.value()
  const from = SMTP_FROM.value()
  const secure = normalizarBoolean(SMTP_SECURE.value())

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      'Configuração SMTP incompleta. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.',
    )
  }

  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
    from,
  }
}

function obterMotivoAlerta(dataAudiencia: Date, agora: Date): string {
  const amanha = new Date(agora)
  amanha.setDate(agora.getDate() + 1)

  if (isSameDay(dataAudiencia, amanha)) {
    return 'Audiência agendada para o dia seguinte com checklist incompleto'
  }

  return 'Audiência de réu preso agendada nas próximas 48h com pendências críticas'
}

export const enviarAlertasAudienciasCriticas = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE],
  },
  async () => {
    const db = admin.firestore()
    const agora = new Date()
    const limite = new Date(agora.getTime() + 48 * 60 * 60 * 1000)

    const [configSnap, audienciasSnap, procedimentosSnap] = await Promise.all([
      db.doc('configuracoes/sistema').get(),
      db
        .collection('audiencias')
        .where('status', '==', 'agendada')
        .where('dataHoraInicio', '>=', admin.firestore.Timestamp.fromDate(agora))
        .where('dataHoraInicio', '<=', admin.firestore.Timestamp.fromDate(limite))
        .get(),
      db
        .collection('procedimentos')
        .where('itensCriticosPendentes', '>', 0)
        .get(),
    ])

    if (!configSnap.exists) {
      logger.warn('configuracoes/sistema não encontrado; alerta não enviado.')
      return
    }

    const config = configSnap.data() as ConfiguracoesDoc
    if (!config.emailNotificacoes) {
      logger.info('emailNotificacoes não configurado; alerta não enviado.')
      return
    }

    const procedimentosPorAudiencia = new Map<string, ProcedimentoDoc>()
    procedimentosSnap.docs.forEach((doc) => {
      const dados = doc.data() as ProcedimentoDoc
      if (dados.audienciaId) procedimentosPorAudiencia.set(dados.audienciaId, dados)
    })

    const itens: AlertaAudienciaEmailItem[] = audienciasSnap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as AudienciaDoc) }))
      .map((audiencia) => {
        const procedimento = procedimentosPorAudiencia.get(audiencia.id)
        if (!audiencia.dataHoraInicio || !procedimento?.itensCriticosPendentes) {
          return null
        }

        const dataHora = audiencia.dataHoraInicio.toDate()
        const motivo = obterMotivoAlerta(dataHora, agora)

        if (motivo.includes('réu preso') && audiencia.reuPreso !== true) {
          return null
        }

        return {
          numeroProcesso: audiencia.numeroProcesso ?? 'Processo não informado',
          tipoAudiencia: TIPO_AUDIENCIA_LABELS[audiencia.tipo ?? 'outro'],
          horario: format(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
          sala: audiencia.salaNome ?? 'Sala não informada',
          itensCriticosPendentes: procedimento.itensCriticosPendentes,
          motivo,
        }
      })
      .filter((item): item is AlertaAudienciaEmailItem => item !== null)

    if (itens.length === 0) {
      logger.info('Nenhuma audiência crítica encontrada para envio de alerta.')
      return
    }

    const { transport, from } = iniciarTransport()
    const dataReferencia = format(agora, 'dd/MM/yyyy', { locale: ptBR })
    const vara = config.nomeVara || '4ª Vara Federal Criminal'

    await transport.sendMail({
      from,
      to: config.emailNotificacoes,
      subject: gerarAssuntoAlertaAudiencias(itens.length, dataReferencia),
      html: gerarHtmlAlertaAudiencias({
        dataReferencia,
        vara,
        itens,
      }),
    })

    logger.info('Alerta de audiências críticas enviado com sucesso.', {
      destinatario: config.emailNotificacoes,
      quantidade: itens.length,
    })
  },
)
