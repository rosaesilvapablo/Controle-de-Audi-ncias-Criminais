import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Button, Input, Select, Textarea } from '../../components/ui'
import { useAtualizarAudiencia, validarAgendamento } from '../../hooks/useAudiencias'
import { calcularDataHoraFim, calcularDuracaoMinutos } from '../../lib/audienciaHelpers'
import type { Audiencia } from '../../types'
import { MOTIVOS_CANCELAMENTO } from '../../types'

interface PainelRemarcarProps {
  audiencia: Audiencia
  onSalvar: () => void
  onCancelar: () => void
}

const dateValue = (date: Date) => date.toISOString().slice(0, 10)
const timeValue = (date: Date) => date.toTimeString().slice(0, 5)

export function PainelRemarcar({
  audiencia,
  onSalvar,
  onCancelar,
}: PainelRemarcarProps) {
  const { atualizar } = useAtualizarAudiencia()
  const [novaData, setNovaData] = useState(
    dateValue(audiencia.dataHoraInicio.toDate()),
  )
  const [novoHorario, setNovoHorario] = useState(
    timeValue(audiencia.dataHoraInicio.toDate()),
  )
  const [motivo, setMotivo] =
    useState<(typeof MOTIVOS_CANCELAMENTO)[number] | ''>('')
  const [motivoOutro, setMotivoOutro] = useState('')
  const [erro, setErro] = useState('')

  const salvar = async () => {
    if (!novaData || !novoHorario) {
      setErro('Informe a nova data e o novo horário.')
      return
    }
    if (!motivo) {
      setErro('Selecione o motivo da redesignação.')
      return
    }
    if (motivo === 'Outro motivo' && !motivoOutro.trim()) {
      setErro('Descreva o motivo da redesignação.')
      return
    }

    const inicio = new Date(`${novaData}T${novoHorario}:00`)
    const duracao = Math.max(
      15,
      calcularDuracaoMinutos(
        audiencia.dataHoraInicio.toDate(),
        audiencia.dataHoraFim.toDate(),
      ),
    )
    const fim = calcularDataHoraFim(inicio, duracao)
    const validacao = await validarAgendamento({
      dataHoraInicio: inicio,
      dataHoraFim: fim,
      salaId: audiencia.salaId,
      magistradoId: audiencia.magistradoId,
      audienciaIdIgnorar: audiencia.id,
    })

    if (!validacao.valido) {
      setErro(
        validacao.erro ??
          'Não foi possível redesignar a audiência. Verifique os dados e tente novamente.',
      )
      return
    }

    const motivoTexto = motivo === 'Outro motivo' ? motivoOutro.trim() : motivo
    await atualizar(
      audiencia.id,
      {
        status: 'redesignada',
        dataHoraInicio: Timestamp.fromDate(inicio) as never,
        dataHoraFim: Timestamp.fromDate(fim) as never,
        observacoes: [audiencia.observacoes, `Remarcação: ${motivoTexto}`]
          .filter(Boolean)
          .join('\n'),
      },
      audiencia,
      audiencia.status,
    )
    setErro('')
    onSalvar()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-border p-4">
        <h2 className="text-base font-semibold text-aurora-text-primary">
          Remarcar audiência
        </h2>
        <p className="mt-1 font-mono text-sm text-aurora-text-muted">
          {audiencia.numeroProcesso}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          <Input
            label="Nova data"
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
          />
          <Input
            label="Novo horário de início"
            type="time"
            value={novoHorario}
            onChange={(e) => setNovoHorario(e.target.value)}
          />
          <Select
            label="Motivo da remarcação"
            value={motivo}
            onChange={(e) =>
              setMotivo(e.target.value as (typeof MOTIVOS_CANCELAMENTO)[number])
            }
          >
            <option value="">Selecione um motivo</option>
            {MOTIVOS_CANCELAMENTO.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          {motivo === 'Outro motivo' && (
            <Textarea
              label="Descreva o motivo"
              value={motivoOutro}
              onChange={(e) => setMotivoOutro(e.target.value)}
            />
          )}
          {erro && (
            <div className="rounded-xl border border-aurora-red/30 bg-aurora-red-muted p-3 text-sm text-aurora-red">
              {erro}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-aurora-border p-4">
        <Button variant="ghost" className="flex-1" onClick={onCancelar}>
          Voltar
        </Button>
        <Button variant="primary" className="flex-1" onClick={() => void salvar()}>
          Verificar e remarcar
        </Button>
      </div>
    </div>
  )
}
