import { differenceInDays } from 'date-fns'
import { Link } from 'react-router-dom'
import { ArrowDownToLine } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import { ROTAS } from '../../router/rotas'
import { exportarParaCSV, formatarDataRelatorio, intimacoesParaCSV } from '../../utils/exportacao'
import { FormaIntimacao, StatusIntimacao, type Intimacao } from '../../types/core'

function badgeStatus(status: StatusIntimacao) {
  if (status === StatusIntimacao.POSITIVA) return <Badge variant="success">Cumprida</Badge>
  if (status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO) return <Badge variant="danger">Negativa - não localizado</Badge>
  if (status === StatusIntimacao.NEGATIVA_DEVOLVIDA) return <Badge variant="danger">Negativa - devolvida</Badge>
  return <Badge variant="warning">Pendente</Badge>
}

function tipoLabel(tipo: FormaIntimacao) {
  if (tipo === FormaIntimacao.MANDADO_CEMAN_LOCAL) return 'Mandado local'
  if (tipo === FormaIntimacao.MANDADO_CEMAN_DIVERSA) return 'Mandado diversa'
  if (tipo === FormaIntimacao.CARTA_PRECATORIA) return 'Carta precatória'
  return 'Não requer intimação'
}

export function TabelaIntimacoes({
  intimacoes,
  exportavel,
  nomeExportacao = 'relatorio-intimacoes',
}: {
  intimacoes: (Intimacao & { numeroProcesso: string })[]
  exportavel?: boolean
  nomeExportacao?: string
}) {
  if (!intimacoes.length) {
    return (
      <Card>
        <p className="text-sm text-aurora-text-muted">Nenhuma intimação neste relatório.</p>
      </Card>
    )
  }

  return (
    <Card className="space-y-3">
      {exportavel && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => exportarParaCSV(intimacoesParaCSV(intimacoes), nomeExportacao)}
          >
            Exportar CSV
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-aurora-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-aurora-border bg-aurora-elevated text-left text-aurora-text-muted">
              <th className="px-3 py-2">Nº Processo</th>
              <th className="px-3 py-2">Participante</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Data remessa</th>
              <th className="px-3 py-2">Dias sem retorno</th>
              <th className="px-3 py-2">Data cumprimento</th>
            </tr>
          </thead>
          <tbody>
            {intimacoes.map((item) => {
              const diasSemRetorno = item.dataRemessa && !item.dataDevolvida
                ? differenceInDays(new Date(), item.dataRemessa)
                : null
              const classeDias = diasSemRetorno && diasSemRetorno >= 40
                ? 'text-aurora-red'
                : diasSemRetorno && diasSemRetorno >= 30
                  ? 'text-aurora-amber'
                  : 'text-aurora-text-secondary'

              return (
                <tr key={item.id} className="border-b border-aurora-border/70">
                  <td className="px-3 py-2">
                    <Link className="font-mono text-aurora-primary hover:underline" to={ROTAS.processo(item.processoId)}>
                      {item.numeroProcesso}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{item.participanteNome}</td>
                  <td className="px-3 py-2">{tipoLabel(item.tipo)}</td>
                  <td className="px-3 py-2">{badgeStatus(item.status)}</td>
                  <td className="px-3 py-2">
                    {item.tipo === FormaIntimacao.CARTA_PRECATORIA ? formatarDataRelatorio(item.dataRemessa) : '—'}
                  </td>
                  <td className={`px-3 py-2 ${classeDias}`}>
                    {item.tipo === FormaIntimacao.CARTA_PRECATORIA && diasSemRetorno !== null ? diasSemRetorno : '—'}
                  </td>
                  <td className="px-3 py-2">{formatarDataRelatorio(item.dataCumprimento)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

