"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type FrequencyType = "days" | "weeks" | "months"

type HuiGroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  interval_days: number | null
  start_date: string
  fee_amount: number
  minimum_bid_amount: number
  bid_step_amount: number
  status: string
  notes: string | null
  frequency_type: FrequencyType
  frequency_value: number
  opening_time: string | null
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
  scheduled_at: string | null
  opened_at: string | null
  winner_share_id: string | null
  bid_amount: number
  fee_amount: number
  minimum_bid_amount: number
  bid_step_amount: number
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

type GroupForm = {
  code: string
  name: string
  contribution_amount: string
  total_shares: string
  frequency_type: FrequencyType
  frequency_value: string
  start_date: string
  opening_time: string
  fee_amount: string
  minimum_bid_amount: string
  bid_step_amount: string
  status: string
  notes: string
}

const EMPTY_FORM: GroupForm = {
  code: "",
  name: "",
  contribution_amount: "",
  total_shares: "",
  frequency_type: "weeks",
  frequency_value: "1",
  start_date: "",
  opening_time: "19:00",
  fee_amount: "0",
  status: "active",
  notes: "",
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

function formatTime(value: string | null | undefined) {
  if (!value) return "—"
  return value.slice(0, 5)
}

function frequencyLabel(type: FrequencyType, value: number) {
  if (type === "days") {
    return value === 1 ? "Hàng ngày" : `${value} ngày/lần`
  }
  if (type === "weeks") {
    return value === 1 ? "Hàng tuần" : `${value} tuần/lần`
  }
  return value === 1 ? "Hàng tháng" : `${value} tháng/lần`
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

function toDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addMonthsClamped(source: Date, monthsToAdd: number, preferredDay: number) {
  const targetYear = source.getFullYear()
  const targetMonth = source.getMonth() + monthsToAdd
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  return new Date(targetYear, targetMonth, Math.min(preferredDay, lastDay))
}

function generateSchedule(
  startDate: string,
  openingTime: string,
  totalPeriods: number,
  frequencyType: FrequencyType,
  frequencyValue: number,
  feeAmount: number,
) {
  const [year, month, day] = startDate.split("-").map(Number)
  const baseDate = new Date(year, month - 1, day)
  const preferredDay = day

  return Array.from({ length: totalPeriods }, (_, index) => {
    let date: Date

    if (frequencyType === "months") {
      date = addMonthsClamped(
        baseDate,
        index * frequencyValue,
        preferredDay,
      )
    } else {
      const multiplier = frequencyType === "weeks" ? 7 : 1
      date = new Date(baseDate)
      date.setDate(
        baseDate.getDate() + index * frequencyValue * multiplier,
      )
    }

    const scheduledDate = toDateOnly(date)
    const scheduledAt = openingTime
      ? `${scheduledDate}T${openingTime}:00+07:00`
      : null

    return {
      period_number: index + 1,
      scheduled_date: scheduledDate,
      scheduled_at: scheduledAt,
      bid_amount: 0,
      fee_amount: feeAmount,
      status: "scheduled",
      notes: null,
    }
  })
}


function calculateEstimatedEndDate(
  startDate: string,
  totalPeriods: number,
  frequencyType: FrequencyType,
  frequencyValue: number,
) {
  if (!startDate || totalPeriods <= 0 || frequencyValue <= 0) return null

  const [year, month, day] = startDate.split("-").map(Number)
  const baseDate = new Date(year, month - 1, day)
  const lastIndex = totalPeriods - 1

  if (frequencyType === "months") {
    return toDateOnly(
      addMonthsClamped(
        baseDate,
        lastIndex * frequencyValue,
        day,
      ),
    )
  }

  const multiplier = frequencyType === "weeks" ? 7 : 1
  const result = new Date(baseDate)
  result.setDate(
    baseDate.getDate() + lastIndex * frequencyValue * multiplier,
  )
  return toDateOnly(result)
}

function numericValue(value: string) {
  const digits = value.replace(/\D/g, "")
  return digits ? Number(digits) : 0
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "")
  if (!digits) return ""
  return new Intl.NumberFormat("vi-VN").format(Number(digits))
}

function autoCode(groups: HuiGroupRow[]) {
  const maxNumber = groups.reduce((max, group) => {
    const match = group.code?.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `HUI-${String(maxNumber + 1).padStart(3, "0")}`
}

export function DayHuiPage() {
  const [groups, setGroups] = useState<HuiGroupRow[]>([])
  const [shares, setShares] = useState<HuiShareRow[]>([])
  const [periods, setPeriods] = useState<HuiPeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState<
    HuiGroupRow | null | undefined
  >(undefined)
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
            "id, code, name, contribution_amount, total_shares, interval_days, start_date, fee_amount, minimum_bid_amount, bid_step_amount, status, notes, frequency_type, frequency_value, opening_time, created_at, updated_at",
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
            "id, group_id, period_number, scheduled_date, scheduled_at, opened_at, winner_share_id, bid_amount, fee_amount, status, notes, created_at, updated_at",
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

  return (
    <>
      {selected ? (
        <DayDetail
          day={selected}
          members={members}
          membersById={membersById}
          onBack={() => setSelectedId(null)}
          onEdit={() => setEditingGroup(selected)}
          onDataChanged={loadData}
        />
      ) : (
        <DayList
          groups={groups}
          shares={shares}
          periods={periods}
          onSelect={setSelectedId}
          onCreate={() => setEditingGroup(null)}
        />
      )}

      {editingGroup !== undefined && (
        <GroupDialog
          group={editingGroup}
          groups={groups}
          periods={periods}
          onClose={() => setEditingGroup(undefined)}
          onSaved={async (savedId) => {
            setEditingGroup(undefined)
            await loadData()
            setSelectedId(savedId)
          }}
        />
      )}
    </>
  )
}

function DayList({
  groups,
  shares,
  periods,
  onSelect,
  onCreate,
}: {
  groups: HuiGroupRow[]
  shares: HuiShareRow[]
  periods: HuiPeriodRow[]
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dây hụi</h1>
          <p className="text-sm text-muted-foreground">
            {groups.length} dây
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="size-4" />
          Tạo dây hụi
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Users className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Chưa có dây hụi</p>
            <p className="text-sm text-muted-foreground">
              Tạo dây đầu tiên, hệ thống sẽ tự sinh toàn bộ lịch khui.
            </p>
          </div>
          <Button onClick={onCreate}>
            <Plus className="size-4" />
            Tạo dây đầu tiên
          </Button>
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
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {group.code ?? "Chưa có mã"}
                      </Badge>
                      <h2 className="truncate text-base font-semibold">
                        {group.name}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {groupStatusLabel(group.status)}
                      </Badge>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatVND(group.contribution_amount)}/chân</span>
                      <span>
                        {frequencyLabel(
                          group.frequency_type,
                          group.frequency_value,
                        )}
                      </span>
                      <span>Giờ khui: {formatTime(group.opening_time)}</span>
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

                    <p className="text-xs font-medium text-status-green-fg">
                      {activeShares}/{group.total_shares} chân đã gán
                    </p>
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

function GroupDialog({
  group,
  groups,
  periods,
  onClose,
  onSaved,
}: {
  group: HuiGroupRow | null
  groups: HuiGroupRow[]
  periods: HuiPeriodRow[]
  onClose: () => void
  onSaved: (groupId: string) => void
}) {
  const groupPeriods = group
    ? periods.filter((period) => period.group_id === group.id)
    : []
  const scheduleLocked = groupPeriods.some(
    (period) =>
      period.status === "opened" ||
      period.status === "completed" ||
      period.winner_share_id,
  )

  const [form, setForm] = useState<GroupForm>(
    group
      ? {
          code: group.code ?? "",
          name: group.name,
          contribution_amount: formatMoneyInput(String(group.contribution_amount)),
          total_shares: String(group.total_shares),
          frequency_type: group.frequency_type,
          frequency_value: String(group.frequency_value),
          start_date: group.start_date,
          opening_time: group.opening_time?.slice(0, 5) ?? "19:00",
          fee_amount: formatMoneyInput(String(group.fee_amount)),
          minimum_bid_amount: formatMoneyInput(
            String(group.minimum_bid_amount ?? 0),
          ),
          bid_step_amount: formatMoneyInput(
            String(group.bid_step_amount ?? 0),
          ),
          status: group.status,
          notes: group.notes ?? "",
        }
      : {
          ...EMPTY_FORM,
          code: autoCode(groups),
        },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [feeManuallyEdited, setFeeManuallyEdited] = useState(Boolean(group))

  const setField = (key: keyof GroupForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const contributionAmount = numericValue(form.contribution_amount)
    const totalShares = Number(form.total_shares)
    const frequencyValue = Number(form.frequency_value)
    const feeAmount = numericValue(form.fee_amount)
    const minimumBidAmount = numericValue(form.minimum_bid_amount)
    const bidStepAmount = numericValue(form.bid_step_amount)

    if (!form.code.trim()) {
      setError("Mã dây là bắt buộc.")
      return
    }
    if (!form.name.trim()) {
      setError("Tên dây là bắt buộc.")
      return
    }
    if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
      setError("Mệnh giá phải lớn hơn 0.")
      return
    }
    if (!Number.isInteger(totalShares) || totalShares <= 0) {
      setError("Tổng số chân phải là số nguyên lớn hơn 0.")
      return
    }
    if (!Number.isInteger(frequencyValue) || frequencyValue <= 0) {
      setError("Khoảng cách chu kỳ phải lớn hơn 0.")
      return
    }
    if (minimumBidAmount < 0) {
      setError("Giá thăm tối thiểu không được âm.")
      return
    }
    if (bidStepAmount <= 0) {
      setError("Bước thăm phải lớn hơn 0.")
      return
    }
    if (!form.start_date) {
      setError("Ngày khui đầu tiên là bắt buộc.")
      return
    }
    if (!form.opening_time) {
      setError("Giờ khui là bắt buộc.")
      return
    }

    setSaving(true)
    const supabase = createClient()

    const intervalDays =
      form.frequency_type === "days"
        ? frequencyValue
        : form.frequency_type === "weeks"
          ? frequencyValue * 7
          : 30 * frequencyValue

    const groupPayload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      contribution_amount: contributionAmount,
      total_shares: totalShares,
      interval_days: intervalDays,
      start_date: form.start_date,
      fee_amount: scheduleLocked && group ? group.fee_amount : feeAmount,
      minimum_bid_amount: minimumBidAmount,
      bid_step_amount: bidStepAmount,
      status: form.status,
      notes: form.notes.trim() || null,
      frequency_type: form.frequency_type,
      frequency_value: frequencyValue,
      opening_time: form.opening_time,
      updated_at: new Date().toISOString(),
    }

    if (!group) {
      const { data: created, error: createError } = await supabase
        .from("hui_groups")
        .insert(groupPayload)
        .select("id")
        .single()

      if (createError || !created) {
        console.error(createError)
        setError(
          createError?.code === "23505"
            ? "Mã dây đã tồn tại. Hãy dùng mã khác."
            : "Không thể tạo dây hụi.",
        )
        setSaving(false)
        return
      }

      const schedule = generateSchedule(
        form.start_date,
        form.opening_time,
        totalShares,
        form.frequency_type,
        frequencyValue,
        feeAmount,
      ).map((period) => ({
        ...period,
        group_id: created.id,
      }))

      const { error: periodsError } = await supabase
        .from("hui_periods")
        .insert(schedule)

      if (periodsError) {
        console.error(periodsError)
        await supabase.from("hui_groups").delete().eq("id", created.id)
        setError("Không thể tạo lịch khui. Dây hụi chưa được lưu.")
        setSaving(false)
        return
      }

      onSaved(created.id)
      return
    }

    const { error: updateError } = await supabase
      .from("hui_groups")
      .update(groupPayload)
      .eq("id", group.id)

    if (updateError) {
      console.error(updateError)
      setError(
        updateError.code === "23505"
          ? "Mã dây đã tồn tại. Hãy dùng mã khác."
          : "Không thể cập nhật dây hụi.",
      )
      setSaving(false)
      return
    }

    if (!scheduleLocked) {
      const { error: deletePeriodsError } = await supabase
        .from("hui_periods")
        .delete()
        .eq("group_id", group.id)

      if (deletePeriodsError) {
        console.error(deletePeriodsError)
        setError("Đã sửa thông tin dây nhưng chưa cập nhật được lịch khui.")
        setSaving(false)
        return
      }

      const schedule = generateSchedule(
        form.start_date,
        form.opening_time,
        totalShares,
        form.frequency_type,
        frequencyValue,
        feeAmount,
      ).map((period) => ({
        ...period,
        group_id: group.id,
      }))

      const { error: insertPeriodsError } = await supabase
        .from("hui_periods")
        .insert(schedule)

      if (insertPeriodsError) {
        console.error(insertPeriodsError)
        setError("Không thể tạo lại lịch khui.")
        setSaving(false)
        return
      }
    } else {
      const futurePeriods = groupPeriods.filter(
        (period) =>
          period.status === "scheduled" &&
          !period.opened_at &&
          !period.winner_share_id,
      )

      if (futurePeriods.length > 0) {
        const updates = futurePeriods.map((period) => ({
          id: period.id,
          group_id: period.group_id,
          period_number: period.period_number,
          scheduled_date: period.scheduled_date,
          scheduled_at: `${period.scheduled_date}T${form.opening_time}:00+07:00`,
          opened_at: period.opened_at,
          winner_share_id: period.winner_share_id,
          bid_amount: period.bid_amount,
          fee_amount: feeAmount,
          status: period.status,
          notes: period.notes,
        }))

        const { error: updateFuturePeriodsError } = await supabase
          .from("hui_periods")
          .upsert(updates, { onConflict: "id" })

        if (updateFuturePeriodsError) {
          console.error(updateFuturePeriodsError)
          setError(
            "Đã sửa thông tin dây nhưng chưa cập nhật được giờ cho các kỳ tương lai.",
          )
          setSaving(false)
          return
        }
      }
    }

    onSaved(group.id)
  }

  const schedulePreview = useMemo(() => {
    const totalShares = Number(form.total_shares)
    const frequencyValue = Number(form.frequency_value)
    if (
      !form.start_date ||
      !form.opening_time ||
      !Number.isInteger(totalShares) ||
      totalShares <= 0 ||
      !Number.isInteger(frequencyValue) ||
      frequencyValue <= 0
    ) {
      return []
    }

    return generateSchedule(
      form.start_date,
      form.opening_time,
      Math.min(totalShares, 4),
      form.frequency_type,
      frequencyValue,
      numericValue(form.fee_amount),
    )
  }, [
    form.fee_amount,
    form.frequency_type,
    form.frequency_value,
    form.opening_time,
    form.start_date,
    form.total_shares,
  ])

  const estimatedEndDate = useMemo(
    () =>
      calculateEstimatedEndDate(
        form.start_date,
        Number(form.total_shares),
        form.frequency_type,
        Number(form.frequency_value),
      ),
    [
      form.frequency_type,
      form.frequency_value,
      form.start_date,
      form.total_shares,
    ],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[92vh] w-full max-w-3xl overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="group-dialog-title" className="text-lg font-bold">
              {group ? "Sửa dây hụi" : "Tạo dây hụi"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Hệ thống tự sinh lịch khui theo chu kỳ đã chọn.
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

        {scheduleLocked && (
          <Card className="mt-4 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Dây đã có kỳ được khui hoặc chốt. Bạn vẫn sửa được mã, tên,
            tiền thảo, giờ khui, ghi chú và trạng thái. Ngày khui, chu kỳ và
            số chân được khóa để bảo vệ dữ liệu cũ. Giờ mới chỉ áp dụng cho
            các kỳ chưa khui.
          </Card>
        )}

        <form className="mt-5 flex flex-col gap-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mã dây
              <Input
                required
                value={form.code}
                onChange={(event) => setField("code", event.target.value)}
                placeholder="HUI-001"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tên dây
              <Input
                required
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Hụi tuần 1 triệu"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mệnh giá mỗi chân
              <div className="relative">
                <Input
                  inputMode="numeric"
                  required
                  value={form.contribution_amount}
                  onChange={(event) => {
                    const formatted = formatMoneyInput(event.target.value)
                    setField("contribution_amount", formatted)

                    if (!feeManuallyEdited) {
                      const amount = numericValue(formatted)
                      setField(
                        "fee_amount",
                        amount > 0
                          ? formatMoneyInput(
                              String(Math.round(amount * 0.03)),
                            )
                          : "",
                      )
                    }
                  }}
                  placeholder="Ví dụ: 3.000.000đ"
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tổng số chân / số kỳ
              <Input
                type="number"
                min="1"
                required
                disabled={scheduleLocked}
                value={form.total_shares}
                onChange={(event) =>
                  setField("total_shares", event.target.value)
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tần suất khui
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={scheduleLocked}
                value={form.frequency_type}
                onChange={(event) =>
                  setField(
                    "frequency_type",
                    event.target.value as FrequencyType,
                  )
                }
              >
                <option value="days">Theo ngày</option>
                <option value="weeks">Theo tuần</option>
                <option value="months">Theo tháng</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Chu kỳ lặp lại
              <span className="text-xs font-normal text-muted-foreground">
                {form.frequency_type === "days"
                  ? "Nhập 1 = mỗi ngày, 2 = mỗi 2 ngày"
                  : form.frequency_type === "weeks"
                    ? "Nhập 1 = mỗi tuần, 2 = mỗi 2 tuần"
                    : "Nhập 1 = mỗi tháng, 2 = mỗi 2 tháng"}
              </span>
              <Input
                type="number"
                min="1"
                required
                disabled={scheduleLocked}
                value={form.frequency_value}
                onChange={(event) =>
                  setField("frequency_value", event.target.value)
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ngày khui đầu tiên
              <Input
                type="date"
                required
                disabled={scheduleLocked}
                value={form.start_date}
                onChange={(event) =>
                  setField("start_date", event.target.value)
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Giờ khui
              <Input
                type="time"
                required
                value={form.opening_time}
                onChange={(event) =>
                  setField("opening_time", event.target.value)
                }
              />
              {scheduleLocked && (
                <span className="text-xs text-muted-foreground">
                  Giờ mới chỉ áp dụng cho các kỳ chưa khui.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tiền thảo
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={form.fee_amount}
                  disabled={scheduleLocked}
                  onChange={(event) => {
                    setFeeManuallyEdited(true)
                    setField(
                      "fee_amount",
                      formatMoneyInput(event.target.value),
                    )
                  }}
                  placeholder="Mặc định 3% mệnh giá"
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                {scheduleLocked
                  ? "Dây đã có kỳ hoàn tất nên tiền thảo được khóa cố định."
                  : "Tự tính 3% mệnh giá; có thể sửa trước khi chốt kỳ đầu tiên."}
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Giá thăm tối thiểu
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={form.minimum_bid_amount}
                  onChange={(event) =>
                    setField(
                      "minimum_bid_amount",
                      formatMoneyInput(event.target.value),
                    )
                  }
                  placeholder="Ví dụ: 100.000đ"
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Bước thăm
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={form.bid_step_amount}
                  onChange={(event) =>
                    setField(
                      "bid_step_amount",
                      formatMoneyInput(event.target.value),
                    )
                  }
                  placeholder="Ví dụ: 50.000đ"
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  đ
                </span>
              </div>
              <span className="text-xs font-normal text-muted-foreground">
                Ví dụ: 100.000 → 150.000 → 200.000.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Trạng thái
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(event) =>
                  setField("status", event.target.value)
                }
              >
                <option value="active">Đang hoạt động</option>
                <option value="draft">Bản nháp</option>
                <option value="completed">Đã kết thúc</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
              Ghi chú
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={(event) =>
                  setField("notes", event.target.value)
                }
              />
            </label>
          </div>

          {estimatedEndDate && (
            <Card className="grid gap-3 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Dự kiến mãn hụi</p>
                <p className="font-semibold">
                  {formatDate(estimatedEndDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Giá thăm tối thiểu
                </p>
                <p className="font-semibold">
                  {formatVND(numericValue(form.minimum_bid_amount))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bước thăm</p>
                <p className="font-semibold">
                  {formatVND(numericValue(form.bid_step_amount))}
                </p>
              </div>
            </Card>
          )}

          {!scheduleLocked && schedulePreview.length > 0 && (
            <Card className="p-4">
              <p className="font-medium">Xem trước lịch khui</p>
              <p className="mb-3 text-xs text-muted-foreground">
                {frequencyLabel(
                  form.frequency_type,
                  Number(form.frequency_value),
                )}{" "}
                lúc {form.opening_time}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {schedulePreview.map((period) => (
                  <div
                    key={period.period_number}
                    className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span>Kỳ {period.period_number}</span>
                    <span className="text-muted-foreground">
                      {formatDate(period.scheduled_date)} •{" "}
                      {form.opening_time}
                    </span>
                  </div>
                ))}
              </div>
              {Number(form.total_shares) > schedulePreview.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  … và {Number(form.total_shares) - schedulePreview.length} kỳ
                  tiếp theo.
                </p>
              )}
            </Card>
          )}

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
              {group ? "Lưu thay đổi" : "Tạo dây và lịch khui"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


function ShareDialog({
  day,
  share,
  members,
  onClose,
  onSaved,
}: {
  day: GroupDetail
  share: HuiShareRow | null
  members: MemberRow[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const usedNumbers = new Set(
    day.shares
      .filter((item) => item.id !== share?.id)
      .map((item) => item.share_number),
  )
  const availableNumbers = Array.from(
    { length: day.total_shares },
    (_, index) => index + 1,
  ).filter((number) => !usedNumbers.has(number))

  const [memberId, setMemberId] = useState(
    share?.member_id ?? members[0]?.id ?? "",
  )
  const [shareNumber, setShareNumber] = useState(
    String(share?.share_number ?? availableNumbers[0] ?? ""),
  )
  const [status, setStatus] = useState(share?.status ?? "active")
  const [joinedAt, setJoinedAt] = useState(
    share?.joined_at?.slice(0, 10) ?? day.start_date,
  )
  const [notes, setNotes] = useState(share?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [addMode, setAddMode] = useState<"quick" | "specific">(
    share ? "specific" : "quick",
  )
  const [quantity, setQuantity] = useState("1")

  const hasWon = share
    ? day.periods.some((period) => period.winner_share_id === share.id)
    : false

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!memberId) {
      setError("Bạn cần chọn hụi viên.")
      return
    }

    const supabase = createClient()

    if (!share && addMode === "quick") {
      const count = Number(quantity)
      if (!Number.isInteger(count) || count <= 0) {
        setError("Số lượng chân phải là số nguyên lớn hơn 0.")
        return
      }
      if (count > availableNumbers.length) {
        setError(
          `Dây chỉ còn ${availableNumbers.length} chân trống, không thể thêm ${count} chân.`,
        )
        return
      }

      setSaving(true)
      const numbersToUse = availableNumbers.slice(0, count)
      const payloads = numbersToUse.map((number) => ({
        group_id: day.id,
        member_id: memberId,
        share_number: number,
        status,
        joined_at: joinedAt || null,
        notes: notes.trim() || null,
      }))

      const { error: saveError } = await supabase
        .from("hui_shares")
        .insert(payloads)

      if (saveError) {
        console.error(saveError)
        setError(
          saveError.code === "23505"
            ? "Một trong các số chân vừa chọn đã được sử dụng. Hãy thử lại."
            : "Không thể thêm nhanh các chân hụi.",
        )
        setSaving(false)
        return
      }

      await onSaved()
      return
    }

    const number = Number(shareNumber)
    if (
      !Number.isInteger(number) ||
      number < 1 ||
      number > day.total_shares
    ) {
      setError(`Số chân phải từ 1 đến ${day.total_shares}.`)
      return
    }
    if (usedNumbers.has(number)) {
      setError(`Chân số ${number} đã có người giữ.`)
      return
    }

    setSaving(true)
    const payload = {
      group_id: day.id,
      member_id: memberId,
      share_number: number,
      status,
      joined_at: joinedAt || null,
      notes: notes.trim() || null,
    }

    const query = share
      ? supabase.from("hui_shares").update(payload).eq("id", share.id)
      : supabase.from("hui_shares").insert(payload)

    const { error: saveError } = await query
    if (saveError) {
      console.error(saveError)
      setError(
        saveError.code === "23505"
          ? "Số chân này đã tồn tại trong dây."
          : "Không thể lưu chân hụi.",
      )
      setSaving(false)
      return
    }

    await onSaved()
  }

  async function performDelete() {
    if (!share) return
    setDeleting(true)
    setError("")

    const { error: deleteError } = await createClient()
      .from("hui_shares")
      .delete()
      .eq("id", share.id)

    if (deleteError) {
      console.error(deleteError)
      setError(
        "Không thể xóa chân này. Có thể chân đã phát sinh đóng tiền hoặc dữ liệu liên quan.",
      )
      setDeleting(false)
      return
    }

    await onSaved()
  }

  async function requestDelete() {
    if (!share) return
    if (hasWon) {
      setError("Chân đã hốt nên không thể xóa.")
      return
    }
    const confirmed = window.confirm(
      `Xóa chân số ${share.share_number} khỏi dây ${day.name}?`,
    )
    if (confirmed) await performDelete()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="share-dialog-title" className="text-lg font-bold">
              {share ? `Sửa chân ${share.share_number}` : "Thêm chân hụi"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {day.code} • {day.name}
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

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Hụi viên
            <select
              required
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <option value="">Chọn hụi viên</option>
              {[...members]
                .sort((a, b) =>
                  a.full_name.localeCompare(b.full_name, "vi"),
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                    {member.phone ? ` — ${member.phone}` : ""}
                  </option>
                ))}
            </select>
          </label>

          {!share && (
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setAddMode("quick")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  addMode === "quick"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Thêm nhanh
              </button>
              <button
                type="button"
                onClick={() => setAddMode("specific")}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  addMode === "specific"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Chọn số cụ thể
              </button>
            </div>
          )}

          {!share && addMode === "quick" ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Số lượng chân
              <Input
                type="number"
                min="1"
                max={availableNumbers.length}
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
              <span className="text-xs font-normal text-muted-foreground">
                Hệ thống tự lấy {quantity || "0"} số chân trống nhỏ nhất.
                Hiện còn {availableNumbers.length} chân trống.
              </span>
            </label>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Số chân
              <select
                required
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={shareNumber}
                onChange={(event) => setShareNumber(event.target.value)}
              >
                {share && (
                  <option value={share.share_number}>
                    Chân {share.share_number}
                  </option>
                )}
                {availableNumbers
                  .filter((number) => number !== share?.share_number)
                  .map((number) => (
                    <option key={number} value={number}>
                      Chân {number}
                    </option>
                  ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Trạng thái
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </select>
            </label>
          </div>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ngày tham gia
            <Input
              type="date"
              value={joinedAt}
              onChange={(event) => setJoinedAt(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ghi chú
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ví dụ: giữ 2 chân, chuyển nhượng từ kỳ..."
            />
          </label>

          {!share && addMode === "quick" && Number(quantity) > 0 && (
            <Card className="p-3">
              <p className="text-sm font-medium">Xem trước</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Hụi viên này sẽ được thêm vào các chân:{" "}
                {availableNumbers
                  .slice(0, Math.max(0, Number(quantity)))
                  .join(", ") || "—"}
              </p>
            </Card>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div>
              {share && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive"
                  disabled={deleting || saving || hasWon}
                  onClick={() => void requestDelete()}
                >
                  {deleting ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Xóa chân
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit" disabled={saving || deleting}>
                {saving && <LoaderCircle className="size-4 animate-spin" />}
                {!share && addMode === "quick"
                  ? `Thêm ${quantity || 0} chân`
                  : "Lưu chân"}
              </Button>
            </div>
          </div>

          {hasWon && (
            <p className="text-xs text-muted-foreground">
              Chân này đã hốt nên không thể xóa, nhưng vẫn có thể cập nhật
              trạng thái hoặc ghi chú.
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}


function PeriodDialog({
  day,
  period,
  membersById,
  onClose,
  onSaved,
}: {
  day: GroupDetail
  period: HuiPeriodRow
  membersById: Map<string, MemberRow>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const eligibleShares = [...day.shares]
    .filter((share) => share.status === "active" || share.id === period.winner_share_id)
    .sort((a, b) => a.share_number - b.share_number)

  const defaultOpenedAt = period.opened_at
    ? new Date(period.opened_at).toLocaleString("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh",
      }).slice(0, 16)
    : `${period.scheduled_date}T${day.opening_time?.slice(0, 5) ?? "19:00"}`

  const [winnerShareId, setWinnerShareId] = useState(
    period.winner_share_id ?? "",
  )
  const [bidAmount, setBidAmount] = useState(
    period.bid_amount ? formatMoneyInput(String(period.bid_amount)) : "",
  )
  const [openedAt, setOpenedAt] = useState(defaultOpenedAt)
  const [notes, setNotes] = useState(period.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const minBid = Number(day.minimum_bid_amount ?? 0)
  const bidStep = Number(day.bid_step_amount ?? 0)

  function validateBid(value: number) {
    if (value < minBid) {
      return `Giá thăm phải từ ${formatVND(minBid)} trở lên.`
    }
    if (bidStep > 0 && (value - minBid) % bidStep !== 0) {
      return `Giá thăm phải tăng theo bước ${formatVND(bidStep)} từ mức ${formatVND(minBid)}.`
    }
    return ""
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

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

    const openedAtIso = new Date(`${openedAt}:00+07:00`).toISOString()

    const { error: updateError } = await createClient()
      .from("hui_periods")
      .update({
        winner_share_id: winnerShareId,
        bid_amount: bid,
        fee_amount: day.fee_amount,
        opened_at: openedAtIso,
        status: "completed",
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", period.id)

    if (updateError) {
      console.error(updateError)
      setError("Không thể lưu kết quả kỳ khui.")
      setSaving(false)
      return
    }

    await onSaved()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="period-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="period-dialog-title" className="text-lg font-bold">
              {isFinishedPeriod(period.status)
                ? `Sửa kết quả kỳ ${period.period_number}`
                : `Nhập kết quả kỳ ${period.period_number}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {day.code} • {day.name} • {formatDate(period.scheduled_date)}
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

        <form className="mt-5 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Chân hốt
            <select
              required
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
                  </option>
                )
              })}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Giá thăm thắng
            <div className="relative">
              <Input
                inputMode="numeric"
                required
                value={bidAmount}
                onChange={(event) =>
                  setBidAmount(formatMoneyInput(event.target.value))
                }
                placeholder={`Từ ${formatMoneyInput(String(minBid))}đ`}
                className="pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                đ
              </span>
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              Tối thiểu {formatVND(minBid)}, bước {formatVND(bidStep)}.
            </span>
          </label>

          <Card className="flex items-center justify-between gap-4 p-3">
            <p className="text-sm font-medium">Tiền thảo</p>
            <p className="shrink-0 font-semibold">
              {formatVND(day.fee_amount)}
            </p>
          </Card>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ngày giờ đã khui
            <Input
              type="datetime-local"
              required
              value={openedAt}
              onChange={(event) => setOpenedAt(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Ghi chú
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ghi chú nếu kỳ này có điều chỉnh đặc biệt..."
            />
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
              {isFinishedPeriod(period.status)
                ? "Lưu chỉnh sửa"
                : "Chốt kỳ"}
            </Button>
          </div>

          {isFinishedPeriod(period.status) && (
            <p className="text-xs text-muted-foreground">
              Bạn có thể sửa lại người hốt, giá thăm, ngày giờ và ghi chú
              nếu trước đó nhập sai. Tiền thảo luôn cố định theo dây.
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}

function DayDetail({
  day,
  members,
  membersById,
  onBack,
  onEdit,
  onDataChanged,
}: {
  day: GroupDetail
  members: MemberRow[]
  membersById: Map<string, MemberRow>
  onBack: () => void
  onEdit: () => void
  onDataChanged: () => Promise<void>
}) {
  const [editingShare, setEditingShare] = useState<
    HuiShareRow | null | undefined
  >(undefined)
  const [editingPeriod, setEditingPeriod] = useState<
    HuiPeriodRow | undefined
  >(undefined)

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
      <div className="flex items-center justify-between gap-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {day.code ?? "Chưa có mã"}
              </Badge>
              <h1 className="text-lg font-bold leading-tight">{day.name}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatVND(day.contribution_amount)}/chân • {day.total_shares} chân
              • {frequencyLabel(day.frequency_type, day.frequency_value)} •{" "}
              {formatTime(day.opening_time)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          Sửa dây
        </Button>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                label: "Thăm tối thiểu",
                value: formatVND(day.minimum_bid_amount),
              },
              {
                label: "Bước thăm",
                value: formatVND(day.bid_step_amount),
              },
              {
                label: "Kỳ tiếp",
                value: nextPeriod
                  ? `${formatDate(nextPeriod.scheduled_date)} ${formatTime(day.opening_time)}`
                  : "Chưa có",
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

        <TabsContent value="chan" className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Danh sách chân hụi</p>
              <p className="text-xs text-muted-foreground">
                Đã gán {day.shares.length}/{day.total_shares} chân
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setEditingShare(null)}
              disabled={day.shares.length >= day.total_shares}
            >
              <Plus className="size-4" />
              Thêm chân
            </Button>
          </div>

          <Card className="overflow-hidden">
            {day.shares.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Users className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Dây này chưa có chân hụi</p>
                  <p className="text-sm text-muted-foreground">
                    Chọn hụi viên và gán vào từng số chân.
                  </p>
                </div>
                <Button onClick={() => setEditingShare(null)}>
                  <Plus className="size-4" />
                  Thêm chân đầu tiên
                </Button>
              </div>
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
                          "Thao tác",
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
                      {[...day.shares]
                        .sort((a, b) => a.share_number - b.share_number)
                        .map((share) => {
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
                                <Badge variant="outline">
                                  {share.status === "active"
                                    ? "Hoạt động"
                                    : "Tạm ngưng"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2.5">
                                {wonPeriod ? "Đã hốt" : "Chưa"}
                              </td>
                              <td className="px-4 py-2.5 text-muted-foreground">
                                {wonPeriod
                                  ? `Kỳ ${wonPeriod.period_number}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingShare(share)}
                                >
                                  <Pencil className="size-4" />
                                  Sửa
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-border md:hidden">
                  {[...day.shares]
                    .sort((a, b) => a.share_number - b.share_number)
                    .map((share) => {
                      const member = membersById.get(share.member_id)
                      const wonPeriod = completedPeriods.find(
                        (period) => period.winner_share_id === share.id,
                      )
                      return (
                        <div
                          key={share.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
                              {share.share_number}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {member?.full_name ?? "Không rõ"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member?.phone ?? "Chưa có SĐT"} •{" "}
                                {wonPeriod
                                  ? `Hốt kỳ ${wonPeriod.period_number}`
                                  : "Chưa hốt"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingShare(share)}
                            aria-label={`Sửa chân ${share.share_number}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      )
                    })}
                </div>
              </>
            )}
          </Card>

          {day.shares.length >= day.total_shares && (
            <p className="text-xs text-muted-foreground">
              Dây đã đủ {day.total_shares} chân.
            </p>
          )}

          {editingShare !== undefined && (
            <ShareDialog
              day={day}
              share={editingShare}
              members={members}
              onClose={() => setEditingShare(undefined)}
              onSaved={async () => {
                setEditingShare(undefined)
                await onDataChanged()
              }}
            />
          )}
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
                          "Ngày giờ",
                          "Người hốt",
                          "Giá thăm",
                          "Tiền thảo",
                          "Trạng thái",
                          "Thao tác",
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
                              {formatDate(period.scheduled_date)} •{" "}
                              {period.scheduled_at
                                ? new Date(period.scheduled_at).toLocaleTimeString(
                                    "vi-VN",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      timeZone: "Asia/Ho_Chi_Minh",
                                    },
                                  )
                                : formatTime(day.opening_time)}
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
                            <td className="px-4 py-2.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingPeriod(period)}
                              >
                                {isFinishedPeriod(period.status) ? (
                                  <Pencil className="size-4" />
                                ) : (
                                  <CheckCircle2 className="size-4" />
                                )}
                                {isFinishedPeriod(period.status)
                                  ? "Sửa"
                                  : "Nhập kết quả"}
                              </Button>
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
                      <button
                        type="button"
                        key={period.id}
                        onClick={() => setEditingPeriod(period)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30"
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
                              {formatTime(day.opening_time)} •{" "}
                              {winner?.full_name ?? "Chưa có người hốt"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {periodStatusLabel(period.status)}
                          </Badge>
                          <Pencil className="size-4 text-muted-foreground" />
                        </div>
                      </button>
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

      {editingPeriod && (
        <PeriodDialog
          day={day}
          period={editingPeriod}
          membersById={membersById}
          onClose={() => setEditingPeriod(undefined)}
          onSaved={async () => {
            setEditingPeriod(undefined)
            await onDataChanged()
          }}
        />
      )}
    </div>
  )
}
