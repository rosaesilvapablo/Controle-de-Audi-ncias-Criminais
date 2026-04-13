import { useMemo, useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import { CardIntimacao } from './CardIntimacao'
import { useToast } from '../../contexts/ToastContext'
import { useIntimacoes } from '../../hooks/useIntimacoes'
import { useParticipantes } from '../../hooks/useParticipantes'
import { StatusIntimacao } from '../../types/core'
import { Button, Card } from '../ui'

export function PainelIntimacoesProcesso({ processoId }: { processoId: string }) {
  const toast = useToast()
  const { participantes } = useParticipantes(processoId)
  const {
    intimacoes,
    carregando,
    erro,
    criarDeParticipante,
    registrarCumprimento,
    atualizarCartaPrecatoria,
    registrarAtoOrdinatorio,
    totalPendentes,
  } = useIntimacoes(processoId)
  const [gerando, setGerando] = useState(false)
  const [expandirConcluidas, setExpandirConcluidas] = useState(false)

  const pendentes = useMemo(() => intimacoes.filter((item) => item.status === StatusIntimacao.PENDENTE), [intimacoes])
  const concluidas = useMemo(() => intimacoes.filter((item) => item.status === StatusIntimacao.POSITIVA), [intimacoes])
  const negativas = useMemo(() => intimacoes.filter((item) =>
    item.status === StatusIntimacao.NEGATIVA_DEVOLVIDA || item.status === StatusIntimacao.NEGATIVA_NAO_LOCALIZADO,
  ), [intimacoes])

  async function gerarIntimacoes() {
    setGerando(true)
    try {
      const idsExistentes = new Set(intimacoes.map((item) => item.participanteId))
      const candidatos = participantes.filter((item) => !idsExistentes.has(item.id))

      let criadas = 0
      for (const participante of candidatos) {
        const id = await criarDeParticipante(participante)
        if (id) criadas += 1
      }

      if (criadas > 0) {
        toast.success(`${criadas} intimacao(oes) gerada(s).`)
      } else {
        toast.info('Todas as intimacoes ja foram geradas.')
      }
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel gerar as intimacoes automaticamente.')
    } finally {
      setGerando(false)
    }
  }

  if (carregando) {
    return (
      <Card className="space-y-3">
        <div className="h-5 w-48 animate-pulse rounded bg-aurora-border" />
        <div className="h-20 w-full animate-pulse rounded bg-aurora-border" />
      </Card>
    )
  }

  if (erro) {
    return (
      <Card className="space-y-3">
        <div className="text-sm text-red-300">{erro}</div>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-aurora-text-primary">Controle de intimacoes</div>
          <div className={`text-xs ${totalPendentes > 0 ? 'text-amber-300' : 'text-green-300'}`}>
            {totalPendentes} pendente(s)
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          loading={gerando}
          onClick={() => { void gerarIntimacoes() }}
        >
          Gerar intimacoes dos participantes
        </Button>
      </div>

      {intimacoes.length === 0 ? (
        <Card className="border-dashed bg-aurora-elevated">
          <div className="space-y-2 text-sm">
            <p className="font-medium text-aurora-text-primary">Nenhuma intimacao registrada.</p>
            <p className="text-aurora-text-muted">
              Clique em "Gerar intimacoes dos participantes" para criar automaticamente a partir dos participantes cadastrados.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              loading={gerando}
              onClick={() => { void gerarIntimacoes() }}
            >
              Gerar intimacoes dos participantes
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendentes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-aurora-text-muted">Pendentes ({pendentes.length})</div>
              {pendentes.map((item) => (
                <CardIntimacao
                  key={item.id}
                  intimacao={item}
                  onRegistrarCumprimento={async (status, data) => registrarCumprimento(item.id, status, data)}
                  onAtualizarCarta={async (dados) => atualizarCartaPrecatoria(item.id, dados)}
                  onRegistrarAtoOrdinatorio={async (intimado) => registrarAtoOrdinatorio(item.id, intimado)}
                />
              ))}
            </div>
          )}

          {concluidas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-aurora-text-muted">
                  Concluidas ({concluidas.length})
                </div>
                {concluidas.length > 3 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setExpandirConcluidas((atual) => !atual)}
                  >
                    {expandirConcluidas ? 'Ocultar' : 'Mostrar'}
                  </Button>
                )}
              </div>
              {(expandirConcluidas ? concluidas : concluidas.slice(0, 3)).map((item) => (
                <CardIntimacao
                  key={item.id}
                  intimacao={item}
                  onRegistrarCumprimento={async (status, data) => registrarCumprimento(item.id, status, data)}
                  onAtualizarCarta={async (dados) => atualizarCartaPrecatoria(item.id, dados)}
                  onRegistrarAtoOrdinatorio={async (intimado) => registrarAtoOrdinatorio(item.id, intimado)}
                />
              ))}
            </div>
          )}

          {negativas.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-aurora-text-muted">
                Diligencias negativas ({negativas.length})
              </div>
              {negativas.map((item) => (
                <CardIntimacao
                  key={item.id}
                  intimacao={item}
                  onRegistrarCumprimento={async (status, data) => registrarCumprimento(item.id, status, data)}
                  onAtualizarCarta={async (dados) => atualizarCartaPrecatoria(item.id, dados)}
                  onRegistrarAtoOrdinatorio={async (intimado) => registrarAtoOrdinatorio(item.id, intimado)}
                />
              ))}
            </div>
          )}

          {totalPendentes === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-300">
              <CheckCircle2 size={16} />
              Nenhuma intimacao pendente.
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

