import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getApps, initializeApp } from 'firebase/app'
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  MetaCNJ,
  MotivoNaoRealizacao,
  StatusFase,
  TipoAudiencia,
  type Fase1,
  type Fase2,
  type Fase3,
  type Processo,
} from '../types/core'

const COLECOES = {
  PROCESSOS: 'processos',
} as const

const SUBCOLECOES = {
  FASE1: 'fase1',
  FASE2: 'fase2',
  FASE3: 'fase3',
} as const

const COLECOES_LEGADAS = {
  PROCESSOS_PENDENTES: 'processos_pendentes',
  AUDIENCIAS: 'audiencias',
  PROCEDIMENTOS: 'procedimentos',
} as const

type FirestoreDateLike = Date | Timestamp | { toDate: () => Date } | null | undefined

type ProcessoPendenteLegado = {
  numeroProcesso?: string
  cargoMagistrado?: string
  observacoes?: string
  dataInclusao?: FirestoreDateLike
  criadoEm?: FirestoreDateLike
  criadoPor?: string
  quantidadeReus?: number
  quantidadeTestemunhas?: number
  quantidadeOutros?: number
  tipoAudiencia?: string
}

type AudienciaLegada = {
  id?: string
  numeroProcesso?: string
  dataHoraInicio?: FirestoreDateLike
  dataHoraFim?: FirestoreDateLike
  salaNome?: string
  sala?: string
  observacoes?: string
  magistradoNome?: string
  tipo?: string
}

type ProcedimentoLegado = {
  audienciaId?: string
  numeroProcesso?: string
  status?: string
  progresso?: number
  observacoes?: string
}

function getFirebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  }
}

function carregarEnvLocal() {
  const caminhoEnv = resolve(process.cwd(), '.env')
  if (!existsSync(caminhoEnv)) return

  const conteudo = readFileSync(caminhoEnv, 'utf-8')
  for (const linha of conteudo.split(/\r?\n/)) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#')) continue

    const separador = limpa.indexOf('=')
    if (separador <= 0) continue

    const chave = limpa.slice(0, separador).trim()
    const valor = limpa.slice(separador + 1).trim()

    if (!process.env[chave]) {
      process.env[chave] = valor
    }
  }
}

function assertFirebaseConfig() {
  const firebaseConfig = getFirebaseConfig()
  const faltantes = Object.entries(firebaseConfig)
    .filter(([, valor]) => !valor)
    .map(([chave]) => chave)

  if (faltantes.length > 0) {
    throw new Error(
      `Variáveis Firebase ausentes para o script: ${faltantes.join(', ')}`,
    )
  }
}

function toDate(value: FirestoreDateLike, fallback = new Date()): Date {
  if (!value) return fallback
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return fallback
}

function normalizarNumeroProcesso(valor?: string): string {
  return String(valor ?? '').trim()
}

function mapearTipoAudiencia(valor?: string): TipoAudiencia {
  switch (valor) {
    case 'aij':
    case 'audiencia_una':
    case 'julgamento':
      return TipoAudiencia.AIJ
    case 'custodia':
      return TipoAudiencia.CUSTODIA
    case 'preliminar':
      return TipoAudiencia.PRELIMINAR
    case 'anpp':
      return TipoAudiencia.ANPP
    case 'homologacao':
      return TipoAudiencia.HOMOLOGACAO
    case 'instrucao':
    case 'interrogatorio':
    case 'oitiva':
      return TipoAudiencia.INSTRUCAO
    default:
      return TipoAudiencia.OUTRO
  }
}

function criarProcessoBase(
  id: string,
  legado: ProcessoPendenteLegado | undefined,
  audiencia: AudienciaLegada | undefined,
): Processo {
  const criadoEm = toDate(legado?.dataInclusao ?? legado?.criadoEm)
  const atualizadoEm = toDate(
    audiencia?.dataHoraInicio ?? legado?.dataInclusao ?? legado?.criadoEm,
    criadoEm,
  )

  return {
    id,
    numeroProcesso: normalizarNumeroProcesso(
      legado?.numeroProcesso ?? audiencia?.numeroProcesso,
    ),
    tipoAudiencia: mapearTipoAudiencia(legado?.tipoAudiencia ?? audiencia?.tipo),
    metaCNJ: MetaCNJ.SEM_META,
    cargoMagistrado: legado?.cargoMagistrado ?? 'Juiz Federal',
    prioridades: [],
    etiquetas: [],
    etiquetasSistemicas: [],
    prescricao: {
      alertaAtivo: true,
    },
    fases: {
      fase1: StatusFase.EM_ANDAMENTO,
      fase2: audiencia ? StatusFase.EM_ANDAMENTO : StatusFase.NAO_INICIADA,
      fase3: StatusFase.NAO_INICIADA,
    },
    totalParticipantes: 0,
    totalIntimacoesPendentes: 0,
    totalCartasPrecatoriasEmAlerta: 0,
    observacoes: legado?.observacoes,
    criadoEm,
    atualizadoEm,
    criadoPor: legado?.criadoPor ?? 'migracao_legado',
  }
}

function criarFase1Base(
  processoId: string,
  legado: ProcessoPendenteLegado | undefined,
  processo: Processo,
): Fase1 {
  return {
    id: 'fase1',
    processoId,
    quantidadeReus: Number(legado?.quantidadeReus ?? 0),
    quantidadeTestemunhas: Number(legado?.quantidadeTestemunhas ?? 0),
    quantidadeOutros: Number(legado?.quantidadeOutros ?? 0),
    checklist: {
      minutaDespachoElaborada: false,
      audienciaCadastradaCalendario: false,
      relatorioIntimacoeselaborado: false,
      etiquetaPjeAtualizada: false,
    },
    observacoes: legado?.observacoes,
    criadoEm: processo.criadoEm,
    atualizadoEm: processo.atualizadoEm,
  }
}

function criarFase2Base(
  processoId: string,
  processo: Processo,
  audiencia: AudienciaLegada | undefined,
): Fase2 {
  return {
    id: 'fase2',
    processoId,
    dataHoraInicio: audiencia?.dataHoraInicio ? toDate(audiencia.dataHoraInicio) : undefined,
    dataHoraFim: audiencia?.dataHoraFim ? toDate(audiencia.dataHoraFim) : undefined,
    sala: audiencia?.sala ?? audiencia?.salaNome,
    magistradoFase2: audiencia?.magistradoNome,
    checklist: {
      linksEnviados: false,
      certidaoEnvioLink: false,
    },
    observacoes: audiencia?.observacoes,
    criadoEm: processo.criadoEm,
    atualizadoEm: processo.atualizadoEm,
  }
}

function criarFase3Base(
  processoId: string,
  processo: Processo,
  procedimento: ProcedimentoLegado | undefined,
): Fase3 {
  const concluido = procedimento?.status === 'concluido'

  return {
    id: 'fase3',
    processoId,
    realizada: concluido ? true : undefined,
    checklistRealizacao: concluido
      ? {
          ataAssinada: false,
          midiaJuntada: false,
          cadastroPjeRealizado: false,
          intimacoesRealizadas: false,
          etiquetaPjeAtualizada: false,
        }
      : undefined,
    motivoNaoRealizacao:
      procedimento?.status === 'com_pendencias_criticas'
        ? MotivoNaoRealizacao.REDESIGNACAO
        : undefined,
    observacoes: procedimento?.observacoes,
    criadoEm: processo.criadoEm,
    atualizadoEm: processo.atualizadoEm,
  }
}

async function migrar() {
  carregarEnvLocal()
  assertFirebaseConfig()
  const firebaseConfig = getFirebaseConfig()

  const app = getApps()[0] ?? initializeApp(firebaseConfig)
  const db = getFirestore(app)

  const [pendentesSnap, audienciasSnap, procedimentosSnap] = await Promise.all([
    getDocs(collection(db, COLECOES_LEGADAS.PROCESSOS_PENDENTES)),
    getDocs(collection(db, COLECOES_LEGADAS.AUDIENCIAS)),
    getDocs(collection(db, COLECOES_LEGADAS.PROCEDIMENTOS)),
  ])

  const pendentesPorNumero = new Map<string, { id: string; dados: ProcessoPendenteLegado }>()
  const audienciasPorNumero = new Map<string, { id: string; dados: AudienciaLegada }>()
  const audienciasPorId = new Map<string, { id: string; dados: AudienciaLegada }>()
  const procedimentosPorNumero = new Map<string, { id: string; dados: ProcedimentoLegado }>()
  const procedimentosPorAudienciaId = new Map<string, { id: string; dados: ProcedimentoLegado }>()

  for (const item of pendentesSnap.docs) {
    const dados = item.data() as ProcessoPendenteLegado
    pendentesPorNumero.set(normalizarNumeroProcesso(dados.numeroProcesso), { id: item.id, dados })
  }

  for (const item of audienciasSnap.docs) {
    const dados = item.data() as AudienciaLegada
    audienciasPorNumero.set(normalizarNumeroProcesso(dados.numeroProcesso), { id: item.id, dados })
    audienciasPorId.set(item.id, { id: item.id, dados })
  }

  for (const item of procedimentosSnap.docs) {
    const dados = item.data() as ProcedimentoLegado
    procedimentosPorNumero.set(normalizarNumeroProcesso(dados.numeroProcesso), { id: item.id, dados })
    if (dados.audienciaId) {
      procedimentosPorAudienciaId.set(dados.audienciaId, { id: item.id, dados })
    }
  }

  const chaves = new Set<string>()
  pendentesSnap.docs.forEach((item) => chaves.add(item.id))

  for (const item of audienciasSnap.docs) {
    const numero = normalizarNumeroProcesso((item.data() as AudienciaLegada).numeroProcesso)
    const pendente = pendentesPorNumero.get(numero)
    chaves.add(pendente?.id ?? item.id)
  }

  for (const item of procedimentosSnap.docs) {
    const procedimento = item.data() as ProcedimentoLegado
    const numero = normalizarNumeroProcesso(procedimento.numeroProcesso)
    const pendente = pendentesPorNumero.get(numero)
    const audiencia = procedimento.audienciaId
      ? audienciasPorId.get(procedimento.audienciaId)
      : undefined
    chaves.add(pendente?.id ?? audiencia?.id ?? item.id)
  }

  let migrados = 0
  let pulados = 0
  let erros = 0

  for (const processoId of chaves) {
    try {
      const processoRef = doc(db, COLECOES.PROCESSOS, processoId)
      const existente = await getDoc(processoRef)
      if (existente.exists()) {
        console.log(`[migracao] Processo ${processoId} já existe. Pulando.`)
        continue
      }

      const pendente =
        pendentesSnap.docs.find((item) => item.id === processoId)?.data() as ProcessoPendenteLegado | undefined
      const numeroProcesso = normalizarNumeroProcesso(
        pendente?.numeroProcesso ??
          audienciasPorId.get(processoId)?.dados.numeroProcesso ??
          procedimentosSnap.docs.find((item) => item.id === processoId)?.data().numeroProcesso,
      )
      const audiencia =
        audienciasPorId.get(processoId)?.dados ??
        audienciasPorNumero.get(numeroProcesso)?.dados
      const procedimento =
        procedimentosPorAudienciaId.get(audienciasPorNumero.get(numeroProcesso)?.id ?? '')?.dados ??
        procedimentosPorNumero.get(numeroProcesso)?.dados

      const processo = criarProcessoBase(processoId, pendente, audiencia)
      const fase1 = criarFase1Base(processoId, pendente, processo)
      const fase2 = criarFase2Base(processoId, processo, audiencia)
      const fase3 = criarFase3Base(processoId, processo, procedimento)

      await setDoc(processoRef, {
        ...processo,
        criadoEm: Timestamp.fromDate(processo.criadoEm),
        atualizadoEm: Timestamp.fromDate(processo.atualizadoEm),
        migratedAt: serverTimestamp(),
      })

      await setDoc(doc(db, COLECOES.PROCESSOS, processoId, SUBCOLECOES.FASE1, SUBCOLECOES.FASE1), {
        ...fase1,
        criadoEm: Timestamp.fromDate(fase1.criadoEm),
        atualizadoEm: Timestamp.fromDate(fase1.atualizadoEm),
      })

      await setDoc(doc(db, COLECOES.PROCESSOS, processoId, SUBCOLECOES.FASE2, SUBCOLECOES.FASE2), {
        ...fase2,
        dataHoraInicio: fase2.dataHoraInicio ? Timestamp.fromDate(fase2.dataHoraInicio) : null,
        dataHoraFim: fase2.dataHoraFim ? Timestamp.fromDate(fase2.dataHoraFim) : null,
        criadoEm: Timestamp.fromDate(fase2.criadoEm),
        atualizadoEm: Timestamp.fromDate(fase2.atualizadoEm),
      })

      await setDoc(doc(db, COLECOES.PROCESSOS, processoId, SUBCOLECOES.FASE3, SUBCOLECOES.FASE3), {
        ...fase3,
        criadoEm: Timestamp.fromDate(fase3.criadoEm),
        atualizadoEm: Timestamp.fromDate(fase3.atualizadoEm),
      })

      console.log(`[migracao] Processo ${processoId} migrado com sucesso.`)
    } catch (error) {
      console.error(`[migracao] Erro ao migrar ${processoId}:`, error)
    }
  }
}

console.warn('─────────────────────────────────────────')
console.warn('SCRIPT DE MIGRAÇÃO — SOMENTE DESENVOLVIMENTO')
console.warn('Execute apenas com backup completo do Firestore.')
console.warn('Coleções legadas NÃO serão removidas por este script.')
console.warn('─────────────────────────────────────────')

void migrar()

