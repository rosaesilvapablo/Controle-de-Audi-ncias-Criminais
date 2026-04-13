import {
  Bell,
  Clock3,
  ClockAlert,
  ClockArrowDown,
  ListChecks,
  Mail,
  MailX,
} from 'lucide-react'
import type { Alerta, TipoAlerta } from '../../types/core'

const CONFIG: Record<TipoAlerta, { className: string; icon: typeof Clock3 }> = {
  prescricao_vencida: {
    className: 'border-red-300 bg-red-50 text-red-700',
    icon: ClockAlert,
  },
  prescricao_7_dias: {
    className: 'border-red-300 bg-red-50 text-red-700',
    icon: Clock3,
  },
  carta_precatoria_40_dias: {
    className: 'border-red-300 bg-red-50 text-red-700',
    icon: MailX,
  },
  prescricao_30_dias: {
    className: 'border-amber-300 bg-amber-50 text-amber-700',
    icon: Clock3,
  },
  carta_precatoria_30_dias: {
    className: 'border-amber-300 bg-amber-50 text-amber-700',
    icon: Mail,
  },
  prescricao_90_dias: {
    className: 'border-yellow-300 bg-yellow-50 text-yellow-700',
    icon: ClockArrowDown,
  },
  intimacao_pendente: {
    className: 'border-amber-300 bg-amber-50 text-amber-700',
    icon: Bell,
  },
  fase_com_pendencia: {
    className: 'border-amber-300 bg-amber-50 text-amber-700',
    icon: ListChecks,
  },
}

export function AlertaCard({
  alerta,
  onClick,
}: {
  alerta: Alerta
  onClick?: () => void
}) {
  const config = CONFIG[alerta.tipo]
  const Icon = config.icon

  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left ${config.className} ${
        onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : 'cursor-default'
      }`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="mt-0.5 shrink-0">
        <Icon size={16} />
      </span>
      <span className="text-sm font-medium">{alerta.mensagem}</span>
    </button>
  )
}
