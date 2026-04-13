// ──────────────────────────────────────────────────────────
//  Toast — contexto e componente de notificações Aurora
// ──────────────────────────────────────────────────────────

import { createContext, useContext, type ReactNode } from 'react'
import { create } from 'zustand'
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ToastMessage, ToastVariant } from '../types'

// ── Store Zustand ──────────────────────────────────────────
interface ToastStore {
  toasts: ToastMessage[]
  add: (message: string, variant?: ToastVariant, duration?: number) => void
  remove: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, variant = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, duration }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear:  () => set({ toasts: [] }),
}))

// ── Context (conveniência) ─────────────────────────────────
interface ToastContextValue {
  success: (msg: string) => void
  error:   (msg: string) => void
  warning: (msg: string) => void
  info:    (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const add = useToastStore((s) => s.add)
  const value: ToastContextValue = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error', 6000),
    warning: (msg) => add(msg, 'warning', 5000),
    info:    (msg) => add(msg, 'info'),
  }
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// ── Ícones por variante ────────────────────────────────────
const ICONS: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
}

const COLORS: Record<ToastVariant, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg:     'bg-aurora-green-muted/60',
    border: 'border-aurora-green/40',
    icon:   'text-aurora-green',
    text:   'text-aurora-green-pale',
  },
  error: {
    bg:     'bg-aurora-red-muted/60',
    border: 'border-aurora-red/40',
    icon:   'text-aurora-red',
    text:   'text-aurora-red-pale',
  },
  warning: {
    bg:     'bg-aurora-amber-muted/60',
    border: 'border-aurora-amber/40',
    icon:   'text-aurora-amber',
    text:   'text-aurora-amber-pale',
  },
  info: {
    bg:     'bg-aurora-primary-muted/60',
    border: 'border-aurora-primary/40',
    icon:   'text-aurora-primary-light',
    text:   'text-aurora-text-primary',
  },
}

// ── Componente Toast ───────────────────────────────────────
function ToastItem({ toast }: { toast: ToastMessage }) {
  const remove = useToastStore((s) => s.remove)
  const { bg, border, icon, text } = COLORS[toast.variant]
  const Icon = ICONS[toast.variant]

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border glass
        ${bg} ${border}
        animate-slide-in-right shadow-aurora-md
        max-w-sm w-full
      `}
    >
      <Icon size={16} className={`${icon} shrink-0 mt-0.5`} />
      <p className={`text-sm flex-1 leading-snug ${text}`}>{toast.message}</p>
      <button
        onClick={() => remove(toast.id)}
        className="text-aurora-text-muted hover:text-aurora-text-secondary transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
