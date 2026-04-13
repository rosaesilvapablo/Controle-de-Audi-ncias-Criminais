"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarAlertasAudienciasCriticas = void 0;
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const emailTemplates_1 = require("../../src/lib/emailTemplates");
admin.initializeApp();
const SMTP_HOST = (0, params_1.defineSecret)('SMTP_HOST');
const SMTP_PORT = (0, params_1.defineSecret)('SMTP_PORT');
const SMTP_USER = (0, params_1.defineSecret)('SMTP_USER');
const SMTP_PASS = (0, params_1.defineSecret)('SMTP_PASS');
const SMTP_FROM = (0, params_1.defineSecret)('SMTP_FROM');
const SMTP_SECURE = (0, params_1.defineSecret)('SMTP_SECURE');
const TIPO_AUDIENCIA_LABELS = {
    instrucao: 'Instrução',
    interrogatorio: 'Interrogatório',
    oitiva: 'Oitiva',
    julgamento: 'Julgamento',
    audiencia_una: 'Audiência una',
    sessao_juri: 'Sessão do júri',
    outro: 'Outro',
};
function normalizarBoolean(value) {
    return value?.toLowerCase() === 'true';
}
function iniciarTransport() {
    const host = SMTP_HOST.value();
    const port = Number(SMTP_PORT.value() || '587');
    const user = SMTP_USER.value();
    const pass = SMTP_PASS.value();
    const from = SMTP_FROM.value();
    const secure = normalizarBoolean(SMTP_SECURE.value());
    if (!host || !port || !user || !pass || !from) {
        throw new Error('Configuração SMTP incompleta. Defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM.');
    }
    return {
        transport: nodemailer_1.default.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
        }),
        from,
    };
}
function obterMotivoAlerta(dataAudiencia, agora) {
    const amanha = new Date(agora);
    amanha.setDate(agora.getDate() + 1);
    if ((0, date_fns_1.isSameDay)(dataAudiencia, amanha)) {
        return 'Audiência agendada para o dia seguinte com checklist incompleto';
    }
    return 'Audiência de réu preso agendada nas próximas 48h com pendências críticas';
}
exports.enviarAlertasAudienciasCriticas = (0, scheduler_1.onSchedule)({
    schedule: '0 7 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE],
}, async () => {
    const db = admin.firestore();
    const agora = new Date();
    const limite = new Date(agora.getTime() + 48 * 60 * 60 * 1000);
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
    ]);
    if (!configSnap.exists) {
        logger.warn('configuracoes/sistema não encontrado; alerta não enviado.');
        return;
    }
    const config = configSnap.data();
    if (!config.emailNotificacoes) {
        logger.info('emailNotificacoes não configurado; alerta não enviado.');
        return;
    }
    const procedimentosPorAudiencia = new Map();
    procedimentosSnap.docs.forEach((doc) => {
        const dados = doc.data();
        if (dados.audienciaId)
            procedimentosPorAudiencia.set(dados.audienciaId, dados);
    });
    const itens = audienciasSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .map((audiencia) => {
        const procedimento = procedimentosPorAudiencia.get(audiencia.id);
        if (!audiencia.dataHoraInicio || !procedimento?.itensCriticosPendentes) {
            return null;
        }
        const dataHora = audiencia.dataHoraInicio.toDate();
        const motivo = obterMotivoAlerta(dataHora, agora);
        if (motivo.includes('réu preso') && audiencia.reuPreso !== true) {
            return null;
        }
        return {
            numeroProcesso: audiencia.numeroProcesso ?? 'Processo não informado',
            tipoAudiencia: TIPO_AUDIENCIA_LABELS[audiencia.tipo ?? 'outro'],
            horario: (0, date_fns_1.format)(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: locale_1.ptBR }),
            sala: audiencia.salaNome ?? 'Sala não informada',
            itensCriticosPendentes: procedimento.itensCriticosPendentes,
            motivo,
        };
    })
        .filter((item) => item !== null);
    if (itens.length === 0) {
        logger.info('Nenhuma audiência crítica encontrada para envio de alerta.');
        return;
    }
    const { transport, from } = iniciarTransport();
    const dataReferencia = (0, date_fns_1.format)(agora, 'dd/MM/yyyy', { locale: locale_1.ptBR });
    const vara = config.nomeVara || '4ª Vara Federal Criminal';
    await transport.sendMail({
        from,
        to: config.emailNotificacoes,
        subject: (0, emailTemplates_1.gerarAssuntoAlertaAudiencias)(itens.length, dataReferencia),
        html: (0, emailTemplates_1.gerarHtmlAlertaAudiencias)({
            dataReferencia,
            vara,
            itens,
        }),
    });
    logger.info('Alerta de audiências críticas enviado com sucesso.', {
        destinatario: config.emailNotificacoes,
        quantidade: itens.length,
    });
});
