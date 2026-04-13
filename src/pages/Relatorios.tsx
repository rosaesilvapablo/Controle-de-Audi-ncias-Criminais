import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { GraficoBarras } from '../components/relatorios/GraficoBarras'
import { ResumoCards } from '../components/relatorios/ResumoCards'
import { TabelaIntimacoes } from '../components/relatorios/TabelaIntimacoes'
import { TabelaProcessos } from '../components/relatorios/TabelaProcessos'
import { BadgePrioridade } from '../components/shared/BadgePrioridade'
import { Card, Input, Select } from '../components/ui'
import { useRelatorios } from '../hooks/useRelatorios'
import { ROTAS } from '../router/rotas'
import { calcularAlertasPrescricao } from '../utils/alertas'
import {
  FormaIntimacao,
  MetaCNJ,
  Prioridade,
  StatusIntimacao,
  TipoAlerta,
  TipoAudiencia,
  TipoParticipante,
} from '../types/core'

type AbaRelatorios = 'visao-geral' | 'etiqueta' | 'prioridade' | 'meta' | 'intimacoes' | 'prescricao'

const ABAS: { id: AbaRelatorios; rotulo: string }[] = [
  { id: 'visao-geral', rotulo: 'Visao geral' },
  { id: 'etiqueta', rotulo: 'Por etiqueta' },
  { id: 'prioridade', rotulo: 'Por prioridade' },
  { id: 'meta', rotulo: 'Meta CNJ' },
  { id: 'intimacoes', rotulo: 'Intimacoes' },
  { id: 'prescricao', rotulo: 'Prescricao' },
]

const META_LABELS: Record<MetaCNJ, string> = {
  [MetaCNJ.META_1]: 'Meta CNJ 1',
  [MetaCNJ.META_2]: 'Meta CNJ 2',
  [MetaCNJ.META_4]: 'Meta CNJ 4',
  [MetaCNJ.META_5]: 'Meta CNJ 5',
  [MetaCNJ.META_6]: 'Meta CNJ 6',
  [MetaCNJ.META_30]: 'Meta CNJ 30',
  [MetaCNJ.SEM_META]: 'Sem meta',
}

const PRIORIDADES = [
  Prioridade.REU_PRESO,
  Prioridade.CRIANCA,
  Prioridade.IDOSO_70,
  Prioridade.VITIMA,
  Prioridade.JUIZO,
  Prioridade.IDOSO_60,
] as const

function toDataInput(data?: Date) {
  if (!data) return ''
  return data.toISOString().slice(0, 10)
}

function severidadeProcesso(
  processo: ReturnType<typeof useRelatorios>['processos'][number],
) {
  const alertas = calcularAlertasPrescricao(processo.id, processo.numeroProcesso, processo.prescricao)
  const prescricaoCritica = alertas.some((item) => item.tipo === TipoAlerta.PRESCRICAO_VENCIDA || item.tipo === TipoAlerta.PRESCRICAO_7_DIAS)
  const prescricaoModerada = alertas.some((item) => item.tipo === TipoAlerta.PRESCRICAO_30_DIAS || item.tipo === TipoAlerta.PRESCRICAO_90_DIAS)
  if (processo.totalCartasPrecatoriasEmAlerta > 0 || prescricaoCritica) return 3
  if (prescricaoModerada) return 2
  if (processo.totalIntimacoesPendentes > 0) return 1
  return 0
}

export default function RelatoriosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const abaInicial = searchParams.get('aba') as AbaRelatorios | null
  const [abaAtiva, setAbaAtiva] = useState<AbaRelatorios>(
    abaInicial && ABAS.some((item) => item.id === abaInicial) ? abaInicial : 'visao-geral',
  )

  const {
    processos,
    carregando,
    erro,
    relatorioEtiqueta,
    relatorioPrioridade,
    relatorioMetaCNJ,
    relatorioIntimacoes,
    relatorioPrescricao,
    etiquetasDisponiveis,
    resumo,
  } = useRelatorios()

  const [etiquetaSelecionada, setEtiquetaSelecionada] = useState('')
  const [prioridadesSelecionadas, setPrioridadesSelecionadas] = useState<Prioridade[]>([...PRIORIDADES])
  const [metaSelecionada, setMetaSelecionada] = useState<MetaCNJ>(MetaCNJ.META_1)
  const [horizontePrescricao, setHorizontePrescricao] = useState<'vencidos' | '7' | '30' | '90' | 'todos'>('30')
  const [filtroIntimacoes, setFiltroIntimacoes] = useState({
    tipo: undefined as FormaIntimacao | undefined,
    status: undefined as StatusIntimacao | undefined,
    tipoParticipante: undefined as TipoParticipante | undefined,
    apenasEmAlerta: false,
    dataInicio: undefined as Date | undefined,
    dataFim: undefined as Date | undefined,
  })

  const relEtiqueta = useMemo(
    () => (etiquetaSelecionada ? relatorioEtiqueta(etiquetaSelecionada) : null),
    [etiquetaSelecionada, relatorioEtiqueta],
  )
  const relPrioridade = useMemo(
    () => relatorioPrioridade(prioridadesSelecionadas),
    [prioridadesSelecionadas, relatorioPrioridade],
  )
  const relMeta = useMemo(
    () => relatorioMetaCNJ(metaSelecionada),
    [metaSelecionada, relatorioMetaCNJ],
  )
  const relIntimacoes = useMemo(
    () => relatorioIntimacoes(filtroIntimacoes),
    [filtroIntimacoes, relatorioIntimacoes],
  )
  const relPrescricao = useMemo(() => {
    if (horizontePrescricao === 'vencidos') return relatorioPrescricao(-1)
    if (horizontePrescricao === '7') return relatorioPrescricao(7)
    if (horizontePrescricao === '30') return relatorioPrescricao(30)
    if (horizontePrescricao === '90') return relatorioPrescricao(90)
    return relatorioPrescricao(9999)
  }, [horizontePrescricao, relatorioPrescricao])

  const distribuicaoTipoAudiencia = useMemo(() => {
    const base: Record<TipoAudiencia, number> = {
      [TipoAudiencia.AIJ]: 0,
      [TipoAudiencia.CUSTODIA]: 0,
      [TipoAudiencia.PRELIMINAR]: 0,
      [TipoAudiencia.ANPP]: 0,
      [TipoAudiencia.HOMOLOGACAO]: 0,
      [TipoAudiencia.INSTRUCAO]: 0,
      [TipoAudiencia.OUTRO]: 0,
    }
    processos.forEach((processo) => {
      base[processo.tipoAudiencia] += 1
    })
    return Object.entries(base).map(([rotulo, valor]) => ({ rotulo, valor }))
  }, [processos])

  const distribuicaoMeta = useMemo(
    () => Object.entries(resumo.porMetaCNJ).map(([rotulo, valor]) => ({ rotulo, valor })),
    [resumo.porMetaCNJ],
  )

  const processosComAlertas = useMemo(
    () =>
      [...processos]
        .filter((processo) => severidadeProcesso(processo) > 0)
        .sort((a, b) => severidadeProcesso(b) - severidadeProcesso(a))
        .slice(0, 5),
    [processos],
  )

  if (carregando) {
    return (
      <div className="mx-auto w-full max-w-[1100px] space-y-3">
        <Card>
          <div className="h-6 w-56 animate-pulse rounded bg-aurora-border" />
        </Card>
        <Card>
          <div className="h-40 animate-pulse rounded bg-aurora-border" />
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
    <div className="mx-auto grid w-full max-w-[1100px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Card className="h-fit p-2">
        <div className="space-y-1">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              type="button"
              className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                abaAtiva === aba.id
                  ? 'bg-aurora-primary/15 text-aurora-primary'
                  : 'text-aurora-text-secondary hover:bg-aurora-elevated'
              }`}
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        {abaAtiva === 'visao-geral' && (
          <>
            <ResumoCards resumo={resumo} />
            <GraficoBarras titulo="Distribuicao por tipo de audiencia" dados={distribuicaoTipoAudiencia} />
            <GraficoBarras titulo="Distribuicao por Meta CNJ" dados={distribuicaoMeta} />

            <Card className="space-y-3">
              <h3 className="text-sm font-semibold text-aurora-text-primary">Processos com alertas ativos</h3>
              {!processosComAlertas.length ? (
                <p className="text-sm text-aurora-text-muted">Nenhum alerta critico no momento.</p>
              ) : (
                <div className="space-y-2">
                  {processosComAlertas.map((processo) => (
                    <button
                      key={processo.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-aurora-border bg-aurora-elevated px-3 py-2 text-left hover:border-aurora-primary/40"
                      onClick={() => navigate(ROTAS.processo(processo.id))}
                    >
                      <span>
                        <span className="block font-mono text-sm text-aurora-text-primary">{processo.numeroProcesso}</span>
                        <span className="block text-xs text-aurora-text-muted">
                          {processo.totalIntimacoesPendentes} intimacao(oes) pendente(s) · {processo.totalCartasPrecatoriasEmAlerta} carta(s) em alerta
                        </span>
                      </span>
                      <ChevronRight size={14} className="text-aurora-text-muted" />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {abaAtiva === 'etiqueta' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <Select
                label="Etiqueta"
                value={etiquetaSelecionada}
                onChange={(event) => setEtiquetaSelecionada(event.target.value)}
              >
                <option value="">Selecione uma etiqueta...</option>
                {etiquetasDisponiveis.map((etiqueta) => (
                  <option key={etiqueta} value={etiqueta}>{etiqueta}</option>
                ))}
              </Select>
              {!etiquetasDisponiveis.length && (
                <p className="text-sm text-aurora-text-muted">
                  Nenhuma etiqueta cadastrada ainda. Adicione etiquetas aos processos para gerar este relatorio.
                </p>
              )}
            </Card>

            {relEtiqueta && (
              <>
                <Card className="space-y-3">
                  <p className="text-sm text-aurora-text-primary">
                    <strong>{relEtiqueta.total}</strong> processos com etiqueta "{relEtiqueta.etiqueta}"
                  </p>
                  <GraficoBarras
                    titulo="Distribuicao por status"
                    dados={Object.entries(relEtiqueta.porStatus).map(([rotulo, valor]) => ({ rotulo, valor }))}
                  />
                  <GraficoBarras
                    titulo="Distribuicao por tipo de audiencia"
                    dados={Object.entries(relEtiqueta.porTipoAudiencia).map(([rotulo, valor]) => ({ rotulo, valor }))}
                  />
                </Card>

                <TabelaProcessos
                  processos={relEtiqueta.processos}
                  colunas={['numeroProcesso', 'tipoAudiencia', 'cargoMagistrado', 'prioridades', 'statusFase1', 'statusFase2', 'statusFase3']}
                  exportavel
                  nomeExportacao={`relatorio-etiqueta-${relEtiqueta.etiqueta}`}
                />
              </>
            )}
          </div>
        )}

        {abaAtiva === 'prioridade' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PRIORIDADES.map((prioridade) => {
                  const marcada = prioridadesSelecionadas.includes(prioridade)
                  return (
                    <label
                      key={prioridade}
                      className={`cursor-pointer rounded-xl border px-2 py-2 ${
                        marcada ? 'border-aurora-primary/50 bg-aurora-primary/10' : 'border-aurora-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={marcada}
                        onChange={(event) => {
                          setPrioridadesSelecionadas((atual) =>
                            event.target.checked
                              ? [...atual, prioridade]
                              : atual.filter((item) => item !== prioridade),
                          )
                        }}
                      />
                      <BadgePrioridade prioridade={prioridade} tamanho="sm" />
                    </label>
                  )
                })}
              </div>
            </Card>

            <GraficoBarras
              titulo="Distribuicao por prioridade"
              dados={Object.entries(relPrioridade.porPrioridade).map(([rotulo, valor]) => ({ rotulo, valor }))}
            />

            <Card>
              <p className="text-sm text-aurora-text-secondary">
                {relPrioridade.total} processos com as prioridades selecionadas.
              </p>
            </Card>

            <TabelaProcessos
              processos={relPrioridade.processos}
              colunas={['numeroProcesso', 'tipoAudiencia', 'cargoMagistrado', 'prioridades', 'naturezaCrime', 'statusFase3', 'prescricao']}
              exportavel
              nomeExportacao="relatorio-prioridades"
            />
          </div>
        )}

        {abaAtiva === 'meta' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(META_LABELS) as MetaCNJ[]).map((meta) => (
                  <label key={meta} className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2 text-sm text-aurora-text-secondary">
                    <input type="radio" checked={metaSelecionada === meta} onChange={() => setMetaSelecionada(meta)} />
                    {META_LABELS[meta]}
                  </label>
                ))}
              </div>
            </Card>

            <Card className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Total</div>
                <div className="text-2xl font-semibold text-aurora-text-primary">{relMeta.total}</div>
              </div>
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Encerrados</div>
                <div className="text-2xl font-semibold text-aurora-green">{relMeta.encerrados}</div>
              </div>
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Em andamento</div>
                <div className="text-2xl font-semibold text-aurora-amber">{relMeta.emAndamento}</div>
              </div>
            </Card>

            <GraficoBarras
              titulo="Distribuicao por tipo de audiencia"
              dados={Object.entries(relMeta.porTipoAudiencia).map(([rotulo, valor]) => ({ rotulo, valor }))}
            />

            <TabelaProcessos
              processos={relMeta.processos}
              colunas={['numeroProcesso', 'tipoAudiencia', 'cargoMagistrado', 'naturezaCrime', 'statusFase1', 'statusFase2', 'statusFase3']}
              exportavel
              nomeExportacao={`relatorio-meta-cnj-${metaSelecionada}`}
            />
          </div>
        )}

        {abaAtiva === 'intimacoes' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  label="Tipo"
                  value={filtroIntimacoes.tipo ?? ''}
                  onChange={(event) =>
                    setFiltroIntimacoes((atual) => ({
                      ...atual,
                      tipo: (event.target.value || undefined) as FormaIntimacao | undefined,
                    }))}
                >
                  <option value="">Todos</option>
                  <option value={FormaIntimacao.MANDADO_CEMAN_LOCAL}>Mandado local</option>
                  <option value={FormaIntimacao.MANDADO_CEMAN_DIVERSA}>Mandado diversa</option>
                  <option value={FormaIntimacao.CARTA_PRECATORIA}>Carta precatoria</option>
                </Select>

                <Select
                  label="Status"
                  value={filtroIntimacoes.status ?? ''}
                  onChange={(event) =>
                    setFiltroIntimacoes((atual) => ({
                      ...atual,
                      status: (event.target.value || undefined) as StatusIntimacao | undefined,
                    }))}
                >
                  <option value="">Todos</option>
                  <option value={StatusIntimacao.PENDENTE}>Pendente</option>
                  <option value={StatusIntimacao.POSITIVA}>Cumprida</option>
                  <option value={StatusIntimacao.NEGATIVA_NAO_LOCALIZADO}>Negativa nao localizado</option>
                  <option value={StatusIntimacao.NEGATIVA_DEVOLVIDA}>Negativa devolvida</option>
                </Select>

                <Select
                  label="Participante"
                  value={filtroIntimacoes.tipoParticipante ?? ''}
                  onChange={(event) =>
                    setFiltroIntimacoes((atual) => ({
                      ...atual,
                      tipoParticipante: (event.target.value || undefined) as TipoParticipante | undefined,
                    }))}
                >
                  <option value="">Todos</option>
                  <option value={TipoParticipante.REU}>Reu</option>
                  <option value={TipoParticipante.VITIMA}>Vitima</option>
                  <option value={TipoParticipante.TESTEMUNHA}>Testemunha</option>
                  <option value={TipoParticipante.PERITO}>Perito</option>
                  <option value={TipoParticipante.TRADUTOR}>Tradutor</option>
                  <option value={TipoParticipante.INFORMANTE}>Informante</option>
                  <option value={TipoParticipante.ASSISTENTE_ACUSACAO}>Assistente de acusacao</option>
                  <option value={TipoParticipante.OUTRO}>Outro</option>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="mt-6 inline-flex items-center gap-2 text-sm text-aurora-text-secondary">
                  <input
                    type="checkbox"
                    checked={filtroIntimacoes.apenasEmAlerta}
                    onChange={(event) =>
                      setFiltroIntimacoes((atual) => ({ ...atual, apenasEmAlerta: event.target.checked }))}
                  />
                  Apenas em alerta
                </label>
                <Input
                  label="Data inicio"
                  type="date"
                  value={toDataInput(filtroIntimacoes.dataInicio)}
                  onChange={(event) =>
                    setFiltroIntimacoes((atual) => ({
                      ...atual,
                      dataInicio: event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined,
                    }))}
                />
                <Input
                  label="Data fim"
                  type="date"
                  value={toDataInput(filtroIntimacoes.dataFim)}
                  onChange={(event) =>
                    setFiltroIntimacoes((atual) => ({
                      ...atual,
                      dataFim: event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined,
                    }))}
                />
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-aurora-text-secondary">
                <span>{relIntimacoes.total} intimacao(oes) encontrada(s)</span>
                {relIntimacoes.cartasEmAlerta40 > 0 && (
                  <span className="text-aurora-red">{relIntimacoes.cartasEmAlerta40} carta(s) em alerta critico</span>
                )}
              </div>
            </Card>

            <TabelaIntimacoes intimacoes={relIntimacoes.intimacoes} exportavel nomeExportacao="relatorio-intimacoes" />
          </div>
        )}

        {abaAtiva === 'prescricao' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'vencidos', rotulo: 'Vencidos' },
                  { id: '7', rotulo: 'Vencem em 7 dias' },
                  { id: '30', rotulo: 'Vencem em 30 dias' },
                  { id: '90', rotulo: 'Vencem em 90 dias' },
                  { id: 'todos', rotulo: 'Todos com data cadastrada' },
                ].map((opcao) => (
                  <label key={opcao.id} className="inline-flex items-center gap-2 rounded-full border border-aurora-border px-3 py-2 text-sm text-aurora-text-secondary">
                    <input
                      type="radio"
                      checked={horizontePrescricao === opcao.id}
                      onChange={() => setHorizontePrescricao(opcao.id as typeof horizontePrescricao)}
                    />
                    {opcao.rotulo}
                  </label>
                ))}
              </div>
            </Card>

            <Card className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Vencidos</div>
                <div className="text-2xl font-semibold text-aurora-red">{relPrescricao.vencidos}</div>
              </div>
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Ate 7 dias</div>
                <div className="text-2xl font-semibold text-aurora-red">{relPrescricao.ate7dias}</div>
              </div>
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Ate 30 dias</div>
                <div className="text-2xl font-semibold text-aurora-amber">{relPrescricao.ate30dias}</div>
              </div>
              <div className="rounded-xl border border-aurora-border bg-aurora-elevated p-3">
                <div className="text-xs text-aurora-text-muted">Ate 90 dias</div>
                <div className="text-2xl font-semibold text-yellow-300">{relPrescricao.ate90dias}</div>
              </div>
            </Card>

            <TabelaProcessos
              processos={relPrescricao.processos}
              colunas={['numeroProcesso', 'tipoAudiencia', 'cargoMagistrado', 'naturezaCrime', 'prioridades', 'prescricao']}
              exportavel
              nomeExportacao="relatorio-prescricao"
            />

            <Card className="text-xs text-aurora-text-muted">
              As datas de prescricao sao registradas manualmente pelos servidores e refletem o conhecimento operacional do processo.
              Este relatorio nao substitui analise juridica de prescricao.
            </Card>
          </div>
        )}

        {abaAtiva === 'visao-geral' && (
          <Card className="text-right">
            <Link className="inline-flex items-center gap-1 text-sm text-aurora-primary hover:underline" to={ROTAS.INTIMACOES}>
              Ver intimacoes detalhadas <ChevronRight size={14} />
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}
