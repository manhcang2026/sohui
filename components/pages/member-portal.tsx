"use client"

import { useEffect, useMemo, useState } from "react"
import {
  KeyRound,
  Layers,
  LoaderCircle,
  LogOut,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AccountSecurity } from "@/components/account/account-security"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

type Profile = {
  auth_user_id: string
  email: string
  display_name: string | null
  role: "member"
  member_id: string
}

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type ShareRow = {
  id: string
  group_id: string
  share_number: number
  status: string
}

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  status: string
}

type PeriodRow = {
  id: string
  group_id: string
  period_number: number
  scheduled_date: string
  winner_share_id: string | null
  bid_amount: number
  status: string
}

type ReceiptRow = {
  id: string
  receipt_date: string
  source_total_pay: number
  source_total_receive: number
  settlement_amount: number
  status: string
}

type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  status: string
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

export function MemberPortalPage({ profile }: { profile: Profile }) {
  const [member, setMember] = useState<MemberRow | null>(null)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showPin, setShowPin] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    const [
      memberResult,
      sharesResult,
      groupsResult,
      periodsResult,
      receiptsResult,
      paymentsResult,
    ] = await Promise.all([
      supabase
        .from("members")
        .select("id, full_name, phone")
        .eq("id", profile.member_id)
        .single(),
      supabase
        .from("hui_shares")
        .select("id, group_id, share_number, status"),
      supabase
        .from("hui_groups")
        .select(
          "id, code, name, contribution_amount, total_shares, status",
        ),
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, winner_share_id, bid_amount, status",
        ),
      supabase
        .from("hui_receipts")
        .select(
          "id, receipt_date, source_total_pay, source_total_receive, settlement_amount, status",
        )
        .order("receipt_date", { ascending: false }),
      supabase
        .from("receipt_payments")
        .select("id, receipt_id, direction, amount, status"),
    ])

    setMember((memberResult.data as MemberRow | null) ?? null)
    setShares((sharesResult.data ?? []) as ShareRow[])
    setGroups((groupsResult.data ?? []) as GroupRow[])
    setPeriods((periodsResult.data ?? []) as PeriodRow[])
    setReceipts((receiptsResult.data ?? []) as ReceiptRow[])
    setPayments((paymentsResult.data ?? []) as PaymentRow[])
    setLoading(false)
  }

  const summary = useMemo(() => {
    const ownShareIds = new Set(shares.map((share) => share.id))
    const deadIds = new Set(
      periods
        .filter(
          (period) =>
            period.winner_share_id &&
            ownShareIds.has(period.winner_share_id) &&
            (period.status === "completed" || period.status === "opened"),
        )
        .map((period) => period.winner_share_id as string),
    )

    let collected = 0
    let paid = 0

    for (const payment of payments) {
      if (payment.status !== "active") continue
      if (payment.direction === "collect") {
        collected += Number(payment.amount)
      } else {
        paid += Number(payment.amount)
      }
    }

    return {
      groupCount: new Set(shares.map((share) => share.group_id)).size,
      totalShares: shares.length,
      deadShares: shares.filter((share) => deadIds.has(share.id)).length,
      liveShares: shares.filter((share) => !deadIds.has(share.id)).length,
      collected,
      paid,
    }
  }, [payments, periods, shares])

  async function logout() {
    await createClient().auth.signOut()
    window.location.assign("/login")
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải sổ hụi của bạn...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Sổ hụi của tôi</p>
            <h1 className="font-bold">
              {member?.full_name ?? profile.display_name ?? profile.email}
            </h1>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPin((value) => !value)}
            >
              <KeyRound className="size-4" />
              Đổi mã
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Thoát
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        {showPin && <AccountSecurity />}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={Layers} label="Dây tham gia" value={summary.groupCount} />
          <Stat icon={UserRound} label="Tổng chân" value={summary.totalShares} />
          <Stat icon={UserRound} label="Chân sống" value={summary.liveShares} />
          <Stat icon={UserRound} label="Chân đã hốt" value={summary.deadShares} />
        </div>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <WalletCards className="size-5" />
            <h2 className="font-semibold">Tiền đã xác nhận</h2>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Money label="Đã đóng" value={summary.collected} />
            <Money label="Đã nhận" value={summary.paid} />
          </div>
        </Card>

        <div>
          <h2 className="font-semibold">Các dây đang tham gia</h2>
          <div className="mt-2 space-y-2">
            {groups.map((group) => {
              const groupShares = shares.filter(
                (share) => share.group_id === group.id,
              )
              if (groupShares.length === 0) return null

              const groupPeriods = periods.filter(
                (period) => period.group_id === group.id,
              )
              const ownIds = new Set(groupShares.map((share) => share.id))
              const won = groupPeriods.filter(
                (period) =>
                  period.winner_share_id &&
                  ownIds.has(period.winner_share_id) &&
                  (period.status === "completed" ||
                    period.status === "opened"),
              ).length

              return (
                <Card key={group.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border px-2 py-0.5 font-mono text-xs">
                      {group.code || "CHƯA-MÃ"}
                    </span>
                    <p className="font-semibold">{group.name}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatVND(group.contribution_amount)}/chân ·{" "}
                    {groupShares.length} chân · đã hốt {won}
                  </p>
                </Card>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="size-5" />
            <h2 className="font-semibold">Phiếu gần đây</h2>
          </div>

          <div className="mt-2 space-y-2">
            {receipts.slice(0, 12).map((receipt) => {
              const net =
                Number(receipt.source_total_pay || 0) -
                Number(receipt.source_total_receive || 0) +
                Number(receipt.settlement_amount || 0)

              return (
                <Card key={receipt.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {formatDate(receipt.receipt_date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {receipt.status}
                      </p>
                    </div>
                    <p className="font-bold">
                      {net >= 0
                        ? `Đóng ${formatVND(net)}`
                        : `Nhận ${formatVND(Math.abs(net))}`}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers
  label: string
  value: number
}) {
  return (
    <Card className="p-4">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </Card>
  )
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{formatVND(value)}</p>
    </div>
  )
}
