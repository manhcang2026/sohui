import type { Receipt, SettingsRow, StoredPaymentMethod, EditablePaymentMethod } from "./types"

export function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

export function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

export function formatDateRange(from: string, to: string) {
  if (from === to) return formatDate(from)
  return `${formatDate(from)} – ${formatDate(to)}`
}

export function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export function isCompleted(status: string) {
  return status === "completed" || status === "opened"
}

export function receiptStatusLabel(status: Receipt["status"]) {
  if (status === "cancelled") return "Đã hủy"
  if (status === "paid") return "Đã đủ"
  if (status === "partial") return "Một phần"
  return "Chưa thanh toán"
}

export function paymentMethodLabel(method: StoredPaymentMethod) {
  if (method === "cash") return "Tiền mặt"
  if (method === "transfer") return "Chuyển khoản"
  if (method === "legacy_import") return "Nhập dữ liệu cũ"
  return "Khác (dữ liệu cũ)"
}

export function normalizeEditableMethod(
  method: StoredPaymentMethod,
): EditablePaymentMethod {
  if (method === "cash") return "cash"
  if (method === "transfer") return "transfer"
  return "legacy_import"
}

export function parseAmount(value: string) {
  const clean = value.replace(/\./g, "").replace(/,/g, "").trim()
  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
}

export function formatAmountInput(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value || 0)))
}

function removeVietnameseMarks(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
}

function cleanMemberName(value: string) {
  const honorifics = new Set([
    "anh",
    "chi",
    "co",
    "di",
    "chu",
    "bac",
    "ong",
    "ba",
    "em",
    "thay",
    "cau",
    "mo",
  ])

  const asciiName = removeVietnameseMarks(value)
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ")

  const parts = asciiName.split(" ").filter(Boolean)

  while (
    parts.length > 1 &&
    honorifics.has(parts[0].toLowerCase())
  ) {
    parts.shift()
  }

  return parts.join(" ")
}

export function transferText(receipt: Receipt, date: string) {
  const cleanName = cleanMemberName(receipt.member.full_name).slice(0, 24)
  const [year, month, day] = date.slice(0, 10).split("-")
  const ddmmyy = `${day}${month}${year.slice(-2)}`

  return `${cleanName} ck ngay ${ddmmyy}`.trim().slice(0, 50)
}

export function vietQrUrl(
  settings: SettingsRow,
  receipt: Receipt,
  date: string,
) {
  if (
    receipt.direction !== "collect" ||
    receipt.remainingAmount <= 0 ||
    !settings.bank_id ||
    !settings.bank_account_number
  ) {
    return ""
  }

  const q = new URLSearchParams({
    amount: String(Math.round(receipt.remainingAmount)),
    addInfo: transferText(receipt, date),
    accountName: settings.bank_account_name,
  })

  return `https://img.vietqr.io/image/${encodeURIComponent(
    settings.bank_id,
  )}-${encodeURIComponent(
    settings.bank_account_number,
  )}-compact2.png?${q.toString()}`
}

export function receiptFileName(receipt: Receipt, date: string) {
  const memberName =
    cleanMemberName(receipt.member.full_name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hui-vien"

  return `phieu-hui-${memberName}-${date.replace(/-/g, "")}.jpg`
}

