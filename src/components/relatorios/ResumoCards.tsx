import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Bell, FileCheck2, FileClock, Files, MailWarning } from 'lucide-react'
import { Card } from '../ui'
import { ROTAS } from '../../router/rotas'
import type { ResumoRelatorios } from '../../hooks/useRelatorios'

export function ResumoCards({ resumo }: { resumo: ResumoRelatorios }) {
  const navigate = useNavigate()

  const cards: Array<{
    titulo: string
    subtitulo: string
    valor: number
    icon: typeof Files
    classe: string
    onClick?: () => void
  }> = [
    {
      titulo: 'Total',
      subtitulo: 'processos',
      valor: resumo.totalProcessos,
      icon: Files,
      classe: 'text-aurora-text-primary',
    },
    {
      titulo: 'Em andamento',
      subtitulo: 'processos',
      valor: resumo.processosEmAndamento,
      icon: FileClock,
      classe: 'text-aurora-amber',
    },
    {
      titulo: 'Encerrados',
      subtitulo: 'processos',
      valor: resumo.processosEncerrados,
      icon: FileCheck2,
      classe: 'text-aurora-green',
    },
    {
      titulo: 'Prescricao proxima',
      subtitulo: 'ate 30 dias',
      valor: resumo.processosComPrescricaoProxima,
      icon: AlertTriangle,
      classe: 'text-aurora-amber',
      onClick: () => navigate(`${ROTAS.RELATORIOS}?aba=prescricao`),
    },
    {
      titulo: 'Intimacoes pendentes',
      subtitulo: 'controle global',
      valor: resumo.totalIntimacoespendentes,
      icon: Bell,
      classe: 'text-aurora-amber',
      onClick: () => navigate(ROTAS.INTIMACOES),
    },
    {
      titulo: 'Cartas em alerta',
      subtitulo: '30+ dias',
      valor: resumo.totalCartasEmAlerta,
      icon: MailWarning,
      classe: 'text-aurora-red',
      onClick: () => navigate(`${ROTAS.INTIMACOES}?tipo=carta`),
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card
          key={card.titulo}
          hover={Boolean(card.onClick)}
          onClick={card.onClick}
          className={card.onClick ? 'cursor-pointer' : ''}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-aurora-text-muted">{card.titulo}</div>
              <div className={`mt-2 text-3xl font-semibold ${card.classe}`}>{card.valor}</div>
              <div className="text-xs text-aurora-text-muted">{card.subtitulo}</div>
            </div>
            <card.icon size={20} className={card.classe} />
          </div>
        </Card>
      ))}
    </div>
  )
}
