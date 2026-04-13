import { useEffect, useMemo, useState } from 'react'
import { differenceInDays, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button, Input, Textarea } from '../ui'
import { TipoAlerta, type Alerta, type Prescricao } from '../../types/core'

function resumirPrescricao(prescricao: Prescricao, alertas: Alerta[]) {
  if (!prescricao.dataLimite && !prescricao.dataPerspectiva) {
    return {
      texto: 'Prescrição não cadastrada',
      className: 'text-aurora-text-muted',
    }
  }

  const alertaPrescricao = alertas.find((item) => item.tipo.startsWith('prescricao_'))
  const dataBase = prescricao.dataLimite ?? prescricao.dataPerspectiva

  if (!dataBase) {
    return {
      texto: 'Prescrição não cadastrada',
      className: 'text-aurora-text-muted',
    }
  }

  const dias = differenceInDays(dataBase, new Date())
  const dataFormatada = format(dataBase, 'dd/MM/yyyy', { locale: ptBR })

  if (alertaPrescricao?.tipo === TipoAlerta.PRESCRICAO_VENCIDA) {
    return { texto: `Prescrito — ${dataFormatada}`, className: 'text-red-700' }
  }
  if (alertaPrescricao?.tipo === TipoAlerta.PRESCRICAO_7_DIAS) {
    return { texto: `Prescrição em ${dias} dias`, className: 'text-red-700' }
  }
  if (alertaPrescricao?.tipo === TipoAlerta.PRESCRICAO_30_DIAS) {
    return { texto: `Prescrição em ${dias} dias`, className: 'text-amber-700' }
  }
  if (alertaPrescricao?.tipo === TipoAlerta.PRESCRICAO_90_DIAS) {
    return { texto: `Prescrição em ${dias} dias`, className: 'text-yellow-700' }
  }

  return {
    texto: `Prescrição: ${dataFormatada}`,
    className: 'text-aurora-text-secondary',
  }
}

function dateValue(data?: Date) {
  return data ? data.toISOString().slice(0, 10) : ''
}

export function SecaoPrescricao({
  prescricao,
  alertas,
  onSalvar,
  expandido,
  onAlternarExpandido,
}: {
  prescricao: Prescricao
  alertas: Alerta[]
  onSalvar: (dados: Prescricao) => Promise<void>
  expandido?: boolean
  onAlternarExpandido?: () => void
}) {
  const [expandidoInterno, setExpandidoInterno] = useState(false)
  const [dataLimite, setDataLimite] = useState(dateValue(prescricao.dataLimite))
  const [dataPerspectiva, setDataPerspectiva] = useState(dateValue(prescricao.dataPerspectiva))
  const [observacao, setObservacao] = useState(prescricao.observacao ?? '')
  const [alertaAtivo, setAlertaAtivo] = useState(prescricao.alertaAtivo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const estaExpandido = expandido ?? expandidoInterno

  useEffect(() => {
    setDataLimite(dateValue(prescricao.dataLimite))
    setDataPerspectiva(dateValue(prescricao.dataPerspectiva))
    setObservacao(prescricao.observacao ?? '')
    setAlertaAtivo(prescricao.alertaAtivo)
    setErro(null)
  }, [prescricao])

  const resumo = useMemo(() => resumirPrescricao(prescricao, alertas), [alertas, prescricao])
  const avisoPerspectiva =
    dataLimite && dataPerspectiva && dataPerspectiva > dataLimite
      ? 'A data em perspectiva está posterior à data limite legal.'
      : null

  const alternar = () => {
    if (onAlternarExpandido) {
      onAlternarExpandido()
      return
    }
    setExpandidoInterno((atual) => !atual)
  }

  const cancelar = () => {
    setDataLimite(dateValue(prescricao.dataLimite))
    setDataPerspectiva(dateValue(prescricao.dataPerspectiva))
    setObservacao(prescricao.observacao ?? '')
    setAlertaAtivo(prescricao.alertaAtivo)
    setErro(null)
    if (onAlternarExpandido && expandido) {
      onAlternarExpandido()
    } else {
      setExpandidoInterno(false)
    }
  }

  return (
    <div className="rounded-3xl border border-aurora-border-light bg-aurora-surface p-5 shadow-aurora-sm">
      <button type="button" className="flex w-full items-center justify-between gap-4 text-left" onClick={alternar}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-aurora-text-primary">Prescrição</div>
          <div className={`mt-1 text-sm ${resumo.className}`}>{resumo.texto}</div>
        </div>
        {estaExpandido ? <ChevronUp size={18} className="text-aurora-text-muted" /> : <ChevronDown size={18} className="text-aurora-text-muted" />}
      </button>

      {estaExpandido && (
        <div className="mt-5 space-y-4">
          <Input
            label="Data limite legal"
            type="date"
            hint="Prazo máximo legal para a prescrição"
            value={dataLimite}
            onChange={(event) => setDataLimite(event.target.value)}
          />

          <Input
            label="Data em perspectiva"
            type="date"
            hint="Estimativa operacional de prescrição"
            value={dataPerspectiva}
            onChange={(event) => setDataPerspectiva(event.target.value)}
          />

          {avisoPerspectiva && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{avisoPerspectiva}</span>
            </div>
          )}

          <div className="space-y-1">
            <Textarea
              label="Observação"
              rows={4}
              value={observacao}
              maxLength={500}
              onChange={(event) => setObservacao(event.target.value)}
            />
            <div className="text-right text-2xs text-aurora-text-muted">
              {observacao.length}/500
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-aurora-border bg-aurora-elevated px-3 py-3 text-sm text-aurora-text-secondary">
            <input
              type="checkbox"
              checked={alertaAtivo}
              onChange={(event) => setAlertaAtivo(event.target.checked)}
            />
            <span>
              <span className="block font-medium text-aurora-text-primary">
                Alertas de prescrição ativos
              </span>
              <span className="mt-1 block text-xs text-aurora-text-muted">
                Quando desligado, os alertas de prescrição deixam de ser calculados para este processo.
              </span>
            </span>
          </label>

          {erro && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelar}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={salvando}
              onClick={async () => {
                setSalvando(true)
                setErro(null)
                try {
                  await onSalvar({
                    dataLimite: dataLimite ? new Date(`${dataLimite}T12:00:00`) : undefined,
                    dataPerspectiva: dataPerspectiva ? new Date(`${dataPerspectiva}T12:00:00`) : undefined,
                    observacao: observacao.trim() || undefined,
                    alertaAtivo,
                  })
                  cancelar()
                } catch {
                  setErro('Não foi possível salvar os dados de prescrição.')
                } finally {
                  setSalvando(false)
                }
              }}
            >
              Salvar
            </Button>
          </div>

          {!alertas.some((item) => item.tipo.startsWith('prescricao_')) && prescricao.dataLimite && (
            <div className="flex items-center gap-2 text-xs text-green-700">
              <CheckCircle2 size={14} />
              <span>Sem alertas críticos de prescrição no momento.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
