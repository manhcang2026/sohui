"use client"

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  Dices,
  LoaderCircle,
  X,
} from "lucide-react"

import {
  LuckyWheelDialog,
  type LuckyWheelCandidate,
} from "@/components/lucky-wheel-dialog"
import {
  BidAmountControl,
  initialBidAmount,
  validateBidAmount,
} from "@/components/bid-amount-control"
import { PeriodFeeSummary } from "@/components/period-fee-summary"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type HuiShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
  status: string
}

type HuiPeriodRow = {
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

type GroupDetail = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  fee_amount: number
  minimum_bid_amount: number
  bid_step_amount: number
  opening_time: string | null
  shares: HuiShareRow[]
  periods: HuiPeriodRow[]
}

function formatVND(value: number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [year, month, day] = value.slice(0, 10).split("-")
  return `${day}/${month}/${year}`
}

function isFinishedPeriod(status: string) {
  return status === "completed" || status === "opened"
}

function timeInVietnam() {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
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

export function PeriodResultDialog({
  day,
  period,
  membersById,
  onClose,
  onSaved,
}: {
  day: GroupDetail
  period: HuiPeriodRow
  membersById: ReadonlyMap<string, MemberRow>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [sourceShares, setSourceShares] =
    useState<HuiShareRow[]>(day.shares)
  const [sourcePeriods, setSourcePeriods] =
    useState<HuiPeriodRow[]>(day.periods)
  const [freshMembers, setFreshMembers] =
    useState<ReadonlyMap<string, MemberRow>>(membersById)
  const [checkingEligibility, setCheckingEligibility] =
    useState(true)
  const [moneyLockState, setMoneyLockState] = useState<
    "checking" | "locked" | "unlocked" | "unknown"
  >("checking")

  useEffect(() => {
    let cancelled = false

    async function loadFreshEligibility() {
      const supabase = createClient()
      const pageSize = 1000

      try {
        const shares: HuiShareRow[] = []
        const periods: HuiPeriodRow[] = []

        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from("hui_shares")
            .select(
              "id, group_id, member_id, share_number, status",
            )
            .eq("group_id", day.id)
            .order("share_number")
            .order("id")
            .range(from, from + pageSize - 1)

          if (error) throw error

          const rows = (data ?? []) as HuiShareRow[]
          shares.push(...rows)

          if (rows.length < pageSize) break
        }

        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from("hui_periods")
            .select(
              "id, group_id, period_number, scheduled_date, scheduled_at, opened_at, winner_share_id, bid_amount, fee_amount, status, notes",
            )
            .eq("group_id", day.id)
            .order("period_number")
            .order("id")
            .range(from, from + pageSize - 1)

          if (error) throw error

          const rows = (data ?? []) as HuiPeriodRow[]
          periods.push(...rows)

          if (rows.length < pageSize) break
        }

        const memberIds = [
          ...new Set(shares.map((share) => share.member_id)),
        ]

        const memberMap = new Map<string, MemberRow>()

        for (let index = 0; index < memberIds.length; index += 100) {
          const ids = memberIds.slice(index, index + 100)
          if (ids.length === 0) continue

          const { data, error } = await supabase
            .from("members")
            .select("id, full_name, phone")
            .in("id", ids)

          if (error) throw error

          for (const member of (data ?? []) as MemberRow[]) {
            memberMap.set(member.id, member)
          }
        }

        if (cancelled) return

        setSourceShares(shares)
        setSourcePeriods(periods)
        setFreshMembers(memberMap)
      } catch (caught) {
        console.error("period eligibility refresh:", caught)
        // Không chặn thao tác nếu refresh thất bại; dùng dữ liệu đã có
        // từ trang Dây hụi và báo nhẹ để người dùng biết.
        if (!cancelled) {
          setError(
            "Không thể đối chiếu lại danh sách bốc thăm. Đang dùng dữ liệu hiện có; bạn nên bấm Hủy và thử lại nếu nghi ngờ dữ liệu chưa mới.",
          )
        }
      } finally {
        if (!cancelled) {
          setCheckingEligibility(false)
        }
      }
    }

    void loadFreshEligibility()

    return () => {
      cancelled = true
    }
  }, [day.id])

  useEffect(() => {
    let cancelled = false

    async function checkActiveMoney() {
      setMoneyLockState("checking")
      const supabase = createClient()

      try {
        const { data: sourcePayments, error: sourceError } = await supabase
          .from("receipt_payments")
          .select("id")
          .eq("status", "active")
          .eq("source_period_id", period.id)
          .limit(1)

        if (sourceError) throw sourceError
        if ((sourcePayments ?? []).length > 0) {
          if (!cancelled) setMoneyLockState("locked")
          return
        }

        const memberIds = [
          ...new Set(day.shares.map((share) => share.member_id)),
        ]
        const receiptIds: string[] = []

        for (let index = 0; index < memberIds.length; index += 100) {
          const ids = memberIds.slice(index, index + 100)
          if (ids.length === 0) continue

          const { data, error } = await supabase
            .from("hui_receipts")
            .select("id")
            .eq("receipt_date", period.scheduled_date)
            .in("member_id", ids)

          if (error) throw error
          receiptIds.push(...(data ?? []).map((row) => row.id as string))
        }

        for (let index = 0; index < receiptIds.length; index += 100) {
          const ids = receiptIds.slice(index, index + 100)
          const { data, error } = await supabase
            .from("receipt_payments")
            .select("id")
            .eq("status", "active")
            .in("receipt_id", ids)
            .limit(1)

          if (error) throw error
          if ((data ?? []).length > 0) {
            if (!cancelled) setMoneyLockState("locked")
            return
          }
        }

        if (!cancelled) setMoneyLockState("unlocked")
      } catch (caught) {
        console.error("period money lock check:", caught)
        if (!cancelled) {
          setMoneyLockState("unknown")
          setError(
            "Không thể xác minh kỳ đã phát sinh tiền hay chưa. App tạm khóa chỉnh sửa; hãy đóng và thử lại.",
          )
        }
      }
    }

    void checkActiveMoney()

    return () => {
      cancelled = true
    }
  }, [day.shares, period.id, period.scheduled_date])

  const previousWinnerIds = useMemo(
    () =>
      new Set(
        sourcePeriods
          .filter(
            (item) =>
              item.period_number < period.period_number &&
              isFinishedPeriod(item.status) &&
              item.winner_share_id,
          )
          .map((item) => item.winner_share_id as string),
      ),
    [period.period_number, sourcePeriods],
  )

  const eligibleShares = useMemo(
    () =>
      [...sourceShares]
        .filter(
          (share) =>
            (share.status === "active" &&
              !previousWinnerIds.has(share.id)) ||
            share.id === period.winner_share_id,
        )
        .sort((a, b) => a.share_number - b.share_number),
    [
      sourceShares,
      period.winner_share_id,
      previousWinnerIds,
    ],
  )

  const wheelCandidates = useMemo<LuckyWheelCandidate[]>(
    () =>
      eligibleShares.map((share) => ({
        share: {
          id: share.id,
          share_number: share.share_number,
        },
        member: freshMembers.get(share.member_id)
          ? {
              full_name:
                freshMembers.get(share.member_id)!.full_name,
            }
          : null,
      })),
    [eligibleShares, freshMembers],
  )

  const defaultOpenedAt = period.opened_at
    ? new Date(period.opened_at)
        .toLocaleString("sv-SE", {
          timeZone: "Asia/Ho_Chi_Minh",
        })
        .slice(0, 16)
    : `${period.scheduled_date}T${
        day.opening_time?.slice(0, 5) ?? "19:00"
      }`

  const [winnerShareId, setWinnerShareId] = useState(
    period.winner_share_id ?? "",
  )
  const [bidAmount, setBidAmount] = useState(() =>
    initialBidAmount({
      storedBid: period.bid_amount,
      hasStoredResult:
        isFinishedPeriod(period.status) ||
        period.winner_share_id !== null,
      minimumBid: Number(day.minimum_bid_amount ?? 0),
    }),
  )
  const [openedAt, setOpenedAt] = useState(defaultOpenedAt)
  const [notes, setNotes] = useState(period.notes ?? "")
  const [wheelOpen, setWheelOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const minBid = Number(day.minimum_bid_amount ?? 0)
  const bidStep = Number(day.bid_step_amount ?? 0)
  const finished = isFinishedPeriod(period.status)
  const locked =
    period.scheduled_date < "2026-08-12" ||
    moneyLockState !== "unlocked"

  function handleManualWinnerChange(shareId: string) {
    setWinnerShareId(shareId)
    setNotes((current) => stripRandomNote(current))
    setError("")
  }

  function handleRandomWinner(
    candidate: LuckyWheelCandidate,
  ) {
    setWinnerShareId(candidate.share.id)
    setNotes((current) =>
      appendRandomNote(
        current,
        candidate.share.share_number,
        candidate.member?.full_name ?? "Không rõ",
      ),
    )
    setError("")
    setWheelOpen(false)
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError("")

    if (locked) {
      setError(
        moneyLockState === "checking"
          ? "Đang kiểm tra giao dịch tiền liên quan. Vui lòng chờ."
          : "Kỳ đã có giao dịch tiền liên quan hoặc thuộc baseline lịch sử nên không thể sửa kết quả.",
      )
      return
    }

    if (!winnerShareId) {
      setError("Bạn cần chọn chân hốt.")
      return
    }

    const bidError = validateBidAmount({
      value: bidAmount,
      minimumBid: minBid,
      bidStep,
      contributionAmount: Number(day.contribution_amount ?? 0),
    })

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
      const openedAtIso = new Date(
        `${openedAt}:00+07:00`,
      ).toISOString()

      const { error: updateError } = await createClient().rpc(
        "update_hui_period_result_atomic",
        {
          p_period_id: period.id,
          p_winner_share_id: winnerShareId,
          p_bid_amount: bidAmount,
          p_fee_amount: day.fee_amount,
          p_opened_at: openedAtIso,
          p_status: "completed",
          p_notes: notes.trim() || null,
        },
      )

      if (updateError) throw updateError

      await onSaved()
    } catch (caught) {
      console.error(caught)
      setError("Không thể lưu kết quả kỳ khui.")
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-dialog-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose()
          }
        }}
      >
        <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="period-dialog-title"
                className="text-lg font-bold"
              >
                {finished
                  ? `Sửa kết quả kỳ ${period.period_number}`
                  : `Nhập kết quả kỳ ${period.period_number}`}
              </h2>
              <p className="text-sm text-muted-foreground">
                {day.code} • {day.name} •{" "}
                {formatDate(period.scheduled_date)}
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

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={submit}
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="period-result-winner"
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
                    finished ||
                    checkingEligibility ||
                    wheelCandidates.length === 0
                  }
                  title={
                    finished
                      ? "Kỳ đã chốt. Nếu cần sửa, hãy chọn chân hốt thủ công."
                      : undefined
                  }
                  onClick={() => setWheelOpen(true)}
                >
                  <Dices className="size-4" />
                  {checkingEligibility
                    ? "Đang đối chiếu..."
                    : finished
                      ? "Bốc thăm · đã chốt"
                      : "Bốc thăm"}
                </Button>
              </div>

              <select
                id="period-result-winner"
                required
                disabled={locked}
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
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

                {eligibleShares.map((share) => {
                  const member =
                    freshMembers.get(share.member_id)

                  return (
                    <option
                      key={share.id}
                      value={share.id}
                    >
                      Chân {share.share_number} —{" "}
                      {member?.full_name ?? "Không rõ"}
                    </option>
                  )
                })}
              </select>

              <p className="mt-1.5 text-xs text-muted-foreground">
                {finished
                  ? "Kỳ đã chốt nên không quay lại ngẫu nhiên; vẫn có thể sửa thủ công nếu trước đó nhập sai."
                  : "Bốc thăm dùng cùng vòng quay với màn Khui kỳ và chỉ lấy các chân đang hoạt động, chưa từng hốt."}
              </p>
            </div>

            <BidAmountControl
              value={bidAmount}
              onChange={setBidAmount}
              minimumBid={minBid}
              bidStep={bidStep}
              contributionAmount={Number(day.contribution_amount ?? 0)}
              disabled={locked}
              onInteraction={() => setError("")}
            />
            <PeriodFeeSummary value={formatVND(day.fee_amount)} />

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ngày giờ đã khui
              <Input
                type="datetime-local"
                required
                disabled={locked}
                value={openedAt}
                onChange={(event) =>
                  setOpenedAt(event.target.value)
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ghi chú
              <textarea
                disabled={locked}
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Ghi chú nếu kỳ này có điều chỉnh đặc biệt..."
              />
            </label>

            {error && (
              <p
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Hủy
              </Button>

              <Button
                type="submit"
                disabled={saving || locked}
              >
                {saving && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                {finished
                  ? "Lưu chỉnh sửa"
                  : "Chốt kỳ"}
              </Button>
            </div>

            {finished && (
              <p className="text-xs text-muted-foreground">
                Bạn có thể sửa lại người hốt,
                giá thăm, ngày giờ và ghi chú
                nếu trước đó nhập sai. Tiền thảo
                luôn cố định theo dây.
              </p>
            )}
          </form>
        </Card>
      </div>

      {wheelOpen && (
        <LuckyWheelDialog
          candidates={wheelCandidates}
          onClose={() => setWheelOpen(false)}
          onConfirm={handleRandomWinner}
        />
      )}
    </>
  )
}
