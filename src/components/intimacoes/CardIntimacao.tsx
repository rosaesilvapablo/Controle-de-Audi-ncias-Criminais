import { useMemo, useState } from 'react'
import { differenceInDays } from 'date-fns'
import {
  Check,
  ChevronRight,
  FileX,
  Heart,
  Info,
  Languages,
  Mail,
  MessageSquare,
  Microscope,
  MoreHorizontal,
  RotateCcw,
  Save,
  User,
  X,
} from 'lucide-react'
import { Button, Card, Input, Select } from '../ui'
import {
  FormaIntimacao,
  StatusIntimacao,
  TipoParticipante,
  type Intimacao,
} from '../../types/core'

interface Props {
  intimacao: Intimacao
  onRegistrarCumprimento: (
    status: StatusIntimacao,
    data?: Date,
  ) => Promise<void>
  onAtualizarCarta: (
    dados: Pick<Intimacao,
      'tribunalDeprecado' | 'numeroProcessoCarta' |
      'idCarta' | 'idRemessa' |
      'dataRemessa' | 'dataDevolvida'>
  ) => Promise<void>
  onRegistrarAtoOrdinatorio: (
    intimado: boolean,
  ) => Promise<void>
  modoCompacto?: boolean
  numeroProcesso?: string
}

function toDateInput(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

function formatarData(data?: Date) {
  if (!data) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(data)
}

function rotuloTipoParticipante(tipo: TipoParticipante) {
  switch (tipo) {
    case TipoParticipante.REU: return 'Reu'
    case TipoParticipante.VITIMA: return 'Vitima'
    case TipoParticipante.TESTEMUNHA: return 'Testemunha'
    case TipoParticipante.PERITO: return 'Perito'
    case TipoParticipante.TRADUTOR: return 'Tradutor'
    case TipoParticipante.INFORMANTE: return 'Informante'
    case TipoParticipante.ASSISTENTE_ACUSACAO: return 'Assistente de acusacao'
    case TipoParticipante.OUTRO:
    default:
      return 'Outro'
  }
}

function rotuloTipoIntimacao(tipo: FormaIntimacao) {
  if (tipo === FormaIntimacao.MANDADO_CEMAN_LOCAL) return 'Mandado - CEMAN local'
  if (tipo === FormaIntimacao.MANDADO_CEMAN_DIVERSA) return 'Mandado - CEMAN diversa'
  if (tipo === FormaIntimacao.CARTA_PRECATORIA) return 'Carta precatoria'
  return 'Nao requer intimacao'
}

function IconeParticipante({ tipo }: { tipo: TipoParticipante }) {
  if (tipo === TipoParticipante.REU) return <User size={15} />
  if (tipo === TipoParticipante.VITIMA) return <Heart size={15} />
  if (tipo === TipoParticipante.TESTEMUNHA) return <MessageSquare size={15} />
  if (tipo === TipoParticipante.PERITO) return <Microscope size={15} />
  if (tipo === TipoParticipante.TRADUTOR) return <Languages size={15} />
  if (tipo === TipoParticipante.INFORMANTE) return <Info size={15} />
  return <MoreHorizontal size={15} />
}

function BadgeStatus({ intimacao }: { intimacao: Intimacao }) {
  if (intimacao.status === StatusIntimacao.PENDENTE) {
    return <span className="rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-2xs text-amber-200">Pendente</span>
  }
  if (intimacao.status === StatusIntimacao.POSITIVA) {
    return (
      <span className="rounded-full border border-green-400/60 bg-green-500/20 px-2 py-0.5 text-2xs text-green-200">
        Cumprida ✓ {intimacao.dataCumprimento ? `(${formatarData(intimacao.dataCumprimento)})` : ''}
      </span>
    )
  }
  if (intimacao.status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO) {
    return <span className="rounded-full border border-red-400/60 bg-red-500/20 px-2 py-0.5 text-2xs text-red-200">Negativa - nao localizado</span>
  }
  return <span className="rounded-full border border-red-400/60 bg-red-500/20 px-2 py-0.5 text-2xs text-red-200">Negativa - devolvida</span>
}

export function CardIntimacao({
  intimacao,
  onRegistrarCumprimento,
  onAtualizarCarta,
  onRegistrarAtoOrdinatorio,
  modoCompacto,
  numeroProcesso,
}: Props) {
  const [abrirCumprimento, setAbrirCumprimento] = useState(false)
  const [abrirNegativa, setAbrirNegativa] = useState(false)
  const [editandoCarta, setEditandoCarta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [dataCumprimento, setDataCumprimento] = useState(toDateInput(new Date()))
  const [motivoNegativa, setMotivoNegativa] = useState<'nao_localizado' | 'devolvida'>('nao_localizado')
  const [carta, setCarta] = useState({
    tribunalDeprecado: intimacao.tribunalDeprecado ?? '',
    numeroProcessoCarta: intimacao.numeroProcessoCarta ?? '',
    idCarta: intimacao.idCarta ?? '',
    idRemessa: intimacao.idRemessa ?? '',
    dataRemessa: toDateInput(intimacao.dataRemessa),
    dataDevolvida: toDateInput(intimacao.dataDevolvida),
  })

  const diasSemRetorno = useMemo(() => {
    if (
      intimacao.tipo !== FormaIntimacao.CARTA_PRECATORIA
      || !intimacao.dataRemessa
      || intimacao.dataDevolvida
    ) {
      return null
    }
    return differenceInDays(new Date(), intimacao.dataRemessa)
  }, [intimacao.dataDevolvida, intimacao.dataRemessa, intimacao.tipo])

  async function confirmarCumprimento() {
    setSalvando(true)
    try {
      await onRegistrarCumprimento(
        StatusIntimacao.POSITIVA,
        dataCumprimento ? new Date(`${dataCumprimento}T12:00:00`) : new Date(),
      )
      setAbrirCumprimento(false)
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarNegativa() {
    setSalvando(true)
    try {
      await onRegistrarCumprimento(
        motivoNegativa === 'nao_localizado'
          ? StatusIntimacao.NEGATIVA_NAO_LOCALIZADO
          : StatusIntimacao.NEGATIVA_DEVOLVIDA,
      )
      setAbrirNegativa(false)
    } finally {
      setSalvando(false)
    }
  }

  async function salvarCarta() {
    setSalvando(true)
    try {
      await onAtualizarCarta({
        tribunalDeprecado: carta.tribunalDeprecado.trim() || undefined,
        numeroProcessoCarta: carta.numeroProcessoCarta.trim() || undefined,
        idCarta: carta.idCarta.trim() || undefined,
        idRemessa: carta.idRemessa.trim() || undefined,
        dataRemessa: carta.dataRemessa ? new Date(`${carta.dataRemessa}T12:00:00`) : undefined,
        dataDevolvida: carta.dataDevolvida ? new Date(`${carta.dataDevolvida}T12:00:00`) : undefined,
      })
      setEditandoCarta(false)
    } finally {
      setSalvando(false)
    }
  }

  if (modoCompacto) {
    return (
      <Card className="space-y-2 border-aurora-border-light bg-aurora-surface">
        <div className="text-sm font-medium text-aurora-text-primary">
          {numeroProcesso ? `${numeroProcesso} · ` : ''}{rotuloTipoParticipante(intimacao.participanteTipo)} · {intimacao.participanteNome}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStatus intimacao={intimacao} />
          {typeof diasSemRetorno === 'number' && diasSemRetorno >= 30 && (
            <span className={`rounded-full px-2 py-0.5 text-2xs ${diasSemRetorno >= 40 ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
              Carta sem retorno ha {diasSemRetorno} dias
            </span>
          )}
        </div>
        {intimacao.status === StatusIntimacao.PENDENTE && (
          <Button
            size="xs"
            variant="success"
            icon={<Check size={13} />}
            onClick={() => { void onRegistrarCumprimento(StatusIntimacao.POSITIVA, new Date()) }}
          >
            {intimacao.tipo === FormaIntimacao.CARTA_PRECATORIA ? 'Registrar devolucao' : 'Registrar cumprimento'}
          </Button>
        )}
        {(intimacao.status === StatusIntimacao.NEGATIVA_DEVOLVIDA || intimacao.status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO) && (
          <Button
            size="xs"
            variant="secondary"
            icon={<RotateCcw size={13} />}
            onClick={() => { void onRegistrarCumprimento(StatusIntimacao.PENDENTE) }}
          >
            Reabrir
          </Button>
        )}
      </Card>
    )
  }

  return (
    <Card className="space-y-4 border-aurora-border-light bg-aurora-surface">
      <div className="flex flex-wrap items-center gap-2 text-sm text-aurora-text-secondary">
        <IconeParticipante tipo={intimacao.participanteTipo} />
        <span className="font-medium text-aurora-text-primary">
          {rotuloTipoParticipante(intimacao.participanteTipo)} · {intimacao.participanteNome}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-aurora-border bg-aurora-elevated px-2 py-0.5 text-2xs text-aurora-text-secondary">
          {rotuloTipoIntimacao(intimacao.tipo)}
        </span>
        <BadgeStatus intimacao={intimacao} />
      </div>

      {intimacao.tipo === FormaIntimacao.CARTA_PRECATORIA && (
        <div className="rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-aurora-text-primary">Dados da carta precatoria</div>
            {!editandoCarta ? (
              <Button size="xs" variant="ghost" onClick={() => setEditandoCarta(true)}>Editar dados</Button>
            ) : null}
          </div>

          {!editandoCarta ? (
            <div className="grid gap-1 text-xs text-aurora-text-secondary md:grid-cols-2">
              <div>Tribunal deprecado: {intimacao.tribunalDeprecado || '—'}</div>
              <div>Nº processo na carta: {intimacao.numeroProcessoCarta || '—'}</div>
              <div>ID da carta: {intimacao.idCarta || '—'}</div>
              <div>ID da remessa: {intimacao.idRemessa || '—'}</div>
              <div>Data de remessa: {intimacao.dataRemessa ? formatarData(intimacao.dataRemessa) : '⚠ Nao informada'}</div>
              <div>Data de devolucao: {intimacao.dataDevolvida ? formatarData(intimacao.dataDevolvida) : 'Aguardando'}</div>
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              <Input label="Tribunal deprecado" value={carta.tribunalDeprecado} onChange={(event) => setCarta((a) => ({ ...a, tribunalDeprecado: event.target.value }))} />
              <Input label="Nº processo na carta" value={carta.numeroProcessoCarta} onChange={(event) => setCarta((a) => ({ ...a, numeroProcessoCarta: event.target.value }))} />
              <Input label="ID da carta" value={carta.idCarta} onChange={(event) => setCarta((a) => ({ ...a, idCarta: event.target.value }))} />
              <Input label="ID da remessa" value={carta.idRemessa} onChange={(event) => setCarta((a) => ({ ...a, idRemessa: event.target.value }))} />
              <Input type="date" label="Data de remessa" value={carta.dataRemessa} onChange={(event) => setCarta((a) => ({ ...a, dataRemessa: event.target.value }))} />
              <Input type="date" label="Data de devolucao" value={carta.dataDevolvida} onChange={(event) => setCarta((a) => ({ ...a, dataDevolvida: event.target.value }))} />
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button size="xs" variant="ghost" icon={<X size={13} />} onClick={() => {
                  setEditandoCarta(false)
                  setCarta({
                    tribunalDeprecado: intimacao.tribunalDeprecado ?? '',
                    numeroProcessoCarta: intimacao.numeroProcessoCarta ?? '',
                    idCarta: intimacao.idCarta ?? '',
                    idRemessa: intimacao.idRemessa ?? '',
                    dataRemessa: toDateInput(intimacao.dataRemessa),
                    dataDevolvida: toDateInput(intimacao.dataDevolvida),
                  })
                }}>Cancelar</Button>
                <Button size="xs" variant="primary" icon={<Save size={13} />} loading={salvando} onClick={() => { void salvarCarta() }}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {intimacao.tipo === FormaIntimacao.CARTA_PRECATORIA && (
        <div>
          {intimacao.dataDevolvida ? (
            <div className="rounded-xl border border-green-400/50 bg-green-500/15 px-3 py-2 text-sm text-green-200">
              Devolvida em {formatarData(intimacao.dataDevolvida)}
            </div>
          ) : (
            <div>
              {typeof diasSemRetorno === 'number' && diasSemRetorno >= 40 && (
                <div className="rounded-xl bg-red-700 px-3 py-2 text-sm text-white">
                  ⚠ Carta sem retorno ha {diasSemRetorno} dias - prazo critico
                </div>
              )}
              {typeof diasSemRetorno === 'number' && diasSemRetorno >= 30 && diasSemRetorno < 40 && (
                <div className="rounded-xl bg-amber-700 px-3 py-2 text-sm text-white">
                  ⚠ Carta sem retorno ha {diasSemRetorno} dias - atencao
                </div>
              )}
              {typeof diasSemRetorno === 'number' && diasSemRetorno < 30 && (
                <div className="text-sm text-aurora-text-muted">Remessa ha {diasSemRetorno} dias</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {intimacao.status === StatusIntimacao.PENDENTE && (
          <>
            <Button size="xs" variant="success" icon={<Check size={13} />} onClick={() => {
              setAbrirCumprimento((a) => !a)
              setAbrirNegativa(false)
            }}>
              Registrar cumprimento
            </Button>
            <Button size="xs" variant="danger" icon={<FileX size={13} />} onClick={() => {
              setAbrirNegativa((a) => !a)
              setAbrirCumprimento(false)
            }}>
              Registrar diligencia negativa
            </Button>
          </>
        )}

        {intimacao.status === StatusIntimacao.POSITIVA && (
          <Button size="xs" variant="secondary" icon={<RotateCcw size={13} />} onClick={() => { void onRegistrarCumprimento(StatusIntimacao.PENDENTE) }}>
            Desfazer cumprimento
          </Button>
        )}

        {(intimacao.status === StatusIntimacao.NEGATIVA_DEVOLVIDA || intimacao.status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO) && (
          <>
            <Button size="xs" variant="secondary" icon={<RotateCcw size={13} />} onClick={() => { void onRegistrarCumprimento(StatusIntimacao.PENDENTE) }}>
              Reabrir diligencia
            </Button>
            <Button size="xs" variant="success" icon={<Check size={13} />} onClick={() => {
              setAbrirCumprimento((a) => !a)
              setAbrirNegativa(false)
            }}>
              Registrar cumprimento
            </Button>
          </>
        )}
      </div>

      {abrirCumprimento && (
        <div className="rounded-2xl border border-green-400/50 bg-green-500/10 px-3 py-3">
          <div className="mb-2 text-sm font-medium text-green-200">Data do cumprimento</div>
          <div className="flex flex-wrap items-end gap-2">
            <Input type="date" value={dataCumprimento} onChange={(event) => setDataCumprimento(event.target.value)} />
            <Button size="xs" variant="success" loading={salvando} onClick={() => { void confirmarCumprimento() }}>
              Confirmar
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setAbrirCumprimento(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {abrirNegativa && (
        <div className="rounded-2xl border border-red-400/50 bg-red-500/10 px-3 py-3">
          <div className="mb-2 text-sm font-medium text-red-200">Motivo da diligencia negativa</div>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={motivoNegativa} onChange={(event) => setMotivoNegativa(event.target.value as 'nao_localizado' | 'devolvida')}>
              <option value="nao_localizado">Nao localizado</option>
              <option value="devolvida">Devolvida sem cumprimento</option>
            </Select>
            <Button size="xs" variant="danger" loading={salvando} onClick={() => { void confirmarNegativa() }}>
              Confirmar
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setAbrirNegativa(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {(intimacao.participanteTipo === TipoParticipante.TESTEMUNHA || intimacao.participanteTipo === TipoParticipante.INFORMANTE)
        && (intimacao.status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO || intimacao.status === StatusIntimacao.NEGATIVA_DEVOLVIDA) && (
          <label className="inline-flex items-start gap-2 rounded-2xl border border-aurora-border px-3 py-2 text-sm text-aurora-text-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(intimacao.atoOrdinatorioIntimado)}
              onChange={(event) => { void onRegistrarAtoOrdinatorio(event.target.checked) }}
            />
            <span>
              <span className="block text-aurora-text-primary">Parte que arrolou foi intimada por ato ordinatorio</span>
              <span className="text-xs text-aurora-text-muted">Marcar quando o MPF ou a defesa foi comunicado sobre a diligencia negativa.</span>
            </span>
          </label>
      )}

      {modoCompacto && (
        <div className="flex justify-end">
          <Button size="xs" variant="ghost" iconRight={<ChevronRight size={13} />}>
            Ver detalhes
          </Button>
        </div>
      )}
    </Card>
  )
}
