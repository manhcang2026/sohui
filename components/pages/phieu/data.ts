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

async function fetchPaymentsForReceiptIds(receiptIds: string[]) {
  if (receiptIds.length === 0) return [] as PaymentRow[]

  const supabase = createClient()
  const result: PaymentRow[] = []
  const pageSize = 1000

  // Keep each IN-list small, and paginate each chunk so Supabase's row cap
  // can never silently hide older payments from the receipt page.
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

export async function loadReceiptPageData(
  effectiveFrom: string,
  effectiveTo: string,
) {
  const supabase = createClient()

  const [g, s, p, m, cfg, r] = await Promise.all([
    supabase
      .from("hui_groups")
      .select(
        "id, code, name, contribution_amount, total_shares, fee_amount",
      ),
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
    supabase
      .from("app_settings")
      .select(
        "owner_name, owner_phone, bank_id, bank_name, bank_account_number, bank_account_name, transfer_prefix",
      )
      .eq("id", 1)
      .maybeSingle(),
    effectiveFrom && effectiveTo && effectiveFrom <= effectiveTo
      ? supabase
          .from("hui_receipts")
          .select(
            "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
          )
          .gte("receipt_date", effectiveFrom)
          .lte("receipt_date", effectiveTo)
      : Promise.resolve({ data: [], error: null }),
  ])

  const firstError =
    g.error ?? s.error ?? p.error ?? m.error ?? cfg.error ?? r.error

  if (firstError) throw firstError

  const receiptRows = (r.data ?? []) as ReceiptDbRow[]
  const payments = await fetchPaymentsForReceiptIds(
    receiptRows.map((row) => row.id),
  )

  return {
    groups: (g.data ?? []) as GroupRow[],
    shares: (s.data ?? []) as ShareRow[],
    periods: (p.data ?? []) as PeriodRow[],
    members: (m.data ?? []) as MemberRow[],
    settings: (cfg.data as SettingsRow | null) ?? EMPTY_SETTINGS,
    receiptRows,
    payments,
  }
}
