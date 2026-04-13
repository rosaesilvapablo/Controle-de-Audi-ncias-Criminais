import { Badge } from '../ui'
import { MetaCNJ } from '../../types/core'

const LABELS: Record<Exclude<MetaCNJ, MetaCNJ.SEM_META>, string> = {
  [MetaCNJ.META_1]: 'Meta CNJ 1',
  [MetaCNJ.META_2]: 'Meta CNJ 2',
  [MetaCNJ.META_4]: 'Meta CNJ 4',
  [MetaCNJ.META_5]: 'Meta CNJ 5',
  [MetaCNJ.META_6]: 'Meta CNJ 6',
  [MetaCNJ.META_30]: 'Meta CNJ 30',
}

export function BadgeMetaCNJ({ meta }: { meta: MetaCNJ }) {
  if (meta === MetaCNJ.SEM_META) return null

  return (
    <Badge variant="primary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
      {LABELS[meta]}
    </Badge>
  )
}
