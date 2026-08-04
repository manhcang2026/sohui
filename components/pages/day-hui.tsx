"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type HuiGroupRow = {
  id: string
  name: string
  contribution_amount: number
  total_shares: number
  interval_days: number | null
  start_date: string
  fee_amount: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

type HuiShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
  status: string
  joined_at: string | null
  notes: string | null
  created_at: string
}

type HuiPeriodRow = {
  id: string
  group_id: string
  period_number: number
  scheduled_date: string
  opened_at: string | null
  winner_share_id: string | null
  bid_amount: number
  fee_amount: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type GroupDetail = HuiGroupRow & {
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

function frequencyLabel(days: number | null) {
  if (!days) return "Chưa đặt"
  if (days === 7) return "Hàng tuần"
  if (days === 14) return "2 tuần/lần"
  if (days >= 28 && days <= 31) return "Hàng tháng"
  return `${days} ngày/lần`
}

function groupStatusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Đang hoạt động",
    completed: "Đã kết thúc",
    cancelled: "Đã hủy",
    draft: "Bản nháp",
  }
  return labels[status] ?? status
}

function periodStatusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: "Sắp tới",
    opened: "Đã khui",
    completed: "Đã chốt",
    cancelled: "Đã hủy",
  }
  return labels[status] ?? status
}

function isFinishedPeriod(status: string) {
  return status === "completed" || status === "opened"
}

export function DayHuiPage() {
  const [groups, setGroups] = useState<HuiGroupRow[]>([])
  const [shares, setShares] = useState<HuiShareRow[]>([])
  const [periods, setPeriods] = useState<HuiPeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
          .select(
            "id, name, contribution_amount, total_shares, interval_days, start_date, fee_amount, status, notes, created_at, updated_at",
          )
          .order("start_date", { ascending: false }),
        supabase
          .from("hui_shares")
          .select(
            "id, group_id, member_id, share_number, status, joined_at, notes, created_at",
          )
          .order("share_number"),
        supabase
          .from("hui_periods")
          .select(
            "id, group_id, period_number, scheduled_date, opened_at, winner_share_id, bid_amount, fee_amount, status, notes, created_at, updated_at",
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
      setError("Không thể tải dữ liệu dây hụi. Vui lòng thử lại.")
      setLoading(false)
      return
    }

    setGroups((groupsResult.data ?? []) as HuiGroupRow[])
    setShares((sharesResult.data ?? []) as HuiShareRow[])
    setPeriods((periodsResult.data ?? []) as HuiPeriodRow[])
    setMembers((membersResult.data ?? []) as MemberRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selected = useMemo<GroupDetail | null>(() => {
    const group = groups.find((item) => item.id === selectedId)
    if (!group) return null

    return {
      ...group,
      shares: shares.filter((item) => item.group_id === group.id),
      periods: periods.filter((item) => item.group_id === group.id),
    }
  }, [groups, periods, selectedId, shares])

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải dây hụi...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
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

  if (selected) {
    return (
      <DayDetail
        day={selected}
        membersById={membersById}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  return (
    <DayList
      groups={groups}
      shares={shares}
      periods={periods}
      onSelect={setSelectedId}
    />
  )
}

function DayList({
  groups,
  shares,
  periods,
  onSelect,
}: {
  groups: HuiGroupRow[]
  shares: HuiShareRow[]
  periods: HuiPeriodRow[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dây hụi</h1>
          <p className="text-sm text-muted-foreground">
            Dữ liệu đang lấy trực tiếp từ Supabase
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {groups.length} dây
        </span>
      </div>

      {groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="font-medium">Chưa có dây hụi</p>
          <p className="text-sm text-muted-foreground">
            Bước kế tiếp sẽ bổ sung chức năng tạo dây hụi mới.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupShares = shares.filter(
              (share) => share.group_id === group.id,
            )
            const groupPeriods = periods.filter(
              (period) => period.group_id === group.id,
            )
            const finishedPeriods = groupPeriods.filter((period) =>
              isFinishedPeriod(period.status),
            ).length
            const totalPeriods = Math.max(
              group.total_shares,
              groupPeriods.length,
              1,
            )
            const progress = Math.min(
              100,
              Math.round((finishedPeriods / totalPeriods) * 100),
            )
            const activeShares = groupShares.filter(
              (share) => share.status === "active",
            ).length
            const inactiveShares = groupShares.length - activeShares
            const nextPeriod = groupPeriods
              .filter((period) => period.status === "scheduled")
              .sort((a, b) =>
                a.scheduled_date.localeCompare(b.scheduled_date),
              )[0]

            return (
              <Card
                key={group.id}
                className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                onClick={() => onSelect(group.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold">
                        {group.name}
                      </h2>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {frequencyLabel(group.interval_days)}
                      </Badge>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {groupStatusLabel(group.status)}
                      </Badge>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatVND(group.contribution_amount)}/chân</span>
                      <span>Thảo: {formatVND(group.fee_amount)}</span>
                      <span>
                        Kỳ tiếp:{" "}
                        {nextPeriod
                          ? formatDate(nextPeriod.scheduled_date)
                          : "Chưa có"}
                      </span>
                    </div>

                    <div className="mb-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="w-20 text-right text-xs font-medium">
                        {finishedPeriods}/{totalPeriods} kỳ
                      </span>
                    </div>

                    <div className="flex gap-3 text-xs">
                      <span className="font-medium text-status-green-fg">
                        {activeShares} chân hoạt động
                      </span>
                      {inactiveShares > 0 && (
                        <span className="text-status-red-fg">
                          {inactiveShares} chân ngưng
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DayDetail({
  day,
  membersById,
  onBack,
}: {
  day: GroupDetail
  membersById: Map<string, MemberRow>
  onBack: () => void
}) {
  const completedPeriods = day.periods.filter((period) =>
    isFinishedPeriod(period.status),
  )
  const totalPeriods = Math.max(day.total_shares, day.periods.length, 1)
  const progress = Math.min(
    100,
    Math.round((completedPeriods.length / totalPeriods) * 100),
  )
  const nextPeriod = day.periods
    .filter((period) => period.status === "scheduled")
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0]

  const winnerMember = (period: HuiPeriodRow) => {
    if (!period.winner_share_id) return null
    const share = day.shares.find(
      (item) => item.id === period.winner_share_id,
    )
    return share ? membersById.get(share.member_id) ?? null : null
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="size-8"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{day.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatVND(day.contribution_amount)}/chân • {day.total_shares} chân
            • Kỳ tiếp:{" "}
            {nextPeriod ? formatDate(nextPeriod.scheduled_date) : "Chưa có"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="tongquan">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tongquan" className="text-xs">
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="chan" className="text-xs">
            Chân hụi
          </TabsTrigger>
          <TabsTrigger value="lich" className="text-xs">
            Lịch kỳ
          </TabsTrigger>
          <TabsTrigger value="lichsu" className="text-xs">
            Lịch sử
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tongquan" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: "Tiến độ",
                value: `${completedPeriods.length}/${totalPeriods} kỳ`,
              },
              {
                label: "Mệnh giá",
                value: formatVND(day.contribution_amount),
              },
              { label: "Tiền thảo", value: formatVND(day.fee_amount) },
              {
                label: "Chu kỳ",
                value: frequencyLabel(day.interval_days),
              },
            ].map((item) => (
              <Card key={item.label} className="p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 text-base font-semibold">{item.value}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Tiến độ khui</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Kỳ 1</span>
              <span>Kỳ {totalPeriods}</span>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3 text-center">
            <Card className="p-3">
              <p className="text-2xl font-bold text-status-green-fg">
                {
                  day.shares.filter((share) => share.status === "active")
                    .length
                }
              </p>
              <p className="text-xs text-muted-foreground">Chân hoạt động</p>
            </Card>
            <Card className="p-3">
              <p className="text-2xl font-bold text-status-red-fg">
                {
                  day.shares.filter((share) => share.status !== "active")
                    .length
                }
              </p>
              <p className="text-xs text-muted-foreground">Chân tạm ngưng</p>
            </Card>
            <Card className="p-3">
              <p className="text-2xl font-bold text-primary">
                {
                  new Set(
                    completedPeriods
                      .map((period) => period.winner_share_id)
                      .filter(Boolean),
                  ).size
                }
              </p>
              <p className="text-xs text-muted-foreground">Đã hốt</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chan" className="mt-3">
          <Card className="overflow-hidden">
            {day.shares.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Dây này chưa có chân hụi.
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "#",
                          "Hụi viên",
                          "SĐT",
                          "Trạng thái",
                          "Đã hốt",
                          "Kỳ hốt",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {day.shares.map((share) => {
                        const member = membersById.get(share.member_id)
                        const wonPeriod = completedPeriods.find(
                          (period) => period.winner_share_id === share.id,
                        )
                        return (
                          <tr key={share.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                              {share.share_number}
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              {member?.full_name ?? "Không rõ"}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {member?.phone ?? "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant={
                                  share.status === "active"
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {share.status === "active"
                                  ? "Hoạt động"
                                  : share.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              {wonPeriod ? (
                                <span className="font-medium text-status-green-fg">
                                  Đã hốt
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  Chưa
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {wonPeriod
                                ? `Kỳ ${wonPeriod.period_number}`
                                : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border md:hidden">
                  {day.shares.map((share) => {
                    const member = membersById.get(share.member_id)
                    const wonPeriod = completedPeriods.find(
                      (period) => period.winner_share_id === share.id,
                    )
                    return (
                      <div
                        key={share.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 font-mono text-xs text-muted-foreground">
                            {share.share_number}
                          </span>
                          <div>
                            <p className="text-sm font-medium">
                              {member?.full_name ?? "Không rõ"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member?.phone ?? "Chưa có SĐT"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {wonPeriod && (
                            <p className="text-xs text-status-green-fg">
                              Hốt kỳ {wonPeriod.period_number}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {share.status === "active"
                              ? "Hoạt động"
                              : share.status}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="lich" className="mt-3">
          <Card className="overflow-hidden">
            {day.periods.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Dây này chưa có lịch kỳ.
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Kỳ",
                          "Ngày",
                          "Người hốt",
                          "Tiền bỏ",
                          "Tiền thảo",
                          "Trạng thái",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {day.periods.map((period) => {
                        const winner = winnerMember(period)
                        return (
                          <tr key={period.id} className="hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-mono font-semibold">
                              {period.period_number}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {formatDate(period.scheduled_date)}
                            </td>
                            <td className="px-4 py-2.5 font-medium">
                              {winner?.full_name ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 text-primary">
                              {period.winner_share_id
                                ? formatVND(period.bid_amount)
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">
                              {formatVND(period.fee_amount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline">
                                {periodStatusLabel(period.status)}
                              </Badge>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border md:hidden">
                  {day.periods.map((period) => {
                    const winner = winnerMember(period)
                    return (
                      <div
                        key={period.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-secondary">
                            <Calendar className="size-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">
                              Kỳ {period.period_number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(period.scheduled_date)} •{" "}
                              {winner?.full_name ?? "Chưa có người hốt"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {periodStatusLabel(period.status)}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="lichsu" className="mt-3">
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {[...completedPeriods]
                .sort((a, b) => b.period_number - a.period_number)
                .map((period) => {
                  const winner = winnerMember(period)
                  return (
                    <div key={period.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold">
                            Kỳ {period.period_number} —{" "}
                            {winner?.full_name ?? "Chưa xác định"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Ngày {formatDate(period.scheduled_date)} • Tiền bỏ:{" "}
                            {formatVND(period.bid_amount)} • Thảo:{" "}
                            {formatVND(period.fee_amount)}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {periodStatusLabel(period.status)}
                        </Badge>
                      </div>
                    </div>
                  )
                })}

              {completedPeriods.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có kỳ nào được khui.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
