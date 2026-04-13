// ──────────────────────────────────────────────────────────
//  App.tsx — CORRIGIDO: sem AuthProvider duplicado aqui
//  AuthProvider está APENAS em main.tsx
// ──────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { type ReactNode } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useAuth } from './contexts/AuthContext'
import { Spinner } from './components/ui'
import type { UserRole } from './types'
import { ROTAS } from './router/rotas'

// ── Lazy imports das páginas ───────────────────────────────
import { lazy, Suspense } from 'react'
const Login               = lazy(() => import('./pages/Login/index'))
const PrimeiroAcesso      = lazy(() => import('./pages/PrimeiroAcesso/index'))
const Pauta               = lazy(() => import('./pages/Pauta/index'))
const MinhaAgenda         = lazy(() => import('./pages/MinhaAgenda/index'))
const ListaEspera         = lazy(() => import('./pages/ListaEspera/index'))
const CargaSemanal        = lazy(() => import('./pages/CargaSemanal/index'))
const Procedimentos       = lazy(() => import('./pages/Procedimentos/index'))
const Estatisticas        = lazy(() => import('./pages/Estatisticas/index'))
const Usuarios            = lazy(() => import('./pages/Usuarios/index'))
const Salas               = lazy(() => import('./pages/Salas/index'))
const Feriados            = lazy(() => import('./pages/Feriados/index'))
const Configuracoes       = lazy(() => import('./pages/Configuracoes/index'))
const Auditoria           = lazy(() => import('./pages/Auditoria/index'))
const Relatorios          = lazy(() => import('./pages/Relatorios/index'))
const ProcessoHub         = lazy(() => import('./pages/ProcessoHub'))
const ProcessoFase1       = lazy(() => import('./pages/ProcessoFase1'))
const ProcessoFase2       = lazy(() => import('./pages/ProcessoFase2'))
const ProcessoFase3       = lazy(() => import('./pages/ProcessoFase3'))
const Intimacoes          = lazy(() => import('./pages/Intimacoes'))
const Modelos             = lazy(() => import('./pages/Modelos'))
const Magistrado          = lazy(() => import('./pages/Magistrado'))

// ── Guard de autenticação ──────────────────────────────────
function RequireAuth({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { usuario, contaDesativada, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh bg-aurora-bg flex items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (contaDesativada) {
    return <Navigate to="/login" state={{ from: location, mensagem: 'Conta desativada' }} replace />
  }

  if (!usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(usuario.perfil)) {
    return (
      <Navigate
        to="/"
        state={{ mensagem: 'Seu perfil nao possui permissao para acessar este modulo.' }}
        replace
      />
    )
  }

  return <>{children}</>
}

// ── Redirecionar logado para fora do login ─────────────────
function GuestOnly({ children }: { children: ReactNode }) {
  const { usuario, contaDesativada, loading } = useAuth()
  if (loading) return null
  if (usuario && !contaDesativada) return <Navigate to="/" replace />
  return <>{children}</>
}

// ── Fallback de carregamento de página ─────────────────────
function PageFallback() {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <Spinner size={24} />
    </div>
  )
}

function LoginPage() {
  const location = useLocation()
  const mensagem = (location.state as { mensagem?: string } | null)?.mensagem

  return (
    <>
      {mensagem && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg border border-aurora-red/30 bg-aurora-red-muted/80 text-sm text-aurora-red-pale shadow-aurora-md">
          {mensagem}
        </div>
      )}
      <Login />
    </>
  )
}

function LegacyRedirect({
  to,
}: {
  to: (id: string) => string
}) {
  const { id = '' } = useParams()
  return <Navigate to={to(id)} replace />
}

// ── Rotas autenticadas com shell ───────────────────────────
function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<PageFallback />}>
        {children}
      </Suspense>
    </AppShell>
  )
}

// ══════════════════════════════════════════════════════════
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Suspense fallback={null}>
                <LoginPage />
              </Suspense>
            </GuestOnly>
          }
        />

        <Route
          path="/primeiro-acesso"
          element={
            <GuestOnly>
              <Suspense fallback={null}>
                <PrimeiroAcesso />
              </Suspense>
            </GuestOnly>
          }
        />

        {/* Privadas */}
        <Route
          path={ROTAS.PAINEL}
          element={
            <RequireAuth>
              <PrivateLayout><Pauta /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.AGENDA}
          element={
            <RequireAuth roles={['diretor', 'magistrado', 'supervisor', 'servidor']}>
              <PrivateLayout><MinhaAgenda /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.FILA}
          element={
            <RequireAuth roles={['diretor', 'magistrado', 'supervisor', 'servidor']}>
              <PrivateLayout><ListaEspera /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.PROCESSO_HUB}
          element={
            <RequireAuth>
              <PrivateLayout><ProcessoHub /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.PROCESSO_FASE1}
          element={
            <RequireAuth>
              <PrivateLayout><ProcessoFase1 /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.PROCESSO_FASE2}
          element={
            <RequireAuth>
              <PrivateLayout><ProcessoFase2 /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.PROCESSO_FASE3}
          element={
            <RequireAuth>
              <PrivateLayout><ProcessoFase3 /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.INTIMACOES}
          element={
            <RequireAuth>
              <PrivateLayout><Intimacoes /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.MODELOS}
          element={
            <RequireAuth>
              <PrivateLayout><Modelos /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/carga-semanal"
          element={
            <RequireAuth>
              <PrivateLayout><CargaSemanal /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/procedimentos"
          element={
            <RequireAuth>
              <PrivateLayout><Procedimentos /></PrivateLayout>
            </RequireAuth>
          }
        />
        <Route
          path="/estatisticas"
          element={
            <RequireAuth>
              <PrivateLayout><Estatisticas /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.RELATORIOS}
          element={
            <RequireAuth roles={['diretor', 'supervisor', 'servidor', 'magistrado']}>
              <PrivateLayout><Relatorios /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path={ROTAS.MAGISTRADO}
          element={
            <RequireAuth roles={['diretor', 'magistrado', 'supervisor', 'servidor']}>
              <PrivateLayout><Magistrado /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/usuarios"
          element={
            <RequireAuth roles={['diretor']}>
              <PrivateLayout><Usuarios /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/salas"
          element={
            <RequireAuth>
              <PrivateLayout><Salas /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/feriados"
          element={
            <RequireAuth>
              <PrivateLayout><Feriados /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/configuracoes"
          element={
            <RequireAuth roles={['diretor']}>
              <PrivateLayout><Configuracoes /></PrivateLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/auditoria"
          element={
            <RequireAuth roles={['diretor']}>
              <PrivateLayout><Auditoria /></PrivateLayout>
            </RequireAuth>
          }
        />

        {/* Redirecionamentos legados */}
        <Route path="/minha-agenda" element={<Navigate to={ROTAS.AGENDA} replace />} />
        <Route path="/lista-espera" element={<Navigate to={ROTAS.FILA} replace />} />
        <Route path="/audiencia/:id" element={<LegacyRedirect to={ROTAS.processo} />} />
        <Route path="/procedimento/:id" element={<LegacyRedirect to={ROTAS.processoFase3} />} />
        <Route path="/procedimentos/:id" element={<LegacyRedirect to={ROTAS.processoFase3} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROTAS.PAINEL} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
