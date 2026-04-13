import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInDays } from 'date-fns'
import { getDocs, orderBy, query, setDoc } from 'firebase/firestore'
import { CardIntimacao } from '../components/intimacoes/CardIntimacao'
import { Button, Card, Input, Select } from '../components/ui'
import { useToast } from '../contexts/ToastContext'
import { useIntimacoesGlobal } from '../hooks/useIntimacoesGlobal'
import { ROTAS } from '../router/rotas'
import { refIntimacao, refIntimacoes, refProcesso } from '../services/collections'
import {
  FormaIntimacao,
  StatusIntimacao,
  TipoParticipante,
  type Intimacao,
} from '../types/core'

function calcularTotais(lista: Intimacao[]) {
  const hoje = new Date()
  const totalPendentes = lista.filter((item) =>
    item.status === StatusIntimacao.PENDENTE
    && item.tipo !== FormaIntimacao.NAO_REQUER_INTIMACAO,
  ).length
  const totalCartasPrecatoriasEmAlerta = lista.filter((item) =>
    item.tipo === FormaIntimacao.CARTA_PRECATORIA
    && item.dataRemessa
    && !item.dataDevolvida
    && differenceInDays(hoje, item.dataRemessa) >= 30,
  ).length

  return { totalPendentes, totalCartasPrecatoriasEmAlerta }
}

export default function Intimacoes() {
  const toast = useToast()
  const {
    cartasEmAlerta,
    todasPendentes,
    mandadosPendentes,
    cartasPendentes,
    carregando,
    erro,
    filtro,
    setFiltro,
  } = useIntimacoesGlobal()
  const [buscaLocal, setBuscaLocal] = useState(filtro.numeroProcesso ?? '')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFiltro({ numeroProcesso: buscaLocal })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [buscaLocal, setFiltro])

  const cartasSemAlerta = useMemo(() => {
    const idsEmAlerta = new Set(cartasEmAlerta.map((item) => item.id))
    return cartasPendentes.filter((item) => !idsEmAlerta.has(item.id))
      .sort((a, b) => (a.dataRemessa?.getTime() ?? 0) - (b.dataRemessa?.getTime() ?? 0))
  }, [cartasEmAlerta, cartasPendentes])

  async function recalcularContadoresProcesso(processoId: string) {
    const consulta = query(refIntimacoes(processoId), orderBy('criadoEm', 'asc'))
    const snapshot = await getDocs(consulta)
    const lista = snapshot.docs.map((item) => item.data() as Intimacao)
    const { totalPendentes, totalCartasPrecatoriasEmAlerta } = calcularTotais(lista)
    await setDoc(refProcesso(processoId), {
      totalIntimacoesPendentes: totalPendentes,
      totalCartasPrecatoriasEmAlerta,
      atualizadoEm: new Date(),
    }, { merge: true })
  }

  async function atualizarIntimacaoGlobal(
    item: Intimacao & { numeroProcesso: string },
    dados: Partial<Intimacao>,
  ) {
    await setDoc(refIntimacao(item.processoId, item.id), {
      ...dados,
      atualizadoEm: new Date(),
    }, { merge: true })
    await recalcularContadoresProcesso(item.processoId)
  }

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <Card className="space-y-4">
          <div className="h-6 w-56 animate-pulse rounded bg-aurora-border" />
          <div className="h-20 w-full animate-pulse rounded bg-aurora-border" />
        </Card>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <Card className="text-sm text-red-300">{erro}</Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
      <Card className="space-y-2">
        <h1 className="text-2xl font-semibold text-aurora-text-primary">Intimacoes pendentes</h1>
        <p className="text-sm text-aurora-text-muted">
          Painel global com foco em cartas precatorias e cumprimento de mandados.
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            label="Buscar por nº processo"
            placeholder="Digite o numero..."
            value={buscaLocal}
            onChange={(event) => setBuscaLocal(event.target.value)}
          />
          <Select
            label="Tipo"
            value={filtro.tipo ?? ''}
            onChange={(event) => setFiltro({ tipo: (event.target.value || undefined) as FormaIntimacao | undefined })}
          >
            <option value="">Todos</option>
            <option value={FormaIntimacao.MANDADO_CEMAN_LOCAL}>Mandado local</option>
            <option value={FormaIntimacao.MANDADO_CEMAN_DIVERSA}>Mandado diversa</option>
            <option value={FormaIntimacao.CARTA_PRECATORIA}>Carta precatoria</option>
          </Select>
          <Select
            label="Participante"
            value={filtro.tipoParticipante ?? ''}
            onChange={(event) => setFiltro({ tipoParticipante: (event.target.value || undefined) as TipoParticipante | undefined })}
          >
            <option value="">Todos</option>
            <option value={TipoParticipante.REU}>Reu</option>
            <option value={TipoParticipante.VITIMA}>Vitima</option>
            <option value={TipoParticipante.TESTEMUNHA}>Testemunha</option>
            <option value={TipoParticipante.PERITO}>Perito</option>
            <option value={TipoParticipante.OUTRO}>Outro</option>
          </Select>
          <label className="mt-6 inline-flex items-center gap-2 text-sm text-aurora-text-secondary">
            <input
              type="checkbox"
              checked={Boolean(filtro.apenasEmAlerta)}
              onChange={(event) => setFiltro({ apenasEmAlerta: event.target.checked })}
            />
            Apenas em alerta
          </label>
        </div>
        <div className="text-xs text-aurora-text-muted">
          {todasPendentes.length} intimacao(oes) encontrada(s)
        </div>
      </Card>

      {cartasEmAlerta.length > 0 && (
        <Card className="space-y-3 border-red-500/40 bg-red-900/20">
          <h2 className="text-lg font-semibold text-red-200">⚠ Cartas precatorias sem retorno</h2>
          <p className="text-sm text-red-100/90">
            Estas cartas estao com prazo vencido e requerem atencao imediata.
          </p>
          <div className="space-y-2">
            {cartasEmAlerta.map((item) => (
              <div key={item.id} className="space-y-1">
                <Link to={ROTAS.processo(item.processoId)} className="text-xs text-aurora-primary hover:underline">
                  Processo {item.numeroProcesso}
                </Link>
                <CardIntimacao
                  intimacao={item}
                  numeroProcesso={item.numeroProcesso}
                  modoCompacto
                  onRegistrarCumprimento={async (status, data) => {
                    await atualizarIntimacaoGlobal(item, {
                      status,
                      dataCumprimento: status === StatusIntimacao.POSITIVA ? data ?? new Date() : undefined,
                      dataDevolvida: status === StatusIntimacao.POSITIVA ? (data ?? new Date()) : item.dataDevolvida,
                    })
                    toast.success('Intimacao atualizada.')
                  }}
                  onAtualizarCarta={async (dados) => {
                    await atualizarIntimacaoGlobal(item, dados)
                    toast.success('Dados da carta atualizados.')
                  }}
                  onRegistrarAtoOrdinatorio={async (intimado) => {
                    await atualizarIntimacaoGlobal(item, { atoOrdinatorioIntimado: intimado })
                    toast.success('Ato ordinatorio registrado.')
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-aurora-text-primary">
          Mandados - cumprimento pendente ({mandadosPendentes.length})
        </h2>
        {mandadosPendentes.length === 0 ? (
          <div className="text-sm text-green-300">Nenhum mandado pendente ✓</div>
        ) : (
          <div className="space-y-2">
            {mandadosPendentes.map((item) => (
              <CardIntimacao
                key={item.id}
                intimacao={item}
                numeroProcesso={item.numeroProcesso}
                modoCompacto
                onRegistrarCumprimento={async (status, data) => {
                  await atualizarIntimacaoGlobal(item, {
                    status,
                    dataCumprimento: status === StatusIntimacao.POSITIVA ? data ?? new Date() : undefined,
                  })
                }}
                onAtualizarCarta={async (dados) => atualizarIntimacaoGlobal(item, dados)}
                onRegistrarAtoOrdinatorio={async (intimado) => atualizarIntimacaoGlobal(item, { atoOrdinatorioIntimado: intimado })}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-aurora-text-primary">
          Cartas precatorias ({cartasPendentes.length})
        </h2>
        {cartasEmAlerta.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Ver alertas criticos ↑
          </Button>
        )}
        <div className="space-y-2">
          {cartasSemAlerta.map((item) => (
            <div key={item.id} className="space-y-1">
              <CardIntimacao
                intimacao={item}
                numeroProcesso={item.numeroProcesso}
                modoCompacto
                onRegistrarCumprimento={async (status, data) => {
                  await atualizarIntimacaoGlobal(item, {
                    status,
                    dataCumprimento: status === StatusIntimacao.POSITIVA ? data ?? new Date() : undefined,
                  })
                }}
                onAtualizarCarta={async (dados) => atualizarIntimacaoGlobal(item, dados)}
                onRegistrarAtoOrdinatorio={async (intimado) => atualizarIntimacaoGlobal(item, { atoOrdinatorioIntimado: intimado })}
              />
              {item.dataRemessa && (
                <div className="text-xs text-aurora-text-muted">
                  Remessa ha {differenceInDays(new Date(), item.dataRemessa)} dias
                </div>
              )}
            </div>
          ))}
          {cartasSemAlerta.length === 0 && (
            <div className="text-sm text-aurora-text-muted">Nenhuma carta pendente fora da faixa de alerta.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

