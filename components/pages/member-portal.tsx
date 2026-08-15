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
import {
  calculateGroupPerformance,
  getValidPerformancePeriods,
} from "@/lib/hui-performance"
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
  source_period_id: string | null
}

type ReceiptSource = {
  periodId: string
  groupCode: string | null
  groupName: string
  periodNumber: number
  scheduledDate: string
}

type ReceiptSourceContext = {
  kind: "single" | "aggregate" | "legacy"
  sources: ReceiptSource[]
  hasUnknownSource: boolean
}

type PageResult<T> = {
  data: T[] | null
  error: unknown
}

const PAGE_SIZE = 1000
const FILTER_BATCH_SIZE = 100

function chunk<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
) {
  const result: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error

    const rows = data ?? []
    result.push(...rows)
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return result
}

async function fetchRowsByIds<T>(
  ids: string[],
  fetchPage: (
    batchIds: string[],
    from: number,
    to: number,
  ) => PromiseLike<PageResult<T>>,
) {
  const result: T[] = []

  for (const batchIds of chunk(ids, FILTER_BATCH_SIZE)) {
    result.push(
      ...(await fetchAllPages<T>((from, to) =>
        fetchPage(batchIds, from, to),
      )),
    )
  }

  return result
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
  const [groupShares, setGroupShares] = useState<ShareRow[]>([])
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

    try {
      const [memberResult, ownShares, receiptRows] = await Promise.all([
        supabase
          .from("members")
          .select("id, full_name, phone")
          .eq("id", profile.member_id)
          .single(),
        fetchAllPages<ShareRow>((from, to) =>
          supabase
            .from("hui_shares")
            .select("id, group_id, member_id, share_number, status")
            .eq("member_id", profile.member_id)
            .order("id")
            .range(from, to),
        ),
        fetchAllPages<ReceiptRow>((from, to) =>
          supabase
            .from("hui_receipts")
            .select(
              "id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
            )
            .eq("member_id", profile.member_id)
            .order("receipt_date", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to),
        ),
      ])

      if (memberResult.error) throw memberResult.error

      const groupIds = [...new Set(ownShares.map((share) => share.group_id))]
      const receiptIds = receiptRows.map((receipt) => receipt.id)

      const [groupRows, allGroupShares, periodRows, paymentRows] =
        await Promise.all([
          fetchRowsByIds<GroupRow>(groupIds, (ids, from, to) =>
            supabase
              .from("hui_groups")
              .select(
                "id, code, name, contribution_amount, total_shares, status",
              )
              .in("id", ids)
              .order("id")
              .range(from, to),
          ),
          fetchRowsByIds<ShareRow>(groupIds, (ids, from, to) =>
            supabase
              .from("hui_shares")
              .select("id, group_id, member_id, share_number, status")
              .in("group_id", ids)
              .order("id")
              .range(from, to),
          ),
          fetchRowsByIds<PeriodRow>(groupIds, (ids, from, to) =>
            supabase
              .from("hui_periods")
              .select(
                "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, status",
              )
              .in("group_id", ids)
              .order("group_id")
              .order("period_number")
              .range(from, to),
          ),
          fetchRowsByIds<PaymentRow>(receiptIds, (ids, from, to) =>
            supabase
              .from("receipt_payments")
              .select(
                "id, receipt_id, direction, amount, status, source_period_id",
              )
              .in("receipt_id", ids)
              .eq("status", "active")
              .order("id")
              .range(from, to),
          ),
        ])

      setMember((memberResult.data as MemberRow | null) ?? null)
      setShares(ownShares)
      setGroupShares(allGroupShares)
      setGroups(groupRows)
      setPeriods(periodRows)
      setReceipts(receiptRows)
      setPayments(paymentRows)
    } catch (caught) {
      console.error(caught)
      setError("Không thể tải đầy đủ dữ liệu của bạn. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
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
      const allSharesInGroup = groupShares.filter(
        (share) => share.group_id === group.id,
      )
      const groupPeriods = periods.filter((period) => period.group_id === group.id)
      const performance = calculateGroupPerformance(
        allSharesInGroup,
        groupPeriods,
      )

      map.set(
        group.id,
        performance.members.find((item) => item.memberId === profile.member_id) ??
          null,
      )
    }

    return map
  }, [groupShares, groups, periods, profile.member_id])

  const receiptSourcesById = useMemo(() => {
    const groupById = new Map(groups.map((group) => [group.id, group]))
    const periodById = new Map(periods.map((period) => [period.id, period]))
    const paymentsByReceipt = new Map<string, PaymentRow[]>()

    for (const payment of payments) {
      const current = paymentsByReceipt.get(payment.receipt_id) ?? []
      current.push(payment)
      paymentsByReceipt.set(payment.receipt_id, current)
    }

    const result = new Map<string, ReceiptSourceContext>()

    for (const receipt of receipts) {
      const receiptPayments = paymentsByReceipt.get(receipt.id) ?? []
      let hasUnknownSource = receiptPayments.length === 0
      const sourceByPeriodId = new Map<string, ReceiptSource>()

      for (const payment of receiptPayments) {
        if (!payment.source_period_id) {
          hasUnknownSource = true
          continue
        }

        const period = periodById.get(payment.source_period_id)
        const group = period ? groupById.get(period.group_id) : null
        if (!period || !group) {
          hasUnknownSource = true
          continue
        }

        sourceByPeriodId.set(period.id, {
          periodId: period.id,
          groupCode: group.code,
          groupName: group.name,
          periodNumber: period.period_number,
          scheduledDate: period.scheduled_date,
        })
      }

      const sources = [...sourceByPeriodId.values()].sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) ||
          a.periodNumber - b.periodNumber,
      )
      const kind =
        sources.length === 0
          ? "legacy"
          : sources.length === 1 && !hasUnknownSource
            ? "single"
            : "aggregate"

      result.set(receipt.id, { kind, sources, hasUnknownSource })
    }

    return result
  }, [groups, payments, periods, receipts])

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
              const memberGroupShares = shares.filter(
                (share) => share.group_id === group.id,
              )
              if (memberGroupShares.length === 0) return null

              const groupPeriods = periods.filter(
                (period) => period.group_id === group.id,
              )
              const validPeriods = getValidPerformancePeriods(groupPeriods)
              const latestValidPeriod = validPeriods.at(-1)?.period_number ?? 0
              const totalPeriods = groupPeriods.length
              const periodProgress = validPeriods.length
                ? `Đã khui đến kỳ ${latestValidPeriod}/${totalPeriods}`
                : totalPeriods > 0
                  ? `Chưa khui · 0/${totalPeriods} kỳ`
                  : "Chưa có lịch kỳ"
              const ownIds = new Set(
                memberGroupShares.map((share) => share.id),
              )
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
                    {memberGroupShares.length} chân · đã hốt {won}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {periodProgress}
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
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {validPeriods.length
                                ? `Tạm tính đến hết kỳ ${latestValidPeriod}/${totalPeriods}`
                                : "Chưa có kỳ đã khui để tính"}
                            </p>
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
              const sourceContext = receiptSourcesById.get(receipt.id) ?? {
                kind: "legacy" as const,
                sources: [],
                hasUnknownSource: true,
              }

              return (
                <Card key={receipt.id} className="p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      {sourceContext.kind === "single" ? (
                        <>
                          <p className="break-words font-bold">
                            {sourceContext.sources[0].groupCode || "Chưa có mã"}
                            {" · "}
                            {sourceContext.sources[0].groupName}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Kỳ {sourceContext.sources[0].periodNumber} ·{" "}
                            {formatDate(
                              sourceContext.sources[0].scheduledDate,
                            )}
                          </p>
                        </>
                      ) : sourceContext.kind === "aggregate" ? (
                        <>
                          <p className="font-bold">Phiếu tổng hợp</p>
                          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {sourceContext.sources.map((source) => (
                              <p key={source.periodId} className="break-words">
                                {source.groupCode || source.groupName} · Kỳ{" "}
                                {source.periodNumber} ·{" "}
                                {formatDate(source.scheduledDate)}
                              </p>
                            ))}
                            {sourceContext.hasUnknownSource && (
                              <p>Dữ liệu cũ chưa xác định dây/kỳ</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="font-bold">
                            Dữ liệu cũ chưa xác định dây/kỳ
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Ngày phiếu: {formatDate(receipt.receipt_date)}
                          </p>
                        </>
                      )}
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
