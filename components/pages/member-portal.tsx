"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  KeyRound,
  Layers,
  LoaderCircle,
  LogOut,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { calculateGroupPerformance } from "@/lib/hui-performance"
import { ChangePinForm } from "@/components/account/account-security"
import {
  AppPage,
  EmptyState,
  ErrorState,
  HuiCodeBadge,
  LoadingState,
  MoneyValue,
  PageHeader,
  SectionHeader,
  StatCard,
  StatusBadge,
} from "@/components/hui-design"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Profile = {
  auth_user_id: string
  email: string | null
  display_name: string | null
  role: "member"
  member_id: string
}

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type ShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
  status: string
}

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  status: string
}

type PeriodRow = {
  id: string
  group_id: string
  period_number: number
  scheduled_date: string
  winner_share_id: string | null
  bid_amount: number
  status: string
}

type ReceiptRow = {
  id: string
  receipt_date: string
  source_total_pay: number
  source_total_receive: number
  settlement_amount: number
  status: string
}

type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  status: string
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

export function MemberPortalPage({ profile }: { profile: Profile }) {
  const [member, setMember] = useState<MemberRow | null>(null)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showPin, setShowPin] = useState(false)
  const [pinMessage, setPinMessage] = useState("")
  const [pinError, setPinError] = useState("")
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError("")
    const supabase = createClient()

    const [
      memberResult,
      sharesResult,
      groupsResult,
      periodsResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, phone")
        .eq("id", profile.member_id)
        .single(),
      supabase
        .from("hui_shares")
        .select("id, group_id, member_id, share_number, status"),
      supabase
        .from("hui_groups")
        .select(
          "id, code, name, contribution_amount, total_shares, status",
        ),
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, status",
        ),
      supabase
        .from("hui_receipts")
        .select(
          "id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
        )
        .order("receipt_date", { ascending: false }),
      supabase
        .from("receipt_payments")
        .select("id, receipt_id, direction, amount, status"),
    ])

    const firstError =
      memberResult.error ??
      sharesResult.error ??
      groupsResult.error ??
      periodsResult.error ??
      receiptsResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError("Không thể tải đầy đủ dữ liệu của bạn. Vui lòng thử lại.")
      setLoading(false)
      return
    }

    setMember((memberResult.data as MemberRow | null) ?? null)
    setShares((sharesResult.data ?? []) as ShareRow[])
    setGroups((groupsResult.data ?? []) as GroupRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setReceipts((receiptsResult.data ?? []) as ReceiptRow[])
    setPayments((paymentsResult.data ?? []) as PaymentRow[])
    setLoading(false)
  }

  const summary = useMemo(() => {
    const ownShareIds = new Set(shares.map((share) => share.id))
    const deadIds = new Set(
      periods
        .filter(
          (period) =>
            period.winner_share_id &&
            ownShareIds.has(period.winner_share_id) &&
            (period.status === "completed" || period.status === "opened"),
        )
        .map((period) => period.winner_share_id as string),
    )

    let collected = 0
    let paid = 0

    for (const payment of payments) {
      if (payment.status !== "active") continue
      if (payment.direction === "collect") {
        collected += Number(payment.amount)
      } else {
        paid += Number(payment.amount)
      }
    }

    return {
      groupCount: new Set(shares.map((share) => share.group_id)).size,
      totalShares: shares.length,
      deadShares: shares.filter((share) => deadIds.has(share.id)).length,
      liveShares: shares.filter((share) => !deadIds.has(share.id)).length,
      collected,
      paid,
    }
  }, [payments, periods, shares])

  const performanceByGroup = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof calculateGroupPerformance>["members"][number] | null
    >()

    for (const group of groups) {
      const groupShares = shares.filter((share) => share.group_id === group.id)
      const groupPeriods = periods.filter((period) => period.group_id === group.id)
      const performance = calculateGroupPerformance(groupShares, groupPeriods)

      map.set(
        group.id,
        performance.members.find((item) => item.memberId === profile.member_id) ??
          null,
      )
    }

    return map
  }, [groups, periods, profile.member_id, shares])

  async function logout() {
    await createClient().auth.signOut()
    window.location.assign("/login")
  }

  if (loading) {
    return <LoadingState label="Đang tải sổ hụi của bạn..." />
  }

  if (error) {
    return (
      <AppPage className="max-w-xl">
        <ErrorState description={error} action={<Button
            variant="outline"
            onClick={() => void loadData()}
          >
            Thử lại
          </Button>} />
      </AppPage>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Layers className="size-4" />
            </div>
            <div>
              <p className="font-bold">Sổ Hụi</p>
              <p className="text-xs text-muted-foreground">Cổng thông tin hụi viên</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPinError("")
                setShowPin(true)
              }}
            >
              <KeyRound className="size-4" />
              Đổi mã
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      <AppPage className="max-w-5xl">
        <PageHeader
          title={member?.full_name ?? profile.display_name ?? "Hụi viên"}
          subtitle={member?.phone ? `Số điện thoại: ${member.phone}` : "Tổng quan sổ hụi cá nhân"}
        />

        {pinMessage && (
          <Card className="flex items-center gap-2 border-success/25 bg-success-soft p-3 text-success-foreground">
            <CheckCircle2 className="size-4 shrink-0" />
            <p className="text-sm font-medium">{pinMessage}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Dây tham gia" value={summary.groupCount} tone="info" />
          <StatCard label="Tổng chân" value={summary.totalShares} />
          <StatCard label="Chân sống" value={summary.liveShares} tone="success" />
          <StatCard label="Chân đã hốt" value={summary.deadShares} tone="warning" />
        </div>

        <Card className="p-4">
          <SectionHeader
            title="Tiền đã xác nhận"
            description="Tổng tiền thực tế đã được chủ hụi ghi nhận"
            icon={WalletCards}
          />

          <div className="mt-4 grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-success/20 bg-success-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-success-foreground">Đã đóng</p>
              <MoneyValue amount={summary.collected} tone="collect" size="lg" className="mt-1 block max-w-full overflow-x-auto" />
            </div>
            <div className="min-w-0 rounded-lg border border-primary/20 bg-primary-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Đã nhận</p>
              <MoneyValue amount={summary.paid} tone="neutral" size="lg" className="mt-1 block max-w-full overflow-x-auto text-primary" />
            </div>
          </div>
        </Card>

        <section className="space-y-3">
          <SectionHeader title="Các dây đang tham gia" icon={Layers} />
          {groups.every((group) => !shares.some((share) => share.group_id === group.id)) ? (
            <EmptyState icon={Layers} title="Chưa tham gia dây hụi nào" />
          ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((group) => {
              const groupShares = shares.filter(
                (share) => share.group_id === group.id,
              )
              if (groupShares.length === 0) return null

              const groupPeriods = periods.filter(
                (period) => period.group_id === group.id,
              )
              const ownIds = new Set(groupShares.map((share) => share.id))
              const won = groupPeriods.filter(
                (period) =>
                  period.winner_share_id &&
                  ownIds.has(period.winner_share_id) &&
                  (period.status === "completed" ||
                    period.status === "opened"),
              ).length
              const performance = performanceByGroup.get(group.id) ?? null
              const expanded = expandedGroupId === group.id

              return (
                <Card key={group.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <HuiCodeBadge code={group.code} />
                      <p className="mt-2 break-words text-base font-bold leading-snug">
                        {group.name}
                      </p>
                    </div>
                    <StatusBadge
                      label={group.status === "active" ? "Đang hoạt động" : group.status}
                      tone={group.status === "active" ? "success" : "neutral"}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatVND(group.contribution_amount)}/chân ·{" "}
                    {groupShares.length} chân · đã hốt {won}
                  </p>

                  {performance && (
                    <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() =>
                          setExpandedGroupId(expanded ? null : group.id)
                        }
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            Hiệu quả thăm hiện tại
                          </p>
                          <MoneyValue
                            amount={Math.abs(performance.performanceAmount)}
                            prefix={performance.performanceAmount < 0 ? "−" : performance.performanceAmount > 0 ? "+" : ""}
                            tone={performance.performanceAmount < 0 ? "pay" : performance.performanceAmount > 0 ? "collect" : "neutral"}
                            className="mt-0.5 block max-w-full overflow-x-auto"
                          />
                          {performance.liveShares > 0 && (
                            <p className="mt-0.5 text-xs text-muted-foreground">Tạm tính theo kỳ hiện tại</p>
                          )}
                        </div>
                        <span className="text-xs font-medium text-primary">
                          {expanded ? "Thu gọn" : "Xem chi tiết"}
                        </span>
                      </button>

                      {expanded && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <span className="text-muted-foreground">
                              Đã hưởng thăm
                            </span>
                            <span className="text-right font-medium">
                              {formatVND(performance.benefitAmount)}
                            </span>
                            <span className="text-muted-foreground">
                              Chi phí khi hốt
                            </span>
                            <span className="text-right font-medium">
                              {formatVND(performance.costAmount)}
                            </span>
                          </div>

                          {performance.shares.map((share) => (
                            <div
                              key={share.shareId}
                              className="rounded-md border bg-background p-3 text-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold">
                                  Chân #{share.shareNumber}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {share.hasWon
                                    ? `Đã hốt kỳ ${share.wonPeriodNumber}`
                                    : "Chân sống · tạm tính"}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                <span className="text-muted-foreground">
                                  Đã hưởng thăm
                                </span>
                                <span className="text-right">
                                  {formatVND(share.benefitAmount)}
                                </span>
                                <span className="text-muted-foreground">
                                  Chi phí khi hốt
                                </span>
                                <span className="text-right">
                                  {formatVND(share.costAmount)}
                                </span>
                                <span className="font-medium">Hiệu quả</span>
                                <span
                                  className={`text-right font-bold ${
                                    share.performanceAmount < 0
                                      ? "text-destructive"
                                      : share.performanceAmount > 0
                                        ? "text-primary"
                                        : ""
                                  }`}
                                >
                                  {formatVND(share.performanceAmount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader title="Phiếu gần đây" icon={ReceiptText} />

          {receipts.length === 0 ? (
            <EmptyState icon={ReceiptText} title="Chưa có phiếu nào" />
          ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {receipts.slice(0, 12).map((receipt) => {
              const activePayments = payments.filter(
                (payment) =>
                  payment.receipt_id === receipt.id &&
                  payment.status === "active",
              )
              const actuallyCollected = activePayments
                .filter((payment) => payment.direction === "collect")
                .reduce((sum, payment) => sum + Number(payment.amount), 0)
              const actuallyPaid = activePayments
                .filter((payment) => payment.direction === "pay")
                .reduce((sum, payment) => sum + Number(payment.amount), 0)
              const net =
                Number(receipt.source_total_pay || 0) -
                Number(receipt.source_total_receive || 0) +
                Number(receipt.settlement_amount || 0)

              return (
                <Card key={receipt.id} className="p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">
                        {formatDate(receipt.receipt_date)}
                      </p>
                      <StatusBadge
                        label={receipt.status === "paid" ? "Đã thanh toán" : receipt.status === "open" ? "Đang mở" : receipt.status === "cancelled" ? "Đã hủy" : receipt.status}
                        tone={receipt.status === "paid" ? "success" : receipt.status === "cancelled" ? "danger" : "warning"}
                        className="mt-2"
                      />
                    </div>
                    <p className="max-w-[12rem] break-words text-right text-sm font-bold tabular-nums sm:max-w-none">
                      {actuallyCollected > 0
                        ? `Đã đóng ${formatVND(actuallyCollected)}`
                        : actuallyPaid > 0
                          ? `Đã nhận ${formatVND(actuallyPaid)}`
                          : net > 0
                            ? `Phải đóng ${formatVND(net)}`
                            : net < 0
                              ? `Phải nhận ${formatVND(Math.abs(net))}`
                              : "Chưa xác nhận"}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
          )}
        </section>

        <Dialog open={showPin} onOpenChange={setShowPin}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Đổi mã đăng nhập</DialogTitle>
              <DialogDescription>
                Tạo mã PIN mới gồm đúng 4 chữ số.
              </DialogDescription>
            </DialogHeader>
            <ChangePinForm
              onChanged={(message) => {
                setPinMessage(message)
                setPinError("")
                setShowPin(false)
              }}
              onError={setPinError}
            />
            {pinError && (
              <p className="text-sm text-destructive" role="alert">
                {pinError}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </AppPage>
    </div>
  )
}
