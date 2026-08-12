"use client"

import { ChevronRight, LoaderCircle, Send, UserRound, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { Receipt } from "./types"
import { formatDate, formatVND, receiptStatusLabel } from "./utils"

export function SummaryCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint: string
  tone?: "default" | "collect" | "pay" | "done"
}) {
  const valueClass =
    tone === "collect"
      ? "text-emerald-700"
      : tone === "pay"
        ? "text-red-600"
        : tone === "done"
          ? "text-emerald-700"
          : "text-foreground"

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black tabular-nums ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  )
}

export function ReceiptTableRow({
  receipt,
  showDate,
  checked,
  sharing,
  onToggle,
  onView,
  onShare,
}: {
  receipt: Receipt
  showDate: boolean
  checked: boolean
  sharing: boolean
  onToggle: () => void
  onView: () => void
  onShare: () => void
}) {
  const settled = receipt.remainingAmount <= 0
  const cancelled = receipt.status === "cancelled"
  const amount = Math.abs(receipt.netAmount)

  return (
    <tr className={`border-t ${cancelled ? "opacity-55" : ""}`}>
      <td className="px-3 py-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      </td>
      {showDate && (
        <td className="whitespace-nowrap px-3 py-3 font-medium">
          {formatDate(receipt.receiptDate)}
        </td>
      )}
      <td className="px-3 py-3">
        <p className="font-bold">{receipt.member.full_name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {receipt.groupCount} dây · {receipt.totalShares} chân
        </p>
      </td>
      <td className="px-3 py-3">
        <DirectionBadge receipt={receipt} />
      </td>
      <td className="px-3 py-3 text-right font-bold tabular-nums">
        {formatVND(amount)}
      </td>
      <td className="px-3 py-3">
        <PaymentBadge receipt={receipt} />
        {receipt.status === "partial" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Đã {receipt.direction === "collect" ? "thu" : "chi"}{" "}
            {formatVND(receipt.paidAmount)} · Còn {formatVND(receipt.remainingAmount)}
          </p>
        )}
        {settled && receipt.paidAmount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Đã thanh toán {formatVND(receipt.paidAmount)}
          </p>
        )}
      </td>
      <td className="px-3 py-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onShare}
          disabled={sharing}
        >
          {sharing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Gửi ảnh qua Zalo
        </Button>
      </td>
      <td className="px-3 py-3 text-right">
        <Button size="sm" variant="outline" onClick={onView}>
          Xem phiếu
        </Button>
      </td>
    </tr>
  )
}

export function ReceiptMobileCard({
  receipt,
  showDate,
  checked,
  sharing,
  onToggle,
  onView,
  onShare,
}: {
  receipt: Receipt
  showDate: boolean
  checked: boolean
  sharing: boolean
  onToggle: () => void
  onView: () => void
  onShare: () => void
}) {
  return (
    <Card className={`p-4 ${receipt.status === "cancelled" ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          className="mt-1 size-5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-bold">{receipt.member.full_name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {showDate ? `${formatDate(receipt.receiptDate)} · ` : ""}
                {receipt.groupCount} dây · {receipt.totalShares} chân
              </p>
            </div>
            <p className="shrink-0 text-lg font-black tabular-nums">
              {formatVND(Math.abs(receipt.netAmount))}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <DirectionBadge receipt={receipt} />
            <PaymentBadge receipt={receipt} />
          </div>

          {receipt.status === "partial" && (
            <p className="mt-2 text-sm font-medium text-amber-800">
              Đã {receipt.direction === "collect" ? "thu" : "chi"}{" "}
              {formatVND(receipt.paidAmount)} · Còn {formatVND(receipt.remainingAmount)}
            </p>
          )}

          {receipt.remainingAmount <= 0 && receipt.paidAmount > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Đã thanh toán {formatVND(receipt.paidAmount)}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={onShare}
              disabled={sharing}
            >
              {sharing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Gửi Zalo
            </Button>
            <Button variant="outline" onClick={onView}>
              Xem phiếu
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function DirectionBadge({ receipt }: { receipt: Receipt }) {
  if (receipt.direction === "balanced") {
    return (
      <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
        Cân bằng
      </span>
    )
  }

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        receipt.direction === "collect"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-600"
      }`}
    >
      {receipt.direction === "collect" ? "Phải thu" : "Phải chi"}
    </span>
  )
}

export function PaymentBadge({ receipt }: { receipt: Receipt }) {
  const className =
    receipt.status === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : receipt.status === "partial"
        ? "bg-amber-100 text-amber-800"
        : receipt.status === "cancelled"
          ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-amber-800"

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}>
      {receiptStatusLabel(receipt.status)}
    </span>
  )
}


export function MiniShareBadge({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "live" | "dead"
}) {
  const live = tone === "live"

  return (
    <div
      className={`flex min-h-[92px] flex-col items-center justify-center rounded-lg border px-2 py-3 text-center ${
        live
          ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
          : "border-red-200 bg-red-50/60 text-red-600"
      }`}
    >
      <div
        className={`flex size-7 items-center justify-center rounded-full ${
          live ? "bg-emerald-100" : "bg-red-100"
        }`}
      >
        {live ? (
          <UsersRound className="size-3.5" />
        ) : (
          <UserRound className="size-3.5" />
        )}
      </div>
      <p className="mt-1.5 text-xs font-semibold">{label}</p>
      <p className="mt-0.5 text-xl font-black tabular-nums">{value}</p>
    </div>
  )
}

export function ReceiptMoneyRow({
  label,
  value,
  negative = false,
  positive = false,
  strong = false,
}: {
  label: string
  value: string
  negative?: boolean
  positive?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className={
          strong
            ? "font-bold text-[#0f2a56]"
            : "text-slate-500"
        }
      >
        {label}
      </span>

      <span
        className={`shrink-0 text-right tabular-nums ${
          negative
            ? "font-bold text-red-600"
            : positive
              ? "font-extrabold text-emerald-700"
              : strong
                ? "font-extrabold text-[#0f2a56]"
                : "font-bold text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
