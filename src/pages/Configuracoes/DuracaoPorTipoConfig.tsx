import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { useDuracaoPorTipo } from '../../hooks'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { Button, Card, Input } from '../../components/ui'
import { TIPO_AUDIENCIA_PENDENTE_LABELS, type TipoAudienciaPendente } from '../../types'

const TIPOS: TipoAudienciaPendente[] = [
  'aij',
  'interrogatorio',
  'oitiva',
  'admonitoria',
  'custodia',
  'una',
  'outro',
]

function formatarEquivalencia(minutos: number) {
  if (minutos < 60) return `${minutos}min`

  const horas = Math.floor(minutos / 60)
  const restante = minutos % 60

  return restante > 0 ? `${horas}h ${restante}min` : `${horas}h`
}

export default function DuracaoPorTipoConfig() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { duracoes, loading, salvando, salvarDuracoes } = useDuracaoPorTipo()
  const [draft, setDraft] = useState<Record<string, number>>({})

  useEffect(() => {
    setDraft(duracoes)
  }, [duracoes])

  const isDiretor = usuario?.perfil === 'diretor'
  const houveAlteracoes = useMemo(
    () =>
      TIPOS.some((tipo) => Number(draft[tipo] ?? 0) !== Number(duracoes[tipo] ?? 0)),
    [draft, duracoes],
  )

  const atualizarValor = (tipo: TipoAudienciaPendente, valor: string) => {
    const numero = Number(valor)
    setDraft((atual) => ({
      ...atual,
      [tipo]: Number.isFinite(numero) ? Math.min(480, Math.max(5, numero)) : 5,
    }))
  }

  const salvarAlteracoes = async () => {
    toast.info('Salvando duracoes padrao por tipo...')

    try {
      await salvarDuracoes(draft)
      toast.success('Duracoes padrao salvas com sucesso.')
    } catch {
      toast.error('Nao foi possivel salvar as duracoes padrao. Tente novamente.')
    }
  }

  return (
    <Card padding="md">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-aurora-text-primary">
              Duracao padrao por tipo de audiencia
            </p>
            <p className="mt-1 text-xs text-aurora-text-muted">
              Usada como sugestao ao agendar. Editavel por audiencia.
            </p>
          </div>
          {isDiretor && (
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={14} />}
              loading={salvando}
              disabled={loading || !houveAlteracoes}
              onClick={() => void salvarAlteracoes()}
            >
              Salvar alteracoes
            </Button>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-aurora-border bg-aurora-elevated/60 px-4 py-5 text-sm text-aurora-text-muted">
            Carregando duracoes configuradas...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {TIPOS.map((tipo) => {
              const minutos = Number(draft[tipo] ?? duracoes[tipo] ?? 60)

              return (
                <div
                  key={tipo}
                  className="grid items-center gap-3 rounded-2xl border border-aurora-border bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_auto]"
                >
                  <div>
                    <div className="text-sm text-aurora-text-primary">
                      {TIPO_AUDIENCIA_PENDENTE_LABELS[tipo]}
                    </div>
                    <div className="mt-1 text-xs text-aurora-text-muted">
                      Tipo: {tipo}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    value={String(minutos)}
                    disabled={!isDiretor}
                    onChange={(event) => atualizarValor(tipo, event.target.value)}
                  />
                  <div className="text-sm text-aurora-text-secondary">
                    {formatarEquivalencia(minutos)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
