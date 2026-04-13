import {
  AlertTriangle,
  Baby,
  Gavel,
  Lock,
  UserRound,
} from 'lucide-react'
import { Prioridade } from '../../types/core'

const CONFIG = {
  [Prioridade.REU_PRESO]: {
    label: 'Réu preso',
    icon: Lock,
    className: 'border-red-300 bg-red-50 text-red-700',
  },
  [Prioridade.CRIANCA]: {
    label: 'Criança',
    icon: Baby,
    className: 'border-red-300 bg-red-50 text-red-700',
  },
  [Prioridade.IDOSO_70]: {
    label: 'Idoso +70',
    icon: UserRound,
    className: 'border-orange-300 bg-orange-50 text-orange-700',
  },
  [Prioridade.VITIMA]: {
    label: 'Vítima',
    icon: AlertTriangle,
    className: 'border-orange-300 bg-orange-50 text-orange-700',
  },
  [Prioridade.JUIZO]: {
    label: 'Prioridade do juízo',
    icon: Gavel,
    className: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  },
  [Prioridade.IDOSO_60]: {
    label: 'Idoso +60',
    icon: UserRound,
    className: 'border-amber-300 bg-amber-50 text-amber-700',
  },
} as const

export function BadgePrioridade({
  prioridade,
  tamanho = 'md',
}: {
  prioridade: Prioridade
  tamanho?: 'sm' | 'md'
}) {
  const config = CONFIG[prioridade]
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${
        tamanho === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
      } ${config.className}`}
    >
      <Icon size={tamanho === 'sm' ? 12 : 14} />
      <span>{config.label}</span>
    </span>
  )
}
