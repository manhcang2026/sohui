export type MemberReceiptRow = {
  id: string
  member_id: string
  receipt_date: string
  source_total_pay: number
  source_total_receive: number
  settlement_amount: number
  status: string
}

export type MemberPaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  status: "active" | "cancelled"
  source_period_id: string | null
}

export type CashFlowLevel =
  | "good"
  | "normal"
  | "watch"
  | "high"
  | "alarm"

export type PeriodTimingSource =
  | "opened_at"
  | "scheduled_at"
  | "scheduled_date_opening_time"
  | "legacy_default_19_00"

export type DerivedObligationPeriod = {
  periodId: string
  groupId: string
  groupName: string
  periodNumber: number
  scheduledDate: string
  expectedNet: number
  openedAtMs: number
  deadlineAtMs: number
  timingSource: PeriodTimingSource
}

export type DerivedMemberObligation = {
  receiptKey: string
  memberId: string
  receiptDate: string
  expectedNet: number
  openedAtMs: number
  deadlineAtMs: number
  timingSource: PeriodTimingSource
  periods: DerivedObligationPeriod[]
}

export type CollectObligationStatus = "waiting" | "overdue"

export type CollectObligation = {
  receiptKey: string
  receiptId: string | null
  memberId: string
  receiptDate: string
  requiredAmount: number
  collectedAmount: number
  remainingAmount: number
  openedAtMs: number
  deadlineAtMs: number
  timingSource: PeriodTimingSource
  status: CollectObligationStatus
  periods: DerivedObligationPeriod[]
}

export type MemberMoneySummary = {
  shouldCollect: number
  shouldPay: number
  collected: number
  paid: number
  overdue: number
  cashFlowDifference: number
  cashFlowLevel: CashFlowLevel
  collectObligations: CollectObligation[]
}

export const PAYMENT_GRACE_MS = 48 * 60 * 60 * 1000
const VIETNAM_UTC_OFFSET = "+07:00"
const LEGACY_OPENING_TIME = "19:00:00"

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}${VIETNAM_UTC_OFFSET}`
  const result = Date.parse(normalized)
  return Number.isFinite(result) ? result : null
}

function vietnamDateTimeMs(date: string, time: string) {
  const normalizedTime = time.slice(0, 8)
  return parseTimestamp(`${date}T${normalizedTime}`)
}

export function resolvePeriodTiming(input: {
  openedAt: string | null
  scheduledAt: string | null
  scheduledDate: string
  openingTime: string | null
}) {
  const openedAt = parseTimestamp(input.openedAt)
  if (openedAt !== null) {
    return {
      openedAtMs: openedAt,
      deadlineAtMs: openedAt + PAYMENT_GRACE_MS,
      source: "opened_at" as const,
    }
  }

  const scheduledAt = parseTimestamp(input.scheduledAt)
  if (scheduledAt !== null) {
    return {
      openedAtMs: scheduledAt,
      deadlineAtMs: scheduledAt + PAYMENT_GRACE_MS,
      source: "scheduled_at" as const,
    }
  }

  const configuredTime = input.openingTime
    ? vietnamDateTimeMs(input.scheduledDate, input.openingTime)
    : null
  if (configuredTime !== null) {
    return {
      openedAtMs: configuredTime,
      deadlineAtMs: configuredTime + PAYMENT_GRACE_MS,
      source: "scheduled_date_opening_time" as const,
    }
  }

  // Legacy fallback matches the current result-entry screens. It is explicit
  // and interpreted as 19:00 in Asia/Ho_Chi_Minh, never browser-local midnight.
  const legacyTime = vietnamDateTimeMs(
    input.scheduledDate,
    LEGACY_OPENING_TIME,
  )
  if (legacyTime === null) {
    throw new Error("invalid_period_date")
  }

  return {
    openedAtMs: legacyTime,
    deadlineAtMs: legacyTime + PAYMENT_GRACE_MS,
    source: "legacy_default_19_00" as const,
  }
}

export function classifyCashFlow(difference: number): CashFlowLevel {
  if (difference > 0) return "good"
  if (difference > -10_000_000) return "normal"
  if (difference > -30_000_000) return "watch"
  if (difference > -50_000_000) return "high"
  return "alarm"
}

export function calculateMemberMoneyByReceipt(
  receipts: MemberReceiptRow[],
  payments: MemberPaymentRow[],
  derivedObligations: DerivedMemberObligation[],
  nowMs: number,
) {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]))
  const receiptKeys = new Set(
    receipts.map((receipt) => `${receipt.member_id}|${receipt.receipt_date}`),
  )
  const derivedByReceiptKey = new Map(
    derivedObligations.map((obligation) => [obligation.receiptKey, obligation]),
  )
  const paymentTotalsByReceipt = new Map<
    string,
    { collected: number; paid: number }
  >()

  for (const payment of payments) {
    if (payment.status !== "active") continue
    const receipt = receiptById.get(payment.receipt_id)
    if (!receipt || receipt.status === "cancelled") continue

    const current = paymentTotalsByReceipt.get(payment.receipt_id) ?? {
      collected: 0,
      paid: 0,
    }
    if (payment.direction === "collect") {
      current.collected += Number(payment.amount || 0)
    } else {
      current.paid += Number(payment.amount || 0)
    }
    paymentTotalsByReceipt.set(payment.receipt_id, current)
  }

  const result = new Map<string, MemberMoneySummary>()

  function getSummary(memberId: string) {
    return (
      result.get(memberId) ?? {
        shouldCollect: 0,
        shouldPay: 0,
        collected: 0,
        paid: 0,
        overdue: 0,
        cashFlowDifference: 0,
        cashFlowLevel: "normal" as const,
        collectObligations: [],
      }
    )
  }

  function addObligation(input: {
    receiptKey: string
    receiptId: string | null
    memberId: string
    receiptDate: string
    net: number
    collectedAmount: number
    paidAmount: number
    timing: DerivedMemberObligation
  }) {
    const current = getSummary(input.memberId)
    current.collected += input.collectedAmount
    current.paid += input.paidAmount

    if (input.net > 0) {
      current.shouldCollect += input.net
      const remainingAmount = Math.max(
        0,
        input.net - input.collectedAmount,
      )
      if (remainingAmount > 0) {
        const status: CollectObligationStatus =
          nowMs >= input.timing.deadlineAtMs ? "overdue" : "waiting"
        if (status === "overdue") current.overdue += remainingAmount
        current.collectObligations.push({
          receiptKey: input.receiptKey,
          receiptId: input.receiptId,
          memberId: input.memberId,
          receiptDate: input.receiptDate,
          requiredAmount: input.net,
          collectedAmount: input.collectedAmount,
          remainingAmount,
          openedAtMs: input.timing.openedAtMs,
          deadlineAtMs: input.timing.deadlineAtMs,
          timingSource: input.timing.timingSource,
          status,
          periods: input.timing.periods,
        })
      }
    } else if (input.net < 0) {
      current.shouldPay += Math.abs(input.net)
    }

    result.set(input.memberId, current)
  }

  for (const receipt of receipts) {
    if (receipt.status === "cancelled") continue

    const receiptKey = `${receipt.member_id}|${receipt.receipt_date}`
    const timing =
      derivedByReceiptKey.get(receiptKey) ??
      (() => {
        const fallback = resolvePeriodTiming({
          openedAt: null,
          scheduledAt: null,
          scheduledDate: receipt.receipt_date,
          openingTime: null,
        })
        return {
          receiptKey,
          memberId: receipt.member_id,
          receiptDate: receipt.receipt_date,
          expectedNet: 0,
          openedAtMs: fallback.openedAtMs,
          deadlineAtMs: fallback.deadlineAtMs,
          timingSource: fallback.source,
          periods: [],
        }
      })()
    const actual = paymentTotalsByReceipt.get(receipt.id) ?? {
      collected: 0,
      paid: 0,
    }
    const net =
      Number(receipt.source_total_pay || 0) -
      Number(receipt.source_total_receive || 0) +
      Number(receipt.settlement_amount || 0)

    addObligation({
      receiptKey,
      receiptId: receipt.id,
      memberId: receipt.member_id,
      receiptDate: receipt.receipt_date,
      net,
      collectedAmount: actual.collected,
      paidAmount: actual.paid,
      timing,
    })
  }

  for (const obligation of derivedObligations) {
    if (receiptKeys.has(obligation.receiptKey)) continue
    addObligation({
      receiptKey: obligation.receiptKey,
      receiptId: null,
      memberId: obligation.memberId,
      receiptDate: obligation.receiptDate,
      net: obligation.expectedNet,
      collectedAmount: 0,
      paidAmount: 0,
      timing: obligation,
    })
  }

  for (const [memberId, summary] of result) {
    summary.cashFlowDifference = summary.collected - summary.paid
    summary.cashFlowLevel = classifyCashFlow(summary.cashFlowDifference)
    summary.collectObligations.sort(
      (a, b) => a.deadlineAtMs - b.deadlineAtMs || a.receiptKey.localeCompare(b.receiptKey),
    )
    result.set(memberId, summary)
  }

  return result
}
