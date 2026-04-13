import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PlayCircle,
  Printer,
} from 'lucide-react'
import { useConfiguracoes } from '../../hooks'
import { Button, Card, EmptyState, StatCard } from '../../components/ui'
import { formatarDataExtenso, isReuPressoPendente } from '../../lib/audienciaHelpers'
import { imprimirPautaDia } from '../../lib/imprimirPauta'
import type { Audiencia, Procedimento } from '../../types'

interface PainelPautaProps {
  audiencias: Audiencia[]
  data: Date
  onSelecionarAudiencia: (a: Audiencia) => void
}

export function PainelPauta({
  audiencias,
  data,
  onSelecionarAudiencia,
}: PainelPautaProps) {
  const { config } = useConfiguracoes()

  const resumo = {
    total: audiencias.length,
    emAndamento: audiencias.filter((item) => item.status === 'em_andamento').length,
    realizadas: audiencias.filter((item) => item.status === 'realizada').length,
    pendencias: audiencias.filter(
      (item) =>
        ((item as Audiencia & { procedimento?: Procedimento | null }).procedimento
          ?.itensCriticosPendentes ?? 0) > 0,
    ).length,
  }

  const alertas = audiencias.filter((item) =>
    isReuPressoPendente(
      item,
      (item as Audiencia & { procedimento?: Procedimento | null }).procedimento ?? null,
    ),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-aurora-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-aurora-text-primary">
              {formatarDataExtenso(data)}
            </h2>
            <p className="mt-1 text-sm text-aurora-text-muted">
              Clique em uma audiência para ver as opções
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={<Printer size={13} />}
            onClick={() => imprimirPautaDia(audiencias, data, config)}
            title="Imprimir pauta do dia"
          >
            Imprimir pauta
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="No total"
            value={resumo.total}
            color="primary"
            icon={<CalendarDays size={16} />}
          />
          <StatCard
            label="Em andamento"
            value={resumo.emAndamento}
            color="amber"
            icon={<PlayCircle size={16} />}
          />
          <StatCard
            label="Realizadas"
            value={resumo.realizadas}
            color="green"
            icon={<CheckCircle2 size={16} />}
          />
          <StatCard
            label="Com pendências"
            value={resumo.pendencias}
            color="red"
            icon={<AlertTriangle size={16} />}
          />
        </div>

        {resumo.total === 0 && (
          <div className="mt-4">
            <EmptyState
              icon={<Clock3 size={22} />}
              title="Nenhuma audiência para esta data"
              description="Selecione outro dia no calendário ou clique em um horário disponível para montar a pauta."
            />
          </div>
        )}

        {alertas.length > 0 && (
          <div className="mt-4 space-y-3">
            {alertas.map((item) => {
              const procedimento =
                (item as Audiencia & { procedimento?: Procedimento | null }).procedimento ??
                null

              return (
                <Card
                  key={item.id}
                  hover
                  className="border-aurora-red/30 bg-aurora-red-muted/60"
                  onClick={() => onSelecionarAudiencia(item)}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0 text-aurora-red"
                    />
                    <div className="text-sm text-aurora-text-primary">
                      Réu preso · Proc {item.numeroProcesso} —{' '}
                      {procedimento?.itensCriticosPendentes ?? 0} item(ns)
                      obrigatório(s) não preenchido(s)
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
