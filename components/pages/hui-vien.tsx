"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  WalletCards,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HuiEmptyState,
  HuiPage,
  HuiPageHeader,
  HuiStatCard,
  HuiStatusBadge,
  HuiTableFrame,
  huiTableCellClass,
  huiTableHeadClass,
} from "@/components/hui-design"
import { createClient } from "@/lib/supabase/client"
import { normalizeVietnamPhone } from "@/lib/auth/passcode"
import { formatDate } from "@/components/pages/phieu/utils"
import {
  calculateMemberMoneyByReceipt,
  resolvePeriodTiming,
  type CashFlowLevel,
  type CollectObligation,
  type DerivedMemberObligation,
  type DerivedObligationPeriod,
  type MemberPaymentRow,
  type MemberReceiptRow,
} from "@/components/pages/hui-vien-financials"

export type Member = {
  id: string
  full_name: string
  phone: string | null
  zalo_phone: string | null
  address: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  opening_time: string | null
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
  scheduled_at: string | null
  opened_at: string | null
  winner_share_id: string | null
  bid_amount: number
  fee_amount: number
  status: string
}

type ReceiptRow = MemberReceiptRow

type PaymentRow = MemberPaymentRow

type MemberForm = Omit<Member, "id" | "created_at" | "updated_at">

type GroupMemberStat = {
  group: GroupRow
  totalShares: number
  liveShares: number
  deadShares: number
  futureObligation: number
  completedPeriods: number
}

type StaffRole = "super_admin" | "admin"

type MemberDeletePreflight = {
  member: Pick<Member, "id" | "full_name" | "phone" | "is_active">
  counts: {
    hui_shares: number
    hui_receipts: number
    receipt_payments: number
    receipts: number
    transactions: number
    app_users: number
    profiles: number
  }
  has_business_history: boolean
  has_login_link: boolean
  member_delete_enabled: boolean
  member_delete_blocker: string | null
}

type MemberProfile = {
  member: Member
  groupStats: GroupMemberStat[]
  groupCount: number
  totalShares: number
  liveShares: number
  deadShares: number
  futureObligation: number
  shouldCollect: number
  shouldPay: number
  collected: number
  paid: number
  overdue: number
  totalReceived: number
  totalContributed: number
  cashFlowDifference: number
  cashFlowLevel: CashFlowLevel
  cashFlowReason: string
  collectObligations: CollectObligation[]
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
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: unknown
  }>,
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

async function fetchReceiptsForMemberIds(memberIds: string[]) {
  const supabase = createClient()
  const result: ReceiptRow[] = []

  for (const ids of chunk(memberIds, FILTER_BATCH_SIZE)) {
    result.push(
      ...(await fetchAllPages<ReceiptRow>((from, to) =>
        supabase
          .from("hui_receipts")
          .select(
            "id, member_id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
          )
          .in("member_id", ids)
          .order("id", { ascending: true })
          .range(from, to),
      )),
    )
  }

  return result
}

async function fetchActivePaymentsForReceiptIds(receiptIds: string[]) {
  const supabase = createClient()
  const result: PaymentRow[] = []

  for (const ids of chunk(receiptIds, FILTER_BATCH_SIZE)) {
    result.push(
      ...(await fetchAllPages<PaymentRow>((from, to) =>
        supabase
          .from("receipt_payments")
          .select(
            "id, receipt_id, direction, amount, status, source_period_id",
          )
          .in("receipt_id", ids)
          .eq("status", "active")
          .order("id", { ascending: true })
          .range(from, to),
      )),
    )
  }

  return result
}

const EMPTY_FORM: MemberForm = {
  full_name: "",
  phone: "",
  zalo_phone: "",
  address: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  notes: "",
  is_active: true,
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatSignedVND(value: number) {
  if (value > 0) return `+${formatVND(value)}`
  if (value < 0) return `−${formatVND(Math.abs(value))}`
  return formatVND(0)
}

function formatVietnamDateTime(value: number) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).format(new Date(value))
}

function formatProfileDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật"

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function getMemberCardContactLines(member: Member) {
  const phone = member.phone?.trim() ?? ""
  const zalo = member.zalo_phone?.trim() ?? ""

  if (!phone && !zalo) return ["Chưa có thông tin liên hệ"]
  if (phone && !zalo) return [phone]
  if (!phone && zalo) return [`Zalo: ${zalo}`]

  return [phone, phone === zalo ? "Zalo: cùng số" : `Zalo: ${zalo}`]
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
  const fee = Number(period.fee_amount || 0)
  // Tổng hốt hụi là toàn bộ tiền đóng của các chân còn lại.
  const huiAmount = Math.max(0, potBeforeFee)
  // Số thực nhận của người hốt = tổng hốt hụi - tiền thảo.
  const winnerReceive = Math.max(0, huiAmount - fee)
  const result = new Map<string, number>()

  for (const memberId of new Set(groupShares.map((share) => share.member_id))) {
    let memberPay = 0
    for (const share of groupShares.filter(
      (share) => share.member_id === memberId,
    )) {
      if (share.id === period.winner_share_id) continue
      memberPay += amountByShare.get(share.id) ?? 0
    }

    const memberReceive = memberId === winnerMemberId ? winnerReceive : 0
    result.set(memberId, memberPay - memberReceive)
  }

  return result
}

function cashFlowMeta(level: CashFlowLevel) {
  if (level === "alarm") {
    return {
      label: "Báo động",
      Icon: ShieldAlert,
      tone: "danger" as const,
    }
  }
  if (level === "high") {
    return {
      label: "Rủi ro cao",
      Icon: AlertTriangle,
      tone: "warning" as const,
    }
  }
  if (level === "watch") {
    return {
      label: "Cần chú ý",
      Icon: AlertTriangle,
      tone: "warning" as const,
    }
  }
  if (level === "good") {
    return {
      label: "Tốt",
      Icon: ShieldCheck,
      tone: "success" as const,
    }
  }
  return {
    label: "Bình thường",
    Icon: ShieldCheck,
    tone: "info" as const,
  }
}

export function HuiVienPage({ currentRole }: { currentRole: StaffRole }) {
  const [members, setMembers] = useState<Member[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Member | null | undefined>(undefined)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<Member | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [message, setMessage] = useState("")
  const [clockMs, setClockMs] = useState(() => Date.now())

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    const supabase = createClient()

    try {
      const [memberRows, groupRows, shareRows, periodRows] = await Promise.all([
        fetchAllPages<Member>((from, to) =>
          supabase
            .from("members")
            .select(
              "id, full_name, phone, zalo_phone, address, bank_name, bank_account_number, bank_account_name, notes, is_active, created_at, updated_at",
            )
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<GroupRow>((from, to) =>
          supabase
            .from("hui_groups")
            .select(
              "id, code, name, contribution_amount, total_shares, opening_time, status",
            )
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<ShareRow>((from, to) =>
          supabase
            .from("hui_shares")
            .select("id, group_id, member_id, share_number, status")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<PeriodRow>((from, to) =>
          supabase
            .from("hui_periods")
            .select(
              "id, group_id, period_number, scheduled_date, scheduled_at, opened_at, winner_share_id, bid_amount, fee_amount, status",
            )
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ])
      const receiptRows = await fetchReceiptsForMemberIds(
        memberRows.map((member) => member.id),
      )
      const paymentRows = await fetchActivePaymentsForReceiptIds(
        receiptRows.map((receipt) => receipt.id),
      )

      setMembers(
        memberRows.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")),
      )
      setGroups(groupRows)
      setShares(shareRows)
      setPeriods(periodRows)
      setReceipts(receiptRows)
      setPayments(paymentRows)
    } catch (caught) {
      console.error(caught)
      setError("Không thể tải đầy đủ dữ liệu hụi viên.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const profiles = useMemo(() => {
    const groupById = new Map(groups.map((group) => [group.id, group]))
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

    const derivedObligationByMemberDate = new Map<
      string,
      DerivedMemberObligation
    >()

    for (const period of periods.filter((period) => isCompleted(period.status))) {
      const group = groupById.get(period.group_id)
      if (!group || !period.winner_share_id) continue

      const groupShares = (sharesByGroup.get(group.id) ?? []).filter(
        (share) =>
          share.status === "active" || share.id === period.winner_share_id,
      )
      const groupPeriods = periodsByGroup.get(group.id) ?? []
      const nets = calculatePeriodMemberNets(
        period,
        group,
        groupShares,
        groupPeriods,
      )
      const timing = resolvePeriodTiming({
        openedAt: period.opened_at,
        scheduledAt: period.scheduled_at,
        scheduledDate: period.scheduled_date,
        openingTime: group.opening_time,
      })

      for (const [memberId, net] of nets.entries()) {
        if (!net) continue
        const receiptKey = `${memberId}|${period.scheduled_date}`
        const current = derivedObligationByMemberDate.get(receiptKey) ?? {
          receiptKey,
          memberId,
          receiptDate: period.scheduled_date,
          expectedNet: 0,
          openedAtMs: timing.openedAtMs,
          deadlineAtMs: timing.deadlineAtMs,
          timingSource: timing.source,
          periods: [],
        }
        current.expectedNet += net
        const periodDetail: DerivedObligationPeriod = {
          periodId: period.id,
          groupId: group.id,
          groupName: group.name,
          periodNumber: period.period_number,
          scheduledDate: period.scheduled_date,
          expectedNet: net,
          openedAtMs: timing.openedAtMs,
          deadlineAtMs: timing.deadlineAtMs,
          timingSource: timing.source,
        }
        current.periods.push(periodDetail)
        if (timing.deadlineAtMs >= current.deadlineAtMs) {
          current.openedAtMs = timing.openedAtMs
          current.deadlineAtMs = timing.deadlineAtMs
          current.timingSource = timing.source
        }
        derivedObligationByMemberDate.set(receiptKey, current)
      }
    }

    const derivedObligations = [...derivedObligationByMemberDate.values()]
    for (const obligation of derivedObligations) {
      obligation.periods.sort(
        (a, b) =>
          a.openedAtMs - b.openedAtMs ||
          a.groupName.localeCompare(b.groupName, "vi") ||
          a.periodNumber - b.periodNumber,
      )
    }
    const moneyByMember = calculateMemberMoneyByReceipt(
      receipts,
      payments,
      derivedObligations,
      clockMs,
    )

    return members.map((member): MemberProfile => {
      const memberShares = shares.filter(
        (share) => share.member_id === member.id && share.status === "active",
      )

      const groupStats: GroupMemberStat[] = []
      let futureObligation = 0
      let liveShares = 0
      let deadShares = 0

      for (const groupId of new Set(memberShares.map((share) => share.group_id))) {
        const group = groupById.get(groupId)
        if (!group) continue

        const theseShares = memberShares.filter(
          (share) => share.group_id === groupId,
        )
        const groupPeriods = (periodsByGroup.get(groupId) ?? []).sort(
          (a, b) => a.period_number - b.period_number,
        )
        const completedPeriods = groupPeriods.filter((period) =>
          isCompleted(period.status),
        )

        let groupLive = 0
        let groupDead = 0
        let groupFuture = 0

        for (const share of theseShares) {
          const wonPeriod = completedPeriods.find(
            (period) => period.winner_share_id === share.id,
          )

          if (wonPeriod) {
            groupDead += 1
            deadShares += 1

            const remainingPeriods = Math.max(
              0,
              group.total_shares - completedPeriods.length,
            )
            groupFuture +=
              remainingPeriods * Number(group.contribution_amount || 0)
          } else {
            groupLive += 1
            liveShares += 1
          }
        }

        futureObligation += groupFuture
        groupStats.push({
          group,
          totalShares: theseShares.length,
          liveShares: groupLive,
          deadShares: groupDead,
          futureObligation: groupFuture,
          completedPeriods: completedPeriods.length,
        })
      }

      const money = moneyByMember.get(member.id) ?? {
        shouldCollect: 0,
        shouldPay: 0,
        collected: 0,
        paid: 0,
        overdue: 0,
        cashFlowDifference: 0,
        cashFlowLevel: "normal" as const,
        collectObligations: [],
      }
      const overdue = money.overdue
      const cashFlowReason =
        money.cashFlowDifference > 0
          ? `Đã đóng nhiều hơn đã nhận ${formatVND(money.cashFlowDifference)}.`
          : money.cashFlowDifference < 0
            ? `Đã nhận nhiều hơn đã đóng ${formatVND(Math.abs(money.cashFlowDifference))}.`
            : "Tổng đã đóng và đã nhận đang cân bằng."

      return {
        member,
        groupStats: groupStats.sort((a, b) =>
          a.group.name.localeCompare(b.group.name, "vi"),
        ),
        groupCount: groupStats.length,
        totalShares: memberShares.length,
        liveShares,
        deadShares,
        futureObligation,
        shouldCollect: money.shouldCollect,
        shouldPay: money.shouldPay,
        collected: money.collected,
        paid: money.paid,
        overdue,
        totalReceived: money.paid,
        totalContributed: money.collected,
        cashFlowDifference: money.cashFlowDifference,
        cashFlowLevel: money.cashFlowLevel,
        cashFlowReason,
        collectObligations: money.collectObligations,
      }
    })
  }, [clockMs, groups, members, payments, periods, receipts, shares])

  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    if (!normalized) return profiles

    return profiles.filter(
      (profile) =>
        profile.member.full_name
          .toLocaleLowerCase("vi")
          .includes(normalized) ||
        (profile.member.phone ?? "").includes(normalized),
    )
  }, [profiles, query])

  const selectedProfile = profiles.find(
    (profile) => profile.member.id === selectedMemberId,
  )

  async function confirmStatusChange() {
    if (!statusTarget || statusSaving) return

    setError("")
    setStatusSaving(true)
    const nextActive = !statusTarget.is_active
    try {
      const { data: updatedMember, error: updateError } = await createClient()
        .from("members")
        .update({
          is_active: nextActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statusTarget.id)
        .eq("is_active", statusTarget.is_active)
        .select(
          "id, full_name, phone, zalo_phone, address, bank_name, bank_account_number, bank_account_name, notes, is_active, created_at, updated_at",
        )
        .maybeSingle()

      if (updateError || !updatedMember) {
        setError(
          updateError
            ? "Không thể xác minh kết quả cập nhật; trạng thái hiển thị được giữ nguyên."
            : "Trạng thái hụi viên đã thay đổi ở phiên khác. Hãy tải lại trước khi thử lại.",
        )
        return
      }

      setMembers((current) =>
        current.map((item) =>
          item.id === statusTarget.id ? (updatedMember as Member) : item,
        ),
      )
      setStatusTarget(null)
    } catch {
      setError(
        "Không thể xác minh kết quả cập nhật; trạng thái hiển thị được giữ nguyên.",
      )
    } finally {
      setStatusSaving(false)
    }
  }

  if (selectedProfile) {
    return (
      <MemberProfilePage
        profile={selectedProfile}
        onBack={() => setSelectedMemberId(null)}
        onEdit={() => setEditing(selectedProfile.member)}
      />
    )
  }

  return (
    <HuiPage wide className="flex flex-col pb-6 md:pb-8">
      <HuiPageHeader
        title="Hụi viên"
        subtitle={`${members.length} người · Theo dõi chân hụi, công nợ và dòng tiền`}
        actions={
          <Button className="h-10 px-4 font-semibold" onClick={() => setEditing(null)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Thêm hụi viên</span>
            <span className="sm:hidden">Thêm</span>
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Tìm hụi viên"
          placeholder="Tìm theo tên hoặc SĐT..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 pl-9"
        />
      </div>

      {error && (
        <Card
          className="flex flex-row items-center justify-between gap-3 rounded-lg border-destructive/30 p-4 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button className="h-9" variant="outline" size="sm" onClick={() => void loadData()}>
            Thử lại
          </Button>
        </Card>
      )}

      {message && (
        <Card
          className="rounded-lg border-success/30 bg-success/10 p-4 text-sm font-medium text-success-foreground"
          role="status"
        >
          {message}
        </Card>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-5 animate-spin" />
          Đang tải hụi viên...
        </div>
      ) : filteredProfiles.length === 0 ? (
        <HuiEmptyState
          icon={UserRound}
          title={query ? "Không tìm thấy hụi viên" : "Chưa có hụi viên"}
          description={
            query
              ? "Thử tìm bằng tên hoặc số điện thoại khác."
              : "Thêm hụi viên đầu tiên để bắt đầu."
          }
          action={
            !query ? (
              <Button className="h-10" onClick={() => setEditing(null)}>
                <Plus className="size-4" /> Thêm hụi viên
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="hidden xl:block">
            <HuiTableFrame>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[19%]" />
                  <col className="w-[18%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                  <col className="w-[35%]" />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      "Họ tên",
                      "Điện thoại / Zalo",
                      "Đánh giá",
                      "Trạng thái",
                      "Thao tác",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className={huiTableHeadClass}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {filteredProfiles.map((profile) => {
                    const member = profile.member
                    const meta = cashFlowMeta(profile.cashFlowLevel)

                    return (
                      <tr
                        key={member.id}
                        className="cursor-pointer transition-colors hover:bg-secondary/70 focus-within:bg-secondary/70"
                        onClick={() => setSelectedMemberId(member.id)}
                      >
                        <td className={`${huiTableCellClass} min-w-0`}>
                          <button
                            className="max-w-full break-words text-left font-bold hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedMemberId(member.id)
                            }}
                          >
                            {member.full_name}
                          </button>
                        </td>

                        <td className={`${huiTableCellClass} min-w-0 text-muted-foreground`}>
                          <div className="min-w-0 break-words">
                            <p>
                              ĐT: {member.phone || "—"}
                            </p>
                            <p className="text-xs">
                              Zalo: {member.zalo_phone || "—"}
                            </p>
                          </div>
                        </td>

                        <td className={huiTableCellClass}>
                          <HuiStatusBadge
                            label={meta.label}
                            icon={meta.Icon}
                            tone={meta.tone}
                          />
                        </td>

                        <td className={huiTableCellClass}>
                          <HuiStatusBadge
                            label={member.is_active ? "Hoạt động" : "Tạm ngưng"}
                            tone={member.is_active ? "success" : "warning"}
                          />
                        </td>

                        <td className={huiTableCellClass}>
                          <div className="flex flex-nowrap items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                setStatusTarget(member)
                              }}
                            >
                              {member.is_active ? (
                                <UserRoundX className="size-4" />
                              ) : (
                                <UserRoundCheck className="size-4" />
                              )}
                              {member.is_active ? "Tạm ngưng" : "Mở lại"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditing(member)
                              }}
                            >
                              <Pencil className="size-4" />
                              Sửa
                            </Button>
                            {currentRole === "super_admin" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setDeleteTarget(member)
                                }}
                              >
                                <Trash2 className="size-4" />
                                Xóa hồ sơ
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </HuiTableFrame>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:hidden">
            {filteredProfiles.map((profile) => {
              const member = profile.member
              const meta = cashFlowMeta(profile.cashFlowLevel)
              const contactLines = getMemberCardContactLines(member)

              return (
                <Card
                  key={member.id}
                  className="gap-0 overflow-hidden rounded-lg p-0"
                >
                  <button
                    type="button"
                    className="flex w-full flex-1 flex-col p-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4"
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-base font-bold">
                          {member.full_name}
                        </p>
                        <div className="mt-0.5 space-y-0.5 text-sm text-muted-foreground">
                          {contactLines.map((line) => (
                            <p
                              key={line}
                              className="break-words [overflow-wrap:anywhere]"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>

                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <HuiStatusBadge
                        label={meta.label}
                        icon={meta.Icon}
                        tone={meta.tone}
                      />

                      <HuiStatusBadge
                        label={member.is_active ? "Hoạt động" : "Tạm ngưng"}
                        tone={member.is_active ? "success" : "warning"}
                      />
                    </div>
                  </button>

                  <div
                    className={`grid gap-1.5 border-t border-border p-3 ${
                      currentRole === "super_admin"
                        ? "grid-cols-1 min-[360px]:grid-cols-3"
                        : "grid-cols-2"
                    }`}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full px-2 text-xs sm:text-sm"
                      onClick={() => {
                        setStatusTarget(member)
                      }}
                    >
                      {member.is_active ? (
                        <UserRoundX className="size-4" />
                      ) : (
                        <UserRoundCheck className="size-4" />
                      )}
                      {member.is_active ? "Tạm ngưng" : "Mở lại"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-full px-2 text-xs sm:text-sm"
                      onClick={() => {
                        setEditing(member)
                      }}
                    >
                      <Pencil className="size-4" />
                      Sửa
                    </Button>

                    {currentRole === "super_admin" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-full border-danger/40 px-2 text-xs text-danger hover:bg-danger-soft hover:text-danger sm:text-sm"
                        onClick={() => {
                          setDeleteTarget(member)
                        }}
                      >
                        <Trash2 className="size-4" />
                        Xóa hồ sơ
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {editing !== undefined && (
        <MemberDialog
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setMembers((current) =>
              editing
                ? current
                    .map((item) => (item.id === saved.id ? saved : item))
                    .sort((a, b) =>
                      a.full_name.localeCompare(b.full_name, "vi"),
                    )
                : [...current, saved].sort((a, b) =>
                    a.full_name.localeCompare(b.full_name, "vi"),
                  ),
            )
            setEditing(undefined)
          }}
        />
      )}

      <Dialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open && !statusSaving) setStatusTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusTarget?.is_active
                ? "Tạm ngưng hồ sơ hụi viên?"
                : "Mở lại hồ sơ hụi viên?"}
            </DialogTitle>
            <DialogDescription>
              {statusTarget?.is_active
                ? "Hụi viên sẽ không được thêm vào dây hoặc chân mới. Các dây, chân, phiếu, nghĩa vụ và lịch sử hiện có vẫn giữ nguyên. Tài khoản đăng nhập không tự động bị khóa; muốn ngăn đăng nhập phải khóa tài khoản riêng."
                : "Hồ sơ sẽ được phép tham gia nghiệp vụ mới trở lại. Dữ liệu lịch sử và trạng thái tài khoản đăng nhập không thay đổi."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-secondary p-3 text-sm">
            <p className="font-bold">{statusTarget?.full_name}</p>
            <p className="text-muted-foreground">
              {statusTarget?.phone || "Chưa có số điện thoại"}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={statusSaving}
              onClick={() => setStatusTarget(null)}
            >
              Hủy
            </Button>
            <Button disabled={statusSaving} onClick={() => void confirmStatusChange()}>
              {statusSaving && <LoaderCircle className="size-4 animate-spin" />}
              {statusTarget?.is_active ? "Tạm ngưng" : "Mở lại"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteMemberDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(memberId) => {
          setDeleteTarget(null)
          setMembers((current) =>
            current.filter((member) => member.id !== memberId),
          )
          setMessage("Đã xóa hồ sơ hụi viên chưa phát sinh nghiệp vụ.")
          setError("")
          void loadData()
        }}
      />
    </HuiPage>
  )
}

function DeleteMemberDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: Member | null
  onClose: () => void
  onDeleted: (memberId: string) => void
}) {
  const [preflight, setPreflight] = useState<MemberDeletePreflight | null>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const deleteInFlightRef = useRef(false)
  const preflightRequestRef = useRef(0)

  const loadPreflight = useCallback(async () => {
    if (!target) return

    const requestId = ++preflightRequestRef.current
    setLoadingPreflight(true)
    setPreflight(null)
    try {
      const { data } = await createClient().auth.getSession()
      const accessToken = data.session?.access_token ?? ""
      const response = await fetch(
        `/api/admin/members?member_id=${encodeURIComponent(target.id)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error ?? "Không thể kiểm tra hồ sơ hụi viên.")
      }

      if (preflightRequestRef.current === requestId) {
        setPreflight(result as MemberDeletePreflight)
      }
    } catch (caught) {
      if (preflightRequestRef.current === requestId) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Không thể kiểm tra hồ sơ hụi viên.",
        )
      }
    } finally {
      if (preflightRequestRef.current === requestId) {
        setLoadingPreflight(false)
      }
    }
  }, [target])

  useEffect(() => {
    preflightRequestRef.current += 1
    setPreflight(null)
    setReason("")
    setConfirmation("")
    setError("")
    setDeleting(false)
    if (target) void loadPreflight()
  }, [loadPreflight, target])

  if (!target) return null
  const targetMember = target

  let normalizedTargetPhone = ""
  let confirmationMatchesPhone = false
  if (target.phone) {
    try {
      normalizedTargetPhone = normalizeVietnamPhone(target.phone)
    } catch {
      normalizedTargetPhone = ""
    }
  }
  if (normalizedTargetPhone && confirmation.trim()) {
    try {
      confirmationMatchesPhone =
        normalizeVietnamPhone(confirmation) === normalizedTargetPhone
    } catch {
      confirmationMatchesPhone = false
    }
  }

  const confirmationValid =
    confirmation.trim() === "XOA" || confirmationMatchesPhone
  const canDelete =
    preflight?.member_delete_enabled === true &&
    preflight.member.id === targetMember.id &&
    reason.trim().length >= 5 &&
    confirmationValid &&
    !loadingPreflight &&
    !deleting
  const dependencyRows: Array<[string, number]> = preflight
    ? [
        ["Chân hụi", preflight.counts.hui_shares],
        ["Phiếu hiện tại", preflight.counts.hui_receipts],
        ["Thanh toán", preflight.counts.receipt_payments],
        ["Phiếu legacy", preflight.counts.receipts],
        ["Giao dịch legacy", preflight.counts.transactions],
        ["Tài khoản app", preflight.counts.app_users],
        ["Profile legacy", preflight.counts.profiles],
      ]
    : []

  async function deleteMember() {
    if (!canDelete || deleteInFlightRef.current) return

    deleteInFlightRef.current = true
    setDeleting(true)
    setError("")
    try {
      const { data } = await createClient().auth.getSession()
      const accessToken = data.session?.access_token ?? ""
      const response = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          member_id: targetMember.id,
          reason: reason.trim(),
          confirmation: confirmation.trim(),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? "Không thể xóa hồ sơ hụi viên.")
        if (response.status === 409 || result.reload_preflight) {
          await loadPreflight()
        }
        return
      }

      if (result.ok !== true) {
        setError("Máy chủ không xác nhận xóa thành công. Hãy tải lại danh sách.")
        return
      }

      onDeleted(targetMember.id)
    } catch {
      setError("Không thể xác minh kết quả xóa. Hãy tải lại danh sách trước khi thử lại.")
    } finally {
      deleteInFlightRef.current = false
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose()
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Xóa hồ sơ hụi viên</DialogTitle>
          <DialogDescription>
            Đây là xóa vĩnh viễn hồ sơ nghiệp vụ hoàn toàn sạch, khác với xóa
            tài khoản đăng nhập. RPC sẽ kiểm tra lại toàn bộ dependency ngay
            trong transaction trước khi xóa.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-secondary p-3 text-sm">
          <p className="font-bold">{preflight?.member.full_name ?? targetMember.full_name}</p>
          <p className="text-muted-foreground">
            {preflight?.member.phone || targetMember.phone || "Chưa có số điện thoại"}
          </p>
        </div>

        {loadingPreflight ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang đếm chính xác các dependency...
          </p>
        ) : preflight ? (
          <>
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {dependencyRows.map(([label, count]) => (
                    <tr key={label}>
                      <td className="px-3 py-2 text-muted-foreground">{label}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preflight.member_delete_blocker ? (
              <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
                <p className="font-semibold">{preflight.member_delete_blocker}</p>
                <p className="mt-1 text-muted-foreground">
                  {preflight.has_business_history
                    ? "Có lịch sử nghiệp vụ: hãy dùng “Tạm ngưng hồ sơ”."
                    : ""}
                  {preflight.has_login_link
                    ? " Có tài khoản liên kết: hãy dùng “Khóa đăng nhập” ở phần quản lý tài khoản."
                    : ""}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm font-medium">
                  Lý do xóa (ít nhất 5 ký tự)
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={deleting}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Gõ XOA hoặc đúng số điện thoại để xác nhận
                  <Input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    disabled={deleting}
                  />
                </label>
              </div>
            )}
          </>
        ) : null}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="destructive"
            disabled={!canDelete}
            onClick={() => void deleteMember()}
          >
            {deleting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Xóa vĩnh viễn hồ sơ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MemberProfilePage({
  profile,
  onBack,
  onEdit,
}: {
  profile: MemberProfile
  onBack: () => void
  onEdit: () => void
}) {
  const meta = cashFlowMeta(profile.cashFlowLevel)

  return (
    <HuiPage wide>
      <HuiPageHeader
        leading={
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="size-10 shrink-0"
            aria-label="Về danh sách hụi viên"
          >
            <ArrowLeft className="size-4" />
          </Button>
        }
        title={profile.member.full_name}
        subtitle={`${profile.member.phone || "Chưa có SĐT"} · ${profile.groupCount} dây · ${profile.totalShares} chân`}
        actions={
          <Button className="h-10 font-semibold" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" /> Sửa
          </Button>
        }
      />

      <Card className="gap-0 rounded-lg p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Đánh giá dòng tiền</p>
            <div className="mt-1">
              <HuiStatusBadge
                className="min-h-8 px-3 text-sm"
                label={meta.label}
                icon={meta.Icon}
                tone={meta.tone}
              />
            </div>
          </div>

          <div className="text-sm sm:max-w-xl">
            <p>{profile.cashFlowReason}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Chênh lệch: {formatSignedVND(profile.cashFlowDifference)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HuiStatCard label="Số dây" value={profile.groupCount} tone="info" />
        <HuiStatCard label="Tổng chân" value={profile.totalShares} />
        <HuiStatCard label="Chân sống" value={profile.liveShares} tone="success" />
        <HuiStatCard label="Chân chết / đã hốt" value={profile.deadShares} tone="warning" />
      </div>

      <Card className="gap-0 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <WalletCards className="size-5" />
          <h2 className="font-bold">Tiền đã ghi nhận trên hệ thống</h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SmallStat label="Đã đóng" value={formatVND(profile.collected)} />
          <SmallStat label="Đã nhận" value={formatVND(profile.paid)} />
          <SmallStat
            label="Đang thiếu quá hạn"
            value={formatVND(profile.overdue)}
          />
          <SmallStat
            label="Nghĩa vụ tương lai sau hốt"
            value={formatVND(profile.futureObligation)}
          />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          “Đã đóng/đã nhận” chỉ tính các giao dịch đã được xác nhận trong app.
          Khi dữ liệu cũ được đánh dấu “đã thu/chi đủ kỳ”, các số này sẽ tăng
          tương ứng.
        </p>
      </Card>

      {profile.collectObligations.length > 0 && (
        <Card className="gap-0 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <WalletCards className="size-5" />
            <h2 className="font-bold">Các khoản đang chờ thanh toán</h2>
          </div>

          <div className="mt-4 space-y-3">
            {profile.collectObligations.map((obligation) => {
              const overdue = obligation.status === "overdue"
              const periodLabel = obligation.periods.length
                ? obligation.periods
                    .map(
                      (period) =>
                        `${period.groupName} · K${period.periodNumber}`,
                    )
                    .join("; ")
                : `Nghĩa vụ ngày ${formatDate(obligation.receiptDate)}`

              return (
                <div
                  key={obligation.receiptKey}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{periodLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Khui lúc {formatVietnamDateTime(obligation.openedAtMs)}
                      </p>
                    </div>
                    <HuiStatusBadge
                      label={
                        overdue ? "Quá hạn thanh toán" : "Chờ thanh toán"
                      }
                      tone={overdue ? "danger" : "warning"}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <SmallStat
                      label="Số phải thu"
                      value={formatVND(obligation.requiredAmount)}
                    />
                    <SmallStat
                      label="Đã thu"
                      value={formatVND(obligation.collectedAmount)}
                    />
                    <SmallStat
                      label="Còn thiếu"
                      value={formatVND(obligation.remainingAmount)}
                    />
                  </div>

                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    {overdue ? "Quá hạn từ" : "Hạn thanh toán"}: {" "}
                    {formatVietnamDateTime(obligation.deadlineAtMs)}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="border-b border-border pb-3">
        <h2 className="text-base font-bold">Các dây đang tham gia</h2>
        <p className="text-sm text-muted-foreground">
          Chi tiết chân sống/chết và nghĩa vụ còn lại theo từng dây.
        </p>
      </div>

      {profile.groupStats.length === 0 ? (
        <HuiEmptyState
          icon={UserRound}
          title="Chưa tham gia dây hụi nào"
          description="Hụi viên này chưa có chân hoạt động trong dây nào."
        />
      ) : (
        <div className="space-y-3">
          {profile.groupStats.map((stat) => (
            <Card key={stat.group.id} className="gap-0 rounded-lg p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{stat.group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stat.group.code || "Chưa có mã"} ·{" "}
                    {formatVND(stat.group.contribution_amount)}/chân · đã khui{" "}
                    {stat.completedPeriods}/{stat.group.total_shares} kỳ
                  </p>
                </div>

                <p className="text-sm font-bold">
                  {stat.totalShares} chân
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <SmallStat
                  label="Chân sống"
                  value={String(stat.liveShares)}
                />
                <SmallStat
                  label="Chân chết"
                  value={String(stat.deadShares)}
                />
                <SmallStat
                  label="Còn phải đóng sau hốt"
                  value={formatVND(stat.futureObligation)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="gap-0 rounded-lg p-4">
        <div>
          <h2 className="text-base font-bold">Thông tin cá nhân</h2>
          <p className="text-sm text-muted-foreground">
            Thông tin liên hệ và thanh toán của hụi viên.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="grid min-w-0 gap-3">
            <h3 className="border-b border-border pb-2 text-sm font-bold">
              Liên hệ
            </h3>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <ProfileField label="Họ tên" value={profile.member.full_name} />
              <ProfileField label="Điện thoại" value={profile.member.phone} />
              <ProfileField label="Zalo" value={profile.member.zalo_phone} />
              <ProfileField label="Địa chỉ" value={profile.member.address} />
            </div>
          </section>

          <section className="grid min-w-0 gap-3">
            <h3 className="border-b border-border pb-2 text-sm font-bold">
              Ngân hàng
            </h3>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
              <ProfileField label="Ngân hàng" value={profile.member.bank_name} />
              <ProfileField
                label="Số tài khoản"
                value={profile.member.bank_account_number}
                monospaced
              />
              <ProfileField
                label="Chủ tài khoản"
                value={profile.member.bank_account_name}
                className="sm:col-span-2 md:col-span-1 xl:col-span-2"
              />
            </div>
          </section>

          <section className="grid min-w-0 gap-3 md:col-span-2">
            <h3 className="border-b border-border pb-2 text-sm font-bold">
              Khác
            </h3>
            <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
              <ProfileField
                label="Trạng thái"
                value={profile.member.is_active ? "Hoạt động" : "Tạm ngưng"}
              />
              <ProfileField
                label="Ngày tạo hồ sơ"
                value={formatProfileDate(profile.member.created_at)}
              />
              <ProfileField
                label="Ghi chú"
                value={profile.member.notes}
                className="md:col-span-2"
              />
            </div>
          </section>
        </div>
      </Card>

      <Card className="gap-0 rounded-lg border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        Đánh giá dòng tiền chỉ so sánh tổng tiền đã đóng với tổng tiền đã nhận.
        Khoản quá hạn, số chân đã hốt và nghĩa vụ tương lai được hiển thị riêng
        để tham khảo, không làm thay đổi badge đánh giá.
      </Card>
    </HuiPage>
  )
}

function ProfileField({
  label,
  value,
  className = "",
  monospaced = false,
}: {
  label: string
  value: string | null
  className?: string
  monospaced?: boolean
}) {
  const displayValue = value?.trim() || "Chưa cập nhật"

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-words text-sm font-medium [overflow-wrap:anywhere] ${
          monospaced ? "font-mono tabular-nums" : ""
        }`}
      >
        {displayValue}
      </p>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-secondary p-2.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 overflow-x-auto whitespace-nowrap text-sm font-bold tabular-nums">{value}</p>
    </div>
  )
}

function MemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member | null
  onClose: () => void
  onSaved: (member: Member) => void
}) {
  const [form, setForm] = useState<MemberForm>(
    member
      ? {
          full_name: member.full_name,
          phone: member.phone ?? "",
          zalo_phone: member.zalo_phone ?? "",
          address: member.address ?? "",
          bank_name: member.bank_name ?? "",
          bank_account_number: member.bank_account_number ?? "",
          bank_account_name: member.bank_account_name ?? "",
          notes: member.notes ?? "",
          is_active: member.is_active,
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const setField = (
    field: keyof MemberForm,
    value: string | boolean,
  ) => setForm((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.full_name.trim()) {
      setError("Họ tên là bắt buộc.")
      return
    }

    setSaving(true)
    setError("")

    const payload = {
      ...form,
      full_name: form.full_name.trim(),
      updated_at: new Date().toISOString(),
    }

    const query = member
      ? createClient()
          .from("members")
          .update(payload)
          .eq("id", member.id)
      : createClient().from("members").insert(payload)

    const { data, error: saveError } = await query.select().single()

    if (saveError) {
      setError("Không thể lưu hụi viên. Vui lòng kiểm tra và thử lại.")
      setSaving(false)
      return
    }

    onSaved(data as Member)
  }

  const fields: {
    key: keyof MemberForm
    label: string
    required?: boolean
  }[] = [
    { key: "full_name", label: "Họ tên", required: true },
    { key: "phone", label: "Điện thoại" },
    { key: "zalo_phone", label: "Số Zalo" },
    { key: "address", label: "Địa chỉ" },
    { key: "bank_name", label: "Ngân hàng" },
    { key: "bank_account_number", label: "Số tài khoản" },
    { key: "bank_account_name", label: "Tên chủ tài khoản" },
    { key: "notes", label: "Ghi chú" },
  ]

  return (
    <div
      className="hui-design-surface fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-b-none rounded-t-xl p-4 shadow-2xl sm:rounded-xl sm:p-5">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold">{member ? "Sửa hụi viên" : "Thêm hụi viên"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Thông tin liên hệ và tài khoản nhận tiền.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className={
                  field.key === "address" || field.key === "notes"
                    ? "flex flex-col gap-1.5 text-sm font-medium md:col-span-2"
                    : "flex flex-col gap-1.5 text-sm font-medium"
                }
              >
                {field.label}
                <Input
                  required={field.required}
                  value={String(form[field.key] ?? "")}
                  onChange={(event) =>
                    setField(field.key, event.target.value)
                  }
                />
              </label>
            ))}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button className="h-10" type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button className="h-10" type="submit" disabled={saving}>
              {saving && <LoaderCircle className="size-4 animate-spin" />}
              Lưu
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
