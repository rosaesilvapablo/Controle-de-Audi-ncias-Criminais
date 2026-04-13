import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronDown, ChevronUp, Download, ShieldCheck } from 'lucide-react'
import type { DocumentSnapshot, Timestamp } from 'firebase/firestore'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageLoader,
  Select,
} from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import {
  useAuditLog,
  useUsuarios,
  type FiltrosAudit,
} from '../../hooks'
import type { AuditLog } from '../../types'

const TIPOS_EVENTO = [
  'login',
  'logout',
  'agendamento',
  'remarcacao',
  'cancelamento',
  'exclusao',
  'checklist_concluido',
  'checklist_desmarcado',
  'acesso_sigiloso',
  'config_alterada',
  'checklist_nova_versao',
  'edicao',
]

function formatarTimestamp(valor: unknown) {
  const timestamp = valor as Timestamp | undefined
  if (!timestamp?.toDate) return 'Sem data'

  return format(timestamp.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

function stringifyValor(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (Array.isArray(valor)) return JSON.stringify(valor)

  if (
    typeof valor === 'object' &&
    valor &&
    'toDate' in (valor as Record<string, unknown>)
  ) {
    return formatarTimestamp(valor)
  }

  return JSON.stringify(valor)
}

function descricaoResumida(log: AuditLog) {
  switch (log.tipo) {
    case 'login':
      return 'Login realizado'
    case 'logout':
      return 'Logout'
    case 'agendamento':
      return `Agendou audiencia ${log.numeroProcesso ?? ''}`.trim()
    case 'remarcacao':
      return `Remarcou audiencia ${log.numeroProcesso ?? ''}`.trim()
    case 'cancelamento':
      return `Cancelou audiencia ${log.numeroProcesso ?? ''}`.trim()
    case 'exclusao':
      return `Excluiu ${log.colecao ?? ''}/${log.numeroProcesso ?? log.documentId ?? ''}`.replace(/\/$/, '')
    case 'checklist_concluido':
      return `Concluiu item: ${log.tituloItem ?? ''}`.trim()
    case 'checklist_desmarcado':
      return `Desmarcou item: ${log.tituloItem ?? ''}`.trim()
    case 'acesso_sigiloso':
      return 'Acessou processo sigiloso'
    case 'config_alterada':
      return `Alterou config: ${log.configuracao ?? ''}`.trim()
    case 'checklist_nova_versao':
      return `Nova versao de template: v${log.versao ?? ''}`.trim()
    case 'edicao':
      return `Editou ${log.colecao ?? ''}/${log.campo ?? ''}`.replace(/\/$/, '')
    default:
      return String(log.tipo ?? 'evento')
  }
}

function gerarCsv(logs: AuditLog[]) {
  const cabecalho = [
    'timestamp',
    'tipo',
    'usuarioNome',
    'usuarioUid',
    'colecao',
    'documentId',
    'campo',
    'valorAnterior',
    'valorNovo',
    'detalhes',
  ]
  const fixos = new Set([
    'id',
    'timestamp',
    'tipo',
    'usuarioNome',
    'usuarioUid',
    'colecao',
    'documentId',
    'campo',
    'valorAnterior',
    'valorNovo',
  ])

  const escape = (valor: string) => `"${valor.replace(/"/g, '""')}"`
  const linhas = logs.map((log) => {
    const detalhes = Object.fromEntries(
      Object.entries(log).filter(([chave]) => !fixos.has(chave)),
    )

    return [
      formatarTimestamp(log.timestamp),
      String(log.tipo ?? ''),
      String(log.usuarioNome ?? ''),
      String(log.usuarioUid ?? ''),
      String(log.colecao ?? ''),
      String(log.documentId ?? ''),
      String(log.campo ?? ''),
      stringifyValor(log.valorAnterior),
      stringifyValor(log.valorNovo),
      JSON.stringify(detalhes),
    ].map(escape).join(',')
  })

  return [cabecalho.join(','), ...linhas].join('\n')
}

export default function AuditoriaPage() {
  const { usuario } = useAuth()
  const toast = useToast()
  const { usuarios, loading: loadingUsuarios } = useUsuarios()
  const { buscarLogs, buscarTodosParaExport } = useAuditLog()

  const [filtrosForm, setFiltrosForm] = useState({
    tipo: '',
    usuarioUid: '',
    dataInicio: '',
    dataFim: '',
    numeroProcesso: '',
  })
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosAudit>({})
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [cursors, setCursors] = useState<Array<DocumentSnapshot | null>>([null])
  const [proximoCursor, setProximoCursor] = useState<DocumentSnapshot | null>(null)
  const [totalFiltrado, setTotalFiltrado] = useState(0)
  const [abertas, setAbertas] = useState<Record<string, boolean>>({})

  const usuariosOptions = useMemo(
    () => usuarios.map((item) => ({ uid: item.uid, nome: item.nome })),
    [usuarios],
  )

  const carregarPagina = useCallback(async (
    filtros: FiltrosAudit,
    cursor?: DocumentSnapshot | null,
    recalcularTotal = false,
  ) => {
    setLoading(true)

    try {
      const [{ logs: lista, proximoCursor: proximo }, todos] = await Promise.all([
        buscarLogs(filtros, cursor ?? undefined),
        recalcularTotal ? buscarTodosParaExport(filtros) : Promise.resolve(null),
      ])

      setLogs(lista)
      setProximoCursor(proximo)
      setAbertas({})

      if (todos) {
        setTotalFiltrado(todos.length)
      }
    } finally {
      setLoading(false)
    }
  }, [buscarLogs, buscarTodosParaExport])

  useEffect(() => {
    void carregarPagina({}, null, true)
  }, [carregarPagina])

  const aplicarFiltros = async () => {
    const proximosFiltros: FiltrosAudit = {
      tipo: filtrosForm.tipo || undefined,
      usuarioUid: filtrosForm.usuarioUid || undefined,
      dataInicio: filtrosForm.dataInicio ? new Date(`${filtrosForm.dataInicio}T00:00:00`) : undefined,
      dataFim: filtrosForm.dataFim ? new Date(`${filtrosForm.dataFim}T23:59:59`) : undefined,
      numeroProcesso: filtrosForm.numeroProcesso || undefined,
    }

    setFiltrosAplicados(proximosFiltros)
    setPagina(1)
    setCursors([null])
    await carregarPagina(proximosFiltros, null, true)
  }

  const limparFiltros = async () => {
    setFiltrosForm({
      tipo: '',
      usuarioUid: '',
      dataInicio: '',
      dataFim: '',
      numeroProcesso: '',
    })
    setFiltrosAplicados({})
    setPagina(1)
    setCursors([null])
    await carregarPagina({}, null, true)
  }

  const irParaProxima = async () => {
    if (!proximoCursor) return

    const proximosCursors = [...cursors, proximoCursor]
    setCursors(proximosCursors)
    setPagina((atual) => atual + 1)
    await carregarPagina(filtrosAplicados, proximoCursor)
  }

  const irParaAnterior = async () => {
    if (pagina === 1) return

    const cursorAnterior = cursors[pagina - 2] ?? null
    setCursors((atual) => atual.slice(0, -1))
    setPagina((atual) => atual - 1)
    await carregarPagina(filtrosAplicados, cursorAnterior)
  }

  const exportarCsv = async () => {
    setExportando(true)

    try {
      const todos = await buscarTodosParaExport(filtrosAplicados)

      if (!todos.length) {
        toast.warning('Nenhum registro encontrado para exportacao.')
        return
      }

      const blob = new Blob([gerarCsv(todos)], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `auditoria-${format(new Date(), 'yyyyMMdd-HHmmss')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('CSV exportado com sucesso.')
    } catch (error) {
      console.error(error)
      toast.error('Nao foi possivel exportar o CSV.')
    } finally {
      setExportando(false)
    }
  }

  if (usuario?.perfil !== 'diretor') return null
  if (loadingUsuarios && loading) return <PageLoader />

  const inicio = logs.length ? (pagina - 1) * 20 + 1 : 0
  const fim = logs.length ? inicio + logs.length - 1 : 0

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-aurora-primary" />
              <h1 className="text-xl font-semibold text-aurora-text-primary">
                Log de Auditoria
              </h1>
            </div>
            <p className="mt-1 text-sm text-aurora-text-muted">
              Registro imutavel de todas as acoes relevantes do sistema.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            loading={exportando}
            onClick={() => void exportarCsv()}
          >
            Exportar CSV
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            label="Tipo de evento"
            value={filtrosForm.tipo}
            onChange={(event) =>
              setFiltrosForm((atual) => ({ ...atual, tipo: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {TIPOS_EVENTO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </Select>

          <Select
            label="Usuario"
            value={filtrosForm.usuarioUid}
            onChange={(event) =>
              setFiltrosForm((atual) => ({ ...atual, usuarioUid: event.target.value }))
            }
          >
            <option value="">Todos</option>
            {usuariosOptions.map((item) => (
              <option key={item.uid} value={item.uid}>
                {item.nome}
              </option>
            ))}
          </Select>

          <Input
            label="Data inicial"
            type="date"
            value={filtrosForm.dataInicio}
            onChange={(event) =>
              setFiltrosForm((atual) => ({ ...atual, dataInicio: event.target.value }))
            }
          />

          <Input
            label="Data final"
            type="date"
            value={filtrosForm.dataFim}
            onChange={(event) =>
              setFiltrosForm((atual) => ({ ...atual, dataFim: event.target.value }))
            }
          />

          <Input
            label="Numero do processo"
            value={filtrosForm.numeroProcesso}
            onChange={(event) =>
              setFiltrosForm((atual) => ({ ...atual, numeroProcesso: event.target.value }))
            }
            placeholder="Busca livre"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={() => void aplicarFiltros()}>
            Filtrar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void limparFiltros()}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[160px_140px_200px_1fr_64px] gap-3 border-b border-aurora-border bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-aurora-text-muted">
          <span>Data/hora</span>
          <span>Tipo</span>
          <span>Usuario</span>
          <span>Descricao resumida</span>
          <span className="text-right">Detalhes</span>
        </div>

        {loading ? (
          <div className="p-6">
            <PageLoader />
          </div>
        ) : !logs.length ? (
          <div className="p-6">
            <EmptyState
              title="Nenhum registro encontrado"
              description="Ajuste os filtros para ampliar a consulta."
              icon={<ShieldCheck size={20} />}
            />
          </div>
        ) : (
          <div>
            {logs.map((log) => {
              const aberta = abertas[log.id] ?? false

              return (
                <div key={log.id} className="border-b border-aurora-border last:border-0">
                  <div className="grid grid-cols-[160px_140px_200px_1fr_64px] gap-3 px-4 py-3 text-sm text-aurora-text-secondary">
                    <span>{formatarTimestamp(log.timestamp)}</span>
                    <span>
                      <Badge variant="muted">{String(log.tipo ?? '')}</Badge>
                    </span>
                    <span className="truncate">{log.usuarioNome}</span>
                    <span className="truncate">{descricaoResumida(log)}</span>
                    <div className="flex justify-end">
                      <Button
                        size="xs"
                        variant="ghost"
                        icon={aberta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        onClick={() =>
                          setAbertas((atual) => ({ ...atual, [log.id]: !aberta }))
                        }
                      />
                    </div>
                  </div>

                  {aberta && (
                    <div className="bg-slate-50/70 px-4 py-3 text-xs text-aurora-text-secondary">
                      <div className="grid gap-2 md:grid-cols-2">
                        {Object.entries(log).map(([chave, valor]) => (
                          <div key={chave} className="break-words">
                            <span className="font-semibold text-aurora-text-primary">
                              {chave}:
                            </span>{' '}
                            <span>{stringifyValor(valor)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-aurora-text-muted">
            Mostrando {inicio}-{fim} de {totalFiltrado}
          </span>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void irParaAnterior()}
              disabled={pagina === 1 || loading}
            >
              Anterior
            </Button>
            <span className="text-sm text-aurora-text-secondary">
              Pagina {pagina}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void irParaProxima()}
              disabled={!proximoCursor || loading}
            >
              Proximo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
