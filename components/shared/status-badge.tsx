import { cn } from "@/lib/utils"
import type { TrangThai } from "@/lib/mock-data"

const MAP: Record<TrangThai, { label: string; cls: string }> = {
  chua:     { label: "Chưa thu",    cls: "bg-status-red/20 text-status-red-fg border border-status-red/30" },
  mot_phan: { label: "Một phần",    cls: "bg-status-yellow/40 text-status-yellow-fg border border-status-yellow/40" },
  du:       { label: "Đủ",          cls: "bg-status-green/40 text-status-green-fg border border-status-green/40" },
}

export function StatusBadge({ status }: { status: TrangThai }) {
  const m = MAP[status]
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", m.cls)}>
      {m.label}
    </span>
  )
}

export function KyBadge({ status }: { status: "chua_khui" | "da_chot" }) {
  return status === "da_chot" ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-green/40 text-status-green-fg border border-status-green/40">
      Đã chốt
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
      Chưa khui
    </span>
  )
}

export function ChanBadge({ alive }: { alive: boolean }) {
  return alive ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-status-green/30 text-status-green-fg">Sống</span>
  ) : (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-status-red/20 text-status-red-fg">Chết</span>
  )
}
