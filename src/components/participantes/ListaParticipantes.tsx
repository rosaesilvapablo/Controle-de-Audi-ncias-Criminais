import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { Button, Card } from '../ui'
import { useParticipantes } from '../../hooks/useParticipantes'
import { TipoParticipante, type Participante } from '../../types/core'
import { metadadosTipo, pessoOrdemTipo } from '../../utils/participantes'
import { CardParticipante } from './CardParticipante'
import { FormularioParticipante } from './FormularioParticipante'

interface Props {
  processoId: string
  modoEdicao?: boolean
}

type ModoLista = { tipo: 'visualizando' } | { tipo: 'adicionando' } | { tipo: 'editando'; id: string }

function ordenarPorGrupo(participantes: Participante[]) {
  return [...participantes].sort((a, b) => {
    const diffTipo = pessoOrdemTipo(a.tipo) - pessoOrdemTipo(b.tipo)
    if (diffTipo !== 0) return diffTipo
    return a.ordem - b.ordem
  })
}

export function ListaParticipantes({ processoId, modoEdicao = true }: Props) {
  const {
    participantes,
    carregando,
    erro,
    adicionarParticipante,
    atualizarParticipante,
    removerParticipante,
    reordenarParticipantes,
  } = useParticipantes(processoId)

  const [modo, setModo] = useState<ModoLista>({ tipo: 'visualizando' })
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvandoNovo, setSalvandoNovo] = useState(false)

  const ordenados = useMemo(() => ordenarPorGrupo(participantes), [participantes])

  const grupos = useMemo(() => {
    const mapa = new Map<TipoParticipante, Participante[]>()
    for (const item of ordenados) {
      if (!mapa.has(item.tipo)) mapa.set(item.tipo, [])
      mapa.get(item.tipo)?.push(item)
    }
    return [...mapa.entries()].sort((a, b) => pessoOrdemTipo(a[0]) - pessoOrdemTipo(b[0]))
  }, [ordenados])

  if (carregando) {
    return (
      <Card className="space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-aurora-border" />
        <div className="h-16 w-full animate-pulse rounded bg-aurora-border" />
      </Card>
    )
  }

  if (erro) {
    return (
      <Card className="text-sm text-red-300">
        Nao foi possivel carregar os participantes.
      </Card>
    )
  }

  const alterarOrdemGrupo = async (tipo: TipoParticipante, indexAtual: number, direcao: -1 | 1) => {
    const grupo = grupos.find((item) => item[0] === tipo)?.[1] ?? []
    const proximoIndex = indexAtual + direcao
    if (proximoIndex < 0 || proximoIndex >= grupo.length) return

    const idsGrupo = grupo.map((item) => item.id)
    const temp = idsGrupo[indexAtual]
    idsGrupo[indexAtual] = idsGrupo[proximoIndex]
    idsGrupo[proximoIndex] = temp

    const idsFinais = ordenados.map((item) => item.id)
    let cursorGrupo = 0
    for (let i = 0; i < idsFinais.length; i += 1) {
      const item = ordenados[i]
      if (item.tipo === tipo) {
        idsFinais[i] = idsGrupo[cursorGrupo]
        cursorGrupo += 1
      }
    }

    await reordenarParticipantes(idsFinais)
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-aurora-text-primary">
            Participantes ({participantes.length})
          </div>
          {modoEdicao && (
            <div className="mt-1 text-xs text-aurora-text-muted">Arraste para reordenar</div>
          )}
        </div>
        {modoEdicao && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setModo({ tipo: 'adicionando' })}
          >
            Adicionar participante
          </Button>
        )}
      </div>

      {participantes.length === 0 && modo.tipo !== 'adicionando' && (
        <Card className="border-dashed bg-aurora-elevated">
          {modoEdicao ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-aurora-text-primary">Nenhum participante cadastrado ainda.</p>
              <p className="text-sm text-aurora-text-muted">
                Adicione reus, testemunhas e demais participantes para controlar intimacoes e participacao.
              </p>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setModo({ tipo: 'adicionando' })}
              >
                Adicionar primeiro participante
              </Button>
            </div>
          ) : (
            <p className="text-sm text-aurora-text-muted">Nenhum participante cadastrado.</p>
          )}
        </Card>
      )}

      {grupos.map(([tipo, itens]) => (
        <div key={tipo} className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-aurora-text-muted">
            {metadadosTipo(tipo).rotulo} ({itens.length})
          </div>
          <div className="space-y-2">
            {itens.map((participante, index) => (
              <div key={participante.id}>
                {modo.tipo === 'editando' && modo.id === participante.id ? (
                  <FormularioParticipante
                    processoId={processoId}
                    participante={participante}
                    carregando={salvandoId === participante.id}
                    onCancelar={() => setModo({ tipo: 'visualizando' })}
                    onSalvar={async (dados) => {
                      setSalvandoId(participante.id)
                      try {
                        await atualizarParticipante(participante.id, dados)
                        setModo({ tipo: 'visualizando' })
                      } finally {
                        setSalvandoId(null)
                      }
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <CardParticipante
                      participante={participante}
                      arrastavel={modoEdicao}
                      onEditar={() => {
                        if (!modoEdicao) return
                        setModo({ tipo: 'editando', id: participante.id })
                      }}
                      onRemover={() => {
                        if (!modoEdicao) return
                        void removerParticipante(participante.id)
                      }}
                    />
                    {modoEdicao && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<ArrowUp size={12} />}
                          disabled={index === 0}
                          onClick={() => { void alterarOrdemGrupo(tipo, index, -1) }}
                        >
                          Subir
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={<ArrowDown size={12} />}
                          disabled={index === itens.length - 1}
                          onClick={() => { void alterarOrdemGrupo(tipo, index, 1) }}
                        >
                          Descer
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {modo.tipo === 'adicionando' && (
        <FormularioParticipante
          processoId={processoId}
          carregando={salvandoNovo}
          onCancelar={() => setModo({ tipo: 'visualizando' })}
          onSalvar={async (dados) => {
            setSalvandoNovo(true)
            try {
              await adicionarParticipante(dados)
              setModo({ tipo: 'visualizando' })
            } finally {
              setSalvandoNovo(false)
            }
          }}
        />
      )}
    </Card>
  )
}

