"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
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
  UserRound,
  WalletCards,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

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
}

type MemberForm = Omit<Member, "id" | "created_at" | "updated_at">

type GroupMemberStat = {
  group: GroupRow
  totalShares: number
  liveShares: number
  deadShares: number
  futureObligation: number
  completedPeriods: number
}

type RiskLevel = "normal" | "watch" | "high" | "very_high"

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
  risk: RiskLevel
  riskReasons: string[]
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
  const winnerReceive = Math.max(0, potBeforeFee - fee)
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

function riskMeta(level: RiskLevel) {
  if (level === "very_high") {
    return {
      label: "Rủi ro rất cao",
      className: "bg-destructive/10 text-destructive",
      Icon: ShieldAlert,
    }
  }
  if (level === "high") {
    return {
      label: "Rủi ro cao",
      className: "bg-status-red-bg text-status-red-fg",
      Icon: AlertTriangle,
    }
  }
  if (level === "watch") {
    return {
      label: "Cần chú ý",
      className: "bg-status-yellow-bg text-status-yellow-fg",
      Icon: AlertTriangle,
    }
  }
  return {
    label: "Bình thường",
    className: "bg-status-green-bg text-status-green-fg",
    Icon: ShieldCheck,
  }
}

export function HuiVienPage() {
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

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    const supabase = createClient()

    const [
      membersResult,
      groupsResult,
      sharesResult,
      periodsResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select(
          "id, full_name, phone, zalo_phone, address, bank_name, bank_account_number, bank_account_name, notes, is_active, created_at, updated_at",
        )
        .order("full_name"),
      supabase
        .from("hui_groups")
        .select("id, code, name, contribution_amount, total_shares, status"),
      supabase
        .from("hui_shares")
        .select("id, group_id, member_id, share_number, status"),
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, fee_amount, status",
        ),
      supabase
        .from("hui_receipts")
        .select("id, member_id, receipt_date, settlement_amount, status"),
      supabase
        .from("receipt_payments")
        .select(
          "id, receipt_id, direction, amount, status, source_period_id",
        ),
    ])

    const firstError =
      membersResult.error ??
      groupsResult.error ??
      sharesResult.error ??
      periodsResult.error ??
      receiptsResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError("Không thể tải đầy đủ dữ liệu hụi viên.")
    } else {
      setMembers((membersResult.data ?? []) as Member[])
      setGroups((groupsResult.data ?? []) as GroupRow[])
      setShares((sharesResult.data ?? []) as ShareRow[])
      setPeriods((periodsResult.data ?? []) as PeriodRow[])
      setReceipts((receiptsResult.data ?? []) as ReceiptRow[])
      setPayments((paymentsResult.data ?? []) as PaymentRow[])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

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

    const receiptById = new Map(
      receipts
        .filter((receipt) => receipt.status !== "cancelled")
        .map((receipt) => [receipt.id, receipt]),
    )

    const paymentByMember = new Map<
      string,
      { collected: number; paid: number }
    >()

    for (const payment of payments) {
      if (payment.status !== "active") continue
      const receipt = receiptById.get(payment.receipt_id)
      if (!receipt) continue

      const current = paymentByMember.get(receipt.member_id) ?? {
        collected: 0,
        paid: 0,
      }
      if (payment.direction === "collect") {
        current.collected += Number(payment.amount || 0)
      } else {
        current.paid += Number(payment.amount || 0)
      }
      paymentByMember.set(receipt.member_id, current)
    }

    const obligationByMember = new Map<
      string,
      { shouldCollect: number; shouldPay: number }
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

      for (const [memberId, net] of nets.entries()) {
        const current = obligationByMember.get(memberId) ?? {
          shouldCollect: 0,
          shouldPay: 0,
        }
        if (net > 0) current.shouldCollect += net
        if (net < 0) current.shouldPay += Math.abs(net)
        obligationByMember.set(memberId, current)
      }
    }

    for (const receipt of receipts) {
      if (receipt.status === "cancelled") continue
      const settlement = Number(receipt.settlement_amount || 0)
      if (!settlement) continue

      const current = obligationByMember.get(receipt.member_id) ?? {
        shouldCollect: 0,
        shouldPay: 0,
      }
      if (settlement > 0) current.shouldCollect += settlement
      if (settlement < 0) current.shouldPay += Math.abs(settlement)
      obligationByMember.set(receipt.member_id, current)
    }

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

      const obligation = obligationByMember.get(member.id) ?? {
        shouldCollect: 0,
        shouldPay: 0,
      }
      const actual = paymentByMember.get(member.id) ?? {
        collected: 0,
        paid: 0,
      }

      const overdue = Math.max(
        0,
        obligation.shouldCollect - actual.collected,
      )

      const riskReasons: string[] = []
      let risk: RiskLevel = "normal"

      if (deadShares > 0 && futureObligation > 0) {
        riskReasons.push(
          `Đã hốt ${deadShares} chân, còn nghĩa vụ tương lai ${formatVND(
            futureObligation,
          )}.`,
        )
        risk = "watch"
      }

      if (overdue > 0) {
        riskReasons.push(`Đang thiếu ${formatVND(overdue)} đã đến hạn.`)
        risk = deadShares > 0 ? "high" : "watch"
      }

      if (
        overdue > 0 &&
        futureObligation > 0 &&
        (deadShares >= 2 ||
          overdue >= 10_000_000 ||
          futureObligation >= 30_000_000)
      ) {
        risk = "very_high"
      } else if (
        risk !== "very_high" &&
        deadShares >= 2 &&
        futureObligation >= 20_000_000
      ) {
        risk = "high"
      }

      if (riskReasons.length === 0) {
        riskReasons.push(
          "Chưa phát hiện khoản thiếu đến hạn hoặc nghĩa vụ sau khi hốt đáng chú ý.",
        )
      }

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
        shouldCollect: obligation.shouldCollect,
        shouldPay: obligation.shouldPay,
        collected: actual.collected,
        paid: actual.paid,
        overdue,
        totalReceived: actual.paid,
        totalContributed: actual.collected,
        risk,
        riskReasons,
      }
    })
  }, [groups, members, payments, periods, receipts, shares])

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

  async function toggleActive(member: Member) {
    setError("")
    const nextActive = !member.is_active
    const { error: updateError } = await createClient()
      .from("members")
      .update({
        is_active: nextActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)

    if (updateError) {
      setError("Không thể cập nhật trạng thái hụi viên.")
      return
    }

    setMembers((current) =>
      current.map((item) =>
        item.id === member.id ? { ...item, is_active: nextActive } : item,
      ),
    )
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
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hụi viên</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} người · theo dõi chân hụi và mức rủi ro
          </p>
        </div>
        <Button onClick={() => setEditing(null)}>
          <Plus className="size-4" />
          Thêm hụi viên
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Tìm hụi viên"
          placeholder="Tìm theo tên hoặc SĐT..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {error && (
        <Card
          className="flex items-center justify-between gap-3 border-destructive/30 p-4 text-sm text-destructive"
          role="alert"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Thử lại
          </Button>
        </Card>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-5 animate-spin" />
          Đang tải hụi viên...
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="font-medium">
            {query ? "Không tìm thấy hụi viên" : "Chưa có hụi viên"}
          </p>
          <p className="text-sm text-muted-foreground">
            {query
              ? "Thử tìm bằng tên hoặc số điện thoại khác."
              : "Thêm hụi viên đầu tiên để bắt đầu."}
          </p>
        </Card>
      ) : (
        <>
          <Card className="hidden md:block">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "Họ tên",
                      "Điện thoại / Zalo",
                      "Ngân hàng",
                      "Đánh giá",
                      "Trạng thái",
                      "Thao tác",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {filteredProfiles.map((profile) => {
                    const member = profile.member
                    const meta = riskMeta(profile.risk)

                    return (
                      <tr
                        key={member.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelectedMemberId(member.id)}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            className="text-left font-medium hover:underline"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedMemberId(member.id)
                            }}
                          >
                            {member.full_name}
                          </button>
                        </td>

                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="min-w-[150px]">
                            <p className="whitespace-nowrap">
                              ĐT: {member.phone || "—"}
                            </p>
                            <p className="whitespace-nowrap text-xs">
                              Zalo: {member.zalo_phone || "—"}
                            </p>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {member.bank_name || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            <meta.Icon className="size-3.5" />
                            {meta.label}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              void toggleActive(member)
                            }}
                            className={
                              member.is_active
                                ? "rounded-full bg-status-green-bg px-2 py-1 text-xs font-medium text-status-green-fg"
                                : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {member.is_active ? "Hoạt động" : "Tạm ngưng"}
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex min-w-[190px] items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedMemberId(member.id)
                              }}
                            >
                              <WalletCards className="size-4" />
                              Tiền bạc
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditing(member)
                              }}
                            >
                              <Pencil className="size-4" />
                              Sửa
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-2 md:hidden">
            {filteredProfiles.map((profile) => {
              const member = profile.member
              const meta = riskMeta(profile.risk)

              return (
                <Card
                  key={member.id}
                  className="cursor-pointer p-4"
                  onClick={() => setSelectedMemberId(member.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {member.full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.phone || "Chưa có SĐT"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Zalo: {member.zalo_phone || "—"} ·{" "}
                        {member.bank_name || "Chưa có ngân hàng"}
                      </p>
                    </div>

                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${meta.className}`}
                    >
                      <meta.Icon className="size-3.5" />
                      {meta.label}
                    </span>

                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        void toggleActive(member)
                      }}
                      className={
                        member.is_active
                          ? "rounded-full bg-status-green-bg px-2 py-1 text-xs font-medium text-status-green-fg"
                          : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {member.is_active ? "Hoạt động" : "Tạm ngưng"}
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={(event) => {
                        event.stopPropagation()
                        setEditing(member)
                      }}
                    >
                      <Pencil className="size-4" />
                      Sửa
                    </Button>
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
    </div>
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
  const meta = riskMeta(profile.risk)

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">
              {profile.member.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {profile.member.phone || "Chưa có SĐT"}
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          Sửa
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Đánh giá hiện tại</p>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${meta.className}`}
            >
              <meta.Icon className="size-4" />
              {meta.label}
            </span>
          </div>

          <div className="text-sm sm:max-w-xl">
            {profile.riskReasons.map((reason) => (
              <p key={reason} className="mb-1 last:mb-0">
                • {reason}
              </p>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat label="Số dây" value={String(profile.groupCount)} />
        <BigStat label="Tổng chân" value={String(profile.totalShares)} />
        <BigStat label="Chân sống" value={String(profile.liveShares)} />
        <BigStat label="Chân chết / đã hốt" value={String(profile.deadShares)} />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <WalletCards className="size-5" />
          <h2 className="font-bold">Tiền đã ghi nhận trên hệ thống</h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SmallStat label="Đã đóng" value={formatVND(profile.collected)} />
          <SmallStat label="Đã nhận" value={formatVND(profile.paid)} />
          <SmallStat
            label="Đang thiếu đến hạn"
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

      <div>
        <h2 className="font-bold">Các dây đang tham gia</h2>
        <p className="text-sm text-muted-foreground">
          Chi tiết chân sống/chết và nghĩa vụ còn lại theo từng dây.
        </p>
      </div>

      {profile.groupStats.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Hụi viên này chưa có chân hoạt động trong dây nào.
        </Card>
      ) : (
        <div className="space-y-3">
          {profile.groupStats.map((stat) => (
            <Card key={stat.group.id} className="p-4">
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

      <Card className="p-4 text-xs leading-relaxed text-muted-foreground">
        Cảnh báo là công cụ hỗ trợ quản trị, không phải kết luận về khả năng trả
        tiền của một người. Hệ thống tăng mức cảnh báo khi người chơi đã hốt
        nhiều chân, còn nghĩa vụ tương lai lớn và/hoặc đang thiếu khoản đã đến
        hạn.
      </Card>
    </div>
  )
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {member ? "Sửa hụi viên" : "Thêm hụi viên"}
          </h2>
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

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setField("is_active", event.target.checked)
              }
              className="size-4 accent-primary"
            />
            Đang hoạt động
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="size-4 animate-spin" />}
              Lưu
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
