import { createClient } from "@/lib/supabase/client"
import type {
  GroupRow,
  MemberRow,
  PaymentRow,
  PeriodRow,
  ReceiptDbRow,
  SettingsRow,
  ShareRow,
} from "./types"
import { EMPTY_SETTINGS } from "./types"

const PAYMENT_SELECT =
  "id, receipt_id, direction, amount, method, note, status, cancelled_at, cancel_reason, transaction_date, created_at, updated_at, source_period_id"

function chunk<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: unknown
  }>,
) {
  const result: T[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error

    const rows = data ?? []
    result.push(...rows)

    if (rows.length < pageSize) break
    from += pageSize
  }

  return result
}

async function fetchPaymentsForReceiptIds(receiptIds: string[]) {
  if (receiptIds.length === 0) return [] as PaymentRow[]

  const supabase = createClient()
  const result: PaymentRow[] = []
  const pageSize = 1000

  for (const ids of chunk(receiptIds, 100)) {
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from("receipt_payments")
        .select(PAYMENT_SELECT)
        .in("receipt_id", ids)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error

      const rows = (data ?? []) as PaymentRow[]
      result.push(...rows)

      if (rows.length < pageSize) break
      from += pageSize
    }
  }

  return result.sort((a, b) => {
    const dateCompare = (b.transaction_date ?? "").localeCompare(
      a.transaction_date ?? "",
    )
    if (dateCompare !== 0) return dateCompare
    return (b.created_at ?? "").localeCompare(a.created_at ?? "")
  })
}

export async function fetchActivePaymentTotals(
  receiptIds: string[],
) {
  const totals = new Map<string, number>()
  if (receiptIds.length === 0) return totals

  const supabase = createClient()
  const pageSize = 1000

  for (const ids of chunk(receiptIds, 100)) {
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from("receipt_payments")
        .select("receipt_id, direction, amount, id")
        .in("receipt_id", ids)
        .eq("status", "active")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1)

      if (error) throw error

      const rows = (data ?? []) as Array<{
        id: string
        receipt_id: string
        direction: "collect" | "pay"
        amount: number
      }>

      for (const payment of rows) {
        const key = `${payment.receipt_id}|${payment.direction}`
        totals.set(
          key,
          (totals.get(key) ?? 0) + Number(payment.amount || 0),
        )
      }

      if (rows.length < pageSize) break
      from += pageSize
    }
  }

  return totals
}

export async function loadReceiptBaseData() {
  const supabase = createClient()

  const [groups, shares, periods, members, cfg] = await Promise.all([
    fetchAllPages<GroupRow>((from, to) =>
      supabase
        .from("hui_groups")
        .select(
          "id, code, name, contribution_amount, total_shares, fee_amount",
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<ShareRow>((from, to) =>
      supabase
        .from("hui_shares")
        .select("id, group_id, member_id, share_number, status")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<PeriodRow>((from, to) =>
      supabase
        .from("hui_periods")
        .select(
          "id, group_id, period_number, scheduled_date, opened_at, winner_share_id, bid_amount, fee_amount, status",
        )
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<MemberRow>((from, to) =>
      supabase
        .from("members")
        .select("id, full_name, phone")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    supabase
      .from("app_settings")
      .select(
        "owner_name, owner_phone, bank_id, bank_name, bank_account_number, bank_account_name, transfer_prefix",
      )
      .eq("id", 1)
      .maybeSingle(),
  ])

  if (cfg.error) throw cfg.error

  return {
    groups,
    shares,
    periods,
    members,
    settings: (cfg.data as SettingsRow | null) ?? EMPTY_SETTINGS,
  }
}

export async function loadReceiptLedgerData(
  effectiveFrom: string,
  effectiveTo: string,
) {
  if (!effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo) {
    return {
      receiptRows: [] as ReceiptDbRow[],
      payments: [] as PaymentRow[],
    }
  }

  const supabase = createClient()
  const receiptRows = await fetchAllPages<ReceiptDbRow>((from, to) =>
    supabase
      .from("hui_receipts")
      .select(
        "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
      )
      .gte("receipt_date", effectiveFrom)
      .lte("receipt_date", effectiveTo)
      .order("id", { ascending: true })
      .range(from, to),
  )
  const payments = await fetchPaymentsForReceiptIds(
    receiptRows.map((row) => row.id),
  )

  return { receiptRows, payments }
}

export async function loadReceiptPageData(
  effectiveFrom: string,
  effectiveTo: string,
) {
  const [base, ledger] = await Promise.all([
    loadReceiptBaseData(),
    loadReceiptLedgerData(effectiveFrom, effectiveTo),
  ])

  return { ...base, ...ledger }
}
