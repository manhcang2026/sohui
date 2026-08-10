"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  UserRound,
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
  opened_at: string | null
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

type ReceiptLine = {
  periodId: string
  groupId: string
  groupCode: string
  groupName: string
  periodNumber: number
  totalPeriods: number
  bidAmount: number
  liveShares: number
  deadShares: number
  payAmount: number
  receiveAmount: number
  feeAmount: number
  profitAmount: number
}

type Receipt = {
  member: MemberRow
  lines: ReceiptLine[]
  groupCount: number
  totalShares: number
  liveShares: number
  deadShares: number
  totalPay: number
  totalReceive: number
  totalFee: number
  totalProfit: number
  settlementAmount: number
  netAmount: number
}

const OWNER_NAME = "Chưa khai báo"
const OWNER_PHONE = "Chưa khai báo"

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

function moneyClass(value: number) {
  return value > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
}

export function PhieuThuChiPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [selectedDate, setSelectedDate] = useState(todayInVietnam())
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()
    const [groupsResult, sharesResult, periodsResult, membersResult] =
      await Promise.all([
        supabase
          .from("hui_groups")
          .select("id, code, name, contribution_amount, total_shares, fee_amount"),
        supabase
          .from("hui_shares")
          .select("id, group_id, member_id, share_number, status")
          .order("share_number"),
        supabase
          .from("hui_periods")
          .select(
            "id, group_id, period_number, scheduled_date, opened_at, winner_share_id, bid_amount, fee_amount, status",
          )
          .order("period_number"),
        supabase.from("members").select("id, full_name, phone"),
      ])

    const firstError =
      groupsResult.error ??
      sharesResult.error ??
      periodsResult.error ??
      membersResult.error

    if (firstError) {
      console.error(firstError)
      setError("Không thể tải dữ liệu để lập phiếu. Vui lòng thử lại.")
      setLoading(false)
      return
    }

    setGroups((groupsResult.data ?? []) as GroupRow[])
    setShares((sharesResult.data ?? []) as ShareRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setMembers((membersResult.data ?? []) as MemberRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const receipts = useMemo(() => {
    const groupsById = new Map(groups.map((group) => [group.id, group]))
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

    const linesByMember = new Map<string, ReceiptLine[]>()

    const dayPeriods = periods.filter(
      (period) => isCompleted(period.status) && period.scheduled_date === selectedDate,
    )

    for (const period of dayPeriods) {
      const group = groupsById.get(period.group_id)
      if (!group || !period.winner_share_id) continue

      const groupShares = (sharesByGroup.get(group.id) ?? []).filter(
        (share) => share.status === "active" || share.id === period.winner_share_id,
      )
      const groupPeriods = periodsByGroup.get(group.id) ?? []
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

      const bidAmount = Number(period.bid_amount || 0)
      const contributionAmount = Number(group.contribution_amount || 0)
      const liveContribution = Math.max(0, contributionAmount - bidAmount)

      const amountByShare = new Map<string, number>()
      let potBeforeFee = 0

      for (const share of groupShares) {
        if (share.id === period.winner_share_id) {
          amountByShare.set(share.id, 0)
          continue
        }

        const amount = previousWinnerIds.has(share.id)
          ? contributionAmount
          : liveContribution
        amountByShare.set(share.id, amount)
        potBeforeFee += amount
      }

      const winnerShare = groupShares.find(
        (share) => share.id === period.winner_share_id,
      )
      const winnerMemberId = winnerShare?.member_id ?? null
      const feeAmount = Number(period.fee_amount ?? group.fee_amount ?? 0)
      const winnerReceive = Math.max(0, potBeforeFee - feeAmount)

      const memberIds = new Set(groupShares.map((share) => share.member_id))

      for (const memberId of memberIds) {
        if (!membersById.has(memberId)) continue

        const memberShares = groupShares.filter(
          (share) => share.member_id === memberId,
        )

        let liveShares = 0
        let deadShares = 0
        let payAmount = 0
        let profitAmount = 0

        for (const share of memberShares) {
          if (share.id === period.winner_share_id) continue

          const isDead = previousWinnerIds.has(share.id)
          if (isDead) {
            deadShares += 1
          } else {
            liveShares += 1
            profitAmount += bidAmount
          }
          payAmount += amountByShare.get(share.id) ?? 0
        }

        const line: ReceiptLine = {
          periodId: period.id,
          groupId: group.id,
          groupCode: group.code ?? "",
          groupName: group.name,
          periodNumber: period.period_number,
          totalPeriods: Math.max(group.total_shares, groupPeriods.length),
          bidAmount,
          liveShares,
          deadShares,
          payAmount,
          receiveAmount: memberId === winnerMemberId ? winnerReceive : 0,
          feeAmount: memberId === winnerMemberId ? feeAmount : 0,
          profitAmount,
        }

        const current = linesByMember.get(memberId) ?? []
        current.push(line)
        linesByMember.set(memberId, current)
      }
    }

    const result: Receipt[] = []

    for (const [memberId, lines] of linesByMember.entries()) {
      const member = membersById.get(memberId)
      if (!member) continue

      const totalPay = lines.reduce((sum, line) => sum + line.payAmount, 0)
      const totalReceive = lines.reduce(
        (sum, line) => sum + line.receiveAmount,
        0,
      )
      const totalFee = lines.reduce((sum, line) => sum + line.feeAmount, 0)
      const totalProfit = lines.reduce(
        (sum, line) => sum + line.profitAmount,
        0,
      )

      result.push({
        member,
        lines: [...lines].sort((a, b) => a.groupName.localeCompare(b.groupName, "vi")),
        groupCount: new Set(lines.map((line) => line.groupId)).size,
        totalShares: lines.reduce(
          (sum, line) => sum + line.liveShares + line.deadShares,
          0,
        ),
        liveShares: lines.reduce((sum, line) => sum + line.liveShares, 0),
        deadShares: lines.reduce((sum, line) => sum + line.deadShares, 0),
        totalPay,
        totalReceive,
        totalFee,
        totalProfit,
        settlementAmount: 0,
        netAmount: totalPay - totalReceive,
      })
    }

    return result.sort((a, b) =>
      a.member.full_name.localeCompare(b.member.full_name, "vi"),
    )
  }, [groups, members, periods, selectedDate, shares])

  const preview = receipts.find(
    (receipt) => receipt.member.id === previewMemberId,
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang lập phiếu từ dữ liệu hụi...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
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

  if (preview) {
    return (
      <ReceiptPreview
        receipt={preview}
        date={selectedDate}
        onBack={() => setPreviewMemberId(null)}
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Lập phiếu thu–chi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phiếu được tự tổng hợp từ các kỳ hụi đã chốt trong ngày.
        </p>
      </div>

      <Card className="p-4">
        <label className="flex max-w-xs flex-col gap-1.5 text-sm font-medium">
          Ngày lập phiếu
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value)
              setPreviewMemberId(null)
            }}
          />
        </label>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Phiếu ngày {formatDate(selectedDate)}</p>
          <p className="text-sm text-muted-foreground">
            {receipts.length} hụi viên có phát sinh
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          <RefreshCw className="size-4" />
          Làm mới
        </Button>
      </div>

      {receipts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Chưa có phiếu trong ngày này</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hãy chốt kết quả kỳ hụi trước. Phiếu sẽ xuất hiện tự động tại đây.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <Card
              key={receipt.member.id}
              className="cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => setPreviewMemberId(receipt.member.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {receipt.member.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {receipt.groupCount} dây · {receipt.lines.length} phát sinh
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <SummaryCell label="Tiền đóng" value={formatVND(receipt.totalPay)} />
                    <SummaryCell label="Tiền hốt" value={formatVND(receipt.totalReceive)} />
                    <SummaryCell label="Tiền thảo" value={formatVND(receipt.totalFee)} />
                    <SummaryCell
                      label={receipt.netAmount >= 0 ? "Phải đóng" : "Được nhận"}
                      value={formatVND(Math.abs(receipt.netAmount))}
                      emphasize
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCell({
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
      <p className={`mt-0.5 break-words text-sm ${emphasize ? "font-bold" : "font-semibold"}`}>
        {value}
      </p>
    </div>
  )
}

function ReceiptPreview({
  receipt,
  date,
  onBack,
}: {
  receipt: Receipt
  date: string
  onBack: () => void
}) {
  const memberPays = receipt.netAmount >= 0
  const finalAmount = Math.abs(receipt.netAmount)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Quay lại">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Phiếu hụi</h1>
          <p className="text-sm text-muted-foreground">
            Bản chức năng – ưu tiên đúng dữ liệu trước khi hoàn thiện UI
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-4 sm:p-5">
          <h2 className="text-center text-xl font-bold">PHIẾU THU / CHI HỤI</h2>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label="Chủ hụi" value={OWNER_NAME} />
            <InfoRow label="SĐT chủ hụi" value={OWNER_PHONE} />
            <InfoRow label="Tên hụi viên" value={receipt.member.full_name} />
            <InfoRow label="Ngày lập phiếu" value={formatDate(date)} />
          </div>
        </div>

        <div className="border-b p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <SummaryCell label="Số dây" value={String(receipt.groupCount)} />
            <SummaryCell label="Số chân" value={String(receipt.totalShares)} />
            <SummaryCell label="Chân sống" value={String(receipt.liveShares)} />
            <SummaryCell label="Chân chết" value={String(receipt.deadShares)} />
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <h3 className="font-bold">Chi tiết nhận / đóng tiền</h3>

          {receipt.lines.map((line, index) => (
            <div key={line.periodId} className="rounded-lg border p-3.5">
              <div className="flex items-start justify-between gap-3 border-b pb-2.5">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {index + 1}. {line.groupName}
                  </p>
                  {line.groupCode && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.groupCode}
                    </p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold">
                  Kỳ {line.periodNumber}/{line.totalPeriods}
                </p>
              </div>

              <div className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
                <InfoRow label="Giá thăm" value={formatVND(line.bidAmount)} />
                <InfoRow
                  label="Chân sống / chết"
                  value={`${line.liveShares} / ${line.deadShares}`}
                />
                <InfoRow
                  label="Tiền đóng"
                  value={formatVND(line.payAmount)}
                  valueClass={moneyClass(line.payAmount)}
                />
                <InfoRow
                  label="Tiền hốt"
                  value={formatVND(line.receiveAmount)}
                  valueClass={moneyClass(line.receiveAmount)}
                />
                {line.feeAmount > 0 && (
                  <InfoRow label="Tiền thảo" value={formatVND(line.feeAmount)} />
                )}
                {line.profitAmount > 0 && (
                  <InfoRow
                    label="Lợi hụi"
                    value={formatVND(line.profitAmount)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t bg-muted/20 p-4 sm:p-5">
          <div className="space-y-2 text-sm">
            <TotalRow label="Lợi nhuận trong ngày" value={receipt.totalProfit} />
            <TotalRow label="Tổng tiền đóng hụi" value={receipt.totalPay} />
            <TotalRow label="Tổng hốt hụi" value={receipt.totalReceive} />
            <TotalRow label="Tiền thảo" value={receipt.totalFee} />
            <TotalRow label="Tất toán trong ngày" value={receipt.settlementAmount} />
          </div>

          <div className="mt-4 border-t pt-4 text-center">
            <p className="text-sm font-bold uppercase">
              {finalAmount === 0
                ? "Phiếu đã cân bằng"
                : memberPays
                  ? "Hụi viên phải đóng cho chủ hụi"
                  : "Chủ hụi phải giao cho hụi viên"}
            </p>
            <p className="mt-1 text-2xl font-black">
              {formatVND(finalAmount)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3 text-xs leading-relaxed text-muted-foreground">
        Bản này đang tính trực tiếp từ kỳ đã chốt: chân đã hốt ở kỳ trước đóng đủ
        mệnh giá; chân sống đóng mệnh giá trừ giá thăm; người hốt nhận tổng tiền
        đóng của các chân còn lại sau khi trừ tiền thảo. Phần tất toán và ghi nhận
        đã thu/đã chi sẽ được nối ở bước kế tiếp.
      </Card>
    </div>
  )
}

function InfoRow({
  label,
  value,
  valueClass = "font-medium text-foreground",
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-right ${valueClass}`}>{value}</span>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="shrink-0 font-semibold">{formatVND(value)}</span>
    </div>
  )
}
