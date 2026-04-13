import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  CalendarDays,
  ChevronDown,
  Circle,
  ClipboardList,
  DoorOpen,
  FileText,
  Landmark,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Command } from 'cmdk'
import { format, addDays, addHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { formatarDataHora } from '../../lib/audienciaHelpers'
import { ROTAS } from '../../router/rotas'
import {
  normalizarAudiencia,
  normalizarProcessoPendente,
} from '../../lib/normalizarDados'
import { db } from '../../lib/firebase'
import { Badge } from '../ui'
import { BuscaGlobal } from './BuscaGlobal'
import {
  canEdit,
  STATUS_AUDIENCIA_LABELS,
  TIPO_AUDIENCIA_PENDENTE_LABELS,
  type Audiencia,
  type ProcessoPendente,
  type UserRole,
} from '../../types'

type NavRole = UserRole | 'all'

const NAV_ITEMS = [
  { path: '/', label: 'Pauta', icon: Calendar, roles: ['all'] as NavRole[] },
  {
    path: ROTAS.AGENDA,
    label: 'Minha agenda',
    icon: CalendarDays,
    roles: ['diretor', 'magistrado', 'supervisor', 'servidor'] as NavRole[],
  },
  {
    path: ROTAS.FILA,
    label: 'Fila de designação',
    icon: ClipboardList,
    roles: ['diretor', 'magistrado', 'supervisor', 'servidor'] as NavRole[],
  },
  {
    path: ROTAS.INTIMACOES,
    label: 'Intimacoes',
    icon: Bell,
    roles: ['diretor', 'magistrado', 'supervisor', 'servidor'] as NavRole[],
  },
  {
    path: ROTAS.MODELOS,
    label: 'Modelos',
    icon: FileText,
    roles: ['diretor', 'magistrado', 'supervisor', 'servidor'] as NavRole[],
  },
  {
    path: '/carga-semanal',
    label: 'Carga semanal',
    icon: BarChart3,
    roles: ['all'] as NavRole[],
  },
  {
    path: '/procedimentos',
    label: 'Procedimentos',
    icon: ClipboardList,
    roles: ['all'] as NavRole[],
  },
  {
    path: '/estatisticas',
    label: 'Estatísticas',
    icon: BarChart3,
    roles: ['all'] as NavRole[],
  },
  { path: '/usuarios', label: 'Usuários', icon: Users, roles: ['diretor'] as NavRole[] },
  {
    path: ROTAS.RELATORIOS,
    label: 'Relatorios',
    icon: BarChart3,
    roles: ['diretor', 'magistrado', 'supervisor', 'servidor'] as NavRole[],
  },
  { path: '/salas', label: 'Salas', icon: DoorOpen, roles: ['all'] as NavRole[] },
  { path: '/feriados', label: 'Feriados', icon: Landmark, roles: ['all'] as NavRole[] },
  { path: '/auditoria', label: 'Auditoria', icon: ShieldCheck, roles: ['diretor'] as NavRole[] },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, roles: ['diretor'] as NavRole[] },
]

interface Alerta {
  id: string
  mensagem: string
  urgente: boolean
  procedimentoId: string
}

function useBuscaProcesso(termo: string) {
  const [resultados, setResultados] = useState<{
    audiencias: Audiencia[]
    pendentes: ProcessoPendente[]
  }>({ audiencias: [], pendentes: [] })
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (termo.trim().length < 5) {
      setResultados({ audiencias: [], pendentes: [] })
      return
    }

    const timeout = setTimeout(async () => {
      setBuscando(true)
      try {
        const termoPadrao = termo.trim().toUpperCase()
        const termoFim = termoPadrao + '\uf8ff'

        const [snapAud, snapPend] = await Promise.all([
          getDocs(query(
            collection(db, 'audiencias'),
            where('numeroProcesso', '>=', termoPadrao),
            where('numeroProcesso', '<=', termoFim),
            orderBy('numeroProcesso'),
            limit(5),
          )),
          getDocs(query(
            collection(db, 'processos_pendentes'),
            where('numeroProcesso', '>=', termoPadrao),
            where('numeroProcesso', '<=', termoFim),
            orderBy('numeroProcesso'),
            limit(5),
          )),
        ])

        setResultados({
          audiencias: snapAud.docs.map((d) =>
            normalizarAudiencia(d.id, d.data() as Record<string, unknown>),
          ),
          pendentes: snapPend.docs.map((d) =>
            normalizarProcessoPendente(d.id, d.data() as Record<string, unknown>),
          ),
        })
      } finally {
        setBuscando(false)
      }
    }, 350)

    return () => clearTimeout(timeout)
  }, [termo])

  return { resultados, buscando }
}

function useAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    const carregar = async () => {
      try {
        if (ativo) setCarregando(true)

        const agora = new Date()
        const proximos7Dias = addDays(agora, 7)
        const proximas48Horas = addHours(agora, 48)
        const encontrados: Alerta[] = []

        const reuPresoSnap = await getDocs(
          query(
            collection(db, 'audiencias'),
            where('reuPreso', '==', true),
            where('status', 'in', ['agendada', 'em_andamento']),
            where('dataHoraInicio', '>=', Timestamp.fromDate(agora)),
            where('dataHoraInicio', '<=', Timestamp.fromDate(proximos7Dias)),
          ),
        )

        for (const audienciaDoc of reuPresoSnap.docs) {
          const audiencia = normalizarAudiencia(
            audienciaDoc.id,
            audienciaDoc.data() as Record<string, unknown>,
          )
          const procedimentoSnap = await getDocs(
            query(collection(db, 'procedimentos'), where('audienciaId', '==', audiencia.id)),
          )
          if (procedimentoSnap.empty) continue

          const procedimentoDoc = procedimentoSnap.docs[0]
          const procedimento = procedimentoDoc.data()
          if ((procedimento.itensCriticosPendentes ?? 0) <= 0) continue

          encontrados.push({
            id: `urgente-${audiencia.id}`,
            urgente: true,
            procedimentoId: procedimentoDoc.id,
            mensagem: `Réu preso · Proc ${audiencia.numeroProcesso} em ${format(audiencia.dataHoraInicio.toDate(), "dd/MM 'às' HH'h'mm", { locale: ptBR })} — ${procedimento.itensCriticosPendentes} item(ns) obrigatório(s) pendente(s)`,
          })
        }

        const emBreveSnap = await getDocs(
          query(
            collection(db, 'audiencias'),
            where('status', '==', 'agendada'),
            where('dataHoraInicio', '>=', Timestamp.fromDate(agora)),
            where('dataHoraInicio', '<=', Timestamp.fromDate(proximas48Horas)),
          ),
        )

        for (const audienciaDoc of emBreveSnap.docs) {
          const audiencia = normalizarAudiencia(
            audienciaDoc.id,
            audienciaDoc.data() as Record<string, unknown>,
          )
          const procedimentoSnap = await getDocs(
            query(collection(db, 'procedimentos'), where('audienciaId', '==', audiencia.id)),
          )
          if (procedimentoSnap.empty) continue

          const procedimentoDoc = procedimentoSnap.docs[0]
          const procedimento = procedimentoDoc.data()
          if ((procedimento.itensCriticosPendentes ?? 0) <= 0) continue
          if (encontrados.some((alerta) => alerta.id === `urgente-${audiencia.id}`)) continue

          encontrados.push({
            id: `breve-${audiencia.id}`,
            urgente: false,
            procedimentoId: procedimentoDoc.id,
            mensagem: `Audiência em breve · Proc ${audiencia.numeroProcesso} em ${format(audiencia.dataHoraInicio.toDate(), "dd/MM 'às' HH'h'mm", { locale: ptBR })} — verificar checklist`,
          })
        }

        encontrados.sort((a, b) => Number(b.urgente) - Number(a.urgente))
        if (ativo) setAlertas(encontrados)
      } catch (error) {
        console.error(error)
        if (ativo) setAlertas([])
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    const intervalId = window.setInterval(() => void carregar(), 5 * 60 * 1000)

    return () => {
      ativo = false
      window.clearInterval(intervalId)
    }
  }, [])

  return { alertas, carregando }
}

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { usuario, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cmdOpen, setCmdOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [alertasOpen, setAlertasOpen] = useState(false)
  const [contaMenuOpen, setContaMenuOpen] = useState(false)
  const { alertas, carregando: carregandoAlertas } = useAlertas()
  const headerRef = useRef<HTMLElement | null>(null)
  const alertasRef = useRef<HTMLDivElement | null>(null)
  const contaMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const headerElement = headerRef.current
    if (!headerElement) return

    const atualizarAlturaHeader = () => {
      const altura = `${headerElement.offsetHeight}px`
      document.documentElement.style.setProperty('--topbar-height', altura)
    }

    atualizarAlturaHeader()

    const observer = new ResizeObserver(() => {
      atualizarAlturaHeader()
    })

    observer.observe(headerElement)
    window.addEventListener('resize', atualizarAlturaHeader)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', atualizarAlturaHeader)
    }
  }, [])

  useEffect(() => {
    const onClickFora = (event: MouseEvent) => {
      if (!alertasRef.current) return
      if (!alertasRef.current.contains(event.target as Node)) setAlertasOpen(false)
    }

    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  useEffect(() => {
    const onClickFora = (event: MouseEvent) => {
      if (!contaMenuRef.current) return
      if (!contaMenuRef.current.contains(event.target as Node)) setContaMenuOpen(false)
    }

    document.addEventListener('mousedown', onClickFora)
    return () => document.removeEventListener('mousedown', onClickFora)
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
    setAlertasOpen(false)
    setContaMenuOpen(false)
  }, [location.pathname])

  const navItems = NAV_ITEMS.filter(
    (n) => n.roles.includes('all') || (!!usuario?.perfil && n.roles.includes(usuario.perfil)),
  )
  const temAlertasUrgentes = alertas.some((alerta) => alerta.urgente)

  const initials = usuario?.nome
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??'

  const isActivePath = useCallback(
    (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path)),
    [location.pathname],
  )

  return (
    <div className="min-h-dvh flex flex-col bg-aurora-bg">
      <header
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-40 glass border-b border-aurora-chrome-border shadow-aurora-md"
        style={{ minHeight: 'var(--topbar-height, 112px)' }}
      >
        <div className="mx-auto max-w-screen-2xl px-4 py-3">
          <div className="flex items-center gap-3 lg:gap-5">
            <button
              onClick={() => navigate('/')}
              className="flex min-w-0 shrink-0 items-center gap-3"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 shadow-glow-purple">
                <Calendar size={20} className="text-white" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-aurora-chrome-muted">
                  SCAC
                </div>
                <div className="truncate text-base font-semibold text-aurora-chrome-text">
                  Sistema de Controle de Audiências
                </div>
                <div className="truncate text-xs text-aurora-chrome-muted">
                  4ª Vara Federal Criminal
                </div>
              </div>
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex flex-1 items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-left transition-all duration-150 hover:border-white/20 hover:bg-white/10"
            >
              <Search size={16} className="shrink-0 text-aurora-chrome-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-aurora-chrome-text">
                  Buscar processo, pauta ou funcionalidade
                </div>
                <div className="truncate text-2xs text-aurora-chrome-muted">
                  Digite o número do processo ou pressione o atalho do teclado
                </div>
              </div>
              <kbd className="hidden xl:flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-2xs font-mono text-aurora-chrome-text">
                <span>Ctrl</span>
                <span>K</span>
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-2 lg:gap-3">
              <button
                onClick={() => setCmdOpen(true)}
                className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-aurora-chrome-muted transition-colors hover:bg-white/10 hover:text-aurora-chrome-text"
                aria-label="Abrir busca"
              >
                <Search size={16} />
              </button>

              <div className="relative" ref={alertasRef}>
                <button
                  onClick={() => setAlertasOpen((open) => !open)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-aurora-chrome-muted transition-colors hover:bg-white/10 hover:text-aurora-chrome-text"
                >
                  <Bell size={16} />
                  {temAlertasUrgentes && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-400 ring-2 ring-[var(--aurora-chrome)]" />
                  )}
                </button>

                {alertasOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-aurora-border-light bg-aurora-surface shadow-aurora-lg">
                    <div className="border-b border-aurora-border px-4 py-3">
                      <div className="text-sm font-semibold text-aurora-text-primary">Alertas</div>
                      <div className="text-2xs text-aurora-text-muted">
                        {carregandoAlertas
                          ? 'Carregando alertas...'
                          : `${alertas.length} alerta(s) encontrado(s)`}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-2">
                      {!carregandoAlertas && alertas.length === 0 && (
                        <div className="px-3 py-4 text-sm text-aurora-text-muted">
                          Nenhuma pendência crítica no momento
                        </div>
                      )}

                      {alertas.map((alerta) => (
                        <button
                          key={alerta.id}
                          onClick={() => {
                            navigate(`/procedimentos/${alerta.procedimentoId}`)
                            setAlertasOpen(false)
                          }}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-aurora-elevated"
                        >
                          <span className="mt-0.5 shrink-0">
                            {alerta.urgente ? (
                              <AlertTriangle size={14} className="text-aurora-amber" />
                            ) : (
                              <Circle size={10} className="fill-current text-aurora-text-muted" />
                            )}
                          </span>
                          <span className="text-xs leading-relaxed text-aurora-text-secondary">
                            {alerta.mensagem}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative hidden sm:block" ref={contaMenuRef}>
                <button
                  type="button"
                  onClick={() => setContaMenuOpen((open) => !open)}
                  aria-expanded={contaMenuOpen}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-2 py-1.5 transition-colors hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/12">
                    <span className="text-xs font-semibold text-aurora-chrome-text">
                      {initials}
                    </span>
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="max-w-[160px] truncate text-sm font-medium text-aurora-chrome-text">
                      {usuario?.nome}
                    </div>
                    <div className="text-2xs capitalize text-aurora-chrome-muted">
                      {usuario?.perfil}
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-aurora-chrome-muted" />
                </button>

                <div
                  className={`
                    absolute right-0 top-full z-50 mt-2 w-56 py-1
                    aurora-card-elevated border-aurora-border-light shadow-aurora-md
                    transition-all duration-150
                    ${contaMenuOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none translate-y-1 opacity-0'}
                  `}
                >
                  <div className="border-b border-aurora-border px-3 py-2">
                    <p className="truncate text-sm font-medium text-aurora-text-primary">
                      {usuario?.nome}
                    </p>
                    <p className="truncate text-2xs text-aurora-text-muted">
                      {usuario?.email}
                    </p>
                    <Badge variant="primary" className="mt-1 capitalize">
                      {usuario?.perfil}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setContaMenuOpen(false)
                      void signOut()
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-aurora-red transition-colors hover:bg-aurora-red-muted/40"
                  >
                    <LogOut size={12} />
                    Sair
                  </button>
                </div>
              </div>

              <button
                className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-aurora-chrome-muted hover:bg-white/10 hover:text-aurora-chrome-text"
                onClick={() => setMobileMenuOpen((o) => !o)}
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          <div className="mt-3 hidden items-center gap-2 border-t border-white/10 pt-3 lg:flex">
            {navItems.map((item) => {
              const active = isActivePath(item.path)
              const Icon = item.icon

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`
                    relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150
                    ${active
                      ? 'bg-white text-[var(--aurora-chrome)] shadow-sm'
                      : 'text-aurora-chrome-muted hover:bg-white/10 hover:text-aurora-chrome-text'}
                  `}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                  {active && (
                    <span className="absolute inset-x-4 -bottom-3 h-0.5 rounded-full bg-aurora-primary" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[var(--aurora-chrome)] px-4 py-3 lg:hidden">
            <div className="grid gap-2 sm:grid-cols-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActivePath(item.path)

                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setMobileMenuOpen(false)
                    }}
                    className={`
                      flex items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium
                      ${active
                        ? 'bg-white text-[var(--aurora-chrome)]'
                        : 'bg-white/8 text-aurora-chrome-muted'}
                    `}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-3 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  void signOut()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-sm font-medium text-aurora-chrome-text transition-colors hover:bg-white/10"
              >
                <LogOut size={15} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main
        className="flex-1 mx-auto w-full max-w-screen-2xl px-4 pb-8"
        style={{ paddingTop: 'calc(var(--topbar-height, 112px) + 1.5rem)' }}
      >
        {children}
      </main>

      <BuscaGlobal open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}

function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { usuario, signOut } = useAuth()
  const [termoBusca, setTermoBusca] = useState('')
  const { resultados, buscando } = useBuscaProcesso(termoBusca)

  const navItems = NAV_ITEMS.filter(
    (n) => n.roles.includes('all') || (!!usuario?.perfil && n.roles.includes(usuario.perfil)),
  )

  const go = useCallback((path: string) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const quickActions = [
    ...(canEdit(usuario?.perfil)
      ? [{ label: 'Nova audiência', desc: 'Agendar audiência', action: () => go('/') }]
      : []),
    { label: 'Pauta de hoje', desc: 'Ver agenda do dia', action: () => go('/') },
    ...(NAV_ITEMS.some((item) => item.path === ROTAS.AGENDA && (
      item.roles.includes('all') || (!!usuario?.perfil && item.roles.includes(usuario.perfil))
    ))
      ? [{ label: 'Minha agenda', desc: 'Calendário pessoal', action: () => go(ROTAS.AGENDA) }]
      : []),
    ...(canEdit(usuario?.perfil)
      ? [{ label: 'Novo feriado', desc: 'Cadastrar feriado', action: () => go('/feriados') }]
      : []),
  ]

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[15vh]"
      style={{ background: 'rgba(15, 23, 42, 0.28)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Command
        className="w-full max-w-2xl animate-scale-in overflow-hidden rounded-3xl border border-aurora-border-light bg-aurora-surface shadow-aurora-lg"
      >
        <div className="border-b border-aurora-border px-5 py-4">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-[0.18em] text-aurora-text-muted">
            Busca rápida
          </div>
          <Command.Input
            placeholder="Buscar processo, magistrado ou funcionalidade"
            autoFocus
            onValueChange={(v) => setTermoBusca(v)}
            style={{
              width: '100%',
              border: '1px solid var(--aurora-border)',
              outline: 'none',
              borderRadius: '14px',
              padding: '14px 16px',
              fontSize: '15px',
              background: 'var(--aurora-surface)',
              color: 'var(--aurora-text-primary)',
            }}
          />
        </div>

        <Command.List style={{ maxHeight: '420px', overflowY: 'auto', padding: '10px' }}>
          <Command.Empty
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--aurora-text-muted)',
              fontSize: '14px',
            }}
          >
            Nenhum resultado encontrado.
          </Command.Empty>

          {(resultados.audiencias.length > 0 ||
            resultados.pendentes.length > 0 ||
            buscando) && (
            <>
              <Command.Group heading="Resultados da busca">
                {buscando && (
                  <Command.Item disabled value="buscando">
                    Buscando...
                  </Command.Item>
                )}

                {resultados.audiencias.map((a) => (
                  <Command.Item
                    key={`aud-${a.id}`}
                    value={`audiencia-${a.numeroProcesso}`}
                    onSelect={() => {
                      navigate('/', { state: { audienciaId: a.id } })
                      onClose()
                    }}
                  >
                    <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {a.numeroProcesso}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--aurora-text-muted)',
                        marginLeft: 'auto',
                      }}
                    >
                      {STATUS_AUDIENCIA_LABELS[a.status]} · {formatarDataHora(a.dataHoraInicio)}
                    </span>
                  </Command.Item>
                ))}

                {resultados.pendentes.map((p) => (
                  <Command.Item
                    key={`pend-${p.id}`}
                    value={`pendente-${p.numeroProcesso}`}
                    onSelect={() => {
                      navigate(ROTAS.FILA)
                      onClose()
                    }}
                  >
                    <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {p.numeroProcesso}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--aurora-text-muted)',
                        marginLeft: 'auto',
                      }}
                    >
                      Na fila · {TIPO_AUDIENCIA_PENDENTE_LABELS[p.tipoAudiencia]}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Separator />
            </>
          )}

          <Command.Group heading="Ações rápidas">
            {quickActions.map((cmd) => (
              <Command.Item
                key={cmd.label}
                value={cmd.label}
                onSelect={cmd.action}
              >
                <span style={{ flex: 1 }}>{cmd.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--aurora-text-muted)' }}>
                  {cmd.desc}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Separator />

          <Command.Group heading="Navegar">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Command.Item
                  key={item.path}
                  value={item.label}
                  onSelect={() => go(item.path)}
                >
                  <Icon size={14} style={{ color: 'var(--aurora-text-muted)' }} />
                  <span>{item.label}</span>
                </Command.Item>
              )
            })}
          </Command.Group>

          <Command.Separator />

          <Command.Group heading="Conta">
            <Command.Item value="sair" onSelect={signOut}>
              <LogOut size={14} style={{ color: 'var(--aurora-red)' }} />
              <span style={{ color: 'var(--aurora-red)' }}>Sair do sistema</span>
            </Command.Item>
          </Command.Group>
        </Command.List>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--aurora-border)',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {[['↑↓', 'navegar'], ['↵', 'selecionar'], ['Esc', 'fechar']].map(([key, desc]) => (
            <span
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: 'var(--aurora-text-muted)',
              }}
            >
              <kbd
                style={{
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--aurora-overlay)',
                  border: '1px solid var(--aurora-border)',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                }}
              >
                {key}
              </kbd>
              {desc}
            </span>
          ))}
        </div>
      </Command>
    </div>
  )
}

