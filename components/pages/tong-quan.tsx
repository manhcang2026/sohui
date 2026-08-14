"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  RefreshCw,
  WalletCards,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Page } from "@/components/app-shell"
import { AppPage, ErrorState, LoadingState, PageHeader } from "@/components/hui-design"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type Props = {
  onNavigate: (page: Page) => void
}

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  fee_amount: number
  opening_time: string | null
  status: string
}

type PeriodRow = {
  id: string
  group_id: string
  period_number: number
  scheduled_date: string
  scheduled_at: string | null
  winner_share_id: string | null
  bid_amount: number
  fee_amount: number
  status: string
}

type ShareRow = {
  id: string
  member_id: string
  share_number: number
}

type MemberRow = {
  id: string
  full_name: string
}

type ReceiptRow = {
  id: string
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

function formatTime(value: string | null | undefined) {
  if (!value) return ""

  if (value.includes("T")) {
    return new Date(value).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    })
  }

  return value.slice(0, 5)
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

function periodStatus(
  period: PeriodRow,
): "pending" | "editing" | "completed" {
  if (isCompleted(period.status)) return "completed"
  if (period.winner_share_id) return "editing"
  return "pending"
}

export function TongQuanPage({ onNavigate }: Props) {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
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
      groupsResult,
      periodsResult,
      sharesResult,
      membersResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("hui_groups")
        .select(
          "id, code, name, contribution_amount, total_shares, fee_amount, opening_time, status",
        )
        .eq("status", "active"),

      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, scheduled_at, winner_share_id, bid_amount, fee_amount, status",
        )
        .order("scheduled_at")
        .order("period_number"),

      supabase
        .from("hui_shares")
        .select("id, member_id, share_number"),

      supabase
        .from("members")
        .select("id, full_name"),

      supabase
        .from("hui_receipts")
        .select(
          "id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
        ),

      supabase
        .from("receipt_payments")
        .select("id, receipt_id, direction, amount, status"),
    ])

    const firstError =
      groupsResult.error ??
      periodsResult.error ??
      sharesResult.error ??
      membersResult.error ??
      receiptsResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError("Không thể tải dữ liệu Hôm nay.")
      setLoading(false)
      return
    }

    setGroups((groupsResult.data ?? []) as GroupRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setShares((sharesResult.data ?? []) as ShareRow[])
    setMembers((membersResult.data ?? []) as MemberRow[])
    setReceipts((receiptsResult.data ?? []) as ReceiptRow[])
    setPayments((paymentsResult.data ?? []) as PaymentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const dashboard = useMemo(() => {
    const groupById = new Map(groups.map((group) => [group.id, group]))
    const shareById = new Map(shares.map((share) => [share.id, share]))
    const memberById = new Map(
      members.map((member) => [member.id, member]),
    )

    const todayPeriods = periods
      .filter(
        (period) =>
          period.scheduled_date === today &&
          period.status !== "cancelled" &&
          groupById.has(period.group_id),
      )
      .sort((a, b) => {
        const groupA = groupById.get(a.group_id)
        const groupB = groupById.get(b.group_id)

        const timeA =
          a.scheduled_at ??
          groupA?.opening_time ??
          ""

        const timeB =
          b.scheduled_at ??
          groupB?.opening_time ??
          ""

        if (timeA !== timeB) {
          return timeA.localeCompare(timeB)
        }

        return (groupA?.name ?? "").localeCompare(
          groupB?.name ?? "",
          "vi",
        )
      })

    const completedPeriods = todayPeriods.filter((period) =>
      isCompleted(period.status),
    )

    const pendingPeriods = todayPeriods.filter(
      (period) => !isCompleted(period.status),
    )

    const todayReceipts = receipts.filter(
      (receipt) =>
        receipt.receipt_date === today &&
        receipt.status !== "cancelled",
    )

    const paymentTotals = new Map<
      string,
      { collected: number; paid: number }
    >()

    for (const payment of payments) {
      if (payment.status !== "active") continue

      const current = paymentTotals.get(payment.receipt_id) ?? {
        collected: 0,
        paid: 0,
      }

      if (payment.direction === "collect") {
        current.collected += Number(payment.amount || 0)
      } else {
        current.paid += Number(payment.amount || 0)
      }

      paymentTotals.set(payment.receipt_id, current)
    }

    let remainingCollect = 0
    let remainingPay = 0
    let openCollectCount = 0
    let openPayCount = 0

    for (const receipt of todayReceipts) {
      if (
        receipt.status !== "open" &&
        receipt.status !== "partial"
      ) {
        continue
      }

      const net =
        Number(receipt.source_total_pay || 0) -
        Number(receipt.source_total_receive || 0) +
        Number(receipt.settlement_amount || 0)

      const paid = paymentTotals.get(receipt.id) ?? {
        collected: 0,
        paid: 0,
      }

      if (net > 0) {
        const remaining = Math.max(0, net - paid.collected)

        if (remaining > 0) {
          remainingCollect += remaining
          openCollectCount += 1
        }
      }

      if (net < 0) {
        const remaining = Math.max(
          0,
          Math.abs(net) - paid.paid,
        )

        if (remaining > 0) {
          remainingPay += remaining
          openPayCount += 1
        }
      }
    }

    const cards = todayPeriods.map((period) => {
      const group = groupById.get(period.group_id)!

      const winnerShare = period.winner_share_id
        ? shareById.get(period.winner_share_id)
        : null

      const winner = winnerShare
        ? memberById.get(winnerShare.member_id)
        : null

      return {
        period,
        group,
        winnerName: winner?.full_name ?? null,
        winnerShareNumber: winnerShare?.share_number ?? null,
        status: periodStatus(period),
      }
    })

    return {
      todayPeriods,
      completedPeriods,
      pendingPeriods,
      todayReceipts,
      remainingCollect,
      remainingPay,
      openCollectCount,
      openPayCount,
      cards,
    }
  }, [
    groups,
    members,
    payments,
    periods,
    receipts,
    shares,
    today,
  ])

  const progress =
    dashboard.todayPeriods.length > 0
      ? Math.round(
          (dashboard.completedPeriods.length /
            dashboard.todayPeriods.length) *
            100,
        )
      : 0

  const taskCount =
    (dashboard.pendingPeriods.length > 0 ? 1 : 0) +
    (dashboard.openCollectCount > 0 ? 1 : 0) +
    (dashboard.openPayCount > 0 ? 1 : 0)

  if (loading) {
    return <LoadingState label="Đang tải Hôm nay..." />
  }

  if (error) {
    return (
      <AppPage wide>
        <ErrorState description={error} action={<Button
            variant="outline"
            onClick={() => void loadData()}
          >
            <RefreshCw className="size-4" />
            Thử lại
          </Button>} />
      </AppPage>
    )
  }

  return (
    <AppPage wide>
      <PageHeader
        title="Hôm nay"
        subtitle={formatDate(today)}
        actions={<Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void loadData()}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate("khui")}
          className="text-left"
        >
          <Card className="h-full p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dây khui hôm nay
                </p>

                <p className="mt-2 text-3xl font-bold tabular-nums">
                  {dashboard.todayPeriods.length}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.completedPeriods.length} đã chốt ·{" "}
                  {dashboard.pendingPeriods.length} chưa khui
                </p>
              </div>

              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <CalendarDays className="size-5" />
              </div>
            </div>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("phieu")}
          className="text-left"
        >
          <Card className="h-full p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Còn phải thu
                </p>

                <p className="mt-2 break-words text-2xl font-bold tabular-nums text-success-foreground md:text-3xl">
                  + {formatVND(dashboard.remainingCollect)}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.todayReceipts.length === 0
                    ? "Chưa phát hành phiếu"
                    : dashboard.openCollectCount > 0
                      ? `${dashboard.openCollectCount} phiếu chưa thu đủ`
                      : "Đã thu đủ"}
                </p>
              </div>

              <div className="rounded-md bg-success-soft p-2 text-success-foreground">
                <ArrowDownLeft className="size-5" />
              </div>
            </div>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("phieu")}
          className="text-left"
        >
          <Card className="h-full p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Còn phải chi
                </p>

                <p className="mt-2 break-words text-2xl font-bold tabular-nums text-danger-foreground md:text-3xl">
                  − {formatVND(dashboard.remainingPay)}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboard.todayReceipts.length === 0
                    ? "Chưa phát hành phiếu"
                    : dashboard.openPayCount > 0
                      ? `${dashboard.openPayCount} phiếu chưa chi`
                      : "Đã chi đủ"}
                </p>
              </div>

              <div className="rounded-md bg-danger-soft p-2 text-danger-foreground">
                <ArrowUpRight className="size-5" />
              </div>
            </div>
          </Card>
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <WalletCards className="size-5 text-primary" />

          <h2 className="text-lg font-bold">
            Việc cần xử lý
          </h2>

          {taskCount > 0 && (
            <Badge variant="secondary">{taskCount}</Badge>
          )}
        </div>

        {taskCount === 0 ? (
          <Card className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success-foreground" />

            <div>
              <p className="font-semibold">
                Không còn việc cần xử lý hôm nay
              </p>
              <p className="text-sm text-muted-foreground">
                Các kỳ và phiếu trong ngày đã hoàn tất.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {dashboard.pendingPeriods.length > 0 && (
              <TaskRow
                icon={Clock3}
                title={`${dashboard.pendingPeriods.length} dây chưa khui`}
                description="Chọn người hốt và giá thăm để chốt kỳ"
                onClick={() => onNavigate("khui")}
              />
            )}

            {dashboard.openCollectCount > 0 && (
              <TaskRow
                icon={ArrowDownLeft}
                title={`${dashboard.openCollectCount} phiếu chưa thu đủ`}
                description={`Còn phải thu ${formatVND(
                  dashboard.remainingCollect,
                )}`}
                tone="collect"
                onClick={() => onNavigate("phieu")}
              />
            )}

            {dashboard.openPayCount > 0 && (
              <TaskRow
                icon={ArrowUpRight}
                title={`${dashboard.openPayCount} phiếu chưa chi`}
                description={`Còn phải chi ${formatVND(
                  dashboard.remainingPay,
                )}`}
                tone="pay"
                onClick={() => onNavigate("phieu")}
              />
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            Dây khui hôm nay
          </h2>

          <Badge variant="secondary" className="tabular-nums">
            {dashboard.completedPeriods.length}/
            {dashboard.todayPeriods.length} dây đã chốt
          </Badge>
        </div>

        {dashboard.todayPeriods.length > 0 && (
          <Progress value={progress} className="h-1.5" />
        )}

        {dashboard.cards.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />

            <p className="font-semibold">
              Hôm nay không có dây cần khui
            </p>

            <p className="text-sm text-muted-foreground">
              Bạn có thể xem danh sách các dây đang hoạt động ở mục
              Dây hụi.
            </p>

            <Button
              variant="outline"
              className="mt-2"
              onClick={() => onNavigate("day")}
            >
              Xem Dây hụi
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.cards.map((item) => (
              <TodayGroupCard
                key={item.period.id}
                item={item}
                onOpen={() => onNavigate("khui")}
              />
            ))}
          </div>
        )}
      </section>
    </AppPage>
  )
}

function TaskRow({
  icon: Icon,
  title,
  description,
  onClick,
  tone = "normal",
}: {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
  tone?: "normal" | "collect" | "pay"
}) {
  const iconClass =
    tone === "collect"
      ? "text-success-foreground"
      : tone === "pay"
        ? "text-danger-foreground"
        : "text-warning-foreground"

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-sm">
        <Icon className={`size-5 shrink-0 ${iconClass}`} />

        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Card>
    </button>
  )
}

function TodayGroupCard({
  item,
  onOpen,
}: {
  item: {
    period: PeriodRow
    group: GroupRow
    winnerName: string | null
    winnerShareNumber: number | null
    status: "pending" | "editing" | "completed"
  }
  onOpen: () => void
}) {
  const { period, group } = item

  const time = formatTime(
    period.scheduled_at ?? group.opening_time,
  )

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-xs"
            >
              {group.code || "CHƯA-MÃ"}
            </Badge>

            <p className="font-bold">{group.name}</p>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Kỳ {period.period_number}/{group.total_shares}
            {time ? ` · ${time}` : ""}
          </p>
        </div>

        <PeriodStatusBadge status={item.status} />
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mệnh giá
            </p>

            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatVND(group.contribution_amount)}
            </p>
          </div>

          {item.status === "completed" && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                Giá thăm
              </p>
              <p className="font-semibold tabular-nums">
                {formatVND(period.bid_amount)}
              </p>
            </div>
          )}
        </div>

        {item.status === "completed" &&
          item.winnerName && (
            <div className="mt-3 rounded-md bg-muted/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Người hốt
              </p>

              <p className="mt-0.5 font-semibold">
                {item.winnerName}
                {item.winnerShareNumber
                  ? ` · Chân ${item.winnerShareNumber}`
                  : ""}
              </p>
            </div>
          )}

        <Button
          className="mt-3"
          variant={
            item.status === "completed"
              ? "outline"
              : "default"
          }
          onClick={onOpen}
        >
          {item.status === "completed"
            ? "Xem lại"
            : item.status === "editing"
              ? "Tiếp tục khui"
              : "Khui dây này"}

          <ChevronRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

function PeriodStatusBadge({
  status,
}: {
  status: "pending" | "editing" | "completed"
}) {
  if (status === "completed") {
    return (
      <Badge className="bg-success-soft text-success-foreground hover:bg-success-soft">
        <CheckCircle2 className="mr-1 size-3.5" />
        Đã chốt
      </Badge>
    )
  }

  if (status === "editing") {
    return (
      <Badge className="bg-primary-soft text-primary hover:bg-primary-soft">
        <Clock3 className="mr-1 size-3.5" />
        Đang khui
      </Badge>
    )
  }

  return (
    <Badge className="bg-warning-soft text-warning-foreground hover:bg-warning-soft">
      <Clock3 className="mr-1 size-3.5" />
      Chưa khui
    </Badge>
  )
}
