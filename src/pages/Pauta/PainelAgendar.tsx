import { useEffect, useMemo, useState } from 'react'
import { addMinutes } from 'date-fns'
import { Button, Input, Select } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { getDuracaoPorTipo, useDuracaoPorTipo } from '../../hooks'
import { useCriarAudiencia, validarAgendamento } from '../../hooks/useAudiencias'
import { mapearTipoAudienciaPendente } from '../../lib/audienciaHelpers'
import { isForaDoExpediente } from '../../lib/permissoes'
import type { SlotSugerido } from '../../lib/sugestaoAutomatica'
import { verificarAntecedencia } from '../../utils/validacoes'
import type {
  AdvogadoProcesso,
  Audiencia,
  ClasseProcessual,
  ObjetoDoFeito,
  ProcessoPendente,
  ReuProcesso,
  Sala,
  Usuario,
} from '../../types'
import {
  ADVOGADO_TIPO_LABELS,
  CLASSE_PROCESSUAL_LABELS,
  OBJETO_FEITO_LABELS,
  TIPO_AUDIENCIA_LABELS,
  isAdmin,
  isMagistrado,
} from '../../types'

interface PainelAgendarProps {
  dataInicial?: Date
  processoPendente?: ProcessoPendente | null
  sugestaoAutomatica?: SlotSugerido | null
  expedienteInicio: string
  expedienteFim: string
  permiteUrgenciaForaExpediente: boolean
  salas: Sala[]
  usuarios: Usuario[]
  onSalvar: (
    audienciaId: string,
    opcoes?: { agendadoComAvisoAntecedencia: boolean },
  ) => void
  onCancelar: () => void
}

const dateValue = (date: Date) => date.toISOString().slice(0, 10)
const timeValue = (date: Date) => date.toTimeString().slice(0, 5)

function mapearTipoAudienciaParaDuracao(tipo: Audiencia['tipo']): string {
  const mapa: Record<Audiencia['tipo'], string> = {
    instrucao: 'aij',
    interrogatorio: 'interrogatorio',
    oitiva: 'oitiva',
    julgamento: 'aij',
    audiencia_una: 'una',
    sessao_juri: 'aij',
    outro: 'outro',
  }

  return mapa[tipo] ?? 'outro'
}

export function PainelAgendar({
  dataInicial,
  processoPendente,
  sugestaoAutomatica,
  expedienteInicio,
  expedienteFim,
  permiteUrgenciaForaExpediente,
  salas,
  usuarios,
  onSalvar,
  onCancelar,
}: PainelAgendarProps) {
  const { usuario } = useAuth()
  const { criar, salvando } = useCriarAudiencia()
  const { duracoes } = useDuracaoPorTipo()

  const magistrados = useMemo(
    () => usuarios.filter((item) => item.perfil === 'magistrado' && item.ativo),
    [usuarios],
  )

  const [numeroProcesso, setNumeroProcesso] = useState('')
  const [tipoAudiencia, setTipoAudiencia] = useState<Audiencia['tipo']>('instrucao')
  const [duracaoMinutos, setDuracaoMinutos] = useState(60)
  const [classeProcessual, setClasseProcessual] =
    useState<ClasseProcessual>('acao_penal')
  const [objetoDoFeito, setObjetoDoFeito] =
    useState<ObjetoDoFeito>('outro')
  const [juizoDeprecante, setJuizoDeprecante] = useState('')
  const [dataAgendada, setDataAgendada] = useState(dateValue(dataInicial ?? new Date()))
  const [horarioAgendado, setHorarioAgendado] = useState(
    timeValue(dataInicial ?? new Date()),
  )
  const [magistradoId, setMagistradoId] = useState('')
  const [salaId, setSalaId] = useState('')
  const [reus, setReus] = useState<ReuProcesso[]>([])
  const [vitimas, setVitimas] = useState<string[]>([])
  const [advogados, setAdvogados] = useState<AdvogadoProcesso[]>([])
  const [novoReuNome, setNovoReuNome] = useState('')
  const [novoReuPreso, setNovoReuPreso] = useState(false)
  const [novaVitima, setNovaVitima] = useState('')
  const [novoAdvNome, setNovoAdvNome] = useState('')
  const [novoAdvOab, setNovoAdvOab] = useState('')
  const [novoAdvTipo, setNovoAdvTipo] =
    useState<AdvogadoProcesso['tipo']>('constituido')
  const [sigiloso, setSigiloso] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagemProcessoPendente, setMensagemProcessoPendente] = useState('')
  const podeDefinirSigilo = isAdmin(usuario?.perfil) || isMagistrado(usuario?.perfil)

  useEffect(() => {
    const base = dataInicial ?? new Date()
    setDataAgendada(dateValue(base))
    setHorarioAgendado(timeValue(base))
    setMagistradoId(magistrados[0]?.uid ?? '')
    setSalaId(salas[0]?.id ?? '')
    setNumeroProcesso('')
    setTipoAudiencia('instrucao')
    setDuracaoMinutos(getDuracaoPorTipo('aij', duracoes))
    setClasseProcessual('acao_penal')
    setObjetoDoFeito('outro')
    setJuizoDeprecante('')
    setReus([])
    setVitimas([])
    setAdvogados([])
    setNovoReuNome('')
    setNovoReuPreso(false)
    setNovaVitima('')
    setNovoAdvNome('')
    setNovoAdvOab('')
    setNovoAdvTipo('constituido')
    setSigiloso(false)
    setErro('')
    setMensagemProcessoPendente('')
  }, [dataInicial, duracoes, magistrados, salas])

  useEffect(() => {
    if (!processoPendente) return

    const magistradoCorrespondente =
      magistrados.find((item) => {
        const cargoMagistrado = (item as Usuario & { cargoMagistrado?: string })
          .cargoMagistrado
        return cargoMagistrado === processoPendente.cargoMagistrado
      }) ?? magistrados[0]

    setNumeroProcesso(processoPendente.numeroProcesso)
    setTipoAudiencia(mapearTipoAudienciaPendente(processoPendente.tipoAudiencia))
    setDuracaoMinutos(getDuracaoPorTipo(processoPendente.tipoAudiencia, duracoes))
    setMagistradoId(magistradoCorrespondente?.uid ?? '')
    setSigiloso(Boolean(processoPendente.sigiloso))
    setReus(
      Array.from({ length: processoPendente.quantidadeReus }, () => ({
        nome: '',
        preso: false,
      })),
    )
    setMensagemProcessoPendente(
      'Preencha os nomes das pessoas conforme os dados do processo.',
    )
  }, [duracoes, magistrados, processoPendente])

  useEffect(() => {
    if (!sugestaoAutomatica) return

    const inicioSugerido = new Date(sugestaoAutomatica.dataHoraInicioIso)
    setDataAgendada(dateValue(inicioSugerido))
    setHorarioAgendado(timeValue(inicioSugerido))
    setSalaId(sugestaoAutomatica.salaId)
    setMensagemProcessoPendente(
      `Sugestao carregada: ${sugestaoAutomatica.data.split('-').reverse().join('/')} as ${sugestaoAutomatica.hora} na sala ${sugestaoAutomatica.salaNome}. Revise os dados antes de confirmar.`,
    )
  }, [sugestaoAutomatica])

  const dataSelecionada = dataAgendada ? new Date(`${dataAgendada}T12:00:00`) : null
  const avisoAntecedencia = dataSelecionada
    ? verificarAntecedencia(dataSelecionada)
    : null
  const horarioForaExpediente = isForaDoExpediente(
    horarioAgendado,
    expedienteInicio,
    expedienteFim,
  )
  const erroForaExpediente =
    horarioForaExpediente && !permiteUrgenciaForaExpediente
      ? `Horario fora do expediente (${expedienteInicio} - ${expedienteFim}).`
      : undefined

  const salvar = async () => {
    if (!numeroProcesso.trim()) {
      setErro('Informe o número do processo.')
      return
    }
    if (!dataAgendada || !horarioAgendado || !magistradoId || !salaId) {
      setErro('Preencha data, horário, magistrado e sala.')
      return
    }
    if (horarioForaExpediente && !permiteUrgenciaForaExpediente) {
      setErro(`Horario fora do expediente (${expedienteInicio} - ${expedienteFim}).`)
      return
    }
    if (!reus.length) {
      setErro('Adicione pelo menos um réu.')
      return
    }
    if (reus.some((item) => !item.nome.trim())) {
      setErro('Preencha o nome de todos os réus antes de agendar.')
      return
    }
    if (
      classeProcessual === 'carta_precatoria_criminal' &&
      !juizoDeprecante.trim()
    ) {
      setErro('Informe o juízo deprecante para Carta Precatória.')
      return
    }

    const dataHoraInicio = new Date(`${dataAgendada}T${horarioAgendado}:00`)
    const dataHoraFim = addMinutes(
      dataHoraInicio,
      Math.min(480, Math.max(5, duracaoMinutos || 60)),
    )
    const validacao = await validarAgendamento({
      dataHoraInicio,
      dataHoraFim,
      salaId,
      magistradoId,
    })

    if (!validacao.valido) {
      setErro(
        validacao.erro ??
          'Não foi possível agendar. Verifique os dados e tente novamente.',
      )
      return
    }

    const magistrado = magistrados.find((item) => item.uid === magistradoId)
    const sala = salas.find((item) => item.id === salaId)

    const audienciaId = await criar({
      numeroProcesso: numeroProcesso.trim(),
      tipo: tipoAudiencia,
      classeProcessual,
      objetoDoFeito,
      juizoDeprecante:
        classeProcessual === 'carta_precatoria_criminal'
          ? juizoDeprecante.trim()
          : undefined,
      dataHoraInicio,
      dataHoraFim,
      salaId,
      salaNome: sala?.nome ?? 'Sala',
      magistradoId,
      magistradoNome: magistrado?.nome ?? 'Magistrado',
      reuPreso: reus.some((item) => item.preso),
      reus,
      vitimas,
      advogados,
      partes: reus.map((item) => item.nome).join(', '),
      sigiloso,
      agendadoComAvisoAntecedencia: Boolean(avisoAntecedencia?.mensagemAviso),
    })

    if (audienciaId) {
      setErro('')
      onSalvar(audienciaId, {
        agendadoComAvisoAntecedencia: Boolean(avisoAntecedencia?.mensagemAviso),
      })
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-border p-4">
        <h2 className="text-base font-semibold text-aurora-text-primary">
          Agendar audiência
        </h2>
        <p className="mt-1 text-sm text-aurora-text-muted">
          {dataAgendada
            ? `Data pré-preenchida: ${dataAgendada.split('-').reverse().join('/')}`
            : 'Escolha uma data no calendário.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <Input
            label="Número do processo"
            value={numeroProcesso}
            onChange={(e) => setNumeroProcesso(e.target.value)}
            className="font-mono"
            placeholder="Informe o número do processo"
          />

          <Select
            label="Tipo de audiência"
            value={tipoAudiencia}
            onChange={(e) => {
              const proximoTipo = e.target.value as Audiencia['tipo']
              setTipoAudiencia(proximoTipo)
              setDuracaoMinutos(
                getDuracaoPorTipo(
                  mapearTipoAudienciaParaDuracao(proximoTipo),
                  duracoes,
                ),
              )
            }}
          >
            {Object.entries(TIPO_AUDIENCIA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Input
            label="Duração (minutos)"
            type="number"
            min={5}
            max={480}
            value={String(duracaoMinutos)}
            onChange={(e) =>
              setDuracaoMinutos(
                Math.min(480, Math.max(5, Number(e.target.value || 60))),
              )
            }
          />

          <Select
            label="Classe processual"
            value={classeProcessual}
            onChange={(e) =>
              setClasseProcessual(e.target.value as ClasseProcessual)
            }
          >
            {Object.entries(CLASSE_PROCESSUAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <div
            style={{
              display:
                classeProcessual === 'carta_precatoria_criminal'
                  ? 'flex'
                  : 'none',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <Input
              label="Juízo Deprecante"
              value={juizoDeprecante}
              onChange={(e) => setJuizoDeprecante(e.target.value)}
              placeholder="Informe o juízo deprecante"
            />
          </div>

          <Select
            label="Objeto do feito"
            value={objetoDoFeito}
            onChange={(e) => setObjetoDoFeito(e.target.value as ObjetoDoFeito)}
          >
            {Object.entries(OBJETO_FEITO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          {podeDefinirSigilo && (
            <label className="flex items-start gap-3 rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-3 text-sm text-aurora-text-secondary">
              <input
                type="checkbox"
                checked={sigiloso}
                onChange={(e) => setSigiloso(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-aurora-text-primary">
                  Processo sigiloso
                </span>
                <span className="mt-1 block text-xs text-aurora-text-muted">
                  Processo ficara oculto para usuarios nao autorizados.
                </span>
              </span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data"
              type="date"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
            />
            <Input
              label="Horário de início"
              type="time"
              error={erroForaExpediente}
              value={horarioAgendado}
              onChange={(e) => setHorarioAgendado(e.target.value)}
            />
          </div>

          {avisoAntecedencia?.mensagemAviso && (
            <div className="rounded-xl border border-aurora-amber/30 bg-aurora-amber-pale p-3 text-sm text-aurora-text-secondary">
              {avisoAntecedencia.mensagemAviso}
            </div>
          )}

          {horarioForaExpediente && permiteUrgenciaForaExpediente && (
            <div className="rounded-xl border border-aurora-amber/30 bg-aurora-amber-pale p-3 text-sm text-aurora-text-secondary">
              Horario fora do expediente. O agendamento sera registrado no log de auditoria.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Magistrado"
              value={magistradoId}
              onChange={(e) => setMagistradoId(e.target.value)}
            >
              {magistrados.map((item) => (
                <option key={item.uid} value={item.uid}>
                  {item.nome}
                </option>
              ))}
            </Select>
            <Select label="Sala" value={salaId} onChange={(e) => setSalaId(e.target.value)}>
              {salas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </Select>
          </div>

          {mensagemProcessoPendente && (
            <div className="rounded-xl border border-aurora-primary/30 bg-aurora-primary-muted/10 p-3 text-sm text-aurora-text-secondary">
              {mensagemProcessoPendente}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-semibold text-aurora-text-primary">
              Réus / Depoimentos pessoais
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Informe o nome do réu"
                value={novoReuNome}
                onChange={(e) => setNovoReuNome(e.target.value)}
              />
              <div className="flex items-center gap-1 rounded-xl border border-aurora-border bg-aurora-elevated p-1">
                <Button
                  size="xs"
                  variant={novoReuPreso ? 'danger' : 'ghost'}
                  onClick={() => setNovoReuPreso(true)}
                >
                  Sim
                </Button>
                <Button
                  size="xs"
                  variant={!novoReuPreso ? 'secondary' : 'ghost'}
                  onClick={() => setNovoReuPreso(false)}
                >
                  Não
                </Button>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!novoReuNome.trim()) return
                  setReus((atual) => [
                    ...atual,
                    { nome: novoReuNome.trim(), preso: novoReuPreso },
                  ])
                  setNovoReuNome('')
                  setNovoReuPreso(false)
                }}
              >
                Adicionar
              </Button>
            </div>

            {reus.length ? (
              <div className="space-y-2">
                {reus.map((item, index) => (
                  <div
                    key={`${item.nome || 'reu'}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2 text-sm text-aurora-text-primary"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Input
                        className="min-w-[180px] flex-1"
                        placeholder={`Nome do réu ${index + 1}`}
                        value={item.nome}
                        onChange={(e) =>
                          setReus((atual) =>
                            atual.map((atualItem, i) =>
                              i === index
                                ? { ...atualItem, nome: e.target.value }
                                : atualItem,
                            ),
                          )
                        }
                      />
                      <Button
                        size="xs"
                        variant={item.preso ? 'danger' : 'ghost'}
                        onClick={() =>
                          setReus((atual) =>
                            atual.map((atualItem, i) =>
                              i === index
                                ? { ...atualItem, preso: true }
                                : atualItem,
                            ),
                          )
                        }
                      >
                        Sim
                      </Button>
                      <Button
                        size="xs"
                        variant={!item.preso ? 'secondary' : 'ghost'}
                        onClick={() =>
                          setReus((atual) =>
                            atual.map((atualItem, i) =>
                              i === index
                                ? { ...atualItem, preso: false }
                                : atualItem,
                            ),
                          )
                        }
                      >
                        Não
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="ml-3 text-sm text-aurora-text-muted hover:text-aurora-red"
                      onClick={() =>
                        setReus((atual) => atual.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-aurora-text-muted">
                Nenhum réu adicionado.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-aurora-text-primary">
              Vítimas (opcional)
            </div>
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Informe o nome da vítima"
                value={novaVitima}
                onChange={(e) => setNovaVitima(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!novaVitima.trim()) return
                  setVitimas((atual) => [...atual, novaVitima.trim()])
                  setNovaVitima('')
                }}
              >
                Adicionar
              </Button>
            </div>
            {vitimas.length ? (
              <div className="space-y-2">
                {vitimas.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2 text-sm text-aurora-text-primary"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      className="text-sm text-aurora-text-muted hover:text-aurora-red"
                      onClick={() =>
                        setVitimas((atual) => atual.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-aurora-text-muted">
                Nenhuma vítima adicionada.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-aurora-text-primary">
              Advogados
            </div>
            <div className="grid grid-cols-[1fr,90px,110px,auto] gap-2">
              <Input
                placeholder="Informe o nome do advogado"
                value={novoAdvNome}
                onChange={(e) => setNovoAdvNome(e.target.value)}
              />
              <Input
                placeholder="OAB"
                value={novoAdvOab}
                onChange={(e) => setNovoAdvOab(e.target.value)}
              />
              <Select
                value={novoAdvTipo}
                onChange={(e) =>
                  setNovoAdvTipo(e.target.value as AdvogadoProcesso['tipo'])
                }
              >
                {Object.entries(ADVOGADO_TIPO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                onClick={() => {
                  if (!novoAdvNome.trim() || !novoAdvOab.trim()) return
                  setAdvogados((atual) => [
                    ...atual,
                    {
                      nome: novoAdvNome.trim(),
                      oab: novoAdvOab.trim(),
                      tipo: novoAdvTipo,
                    },
                  ])
                  setNovoAdvNome('')
                  setNovoAdvOab('')
                  setNovoAdvTipo('constituido')
                }}
              >
                Adicionar
              </Button>
            </div>
            {advogados.length ? (
              <div className="space-y-2">
                {advogados.map((item, index) => (
                  <div
                    key={`${item.nome}-${item.oab}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2 text-left text-xs text-aurora-text-primary"
                  >
                    <span>
                      {item.nome} · OAB {item.oab} ·{' '}
                      {ADVOGADO_TIPO_LABELS[item.tipo]}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-aurora-text-muted hover:text-aurora-red"
                      onClick={() =>
                        setAdvogados((atual) =>
                          atual.filter((_, i) => i !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-aurora-text-muted">
                Nenhum advogado adicionado.
              </div>
            )}
          </div>

          {erro && (
            <div className="rounded-xl border border-aurora-red/30 bg-aurora-red-muted p-3 text-sm text-aurora-red">
              {erro}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-aurora-border p-4">
        <Button variant="ghost" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          loading={salvando}
          disabled={Boolean(erroForaExpediente)}
          onClick={() => void salvar()}
        >
          Verificar e agendar
        </Button>
      </div>
    </div>
  )
}
