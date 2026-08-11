"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  calculateGroupPerformance,
  type PerformancePeriod,
  type PerformanceShare,
} from "@/lib/hui-performance"

type Member = {
  id: string
  full_name: string
  phone: string | null
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function amountClass(value: number) {
  return value < 0
    ? "text-destructive"
    : value > 0
      ? "text-primary"
      : ""
}

export function HuiPerformanceView({
  shares,
  periods,
  members,
}: {
  shares: PerformanceShare[]
  periods: PerformancePeriod[]
  members: Member[]
}) {
  const performance = useMemo(
    () => calculateGroupPerformance(shares, periods),
    [shares, periods],
  )
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    performance.members[0]?.memberId ?? null,
  )

  const rows = useMemo(
    () =>
      performance.members
        .map((item) => ({
          ...item,
          member: membersById.get(item.memberId),
        }))
        .sort((a, b) =>
          (a.member?.full_name ?? "").localeCompare(
            b.member?.full_name ?? "",
            "vi",
          ),
        ),
    [membersById, performance.members],
  )

  const selected =
    rows.find((item) => item.memberId === selectedMemberId) ?? rows[0] ?? null

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Tổng lãi thăm đã hưởng</p>
          <p className="mt-1 text-xl font-bold text-primary">
            {formatVND(performance.totalBenefitAmount)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">
            Tổng chi phí thăm khi hốt
          </p>
          <p className="mt-1 text-xl font-bold">
            {formatVND(performance.totalCostAmount)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">
            Hiệu quả thăm hiện tại
          </p>
          <p
            className={`mt-1 text-xl font-bold ${amountClass(
              performance.performanceAmount,
            )}`}
          >
            {formatVND(performance.performanceAmount)}
          </p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu chân hụi để tính hiệu quả.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[780px] text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        "Hụi viên",
                        "Số chân",
                        "Đã hốt",
                        "Chân sống",
                        "Đã hưởng thăm",
                        "Chi phí hốt",
                        "Hiệu quả",
                        "Chi tiết",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr
                        key={row.memberId}
                        className={
                          selected?.memberId === row.memberId
                            ? "bg-primary/5"
                            : "hover:bg-muted/30"
                        }
                      >
                        <td className="px-3 py-3 font-medium">
                          {row.member?.full_name ?? "Không rõ"}
                        </td>
                        <td className="px-3 py-3">{row.shareCount}</td>
                        <td className="px-3 py-3">{row.wonShares}</td>
                        <td className="px-3 py-3">{row.liveShares}</td>
                        <td className="px-3 py-3">
                          {formatVND(row.benefitAmount)}
                        </td>
                        <td className="px-3 py-3">
                          {formatVND(row.costAmount)}
                        </td>
                        <td
                          className={`px-3 py-3 font-semibold ${amountClass(
                            row.performanceAmount,
                          )}`}
                        >
                          {formatVND(row.performanceAmount)}
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedMemberId(row.memberId)}
                          >
                            Xem
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-border md:hidden">
                {rows.map((row) => {
                  const expanded = selected?.memberId === row.memberId
                  return (
                    <div key={row.memberId} className="p-4">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() =>
                          setSelectedMemberId(expanded ? null : row.memberId)
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {row.member?.full_name ?? "Không rõ"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {row.shareCount} chân • {row.wonShares} đã hốt •{" "}
                              {row.liveShares} chân sống
                            </p>
                          </div>
                          <span className="text-xs text-primary">
                            {expanded ? "Thu gọn" : "Xem chi tiết"}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <span className="text-muted-foreground">
                            Đã hưởng thăm
                          </span>
                          <span className="text-right font-medium">
                            {formatVND(row.benefitAmount)}
                          </span>
                          <span className="text-muted-foreground">
                            Chi phí hốt
                          </span>
                          <span className="text-right font-medium">
                            {formatVND(row.costAmount)}
                          </span>
                          <span className="font-medium">Hiệu quả</span>
                          <span
                            className={`text-right font-bold ${amountClass(
                              row.performanceAmount,
                            )}`}
                          >
                            {formatVND(row.performanceAmount)}
                          </span>
                        </div>
                      </button>
                      {expanded && <MemberDetail row={row} />}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="hidden border-l border-border p-4 md:block">
              {selected && <MemberDetail row={selected} />}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function MemberDetail({
  row,
}: {
  row: ReturnType<typeof calculateGroupPerformance>["members"][number] & {
    member?: Member
  }
}) {
  return (
    <div className="mt-4 space-y-3 md:mt-0">
      <div>
        <p className="font-semibold">
          Chi tiết {row.member?.full_name ?? "hụi viên"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {row.shareCount} chân • {row.wonShares} đã hốt • {row.liveShares} chưa
          hốt
        </p>
      </div>

      {row.shares.map((share) => (
        <Card key={share.shareId} className="p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Chân #{share.shareNumber}</p>
            <Badge variant="outline">
              {share.hasWon ? `Đã hốt kỳ ${share.wonPeriodNumber}` : "Chân sống"}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <span className="text-muted-foreground">Đã hưởng thăm</span>
            <span className="text-right font-medium">
              {formatVND(share.benefitAmount)}
            </span>
            <span className="text-muted-foreground">Chi phí khi hốt</span>
            <span className="text-right font-medium">
              {formatVND(share.costAmount)}
            </span>
            <span className="font-medium">Hiệu quả hiện tại</span>
            <span
              className={`text-right font-bold ${amountClass(
                share.performanceAmount,
              )}`}
            >
              {formatVND(share.performanceAmount)}
            </span>
          </div>
          {!share.hasWon && (
            <p className="mt-3 text-xs text-muted-foreground">
              * Chân chưa hốt nên hiệu quả chỉ là tạm tính.
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
