"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  CheckCheck,
  Coins,
  LoaderCircle,
  RefreshCw,
  Search,
  Users,
  WalletCards,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  fee_amount: number
  status: string
}

type ShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
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

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type ReceiptRow = {
  id: string
  member_id: string
  receipt_date: string
  settlement_amount: number
  status: string
}

type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  status: "active" | "cancelled"
  source_period_id: string | null
  created_at: string
}

type MemberBalance = {
  member: MemberRow
  shouldCollect: number
  collected: number
  remainCollect: number
  shouldPay: number
  paid: number
  remainPay: number
  actualNet: number
  pendingNet: number
  receiptCount: number
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function firstDayOfMonth(dateText: string) {
  const [year, month] = dateText.split("-")
  return `${year}-${month}-01`
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

function calculatePeriodMemberNets(
  period: PeriodRow,
  group: GroupRow,
  groupShares: ShareRow[],
  groupPeriods: PeriodRow[],
) {
  const previousWinnerIds = new Set(
    groupPeriods
      .filter(
        (item) =>
          item.period_number < period.period_number &&
          isCompleted(item.status) &&
          item.winner_share_id,
      )
      .map((item) => item.winner_share_id as string),
  )

  const contribution = Number(group.contribution_amount || 0)
  const bid = Number(period.bid_amount || 0)
  const liveContribution = Math.max(0, contribution - bid)
  const amountByShare = new Map<string, number>()
  let potBeforeFee = 0

  for (const share of groupShares) {
    if (share.id === period.winner_share_id) {
      amountByShare.set(share.id, 0)
      continue
    }

    const amount = previousWinnerIds.has(share.id)
      ? contribution
      : liveContribution

    amountByShare.set(share.id, amount)
    potBeforeFee += amount
  }

  const winnerShare = groupShares.find(
    (share) => share.id === period.winner_share_id,
  )
  const winnerMemberId = winnerShare?.member_id ?? null
  const fee = Number(period.fee_amount ?? group.fee_amount ?? 0)
  // Tổng hốt hụi là toàn bộ tiền đóng của các chân còn lại.
  const huiAmount = Math.max(0, potBeforeFee)
  // Nghĩa vụ thực chi của chủ hụi = tổng hốt hụi - tiền thảo.
  const winnerReceive = Math.max(0, huiAmount - fee)
  const memberIds = new Set(groupShares.map((share) => share.member_id))
  const result = new Map<string, number>()

  for (const memberId of memberIds) {
    const memberShares = groupShares.filter(
      (share) => share.member_id === memberId,
    )
    let memberPay = 0

    for (const share of memberShares) {
      if (share.id === period.winner_share_id) continue
      memberPay += amountByShare.get(share.id) ?? 0
    }

    const memberReceive = memberId === winnerMemberId ? winnerReceive : 0
    result.set(memberId, memberPay - memberReceive)
  }

  return result
}

export function CanDoiPage() {
  const today = todayInVietnam()
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth(today))
  const [dateTo, setDateTo] = useState(today)
  const [query, setQuery] = useState("")
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [bulkWorkingPeriodId, setBulkWorkingPeriodId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()
    const [
      groupsResult,
      sharesResult,
      periodsResult,
      membersResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("hui_groups")
        .select("id, code, name, contribution_amount, total_shares, fee_amount, status"),
      supabase
        .from("hui_shares")
        .select("id, group_id, member_id, share_number, status")
        .order("share_number"),
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, fee_amount, status",
        )
        .order("period_number"),
      supabase.from("members").select("id, full_name, phone"),
      supabase
        .from("hui_receipts")
        .select("id, member_id, receipt_date, settlement_amount, status"),
      supabase
        .from("receipt_payments")
        .select("id, receipt_id, direction, amount, status, source_period_id, created_at"),
    ])

    const firstError =
      groupsResult.error ??
      sharesResult.error ??
      periodsResult.error ??
      membersResult.error ??
      receiptsResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError(
        "Không thể tải bảng cân đối. Hãy kiểm tra bạn đã chạy SQL tạo bảng phiếu/thanh toán.",
      )
      setLoading(false)
      return
    }

    setGroups((groupsResult.data ?? []) as GroupRow[])
    setShares((sharesResult.data ?? []) as ShareRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setMembers((membersResult.data ?? []) as MemberRow[])
    setReceiptRows((receiptsResult.data ?? []) as ReceiptRow[])
    setPayments((paymentsResult.data ?? []) as PaymentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const balances = useMemo(() => {
    const activeGroups = groups.filter((group) => group.status === "active")
    const groupsById = new Map(activeGroups.map((group) => [group.id, group]))
    const membersById = new Map(members.map((member) => [member.id, member]))
    const sharesByGroup = new Map<string, ShareRow[]>()
    const periodsByGroup = new Map<string, PeriodRow[]>()

    for (const share of shares) {
      const list = sharesByGroup.get(share.group_id) ?? []
      list.push(share)
      sharesByGroup.set(share.group_id, list)
    }

    for (const period of periods) {
      const list = periodsByGroup.get(period.group_id) ?? []
      list.push(period)
      periodsByGroup.set(period.group_id, list)
    }

    const obligationByMemberDate = new Map<
      string,
      { memberId: string; date: string; net: number }
    >()

    const rangePeriods = periods.filter(
      (period) =>
        isCompleted(period.status) &&
        groupsById.has(period.group_id) &&
        period.scheduled_date >= dateFrom &&
        period.scheduled_date <= dateTo,
    )

    for (const period of rangePeriods) {
      const group = groupsById.get(period.group_id)
      if (!group || !period.winner_share_id) continue

      const groupShares = (sharesByGroup.get(group.id) ?? []).filter(
        (share) =>
          share.status === "active" || share.id === period.winner_share_id,
      )
      const groupPeriods = periodsByGroup.get(group.id) ?? []
      const memberNets = calculatePeriodMemberNets(
        period,
        group,
        groupShares,
        groupPeriods,
      )

      for (const [memberId, net] of memberNets.entries()) {
        if (!membersById.has(memberId)) continue

        const key = `${memberId}|${period.scheduled_date}`
        const current = obligationByMemberDate.get(key)

        obligationByMemberDate.set(key, {
          memberId,
          date: period.scheduled_date,
          net: (current?.net ?? 0) + net,
        })
      }
    }

    // Các điều chỉnh/tất toán đã lưu trên phiếu được cộng vào nghĩa vụ của đúng ngày.
    for (const receipt of receiptRows) {
      if (
        receipt.status === "cancelled" ||
        receipt.receipt_date < dateFrom ||
        receipt.receipt_date > dateTo
      ) {
        continue
      }

      const settlement = Number(receipt.settlement_amount || 0)
      if (!settlement) continue

      const key = `${receipt.member_id}|${receipt.receipt_date}`
      const current = obligationByMemberDate.get(key)

      obligationByMemberDate.set(key, {
        memberId: receipt.member_id,
        date: receipt.receipt_date,
        net: (current?.net ?? 0) + settlement,
      })
    }

    const receiptsInRange = receiptRows.filter(
      (receipt) =>
        receipt.status !== "cancelled" &&
        receipt.receipt_date >= dateFrom &&
        receipt.receipt_date <= dateTo,
    )
    const receiptById = new Map(
      receiptsInRange.map((receipt) => [receipt.id, receipt]),
    )
    const paymentTotals = new Map<
      string,
      { collected: number; paid: number }
    >()

    for (const payment of payments) {
      if (payment.status !== "active") continue
      const receipt = receiptById.get(payment.receipt_id)
      if (!receipt) continue

      const current = paymentTotals.get(receipt.member_id) ?? {
        collected: 0,
        paid: 0,
      }

      if (payment.direction === "collect") {
        current.collected += Number(payment.amount || 0)
      } else {
        current.paid += Number(payment.amount || 0)
      }

      paymentTotals.set(receipt.member_id, current)
    }

    const obligationsByMember = new Map<
      string,
      { shouldCollect: number; shouldPay: number; receiptCount: number }
    >()

    for (const item of obligationByMemberDate.values()) {
      const current = obligationsByMember.get(item.memberId) ?? {
        shouldCollect: 0,
        shouldPay: 0,
        receiptCount: 0,
      }

      if (item.net > 0) current.shouldCollect += item.net
      if (item.net < 0) current.shouldPay += Math.abs(item.net)
      current.receiptCount += 1

      obligationsByMember.set(item.memberId, current)
    }

    const memberIds = new Set([
      ...obligationsByMember.keys(),
      ...paymentTotals.keys(),
    ])

    const result: MemberBalance[] = []

    for (const memberId of memberIds) {
      const member = membersById.get(memberId)
      if (!member) continue

      const obligation = obligationsByMember.get(memberId) ?? {
        shouldCollect: 0,
        shouldPay: 0,
        receiptCount: 0,
      }
      const actual = paymentTotals.get(memberId) ?? {
        collected: 0,
        paid: 0,
      }

      const remainCollect = Math.max(
        0,
        obligation.shouldCollect - actual.collected,
      )
      const remainPay = Math.max(0, obligation.shouldPay - actual.paid)

      result.push({
        member,
        shouldCollect: obligation.shouldCollect,
        collected: actual.collected,
        remainCollect,
        shouldPay: obligation.shouldPay,
        paid: actual.paid,
        remainPay,
        actualNet: actual.collected - actual.paid,
        pendingNet: remainCollect - remainPay,
        receiptCount: obligation.receiptCount,
      })
    }

    return result.sort((a, b) => {
      const aPending = a.remainCollect + a.remainPay
      const bPending = b.remainCollect + b.remainPay
      if (aPending !== bPending) return bPending - aPending
      return a.member.full_name.localeCompare(b.member.full_name, "vi")
    })
  }, [
    dateFrom,
    dateTo,
    groups,
    members,
    payments,
    periods,
    receiptRows,
    shares,
  ])


  const quickPeriods = useMemo(() => {
    const activeGroups = groups.filter((group) => group.status === "active")
    const groupsById = new Map(activeGroups.map((group) => [group.id, group]))
    const receiptsById = new Map(receiptRows.map((receipt) => [receipt.id, receipt]))
    const groupPeriodsMap = new Map<string, PeriodRow[]>()
    const groupSharesMap = new Map<string, ShareRow[]>()

    for (const period of periods) {
      const list = groupPeriodsMap.get(period.group_id) ?? []
      list.push(period)
      groupPeriodsMap.set(period.group_id, list)
    }

    for (const share of shares) {
      const list = groupSharesMap.get(share.group_id) ?? []
      list.push(share)
      groupSharesMap.set(share.group_id, list)
    }

    return periods
      .filter(
        (period) =>
          isCompleted(period.status) &&
          period.winner_share_id &&
          groupsById.has(period.group_id) &&
          period.scheduled_date >= dateFrom &&
          period.scheduled_date <= dateTo,
      )
      .map((period) => {
        const group = groupsById.get(period.group_id)
        if (!group) return null

        const groupShares = (groupSharesMap.get(group.id) ?? []).filter(
          (share) =>
            share.status === "active" || share.id === period.winner_share_id,
        )
        const groupPeriods = groupPeriodsMap.get(group.id) ?? []
        const memberNets = calculatePeriodMemberNets(
          period,
          group,
          groupShares,
          groupPeriods,
        )

        const expected = [...memberNets.entries()].filter(([, net]) => net !== 0)
        const settled = expected.length > 0 && expected.every(([memberId, net]) => {
          const receipt = receiptRows.find(
            (row) =>
              row.member_id === memberId &&
              row.receipt_date === period.scheduled_date &&
              row.status !== "cancelled",
          )
          if (!receipt) return false

          const direction = net > 0 ? "collect" : "pay"
          return payments.some(
            (payment) =>
              payment.receipt_id === receipt.id &&
              payment.source_period_id === period.id &&
              payment.status === "active" &&
              payment.direction === direction &&
              Number(payment.amount) === Math.abs(net),
          )
        })

        const winnerShare = groupShares.find(
          (share) => share.id === period.winner_share_id,
        )
        const winner = winnerShare
          ? members.find((member) => member.id === winnerShare.member_id)
          : null

        return {
          period,
          group,
          memberNets,
          settled,
          winnerName: winner?.full_name ?? "Không rõ",
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0
        const dateCompare = b.period.scheduled_date.localeCompare(
          a.period.scheduled_date,
        )
        if (dateCompare !== 0) return dateCompare
        return b.period.period_number - a.period.period_number
      }) as Array<{
        period: PeriodRow
        group: GroupRow
        memberNets: Map<string, number>
        settled: boolean
        winnerName: string
      }>
  }, [dateFrom, dateTo, groups, members, payments, periods, receiptRows, shares])

  async function settleWholePeriod(
    item: (typeof quickPeriods)[number],
  ) {
    if (item.settled) return

    const expected = [...item.memberNets.entries()].filter(([, net]) => net !== 0)
    if (expected.length === 0) {
      window.alert("Kỳ này không có khoản thu/chi để xác nhận.")
      return
    }

    const ok = window.confirm(
      `Đánh dấu ĐÃ THU/CHI ĐỦ toàn bộ kỳ ${item.period.period_number} của ${item.group.name} ngày ${item.period.scheduled_date}?\n\nThao tác này sẽ ghi nhận đủ tiền cho tất cả hụi viên của riêng kỳ này.`,
    )
    if (!ok) return

    setBulkWorkingPeriodId(item.period.id)
    setError("")

    try {
      const supabase = createClient()

      for (const [memberId, net] of expected) {
        const direction = net > 0 ? "collect" : "pay"
        const amount = Math.abs(net)

        const { data: receipt, error: receiptError } = await supabase
          .from("hui_receipts")
          .upsert(
            {
              member_id: memberId,
              receipt_date: item.period.scheduled_date,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "member_id,receipt_date" },
          )
          .select("id, status")
          .single()

        if (receiptError || !receipt) throw receiptError

        if (receipt.status === "cancelled") {
          const { error: reopenError } = await supabase
            .from("hui_receipts")
            .update({
              status: "open",
              cancelled_at: null,
              cancel_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", receipt.id)

          if (reopenError) throw reopenError
        }

        const { data: oldPayments, error: oldPaymentsError } = await supabase
          .from("receipt_payments")
          .select("id, direction, amount, status")
          .eq("receipt_id", receipt.id)
          .eq("source_period_id", item.period.id)
          .eq("status", "active")

        if (oldPaymentsError) throw oldPaymentsError

        const exact = (oldPayments ?? []).find(
          (payment) =>
            payment.direction === direction &&
            Number(payment.amount) === amount,
        )

        if (exact && (oldPayments ?? []).length === 1) {
          continue
        }

        if ((oldPayments ?? []).length > 0) {
          const ids = (oldPayments ?? []).map((payment) => payment.id)
          const { error: cancelOldError } = await supabase
            .from("receipt_payments")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              cancel_reason: "Cập nhật lại dữ liệu chốt nhanh của kỳ",
              updated_at: new Date().toISOString(),
            })
            .in("id", ids)

          if (cancelOldError) throw cancelOldError
        }

        const { error: paymentError } = await supabase
          .from("receipt_payments")
          .insert({
            receipt_id: receipt.id,
            direction,
            amount,
            method: "other",
            note: `Dữ liệu cũ - xác nhận đủ kỳ ${item.period.period_number} - ${item.group.name}`,
            source_period_id: item.period.id,
          })

        if (paymentError) throw paymentError
      }

      await supabase.from("audit_logs").insert({
        entity_type: "hui_period",
        entity_id: item.period.id,
        action: "bulk_settle_period",
        after_data: {
          group_id: item.group.id,
          period_number: item.period.period_number,
          scheduled_date: item.period.scheduled_date,
          member_count: expected.length,
        },
        reason: "Đánh dấu dữ liệu cũ đã thu/chi đủ theo kỳ",
      })

      await loadData()
    } catch (caught) {
      console.error(caught)
      setError(
        "Không thể đánh dấu kỳ đã thu/chi đủ. Kiểm tra bạn đã chạy SQL bổ sung source_period_id.",
      )
    } finally {
      setBulkWorkingPeriodId(null)
    }
  }


  const feeSummary = useMemo(() => {
    const activeGroups = groups.filter((group) => group.status === "active")
    const groupsById = new Map(activeGroups.map((group) => [group.id, group]))

    const items = periods
      .filter(
        (period) =>
          isCompleted(period.status) &&
          period.winner_share_id &&
          groupsById.has(period.group_id) &&
          period.scheduled_date >= dateFrom &&
          period.scheduled_date <= dateTo,
      )
      .map((period) => {
        const group = groupsById.get(period.group_id)
        const fee = Number(period.fee_amount ?? group?.fee_amount ?? 0)

        return {
          period,
          groupId: period.group_id,
          groupCode: group?.code ?? "",
          groupName: group?.name ?? "Không rõ dây",
          fee,
        }
      })
      .sort((a, b) => {
        const byDate = a.period.scheduled_date.localeCompare(
          b.period.scheduled_date,
        )
        if (byDate !== 0) return byDate
        return a.period.period_number - b.period.period_number
      })

    let cumulativeFee = 0
    const itemsWithCumulative = items.map((item) => {
      cumulativeFee += item.fee
      return { ...item, cumulativeFee }
    })

    const groupMap = new Map<
      string,
      { groupCode: string; groupName: string; periodCount: number; totalFee: number }
    >()

    for (const item of items) {
      const current = groupMap.get(item.groupId) ?? {
        groupCode: item.groupCode,
        groupName: item.groupName,
        periodCount: 0,
        totalFee: 0,
      }
      current.periodCount += 1
      current.totalFee += item.fee
      groupMap.set(item.groupId, current)
    }

    return {
      items: [...itemsWithCumulative].reverse(),
      totalFee: items.reduce((sum, item) => sum + item.fee, 0),
      byGroup: [...groupMap.values()].sort(
        (a, b) => b.totalFee - a.totalFee,
      ),
    }
  }, [dateFrom, dateTo, groups, periods])


  const activeGroupSummary = useMemo(() => {
    const activeGroups = groups
      .filter((group) => group.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))

    return activeGroups.map((group) => {
      const groupPeriods = periods.filter(
        (period) =>
          period.group_id === group.id &&
          isCompleted(period.status) &&
          period.scheduled_date >= dateFrom &&
          period.scheduled_date <= dateTo,
      )

      const fee = groupPeriods.reduce(
        (sum, period) =>
          sum + Number(period.fee_amount ?? group.fee_amount ?? 0),
        0,
      )

      const paymentReceiptIds = new Set(
        receiptRows
          .filter(
            (receipt) =>
              receipt.status !== "cancelled" &&
              receipt.receipt_date >= dateFrom &&
              receipt.receipt_date <= dateTo,
          )
          .map((receipt) => receipt.id),
      )

      const periodIds = new Set(groupPeriods.map((period) => period.id))
      let collected = 0
      let paid = 0

      for (const payment of payments) {
        if (
          payment.status !== "active" ||
          !paymentReceiptIds.has(payment.receipt_id) ||
          !payment.source_period_id ||
          !periodIds.has(payment.source_period_id)
        ) {
          continue
        }

        if (payment.direction === "collect") {
          collected += Number(payment.amount || 0)
        } else {
          paid += Number(payment.amount || 0)
        }
      }

      return {
        group,
        completedPeriods: groupPeriods.length,
        fee,
        collected,
        paid,
        cashNet: collected - paid,
      }
    })
  }, [dateFrom, dateTo, groups, payments, periods, receiptRows])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    if (!normalized) return balances

    return balances.filter((item) => {
      return (
        item.member.full_name.toLocaleLowerCase("vi").includes(normalized) ||
        (item.member.phone ?? "").includes(normalized)
      )
    })
  }, [balances, query])

  const totals = useMemo(
    () =>
      balances.reduce(
        (sum, item) => ({
          shouldCollect: sum.shouldCollect + item.shouldCollect,
          collected: sum.collected + item.collected,
          remainCollect: sum.remainCollect + item.remainCollect,
          shouldPay: sum.shouldPay + item.shouldPay,
          paid: sum.paid + item.paid,
          remainPay: sum.remainPay + item.remainPay,
        }),
        {
          shouldCollect: 0,
          collected: 0,
          remainCollect: 0,
          shouldPay: 0,
          paid: 0,
          remainPay: 0,
        },
      ),
    [balances],
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tính bảng cân đối...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
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

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2">
          <WalletCards className="size-5" />
          <h1 className="text-xl font-bold">Cân đối tiền hụi</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          So sánh tiền phải thu/chi theo kỳ hụi với tiền đã xác nhận thực tế.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Từ ngày
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Đến ngày
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>

          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        </div>
      </Card>



      <Card className="p-4">
        <div>
          <h2 className="font-bold">Các dây đang hoạt động</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chỉ hiển thị dây đang hoạt động. Dây đã đóng/kết thúc không đưa vào
            bảng cân đối hiện tại.
          </p>
        </div>

        {activeGroupSummary.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Không có dây nào đang hoạt động.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {activeGroupSummary.map((item) => (
              <div
                key={item.group.id}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold">
                    {item.group.code || "CHƯA-MÃ"}
                  </span>
                  <p className="font-semibold">{item.group.name}</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <Metric
                    label="Kỳ đã chốt"
                    value={String(item.completedPeriods)}
                  />
                  <Metric
                    label="Đã thu"
                    value={formatVND(item.collected)}
                  />
                  <Metric
                    label="Đã chi"
                    value={formatVND(item.paid)}
                  />
                  <Metric
                    label="Tiền thảo"
                    value={formatVND(item.fee)}
                  />
                  <Metric
                    label="Tiền thực giữ"
                    value={formatVND(item.cashNet)}
                    emphasize
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCheck className="size-5" />
              <h2 className="font-bold">Chốt nhanh dữ liệu cũ theo kỳ</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Dùng cho các kỳ cũ mà bạn chắc chắn đã thu đủ và chi đủ.
              Mỗi kỳ chỉ được ghi nhận một lần.
            </p>
          </div>
        </div>

        {quickPeriods.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Không có kỳ đã chốt trong khoảng ngày đang chọn.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {quickPeriods.map((item) => (
              <div
                key={item.period.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold">
                      {item.group.code || "CHƯA-MÃ"}
                    </span>
                    <p className="font-semibold">
                      {item.group.name} · Kỳ {item.period.period_number}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.period.scheduled_date} · Hốt: {item.winnerName} ·
                    Giá thăm {formatVND(item.period.bid_amount)}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={item.settled ? "outline" : "default"}
                  disabled={
                    item.settled ||
                    bulkWorkingPeriodId === item.period.id
                  }
                  onClick={() => void settleWholePeriod(item)}
                  className="shrink-0"
                >
                  {bulkWorkingPeriodId === item.period.id ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <CheckCheck className="size-4" />
                  )}
                  {item.settled ? "Kỳ đã thu/chi đủ" : "Đã thu/chi đủ kỳ"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Nút này ghi nhận cả phía thu và phía chi của riêng kỳ được chọn.
          Chủ hụi/admin nếu có chân trong dây vẫn được tính như hụi viên bình thường.
          Không dùng nút này cho kỳ còn nợ hoặc còn thiếu tiền.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="size-5" />
            <h2 className="font-bold">Tiền phải thu</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric
              label="Phải thu"
              value={formatVND(totals.shouldCollect)}
            />
            <Metric label="Đã thu" value={formatVND(totals.collected)} />
            <Metric
              label="Còn thu"
              value={formatVND(totals.remainCollect)}
              emphasize
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="size-5" />
            <h2 className="font-bold">Tiền phải chi</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Metric label="Phải chi" value={formatVND(totals.shouldPay)} />
            <Metric label="Đã chi" value={formatVND(totals.paid)} />
            <Metric
              label="Còn chi"
              value={formatVND(totals.remainPay)}
              emphasize
            />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Tiền thực tế đang giữ"
            value={formatVND(totals.collected - totals.paid)}
            emphasize
          />
          <Metric
            label="Còn phải thu ròng"
            value={formatVND(
              Math.max(0, totals.remainCollect - totals.remainPay),
            )}
          />
          <Metric
            label="Còn phải chi ròng"
            value={formatVND(
              Math.max(0, totals.remainPay - totals.remainCollect),
            )}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          “Tiền thực tế đang giữ” ở đây chỉ tính các giao dịch đã bấm xác nhận
          thu/chi trong app. Nó chưa bao gồm tiền ngoài hệ thống hoặc số dư tiền
          mặt đầu kỳ.
        </p>
      </Card>


      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Coins className="size-5" />
          <h2 className="font-bold">Tiền thảo tích lũy của chủ hụi</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Mỗi kỳ đã chốt, tiền thảo được trừ thẳng khỏi tiền giao cho người hốt
          và được cộng dồn vào phần tiền thảo của chủ hụi. Giá thăm không phải
          lợi nhuận của chủ hụi.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Metric
            label="Số kỳ đã chốt"
            value={String(feeSummary.items.length)}
          />
          <Metric
            label="Tổng tiền thảo tích lũy"
            value={formatVND(feeSummary.totalFee)}
            emphasize
          />
        </div>

        {feeSummary.byGroup.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold">Theo từng dây</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {feeSummary.byGroup.map((item) => (
                <div
                  key={item.groupName}
                  className="rounded-md bg-muted/50 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] font-semibold">
                      {item.groupCode || "CHƯA-MÃ"}
                    </span>
                    <p className="font-medium">{item.groupName}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.periodCount} kỳ đã chốt
                  </p>
                  <p className="mt-1 font-bold">{formatVND(item.totalFee)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {feeSummary.items.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold">Chi tiết từng kỳ</p>
            {feeSummary.items.map((item) => (
              <div
                key={item.period.id}
                className="grid grid-cols-[1fr_auto] gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-semibold">
                      {item.groupCode || "CHƯA-MÃ"}
                    </span>
                    <p className="truncate font-medium">
                      {item.groupName} · Kỳ {item.period.period_number}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.period.scheduled_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">+ {formatVND(item.fee)}</p>
                  <p className="text-xs text-muted-foreground">
                    Lũy kế {formatVND(item.cumulativeFee)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <p className="font-semibold">Theo hụi viên</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {balances.length} người có phát sinh trong khoảng ngày
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên hoặc SĐT..."
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarRange className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Không có phát sinh</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Thử chọn khoảng ngày khác hoặc kiểm tra các kỳ hụi đã chốt.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.member.id} className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.member.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.member.phone || "Chưa có SĐT"} ·{" "}
                      {item.receiptCount} ngày có phát sinh
                    </p>
                  </div>

                  <BalanceBadge item={item} />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Metric
                    label="Phải thu"
                    value={formatVND(item.shouldCollect)}
                  />
                  <Metric label="Đã thu" value={formatVND(item.collected)} />
                  <Metric
                    label="Còn thu"
                    value={formatVND(item.remainCollect)}
                    emphasize={item.remainCollect > 0}
                  />
                  <Metric
                    label="Phải chi"
                    value={formatVND(item.shouldPay)}
                  />
                  <Metric label="Đã chi" value={formatVND(item.paid)} />
                  <Metric
                    label="Còn chi"
                    value={formatVND(item.remainPay)}
                    emphasize={item.remainPay > 0}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 text-xs leading-relaxed text-muted-foreground">
        Quy tắc của bảng này không phân biệt quyền tài khoản. Nếu Thảo Phan,
        Tâm hoặc bất kỳ admin nào có chân trong dây hụi, các chân đó được tính
        thu/chi giống hệt mọi hụi viên khác.
      </Card>
    </div>
  )
}

function Metric({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-words text-sm ${
          emphasize ? "font-bold" : "font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function BalanceBadge({ item }: { item: MemberBalance }) {
  if (item.remainCollect > 0 && item.remainPay === 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
        Còn thu {formatVND(item.remainCollect)}
      </span>
    )
  }

  if (item.remainPay > 0 && item.remainCollect === 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
        Còn chi {formatVND(item.remainPay)}
      </span>
    )
  }

  if (item.remainCollect === 0 && item.remainPay === 0) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
        Đã cân
      </span>
    )
  }

  return (
    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
      Có thu & chi
    </span>
  )
}
