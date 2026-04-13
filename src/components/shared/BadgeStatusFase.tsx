import { Badge } from '../ui'
import { StatusFase } from '../../types/core'

const STATUS_CONFIG: Record<StatusFase, { text: string; variant: 'muted' | 'warning' | 'danger' | 'success' }> = {
  [StatusFase.NAO_INICIADA]: { text: 'Não iniciada', variant: 'muted' },
  [StatusFase.EM_ANDAMENTO]: { text: 'Em andamento', variant: 'warning' },
  [StatusFase.COM_PENDENCIA]: { text: 'Com pendência', variant: 'danger' },
  [StatusFase.CONCLUIDA]: { text: 'Concluída', variant: 'success' },
}

export function BadgeStatusFase({
  status,
  rotulo,
}: {
  status: StatusFase
  rotulo: string
}) {
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant={config.variant} className="gap-1.5" >
      <span className="sr-only">{rotulo}</span>
      {config.text}
    </Badge>
  )
}
