export type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  fee_amount: number
}

export type ShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
  status: string
}

export type PeriodRow = {
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

export type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

export type SettingsRow = {
  owner_name: string
  owner_phone: string
  bank_id: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  transfer_prefix: string
}

export type ReceiptDbRow = {
  id: string
  member_id: string
  receipt_date: string
  settlement_amount: number
  note: string | null
  status: "open" | "partial" | "paid" | "cancelled"
  cancelled_at: string | null
  cancel_reason: string | null
}

export type StoredPaymentMethod =
  | "cash"
  | "transfer"
  | "legacy_import"
  | "other"

export type EditablePaymentMethod = "cash" | "transfer" | "legacy_import"

export type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  method: StoredPaymentMethod
  note: string | null
  status: "active" | "cancelled"
  cancelled_at: string | null
  cancel_reason: string | null
  transaction_date: string
  created_at: string
  updated_at: string
  source_period_id: string | null
}

export type ReceiptLine = {
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
  huiAmount: number
  receiveAmount: number
  feeAmount: number
}

export type Receipt = {
  key: string
  receiptDate: string
  member: MemberRow
  lines: ReceiptLine[]
  groupCount: number
  totalShares: number
  liveShares: number
  deadShares: number
  totalPay: number
  totalHuiAmount: number
  totalReceive: number
  totalFee: number
  db: ReceiptDbRow | null
  payments: PaymentRow[]
  settlementAmount: number
  netAmount: number
  paidAmount: number
  remainingAmount: number
  direction: "collect" | "pay" | "balanced"
  status: "open" | "partial" | "paid" | "cancelled"
}

export type ListFilter = "all" | "collect" | "pay" | "open" | "done"
export type DateMode = "single" | "range"

export type PaymentDialogState =
  | {
      mode: "create"
      receipts: Receipt[]
      partial: boolean
    }
  | {
      mode: "edit"
      receipt: Receipt
      payment: PaymentRow
    }
  | null

export const EMPTY_SETTINGS: SettingsRow = {
  owner_name: "",
  owner_phone: "",
  bank_id: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  transfer_prefix: "HUI",
}

