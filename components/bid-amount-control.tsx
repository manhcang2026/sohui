"use client"

import type { Dispatch, SetStateAction } from "react"
import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

const QUICK_AMOUNTS = [20_000, 50_000, 100_000] as const

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export function initialBidAmount({
  storedBid,
  hasStoredResult,
  minimumBid,
}: {
  storedBid: number | null | undefined
  hasStoredResult: boolean
  minimumBid: number
}) {
  const current = Number(storedBid ?? 0)
  return hasStoredResult || current > 0
    ? current
    : Number(minimumBid || 0)
}

export function validateBidAmount({
  value,
  minimumBid,
  bidStep,
  contributionAmount,
}: {
  value: number
  minimumBid: number
  bidStep: number
  contributionAmount: number
}) {
  if (!Number.isFinite(value) || value < minimumBid) {
    return `Giá thăm phải từ ${formatVND(minimumBid)} trở lên.`
  }

  if (!Number.isFinite(bidStep) || bidStep <= 0) {
    return "Bước thăm của dây chưa hợp lệ."
  }

  if ((value - minimumBid) % bidStep !== 0) {
    return `Giá thăm phải theo bước ${formatVND(bidStep)} từ mức ${formatVND(minimumBid)}.`
  }

  if (!Number.isFinite(contributionAmount) || value >= contributionAmount) {
    return "Giá thăm phải nhỏ hơn mệnh giá mỗi chân."
  }

  return ""
}

export function BidAmountControl({
  value,
  onChange,
  minimumBid,
  bidStep,
  contributionAmount,
  disabled = false,
  onInteraction,
}: {
  value: number
  onChange: Dispatch<SetStateAction<number>>
  minimumBid: number
  bidStep: number
  contributionAmount: number
  disabled?: boolean
  onInteraction?: () => void
}) {
  const validStep = Number.isFinite(bidStep) && bidStep > 0

  function canUseValue(next: number) {
    return (
      validStep &&
      next >= minimumBid &&
      next < contributionAmount &&
      (next - minimumBid) % bidStep === 0
    )
  }

  function applyDelta(delta: number) {
    if (disabled || !validStep) return

    onChange((current) => {
      const next = current + delta
      return canUseValue(next) ? next : current
    })
    onInteraction?.()
  }

  const downValue = value - bidStep
  const upValue = value + bidStep

  return (
    <div>
      <p className="text-sm font-medium">Giá thăm</p>

      <div className="mt-2 grid grid-cols-[52px_minmax(0,1fr)_52px] items-stretch gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 touch-manipulation"
          disabled={disabled || !canUseValue(downValue)}
          onClick={() => applyDelta(-bidStep)}
          aria-label="Giảm giá thăm"
        >
          <Minus className="size-5" />
        </Button>

        <div className="flex h-12 items-center justify-center rounded-md border bg-background px-2 text-center text-base font-bold tabular-nums sm:px-3 sm:text-lg">
          {formatVND(value)}
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-12 touch-manipulation"
          disabled={disabled || !canUseValue(upValue)}
          onClick={() => applyDelta(bidStep)}
          aria-label="Tăng giá thăm"
        >
          <Plus className="size-5" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {QUICK_AMOUNTS.map((amount) => {
          const stepCompatible = validStep && amount % bidStep === 0
          const next = value + amount
          const withinLimit = next < contributionAmount
          const enabled =
            !disabled && stepCompatible && withinLimit && canUseValue(next)
          const title = !stepCompatible
            ? `Không dùng được vì ${formatVND(amount)} không khớp bước thăm ${formatVND(bidStep)}.`
            : !withinLimit
              ? "Mức cộng này sẽ làm giá thăm bằng hoặc vượt mệnh giá một chân."
              : !canUseValue(next)
                ? "Giá thăm hiện tại không khớp cấu hình bước thăm của dây."
              : disabled
                ? "Kỳ đang bị khóa nên không thể đổi giá thăm."
                : undefined

          return (
            <Button
              key={amount}
              type="button"
              variant="secondary"
              className="h-11 touch-manipulation px-2 text-sm font-semibold"
              disabled={!enabled}
              title={title}
              onClick={() => applyDelta(amount)}
            >
              +{amount / 1000}k
            </Button>
          )
        })}
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Tối thiểu {formatVND(minimumBid)} · mỗi lần tăng/giảm {formatVND(bidStep)} · phải nhỏ hơn {formatVND(contributionAmount)}.
      </p>
    </div>
  )
}
