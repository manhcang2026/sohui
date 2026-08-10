"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Coins,
  FileText,
  Flame,
  Layers,
  LoaderCircle,
  RefreshCw,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Page } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type Props = {
  onNavigate: (page: Page) => void
}

type MemberRow = {
  id: string
  full_name: string
  is_active: boolean
}

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  fee_amount: number
  status: string
}

type PeriodRow = {
  id: string
  group_id: string
  period_number: number
  scheduled_date: string
  winner_share_id: string | null
  bid_amount: number
  fee_amount: number
  status: string
}

type ReceiptRow = {
  id: string
  member_id: string
  receipt_date: string
  source_total_pay: number
  source_total_receive: number
  settlement_amount: number
  status: "open" | "partial" | "paid" | "cancelled"
}

type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  status: "active" | "cancelled"
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function isCompleted(status: string) {
  return status === "completed" || status === "opened"
}

export function TongQuanPage({ onNavigate }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const today = todayInVietnam()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()

    const [
      membersResult,
      groupsResult,
      periodsResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, is_active"),
      supabase
        .from("hui_groups")
        .select(
          "id, code, name, contribution_amount, total_shares, fee_amount, status",
        ),
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, fee_amount, status",
        )
        .order("scheduled_date")
        .order("period_number"),
      supabase
        .from("hui_receipts")
        .select(
          "id, member_id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
        ),
      supabase
        .from("receipt_payments")
        .select("id, receipt_id, direction, amount, status"),
    ])

    const firstError =
      membersResult.error ??
      groupsResult.error ??
      periodsResult.error ??
      receiptsResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError("Không thể tải dữ liệu Tổng quan.")
      setLoading(false)
      return
    }

    setMembers((membersResult.data ?? []) as MemberRow[])
    setGroups((groupsResult.data ?? []) as GroupRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setReceipts((receiptsResult.data ?? []) as ReceiptRow[])
    setPayments((paymentsResult.data ?? []) as PaymentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const dashboard = useMemo(() => {
    const activeGroups = groups.filter((group) => group.status === "active")
    const activeGroupIds = new Set(activeGroups.map((group) => group.id))

    const activePeriods = periods.filter((period) =>
      activeGroupIds.has(period.group_id),
    )

    const periodsToday = activePeriods.filter(
      (period) =>
        period.scheduled_date === today &&
        period.status !== "cancelled",
    )

    const pendingToday = periodsToday.filter(
      (period) => !isCompleted(period.status),
    )

    const completedToday = periodsToday.filter((period) =>
      isCompleted(period.status),
    )

    const activeReceipts = receipts.filter(
      (receipt) => receipt.status !== "cancelled",
    )

    const openReceipts = activeReceipts.filter(
      (receipt) =>
        receipt.status === "open" || receipt.status === "partial",
    )

    const paymentTotalsByReceipt = new Map<
      string,
      { collected: number; paid: number }
    >()

    let actualCollected = 0
    let actualPaid = 0

    for (const payment of payments) {
      if (payment.status !== "active") continue

      const current = paymentTotalsByReceipt.get(payment.receipt_id) ?? {
        collected: 0,
        paid: 0,
      }

      if (payment.direction === "collect") {
        current.collected += Number(payment.amount || 0)
        actualCollected += Number(payment.amount || 0)
      } else {
        current.paid += Number(payment.amount || 0)
        actualPaid += Number(payment.amount || 0)
      }

      paymentTotalsByReceipt.set(payment.receipt_id, current)
    }

    let remainingCollect = 0
    let remainingPay = 0

    for (const receipt of openReceipts) {
      const net =
        Number(receipt.source_total_pay || 0) -
        Number(receipt.source_total_receive || 0) +
        Number(receipt.settlement_amount || 0)

      const paid = paymentTotalsByReceipt.get(receipt.id) ?? {
        collected: 0,
        paid: 0,
      }

      if (net > 0) {
        remainingCollect += Math.max(0, net - paid.collected)
      } else if (net < 0) {
        remainingPay += Math.max(0, Math.abs(net) - paid.paid)
      }
    }

    const totalFee = activePeriods
      .filter((period) => isCompleted(period.status))
      .reduce((sum, period) => {
        const group = activeGroups.find(
          (item) => item.id === period.group_id,
        )
        return (
          sum +
          Number(period.fee_amount ?? group?.fee_amount ?? 0)
        )
      }, 0)

    const groupProgress = activeGroups
      .map((group) => {
        const groupPeriods = activePeriods
          .filter((period) => period.group_id === group.id)
          .sort((a, b) => a.period_number - b.period_number)

        const completed = groupPeriods.filter((period) =>
          isCompleted(period.status),
        ).length

        const nextPeriod = groupPeriods.find(
          (period) =>
            period.status === "scheduled" &&
            period.scheduled_date >= today,
        )

        const total = Math.max(
          group.total_shares,
          groupPeriods.length,
          1,
        )

        return {
          group,
          completed,
          total,
          progress: Math.min(
            100,
            Math.round((completed / total) * 100),
          ),
          nextPeriod,
        }
      })
      .sort((a, b) => {
        if (!a.nextPeriod && !b.nextPeriod) {
          return a.group.name.localeCompare(b.group.name, "vi")
        }
        if (!a.nextPeriod) return 1
        if (!b.nextPeriod) return -1
        return a.nextPeriod.scheduled_date.localeCompare(
          b.nextPeriod.scheduled_date,
        )
      })

    return {
      activeMembers: members.filter((member) => member.is_active).length,
      activeGroups,
      periodsToday,
      pendingToday,
      completedToday,
      openReceipts,
      actualCollected,
      actualPaid,
      cashNet: actualCollected - actualPaid,
      remainingCollect,
      remainingPay,
      totalFee,
      groupProgress,
    }
  }, [groups, members, payments, periods, receipts, today])

  const tasks = useMemo(() => {
    const groupById = new Map(
      dashboard.activeGroups.map((group) => [group.id, group]),
    )

    const periodTasks = dashboard.pendingToday.map((period) => {
      const group = groupById.get(period.group_id)

      return {
        key: `period-${period.id}`,
        icon: Flame,
        iconClass: "text-orange-500",
        text: `Khui kỳ ${period.period_number} — ${
          group?.code ? `[${group.code}] ` : ""
        }${group?.name ?? "Không rõ dây"}`,
        action: () => onNavigate("khui"),
      }
    })

    const receiptTasks = dashboard.openReceipts
      .slice(0, 8)
      .map((receipt) => {
        const net =
          Number(receipt.source_total_pay || 0) -
          Number(receipt.source_total_receive || 0) +
          Number(receipt.settlement_amount || 0)

        return {
          key: `receipt-${receipt.id}`,
          icon: AlertCircle,
          iconClass: "text-status-yellow-fg",
          text:
            net >= 0
              ? `Có phiếu cần thu/đối chiếu ${formatVND(Math.abs(net))}`
              : `Có phiếu cần chi/đối chiếu ${formatVND(Math.abs(net))}`,
          action: () => onNavigate("phieu"),
        }
      })

    return [...periodTasks, ...receiptTasks]
  }, [dashboard, onNavigate])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải Tổng quan...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="font-medium text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </Card>
      </div>
    )
  }

  const stats = [
    {
      label: "Hụi viên",
      value: dashboard.activeMembers,
      icon: Users,
      sub: "đang hoạt động",
      onClick: () => onNavigate("huivien"),
      urgent: false,
    },
    {
      label: "Dây hoạt động",
      value: dashboard.activeGroups.length,
      icon: Layers,
      sub: `${dashboard.groupProgress.reduce(
        (sum, item) => sum + item.completed,
        0,
      )} kỳ đã chốt`,
      onClick: () => onNavigate("day"),
      urgent: false,
    },
    {
      label: "Khui hôm nay",
      value: dashboard.periodsToday.length,
      icon: Flame,
      sub:
        dashboard.pendingToday.length > 0
          ? `${dashboard.pendingToday.length} kỳ chưa khui`
          : dashboard.periodsToday.length > 0
            ? "Đã xử lý hết"
            : "Không có kỳ",
      onClick: () => onNavigate("khui"),
      urgent: dashboard.pendingToday.length > 0,
    },
    {
      label: "Phiếu còn xử lý",
      value: dashboard.openReceipts.length,
      icon: FileText,
      sub:
        dashboard.openReceipts.length > 0
          ? "Có phiếu mở / một phần"
          : "Không có phiếu tồn",
      onClick: () => onNavigate("phieu"),
      urgent: dashboard.openReceipts.length > 0,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Tổng quan</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ngày {formatDate(today)} · dữ liệu thật từ Supabase
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
        >
          <RefreshCw className="size-4" />
          Làm mới
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            type="button"
            key={stat.label}
            onClick={stat.onClick}
            className="min-w-0 text-left"
          >
            <Card
              className={`h-full p-4 transition-shadow hover:shadow-md ${
                stat.urgent
                  ? "border-destructive/30 bg-destructive/5"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </p>
                  <p
                    className={`mt-1 text-3xl font-bold ${
                      stat.urgent ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {stat.sub}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary p-2">
                  <stat.icon className="size-5 text-primary" />
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Việc cần làm hôm nay</h2>
              <p className="text-xs text-muted-foreground">
                Kỳ chưa khui và phiếu còn xử lý
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {tasks.length} mục
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-status-green-fg" />
              Không có việc cần xử lý.
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <button
                  type="button"
                  key={task.key}
                  onClick={task.action}
                  className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left hover:bg-accent"
                >
                  <task.icon
                    className={`size-4 shrink-0 ${task.iconClass}`}
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    {task.text}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tiến độ dây đang hoạt động</h2>
              <p className="text-xs text-muted-foreground">
                Chỉ tính các dây chưa kết thúc
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("day")}
            >
              Xem tất cả
            </Button>
          </div>

          {dashboard.groupProgress.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Chưa có dây đang hoạt động.
            </p>
          ) : (
            <div className="space-y-4">
              {dashboard.groupProgress.slice(0, 8).map((item) => (
                <button
                  type="button"
                  key={item.group.id}
                  onClick={() => onNavigate("day")}
                  className="w-full text-left"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className="shrink-0 font-mono text-[10px]"
                      >
                        {item.group.code || "CHƯA-MÃ"}
                      </Badge>
                      <span className="truncate text-sm font-medium">
                        {item.group.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.completed}/{item.total}
                    </span>
                  </div>

                  <Progress value={item.progress} className="h-2" />

                  <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                      {formatVND(item.group.contribution_amount)}/chân
                    </span>
                    <span>
                      Kỳ tiếp:{" "}
                      {item.nextPeriod
                        ? formatDate(item.nextPeriod.scheduled_date)
                        : "Chưa có"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="font-semibold">Tóm tắt tiền thật</h2>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          Chỉ tính giao dịch đã xác nhận trong app; không phải số dư tài khoản
          ngân hàng.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <FinanceStat
            icon={WalletCards}
            label="Đã thu"
            value={formatVND(dashboard.actualCollected)}
          />
          <FinanceStat
            icon={WalletCards}
            label="Đã chi"
            value={formatVND(dashboard.actualPaid)}
          />
          <FinanceStat
            icon={WalletCards}
            label="Tiền thực đang giữ"
            value={formatVND(dashboard.cashNet)}
            strong
          />
          <FinanceStat
            icon={AlertCircle}
            label="Còn phải thu*"
            value={formatVND(dashboard.remainingCollect)}
          />
          <FinanceStat
            icon={AlertCircle}
            label="Còn phải chi*"
            value={formatVND(dashboard.remainingPay)}
          />
          <FinanceStat
            icon={Coins}
            label="Tiền thảo tích lũy"
            value={formatVND(dashboard.totalFee)}
            strong
          />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          * “Còn phải thu/chi” ở Tổng quan chỉ dựa trên các phiếu đã được lưu
          trong bảng phiếu. Bảng Cân đối vẫn là màn hình chính để đối chiếu
          nghĩa vụ toàn bộ các kỳ.
        </p>
      </Card>
    </div>
  )
}

function FinanceStat({
  icon: Icon,
  label,
  value,
  strong = false,
}: {
  icon: typeof WalletCards
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span>{label}</span>
      </div>
      <p
        className={`mt-1 break-words text-sm ${
          strong ? "font-bold" : "font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  )
}
