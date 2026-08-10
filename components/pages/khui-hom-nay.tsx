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
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Users,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
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
  minimum_bid_amount: number
  bid_step_amount: number
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
  notes: string | null
}

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type PeriodPaymentRow = {
  id: string
  source_period_id: string | null
  direction: "collect" | "pay"
  amount: number
  status: "active" | "cancelled"
}

type PeriodItem = {
  period: PeriodRow
  group: GroupRow
  shares: ShareRow[]
  winner: MemberRow | null
  hasConfirmedMoney: boolean
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—"
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

function formatMoneyInput(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (!digits) return ""
  return new Intl.NumberFormat("vi-VN").format(Number(digits))
}

function numericValue(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "")
  return digits ? Number(digits) : 0
}

function isCompleted(status: string) {
  return status === "completed" || status === "opened"
}

function periodStatusLabel(status: string) {
  if (isCompleted(status)) return "Đã chốt"
  if (status === "cancelled") return "Đã hủy"
  return "Chưa khui"
}

function defaultOpenedAt(period: PeriodRow, group: GroupRow) {
  if (period.opened_at) {
    return new Date(period.opened_at)
      .toLocaleString("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
      .slice(0, 16)
  }

  const time = group.opening_time?.slice(0, 5) ?? "19:00"
  return `${period.scheduled_date}T${time}`
}

export function KhuiHomNayPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [periodPayments, setPeriodPayments] = useState<PeriodPaymentRow[]>([])
  const [selectedDate, setSelectedDate] = useState(todayInVietnam())
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()
    const [groupsResult, sharesResult, periodsResult, membersResult, paymentsResult] =
      await Promise.all([
        supabase
          .from("hui_groups")
          .select(
            "id, code, name, contribution_amount, total_shares, fee_amount, minimum_bid_amount, bid_step_amount, opening_time, status",
          )
          .eq("status", "active"),
        supabase
          .from("hui_shares")
          .select("id, group_id, member_id, share_number, status")
          .order("share_number"),
        supabase
          .from("hui_periods")
          .select(
            "id, group_id, period_number, scheduled_date, scheduled_at, opened_at, winner_share_id, bid_amount, fee_amount, status, notes",
          )
          .order("scheduled_date")
          .order("period_number"),
        supabase
          .from("members")
          .select("id, full_name, phone")
          .order("full_name"),
        supabase
          .from("receipt_payments")
          .select("id, source_period_id, direction, amount, status"),
      ])

    const firstError =
      groupsResult.error ??
      sharesResult.error ??
      periodsResult.error ??
      membersResult.error ??
      paymentsResult.error

    if (firstError) {
      console.error(firstError)
      setError(
        "Không thể tải dữ liệu Khui hôm nay. Kiểm tra kết nối Supabase và migration source_period_id.",
      )
      setLoading(false)
      return
    }

    setGroups((groupsResult.data ?? []) as GroupRow[])
    setShares((sharesResult.data ?? []) as ShareRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setMembers((membersResult.data ?? []) as MemberRow[])
    setPeriodPayments((paymentsResult.data ?? []) as PeriodPaymentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  )

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )

  const sharesByGroup = useMemo(() => {
    const map = new Map<string, ShareRow[]>()

    for (const share of shares) {
      const list = map.get(share.group_id) ?? []
      list.push(share)
      map.set(share.group_id, list)
    }

    return map
  }, [shares])

  const items = useMemo<PeriodItem[]>(() => {
    return periods
      .filter(
        (period) =>
          period.scheduled_date === selectedDate &&
          groupsById.has(period.group_id) &&
          period.status !== "cancelled",
      )
      .map((period) => {
        const group = groupsById.get(period.group_id)!
        const groupShares = sharesByGroup.get(group.id) ?? []
        const winnerShare = groupShares.find(
          (share) => share.id === period.winner_share_id,
        )
        const winner = winnerShare
          ? membersById.get(winnerShare.member_id) ?? null
          : null

        const hasConfirmedMoney = periodPayments.some(
          (payment) =>
            payment.source_period_id === period.id &&
            payment.status === "active",
        )

        return {
          period,
          group,
          shares: groupShares,
          winner,
          hasConfirmedMoney,
        }
      })
      .sort((a, b) => {
        const timeA = a.group.opening_time ?? ""
        const timeB = b.group.opening_time ?? ""
        if (timeA !== timeB) return timeA.localeCompare(timeB)
        return a.group.name.localeCompare(b.group.name, "vi")
      })
  }, [
    groupsById,
    membersById,
    periodPayments,
    periods,
    selectedDate,
    sharesByGroup,
  ])

  const availableDates = useMemo(() => {
    const activeGroupIds = new Set(groups.map((group) => group.id))

    return [...new Set(
      periods
        .filter(
          (period) =>
            activeGroupIds.has(period.group_id) &&
            period.status !== "cancelled",
        )
        .map((period) => period.scheduled_date),
    )]
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 12)
  }, [groups, periods])

  const editingItem =
    items.find((item) => item.period.id === editingPeriodId) ?? null

  const completedCount = items.filter((item) =>
    isCompleted(item.period.status),
  ).length

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải các kỳ cần khui...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Khui hôm nay</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dữ liệu thật từ Supabase. Có thể chọn ngày cũ để kiểm tra và test.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ngày khui
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value)
                setEditingPeriodId(null)
              }}
            />
          </label>

          <div className="min-w-0">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Ngày có kỳ gần đây
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {availableDates.map((date) => (
                <button
                  type="button"
                  key={date}
                  onClick={() => {
                    setSelectedDate(date)
                    setEditingPeriodId(null)
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    selectedDate === date
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground"
                  }`}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>
          </div>

          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-destructive/30 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {formatDate(selectedDate)}
          </p>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{items.length} kỳ đã chốt
          </p>
        </div>

        {items.length > 0 && completedCount === items.length && (
          <Badge variant="secondary">
            <CheckCircle2 className="mr-1 size-3.5" />
            Đã xử lý hết
          </Badge>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">
              Không có kỳ của dây đang hoạt động trong ngày này
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Chọn một ngày ở danh sách phía trên để test bằng dữ liệu cũ.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <PeriodCard
              key={item.period.id}
              item={item}
              onOpen={() => setEditingPeriodId(item.period.id)}
            />
          ))}
        </div>
      )}

      <Card className="p-4 text-xs leading-relaxed text-muted-foreground">
        Trang này chỉ chốt kết quả kỳ: người hốt, giá thăm, ngày giờ và tiền
        thảo. Sau khi chốt, Phiếu thu–chi tự tính nghĩa vụ. Việc xác nhận tiền
        thật vẫn thực hiện ở Phiếu hoặc nút “Đã thu/chi đủ kỳ” trong Cân đối.
      </Card>

      {editingItem && (
        <KhuiDialog
          item={editingItem}
          allPeriods={periods}
          membersById={membersById}
          onClose={() => setEditingPeriodId(null)}
          onSaved={async () => {
            setEditingPeriodId(null)
            await loadData()
          }}
        />
      )}
    </div>
  )
}

function PeriodCard({
  item,
  onOpen,
}: {
  item: PeriodItem
  onOpen: () => void
}) {
  const completed = isCompleted(item.period.status)

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {item.group.code || "CHƯA-MÃ"}
            </Badge>
            <p className="font-semibold">{item.group.name}</p>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Kỳ {item.period.period_number}/{item.group.total_shares}
            </span>
            <span>
              <Clock3 className="mr-1 inline size-3" />
              {formatTime(item.period.scheduled_at ?? item.group.opening_time)}
            </span>
            <span>{formatVND(item.group.contribution_amount)}/chân</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={completed ? "secondary" : "outline"}>
            {periodStatusLabel(item.period.status)}
          </Badge>

          <Button
            size="sm"
            variant={completed ? "outline" : "default"}
            onClick={onOpen}
          >
            {completed ? (
              <Pencil className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            {completed ? "Xem / sửa" : "Khui kỳ"}
          </Button>
        </div>
      </div>

      {completed && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
          <MiniStat
            label="Người hốt"
            value={item.winner?.full_name ?? "Không rõ"}
          />
          <MiniStat
            label="Giá thăm"
            value={formatVND(item.period.bid_amount)}
          />
          <MiniStat
            label="Tiền thảo"
            value={formatVND(item.period.fee_amount)}
          />
          <MiniStat
            label="Tiền đã xác nhận"
            value={item.hasConfirmedMoney ? "Có" : "Chưa"}
          />
        </div>
      )}
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}

function KhuiDialog({
  item,
  allPeriods,
  membersById,
  onClose,
  onSaved,
}: {
  item: PeriodItem
  allPeriods: PeriodRow[]
  membersById: Map<string, MemberRow>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { period, group, shares, hasConfirmedMoney } = item

  const groupPeriods = allPeriods
    .filter((current) => current.group_id === group.id)
    .sort((a, b) => a.period_number - b.period_number)

  const previousWinnerIds = useMemo(
    () =>
      new Set(
        groupPeriods
          .filter(
            (current) =>
              current.period_number < period.period_number &&
              isCompleted(current.status) &&
              current.winner_share_id,
          )
          .map((current) => current.winner_share_id as string),
      ),
    [groupPeriods, period.period_number],
  )

  const eligibleShares = useMemo(
    () =>
      [...shares]
        .filter(
          (share) =>
            share.status === "active" &&
            (!previousWinnerIds.has(share.id) ||
              share.id === period.winner_share_id),
        )
        .sort((a, b) => a.share_number - b.share_number),
    [period.winner_share_id, previousWinnerIds, shares],
  )

  const [winnerShareId, setWinnerShareId] = useState(
    period.winner_share_id ?? "",
  )
  const [bidAmount, setBidAmount] = useState(
    period.bid_amount ? formatMoneyInput(period.bid_amount) : "",
  )
  const [openedAt, setOpenedAt] = useState(defaultOpenedAt(period, group))
  const [notes, setNotes] = useState(period.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const preview = useMemo(() => {
    const bid = numericValue(bidAmount)
    const contribution = Number(group.contribution_amount || 0)
    const liveContribution = Math.max(0, contribution - bid)
    const fee = Number(period.fee_amount || group.fee_amount || 0)

    let livePayers = 0
    let deadPayers = 0
    let grossHui = 0

    for (const share of shares.filter((share) => share.status === "active")) {
      if (share.id === winnerShareId) continue

      if (previousWinnerIds.has(share.id)) {
        deadPayers += 1
        grossHui += contribution
      } else {
        livePayers += 1
        grossHui += liveContribution
      }
    }

    return {
      bid,
      contribution,
      liveContribution,
      fee,
      livePayers,
      deadPayers,
      grossHui,
      payout: Math.max(0, grossHui - fee),
    }
  }, [
    bidAmount,
    group.contribution_amount,
    group.fee_amount,
    period.fee_amount,
    previousWinnerIds,
    shares,
    winnerShareId,
  ])

  const winnerShare = shares.find((share) => share.id === winnerShareId)
  const winnerMember = winnerShare
    ? membersById.get(winnerShare.member_id) ?? null
    : null

  function validateBid(value: number) {
    const minBid = Number(group.minimum_bid_amount || 0)
    const bidStep = Number(group.bid_step_amount || 0)

    if (value < minBid) {
      return `Giá thăm phải từ ${formatVND(minBid)} trở lên.`
    }

    if (bidStep > 0 && (value - minBid) % bidStep !== 0) {
      return `Giá thăm phải theo bước ${formatVND(bidStep)} từ mức ${formatVND(minBid)}.`
    }

    if (value >= Number(group.contribution_amount || 0)) {
      return "Giá thăm phải nhỏ hơn mệnh giá mỗi chân."
    }

    return ""
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (hasConfirmedMoney && isCompleted(period.status)) {
      setError(
        "Kỳ này đã có tiền được xác nhận. Hãy hủy/điều chỉnh xác nhận thu–chi liên quan trước khi sửa kết quả kỳ.",
      )
      return
    }

    if (!winnerShareId) {
      setError("Bạn cần chọn chân hốt.")
      return
    }

    const bid = numericValue(bidAmount)
    const bidError = validateBid(bid)

    if (bidError) {
      setError(bidError)
      return
    }

    if (!openedAt) {
      setError("Ngày giờ khui là bắt buộc.")
      return
    }

    setSaving(true)

    try {
      const openedAtIso = new Date(`${openedAt}:00+07:00`).toISOString()

      const { error: updateError } = await createClient()
        .from("hui_periods")
        .update({
          winner_share_id: winnerShareId,
          bid_amount: bid,
          fee_amount: group.fee_amount,
          opened_at: openedAtIso,
          status: "completed",
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", period.id)

      if (updateError) throw updateError

      await onSaved()
    } catch (caught) {
      console.error(caught)
      setError("Không thể lưu kết quả kỳ khui.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[94vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {group.code || "CHƯA-MÃ"}
              </Badge>
              <h2 className="text-lg font-bold">
                {isCompleted(period.status)
                  ? `Kỳ ${period.period_number} đã chốt`
                  : `Khui kỳ ${period.period_number}`}
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {group.name} · {formatDate(period.scheduled_date)}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="size-4" />
          </Button>
        </div>

        {hasConfirmedMoney && isCompleted(period.status) && (
          <Card className="mt-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Kỳ này đã có xác nhận thu/chi. Bạn vẫn xem được phép tính nhưng
                app khóa việc sửa kết quả để tránh làm lệch phiếu và cân đối.
              </p>
            </div>
          </Card>
        )}

        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Chân hốt
            <select
              required
              disabled={hasConfirmedMoney && isCompleted(period.status)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={winnerShareId}
              onChange={(event) => setWinnerShareId(event.target.value)}
            >
              <option value="">Chọn chân hốt</option>
              {eligibleShares.map((share) => {
                const member = membersById.get(share.member_id)
                return (
                  <option key={share.id} value={share.id}>
                    Chân {share.share_number} —{" "}
                    {member?.full_name ?? "Không rõ"}
                    {member?.phone ? ` — ${member.phone}` : ""}
                  </option>
                )
              })}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Giá thăm
              <div className="relative">
                <Input
                  inputMode="numeric"
                  required
                  disabled={hasConfirmedMoney && isCompleted(period.status)}
                  value={bidAmount}
                  onChange={(event) =>
                    setBidAmount(formatMoneyInput(event.target.value))
                  }
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                Tối thiểu {formatVND(group.minimum_bid_amount || 0)} · bước{" "}
                {formatVND(group.bid_step_amount || 0)}
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ngày giờ khui
              <Input
                type="datetime-local"
                required
                disabled={hasConfirmedMoney && isCompleted(period.status)}
                value={openedAt}
                onChange={(event) => setOpenedAt(event.target.value)}
              />
            </label>
          </div>

          <Card className="p-4">
            <p className="font-semibold">Xem trước phép tính kỳ này</p>

            {!winnerShareId ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Chọn chân hốt để xem số tiền.
              </p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <CalcRow
                  label="Người hốt"
                  value={winnerMember?.full_name ?? "Không rõ"}
                />
                <CalcRow
                  label="Chân sống đóng"
                  value={`${preview.livePayers} chân × ${formatVND(
                    preview.liveContribution,
                  )}`}
                />
                <CalcRow
                  label="Chân chết đóng"
                  value={`${preview.deadPayers} chân × ${formatVND(
                    preview.contribution,
                  )}`}
                />
                <div className="border-t pt-2">
                  <CalcRow
                    label="Tổng hốt hụi"
                    value={formatVND(preview.grossHui)}
                    strong
                  />
                  <CalcRow
                    label="Trừ tiền thảo"
                    value={`- ${formatVND(preview.fee)}`}
                  />
                </div>
                <div className="border-t pt-2">
                  <CalcRow
                    label="Chủ hụi phải giao"
                    value={formatVND(preview.payout)}
                    strong
                  />
                </div>
              </div>
            )}
          </Card>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ghi chú
            <textarea
              disabled={hasConfirmedMoney && isCompleted(period.status)}
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ghi chú nếu kỳ này có trường hợp đặc biệt..."
            />
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>

            {!(hasConfirmedMoney && isCompleted(period.status)) && (
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {isCompleted(period.status) ? "Lưu chỉnh sửa" : "Chốt kỳ"}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}

function CalcRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`shrink-0 text-right ${
          strong ? "font-bold" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
