import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '../ui'

export function GraficoBarras({
  dados,
  titulo,
  altura = 200,
}: {
  dados: { rotulo: string; valor: number; cor?: string }[]
  titulo: string
  altura?: number
}) {
  const normalizados = dados.map((item) => ({
    ...item,
    cor: item.cor ?? '#534AB7',
  }))

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold text-aurora-text-primary">{titulo}</h3>
      <div style={{ width: '100%', height: altura }}>
        <ResponsiveContainer>
          <BarChart data={normalizados}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d2a5f" />
            <XAxis dataKey="rotulo" tick={{ fill: '#c2c2dd', fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: '#c2c2dd', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: '#14133a',
                border: '1px solid #2d2a5f',
                borderRadius: 12,
                color: '#f3f2ff',
              }}
            />
            <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
              {normalizados.map((entry) => (
                <Cell key={entry.rotulo} fill={entry.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
