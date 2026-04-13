import { useMemo, useState } from 'react'
import { differenceInDays } from 'date-fns'
import {
  Briefcase,
  ChevronDown,
  Edit2,
  GripVertical,
  Heart,
  Info,
  Languages,
  MessageSquare,
  Microscope,
  MoreHorizontal,
  Trash2,
  User,
} from 'lucide-react'
import { Button, Card } from '../ui'
import { FormaIntimacao, TipoParticipante, type Participante } from '../../types/core'
import {
  corDestaqueTipo,
  metadadosTipo,
  requerIntimacao,
  resumoParticipante,
} from '../../utils/participantes'

interface Props {
  participante: Participante
  onEditar: () => void
  onRemover: () => void
  arrastavel?: boolean
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

function badgeIntimacao(forma: FormaIntimacao) {
  if (forma === FormaIntimacao.MANDADO_CEMAN_LOCAL) {
    return { texto: 'Mandado - CEMAN local', className: 'bg-slate-600/20 text-slate-200 border-slate-500/50' }
  }
  if (forma === FormaIntimacao.MANDADO_CEMAN_DIVERSA) {
    return { texto: 'Mandado - CEMAN diversa', className: 'bg-slate-600/20 text-slate-200 border-slate-500/50' }
  }
  if (forma === FormaIntimacao.CARTA_PRECATORIA) {
    return { texto: 'Carta precatoria', className: 'bg-amber-500/20 text-amber-200 border-amber-500/60' }
  }
  return null
}

export function CardParticipante({
  participante,
  onEditar,
  onRemover,
  arrastavel,
}: Props) {
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const badge = badgeIntimacao(participante.formaIntimacao)
  const destaque = corDestaqueTipo(participante.tipo)

  const alertaCarta = useMemo(() => {
    if (
      participante.formaIntimacao !== FormaIntimacao.CARTA_PRECATORIA
      || !participante.dataRemessa
      || participante.dataDevolvida
    ) {
      return null
    }
    const dias = differenceInDays(new Date(), participante.dataRemessa)
    if (dias >= 40) return { dias, className: 'text-red-300' }
    if (dias >= 30) return { dias, className: 'text-amber-300' }
    return null
  }, [participante.dataDevolvida, participante.dataRemessa, participante.formaIntimacao])

  return (
    <div className={`transition-all duration-200 ${saindo ? 'scale-[0.98] opacity-0' : 'opacity-100'}`}>
      <div style={{ borderLeftWidth: 4, borderLeftColor: destaque }} className="rounded-2xl border-l-4">
        <Card className="space-y-2 border-aurora-border-light bg-aurora-surface">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            {arrastavel && <GripVertical size={15} className="cursor-grab text-aurora-text-muted" />}
            <IconeTipo tipo={participante.tipo} />
            <span className="font-medium text-aurora-text-primary">{metadadosTipo(participante.tipo).rotulo}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" icon={<Edit2 size={13} />} onClick={onEditar}>
              Editar
            </Button>
            {!confirmandoRemocao && (
              <Button
                variant="ghost"
                size="xs"
                icon={<Trash2 size={13} />}
                onClick={() => setConfirmandoRemocao(true)}
              >
                Remover
              </Button>
            )}
          </div>
        </div>

        <div className="text-sm font-semibold text-aurora-text-primary">{participante.nome}</div>
        <div className="text-xs text-aurora-text-secondary">{resumoParticipante(participante)}</div>

        {badge && requerIntimacao(participante) && (
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-2xs ${badge.className}`}>
            {badge.texto}
          </span>
        )}

        {alertaCarta && (
          <div className={`text-xs font-medium ${alertaCarta.className}`}>
            ⚠ Carta sem retorno: {alertaCarta.dias} dias
          </div>
        )}

        {confirmandoRemocao && (
          <div className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <div>Remover {participante.nome}? Esta acao nao pode ser desfeita.</div>
            <div className="mt-2 flex gap-2">
              <Button variant="ghost" size="xs" icon={<ChevronDown size={13} />} onClick={() => setConfirmandoRemocao(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="xs"
                onClick={() => {
                  setSaindo(true)
                  window.setTimeout(() => {
                    onRemover()
                  }, 180)
                }}
              >
                Confirmar remocao
              </Button>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  )
}
