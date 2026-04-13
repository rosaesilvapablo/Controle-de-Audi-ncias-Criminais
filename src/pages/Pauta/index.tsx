import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Timestamp,
  collection,
  deleteField,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotInfo } from 'react-big-calendar'
import { AlertTriangle } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { db } from '../../lib/firebase'
import { refProcesso } from '../../services/collections'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useConfiguracoes, useProcedimentoDetalhe, useProcedimentos, useRegrasAgendamento, useSalas, useSigilo, useUsuarios } from '../../hooks'
import { useAudiencias, useAtualizarAudiencia, validarAgendamento } from '../../hooks/useAudiencias'
import { verificarVinculosAudiencia } from '../../lib/vinculos'
import { registrarAcao, registrarEdicao } from '../../lib/auditoria'
import { isForaDoExpediente } from '../../lib/permissoes'
import type { SlotSugerido } from '../../lib/sugestaoAutomatica'
import {
  canEdit,
  isAdmin,
  isMagistrado,
  type Audiencia,
  type CargoMagistrado,
  type Procedimento,
  type ProcessoPendente,
  type TipoAudiencia,
  type Usuario,
} from '../../types'
import { Button, Input, Modal, PageLoader, Select, Textarea } from '../../components/ui'
import { ModalCancelamentoAudiencia } from '../../components/audiencia/ModalCancelamentoAudiencia'
import { PainelPauta } from './PainelPauta'
import { PainelAudiencia } from './PainelAudiencia'
import { PainelChecklist } from './PainelChecklist'
import { PainelAgendar } from './PainelAgendar'
import { PainelRemarcar } from './PainelRemarcar'
import {
  CalendarioPauta,
  type CalEvent,
  type EventInteractionArgs,
  type ViewType,
} from './CalendarioPauta'

type TipoPainel =
  | 'pauta'
  | 'audiencia'
  | 'checklist'
  | 'agendar'
  | 'remarcar'

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

export default function Pauta() {
  const { usuario } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { audiencias, loading } = useAudiencias()
  const { atualizar } = useAtualizarAudiencia()
  const { config } = useConfiguracoes()
  const { regras } = useRegrasAgendamento()
  const { salas } = useSalas(true)
  const { usuarios } = useUsuarios()
  const { procedimentos } = useProcedimentos()
  const { estaAutorizado, marcarSigilo, registrarAcessoSigiloso } = useSigilo()

  const [view, setView] = useState<ViewType>('week')
  const [date, setDate] = useState(new Date())
  const [painelAtivo, setPainelAtivo] = useState<TipoPainel>('pauta')
  const [audienciaSelecionada, setAudienciaSelecionada] = useState<Audiencia | null>(null)
  const [procedimentoVinculado, setProcedimentoVinculado] = useState<Procedimento | null>(null)
  const [dataInicialAgendamento, setDataInicialAgendamento] = useState<Date | undefined>(undefined)
  const [processoPendenteOrigem, setProcessoPendenteOrigem] = useState<ProcessoPendente | null>(null)
  const [sugestaoAutomatica, setSugestaoAutomatica] = useState<SlotSugerido | null>(null)
  const [modalEditarAudienciaAberto, setModalEditarAudienciaAberto] = useState(false)
  const [confirmandoEdicaoRealizada, setConfirmandoEdicaoRealizada] = useState(false)
  const [salvandoEdicaoAudiencia, setSalvandoEdicaoAudiencia] = useState(false)
  const [dataEdicaoAudiencia, setDataEdicaoAudiencia] = useState('')
  const [horaEdicaoAudiencia, setHoraEdicaoAudiencia] = useState('')
  const [salaEdicaoAudiencia, setSalaEdicaoAudiencia] = useState('')
  const [tipoEdicaoAudiencia, setTipoEdicaoAudiencia] = useState<TipoAudiencia>('instrucao')
  const [cargoEdicaoAudiencia, setCargoEdicaoAudiencia] = useState<CargoMagistrado>('juiz_federal')
  const [observacoesEdicaoAudiencia, setObservacoesEdicaoAudiencia] = useState('')
  const [modalCancelamentoAberto, setModalCancelamentoAberto] = useState(false)
  const [processoPendenteCancelamentoId, setProcessoPendenteCancelamentoId] = useState<string | undefined>(undefined)
  const [modalExcluirAudienciaAberto, setModalExcluirAudienciaAberto] = useState(false)
  const [confirmacaoExclusaoAudiencia, setConfirmacaoExclusaoAudiencia] = useState('')
  const [excluindoAudiencia, setExcluindoAudiencia] = useState(false)
  const [modalForaExpedienteAberto, setModalForaExpedienteAberto] = useState(false)
  const [acaoPendenteExpediente, setAcaoPendenteExpediente] = useState<
    | { tipo: 'agendar'; data: Date }
    | { tipo: 'remarcar'; args: EventInteractionArgs<CalEvent> }
    | null
  >(null)

  const podeEditar = canEdit(usuario?.perfil)
  const podeAgendar = canEdit(usuario?.perfil) || isMagistrado(usuario?.perfil)
  const podeUltrapassarExpediente = isAdmin(usuario?.perfil) || isMagistrado(usuario?.perfil)
  const podeVerSigilo = Boolean(usuario && estaAutorizado(usuario.uid, usuario.perfil))
  const podeAlterarSigilo = isAdmin(usuario?.perfil) || isMagistrado(usuario?.perfil)
  const magistradosAtivos = useMemo(
    () => usuarios.filter((item) => item.perfil === 'magistrado' && item.ativo),
    [usuarios],
  )
  const statusBloqueadoEdicaoAudiencia =
    audienciaSelecionada?.status === 'realizada' ||
    (audienciaSelecionada?.status as string | undefined) === 'encerrada'
  const podeEditarAudienciaSelecionada = useMemo(() => {
    if (!usuario || !audienciaSelecionada) return false
    if (isAdmin(usuario.perfil)) return true
    if (canEdit(usuario.perfil)) return !statusBloqueadoEdicaoAudiencia
    if (isMagistrado(usuario.perfil)) return audienciaSelecionada.magistradoId === usuario.uid
    return false
  }, [audienciaSelecionada, statusBloqueadoEdicaoAudiencia, usuario])
  const edicaoAudienciaSomenteObservacoes = useMemo(() => {
    if (!usuario || !audienciaSelecionada) return false
    return isMagistrado(usuario.perfil) && audienciaSelecionada.magistradoId === usuario.uid
  }, [audienciaSelecionada, usuario])
  const mapaProcedimentos = useMemo(() => {
    const mapa: Record<string, Procedimento> = {}
    procedimentos.forEach((p) => {
      mapa[p.audienciaId] = p
    })
    return mapa
  }, [procedimentos])
  const procedimentosPorAudiencia = useMemo(
    () => new Map(procedimentos.map((item) => [item.audienciaId, item])),
    [procedimentos],
  )
  const procedimentoSelecionado = useMemo(
    () =>
      audienciaSelecionada
        ? procedimentosPorAudiencia.get(audienciaSelecionada.id) ?? null
        : null,
    [audienciaSelecionada, procedimentosPorAudiencia],
  )
  const { itens: itensChecklist } = useProcedimentoDetalhe(
    procedimentoSelecionado?.id ?? '',
  )
  const podeCancelarAudienciaSelecionada = useMemo(() => {
    if (!usuario || !audienciaSelecionada) return false
    if (!canEdit(usuario.perfil) && !isMagistrado(usuario.perfil)) return false

    return (
      audienciaSelecionada.status !== 'cancelada' &&
      audienciaSelecionada.status !== 'realizada' &&
      (audienciaSelecionada.status as string | undefined) !== 'encerrada'
    )
  }, [audienciaSelecionada, usuario])

  const registrarCamposAlterados = useCallback(
    async (
      colecao: string,
      documentId: string,
      antes: Record<string, unknown>,
      depois: Record<string, unknown>,
    ) => {
      if (!usuario) return

      await Promise.all(
        Object.entries(depois)
          .filter(([, valor]) => valor !== undefined)
          .filter(([campo, valorNovo]) => valoresDiferentes(antes[campo], valorNovo))
          .map(([campo, valorNovo]) =>
            registrarEdicao({
              colecao,
              documentId,
              campo,
              valorAnterior: antes[campo],
              valorNovo,
              usuarioUid: usuario.uid,
              usuarioNome: usuario.nome,
            }),
          ),
      )
    },
    [usuario],
  )

  const excluirDependenciasProcedimento = useCallback(async (procedimentoId: string) => {
    const consultas = await Promise.all([
      getDocs(query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoId))),
      getDocs(query(collection(db, 'procedimento_participantes'), where('procedimentoId', '==', procedimentoId))),
      getDocs(query(collection(db, 'procedimento_documentos'), where('procedimentoId', '==', procedimentoId))),
    ])

    for (const snapshot of consultas) {
      await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)))
    }
  }, [])

  const excluirAudienciaEmCascata = useCallback(async (audiencia: Audiencia) => {
    if (!usuario) return

    await registrarAcao({
      tipo: 'exclusao',
      dados: {
        colecao: 'audiencias',
        documentId: audiencia.id,
        documentoId: audiencia.id,
        numeroProcesso: audiencia.numeroProcesso,
      },
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
    })

    const procedimentosSnap = await getDocs(
      query(collection(db, 'procedimentos'), where('audienciaId', '==', audiencia.id)),
    )

    for (const procedimentoDoc of procedimentosSnap.docs) {
      await excluirDependenciasProcedimento(procedimentoDoc.id)
      await deleteDoc(procedimentoDoc.ref)
    }

    const pendentesSnap = await getDocs(
      query(collection(db, 'processos_pendentes'), where('audienciaId', '==', audiencia.id)),
    )

    await Promise.all(
      pendentesSnap.docs.map((pendenteDoc) =>
        updateDoc(pendenteDoc.ref, {
          situacao: 'aguardando',
          audienciaId: deleteField(),
          atualizadoEm: Timestamp.now(),
          editadoEm: Timestamp.now(),
          editadoPor: usuario.uid,
        }),
      ),
    )

    await deleteDoc(doc(db, 'audiencias', audiencia.id))
  }, [excluirDependenciasProcedimento, usuario])

  const abrirEditarAudiencia = useCallback((audiencia: Audiencia) => {
    const inicio = audiencia.dataHoraInicio.toDate()
    const cargoAtual =
      ((audiencia as Audiencia & { cargoMagistrado?: CargoMagistrado }).cargoMagistrado) ??
      (
        magistradosAtivos.find((item) => item.uid === audiencia.magistradoId) as
          | (Usuario & { cargoMagistrado?: CargoMagistrado })
          | undefined
      )?.cargoMagistrado ??
      'juiz_federal'

    setDataEdicaoAudiencia(inicio.toISOString().slice(0, 10))
    setHoraEdicaoAudiencia(inicio.toTimeString().slice(0, 5))
    setSalaEdicaoAudiencia(audiencia.salaId)
    setTipoEdicaoAudiencia(audiencia.tipo)
    setCargoEdicaoAudiencia(cargoAtual)
    setObservacoesEdicaoAudiencia(audiencia.observacoes ?? '')
    setConfirmandoEdicaoRealizada(false)
    setModalEditarAudienciaAberto(true)
  }, [magistradosAtivos])

  useEffect(() => {
    if (!audienciaSelecionada) {
      setProcedimentoVinculado(null)
      return
    }

    const q = query(
      collection(db, 'procedimentos'),
      where('audienciaId', '==', audienciaSelecionada.id),
    )
    const unsubscribe = onSnapshot(q, (snap) => {
      const procedimentoDoc = snap.docs[0]
      setProcedimentoVinculado(
        procedimentoDoc
          ? ({ id: procedimentoDoc.id, ...procedimentoDoc.data() } as Procedimento)
          : null,
      )
    })

    return () => unsubscribe()
  }, [audienciaSelecionada?.id])

  useEffect(() => {
    const audienciaId = (location.state as { audienciaId?: string } | null)
      ?.audienciaId
    if (audienciaId) {
      const audEncontrada = audiencias.find((a) => a.id === audienciaId)
      if (audEncontrada) {
        setAudienciaSelecionada(audEncontrada)
        setPainelAtivo('audiencia')
      }
      navigate('/', { replace: true, state: {} })
      return
    }

    const state = location.state as
      | {
          processoPendente?: ProcessoPendente
          sugestaoAutomatica?: SlotSugerido
        }
      | null
    const processo = state?.processoPendente
    if (!processo) return

    setProcessoPendenteOrigem(processo)
    setSugestaoAutomatica(state?.sugestaoAutomatica ?? null)
    setDataInicialAgendamento(
      state?.sugestaoAutomatica
        ? new Date(state.sugestaoAutomatica.dataHoraInicioIso)
        : undefined,
    )
    setPainelAtivo('agendar')
    navigate('/', { replace: true, state: {} })
  }, [location.state, navigate])

  useEffect(() => {
    const audienciaSelecionadaId = (
      location.state as { audienciaSelecionadaId?: string } | null
    )?.audienciaSelecionadaId
    if (!audienciaSelecionadaId) return

    const audiencia = audiencias.find((item) => item.id === audienciaSelecionadaId)
    if (audiencia) {
      setAudienciaSelecionada(audiencia)
      setPainelAtivo('audiencia')
      navigate('/', { replace: true, state: {} })
    }
  }, [audiencias, location.state, navigate])

  const eventos = useMemo<CalEvent[]>(
    () =>
      audiencias.map((item) => ({
        title: item.numeroProcesso,
        start: item.dataHoraInicio.toDate(),
        end: item.dataHoraFim.toDate(),
        resource: item,
      })),
    [audiencias],
  )

  const audienciasDoDia = useMemo(
    () =>
      audiencias
        .filter((item) => {
          const dataAudiencia = item.dataHoraInicio.toDate()
          return (
            dataAudiencia.getDate() === date.getDate() &&
            dataAudiencia.getMonth() === date.getMonth() &&
            dataAudiencia.getFullYear() === date.getFullYear()
          )
        })
        .map((item) => ({
          ...item,
          procedimento: procedimentosPorAudiencia.get(item.id) ?? null,
        })),
    [audiencias, date, procedimentosPorAudiencia],
  )

  const abrirPauta = useCallback(() => {
    setPainelAtivo('pauta')
    setDataInicialAgendamento(undefined)
    setProcessoPendenteOrigem(null)
    setSugestaoAutomatica(null)
  }, [])

  const abrirAudiencia = useCallback((audiencia: Audiencia) => {
    if (audiencia.sigiloso && usuario && estaAutorizado(usuario.uid, usuario.perfil)) {
      const chaveSessao = `sigilo:audiencias:${audiencia.id}`
      if (!sessionStorage.getItem(chaveSessao)) {
        sessionStorage.setItem(chaveSessao, '1')
        void registrarAcessoSigiloso({
          colecao: 'audiencias',
          documentId: audiencia.id,
          usuarioUid: usuario.uid,
          usuarioNome: usuario.nome,
        })
      }
    }

    setAudienciaSelecionada(audiencia)
    setPainelAtivo('audiencia')
  }, [estaAutorizado, registrarAcessoSigiloso, usuario])

  const abrirAgendar = useCallback((inicio?: Date) => {
    setDataInicialAgendamento(inicio)
    setProcessoPendenteOrigem(null)
    setSugestaoAutomatica(null)
    setPainelAtivo('agendar')
  }, [])

  const abrirChecklist = useCallback((audiencia: Audiencia) => {
    setAudienciaSelecionada(audiencia)
    setPainelAtivo('checklist')
  }, [])

  const alternarSigiloAudiencia = useCallback(async (proximoSigilo: boolean) => {
    if (!usuario || !audienciaSelecionada || !podeAlterarSigilo) return

    try {
      await marcarSigilo({
        colecao: 'audiencias',
        documentId: audienciaSelecionada.id,
        sigiloso: proximoSigilo,
        usuarioUid: usuario.uid,
        usuarioNome: usuario.nome,
      })
      setAudienciaSelecionada({ ...audienciaSelecionada, sigiloso: proximoSigilo })
      toast.success(proximoSigilo ? 'Sigilo ativado.' : 'Sigilo removido.')
    } catch {
      toast.error('Nao foi possivel atualizar o sigilo da audiencia.')
    }
  }, [audienciaSelecionada, marcarSigilo, podeAlterarSigilo, toast, usuario])

  const abrirRemarcar = useCallback((audiencia: Audiencia) => {
    setAudienciaSelecionada(audiencia)
    setPainelAtivo('remarcar')
  }, [])

  const abrirCancelar = useCallback(async (audiencia: Audiencia) => {
    setAudienciaSelecionada(audiencia)
    try {
      const vinculos = await verificarVinculosAudiencia(audiencia.id)
      setProcessoPendenteCancelamentoId(vinculos.processoPendenteId ?? undefined)
    } catch {
      setProcessoPendenteCancelamentoId(undefined)
    }
    setModalCancelamentoAberto(true)
  }, [])

  const abrirExcluirAudiencia = useCallback((audiencia: Audiencia) => {
    if (!usuario) return
    if (!canEdit(usuario.perfil)) return

    const bloqueada =
      audiencia.status === 'realizada' ||
      (audiencia.status as string | undefined) === 'encerrada'

    if (!isAdmin(usuario.perfil) && bloqueada) {
      toast.warning('Apenas o Diretor pode excluir audiencias ja realizadas.')
      return
    }

    setAudienciaSelecionada(audiencia)
    setConfirmacaoExclusaoAudiencia('')
    setModalExcluirAudienciaAberto(true)
  }, [toast, usuario])

  const salvarEdicaoAudiencia = useCallback(async () => {
    if (!audienciaSelecionada || !usuario) return

    if (!podeEditarAudienciaSelecionada) {
      toast.warning('Seu perfil nao pode editar esta audiencia.')
      return
    }

    if (!edicaoAudienciaSomenteObservacoes && (!dataEdicaoAudiencia || !horaEdicaoAudiencia || !salaEdicaoAudiencia)) {
      toast.warning('Preencha data, horario e sala antes de salvar.')
      return
    }

    const executar = async () => {
      setSalvandoEdicaoAudiencia(true)
      try {
        const dadosAtualizacao: Record<string, unknown> = {}

        if (edicaoAudienciaSomenteObservacoes) {
          dadosAtualizacao.observacoes = observacoesEdicaoAudiencia.trim() || undefined
        } else {
          const inicio = new Date(`${dataEdicaoAudiencia}T${horaEdicaoAudiencia}:00`)
          const duracao =
            audienciaSelecionada.dataHoraFim.toDate().getTime() -
            audienciaSelecionada.dataHoraInicio.toDate().getTime()
          const fim = new Date(inicio.getTime() + duracao)
          const salaSelecionada = salas.find((item) => item.id === salaEdicaoAudiencia)
          const magistradoCorrespondente =
            magistradosAtivos.find((item) => {
              const cargo = (item as Usuario & { cargoMagistrado?: CargoMagistrado }).cargoMagistrado
              return cargo === cargoEdicaoAudiencia
            }) ??
            magistradosAtivos.find((item) => item.uid === audienciaSelecionada.magistradoId)

          if (!salaSelecionada) {
            toast.warning('Selecione uma sala valida.')
            return
          }

          if (!magistradoCorrespondente) {
            toast.warning('Nao foi encontrado magistrado compativel com o cargo informado.')
            return
          }

          const validacao = await validarAgendamento({
            dataHoraInicio: inicio,
            dataHoraFim: fim,
            salaId: salaSelecionada.id,
            magistradoId: magistradoCorrespondente.uid,
            audienciaIdIgnorar: audienciaSelecionada.id,
          })

          if (!validacao.valido) {
            toast.warning(validacao.erro ?? 'Nao foi possivel salvar a edicao da audiencia.')
            return
          }

          dadosAtualizacao.dataHoraInicio = Timestamp.fromDate(inicio)
          dadosAtualizacao.dataHoraFim = Timestamp.fromDate(fim)
          dadosAtualizacao.salaId = salaSelecionada.id
          dadosAtualizacao.salaNome = salaSelecionada.nome
          dadosAtualizacao.tipo = tipoEdicaoAudiencia
          dadosAtualizacao.cargoMagistrado = cargoEdicaoAudiencia
          dadosAtualizacao.magistradoId = magistradoCorrespondente.uid
          dadosAtualizacao.magistradoNome = magistradoCorrespondente.nome
          dadosAtualizacao.observacoes = observacoesEdicaoAudiencia.trim() || undefined
        }

        await atualizar(
          audienciaSelecionada.id,
          dadosAtualizacao as Partial<Audiencia>,
          audienciaSelecionada,
          audienciaSelecionada.status,
        )

        setModalEditarAudienciaAberto(false)
        setConfirmandoEdicaoRealizada(false)
      } finally {
        setSalvandoEdicaoAudiencia(false)
      }
    }

    if (statusBloqueadoEdicaoAudiencia && isAdmin(usuario.perfil) && !confirmandoEdicaoRealizada) {
      setConfirmandoEdicaoRealizada(true)
      return
    }

    await executar()
  }, [
    audienciaSelecionada,
    atualizar,
    cargoEdicaoAudiencia,
    confirmandoEdicaoRealizada,
    dataEdicaoAudiencia,
    edicaoAudienciaSomenteObservacoes,
    horaEdicaoAudiencia,
    isAdmin,
    magistradosAtivos,
    observacoesEdicaoAudiencia,
    podeEditarAudienciaSelecionada,
    salaEdicaoAudiencia,
    salas,
    statusBloqueadoEdicaoAudiencia,
    tipoEdicaoAudiencia,
    toast,
    usuario,
  ])

  const iniciarAudiencia = useCallback(async () => {
    if (!audienciaSelecionada) return
    if (audienciaSelecionada.status === 'agendada') {
      await atualizar(audienciaSelecionada.id, { status: 'em_andamento' }, audienciaSelecionada)
    }
    abrirChecklist(audienciaSelecionada)
  }, [abrirChecklist, audienciaSelecionada, atualizar])

  const encerrarAudiencia = useCallback(async () => {
    if (!audienciaSelecionada) return
    await atualizar(audienciaSelecionada.id, { status: 'realizada' }, audienciaSelecionada)
    setPainelAtivo('audiencia')
  }, [audienciaSelecionada, atualizar])

  const salvarRespostaChecklist = useCallback(
    async (
      itemId: string,
      resposta: string | boolean,
      observacao: string,
      idsPje: string[],
    ) => {
      if (!procedimentoSelecionado || !usuario) return

      try {
        const itemRef = doc(db, 'procedimento_itens', itemId)
        const itemAntesSnap = await getDoc(itemRef)
        const itemAntes = itemAntesSnap.exists()
          ? (itemAntesSnap.data() as Record<string, unknown>)
          : {}
        const itemAtual = itensChecklist.find((item) => item.id === itemId)
        const concluidoAntes =
          itemAntes.resposta !== undefined &&
          itemAntes.resposta !== '' &&
          itemAntes.resposta !== null
        const concluidoDepois =
          resposta !== undefined && resposta !== '' && resposta !== null

        await updateDoc(itemRef, {
          resposta,
          observacao,
          idsPje,
          respondidoEm: Timestamp.now(),
          respondidoPor: usuario.uid,
          editadoEm: Timestamp.now(),
          editadoPor: usuario.uid,
        })

        await registrarCamposAlterados('procedimento_itens', itemId, itemAntes, {
          resposta,
          observacao,
          idsPje,
        })

        if (concluidoAntes !== concluidoDepois && itemAtual) {
          await registrarAcao({
            tipo: concluidoDepois ? 'checklist_concluido' : 'checklist_desmarcado',
            dados: {
              procedimentoId: procedimentoSelecionado.id,
              itemId,
              tituloItem: itemAtual.descricao,
              fase: itemAtual.fase,
              documentId: itemId,
            },
            usuarioUid: usuario.uid,
            usuarioNome: usuario.nome,
          })
        }

        const itensSnap = await getDocs(
          query(collection(db, 'procedimento_itens'), where('procedimentoId', '==', procedimentoSelecionado.id)),
        )
        const itensAtualizados = itensSnap.docs.map((item) => item.data() as Record<string, unknown>)
        const total = itensAtualizados.length
        const concluidos = itensAtualizados.filter((item) =>
          item.resposta !== undefined && item.resposta !== '' && item.resposta !== null,
        ).length
        const criticosPendentes = itensAtualizados.filter((item) =>
          Boolean(item.critico) && (item.resposta === undefined || item.resposta === ''),
        ).length
        const progresso = total > 0 ? Math.round((concluidos / total) * 100) : 0
        const status =
          criticosPendentes > 0 ? 'com_pendencias_criticas' :
          progresso === 100 ? 'concluido' :
          progresso > 0 ? 'em_andamento' : 'pendente'

        await updateDoc(doc(db, 'procedimentos', procedimentoSelecionado.id), {
          progresso,
          totalItens: total,
          itensConcluidos: concluidos,
          itensCriticosPendentes: criticosPendentes,
          status,
          atualizadoEm: Timestamp.now(),
          editadoEm: Timestamp.now(),
          editadoPor: usuario.uid,
        })
      } catch (error) {
        console.error(error)
        toast.error('Nao foi possivel salvar o item do checklist.')
      }
    },
    [procedimentoSelecionado, registrarCamposAlterados, toast, usuario],
  )

  const confirmarExclusaoAudiencia = useCallback(async () => {
    if (!usuario || !audienciaSelecionada) return
    if (!canEdit(usuario.perfil)) return

    const bloqueada =
      audienciaSelecionada.status === 'realizada' ||
      (audienciaSelecionada.status as string | undefined) === 'encerrada'

    if (!isAdmin(usuario.perfil) && bloqueada) {
      toast.warning('Apenas o Diretor pode excluir audiencias ja realizadas.')
      return
    }

    if (confirmacaoExclusaoAudiencia !== audienciaSelecionada.numeroProcesso) {
      toast.warning('Digite o numero do processo exatamente como exibido para confirmar.')
      return
    }

    setExcluindoAudiencia(true)
    try {
      await excluirAudienciaEmCascata(audienciaSelecionada)
      toast.success(`Processo ${audienciaSelecionada.numeroProcesso} excluido permanentemente.`)
      setModalExcluirAudienciaAberto(false)
      setConfirmacaoExclusaoAudiencia('')
      setAudienciaSelecionada(null)
      setProcedimentoVinculado(null)
      abrirPauta()
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : 'Falha desconhecida.'
      toast.error(`Nao foi possivel excluir permanentemente. ${detalhe}`)
    } finally {
      setExcluindoAudiencia(false)
    }
  }, [
    abrirPauta,
    audienciaSelecionada,
    confirmacaoExclusaoAudiencia,
    excluirAudienciaEmCascata,
    toast,
    usuario,
  ])

  const concluirAgendamento = useCallback(
    async (
      audienciaId: string,
      opcoes?: { agendadoComAvisoAntecedencia: boolean },
    ) => {
      if (processoPendenteOrigem) {
        await updateDoc(doc(db, 'processos_pendentes', processoPendenteOrigem.id), {
          situacao: 'agendado',
          audienciaId,
          atualizadoEm: Timestamp.now(),
          editadoEm: Timestamp.now(),
          editadoPor: usuario?.uid ?? '',
        })

        if (opcoes?.agendadoComAvisoAntecedencia) {
          try {
            const processoRef = refProcesso(processoPendenteOrigem.id)
            const processoSnap = await getDoc(processoRef)
            if (processoSnap.exists()) {
              await updateDoc(processoRef as never, {
                agendadoComAvisoAntecedencia: true,
                atualizadoEm: Timestamp.now(),
              })
            }
          } catch {
            // A atualização do novo modelo é complementar durante a migração.
          }
        }
      }
      abrirPauta()
    },
    [abrirPauta, processoPendenteOrigem, usuario?.uid],
  )

  const executarRemarcacao = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalEvent>) => {
      const audiencia = event.resource
      const inicio = start instanceof Date ? start : new Date(start)
      const fim = end instanceof Date ? end : new Date(end)

      const validacao = await validarAgendamento({
        dataHoraInicio: inicio,
        dataHoraFim: fim,
        salaId: audiencia.salaId,
        magistradoId: audiencia.magistradoId,
        audienciaIdIgnorar: audiencia.id,
      })

      if (!validacao.valido) {
        toast.warning(
          validacao.erro ??
            'Não foi possível remarcar a audiência. Verifique os dados e tente novamente.',
        )
        return
      }

      await atualizar(
        audiencia.id,
        {
          status: 'redesignada',
          dataHoraInicio: Timestamp.fromDate(inicio) as never,
          dataHoraFim: Timestamp.fromDate(fim) as never,
        },
        audiencia,
      )
    },
    [atualizar, toast],
  )

  const handleSelectEvent = useCallback(
    (event: CalEvent) => abrirAudiencia(event.resource),
    [abrirAudiencia],
  )

  const handleSelectSlot = useCallback(
    (slot: SlotInfo) => {
      if (!podeAgendar) {
        toast.warning('Seu perfil não pode agendar audiências.')
        return
      }

      const dataSlot = slot.start instanceof Date ? slot.start : new Date(slot.start)
      const horarioSlot = dataSlot.toTimeString().slice(0, 5)

      if (isForaDoExpediente(horarioSlot, regras.expedienteInicio, regras.expedienteFim)) {
        if (!podeUltrapassarExpediente) {
          toast.warning(
            `Agendamento fora do expediente (${regras.expedienteInicio} - ${regras.expedienteFim}) nao e permitido para este perfil.`,
          )
          return
        }

        setAcaoPendenteExpediente({ tipo: 'agendar', data: dataSlot })
        setModalForaExpedienteAberto(true)
        return
      }

      abrirAgendar(dataSlot)
    },
    [
      abrirAgendar,
      podeAgendar,
      podeUltrapassarExpediente,
      regras.expedienteFim,
      regras.expedienteInicio,
      toast,
    ],
  )

  const handleEventDrop = useCallback(
    async ({ event, start, end }: EventInteractionArgs<CalEvent>) => {
      if (!podeEditar) {
        toast.warning('Seu perfil não pode remarcar audiências.')
        return
      }

      const inicio = start instanceof Date ? start : new Date(start)
      const horarioInicio = inicio.toTimeString().slice(0, 5)

      if (isForaDoExpediente(horarioInicio, regras.expedienteInicio, regras.expedienteFim)) {
        if (!podeUltrapassarExpediente) {
          toast.warning(
            `Agendamento fora do expediente (${regras.expedienteInicio} - ${regras.expedienteFim}) nao e permitido para este perfil.`,
          )
          return
        }

        setAcaoPendenteExpediente({ tipo: 'remarcar', args: { event, start, end } })
        setModalForaExpedienteAberto(true)
        return
      }

      await executarRemarcacao({ event, start, end })
    },
    [
      executarRemarcacao,
      podeEditar,
      podeUltrapassarExpediente,
      regras.expedienteFim,
      regras.expedienteInicio,
      toast,
    ],
  )

  const confirmarAcaoForaExpediente = useCallback(async () => {
    if (!usuario || !acaoPendenteExpediente) return

    const dataSelecionada =
      acaoPendenteExpediente.tipo === 'agendar'
        ? acaoPendenteExpediente.data
        : (acaoPendenteExpediente.args.start instanceof Date
            ? acaoPendenteExpediente.args.start
            : new Date(acaoPendenteExpediente.args.start))
    const horarioSelecionado = dataSelecionada.toTimeString().slice(0, 5)

    await registrarAcao({
      tipo: 'agendamento_fora_expediente',
      dados: {
        horarioSelecionado,
        expedienteInicio: regras.expedienteInicio,
        expedienteFim: regras.expedienteFim,
      },
      usuarioUid: usuario.uid,
      usuarioNome: usuario.nome,
    })

    if (acaoPendenteExpediente.tipo === 'agendar') {
      abrirAgendar(acaoPendenteExpediente.data)
    } else {
      await executarRemarcacao(acaoPendenteExpediente.args)
    }

    setModalForaExpedienteAberto(false)
    setAcaoPendenteExpediente(null)
  }, [abrirAgendar, acaoPendenteExpediente, executarRemarcacao, regras.expedienteFim, regras.expedienteInicio, usuario])


  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--topbar-height,112px)-3rem)] items-center justify-center">
        <div className="w-full max-w-3xl">
          <PageLoader />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-var(--topbar-height,112px)-3rem)] flex-col gap-5">
      <div className="rounded-2xl border border-aurora-border-light bg-[linear-gradient(135deg,#ffffff_0%,#f7f9fd_100%)] px-5 py-5 shadow-aurora-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-primary">
              Operação da Pauta
            </div>
            <h1 className="text-3xl font-semibold text-aurora-text-primary">Pauta de Audiências</h1>
            <p className="mt-1 max-w-2xl text-sm text-aurora-text-secondary">
              Organize a pauta, acompanhe alertas do dia e conduza o ciclo completo da audiência no mesmo painel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 font-medium text-aurora-primary">
              {audiencias.length} audiências no período
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-aurora-text-secondary">
              Visualização: {view}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-aurora-text-secondary">
              Data-base: {date.toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 xl:flex-row xl:overflow-hidden">
        <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <CalendarioPauta
            eventos={eventos}
            procedimentos={mapaProcedimentos}
            diasSemanaAtivos={config?.diasSemanaAtivos ?? [1, 2, 3, 4, 5]}
            view={view}
            date={date}
            podeEditar={podeEditar}
            podeAgendar={podeAgendar}
            podeVerSigilo={podeVerSigilo}
            expedienteInicio={regras.expedienteInicio}
            expedienteFim={regras.expedienteFim}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onViewChange={setView}
            onNavigate={setDate}
            onNovaAudiencia={() => abrirAgendar(new Date())}
          />
        </section>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-aurora-border-light bg-aurora-surface shadow-aurora-sm xl:w-[340px]">
          {painelAtivo === 'pauta' && (
            <PainelPauta
              audiencias={audienciasDoDia}
              data={date}
              onSelecionarAudiencia={abrirAudiencia}
            />
          )}

          {painelAtivo === 'audiencia' && audienciaSelecionada && (
            <PainelAudiencia
              audiencia={audienciaSelecionada}
              procedimento={procedimentoVinculado}
              podeEditar={podeEditar}
              podeEditarAudiencia={podeEditarAudienciaSelecionada}
              podeCancelarAudiencia={podeCancelarAudienciaSelecionada}
              podeExcluirAudiencia={Boolean(usuario && canEdit(usuario.perfil))}
              podeVerSigilo={podeVerSigilo}
              podeAlterarSigilo={podeAlterarSigilo}
              onIniciar={() => void iniciarAudiencia()}
              onEncerrar={() => void encerrarAudiencia()}
              onEditar={() => abrirEditarAudiencia(audienciaSelecionada)}
              onExcluir={() => abrirExcluirAudiencia(audienciaSelecionada)}
              onRemarcar={() => abrirRemarcar(audienciaSelecionada)}
              onCancelar={() => {
                void abrirCancelar(audienciaSelecionada)
              }}
              onChecklist={() => abrirChecklist(audienciaSelecionada)}
              onAlternarSigilo={(sigiloso) => {
                void alternarSigiloAudiencia(sigiloso)
              }}
              onVoltar={abrirPauta}
            />
          )}

          {painelAtivo === 'checklist' && audienciaSelecionada && (
            <PainelChecklist
              audiencia={audienciaSelecionada}
              procedimento={procedimentoSelecionado}
              itens={itensChecklist}
              onEncerrar={() => void encerrarAudiencia()}
              onVoltar={abrirPauta}
              onSalvarItem={salvarRespostaChecklist}
            />
          )}

          {painelAtivo === 'agendar' && (
            <PainelAgendar
              dataInicial={dataInicialAgendamento}
              processoPendente={processoPendenteOrigem}
              sugestaoAutomatica={sugestaoAutomatica}
              expedienteInicio={regras.expedienteInicio}
              expedienteFim={regras.expedienteFim}
              permiteUrgenciaForaExpediente={podeUltrapassarExpediente}
              salas={salas}
              usuarios={usuarios}
              onSalvar={(audienciaId, opcoes) => void concluirAgendamento(audienciaId, opcoes)}
              onCancelar={abrirPauta}
            />
          )}

          {painelAtivo === 'remarcar' && audienciaSelecionada && (
            <PainelRemarcar
              audiencia={audienciaSelecionada}
              onSalvar={() => setPainelAtivo('audiencia')}
              onCancelar={() => setPainelAtivo('audiencia')}
            />
          )}
        </aside>
      </div>

      <Modal
        open={modalForaExpedienteAberto}
        onClose={() => {
          setModalForaExpedienteAberto(false)
          setAcaoPendenteExpediente(null)
        }}
        title="Horario fora do expediente"
        size="md"
        footer={(
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalForaExpedienteAberto(false)
                setAcaoPendenteExpediente(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void confirmarAcaoForaExpediente()}
            >
              Confirmar mesmo assim
            </Button>
          </>
        )}
      >
        <div className="flex items-start gap-3 rounded-xl border border-aurora-amber/30 bg-aurora-amber-pale p-4 text-sm text-aurora-text-secondary">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-aurora-amber" />
          <div>
            O horario selecionado (
            {acaoPendenteExpediente
              ? (
                  (acaoPendenteExpediente.tipo === 'agendar'
                    ? acaoPendenteExpediente.data
                    : (acaoPendenteExpediente.args.start instanceof Date
                        ? acaoPendenteExpediente.args.start
                        : new Date(acaoPendenteExpediente.args.start))
                  ).toTimeString().slice(0, 5)
                )
              : '--:--'}
            ) esta fora do expediente configurado ({regras.expedienteInicio} - {regras.expedienteFim}).
            Deseja confirmar o agendamento fora do expediente?
          </div>
        </div>
      </Modal>

      {audienciaSelecionada && (
        <ModalCancelamentoAudiencia
          open={modalCancelamentoAberto}
          onClose={() => {
            setModalCancelamentoAberto(false)
            setProcessoPendenteCancelamentoId(undefined)
          }}
          audienciaId={audienciaSelecionada.id}
          numeroProcesso={audienciaSelecionada.numeroProcesso}
          processoPendenteId={processoPendenteCancelamentoId}
          onCancelado={() => {
            setModalCancelamentoAberto(false)
            setProcessoPendenteCancelamentoId(undefined)
            abrirPauta()
          }}
        />
      )}

      <Modal
        open={modalExcluirAudienciaAberto && !!audienciaSelecionada}
        onClose={() => {
          setModalExcluirAudienciaAberto(false)
          setConfirmacaoExclusaoAudiencia('')
        }}
        title="Excluir permanentemente?"
        size="md"
        footer={(
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalExcluirAudienciaAberto(false)
                setConfirmacaoExclusaoAudiencia('')
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={excluindoAudiencia}
              disabled={confirmacaoExclusaoAudiencia !== (audienciaSelecionada?.numeroProcesso ?? '')}
              onClick={() => void confirmarExclusaoAudiencia()}
            >
              Confirmar exclusao
            </Button>
          </>
        )}
      >
        {audienciaSelecionada && (
          <div className="space-y-4">
            <div className="rounded-xl border border-aurora-red/30 bg-aurora-red-muted/20 p-4 text-sm text-aurora-text-secondary">
              <p>
                Esta acao e irreversivel. Todos os dados vinculados serao removidos:
                procedimentos, checklist, participantes e documentos.
              </p>
              <p className="mt-3">Para confirmar, digite o numero do processo:</p>
              <p className="mt-2 font-mono text-xs text-aurora-text-muted">
                {audienciaSelecionada.numeroProcesso}
              </p>
            </div>
            <Input
              label="Numero do processo"
              value={confirmacaoExclusaoAudiencia}
              onChange={(event) => setConfirmacaoExclusaoAudiencia(event.target.value)}
              placeholder="Digite exatamente o numero do processo"
              className="font-mono"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={modalEditarAudienciaAberto && !!audienciaSelecionada}
        onClose={() => {
          setModalEditarAudienciaAberto(false)
          setConfirmandoEdicaoRealizada(false)
        }}
        title="Editar audiencia"
        size="md"
        footer={(
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalEditarAudienciaAberto(false)
                setConfirmandoEdicaoRealizada(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={salvandoEdicaoAudiencia}
              onClick={() => void salvarEdicaoAudiencia()}
            >
              Salvar alteracoes
            </Button>
          </>
        )}
      >
        <div className="flex flex-col gap-3">
          {!edicaoAudienciaSomenteObservacoes && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  label="Data"
                  type="date"
                  value={dataEdicaoAudiencia}
                  onChange={(event) => setDataEdicaoAudiencia(event.target.value)}
                />
                <Input
                  label="Hora"
                  type="time"
                  value={horaEdicaoAudiencia}
                  onChange={(event) => setHoraEdicaoAudiencia(event.target.value)}
                />
              </div>
              <Select
                label="Sala"
                value={salaEdicaoAudiencia}
                onChange={(event) => setSalaEdicaoAudiencia(event.target.value)}
              >
                {salas.map((sala) => (
                  <option key={sala.id} value={sala.id}>
                    {sala.nome}
                  </option>
                ))}
              </Select>
              <Select
                label="Tipo de audiencia"
                value={tipoEdicaoAudiencia}
                onChange={(event) => setTipoEdicaoAudiencia(event.target.value as TipoAudiencia)}
              >
                <option value="instrucao">Instrucao</option>
                <option value="interrogatorio">Interrogatorio</option>
                <option value="oitiva">Oitiva</option>
                <option value="julgamento">Julgamento</option>
                <option value="audiencia_una">Audiencia una</option>
                <option value="sessao_juri">Sessao do juri</option>
                <option value="outro">Outro</option>
              </Select>
              <Select
                label="Cargo do magistrado"
                value={cargoEdicaoAudiencia}
                onChange={(event) => setCargoEdicaoAudiencia(event.target.value as CargoMagistrado)}
              >
                <option value="juiz_federal">Juiz Federal</option>
                <option value="juiz_federal_substituto">Juiz Federal Substituto</option>
                <option value="juiz_designado">Juiz designado</option>
              </Select>
            </>
          )}

          <Textarea
            label="Observacoes"
            rows={3}
            value={observacoesEdicaoAudiencia}
            onChange={(event) => setObservacoesEdicaoAudiencia(event.target.value)}
          />

          {confirmandoEdicaoRealizada && (
            <div className="rounded-xl border border-aurora-amber/30 bg-aurora-amber-muted/30 p-3 text-sm text-aurora-text-secondary">
              Esta audiência já foi realizada. A edição ficará registrada no log de auditoria. Confirmar?
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

