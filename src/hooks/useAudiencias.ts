import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  Timestamp,
  getDocs,
  writeBatch,
  deleteField,
  type QueryConstraint,
} from 'firebase/firestore'
import { isSameDay } from 'date-fns'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { registrarAcao, registrarEdicao } from '../lib/auditoria'
import {
  diaSemanaAtivo,
  mensagemDiaSemanaInativo,
  validarTransicaoEstado,
} from '../lib/audienciaHelpers'
import {
  normalizarAudiencia,
  normalizarItem,
  normalizarProcedimento,
} from '../lib/normalizarDados'
import {
  buscarTemplateAtivoChecklist,
  gerarSnapshotParaProcedimentoChecklist,
} from './useChecklistTemplate'
import { garantirProcedimentoVinculado } from '../lib/vinculos'
import type {
  Audiencia,
  Procedimento,
  StatusAudiencia,
  TipoAudiencia,
  ProcedimentoItem,
  FaseProcedimento,
  ReuProcesso,
  AdvogadoProcesso,
} from '../types'

function valorComparable(valor: unknown): unknown {
  if (valor instanceof Timestamp) return valor.toMillis()
  if (Array.isArray(valor)) return valor.map((item) => valorComparable(item))
  if (valor && typeof valor === 'object') {
    if ('seconds' in (valor as Record<string, unknown>) && 'nanoseconds' in (valor as Record<string, unknown>)) {
      const timestamp = valor as { seconds: number; nanoseconds: number }
      return `${timestamp.seconds}:${timestamp.nanoseconds}`
    }

    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [
        chave,
        valorComparable(item),
      ]),
    )
  }

  return valor
}

function valoresDiferentes(valorAnterior: unknown, valorNovo: unknown) {
  return JSON.stringify(valorComparable(valorAnterior)) !== JSON.stringify(valorComparable(valorNovo))
}

function inferirMotivoRemarcacao(
  observacoesAnteriores?: string,
  observacoesNovas?: string,
) {
  const linhasNovas = String(observacoesNovas ?? '')
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
  const linhasAntigas = new Set(
    String(observacoesAnteriores ?? '')
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean),
  )

  const linhaMotivo = linhasNovas.find(
    (linha) =>
      linha.toLowerCase().startsWith('remarca') &&
      !linhasAntigas.has(linha),
  )

  if (!linhaMotivo) return ''
  const [, motivo] = linhaMotivo.split(':')
  return motivo?.trim() ?? linhaMotivo
}

async function registrarCamposAlterados(params: {
  colecao: string
  documentId: string
  antes: Record<string, unknown>
  depois: Record<string, unknown>
  usuarioUid: string
  usuarioNome: string
}) {
  await Promise.all(
    Object.entries(params.depois)
      .filter(([, valorNovo]) => valorNovo !== undefined)
      .filter(([campo, valorNovo]) => valoresDiferentes(params.antes[campo], valorNovo))
      .map(([campo, valorNovo]) =>
        registrarEdicao({
          colecao: params.colecao,
          documentId: params.documentId,
          campo,
          valorAnterior: params.antes[campo],
          valorNovo,
          usuarioUid: params.usuarioUid,
          usuarioNome: params.usuarioNome,
        }),
      ),
  )
}

type FallbackTemplateItem = Omit<ProcedimentoItem, 'id' | 'procedimentoId' | 'respondidoEm' | 'respondidoPor'>

function itemTemplate(
  fase: FaseProcedimento,
  ordem: number,
  descricao: string,
  obrigatorio: boolean,
  critico: boolean,
  resetarNaRemarcacao: boolean,
  tipoResposta: ProcedimentoItem['tipoResposta'],
): FallbackTemplateItem {
  return { fase, ordem, descricao, obrigatorio, critico, resetarNaRemarcacao, tipoResposta }
}

function selecionarTemplate(tipo: TipoAudiencia): FallbackTemplateItem[] {
  const instrucao = [
    itemTemplate(1, 1, 'Verificar presença das partes e advogados', true, true, true, 'sim_nao'),
    itemTemplate(1, 2, 'Conferir documentos de identificação', false, false, false, 'sim_nao'),
    itemTemplate(1, 3, 'Checar funcionamento do sistema de gravação', true, true, false, 'sim_nao'),
    itemTemplate(2, 1, 'Declarar aberta a audiência', true, true, false, 'sim_nao'),
    itemTemplate(2, 2, 'Registrar hora de início', true, true, true, 'texto'),
    itemTemplate(2, 3, 'Confirmar qualificação do réu', false, false, false, 'sim_nao'),
    itemTemplate(3, 1, 'Ouvir testemunhas e vítimas', false, false, false, 'sim_nao'),
    itemTemplate(3, 2, 'Interrogar o réu (se aplicável)', false, false, false, 'sim_nao'),
    itemTemplate(3, 3, 'Registrar identificação das peças no sistema', true, true, false, 'texto'),
    itemTemplate(3, 4, 'Colher assinaturas dos presentes', true, true, true, 'sim_nao'),
    itemTemplate(4, 1, 'Proferir decisão ou marcar nova data', true, true, false, 'sim_nao'),
    itemTemplate(4, 2, 'Registrar hora de encerramento', true, true, true, 'texto'),
    itemTemplate(4, 3, 'Encerrar gravação', false, false, false, 'sim_nao'),
    itemTemplate(5, 1, 'Lavrar ata ou termo no sistema', true, true, false, 'sim_nao'),
    itemTemplate(5, 2, 'Intimar as partes da decisão', true, true, true, 'sim_nao'),
    itemTemplate(5, 3, 'Arquivar mídia de gravação', false, false, false, 'sim_nao'),
  ]

  if (tipo === 'instrucao' || tipo === 'audiencia_una') return instrucao

  if (tipo === 'interrogatorio' || tipo === 'oitiva') {
    return [
      itemTemplate(1, 1, 'Verificar presença', true, true, true, 'sim_nao'),
      itemTemplate(1, 2, 'Checar gravação', true, true, false, 'sim_nao'),
      itemTemplate(2, 1, 'Declarar aberta', true, true, false, 'sim_nao'),
      itemTemplate(2, 2, 'Registrar hora de início', true, true, true, 'texto'),
      itemTemplate(3, 1, 'Realizar oitiva ou interrogatório', true, true, false, 'sim_nao'),
      itemTemplate(3, 2, 'Registrar peças no sistema', true, true, false, 'texto'),
      itemTemplate(4, 1, 'Registrar hora de encerramento', true, true, true, 'texto'),
      itemTemplate(5, 1, 'Lavrar termo no sistema', true, true, false, 'sim_nao'),
      itemTemplate(5, 2, 'Intimar as partes', true, true, true, 'sim_nao'),
    ]
  }

  if (tipo === 'julgamento' || tipo === 'sessao_juri') {
    return [
      ...instrucao.slice(0, 8),
      itemTemplate(3, 3, 'Verificar presença dos jurados (se Júri)', true, true, true, 'sim_nao'),
      itemTemplate(3, 4, 'Registrar identificação das peças no sistema', true, true, false, 'texto'),
      itemTemplate(3, 5, 'Registrar resultado da votação', true, true, false, 'texto'),
      itemTemplate(3, 6, 'Colher assinaturas dos presentes', true, true, true, 'sim_nao'),
      itemTemplate(4, 1, 'Proferir decisão ou marcar nova data', true, true, false, 'sim_nao'),
      itemTemplate(4, 2, 'Registrar hora de encerramento', true, true, true, 'texto'),
      itemTemplate(4, 3, 'Encerrar gravação', false, false, false, 'sim_nao'),
      itemTemplate(5, 1, 'Lavrar ata ou termo no sistema', true, true, false, 'sim_nao'),
      itemTemplate(5, 2, 'Intimar as partes da decisão', true, true, true, 'sim_nao'),
      itemTemplate(5, 3, 'Arquivar mídia de gravação', false, false, false, 'sim_nao'),
    ]
  }

  return [
    itemTemplate(1, 1, 'Verificar condições para início', true, true, false, 'sim_nao'),
    itemTemplate(2, 1, 'Registrar hora de início', true, true, true, 'texto'),
    itemTemplate(3, 1, 'Conduzir ato processual', false, false, false, 'sim_nao'),
    itemTemplate(4, 1, 'Registrar hora de encerramento', true, true, true, 'texto'),
    itemTemplate(5, 1, 'Registrar ato no sistema', true, true, false, 'sim_nao'),
  ]
}

async function recalcularProcedimento(procedimentoId: string, usuarioUid?: string) {
  const itensSnap = await getDocs(
    query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoId)),
  )
  const itens = itensSnap.docs.map((itemDoc) =>
    normalizarItem(itemDoc.id, itemDoc.data()),
  )
  const itensConcluidos = itens.filter((item) => item.resposta !== undefined && item.resposta !== '' && item.resposta !== null).length
  const itensCriticosPendentes = itens.filter((item) => item.critico && (item.resposta === undefined || item.resposta === '' || item.resposta === null)).length
  const progresso = itens.length > 0 ? Math.round((itensConcluidos / itens.length) * 100) : 0

  await updateDoc(doc(db, 'procedimentos', procedimentoId), {
    progresso,
    itensConcluidos,
    itensCriticosPendentes,
    atualizadoEm: Timestamp.now(),
    editadoEm: Timestamp.now(),
    ...(usuarioUid ? { editadoPor: usuarioUid } : {}),
  })
}

export function useAudiencias(filtros?: {
  magistradoId?: string
  dataInicio?: Date
  dataFim?: Date
}) {
  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('dataHoraInicio', 'asc')]

    if (filtros?.magistradoId) constraints.unshift(where('magistradoId', '==', filtros.magistradoId))
    if (filtros?.dataInicio) constraints.unshift(where('dataHoraInicio', '>=', Timestamp.fromDate(filtros.dataInicio)))
    if (filtros?.dataFim) constraints.unshift(where('dataHoraInicio', '<=', Timestamp.fromDate(filtros.dataFim)))

    const q = query(collection(db, 'audiencias'), ...constraints)
    const unsub = onSnapshot(q, (snap) => {
      setAudiencias(snap.docs.map((d) => normalizarAudiencia(d.id, d.data())))
      setLoading(false)
    })

    return unsub
  }, [filtros?.magistradoId, filtros?.dataInicio?.getTime(), filtros?.dataFim?.getTime()])

  return { audiencias, loading }
}

export interface ValidacaoAgendamento {
  valido: boolean
  erro?: string
}

export async function validarAgendamento(params: {
  dataHoraInicio: Date
  dataHoraFim: Date
  salaId: string
  magistradoId: string
  audienciaIdIgnorar?: string
}): Promise<ValidacaoAgendamento> {
  const { dataHoraInicio, dataHoraFim, salaId, magistradoId, audienciaIdIgnorar } = params

  const configSnap = await getDocs(
    query(collection(db, 'configuracoes')),
  )
  const configSistema = configSnap.docs.find((item) => item.id === 'sistema')?.data() as
    | { diasSemanaAtivos?: number[] }
    | undefined

  const diaSemana = dataHoraInicio.getDay()
  if (!diaSemanaAtivo(diaSemana, configSistema?.diasSemanaAtivos)) {
    return {
      valido: false,
      erro: mensagemDiaSemanaInativo(diaSemana as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    }
  }

  const feriadosSnap = await getDocs(collection(db, 'feriados'))
  for (const docFeriado of feriadosSnap.docs) {
    const feriado = docFeriado.data()
    const dataFeriado: Date = feriado.data.toDate()

    const coincide = feriado.recorrente
      ? dataFeriado.getDate() === dataHoraInicio.getDate() && dataFeriado.getMonth() === dataHoraInicio.getMonth()
      : isSameDay(dataFeriado, dataHoraInicio)

    if (coincide) {
      return {
        valido: false,
        erro: `Não é possível agendar nesta data. Há um feriado ou recesso cadastrado: "${feriado.descricao}".`,
      }
    }
  }

  const dispSnap = await getDocs(
    query(
      collection(db, 'disponibilidades'),
      where('usuarioId', '==', magistradoId),
      where('diaSemana', '==', diaSemana),
    ),
  )

  if (dispSnap.empty) {
    return { valido: false, erro: 'Não foi possível agendar. O magistrado não possui disponibilidade cadastrada para este dia da semana.' }
  }

  const horaAudiencia = `${String(dataHoraInicio.getHours()).padStart(2, '0')}:${String(dataHoraInicio.getMinutes()).padStart(2, '0')}`
  const dispOk = dispSnap.docs.some((d) => {
    const { horaInicio, horaFim } = d.data()
    return horaAudiencia >= horaInicio && horaAudiencia < horaFim
  })

  if (!dispOk) {
    return { valido: false, erro: 'Não foi possível agendar. O horário informado está fora da disponibilidade cadastrada do magistrado.' }
  }

  const conflitosSalaSnap = await getDocs(
    query(
      collection(db, 'audiencias'),
      where('salaId', '==', salaId),
      where('dataHoraInicio', '<', Timestamp.fromDate(dataHoraFim)),
      where('dataHoraFim', '>', Timestamp.fromDate(dataHoraInicio)),
      where('status', 'not-in', ['cancelada', 'redesignada']),
    ),
  )

  if (conflitosSalaSnap.docs.some((d) => d.id !== audienciaIdIgnorar)) {
    return { valido: false, erro: 'Não foi possível agendar. A sala já está ocupada neste horário.' }
  }

  const conflitosMagSnap = await getDocs(
    query(
      collection(db, 'audiencias'),
      where('magistradoId', '==', magistradoId),
      where('dataHoraInicio', '<', Timestamp.fromDate(dataHoraFim)),
      where('dataHoraFim', '>', Timestamp.fromDate(dataHoraInicio)),
      where('status', 'not-in', ['cancelada', 'redesignada']),
    ),
  )

  if (conflitosMagSnap.docs.some((d) => d.id !== audienciaIdIgnorar)) {
    return { valido: false, erro: 'Não foi possível agendar. O magistrado já possui audiência neste horário.' }
  }

  return { valido: true }
}

async function criarItensPadraoChecklist(
  procedimentoId: string,
  audienciaId: string,
  numeroProcesso: string,
  tipo: TipoAudiencia,
) {
  const batch = writeBatch(db)
  const procedimentoRef = doc(db, 'procedimentos', procedimentoId)
  const criadoEm = Timestamp.now()
  const itensPadrao = selecionarTemplate(tipo)

  batch.set(procedimentoRef, {
    audienciaId,
    numeroProcesso,
    status: 'pendente',
    progresso: 0,
    totalItens: itensPadrao.length,
    itensConcluidos: 0,
    itensCriticosPendentes: itensPadrao.filter((item) => item.critico).length,
    criadoEm,
  })

  for (const item of itensPadrao) {
    const itemRef = doc(collection(db, 'procedimento_itens'))
    batch.set(itemRef, {
      procedimentoId,
      ...item,
    } satisfies Omit<ProcedimentoItem, 'id'>)
  }

  await batch.commit()
}

async function criarChecklistParaProcedimento(params: {
  procedimentoId: string
  audienciaId: string
  numeroProcesso: string
  tipo: TipoAudiencia
  usuarioUid: string
  usuarioNome: string
}) {
  const { procedimentoId, audienciaId, numeroProcesso, tipo, usuarioUid, usuarioNome } = params

  try {
      const templateAtivo = await buscarTemplateAtivoChecklist()

    if (templateAtivo) {
      const procedimentoRef = doc(db, 'procedimentos', procedimentoId)
      await setDoc(procedimentoRef, {
        audienciaId,
        numeroProcesso,
        status: 'pendente',
        progresso: 0,
        totalItens: 0,
        itensConcluidos: 0,
        itensCriticosPendentes: 0,
        criadoEm: Timestamp.now(),
      })

      await gerarSnapshotParaProcedimentoChecklist(
        procedimentoId,
        templateAtivo.versao,
        templateAtivo.itens,
        {
          usuarioUid,
          usuarioNome,
        },
      )
      return
    }
  } catch (error) {
    console.error('Falha ao gerar snapshot do checklist:', error)
  }

  await criarItensPadraoChecklist(procedimentoId, audienciaId, numeroProcesso, tipo)
}

export function useCriarAudiencia() {
  const { usuario } = useAuth()
  const toast = useToast()
  const [salvando, setSalvando] = useState(false)

  const criar = useCallback(
    async (dados: {
      numeroProcesso: string
      tipo: TipoAudiencia
      classeProcessual?: Audiencia['classeProcessual']
      objetoDoFeito?: Audiencia['objetoDoFeito']
      dataHoraInicio: Date
      dataHoraFim: Date
      salaId: string
      salaNome: string
      magistradoId: string
      magistradoNome: string
      juizoDeprecante?: string
      reuPreso?: boolean
      reus?: ReuProcesso[]
      vitimas?: string[]
      advogados?: AdvogadoProcesso[]
      partes?: string
      observacoes?: string
      sigiloso?: boolean
      agendadoComAvisoAntecedencia?: boolean
    }) => {
      if (!usuario) return

      setSalvando(true)
      try {
        const validacao = await validarAgendamento({
          dataHoraInicio: dados.dataHoraInicio,
          dataHoraFim: dados.dataHoraFim,
          salaId: dados.salaId,
          magistradoId: dados.magistradoId,
        })

        if (!validacao.valido) {
          toast.warning(validacao.erro ?? 'Não foi possível agendar. Verifique os dados e tente novamente.')
          return null
        }

        const audienciaRef = await addDoc(collection(db, 'audiencias'), {
          ...dados,
          dataHoraInicio: Timestamp.fromDate(dados.dataHoraInicio),
          dataHoraFim: Timestamp.fromDate(dados.dataHoraFim),
          status: 'agendada' as StatusAudiencia,
          criadoEm: Timestamp.now(),
          criadoPor: usuario.uid,
        })

        const procedimentoRef = doc(collection(db, 'procedimentos'))
        await criarChecklistParaProcedimento({
          procedimentoId: procedimentoRef.id,
          audienciaId: audienciaRef.id,
          numeroProcesso: dados.numeroProcesso,
          tipo: dados.tipo,
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
        await garantirProcedimentoVinculado(
          audienciaRef.id,
          dados.numeroProcesso,
          usuario.uid,
        )

        await registrarAcao({
          tipo: 'agendamento',
          dados: {
            documentId: audienciaRef.id,
            audienciaId: audienciaRef.id,
            numeroProcesso: dados.numeroProcesso,
            dataHora: dados.dataHoraInicio.toISOString(),
            sala: dados.salaNome,
            cargoMagistrado:
              (dados as { cargoMagistrado?: string }).cargoMagistrado ?? '',
          },
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })

        toast.success('Audiência agendada com sucesso.')
        return audienciaRef.id
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível agendar a audiência. Verifique os campos e tente novamente.')
        return null
      } finally {
        setSalvando(false)
      }
    },
    [usuario, toast],
  )

  return { criar, salvando }
}

export function useAtualizarAudiencia() {
  const { usuario } = useAuth()
  const toast = useToast()

  const atualizar = useCallback(
    async (
      audienciaId: string,
      dados: Partial<Audiencia>,
      antes?: Partial<Audiencia>,
      statusAtual?: StatusAudiencia,
    ) => {
      if (!usuario) return
      try {
        const statusBase = statusAtual ?? antes?.status
        const precisaProcedimento =
          dados.status === 'realizada' ||
          dados.status === 'cancelada' ||
          dados.status === 'redesignada' ||
          dados.status === 'em_andamento'

        let procedimentoAtual: Procedimento | null = null
        let procedimentoId: string | null = null

        if (precisaProcedimento) {
          const procedimentoSnap = await getDocs(
            query(collection(db, 'procedimentos'), where('audienciaId', '==', audienciaId)),
          )

          if (!procedimentoSnap.empty) {
            procedimentoId = procedimentoSnap.docs[0].id
            procedimentoAtual = normalizarProcedimento(
              procedimentoId,
              procedimentoSnap.docs[0].data(),
            )
          }
        }

        if (statusBase && dados.status === 'realizada') {
          const resultado = validarTransicaoEstado(
            'encerrar',
            statusBase,
            procedimentoAtual,
          )
          if (!resultado.permitido) {
            toast.error(
              resultado.mensagem ??
                'Esta ação não é permitida na situação atual da audiência.',
            )
            return
          }
        }

        if (statusBase && dados.status === 'cancelada') {
          const resultado = validarTransicaoEstado(
            'cancelar',
            statusBase,
            procedimentoAtual,
          )
          if (!resultado.permitido) {
            toast.error(
              resultado.mensagem ??
                'Esta ação não é permitida na situação atual da audiência.',
            )
            return
          }
        }

        if (statusBase && dados.status === 'redesignada') {
          const resultado = validarTransicaoEstado(
            'remarcar',
            statusBase,
            procedimentoAtual,
          )
          if (!resultado.permitido) {
            toast.error(
              resultado.mensagem ??
                'Esta ação não é permitida na situação atual da audiência.',
            )
            return
          }
        }

        if (statusBase && dados.status === 'em_andamento') {
          const resultado = validarTransicaoEstado(
            'iniciar',
            statusBase,
            procedimentoAtual,
          )
          if (!resultado.permitido) {
            toast.error(
              resultado.mensagem ??
                'Esta ação não é permitida na situação atual da audiência.',
            )
            return
          }
        }

        const dadosSemUndefined = Object.fromEntries(
          Object.entries(dados).filter(([, valor]) => valor !== undefined),
        )

        await updateDoc(doc(db, 'audiencias', audienciaId), {
          ...dadosSemUndefined,
          atualizadoEm: Timestamp.now(),
          editadoEm: Timestamp.now(),
          editadoPor: usuario.uid,
        })

        if (dados.status === 'redesignada' && procedimentoId) {
            const itensSnap = await getDocs(
              query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoId)),
            )

            const batch = writeBatch(db)
            const itens = itensSnap.docs.map((itemDoc) =>
              normalizarItem(itemDoc.id, itemDoc.data()),
            )

            for (const item of itens) {
              if (!item.resetarNaRemarcacao) continue
              batch.update(doc(db, 'procedimento_itens', item.id), {
                resposta: deleteField(),
                observacao: deleteField(),
                respondidoEm: deleteField(),
                respondidoPor: deleteField(),
              })
            }

            await batch.commit()
            await recalcularProcedimento(procedimentoId, usuario.uid)
        }

        await registrarCamposAlterados({
          colecao: 'audiencias',
          documentId: audienciaId,
          antes: (antes ?? {}) as Record<string, unknown>,
          depois: dadosSemUndefined,
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
        if (dados.status === 'redesignada') {
          await registrarAcao({
            tipo: 'remarcacao',
            dados: {
              documentId: audienciaId,
              audienciaId,
              numeroProcesso: antes?.numeroProcesso ?? '',
              dataHoraAnterior:
                antes?.dataHoraInicio instanceof Timestamp
                  ? antes.dataHoraInicio.toDate().toISOString()
                  : null,
              dataHoraNova:
                dados.dataHoraInicio instanceof Timestamp
                  ? dados.dataHoraInicio.toDate().toISOString()
                  : null,
              motivo: inferirMotivoRemarcacao(
                antes?.observacoes,
                typeof dados.observacoes === 'string' ? dados.observacoes : undefined,
              ),
            },
            usuarioUid: usuario.uid,
            usuarioNome: usuario.nome,
          })
        } else if (dados.status !== 'cancelada') {
          await registrarAcao({
            tipo: 'editar',
            dados: {
              colecao: 'audiencias',
              documentId: audienciaId,
              documentoId: audienciaId,
              acao: 'editar',
              antes,
              depois: dadosSemUndefined,
            },
            usuarioUid: usuario.uid,
            usuarioNome: usuario.nome,
          })
        }
        toast.success('Audiência atualizada com sucesso.')
      } catch (err) {
        console.error(err)
        toast.error('Não foi possível salvar as alterações da audiência. Tente novamente.')
      }
    },
    [usuario, toast],
  )

  return { atualizar }
}
