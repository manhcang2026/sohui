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
  Dices,
  LoaderCircle,
  LockKeyhole,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  LuckyWheelDialog,
  type LuckyWheelCandidate,
} from "@/components/lucky-wheel-dialog"
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

type PageResult<T> = {
  data: T[] | null
  error: unknown
}

const PAGE_SIZE = 1000

async function fetchPagedRows<T>(
  loadPage: (from: number, to: number) => Promise<PageResult<T>>,
) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const page = await loadPage(from, from + PAGE_SIZE - 1)

    if (page.error) throw page.error

    const data = page.data ?? []
    rows.push(...data)

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function timeInVietnam() {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

function stripRandomNote(value: string) {
  return value
    .split("\n")
    .filter(
      (line) =>
        !line.trim().startsWith("[Bốc thăm ngẫu nhiên"),
    )
    .join("\n")
    .trim()
}

function appendRandomNote(
  existingNotes: string,
  shareNumber: number,
  memberName: string,
) {
  const manualNotes = stripRandomNote(existingNotes)

  const randomLine =
    `[Bốc thăm ngẫu nhiên ${timeInVietnam()}] ` +
    `Chân ${shareNumber} — ${memberName} được chọn.`

  return manualNotes
    ? `${randomLine}\n${manualNotes}`
    : randomLine
}

export function KhuiHomNayPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [periodPayments, setPeriodPayments] =
    useState<PeriodPaymentRow[]>([])

  const [selectedDate, setSelectedDate] =
    useState(todayInVietnam())

  const [editingPeriodId, setEditingPeriodId] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()

    try {
      // Tất cả bảng có thể vượt giới hạn 1.000 dòng của Supabase nên đều
      // được phân trang. receipt_payments chỉ lấy payment active có liên kết
      // kỳ hụi vì màn Khui chỉ cần biết kỳ nào đã có tiền xác nhận.
      const [groupsRows, sharesRows, periodsRows, membersRows, paymentRows] =
        await Promise.all([
          fetchPagedRows<GroupRow>(async (from, to) => {
            const result = await supabase
              .from("hui_groups")
              .select(
                "id, code, name, contribution_amount, total_shares, fee_amount, minimum_bid_amount, bid_step_amount, opening_time, status",
              )
              .eq("status", "active")
              .order("id")
              .range(from, to)

            return {
              data: (result.data ?? []) as GroupRow[],
              error: result.error,
            }
          }),
          fetchPagedRows<ShareRow>(async (from, to) => {
            const result = await supabase
              .from("hui_shares")
              .select("id, group_id, member_id, share_number, status")
              .order("group_id")
              .order("share_number")
              .order("id")
              .range(from, to)

            return {
              data: (result.data ?? []) as ShareRow[],
              error: result.error,
            }
          }),
          fetchPagedRows<PeriodRow>(async (from, to) => {
            const result = await supabase
              .from("hui_periods")
              .select(
                "id, group_id, period_number, scheduled_date, scheduled_at, opened_at, winner_share_id, bid_amount, fee_amount, status, notes",
              )
              .order("scheduled_date")
              .order("period_number")
              .order("id")
              .range(from, to)

            return {
              data: (result.data ?? []) as PeriodRow[],
              error: result.error,
            }
          }),
          fetchPagedRows<MemberRow>(async (from, to) => {
            const result = await supabase
              .from("members")
              .select("id, full_name, phone")
              .order("full_name")
              .order("id")
              .range(from, to)

            return {
              data: (result.data ?? []) as MemberRow[],
              error: result.error,
            }
          }),
          fetchPagedRows<PeriodPaymentRow>(async (from, to) => {
            const result = await supabase
              .from("receipt_payments")
              .select("id, source_period_id, direction, amount, status")
              .eq("status", "active")
              .not("source_period_id", "is", null)
              .order("id")
              .range(from, to)

            return {
              data: (result.data ?? []) as PeriodPaymentRow[],
              error: result.error,
            }
          }),
        ])

      setGroups(groupsRows)
      setShares(sharesRows)
      setPeriods(periodsRows)
      setMembers(membersRows)
      setPeriodPayments(paymentRows)
    } catch (caught) {
      console.error(caught)
      setError("Không thể tải dữ liệu khui kỳ.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const groupsById = useMemo(
    () =>
      new Map(
        groups.map((group) => [group.id, group]),
      ),
    [groups],
  )

  const membersById = useMemo(
    () =>
      new Map(
        members.map((member) => [member.id, member]),
      ),
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
        const groupShares =
          sharesByGroup.get(group.id) ?? []

        const winnerShare = groupShares.find(
          (share) =>
            share.id === period.winner_share_id,
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
        const timeA =
          a.period.scheduled_at ??
          a.group.opening_time ??
          ""

        const timeB =
          b.period.scheduled_at ??
          b.group.opening_time ??
          ""

        if (timeA !== timeB) {
          return timeA.localeCompare(timeB)
        }

        return a.group.name.localeCompare(
          b.group.name,
          "vi",
        )
      })
  }, [
    groupsById,
    membersById,
    periodPayments,
    periods,
    selectedDate,
    sharesByGroup,
  ])

  const editingItem =
    items.find(
      (item) =>
        item.period.id === editingPeriodId,
    ) ?? null

  const completedCount = items.filter((item) =>
    isCompleted(item.period.status),
  ).length

  async function handleSaved(
    currentPeriodId: string,
  ) {
    const currentIndex = items.findIndex(
      (item) =>
        item.period.id === currentPeriodId,
    )

    const nextItem =
      items
        .slice(currentIndex + 1)
        .find(
          (item) =>
            !isCompleted(item.period.status),
        ) ?? null

    await loadData()

    setEditingPeriodId(
      nextItem?.period.id ?? null,
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải các kỳ cần khui...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">
            Khui kỳ
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(selectedDate)} ·{" "}
            {completedCount}/{items.length} dây đã chốt
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">
            Làm mới
          </span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium sm:max-w-[260px]">
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

          <Button
            type="button"
            variant="outline"
            className="h-10 sm:w-auto"
            disabled={
              selectedDate === todayInVietnam()
            }
            onClick={() => {
              setSelectedDate(todayInVietnam())
              setEditingPeriodId(null)
            }}
          >
            <CalendarDays className="size-4" />
            Hôm nay
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="border-destructive/30 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />

          <div>
            <p className="font-medium">
              Không có dây cần khui trong ngày này
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Chọn ngày khác hoặc quay về hôm nay.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                Tiến độ trong ngày
              </p>

              <p className="text-sm text-muted-foreground">
                {completedCount}/{items.length} dây đã chốt
              </p>
            </div>

            {completedCount === items.length && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="mr-1 size-3.5" />
                Đã xử lý hết
              </Badge>
            )}
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <PeriodCard
                key={item.period.id}
                item={item}
                onOpen={() =>
                  setEditingPeriodId(
                    item.period.id,
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {editingItem && (
        <KhuiDialog
          item={editingItem}
          allPeriods={periods}
          membersById={membersById}
          onClose={() =>
            setEditingPeriodId(null)
          }
          onSaved={() =>
            handleSaved(
              editingItem.period.id,
            )
          }
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
  const completed = isCompleted(
    item.period.status,
  )

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-xs"
            >
              {item.group.code || "CHƯA-MÃ"}
            </Badge>

            <p className="font-semibold">
              {item.group.name}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Kỳ {item.period.period_number}/
              {item.group.total_shares}
            </span>

            <span>
              <Clock3 className="mr-1 inline size-3" />

              {formatTime(
                item.period.scheduled_at ??
                  item.group.opening_time,
              )}
            </span>

            <span>
              {formatVND(
                item.group.contribution_amount,
              )}
              /chân
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            className={
              completed
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-800 hover:bg-amber-100"
            }
          >
            {completed && (
              <CheckCircle2 className="mr-1 size-3.5" />
            )}

            {periodStatusLabel(
              item.period.status,
            )}
          </Badge>

          <Button
            size="sm"
            variant={
              completed
                ? "outline"
                : "default"
            }
            onClick={onOpen}
          >
            {completed
              ? "Xem lại"
              : "Khui dây này"}

            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {completed && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
          <MiniStat
            label="Người hốt"
            value={
              item.winner?.full_name ??
              "Không rõ"
            }
          />

          <MiniStat
            label="Giá thăm"
            value={formatVND(
              item.period.bid_amount,
            )}
          />

          <MiniStat
            label="Tiền thảo"
            value={formatVND(
              item.period.fee_amount,
            )}
          />

          <MiniStat
            label="Tiền đã xác nhận"
            value={
              item.hasConfirmedMoney
                ? "Có"
                : "Chưa"
            }
          />
        </div>
      )}
    </Card>
  )
}

function MiniStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-0.5 break-words text-sm font-semibold">
        {value}
      </p>
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
  const {
    period,
    group,
    shares,
    hasConfirmedMoney,
  } = item

  const completed = isCompleted(period.status)
  const locked =
    hasConfirmedMoney && completed

  const groupPeriods = allPeriods
    .filter(
      (current) =>
        current.group_id === group.id,
    )
    .sort(
      (a, b) =>
        a.period_number - b.period_number,
    )

  const previousWinnerIds = useMemo(
    () =>
      new Set(
        groupPeriods
          .filter(
            (current) =>
              current.period_number <
                period.period_number &&
              isCompleted(current.status) &&
              current.winner_share_id,
          )
          .map(
            (current) =>
              current.winner_share_id as string,
          ),
      ),
    [groupPeriods, period.period_number],
  )

  const eligibleShares = useMemo(
    () =>
      [...shares]
        .filter(
          (share) =>
            share.status === "active" &&
            (!previousWinnerIds.has(
              share.id,
            ) ||
              share.id ===
                period.winner_share_id),
        )
        .sort(
          (a, b) =>
            a.share_number -
            b.share_number,
        ),
    [
      period.winner_share_id,
      previousWinnerIds,
      shares,
    ],
  )

  const wheelCandidates = useMemo<LuckyWheelCandidate[]>(
    () =>
      eligibleShares.map((share) => ({
        share,
        member:
          membersById.get(
            share.member_id,
          ) ?? null,
      })),
    [eligibleShares, membersById],
  )

  const minimumBid = Number(
    group.minimum_bid_amount || 0,
  )

  const bidStep = Number(
    group.bid_step_amount || 0,
  )

  const initialBid =
    period.bid_amount > 0
      ? Number(period.bid_amount)
      : minimumBid

  const [winnerShareId, setWinnerShareId] =
    useState(
      period.winner_share_id ?? "",
    )

  const [bidAmount, setBidAmount] =
    useState(initialBid)

  const [openedAt, setOpenedAt] =
    useState(
      defaultOpenedAt(period, group),
    )

  const [notes, setNotes] = useState(
    period.notes ?? "",
  )

  const [previewReady, setPreviewReady] =
    useState(completed)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] = useState("")

  const [wheelOpen, setWheelOpen] =
    useState(false)

  const fee = completed
    ? Number(
        period.fee_amount ||
          group.fee_amount ||
          0,
      )
    : Number(group.fee_amount || 0)

  const preview = useMemo(() => {
    const bid = Number(bidAmount || 0)

    const contribution = Number(
      group.contribution_amount || 0,
    )

    const liveContribution = Math.max(
      0,
      contribution - bid,
    )

    let livePayers = 0
    let deadPayers = 0
    let grossHui = 0

    for (const share of shares.filter(
      (share) =>
        share.status === "active",
    )) {
      if (share.id === winnerShareId) {
        continue
      }

      if (
        previousWinnerIds.has(
          share.id,
        )
      ) {
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
      livePayers,
      deadPayers,
      grossHui,
      payout: Math.max(
        0,
        grossHui - fee,
      ),
    }
  }, [
    bidAmount,
    fee,
    group.contribution_amount,
    previousWinnerIds,
    shares,
    winnerShareId,
  ])

  const winnerShare = shares.find(
    (share) =>
      share.id === winnerShareId,
  )

  const winnerMember = winnerShare
    ? membersById.get(
        winnerShare.member_id,
      ) ?? null
    : null

  function handleManualWinnerChange(
    shareId: string,
  ) {
    setWinnerShareId(shareId)

    setNotes((current) =>
      stripRandomNote(current),
    )

    setPreviewReady(false)
    setError("")
  }

  function handleRandomWinner(
    candidate: LuckyWheelCandidate,
  ) {
    const memberName =
      candidate.member?.full_name ??
      "Không rõ"

    setWinnerShareId(
      candidate.share.id,
    )

    setNotes((current) =>
      appendRandomNote(
        current,
        candidate.share.share_number,
        memberName,
      ),
    )

    setPreviewReady(false)
    setError("")
    setWheelOpen(false)
  }

  function validateBid(value: number) {
    if (value < minimumBid) {
      return `Giá thăm phải từ ${formatVND(
        minimumBid,
      )} trở lên.`
    }

    if (
      bidStep > 0 &&
      (value - minimumBid) %
        bidStep !==
        0
    ) {
      return `Giá thăm phải theo bước ${formatVND(
        bidStep,
      )}.`
    }

    if (
      value >=
      Number(
        group.contribution_amount || 0,
      )
    ) {
      return "Giá thăm phải nhỏ hơn mệnh giá mỗi chân."
    }

    return ""
  }

  function changeBid(
    direction: "down" | "up",
  ) {
    if (locked) return

    const step =
      bidStep > 0 ? bidStep : 1

    const next =
      direction === "up"
        ? bidAmount + step
        : bidAmount - step

    const safeNext = Math.max(
      minimumBid,
      next,
    )

    if (
      safeNext >=
      Number(
        group.contribution_amount || 0,
      )
    ) {
      return
    }

    setBidAmount(safeNext)
    setPreviewReady(false)
    setError("")
  }

  function calculatePreview() {
    setError("")

    if (!winnerShareId) {
      setError(
        "Bạn cần chọn chân hốt trước.",
      )
      return
    }

    const bidError =
      validateBid(bidAmount)

    if (bidError) {
      setError(bidError)
      return
    }

    setPreviewReady(true)
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError("")

    if (locked) {
      setError(
        "Kỳ này đã có tiền được xác nhận. Hãy hủy hoặc điều chỉnh xác nhận thu–chi liên quan trước khi sửa kết quả kỳ.",
      )
      return
    }

    if (!winnerShareId) {
      setError(
        "Bạn cần chọn chân hốt.",
      )
      return
    }

    const bidError =
      validateBid(bidAmount)

    if (bidError) {
      setError(bidError)
      return
    }

    if (!previewReady) {
      setError(
        "Hãy bấm Tính thử trước khi chốt kỳ.",
      )
      return
    }

    if (!openedAt) {
      setError(
        "Ngày giờ khui là bắt buộc.",
      )
      return
    }

    setSaving(true)

    try {
      const openedAtIso = new Date(
        `${openedAt}:00+07:00`,
      ).toISOString()

      const { error: updateError } =
        await createClient()
          .from("hui_periods")
          .update({
            winner_share_id:
              winnerShareId,
            bid_amount: bidAmount,
            fee_amount:
              group.fee_amount,
            opened_at: openedAtIso,
            status: "completed",
            notes:
              notes.trim() || null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", period.id)

      if (updateError) {
        throw updateError
      }

      await onSaved()
    } catch (caught) {
      console.error(caught)

      setError(
        "Không thể lưu kết quả kỳ khui.",
      )

      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/50 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            onClose()
          }
        }}
      >
        <Card className="max-h-[94vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono"
                >
                  {group.code || "CHƯA-MÃ"}
                </Badge>

                <h2 className="text-lg font-bold">
                  {completed
                    ? `Kỳ ${period.period_number} đã chốt`
                    : `Khui kỳ ${period.period_number}`}
                </h2>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                {group.name} ·{" "}
                {formatDate(
                  period.scheduled_date,
                )}
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

          {locked && (
            <Card className="mt-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />

                <p>
                  Kỳ này đã có xác nhận thu/chi. Bạn vẫn xem được kết quả nhưng app khóa việc sửa để tránh làm lệch phiếu và cân đối.
                </p>
              </div>
            </Card>
          )}

          <form
            className="mt-5 space-y-5"
            onSubmit={submit}
          >
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
              <ConfigValue
                label="Mệnh giá"
                value={formatVND(
                  group.contribution_amount,
                )}
              />

              <ConfigValue
                label="Bước thăm"
                value={formatVND(
                  bidStep,
                )}
                locked
              />

              <ConfigValue
                label="Tiền thảo"
                value={formatVND(
                  fee,
                )}
                locked
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="winner-share"
                  className="text-sm font-medium"
                >
                  Chân hốt
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={
                    locked ||
                    wheelCandidates.length === 0
                  }
                  onClick={() =>
                    setWheelOpen(true)
                  }
                  title={
                    locked
                      ? "Kỳ đã có xác nhận thu/chi nên không thể bốc thăm lại."
                      : undefined
                  }
                >
                  {locked ? (
                    <LockKeyhole className="size-4" />
                  ) : (
                    <Dices className="size-4" />
                  )}
                  {locked
                    ? "Bốc thăm · đã khóa"
                    : "Bốc thăm"}
                </Button>
              </div>

              <select
                id="winner-share"
                required
                disabled={locked}
                className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                value={winnerShareId}
                onChange={(event) =>
                  handleManualWinnerChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Chọn chân hốt
                </option>

                {eligibleShares.map(
                  (share) => {
                    const member =
                      membersById.get(
                        share.member_id,
                      )

                    return (
                      <option
                        key={share.id}
                        value={share.id}
                      >
                        Chân{" "}
                        {share.share_number} —{" "}
                        {member?.full_name ??
                          "Không rõ"}
                        {member?.phone
                          ? ` — ${member.phone}`
                          : ""}
                      </option>
                    )
                  },
                )}
              </select>

              <p className="mt-1.5 text-xs text-muted-foreground">
                {locked
                  ? "Kỳ đã có xác nhận thu/chi nên kết quả và bốc thăm được khóa."
                  : "Chỉ hiển thị các chân đang hoạt động và chưa từng hốt."}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">
                Giá thăm
              </p>

              <div className="mt-2 grid grid-cols-[52px_minmax(0,1fr)_52px] items-stretch gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={
                    locked ||
                    bidAmount <= minimumBid
                  }
                  onClick={() =>
                    changeBid("down")
                  }
                  aria-label="Giảm giá thăm"
                >
                  <Minus className="size-5" />
                </Button>

                <div className="flex h-12 items-center justify-center rounded-md border bg-background px-3 text-center text-lg font-bold tabular-nums">
                  {formatVND(bidAmount)}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={locked}
                  onClick={() =>
                    changeBid("up")
                  }
                  aria-label="Tăng giá thăm"
                >
                  <Plus className="size-5" />
                </Button>
              </div>

              <p className="mt-1.5 text-xs text-muted-foreground">
                Tối thiểu{" "}
                {formatVND(
                  minimumBid,
                )}{" "}
                · mỗi lần tăng/giảm{" "}
                {formatVND(
                  bidStep,
                )}
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ngày giờ khui

              <Input
                type="datetime-local"
                required
                disabled={locked}
                value={openedAt}
                onChange={(event) =>
                  setOpenedAt(
                    event.target.value,
                  )
                }
              />
            </label>

            {!completed && (
              <Button
                type="button"
                variant={
                  previewReady
                    ? "outline"
                    : "secondary"
                }
                className="w-full"
                onClick={
                  calculatePreview
                }
              >
                {previewReady ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    Đã tính thử
                  </>
                ) : (
                  "Tính thử"
                )}
              </Button>
            )}

            {(previewReady || completed) && (
              <Card className="p-4">
                <p className="font-semibold">
                  Kết quả kỳ này
                </p>

                <div className="mt-3 space-y-2 text-sm">
                  <CalcRow
                    label="Người hốt"
                    value={
                      winnerMember?.full_name ??
                      "Không rõ"
                    }
                  />

                  <CalcRow
                    label="Chân sống đóng"
                    value={`${preview.livePayers} chân × ${formatVND(
                      preview.liveContribution,
                    )}`}
                  />

                  <CalcRow
                    label="Chân đã hốt đóng"
                    value={`${preview.deadPayers} chân × ${formatVND(
                      preview.contribution,
                    )}`}
                  />

                  <div className="border-t pt-2">
                    <CalcRow
                      label="Tổng hốt"
                      value={formatVND(
                        preview.grossHui,
                      )}
                      strong
                    />

                    <CalcRow
                      label="Trừ tiền thảo"
                      value={`− ${formatVND(
                        fee,
                      )}`}
                    />
                  </div>

                  <div className="border-t pt-2">
                    <CalcRow
                      label="Chủ hụi giao"
                      value={formatVND(
                        preview.payout,
                      )}
                      strong
                      highlight
                    />
                  </div>
                </div>
              </Card>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ghi chú

              <textarea
                disabled={locked}
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value,
                  )
                }
                placeholder="Chỉ ghi khi kỳ này có trường hợp đặc biệt..."
              />

              <span className="text-xs font-normal text-muted-foreground">
                Nếu người hốt được chọn bằng bốc thăm, app sẽ tự ghi lại tại đây.
              </span>
            </label>

            {error && (
              <p
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Đóng
              </Button>

              {!locked && (
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    (!completed &&
                      !previewReady)
                  }
                >
                  {saving && (
                    <LoaderCircle className="size-4 animate-spin" />
                  )}

                  {completed
                    ? "Lưu chỉnh sửa"
                    : "Chốt kỳ"}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      {wheelOpen && (
        <LuckyWheelDialog
          candidates={wheelCandidates}
          onClose={() =>
            setWheelOpen(false)
          }
          onConfirm={
            handleRandomWinner
          }
        />
      )}
    </>
  )
}

function ConfigValue({
  label,
  value,
  locked = false,
}: {
  label: string
  value: string
  locked?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>{label}</span>

        {locked && (
          <LockKeyhole className="size-3" />
        )}
      </div>

      <p className="mt-1 truncate text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  )
}

function CalcRow({
  label,
  value,
  strong = false,
  highlight = false,
}: {
  label: string
  value: string
  strong?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span
        className={`shrink-0 text-right tabular-nums ${
          highlight
            ? "text-lg font-bold text-primary"
            : strong
              ? "font-bold"
              : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
