import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import {
  Briefcase,
  Heart,
  Info,
  Languages,
  MessageSquare,
  Microscope,
  MoreHorizontal,
  User,
  X,
} from 'lucide-react'
import { Button, Card, Input, Select, Textarea } from '../ui'
import { refParticipantes } from '../../services/collections'
import {
  ArroladoPor,
  FormaIntimacao,
  FormaParticipacao,
  TipoDefesa,
  TipoParticipante,
  type Participante,
} from '../../types/core'
import { metadadosTipo, validarParticipante } from '../../utils/participantes'

interface Props {
  participante?: Partial<Participante>
  processoId: string
  onSalvar: (dados: Omit<Participante, 'id' | 'processoId' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>
  onCancelar: () => void
  carregando?: boolean
}

type EstadoFormulario = {
  tipo?: TipoParticipante
  outroDescricao: string
  nome: string
  formaParticipacao?: FormaParticipacao
  formaIntimacao?: FormaIntimacao
  observacao: string
  tipoDefesa?: TipoDefesa
  nomeAdvogado: string
  preso: boolean
  menor: boolean
  possuiRepresentante: boolean
  nomeRepresentante: string
  arroladoPor?: ArroladoPor
  reuVinculadoId: string
  especialidade: string
  orgaoVinculo: string
  idioma: string
  linguagem: string
  tribunalDeprecado: string
  numeroProcessoCarta: string
  idCarta: string
  idRemessa: string
  dataRemessa: string
  atoOrdinatorioIntimado: boolean
}

function dataParaInput(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

function parseDataInput(valor: string) {
  return valor ? new Date(`${valor}T12:00:00`) : undefined
}

function inputPlaceholderPorTipo(tipo?: TipoParticipante) {
  switch (tipo) {
    case TipoParticipante.REU:
      return 'Nome completo do reu'
    case TipoParticipante.VITIMA:
      return 'Nome completo da vitima'
    case TipoParticipante.TESTEMUNHA:
      return 'Nome completo da testemunha'
    case TipoParticipante.PERITO:
      return 'Nome completo do perito'
    case TipoParticipante.TRADUTOR:
      return 'Nome completo do tradutor/interprete'
    case TipoParticipante.INFORMANTE:
      return 'Nome completo do informante'
    case TipoParticipante.ASSISTENTE_ACUSACAO:
      return 'Nome do assistente de acusacao'
    case TipoParticipante.OUTRO:
      return 'Nome completo'
    default:
      return 'Nome completo'
  }
}

function IconeTipo({ tipo }: { tipo: TipoParticipante }) {
  const nome = metadadosTipo(tipo).icone
  const props = { size: 15 }

  if (nome === 'user') return <User {...props} />
  if (nome === 'heart') return <Heart {...props} />
  if (nome === 'message-square') return <MessageSquare {...props} />
  if (nome === 'microscope') return <Microscope {...props} />
  if (nome === 'languages') return <Languages {...props} />
  if (nome === 'info') return <Info {...props} />
  if (nome === 'briefcase') return <Briefcase {...props} />
  return <MoreHorizontal {...props} />
}

function estadoInicial(participante?: Partial<Participante>): EstadoFormulario {
  return {
    tipo: participante?.tipo,
    outroDescricao: participante?.outroDescricao ?? '',
    nome: participante?.nome ?? '',
    formaParticipacao: participante?.formaParticipacao,
    formaIntimacao: participante?.formaIntimacao,
    observacao: participante?.observacao ?? '',
    tipoDefesa: participante?.tipoDefesa,
    nomeAdvogado: participante?.nomeAdvogado ?? '',
    preso: Boolean(participante?.preso),
    menor: Boolean(participante?.menor),
    possuiRepresentante: Boolean(participante?.possuiRepresentante),
    nomeRepresentante: participante?.nomeRepresentante ?? '',
    arroladoPor: participante?.arroladoPor,
    reuVinculadoId: participante?.reuVinculadoId ?? '',
    especialidade: participante?.especialidade ?? '',
    orgaoVinculo: participante?.orgaoVinculo ?? '',
    idioma: participante?.idioma ?? '',
    linguagem: participante?.linguagem ?? '',
    tribunalDeprecado: participante?.tribunalDeprecado ?? '',
    numeroProcessoCarta: participante?.numeroProcessoCarta ?? '',
    idCarta: participante?.idCarta ?? '',
    idRemessa: participante?.idRemessa ?? '',
    dataRemessa: dataParaInput(participante?.dataRemessa),
    atoOrdinatorioIntimado: Boolean(participante?.atoOrdinatorioIntimado),
  }
}

function montarErrosCampo(estado: EstadoFormulario) {
  const erros: Record<string, string> = {}

  if (!estado.tipo) erros.tipo = 'Selecione o tipo de participante.'
  if (!estado.nome.trim() || estado.nome.trim().length < 2) erros.nome = 'Informe nome com minimo de 2 caracteres.'
  if (!estado.formaParticipacao) erros.formaParticipacao = 'Selecione a forma de participacao.'
  if (!estado.formaIntimacao) erros.formaIntimacao = 'Selecione a forma de intimacao.'
  if (estado.tipo === TipoParticipante.OUTRO && estado.outroDescricao.trim().length < 3) {
    erros.outroDescricao = 'Especifique o tipo com no minimo 3 caracteres.'
  }
  if (estado.tipo === TipoParticipante.REU && !estado.tipoDefesa) erros.tipoDefesa = 'Tipo de defesa obrigatorio.'
  if (
    (estado.tipo === TipoParticipante.TESTEMUNHA || estado.tipo === TipoParticipante.INFORMANTE)
    && !estado.arroladoPor
  ) {
    erros.arroladoPor = 'Informe quem arrolou.'
  }
  if (estado.formaIntimacao === FormaIntimacao.CARTA_PRECATORIA && !estado.dataRemessa) {
    erros.dataRemessa = 'Data de remessa obrigatoria para carta precatoria.'
  }

  return erros
}

const TIPOS_ORDEM = [
  TipoParticipante.REU,
  TipoParticipante.VITIMA,
  TipoParticipante.TESTEMUNHA,
  TipoParticipante.INFORMANTE,
  TipoParticipante.PERITO,
  TipoParticipante.TRADUTOR,
  TipoParticipante.ASSISTENTE_ACUSACAO,
  TipoParticipante.OUTRO,
] as const

export function FormularioParticipante({
  participante,
  processoId,
  onSalvar,
  onCancelar,
  carregando,
}: Props) {
  const [estado, setEstado] = useState<EstadoFormulario>(() => estadoInicial(participante))
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})
  const [errosResumo, setErrosResumo] = useState<string[]>([])
  const [reus, setReus] = useState<Participante[]>([])

  useEffect(() => {
    setEstado(estadoInicial(participante))
  }, [participante])

  useEffect(() => {
    if (!processoId) {
      setReus([])
      return
    }
    const consulta = query(refParticipantes(processoId), orderBy('ordem', 'asc'))
    const unsub = onSnapshot(consulta, (snapshot) => {
      const itens = snapshot.docs.map((item) => item.data() as Participante)
      setReus(itens.filter((item) => item.tipo === TipoParticipante.REU))
    })
    return unsub
  }, [processoId])

  const mostraCamposGerais = Boolean(estado.tipo)
  const isCartaPrecatoria = estado.formaIntimacao === FormaIntimacao.CARTA_PRECATORIA
  const isTestemunhaOuInformante = estado.tipo === TipoParticipante.TESTEMUNHA || estado.tipo === TipoParticipante.INFORMANTE

  const totalObservacao = useMemo(() => estado.observacao.length, [estado.observacao.length])

  async function salvar() {
    const parcial: Partial<Participante> = {
      tipo: estado.tipo,
      outroDescricao: estado.outroDescricao || undefined,
      nome: estado.nome,
      formaParticipacao: estado.formaParticipacao,
      formaIntimacao: estado.formaIntimacao,
      tipoDefesa: estado.tipoDefesa,
      arroladoPor: estado.arroladoPor,
      dataRemessa: parseDataInput(estado.dataRemessa),
    }
    const erros = validarParticipante(parcial)
    const errosLocais = montarErrosCampo(estado)

    if (erros.length > 0 || Object.keys(errosLocais).length > 0) {
      setErrosResumo(erros)
      setErrosCampo(errosLocais)
      return
    }

    const payload: Omit<Participante, 'id' | 'processoId' | 'criadoEm' | 'atualizadoEm'> = {
      tipo: estado.tipo as TipoParticipante,
      outroDescricao: estado.tipo === TipoParticipante.OUTRO ? estado.outroDescricao.trim() : undefined,
      nome: estado.nome.trim(),
      formaParticipacao: estado.formaParticipacao as FormaParticipacao,
      formaIntimacao: estado.formaIntimacao as FormaIntimacao,
      ordem: participante?.ordem ?? 0,
      observacao: estado.observacao.trim() || undefined,
      preso: estado.tipo === TipoParticipante.REU ? estado.preso : undefined,
      tipoDefesa: estado.tipo === TipoParticipante.REU ? estado.tipoDefesa : undefined,
      nomeAdvogado: (
        estado.tipo === TipoParticipante.REU
        || estado.tipo === TipoParticipante.ASSISTENTE_ACUSACAO
      ) ? (estado.nomeAdvogado.trim() || undefined) : undefined,
      menor: estado.tipo === TipoParticipante.VITIMA ? estado.menor : undefined,
      possuiRepresentante: estado.tipo === TipoParticipante.VITIMA ? estado.possuiRepresentante : undefined,
      nomeRepresentante: (estado.tipo === TipoParticipante.VITIMA && estado.possuiRepresentante)
        ? (estado.nomeRepresentante.trim() || undefined)
        : undefined,
      arroladoPor: isTestemunhaOuInformante ? estado.arroladoPor : undefined,
      reuVinculadoId: (isTestemunhaOuInformante && estado.arroladoPor === ArroladoPor.DEFESA)
        ? (estado.reuVinculadoId || undefined)
        : undefined,
      especialidade: estado.tipo === TipoParticipante.PERITO ? (estado.especialidade.trim() || undefined) : undefined,
      orgaoVinculo: estado.tipo === TipoParticipante.PERITO ? (estado.orgaoVinculo.trim() || undefined) : undefined,
      idioma: estado.tipo === TipoParticipante.TRADUTOR ? (estado.idioma.trim() || undefined) : undefined,
      linguagem: estado.tipo === TipoParticipante.TRADUTOR ? (estado.linguagem.trim() || undefined) : undefined,
      tribunalDeprecado: isCartaPrecatoria ? (estado.tribunalDeprecado.trim() || undefined) : undefined,
      numeroProcessoCarta: isCartaPrecatoria ? (estado.numeroProcessoCarta.trim() || undefined) : undefined,
      idCarta: isCartaPrecatoria ? (estado.idCarta.trim() || undefined) : undefined,
      idRemessa: isCartaPrecatoria ? (estado.idRemessa.trim() || undefined) : undefined,
      dataRemessa: isCartaPrecatoria ? parseDataInput(estado.dataRemessa) : undefined,
      atoOrdinatorioIntimado: (
        isTestemunhaOuInformante
        && estado.formaIntimacao !== FormaIntimacao.NAO_REQUER_INTIMACAO
      ) ? estado.atoOrdinatorioIntimado : undefined,
    }

    await onSalvar(payload)
    setErrosCampo({})
    setErrosResumo([])
  }

  return (
    <Card className="space-y-4 border-aurora-border-light">
      {errosResumo.length > 0 && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="font-medium">Corrija os campos obrigatorios para salvar.</div>
          <ul className="mt-2 list-disc pl-5">
            {errosResumo.map((erro, index) => (
              <li key={`${erro}-${index}`}>{erro}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-aurora-text-muted">
          Tipo do participante
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS_ORDEM.map((tipo) => {
            const selecionado = estado.tipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                  selecionado
                    ? 'border-aurora-primary bg-aurora-primary/10 text-aurora-primary'
                    : 'border-aurora-border bg-aurora-elevated text-aurora-text-secondary hover:border-aurora-border-light'
                }`}
                onClick={() => setEstado((atual) => ({ ...atual, tipo }))}
              >
                <IconeTipo tipo={tipo} />
                <span>{metadadosTipo(tipo).rotulo}</span>
              </button>
            )
          })}
        </div>
        {errosCampo.tipo && <p className="mt-1 text-2xs text-red-500">{errosCampo.tipo}</p>}
      </div>

      {estado.tipo === TipoParticipante.OUTRO && (
        <div className="transition-all duration-300">
          <Input
            label="Especifique o tipo de participante"
            value={estado.outroDescricao}
            onChange={(event) => setEstado((atual) => ({ ...atual, outroDescricao: event.target.value }))}
            error={errosCampo.outroDescricao}
          />
        </div>
      )}

      {mostraCamposGerais && (
        <div className="space-y-4 transition-all duration-300">
          <Input
            label="Nome completo"
            placeholder={inputPlaceholderPorTipo(estado.tipo)}
            value={estado.nome}
            onChange={(event) => setEstado((atual) => ({ ...atual, nome: event.target.value }))}
            error={errosCampo.nome}
          />

          <div className="space-y-2">
            <div className="text-xs font-medium text-aurora-text-secondary">Forma de participacao</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {[
                { valor: FormaParticipacao.PRESENCIAL, rotulo: 'Presencial' },
                { valor: FormaParticipacao.VIRTUAL, rotulo: 'Virtual' },
                { valor: FormaParticipacao.A_DEFINIR, rotulo: 'A definir' },
              ].map((item) => (
                <label key={item.valor} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="formaParticipacao"
                    checked={estado.formaParticipacao === item.valor}
                    onChange={() => setEstado((atual) => ({ ...atual, formaParticipacao: item.valor }))}
                  />
                  {item.rotulo}
                </label>
              ))}
            </div>
            {errosCampo.formaParticipacao && <p className="text-2xs text-red-500">{errosCampo.formaParticipacao}</p>}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-aurora-text-secondary">Forma de intimacao</div>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              {[
                { valor: FormaIntimacao.MANDADO_CEMAN_LOCAL, rotulo: 'Mandado - CEMAN local' },
                { valor: FormaIntimacao.MANDADO_CEMAN_DIVERSA, rotulo: 'Mandado - CEMAN diversa' },
                { valor: FormaIntimacao.CARTA_PRECATORIA, rotulo: 'Carta precatoria' },
                { valor: FormaIntimacao.NAO_REQUER_INTIMACAO, rotulo: 'Nao requer intimacao' },
              ].map((item) => (
                <label key={item.valor} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="formaIntimacao"
                    checked={estado.formaIntimacao === item.valor}
                    onChange={() => setEstado((atual) => ({ ...atual, formaIntimacao: item.valor }))}
                  />
                  {item.rotulo}
                </label>
              ))}
            </div>
            {errosCampo.formaIntimacao && <p className="text-2xs text-red-500">{errosCampo.formaIntimacao}</p>}
          </div>
        </div>
      )}

      {estado.tipo === TipoParticipante.REU && (
        <div className="space-y-3 rounded-2xl border border-aurora-border bg-aurora-elevated p-3 transition-all duration-300">
          <Select
            label="Tipo de defesa"
            value={estado.tipoDefesa ?? ''}
            onChange={(event) => setEstado((atual) => ({ ...atual, tipoDefesa: event.target.value as TipoDefesa }))}
            error={errosCampo.tipoDefesa}
          >
            <option value="">Selecione</option>
            <option value={TipoDefesa.DEFENSORIA}>Defensoria Publica</option>
            <option value={TipoDefesa.ADVOGADO_CONSTITUIDO}>Advogado constituido</option>
            <option value={TipoDefesa.ADVOGADO_DATIVO}>Advogado dativo</option>
          </Select>

          {estado.tipoDefesa && estado.tipoDefesa !== TipoDefesa.DEFENSORIA && (
            <Input
              label="Nome do advogado"
              placeholder="Nome do advogado"
              value={estado.nomeAdvogado}
              onChange={(event) => setEstado((atual) => ({ ...atual, nomeAdvogado: event.target.value }))}
            />
          )}

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={estado.preso}
              onChange={(event) => setEstado((atual) => ({ ...atual, preso: event.target.checked }))}
            />
            Reu esta preso
          </label>
        </div>
      )}

      {estado.tipo === TipoParticipante.VITIMA && (
        <div className="space-y-3 rounded-2xl border border-aurora-border bg-aurora-elevated p-3 transition-all duration-300">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={estado.menor}
              onChange={(event) => setEstado((atual) => ({ ...atual, menor: event.target.checked }))}
            />
            Vitima menor de idade
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={estado.possuiRepresentante}
              onChange={(event) => setEstado((atual) => ({ ...atual, possuiRepresentante: event.target.checked }))}
            />
            Possui representante legal
          </label>

          {estado.possuiRepresentante && (
            <Input
              label="Nome do representante"
              placeholder="Nome do representante legal"
              value={estado.nomeRepresentante}
              onChange={(event) => setEstado((atual) => ({ ...atual, nomeRepresentante: event.target.value }))}
            />
          )}
        </div>
      )}

      {isTestemunhaOuInformante && (
        <div className="space-y-3 rounded-2xl border border-aurora-border bg-aurora-elevated p-3 transition-all duration-300">
          <Select
            label="Arrolado por"
            value={estado.arroladoPor ?? ''}
            onChange={(event) => setEstado((atual) => ({ ...atual, arroladoPor: event.target.value as ArroladoPor }))}
            error={errosCampo.arroladoPor}
          >
            <option value="">Selecione</option>
            <option value={ArroladoPor.MPF}>Ministerio Publico Federal (MPF)</option>
            <option value={ArroladoPor.DEFESA}>Defesa</option>
            <option value={ArroladoPor.JUIZO}>Juizo</option>
          </Select>

          {estado.arroladoPor === ArroladoPor.DEFESA && (
            <div>
              {reus.length === 0 ? (
                <p className="text-sm text-aurora-text-muted">
                  Nenhum reu cadastrado ainda. Voce pode vincular depois.
                </p>
              ) : (
                <Select
                  label="Qual reu arrolou esta testemunha?"
                  value={estado.reuVinculadoId}
                  onChange={(event) => setEstado((atual) => ({ ...atual, reuVinculadoId: event.target.value }))}
                >
                  <option value="">Selecione</option>
                  {reus.map((reu) => (
                    <option key={reu.id} value={reu.id}>{reu.nome}</option>
                  ))}
                </Select>
              )}
            </div>
          )}
        </div>
      )}

      {estado.tipo === TipoParticipante.PERITO && (
        <div className="space-y-3 rounded-2xl border border-aurora-border bg-aurora-elevated p-3 transition-all duration-300">
          <Input
            label="Especialidade"
            placeholder="Ex: Medico legista, Contador, Engenheiro"
            value={estado.especialidade}
            onChange={(event) => setEstado((atual) => ({ ...atual, especialidade: event.target.value }))}
          />
          <Input
            label="Orgao/vinculo"
            placeholder="Ex: IML, SETEC, perito particular"
            value={estado.orgaoVinculo}
            onChange={(event) => setEstado((atual) => ({ ...atual, orgaoVinculo: event.target.value }))}
          />
        </div>
      )}

      {estado.tipo === TipoParticipante.TRADUTOR && (
        <div className="space-y-3 rounded-2xl border border-aurora-border bg-aurora-elevated p-3 transition-all duration-300">
          <Input
            label="Idioma"
            placeholder="Ex: Ingles, Espanhol, Mandarim"
            value={estado.idioma}
            onChange={(event) => setEstado((atual) => ({ ...atual, idioma: event.target.value }))}
          />
          <Input
            label="Lingua de sinais ou lingua indigena"
            placeholder="Ex: LIBRAS, Guarani"
            value={estado.linguagem}
            onChange={(event) => setEstado((atual) => ({ ...atual, linguagem: event.target.value }))}
          />
        </div>
      )}

      {isCartaPrecatoria && (
        <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 transition-all duration-300">
          <div className="text-sm font-semibold text-amber-800">Dados da carta precatoria</div>
          <Input
            label="Tribunal deprecado"
            placeholder="Ex: TRF-1, TJPA, TRF-3"
            value={estado.tribunalDeprecado}
            onChange={(event) => setEstado((atual) => ({ ...atual, tribunalDeprecado: event.target.value }))}
          />
          <Input
            label="Numero do processo na carta"
            placeholder="Numero do processo no juizo deprecado"
            value={estado.numeroProcessoCarta}
            onChange={(event) => setEstado((atual) => ({ ...atual, numeroProcessoCarta: event.target.value }))}
          />
          <Input
            label="ID da carta"
            placeholder="Identificador da carta precatoria"
            value={estado.idCarta}
            onChange={(event) => setEstado((atual) => ({ ...atual, idCarta: event.target.value }))}
          />
          <Input
            label="ID da remessa"
            placeholder="Identificador da remessa"
            value={estado.idRemessa}
            onChange={(event) => setEstado((atual) => ({ ...atual, idRemessa: event.target.value }))}
          />
          <Input
            label="Data de remessa da carta"
            type="date"
            hint="Necessario para o controle de prazo (30/40 dias)"
            value={estado.dataRemessa}
            onChange={(event) => setEstado((atual) => ({ ...atual, dataRemessa: event.target.value }))}
            error={errosCampo.dataRemessa}
          />
        </div>
      )}

      {isTestemunhaOuInformante && estado.formaIntimacao && estado.formaIntimacao !== FormaIntimacao.NAO_REQUER_INTIMACAO && (
        <label className="inline-flex items-start gap-2 rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={estado.atoOrdinatorioIntimado}
            onChange={(event) => setEstado((atual) => ({ ...atual, atoOrdinatorioIntimado: event.target.checked }))}
          />
          Parte que arrolou foi intimada por ato ordinatorio sobre diligencia negativa
        </label>
      )}

      {mostraCamposGerais && (
        <div>
          <Textarea
            label="Observacao"
            maxLength={500}
            rows={4}
            placeholder="Observacoes sobre este participante"
            value={estado.observacao}
            onChange={(event) => setEstado((atual) => ({ ...atual, observacao: event.target.value }))}
          />
          <div className="mt-1 text-right text-2xs text-aurora-text-muted">
            {totalObservacao}/500
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-aurora-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          onClick={onCancelar}
          type="button"
        >
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={carregando}
          type="button"
          onClick={() => { void salvar() }}
        >
          Salvar participante
        </Button>
      </div>
    </Card>
  )
}

