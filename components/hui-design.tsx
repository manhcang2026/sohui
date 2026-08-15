import type { ElementType, ReactNode } from "react"

import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  info: "border-transparent bg-primary-soft text-accent-foreground",
  success: "border-transparent bg-success-soft text-success",
  warning: "border-transparent bg-warning-soft text-warning-foreground",
  danger: "border-transparent bg-danger-soft text-danger",
}

export function HuiPage({
  children,
  className,
  wide = false,
}: {
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "hui-design-surface mx-auto w-full space-y-5 px-4 pb-24 pt-4 sm:px-6 sm:pt-5 md:pb-8",
        wide ? "max-w-[1400px]" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  )
}

export const AppPage = HuiPage

export function HuiPageHeader({
  title,
  subtitle,
  actions,
  leading,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  leading?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border pb-4 sm:items-center">
      <div className="flex min-w-0 items-start gap-2.5">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  )
}

export const PageHeader = HuiPageHeader

export function SectionHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ElementType
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-border pb-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" /> : null}
          <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h2>
        </div>
        {description ? <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}

export function MoneyValue({
  amount,
  tone = "neutral",
  size = "md",
  prefix,
  className,
}: {
  amount: number
  tone?: "neutral" | "collect" | "pay" | "muted"
  size?: "sm" | "md" | "lg" | "xl"
  prefix?: string
  className?: string
}) {
  const toneClass =
    tone === "collect"
      ? "text-success"
      : tone === "pay"
        ? "text-danger"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground"
  const sizeClass =
    size === "sm"
      ? "text-sm font-semibold"
      : size === "lg"
        ? "text-xl font-black sm:text-2xl"
        : size === "xl"
          ? "text-2xl font-black sm:text-3xl"
          : "text-base font-bold"

  return (
    <span className={cn("num whitespace-nowrap", toneClass, sizeClass, className)}>
      {prefix}{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount)}
    </span>
  )
}

export function HuiStatusBadge({
  label,
  tone = "neutral",
  icon: Icon,
  className,
}: {
  label: ReactNode
  tone?: StatusTone
  icon?: ElementType
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </span>
  )
}

export const StatusBadge = HuiStatusBadge

export function HuiCodeBadge({ code }: { code: string | null | undefined }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide text-foreground">
      {code || "Chưa có mã"}
    </span>
  )
}

export const EmptyState = HuiEmptyState

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: ReactNode }) {
  return (
    <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-medium text-muted-foreground" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorState({
  title = "Không thể tải dữ liệu",
  description,
  action,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-danger/25 bg-danger-soft px-6 py-10 text-center">
      <p className="font-bold text-danger">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function HuiEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ElementType
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <Icon className="mb-3 size-9 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-bold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function HuiStatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: ReactNode
  value: ReactNode
  tone?: StatusTone
}) {
  const valueTone =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "danger"
          ? "text-danger"
          : tone === "info"
            ? "text-primary"
            : "text-foreground"

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3.5 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className={cn("mt-2 overflow-x-auto whitespace-nowrap text-lg font-black tracking-tight tabular-nums sm:text-xl", valueTone)}>
        {value}
      </div>
    </div>
  )
}

export const StatCard = HuiStatCard

export function HuiTableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="w-full overflow-x-auto">{children}</div>
    </div>
  )
}

export const DataTableFrame = HuiTableFrame

export function MobileCardList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 lg:hidden sm:grid-cols-2", className)}>{children}</div>
}

export function MobileCard({
  title,
  meta,
  right,
  badges,
  children,
  footer,
  onClick,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  right?: ReactNode
  badges?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-4 text-left shadow-[var(--shadow-card)]",
        onClick && "transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{title}</p>
          {meta ? <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p> : null}
        </div>
        {right ? <div className="shrink-0 text-right">{right}</div> : null}
      </div>
      {badges ? <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div> : null}
      {children ? <div className="mt-3 text-sm">{children}</div> : null}
      {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
    </Comp>
  )
}

export function ActionBar({ children, info, className }: { children: ReactNode; info?: ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-16 z-20 rounded-lg border border-border bg-card/95 p-3 shadow-[var(--shadow-floating)] backdrop-blur md:bottom-4", className)}>
      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        {info ? <div className="min-w-0 text-sm font-semibold">{info}</div> : null}
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  )
}

export function FormSection({ title, description, children, className }: { title?: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-4", className)}>
      {title ? <h3 className="text-sm font-bold">{title}</h3> : null}
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      <div className={cn((title || description) && "mt-4")}>{children}</div>
    </section>
  )
}

export const dialogOverlayClass =
  "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"

export const dialogPanelClass =
  "max-h-[94vh] w-full overflow-y-auto rounded-b-none rounded-t-xl bg-card p-4 shadow-[var(--shadow-floating)] sm:rounded-xl sm:p-5"

export const dialogHeaderClass =
  "flex items-start justify-between gap-3 border-b border-border pb-4"

export const dialogFooterClass =
  "flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"

export const huiTableHeadClass =
  "whitespace-nowrap bg-secondary px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"

export const huiTableCellClass = "px-3 py-3 align-middle"
