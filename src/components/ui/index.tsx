// ──────────────────────────────────────────────────────────
//  Aurora UI Components — sistema de design completo
// ──────────────────────────────────────────────────────────

import {
  forwardRef, type ReactNode, type ButtonHTMLAttributes,
  type InputHTMLAttributes, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { X, Loader2 } from 'lucide-react'
import type { StatusAudiencia, StatusProcedimento, ToastVariant } from '../../types'

// ══════════════════════════════════════════════════════════
//  BUTTON
// ══════════════════════════════════════════════════════════
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-aurora-primary hover:bg-aurora-primary-hover text-white border-transparent shadow-aurora-sm',
  secondary: 'bg-white hover:bg-aurora-overlay text-aurora-text-secondary hover:text-aurora-text-primary border-aurora-border hover:border-aurora-border-light shadow-sm',
  ghost: 'bg-transparent hover:bg-aurora-overlay text-aurora-text-secondary hover:text-aurora-text-primary border-transparent',
  danger: 'bg-aurora-red-muted hover:bg-red-100 text-aurora-red border-red-200',
  success: 'bg-aurora-green-muted hover:bg-green-100 text-aurora-green border-green-200',
}
const BTN_SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-2xs gap-1 rounded-md',
  sm: 'h-7 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-5 text-base gap-2 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, icon, iconRight, children, className = '', disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium border
        transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-[0.97] select-none whitespace-nowrap
        ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}
      `}
      {...props}
    >
      {loading ? <Loader2 size={12} className="animate-spin shrink-0" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  ),
)
Button.displayName = 'Button'

// ══════════════════════════════════════════════════════════
//  BADGE
// ══════════════════════════════════════════════════════════
type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const BADGE_COLORS: Record<BadgeVariant, string> = {
  default: 'bg-white text-aurora-text-secondary border-aurora-border',
  primary: 'bg-aurora-primary-pale text-aurora-primary border-indigo-200',
  success: 'bg-aurora-green-pale text-aurora-green border-green-200',
  warning: 'bg-aurora-amber-pale text-aurora-amber border-amber-200',
  danger: 'bg-aurora-red-pale text-aurora-red border-red-200',
  info: 'bg-aurora-blue-pale text-aurora-blue border-blue-200',
  muted: 'bg-slate-50 text-aurora-text-muted border-slate-200',
}

const STATUS_AUDIENCIA_BADGE: Record<StatusAudiencia, BadgeVariant> = {
  agendada:     'info',
  em_andamento: 'warning',
  realizada:    'success',
  redesignada:  'primary',
  cancelada:    'danger',
  suspensa:     'muted',
}

const STATUS_PROC_BADGE: Record<StatusProcedimento, BadgeVariant> = {
  pendente:                 'muted',
  em_andamento:             'info',
  concluido:                'success',
  com_pendencias_criticas:  'danger',
}

interface BadgeProps {
  variant?: BadgeVariant
  statusAudiencia?: StatusAudiencia
  statusProcedimento?: StatusProcedimento
  pulse?: boolean
  children: ReactNode
  className?: string
}

export function Badge({
  variant = 'default',
  statusAudiencia,
  statusProcedimento,
  pulse,
  children,
  className = '',
}: BadgeProps) {
  const v = statusAudiencia
    ? STATUS_AUDIENCIA_BADGE[statusAudiencia]
    : statusProcedimento
    ? STATUS_PROC_BADGE[statusProcedimento]
    : variant

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-pill border
        text-2xs font-medium leading-none
        ${BADGE_COLORS[v]}
        ${pulse ? 'animate-pulse-critical' : ''}
        ${className}
      `}
    >
      {children}
    </span>
  )
}

// ══════════════════════════════════════════════════════════
//  CARD
// ══════════════════════════════════════════════════════════
interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className = '', hover, onClick, padding = 'md' }: CardProps) {
  const pads = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' }
  return (
    <div
      onClick={onClick}
      className={`
        aurora-card relative overflow-hidden ${pads[padding]}
        ${hover ? 'hover:-translate-y-0.5 hover:border-aurora-primary/20 hover:shadow-aurora-md transition-all duration-150 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  MODAL
// ══════════════════════════════════════════════════════════
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const MODAL_SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.18)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`
          w-full ${MODAL_SIZES[size]} max-h-[90dvh] flex flex-col
          aurora-card-elevated overflow-hidden border border-aurora-border-light bg-white/95
          animate-scale-in shadow-aurora-lg
        `}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-aurora-border bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-md font-semibold text-aurora-text-primary">{title}</h2>
              <p className="mt-1 text-xs text-aurora-text-muted">
                Revise os dados antes de confirmar a operação.
              </p>
            </div>
          <button
            onClick={onClose}
              className="rounded-lg border border-transparent p-2 text-aurora-text-muted transition-colors hover:border-aurora-border hover:bg-white hover:text-aurora-text-primary"
          >
            <X size={16} />
          </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-white px-5 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-aurora-border bg-slate-50/80 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════════
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, iconLeft, iconRight, className = '', id, ...props }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-aurora-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {iconLeft && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aurora-text-muted">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-10 px-3 text-sm bg-white border border-aurora-border
              rounded-lg text-aurora-text-primary placeholder-aurora-text-muted
              focus:outline-none focus:border-aurora-primary focus:ring-2 focus:ring-aurora-primary/15
              transition-all duration-150
              ${iconLeft  ? 'pl-9'  : ''}
              ${iconRight ? 'pr-9'  : ''}
              ${error ? 'border-aurora-red focus:border-aurora-red focus:ring-aurora-red/20' : ''}
              ${className}
            `}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-aurora-text-muted">
              {iconRight}
            </span>
          )}
        </div>
        {error && <p className="text-2xs text-aurora-red">{error}</p>}
        {hint && !error && <p className="text-2xs text-aurora-text-muted">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

// ── Select ──
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', id, children, ...props }, ref) => {
    const selId = id ?? `sel-${Math.random().toString(36).slice(2)}`
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selId} className="text-xs font-medium text-aurora-text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selId}
          className={`
            h-10 px-3 text-sm bg-white border border-aurora-border
            rounded-lg text-aurora-text-primary
            focus:outline-none focus:border-aurora-primary focus:ring-2 focus:ring-aurora-primary/15
            transition-all duration-150
            ${error ? 'border-aurora-red' : ''}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-2xs text-aurora-red">{error}</p>}
      </div>
    )
  },
)
Select.displayName = 'Select'

// ── Textarea ──
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const taId = id ?? `ta-${Math.random().toString(36).slice(2)}`
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={taId} className="text-xs font-medium text-aurora-text-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={taId}
          className={`
            px-3 py-2.5 text-sm bg-white border border-aurora-border
            rounded-lg text-aurora-text-primary placeholder-aurora-text-muted
            resize-y min-h-[80px]
            focus:outline-none focus:border-aurora-primary focus:ring-2 focus:ring-aurora-primary/15
            transition-all duration-150
            ${error ? 'border-aurora-red' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-2xs text-aurora-red">{error}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

// ══════════════════════════════════════════════════════════
//  SPINNER / SKELETON
// ══════════════════════════════════════════════════════════
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin text-aurora-primary ${className}`} />
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`shimmer-loading rounded-md h-4 ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-3xl border border-aurora-border bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-8 text-center shadow-aurora-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50">
        <Spinner size={24} />
      </div>
      <div className="space-y-1">
        <span className="block text-sm font-medium text-aurora-text-primary">
          Carregando informações
        </span>
        <span className="text-sm text-aurora-text-muted">
          Aguarde um instante enquanto preparamos a tela.
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  EMPTY STATE
// ══════════════════════════════════════════════════════════
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-aurora-border bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-16 text-center shadow-sm">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-aurora-border bg-white text-aurora-text-muted shadow-sm">
          {icon}
        </div>
      )}
      <div>
        <p className="text-md font-semibold text-aurora-text-primary">{title}</p>
        {description && <p className="text-sm text-aurora-text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
//  DIVIDER
// ══════════════════════════════════════════════════════════
export function Divider({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-aurora-border ${className}`} />
}

// ══════════════════════════════════════════════════════════
//  STAT CARD
// ══════════════════════════════════════════════════════════
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: 'primary' | 'green' | 'amber' | 'red'
  icon?: ReactNode
}

const STAT_COLORS = {
  primary: 'text-aurora-primary',
  green:   'text-aurora-green',
  amber:   'text-aurora-amber',
  red:     'text-aurora-red',
}

export function StatCard({ label, value, sub, color = 'primary', icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-1 border-t-2 border-t-aurora-primary/35 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-aurora-text-muted">{label}</span>
        {icon && <span className="text-aurora-text-muted">{icon}</span>}
      </div>
      <span className={`text-3xl font-semibold ${STAT_COLORS[color]}`}>{value}</span>
      {sub && <span className="text-2xs text-aurora-text-muted">{sub}</span>}
    </Card>
  )
}

export { TrilhaAuditoria } from './TrilhaAuditoria'
