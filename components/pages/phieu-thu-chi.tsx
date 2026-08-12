"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Download,
  History,
  LoaderCircle,
  Pencil,
  Phone,
  RefreshCw,
  Send,
  Share2,
  Undo2,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

type GroupRow = {
  id: string
  code: string | null
  name: string
  contribution_amount: number
  total_shares: number
  fee_amount: number
}

type ShareRow = {
  id: string
  group_id: string
  member_id: string
  share_number: number
  status: string
}

type PeriodRow = {
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

type MemberRow = {
  id: string
  full_name: string
  phone: string | null
}

type SettingsRow = {
  owner_name: string
  owner_phone: string
  bank_id: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  transfer_prefix: string
}

type ReceiptDbRow = {
  id: string
  member_id: string
  receipt_date: string
  settlement_amount: number
  note: string | null
  status: "open" | "partial" | "paid" | "cancelled"
  cancelled_at: string | null
  cancel_reason: string | null
}

type StoredPaymentMethod =
  | "cash"
  | "transfer"
  | "legacy_import"
  | "other"

type EditablePaymentMethod = "cash" | "transfer" | "legacy_import"

type PaymentRow = {
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

type ReceiptLine = {
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

type Receipt = {
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

type ListFilter = "all" | "collect" | "pay" | "open" | "done"
type DateMode = "single" | "range"

type PaymentDialogState =
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

const EMPTY_SETTINGS: SettingsRow = {
  owner_name: "",
  owner_phone: "",
  bank_id: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  transfer_prefix: "HUI",
}

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-")
  return `${d}/${m}/${y}`
}

function formatDateRange(from: string, to: string) {
  if (from === to) return formatDate(from)
  return `${formatDate(from)} – ${formatDate(to)}`
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function isCompleted(status: string) {
  return status === "completed" || status === "opened"
}

function receiptStatusLabel(status: Receipt["status"]) {
  if (status === "cancelled") return "Đã hủy"
  if (status === "paid") return "Đã đủ"
  if (status === "partial") return "Một phần"
  return "Chưa thanh toán"
}

function paymentMethodLabel(method: StoredPaymentMethod) {
  if (method === "cash") return "Tiền mặt"
  if (method === "transfer") return "Chuyển khoản"
  if (method === "legacy_import") return "Nhập dữ liệu cũ"
  return "Khác (dữ liệu cũ)"
}

function normalizeEditableMethod(
  method: StoredPaymentMethod,
): EditablePaymentMethod {
  if (method === "cash") return "cash"
  if (method === "transfer") return "transfer"
  return "legacy_import"
}

function parseAmount(value: string) {
  const clean = value.replace(/\./g, "").replace(/,/g, "").trim()
  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
}

function formatAmountInput(value: number) {
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

function transferText(receipt: Receipt, date: string) {
  const cleanName = cleanMemberName(receipt.member.full_name).slice(0, 24)
  const [year, month, day] = date.slice(0, 10).split("-")
  const ddmmyy = `${day}${month}${year.slice(-2)}`

  return `${cleanName} ck ngay ${ddmmyy}`.trim().slice(0, 50)
}

function vietQrUrl(
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

function receiptFileName(receipt: Receipt, date: string) {
  const memberName =
    cleanMemberName(receipt.member.full_name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hui-vien"

  return `phieu-hui-${memberName}-${date.replace(/-/g, "")}.jpg`
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Không tải được ảnh QR"))
    image.src = url
  })
}

function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  filename: string,
) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Không thể tạo file JPG"))
          return
        }

        resolve(
          new File([blob], filename, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        )
      },
      "image/jpeg",
      0.94,
    )
  })
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)

  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

async function createReceiptJpeg(
  receipt: Receipt,
  date: string,
  settings: SettingsRow,
) {
  const width = 1080
  const margin = 54
  const contentWidth = width - margin * 2

  const COLORS = {
    background: "#fbfcfe",
    white: "#ffffff",
    strong: "#111c30",
    navy: "#253553",
    muted: "#738096",
    border: "#dce3ed",
    secondary: "#eef3f9",
    mutedBg: "#f4f6f9",
    collect: "#267a53",
    collectSoft: "#eef8f2",
    collectBorder: "#d4e9dc",
    pay: "#b85050",
    paySoft: "#fbf1f1",
    payBorder: "#eed3d3",
    live: "#34785c",
    liveSoft: "#f0f7f3",
    dead: "#9b5b5b",
    deadSoft: "#faf2f2",
  }

  await document.fonts.ready

  const bodyFont = getComputedStyle(document.body).fontFamily
  const fontFamily = `'Be Vietnam Pro', ${
    bodyFont || "'Inter', system-ui, sans-serif"
  }`

  function font(weight: number, size: number) {
    return `${weight} ${size}px ${fontFamily}`
  }

  const qrUrl = vietQrUrl(settings, receipt, date)
  let qrImage: HTMLImageElement | null = null

  if (qrUrl && receipt.status !== "cancelled") {
    try {
      qrImage = await loadImage(qrUrl)
    } catch (error) {
      console.error(error)
    }
  }

  const detailLayouts = receipt.lines.map((line) => {
    let moneyRows = 0

    if (line.payAmount > 0) moneyRows += 1
    if (line.huiAmount > 0) moneyRows += 1
    if (line.feeAmount > 0) moneyRows += 1

    moneyRows += 1

    const moneyHeight = moneyRows * 55 + 44
    const statsHeight = 126

    return {
      height: 112 + Math.max(statsHeight, moneyHeight) + 32,
    }
  })

  const detailsHeight = detailLayouts.reduce(
    (sum, item) => sum + item.height + 20,
    0,
  )

  const summaryRows = [
    receipt.totalPay > 0,
    receipt.totalReceive > 0,
    receipt.settlementAmount !== 0,
    receipt.paidAmount > 0,
  ].filter(Boolean).length

  const summaryHeight = 74 + summaryRows * 56 + 92

  const qrWidth = 400
  const qrHeight = qrImage
    ? qrWidth * (qrImage.naturalHeight / qrImage.naturalWidth)
    : 0
  const qrSectionHeight = qrImage ? 110 + qrHeight + 82 : 0

  const canvasHeight =
    205 +
    175 +
    154 +
    74 +
    detailsHeight +
    76 +
    summaryHeight +
    (qrImage ? 38 + qrSectionHeight : 0) +
    78

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = Math.ceil(canvasHeight)

  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Trình duyệt không hỗ trợ Canvas")
  }

  ctx.fillStyle = COLORS.background
  ctx.fillRect(0, 0, width, canvas.height)
  ctx.lineWidth = 2

  function drawCard(
    x: number,
    y: number,
    w: number,
    h: number,
    fill = COLORS.white,
    stroke = COLORS.border,
    radius = 16,
  ) {
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = 2
    roundedRect(ctx, x, y, w, h, radius)
    ctx.fill()
    ctx.stroke()
  }

  function drawDivider(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 2
    drawLine(ctx, x1, y1, x2, y2)
  }

  function drawPersonIcon(cx: number, cy: number, color: string, scale = 1) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(cx, cy - 7 * scale, 7 * scale, 0, Math.PI * 2)
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy + 10 * scale, 13 * scale, Math.PI, Math.PI * 2)
    ctx.lineTo(cx + 13 * scale, cy + 15 * scale)
    ctx.lineTo(cx - 13 * scale, cy + 15 * scale)
    ctx.closePath()
    ctx.fill()
  }

  function drawWalletIcon(cx: number, cy: number, color: string) {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 5

    roundedRect(ctx, cx - 24, cy - 18, 48, 38, 8)
    ctx.stroke()
    roundedRect(ctx, cx + 5, cy - 7, 25, 17, 5)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx + 15, cy + 1, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawPhoneIcon(cx: number, cy: number) {
    ctx.fillStyle = COLORS.navy
    ctx.textAlign = "center"
    ctx.font = font(700, 29)
    ctx.fillText("☎", cx, cy + 10)
  }

  function drawOwnerRow(
    label: string,
    value: string,
    rowY: number,
    type: "person" | "phone",
  ) {
    const cx = margin + 35
    const cy = rowY - 9

    ctx.fillStyle = COLORS.secondary
    ctx.beginPath()
    ctx.arc(cx, cy, 25, 0, Math.PI * 2)
    ctx.fill()

    if (type === "person") {
      drawPersonIcon(cx, cy, COLORS.navy)
    } else {
      drawPhoneIcon(cx, cy)
    }

    ctx.textAlign = "left"
    ctx.fillStyle = COLORS.muted
    ctx.font = font(400, 29)
    ctx.fillText(label, margin + 76, rowY)

    ctx.textAlign = "right"
    ctx.fillStyle = COLORS.strong
    ctx.font = font(700, 29)
    ctx.fillText(value, width - margin - 20, rowY)
  }

  function drawStatTile(
    label: string,
    value: number,
    x: number,
    y: number,
    w: number,
    kind: "live" | "dead",
  ) {
    const live = kind === "live"
    const color = live ? COLORS.live : COLORS.dead
    const fill = live ? COLORS.liveSoft : COLORS.deadSoft
    const stroke = live ? COLORS.collectBorder : COLORS.payBorder
    const h = 126
    const centerX = x + w / 2

    drawCard(x, y, w, h, fill, stroke, 14)

    ctx.fillStyle = live ? "#e6f3ec" : "#f7eaea"
    ctx.beginPath()
    ctx.arc(centerX, y + 30, 18, 0, Math.PI * 2)
    ctx.fill()

    drawPersonIcon(centerX, y + 31, color, 0.78)

    ctx.textAlign = "center"
    ctx.fillStyle = color
    ctx.font = font(600, 22)
    ctx.fillText(label, centerX, y + 73)

    ctx.font = font(800, 43)
    ctx.fillText(String(value), centerX, y + 111)
  }

  function drawMoneyRow(
    label: string,
    value: string,
    x: number,
    y: number,
    w: number,
    options?: {
      negative?: boolean
      strong?: boolean
      positive?: boolean
    },
  ) {
    ctx.textAlign = "left"
    ctx.fillStyle = options?.strong ? COLORS.strong : COLORS.muted
    ctx.font = options?.strong ? font(700, 30) : font(400, 29)
    ctx.fillText(label, x, y)

    ctx.textAlign = "right"

    let valueColor = COLORS.strong
    if (options?.negative) valueColor = COLORS.pay
    if (options?.positive) valueColor = COLORS.collect

    ctx.fillStyle = valueColor
    ctx.font = options?.strong ? font(800, 31) : font(700, 29)
    ctx.fillText(value, x + w, y)
  }

  let y = 92

  ctx.textAlign = "center"
  ctx.fillStyle = COLORS.navy
  ctx.font = font(800, 47)
  ctx.fillText("PHIẾU HỤI", width / 2, y)

  y += 57
  ctx.fillStyle = COLORS.strong
  ctx.font = font(700, 38)
  ctx.fillText(receipt.member.full_name, width / 2, y)

  y += 43
  ctx.fillStyle = COLORS.muted
  ctx.font = font(400, 27)
  ctx.fillText(formatDate(date), width / 2, y)

  y += 38

  const cancelled = receipt.status === "cancelled"
  const finished = !cancelled && receipt.remainingAmount <= 0
  const collect =
    !cancelled && !finished && receipt.direction === "collect"
  const pay = !cancelled && !finished && receipt.direction === "pay"

  let headline = "ĐÃ CÂN BẰNG"
  let amountText = formatVND(receipt.remainingAmount)
  let description = ""
  let actionColor = COLORS.navy
  let actionBg = COLORS.secondary
  let actionBorder = COLORS.border

  if (cancelled) {
    headline = "PHIẾU ĐÃ HỦY"
    amountText = "—"
  } else if (finished) {
    headline = "ĐÃ THANH TOÁN ĐỦ"
    amountText = formatVND(0)
  } else if (collect) {
    headline = "CẦN THU"
    amountText = `+${formatVND(receipt.remainingAmount)}`
    description = "Hụi viên đóng cho chủ hụi"
    actionColor = COLORS.collect
    actionBg = COLORS.collectSoft
    actionBorder = COLORS.collectBorder
  } else if (pay) {
    headline = "CẦN CHI"
    amountText = `−${formatVND(receipt.remainingAmount)}`
    description = "Chủ hụi giao cho hụi viên"
    actionColor = COLORS.pay
    actionBg = COLORS.paySoft
    actionBorder = COLORS.payBorder
  }

  const actionY = y
  drawCard(
    margin,
    actionY,
    contentWidth,
    148,
    actionBg,
    actionBorder,
    17,
  )

  const iconX = margin + 92
  const iconY = actionY + 74

  ctx.fillStyle = collect
    ? "#e2f1e7"
    : pay
      ? "#f5dddd"
      : COLORS.mutedBg
  ctx.beginPath()
  ctx.arc(iconX, iconY, 48, 0, Math.PI * 2)
  ctx.fill()
  drawWalletIcon(iconX, iconY, actionColor)

  ctx.strokeStyle = actionBorder
  drawLine(
    ctx,
    margin + 180,
    actionY + 24,
    margin + 180,
    actionY + 124,
  )

  const actionCenter =
    margin + 180 + (contentWidth - 180) / 2

  ctx.textAlign = "center"
  ctx.fillStyle = actionColor
  ctx.font = font(700, 28)
  ctx.fillText(headline, actionCenter, actionY + 42)

  ctx.font = font(800, 50)
  ctx.fillText(amountText, actionCenter, actionY + 96)

  if (description) {
    ctx.fillStyle = COLORS.muted
    ctx.font = font(400, 25)
    ctx.fillText(description, actionCenter, actionY + 126)
  }

  y = actionY + 174

  drawCard(
    margin,
    y,
    contentWidth,
    132,
    COLORS.white,
    COLORS.border,
    15,
  )

  drawOwnerRow(
    "Chủ hụi",
    settings.owner_name || "Chưa khai báo",
    y + 47,
    "person",
  )

  drawDivider(
    margin + 20,
    y + 66,
    width - margin - 20,
    y + 66,
  )

  drawOwnerRow(
    "SĐT",
    settings.owner_phone || "Chưa khai báo",
    y + 108,
    "phone",
  )

  y += 178

  ctx.textAlign = "left"
  ctx.fillStyle = COLORS.strong
  ctx.font = font(800, 35)
  ctx.fillText("Chi tiết hụi", margin, y)

  y += 27

  for (let index = 0; index < receipt.lines.length; index++) {
    const line = receipt.lines[index]
    const layout = detailLayouts[index]

    y += 18
    const cardY = y

    drawCard(
      margin,
      cardY,
      contentWidth,
      layout.height,
      COLORS.white,
      COLORS.border,
      15,
    )

    ctx.fillStyle = COLORS.secondary
    roundedRect(
      ctx,
      margin + 2,
      cardY + 2,
      contentWidth - 4,
      88,
      13,
    )
    ctx.fill()
    ctx.fillRect(margin + 2, cardY + 54, contentWidth - 4, 36)

    ctx.textAlign = "left"
    ctx.fillStyle = COLORS.strong
    ctx.font = font(800, 29)

    const groupTitle = line.groupCode
      ? `${line.groupCode} · ${line.groupName}`
      : line.groupName

    ctx.fillText(groupTitle, margin + 24, cardY + 40)

    ctx.textAlign = "right"
    ctx.font = font(700, 27)
    ctx.fillText(
      `Kỳ ${line.periodNumber}/${line.totalPeriods}`,
      width - margin - 24,
      cardY + 40,
    )

    ctx.textAlign = "left"
    ctx.fillStyle = COLORS.muted
    ctx.font = font(400, 23)
    ctx.fillText(
      `Giá thăm ${formatVND(line.bidAmount)}`,
      margin + 24,
      cardY + 72,
    )

    const bodyY = cardY + 113
    const statsWidth = 394
    const gap = 14
    const statWidth = (statsWidth - gap) / 2

    drawStatTile(
      "Chân sống",
      line.liveShares,
      margin + 24,
      bodyY,
      statWidth,
      "live",
    )

    drawStatTile(
      "Chân chết",
      line.deadShares,
      margin + 24 + statWidth + gap,
      bodyY,
      statWidth,
      "dead",
    )

    const dividerX = margin + 24 + statsWidth + 24

    drawDivider(
      dividerX,
      bodyY,
      dividerX,
      cardY + layout.height - 25,
    )

    const moneyX = dividerX + 29
    const moneyWidth = width - margin - 24 - moneyX
    let moneyY = bodyY + 35

    const lineNet = line.receiveAmount - line.payAmount

    if (line.payAmount > 0) {
      drawMoneyRow(
        "Tiền phải đóng",
        formatVND(line.payAmount),
        moneyX,
        moneyY,
        moneyWidth,
      )
      moneyY += 55
    }

    if (line.huiAmount > 0) {
      drawMoneyRow(
        "Tiền hốt",
        formatVND(line.huiAmount),
        moneyX,
        moneyY,
        moneyWidth,
      )
      moneyY += 55
    }

    if (line.feeAmount > 0) {
      drawMoneyRow(
        "Trừ tiền thảo",
        `−${formatVND(line.feeAmount)}`,
        moneyX,
        moneyY,
        moneyWidth,
        { negative: true },
      )
      moneyY += 28
    }

    drawDivider(
      moneyX,
      moneyY,
      moneyX + moneyWidth,
      moneyY,
    )

    moneyY += 42

    drawMoneyRow(
      "Kết quả dây này",
      `${lineNet >= 0 ? "+" : "−"}${formatVND(
        Math.abs(lineNet),
      )}`,
      moneyX,
      moneyY,
      moneyWidth,
      {
        strong: true,
        positive: lineNet > 0,
        negative: lineNet < 0,
      },
    )

    y = cardY + layout.height + 3
  }

  y += 42

  ctx.textAlign = "left"
  ctx.fillStyle = COLORS.strong
  ctx.font = font(800, 35)
  ctx.fillText("Tổng kết", margin, y)

  y += 26
  const summaryY = y

  drawCard(
    margin,
    summaryY,
    contentWidth,
    summaryHeight,
    COLORS.white,
    COLORS.border,
    15,
  )

  let rowY = summaryY + 48

  if (receipt.totalPay > 0) {
    drawMoneyRow(
      "Tổng phải đóng",
      formatVND(receipt.totalPay),
      margin + 24,
      rowY,
      contentWidth - 48,
    )
    rowY += 56
  }

  if (receipt.totalReceive > 0) {
    drawMoneyRow(
      "Tổng được nhận",
      formatVND(receipt.totalReceive),
      margin + 24,
      rowY,
      contentWidth - 48,
    )
    rowY += 56
  }

  if (receipt.settlementAmount !== 0) {
    const sign = receipt.settlementAmount > 0 ? "+" : "−"
    drawMoneyRow(
      "Tất toán / điều chỉnh",
      `${sign}${formatVND(Math.abs(receipt.settlementAmount))}`,
      margin + 24,
      rowY,
      contentWidth - 48,
    )
    rowY += 56
  }

  if (receipt.paidAmount > 0) {
    drawMoneyRow(
      "Đã thu / chi",
      formatVND(receipt.paidAmount),
      margin + 24,
      rowY,
      contentWidth - 48,
    )
    rowY += 56
  }

  const highlightY = summaryY + summaryHeight - 78

  drawCard(
    margin + 18,
    highlightY,
    contentWidth - 36,
    62,
    COLORS.secondary,
    COLORS.border,
    10,
  )

  const finalSummaryLabel =
    receipt.direction === "collect"
      ? "CẦN THU"
      : receipt.direction === "pay"
        ? "CHỦ HỤI GIAO"
        : "ĐÃ CÂN BẰNG"

  drawMoneyRow(
    finalSummaryLabel,
    formatVND(Math.abs(receipt.remainingAmount)),
    margin + 36,
    highlightY + 41,
    contentWidth - 72,
    {
      strong: true,
      positive: receipt.direction === "collect",
      negative: receipt.direction === "pay",
    },
  )

  y = summaryY + summaryHeight

  if (qrImage) {
    y += 38
    const qrCardHeight = qrSectionHeight

    drawCard(
      margin,
      y,
      contentWidth,
      qrCardHeight,
      COLORS.secondary,
      COLORS.border,
      15,
    )

    ctx.fillStyle = COLORS.strong
    ctx.textAlign = "center"
    ctx.font = font(700, 30)
    ctx.fillText("Quét QR để đóng đúng số tiền", width / 2, y + 49)

    const qrX = (width - qrWidth) / 2
    const qrY = y + 76

    ctx.drawImage(qrImage, qrX, qrY, qrWidth, qrHeight)

    ctx.fillStyle = COLORS.muted
    ctx.font = font(400, 27)
    ctx.fillText(
      `Nội dung: ${transferText(receipt, date)}`,
      width / 2,
      qrY + qrHeight + 42,
    )
  }

  return canvasToJpegFile(
    canvas,
    receiptFileName(receipt, date),
  )
}

async function shareReceiptJpg(
  receipt: Receipt,
  settings: SettingsRow,
) {
  const file = await createReceiptJpeg(
    receipt,
    receipt.receiptDate,
    settings,
  )
  const shareText = `Phiếu hụi ngày ${formatDate(receipt.receiptDate)}`

  if (
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    try {
      await navigator.share({
        title: shareText,
        text: shareText,
        files: [file],
      })
      return
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      console.error(e)
    }
  }

  downloadFile(file)
  window.alert(
    "Thiết bị này chưa hỗ trợ chia sẻ ảnh trực tiếp. Phiếu JPG đã được lưu xuống máy. Bạn mở Zalo và chọn ảnh vừa lưu để gửi.",
  )
}

export function PhieuThuChiPage() {
  const today = todayInVietnam()

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [settings, setSettings] = useState<SettingsRow>(EMPTY_SETTINGS)
  const [receiptRows, setReceiptRows] = useState<ReceiptDbRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [dateMode, setDateMode] = useState<DateMode>("single")
  const [singleDate, setSingleDate] = useState(today)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [filter, setFilter] = useState<ListFilter>("all")
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [paymentDialog, setPaymentDialog] =
    useState<PaymentDialogState>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [sharingKey, setSharingKey] = useState<string | null>(null)
  const [error, setError] = useState("")

  const effectiveFrom = dateMode === "single" ? singleDate : dateFrom
  const effectiveTo = dateMode === "single" ? singleDate : dateTo

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")

    const supabase = createClient()

    const [g, s, p, m, cfg, r, pay] = await Promise.all([
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
      supabase
        .from("members")
        .select("id, full_name, phone"),
      supabase
        .from("app_settings")
        .select(
          "owner_name, owner_phone, bank_id, bank_name, bank_account_number, bank_account_name, transfer_prefix",
        )
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("hui_receipts")
        .select(
          "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
        ),
      supabase
        .from("receipt_payments")
        .select(
          "id, receipt_id, direction, amount, method, note, status, cancelled_at, cancel_reason, transaction_date, created_at, updated_at, source_period_id",
        )
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ])

    const firstError =
      g.error ??
      s.error ??
      p.error ??
      m.error ??
      cfg.error ??
      r.error ??
      pay.error

    if (firstError) {
      console.error(firstError)
      setError(
        "Không thể tải dữ liệu phiếu. Hãy chạy SQL cập nhật receipt_payments trước rồi thử lại.",
      )
      setLoading(false)
      return
    }

    setGroups((g.data ?? []) as GroupRow[])
    setShares((s.data ?? []) as ShareRow[])
    setPeriods((p.data ?? []) as PeriodRow[])
    setMembers((m.data ?? []) as MemberRow[])
    setSettings((cfg.data as SettingsRow | null) ?? EMPTY_SETTINGS)
    setReceiptRows((r.data ?? []) as ReceiptDbRow[])
    setPayments((pay.data ?? []) as PaymentRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const receipts = useMemo(() => {
    if (!effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo) {
      return []
    }

    const groupsById = new Map(groups.map((x) => [x.id, x]))
    const membersById = new Map(members.map((x) => [x.id, x]))
    const sharesByGroup = new Map<string, ShareRow[]>()
    const periodsByGroup = new Map<string, PeriodRow[]>()

    for (const x of shares) {
      const arr = sharesByGroup.get(x.group_id) ?? []
      arr.push(x)
      sharesByGroup.set(x.group_id, arr)
    }

    for (const x of periods) {
      const arr = periodsByGroup.get(x.group_id) ?? []
      arr.push(x)
      periodsByGroup.set(x.group_id, arr)
    }

    const linesByReceiptKey = new Map<
      string,
      { memberId: string; date: string; lines: ReceiptLine[] }
    >()

    for (
      const period of periods.filter(
        (x) =>
          isCompleted(x.status) &&
          x.scheduled_date >= effectiveFrom &&
          x.scheduled_date <= effectiveTo,
      )
    ) {
      const group = groupsById.get(period.group_id)
      if (!group || !period.winner_share_id) continue

      const groupShares = (sharesByGroup.get(group.id) ?? []).filter(
        (x) =>
          x.status === "active" ||
          x.id === period.winner_share_id,
      )

      const groupPeriods = periodsByGroup.get(group.id) ?? []

      const previousWinnerIds = new Set(
        groupPeriods
          .filter(
            (x) =>
              x.period_number < period.period_number &&
              isCompleted(x.status) &&
              x.winner_share_id,
          )
          .map((x) => x.winner_share_id as string),
      )

      const bid = Number(period.bid_amount || 0)
      const contribution = Number(group.contribution_amount || 0)
      const liveContribution = Math.max(0, contribution - bid)
      const amountByShare = new Map<string, number>()
      let pot = 0

      for (const share of groupShares) {
        if (share.id === period.winner_share_id) {
          amountByShare.set(share.id, 0)
          continue
        }

        const amount = previousWinnerIds.has(share.id)
          ? contribution
          : liveContribution

        amountByShare.set(share.id, amount)
        pot += amount
      }

      const winner = groupShares.find(
        (x) => x.id === period.winner_share_id,
      )
      const winnerMemberId = winner?.member_id ?? null
      const fee = Number(
        period.fee_amount ?? group.fee_amount ?? 0,
      )
      const huiAmount = Math.max(0, pot)
      const winnerReceive = Math.max(0, huiAmount - fee)
      const memberIds = new Set(groupShares.map((x) => x.member_id))

      for (const memberId of memberIds) {
        if (!membersById.has(memberId)) continue

        let liveShares = 0
        let deadShares = 0
        let payAmount = 0

        const memberShares = groupShares.filter(
          (x) => x.member_id === memberId,
        )

        for (const share of memberShares) {
          if (share.id === period.winner_share_id) {
            liveShares += 1
            continue
          }

          if (previousWinnerIds.has(share.id)) {
            deadShares += 1
          } else {
            liveShares += 1
          }

          payAmount += amountByShare.get(share.id) ?? 0
        }

        const line: ReceiptLine = {
          periodId: period.id,
          groupId: group.id,
          groupCode: group.code ?? "",
          groupName: group.name,
          periodNumber: period.period_number,
          totalPeriods: Math.max(
            group.total_shares,
            groupPeriods.length,
          ),
          bidAmount: bid,
          liveShares,
          deadShares,
          payAmount,
          huiAmount:
            memberId === winnerMemberId ? huiAmount : 0,
          receiveAmount:
            memberId === winnerMemberId ? winnerReceive : 0,
          feeAmount:
            memberId === winnerMemberId ? fee : 0,
        }

        const key = `${period.scheduled_date}|${memberId}`
        const current = linesByReceiptKey.get(key) ?? {
          memberId,
          date: period.scheduled_date,
          lines: [],
        }
        current.lines.push(line)
        linesByReceiptKey.set(key, current)
      }
    }

    const result: Receipt[] = []

    for (const [key, item] of linesByReceiptKey) {
      const member = membersById.get(item.memberId)
      if (!member) continue

      const lines = item.lines
      const totalPay = lines.reduce((n, x) => n + x.payAmount, 0)
      const totalHuiAmount = lines.reduce((n, x) => n + x.huiAmount, 0)
      const totalReceive = lines.reduce((n, x) => n + x.receiveAmount, 0)
      const totalFee = lines.reduce((n, x) => n + x.feeAmount, 0)

      const db =
        receiptRows.find(
          (x) =>
            x.member_id === item.memberId &&
            x.receipt_date === item.date,
        ) ?? null

      const settlementAmount = Number(db?.settlement_amount ?? 0)
      const netAmount = totalPay - totalReceive + settlementAmount

      const direction: Receipt["direction"] =
        netAmount > 0
          ? "collect"
          : netAmount < 0
            ? "pay"
            : "balanced"

      const allReceiptPayments = db
        ? payments.filter((x) => x.receipt_id === db.id)
        : []

      const activePayments = allReceiptPayments.filter(
        (x) =>
          x.status === "active" &&
          x.direction === direction,
      )

      const paidAmount = activePayments.reduce(
        (n, x) => n + Number(x.amount),
        0,
      )

      const remainingAmount = Math.max(
        0,
        Math.abs(netAmount) - paidAmount,
      )

      let status: Receipt["status"] = db?.status ?? "open"

      if (status !== "cancelled") {
        if (remainingAmount <= 0 && Math.abs(netAmount) > 0) {
          status = "paid"
        } else if (paidAmount > 0) {
          status = "partial"
        } else {
          status = "open"
        }
      }

      result.push({
        key,
        receiptDate: item.date,
        member,
        lines,
        groupCount: new Set(lines.map((x) => x.groupId)).size,
        totalShares: lines.reduce(
          (n, x) => n + x.liveShares + x.deadShares,
          0,
        ),
        liveShares: lines.reduce((n, x) => n + x.liveShares, 0),
        deadShares: lines.reduce((n, x) => n + x.deadShares, 0),
        totalPay,
        totalHuiAmount,
        totalReceive,
        totalFee,
        db,
        payments: allReceiptPayments,
        settlementAmount,
        netAmount,
        paidAmount,
        remainingAmount,
        direction,
        status,
      })
    }

    return result.sort((a, b) => {
      const dateCompare = b.receiptDate.localeCompare(a.receiptDate)
      if (dateCompare !== 0) return dateCompare
      return a.member.full_name.localeCompare(b.member.full_name, "vi")
    })
  }, [
    effectiveFrom,
    effectiveTo,
    groups,
    members,
    payments,
    periods,
    receiptRows,
    shares,
  ])

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      if (filter === "all") return true
      if (filter === "collect") return receipt.direction === "collect"
      if (filter === "pay") return receipt.direction === "pay"
      if (filter === "done") {
        return receipt.status === "paid" || receipt.direction === "balanced"
      }
      return (
        receipt.status !== "paid" &&
        receipt.status !== "cancelled" &&
        receipt.direction !== "balanced"
      )
    })
  }, [filter, receipts])

  const stats = useMemo(() => {
    const active = receipts.filter((r) => r.status !== "cancelled")
    const collect = active.filter(
      (r) => r.direction === "collect" && r.remainingAmount > 0,
    )
    const pay = active.filter(
      (r) => r.direction === "pay" && r.remainingAmount > 0,
    )
    const done = active.filter(
      (r) => r.remainingAmount <= 0,
    )

    return {
      total: active.length,
      collectCount: collect.length,
      collectAmount: collect.reduce((n, r) => n + r.remainingAmount, 0),
      payCount: pay.length,
      payAmount: pay.reduce((n, r) => n + r.remainingAmount, 0),
      doneCount: done.length,
    }
  }, [receipts])

  const preview = receipts.find((x) => x.key === previewKey) ?? null

  const selectedReceipts = useMemo(
    () => receipts.filter((r) => selectedKeys.includes(r.key)),
    [receipts, selectedKeys],
  )

  const selectedCollect = selectedReceipts.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.direction === "collect" &&
      r.remainingAmount > 0,
  )
  const selectedPay = selectedReceipts.filter(
    (r) =>
      r.status !== "cancelled" &&
      r.direction === "pay" &&
      r.remainingAmount > 0,
  )

  const allVisibleChecked =
    filteredReceipts.length > 0 &&
    filteredReceipts.every((r) => selectedKeys.includes(r.key))

  function toggleSelected(key: string) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((x) => x !== key)
        : [...current, key],
    )
  }

  function toggleAllVisible() {
    if (allVisibleChecked) {
      const visible = new Set(filteredReceipts.map((r) => r.key))
      setSelectedKeys((current) => current.filter((x) => !visible.has(x)))
      return
    }

    setSelectedKeys((current) => [
      ...new Set([...current, ...filteredReceipts.map((r) => r.key)]),
    ])
  }

  function resetListContext() {
    setSelectedKeys([])
    setPreviewKey(null)
  }

  async function ensureReceipt(receipt: Receipt) {
    const payload = {
      member_id: receipt.member.id,
      receipt_date: receipt.receiptDate,
      source_total_pay: receipt.totalPay,
      source_total_receive: receipt.totalReceive,
      source_total_fee: receipt.totalFee,
      source_total_profit: 0,
      updated_at: new Date().toISOString(),
    }

    const q = receipt.db
      ? createClient()
          .from("hui_receipts")
          .update(payload)
          .eq("id", receipt.db.id)
      : createClient()
          .from("hui_receipts")
          .upsert(payload, {
            onConflict: "member_id,receipt_date",
          })

    const { data, error: receiptError } = await q
      .select(
        "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
      )
      .single()

    if (receiptError) throw receiptError
    return data as ReceiptDbRow
  }

  async function updateStoredReceiptStatus(
    receiptId: string,
    totalRequired: number,
    activePaid: number,
  ) {
    const nextStatus =
      totalRequired > 0 && activePaid >= totalRequired
        ? "paid"
        : activePaid > 0
          ? "partial"
          : "open"

    const { error: statusError } = await createClient()
      .from("hui_receipts")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", receiptId)

    if (statusError) throw statusError
  }

  async function createPayments(input: {
    receipts: Receipt[]
    transactionDate: string
    method: "cash" | "transfer"
    note: string
    amount?: number
  }) {
    if (input.receipts.length === 0) return

    setWorking(true)
    setError("")

    try {
      const eligible = input.receipts.filter(
        (receipt) =>
          receipt.status !== "cancelled" &&
          receipt.direction !== "balanced" &&
          receipt.remainingAmount > 0,
      )

      if (eligible.length === 0) return

      const dbRows = await Promise.all(eligible.map(ensureReceipt))
      const dbByKey = new Map(
        eligible.map((receipt, index) => [receipt.key, dbRows[index]]),
      )

      const payload = eligible.map((receipt) => {
        const db = dbByKey.get(receipt.key)
        if (!db) throw new Error("Không tìm thấy phiếu để ghi giao dịch")

        const amount =
          eligible.length === 1 && input.amount != null
            ? input.amount
            : receipt.remainingAmount

        if (amount <= 0 || amount > receipt.remainingAmount) {
          throw new Error(
            `Số tiền của ${receipt.member.full_name} không hợp lệ.`,
          )
        }

        return {
          receipt_id: db.id,
          direction: receipt.direction,
          amount,
          method: input.method,
          transaction_date: input.transactionDate,
          note: input.note.trim() || null,
        }
      })

      const supabase = createClient()
      const { error: insertError } = await supabase
        .from("receipt_payments")
        .insert(payload)

      if (insertError) throw insertError

      await Promise.all(
        eligible.map(async (receipt, index) => {
          const db = dbRows[index]
          const added = payload[index].amount
          await updateStoredReceiptStatus(
            db.id,
            Math.abs(receipt.netAmount),
            receipt.paidAmount + added,
          )
        }),
      )

      const auditPayload = eligible.map((receipt, index) => ({
        entity_type: "receipt",
        entity_id: dbRows[index].id,
        action:
          receipt.direction === "collect"
            ? "collect_payment"
            : "pay_payment",
        after_data: {
          amount: payload[index].amount,
          method: input.method,
          transaction_date: input.transactionDate,
          note: input.note.trim() || null,
        },
      }))

      await supabase.from("audit_logs").insert(auditPayload)

      setPaymentDialog(null)
      setSelectedKeys([])
      await loadData()
    } catch (caught) {
      console.error(caught)
      setError(
        caught instanceof Error
          ? `Không thể ghi nhận giao dịch: ${caught.message}`
          : "Không thể ghi nhận giao dịch.",
      )
    } finally {
      setWorking(false)
    }
  }

  async function editPayment(
    receipt: Receipt,
    payment: PaymentRow,
    input: {
      amount: number
      transactionDate: string
      method: EditablePaymentMethod
      note: string
    },
  ) {
    if (payment.status !== "active") return

    const otherActivePaid = Math.max(
      0,
      receipt.paidAmount - Number(payment.amount),
    )
    const maxAmount = Math.max(
      0,
      Math.abs(receipt.netAmount) - otherActivePaid,
    )

    if (input.amount <= 0 || input.amount > maxAmount) {
      window.alert(
        `Số tiền phải lớn hơn 0 và không vượt quá ${formatVND(maxAmount)}.`,
      )
      return
    }

    setWorking(true)
    setError("")

    try {
      const supabase = createClient()
      const before = {
        amount: Number(payment.amount),
        method: payment.method,
        transaction_date: payment.transaction_date,
        note: payment.note,
      }
      const after = {
        amount: input.amount,
        method: input.method,
        transaction_date: input.transactionDate,
        note: input.note.trim() || null,
      }

      const { error: updateError } = await supabase
        .from("receipt_payments")
        .update({
          ...after,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)

      if (updateError) throw updateError

      if (receipt.db) {
        await updateStoredReceiptStatus(
          receipt.db.id,
          Math.abs(receipt.netAmount),
          otherActivePaid + input.amount,
        )
      }

      await supabase.from("audit_logs").insert({
        entity_type: "payment",
        entity_id: payment.id,
        action: "edit",
        before_data: before,
        after_data: after,
        reason:
          payment.method === "legacy_import" || payment.method === "other"
            ? "Đối chiếu / chỉnh dữ liệu cũ"
            : "Chỉnh giao dịch thu chi",
      })

      setPaymentDialog(null)
      await loadData()
    } catch (caught) {
      console.error(caught)
      setError("Không thể sửa giao dịch.")
    } finally {
      setWorking(false)
    }
  }

  async function cancelPayment(
    receipt: Receipt,
    payment: PaymentRow,
  ) {
    const reason = window.prompt("Lý do hủy giao dịch này:")
    if (!reason?.trim()) return

    setWorking(true)
    setError("")

    try {
      const supabase = createClient()

      const { error: cancelError } = await supabase
        .from("receipt_payments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)

      if (cancelError) throw cancelError

      if (receipt.db) {
        await updateStoredReceiptStatus(
          receipt.db.id,
          Math.abs(receipt.netAmount),
          Math.max(0, receipt.paidAmount - Number(payment.amount)),
        )
      }

      await supabase.from("audit_logs").insert({
        entity_type: "payment",
        entity_id: payment.id,
        action: "cancel",
        before_data: payment,
        after_data: { ...payment, status: "cancelled" },
        reason: reason.trim(),
      })

      await loadData()
    } catch (caught) {
      console.error(caught)
      setError("Không thể hủy giao dịch.")
    } finally {
      setWorking(false)
    }
  }

  async function editReceipt(receipt: Receipt) {
    const answer = window.prompt(
      "Điều chỉnh/tất toán thêm. Số dương = hụi viên đóng thêm; số âm = chủ hụi giao thêm.",
      String(receipt.settlementAmount),
    )

    if (answer === null) return

    const settlement = Number(
      answer.replace(/\./g, "").replace(/,/g, ""),
    )

    if (!Number.isFinite(settlement)) {
      window.alert("Số điều chỉnh không hợp lệ.")
      return
    }

    const note =
      window.prompt(
        "Ghi chú/lý do điều chỉnh:",
        receipt.db?.note ?? "",
      ) ?? ""

    const reason = window.prompt(
      "Lý do sửa phiếu:",
      "Điều chỉnh nghiệp vụ",
    )

    if (!reason?.trim()) return

    setWorking(true)
    setError("")

    try {
      const db = await ensureReceipt(receipt)
      const supabase = createClient()

      const before = {
        settlement_amount: receipt.settlementAmount,
        note: receipt.db?.note ?? null,
      }

      const after = {
        settlement_amount: settlement,
        note: note.trim() || null,
      }

      const { error: receiptUpdateError } = await supabase
        .from("hui_receipts")
        .update({
          ...after,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", db.id)

      if (receiptUpdateError) throw receiptUpdateError

      await supabase.from("audit_logs").insert({
        entity_type: "receipt",
        entity_id: db.id,
        action: "edit",
        before_data: before,
        after_data: after,
        reason: reason.trim(),
      })

      await loadData()
    } catch (caught) {
      console.error(caught)
      setError("Không thể sửa phiếu.")
    } finally {
      setWorking(false)
    }
  }

  async function cancelReceipt(receipt: Receipt) {
    const reason = window.prompt("Lý do hủy phiếu:")
    if (!reason?.trim()) return

    if (
      receipt.payments.some((x) => x.status === "active") &&
      !window.confirm(
        "Phiếu đang có giao dịch thu/chi. Nên hủy từng giao dịch trước. Vẫn hủy phiếu?",
      )
    ) {
      return
    }

    setWorking(true)
    setError("")

    try {
      const db = await ensureReceipt(receipt)
      const supabase = createClient()

      const { error: receiptCancelError } = await supabase
        .from("hui_receipts")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", db.id)

      if (receiptCancelError) throw receiptCancelError

      await supabase.from("audit_logs").insert({
        entity_type: "receipt",
        entity_id: db.id,
        action: "cancel",
        before_data: { status: receipt.status },
        after_data: { status: "cancelled" },
        reason: reason.trim(),
      })

      await loadData()
    } catch (caught) {
      console.error(caught)
      setError("Không thể hủy phiếu.")
    } finally {
      setWorking(false)
    }
  }

  async function handleShareFromList(receipt: Receipt) {
    if (sharingKey || working) return
    setSharingKey(receipt.key)

    try {
      await shareReceiptJpg(receipt, settings)
    } catch (caught) {
      console.error(caught)
      window.alert(
        "Không thể tạo ảnh phiếu để gửi Zalo. Vui lòng thử lại.",
      )
    } finally {
      setSharingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang lập phiếu từ dữ liệu hụi...
      </div>
    )
  }

  if (error && groups.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
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

  if (preview) {
    return (
      <>
        <ReceiptPreview
          receipt={preview}
          settings={settings}
          working={working}
          onBack={() => setPreviewKey(null)}
          onFull={() =>
            setPaymentDialog({
              mode: "create",
              receipts: [preview],
              partial: false,
            })
          }
          onPartial={() =>
            setPaymentDialog({
              mode: "create",
              receipts: [preview],
              partial: true,
            })
          }
          onEdit={() => void editReceipt(preview)}
          onCancel={() => void cancelReceipt(preview)}
          onEditPayment={(payment) =>
            setPaymentDialog({
              mode: "edit",
              receipt: preview,
              payment,
            })
          }
          onCancelPayment={(payment) =>
            void cancelPayment(preview, payment)
          }
        />

        <PaymentDialog
          state={paymentDialog}
          working={working}
          onClose={() => setPaymentDialog(null)}
          onCreate={(input) => void createPayments(input)}
          onEdit={(receipt, payment, input) =>
            void editPayment(receipt, payment, input)
          }
        />
      </>
    )
  }

  const invalidRange = effectiveFrom > effectiveTo
  const rangeLabel = invalidRange
    ? "Khoảng ngày chưa hợp lệ"
    : formatDateRange(effectiveFrom, effectiveTo)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Phiếu hụi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi phiếu, thu/chi thực tế và gửi ảnh qua Zalo.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={working}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Tổng phiếu"
          value={`${stats.total}`}
          hint={rangeLabel}
        />
        <SummaryCard
          label="Còn phải thu"
          value={formatVND(stats.collectAmount)}
          hint={`${stats.collectCount} phiếu chưa thu đủ`}
          tone="collect"
        />
        <SummaryCard
          label="Còn phải chi"
          value={formatVND(stats.payAmount)}
          hint={`${stats.payCount} phiếu chưa chi đủ`}
          tone="pay"
        />
        <SummaryCard
          label="Đã xong"
          value={`${stats.doneCount}`}
          hint="phiếu đã thanh toán đủ"
          tone="done"
        />
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={dateMode === "single" ? "default" : "outline"}
            onClick={() => {
              setDateMode("single")
              resetListContext()
            }}
          >
            <CalendarDays className="size-4" />
            Một ngày
          </Button>
          <Button
            size="sm"
            variant={dateMode === "range" ? "default" : "outline"}
            onClick={() => {
              setDateMode("range")
              setDateFrom(singleDate)
              setDateTo(singleDate)
              resetListContext()
            }}
          >
            <CalendarRange className="size-4" />
            Khoảng thời gian
          </Button>
        </div>

        {dateMode === "single" ? (
          <label className="flex max-w-[260px] flex-col gap-1.5 text-sm font-medium">
            Ngày phiếu
            <Input
              type="date"
              value={singleDate}
              onChange={(e) => {
                setSingleDate(e.target.value)
                resetListContext()
              }}
            />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[560px]">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Từ ngày
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  resetListContext()
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Đến ngày
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  resetListContext()
                }}
              />
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {(
            [
              ["all", "Tất cả"],
              ["collect", "Phải thu"],
              ["pay", "Phải chi"],
              ["open", "Chưa xong"],
              ["done", "Đã xong"],
            ] as Array<[ListFilter, string]>
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => {
                setFilter(key)
                setSelectedKeys([])
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {invalidRange && (
        <p className="text-sm text-destructive">
          Từ ngày phải nhỏ hơn hoặc bằng đến ngày.
        </p>
      )}

      {!invalidRange && filteredReceipts.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <Checkbox
            checked={allVisibleChecked}
            onCheckedChange={toggleAllVisible}
            className="size-5"
          />
          <button
            type="button"
            className="text-sm font-semibold"
            onClick={toggleAllVisible}
          >
            Chọn tất cả ({filteredReceipts.length})
          </button>
        </div>
      )}

      {!invalidRange && filteredReceipts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Chưa có phiếu phù hợp</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hãy đổi ngày/bộ lọc hoặc chốt kết quả kỳ hụi trước.
            </p>
          </div>
        </Card>
      ) : null}

      {!invalidRange && filteredReceipts.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <div className="max-h-[62vh] overflow-auto">
              <table className="w-full min-w-[950px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-left">
                  <tr>
                    <th className="w-12 px-3 py-3" />
                    {dateMode === "range" && (
                      <th className="px-3 py-3 font-bold">Ngày phiếu</th>
                    )}
                    <th className="px-3 py-3 font-bold">Hụi viên</th>
                    <th className="px-3 py-3 font-bold">Chiều phiếu</th>
                    <th className="px-3 py-3 text-right font-bold">Số cuối</th>
                    <th className="px-3 py-3 font-bold">Thanh toán</th>
                    <th className="px-3 py-3 font-bold">Gửi Zalo</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <ReceiptTableRow
                      key={receipt.key}
                      receipt={receipt}
                      showDate={dateMode === "range"}
                      checked={selectedKeys.includes(receipt.key)}
                      sharing={sharingKey === receipt.key}
                      onToggle={() => toggleSelected(receipt.key)}
                      onView={() => setPreviewKey(receipt.key)}
                      onShare={() => void handleShareFromList(receipt)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredReceipts.map((receipt) => (
              <ReceiptMobileCard
                key={receipt.key}
                receipt={receipt}
                showDate={dateMode === "range"}
                checked={selectedKeys.includes(receipt.key)}
                sharing={sharingKey === receipt.key}
                onToggle={() => toggleSelected(receipt.key)}
                onView={() => setPreviewKey(receipt.key)}
                onShare={() => void handleShareFromList(receipt)}
              />
            ))}
          </div>
        </>
      )}

      {selectedKeys.length > 0 && (
        <div className="sticky bottom-3 z-30 rounded-xl border bg-card p-3 shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold">
                Đã chọn {selectedKeys.length} phiếu
              </p>
              <p className="text-xs text-muted-foreground">
                Thu: {selectedCollect.length} · Chi: {selectedPay.length}. Phiếu đã xong/hủy sẽ được bỏ qua.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={working || selectedCollect.length === 0}
                onClick={() =>
                  setPaymentDialog({
                    mode: "create",
                    receipts: selectedCollect,
                    partial: false,
                  })
                }
              >
                <CheckCheck className="size-4" />
                Ghi nhận đã thu ({selectedCollect.length})
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={working || selectedPay.length === 0}
                onClick={() =>
                  setPaymentDialog({
                    mode: "create",
                    receipts: selectedPay,
                    partial: false,
                  })
                }
              >
                <WalletCards className="size-4" />
                Ghi nhận đã chi ({selectedPay.length})
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedKeys([])}
                disabled={working}
              >
                Bỏ chọn
              </Button>
            </div>
          </div>
        </div>
      )}

      <PaymentDialog
        state={paymentDialog}
        working={working}
        onClose={() => setPaymentDialog(null)}
        onCreate={(input) => void createPayments(input)}
        onEdit={(receipt, payment, input) =>
          void editPayment(receipt, payment, input)
        }
      />
    </div>
  )
}

function SummaryCard({
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

function ReceiptTableRow({
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

function ReceiptMobileCard({
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

function DirectionBadge({ receipt }: { receipt: Receipt }) {
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

function PaymentBadge({ receipt }: { receipt: Receipt }) {
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

function PaymentDialog({
  state,
  working,
  onClose,
  onCreate,
  onEdit,
}: {
  state: PaymentDialogState
  working: boolean
  onClose: () => void
  onCreate: (input: {
    receipts: Receipt[]
    transactionDate: string
    method: "cash" | "transfer"
    note: string
    amount?: number
  }) => void
  onEdit: (
    receipt: Receipt,
    payment: PaymentRow,
    input: {
      amount: number
      transactionDate: string
      method: EditablePaymentMethod
      note: string
    },
  ) => void
}) {
  const [transactionDate, setTransactionDate] = useState(todayInVietnam())
  const [method, setMethod] = useState<EditablePaymentMethod>("transfer")
  const [amountText, setAmountText] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!state) return

    if (state.mode === "edit") {
      setTransactionDate(
        state.payment.transaction_date || state.receipt.receiptDate,
      )
      setMethod(normalizeEditableMethod(state.payment.method))
      setAmountText(formatAmountInput(Number(state.payment.amount)))
      setNote(state.payment.note ?? "")
      return
    }

    setTransactionDate(todayInVietnam())
    setMethod("transfer")
    setNote("")

    if (state.receipts.length === 1) {
      setAmountText(
        formatAmountInput(state.receipts[0].remainingAmount),
      )
    } else {
      setAmountText("")
    }
  }, [state])

  if (!state) return null

  const editing = state.mode === "edit"
  const receipts = editing ? [state.receipt] : state.receipts
  const direction = editing
    ? state.payment.direction
    : receipts[0]?.direction ?? "collect"
  const total = editing
    ? Number(state.payment.amount)
    : receipts.reduce((n, r) => n + r.remainingAmount, 0)
  const showAmount = editing || (!editing && state.partial && receipts.length === 1)
  const amount = showAmount ? parseAmount(amountText) : undefined

  const title = editing
    ? "Sửa giao dịch"
    : direction === "collect"
      ? "Xác nhận thu tiền"
      : "Xác nhận chi tiền"

  const actionText = editing
    ? "Lưu thay đổi"
    : direction === "collect"
      ? `Xác nhận đã thu${receipts.length > 1 ? ` ${receipts.length} phiếu` : ""}`
      : `Xác nhận đã chi${receipts.length > 1 ? ` ${receipts.length} phiếu` : ""}`

  const allowLegacy = editing &&
    (state.payment.method === "legacy_import" || state.payment.method === "other")

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl">
        <div className="border-b p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {editing
                  ? `${state.receipt.member.full_name} · phiếu ${formatDate(state.receipt.receiptDate)}`
                  : receipts.length === 1
                    ? `${receipts[0].member.full_name} · phiếu ${formatDate(receipts[0].receiptDate)}`
                    : `${receipts.length} phiếu · tổng ${formatVND(total)}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={working}
            >
              Đóng
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {!showAmount && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Số tiền ghi nhận
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums">
                {formatVND(total)}
              </p>
              {receipts.length > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Mỗi phiếu sẽ tạo một giao dịch riêng bằng đúng số còn lại của phiếu đó.
                </p>
              )}
            </div>
          )}

          {showAmount && (
            <label className="block text-sm font-medium">
              Số tiền
              <Input
                className="mt-1.5"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </label>
          )}

          <label className="block text-sm font-medium">
            Ngày thanh toán
            <Input
              type="date"
              className="mt-1.5"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
            />
          </label>

          <div>
            <p className="text-sm font-medium">Phương thức</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={method === "transfer" ? "default" : "outline"}
                onClick={() => setMethod("transfer")}
              >
                Chuyển khoản
              </Button>
              <Button
                type="button"
                variant={method === "cash" ? "default" : "outline"}
                onClick={() => setMethod("cash")}
              >
                Tiền mặt
              </Button>
            </div>

            {allowLegacy && (
              <Button
                type="button"
                className="mt-2 w-full"
                variant={method === "legacy_import" ? "default" : "outline"}
                onClick={() => setMethod("legacy_import")}
              >
                Nhập dữ liệu cũ
              </Button>
            )}
          </div>

          <label className="block text-sm font-medium">
            Ghi chú
            <Input
              className="mt-1.5"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Không bắt buộc"
            />
          </label>

          {editing && allowLegacy && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Đây là giao dịch dữ liệu cũ. Bạn có thể sửa số tiền, ngày và đổi sang Chuyển khoản/Tiền mặt sau khi đối chiếu sổ. Nếu thực tế chưa thanh toán, hãy dùng nút Hủy ở lịch sử giao dịch.
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t p-4 sm:p-5">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={working}
          >
            Hủy
          </Button>
          <Button
            className="flex-1"
            disabled={
              working ||
              !transactionDate ||
              (showAmount && (!amount || amount <= 0)) ||
              (!editing && method === "legacy_import")
            }
            onClick={() => {
              if (editing) {
                if (!amount || amount <= 0) return
                onEdit(state.receipt, state.payment, {
                  amount,
                  transactionDate,
                  method,
                  note,
                })
                return
              }

              onCreate({
                receipts: state.receipts,
                transactionDate,
                method: method === "cash" ? "cash" : "transfer",
                note,
                amount,
              })
            }}
          >
            {working && <LoaderCircle className="size-4 animate-spin" />}
            {actionText}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReceiptPreview({
  receipt,
  settings,
  working,
  onBack,
  onFull,
  onPartial,
  onEdit,
  onCancel,
  onEditPayment,
  onCancelPayment,
}: {
  receipt: Receipt
  settings: SettingsRow
  working: boolean
  onBack: () => void
  onFull: () => void
  onPartial: () => void
  onEdit: () => void
  onCancel: () => void
  onEditPayment: (payment: PaymentRow) => void
  onCancelPayment: (payment: PaymentRow) => void
}) {
  const [exporting, setExporting] = useState(false)
  const date = receipt.receiptDate
  const qrUrl = vietQrUrl(settings, receipt, date)

  const cancelled = receipt.status === "cancelled"
  const finished = !cancelled && receipt.remainingAmount <= 0

  const actionLabel = cancelled
    ? "Phiếu đã hủy"
    : finished
      ? "Đã thanh toán đủ"
      : receipt.direction === "collect"
        ? "Cần thu"
        : receipt.direction === "pay"
          ? "Cần chi"
          : "Đã cân bằng"

  const actionDescription =
    receipt.direction === "collect"
      ? "Hụi viên đóng cho chủ hụi"
      : receipt.direction === "pay"
        ? "Chủ hụi giao cho hụi viên"
        : ""

  const actionAmount = cancelled
    ? "—"
    : receipt.direction === "collect" && receipt.remainingAmount > 0
      ? `+${formatVND(receipt.remainingAmount)}`
      : receipt.direction === "pay" && receipt.remainingAmount > 0
        ? `−${formatVND(receipt.remainingAmount)}`
        : formatVND(receipt.remainingAmount)

  const isCollect =
    !cancelled && !finished && receipt.direction === "collect"
  const isPay = !cancelled && !finished && receipt.direction === "pay"

  const actionColor = isCollect
    ? "text-emerald-700"
    : isPay
      ? "text-red-600"
      : "text-slate-600"

  const actionBoxClass = isCollect
    ? "border-emerald-200 bg-emerald-50/70"
    : isPay
      ? "border-red-200 bg-red-50/70"
      : "border-slate-200 bg-slate-50"

  async function handleDownloadJpg() {
    if (exporting) return
    setExporting(true)

    try {
      const file = await createReceiptJpeg(receipt, date, settings)
      downloadFile(file)
    } catch (caught) {
      console.error(caught)
      window.alert("Không thể xuất ảnh JPG. Vui lòng thử lại.")
    } finally {
      setExporting(false)
    }
  }

  async function handleShareZalo() {
    if (exporting) return
    setExporting(true)

    try {
      await shareReceiptJpg(receipt, settings)
    } catch (caught) {
      console.error(caught)
      window.alert(
        "Không thể tạo ảnh phiếu để gửi Zalo. Vui lòng thử lại.",
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Phiếu hụi</h1>
          <p className="text-sm text-muted-foreground">
            {receiptStatusLabel(receipt.status)}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="p-5 text-center sm:p-6">
          <p className="text-xl font-extrabold tracking-tight text-[#0f2a56] sm:text-2xl">
            PHIẾU HỤI
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#0f2a56] sm:text-2xl">
            {receipt.member.full_name}
          </h2>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            {formatDate(date)}
          </p>

          <div
            className={`mt-5 flex items-center gap-4 rounded-xl border px-4 py-4 text-left sm:px-5 ${actionBoxClass}`}
          >
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                isCollect
                  ? "bg-emerald-100 text-emerald-700"
                  : isPay
                    ? "bg-red-100 text-red-600"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              <WalletCards className="size-6" />
            </div>

            <div className="min-w-0 flex-1 text-center">
              <p
                className={`text-sm font-bold uppercase tracking-wide ${actionColor}`}
              >
                {actionLabel}
              </p>
              <p
                className={`mt-1 break-words text-2xl font-black tabular-nums sm:text-3xl ${actionColor}`}
              >
                {actionAmount}
              </p>
              {actionDescription && !finished && !cancelled && (
                <p className="mt-1 text-sm text-slate-500">
                  {actionDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="space-y-0">
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[#0f2a56]">
                  <UserRound className="size-4" />
                </div>
                <span className="text-sm sm:text-base">Chủ hụi</span>
              </div>
              <span className="text-right text-sm font-bold text-[#0f2a56] sm:text-base">
                {settings.owner_name || "Chưa khai báo"}
              </span>
            </div>

            <div className="border-t border-slate-100" />

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[#0f2a56]">
                  <Phone className="size-4" />
                </div>
                <span className="text-sm sm:text-base">SĐT</span>
              </div>
              <span className="text-right text-sm font-bold text-[#0f2a56] sm:text-base">
                {settings.owner_phone || "Chưa khai báo"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-[#0f2a56]">
            <CircleDollarSign className="size-5" />
            <h3 className="text-lg font-bold">Chi tiết hụi</h3>
          </div>

          <div className="space-y-4">
            {receipt.lines.map((line) => {
              const lineNet = line.receiveAmount - line.payAmount

              return (
                <div
                  key={line.periodId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-bold text-[#0f2a56]">
                        {line.groupCode
                          ? `${line.groupCode} · ${line.groupName}`
                          : line.groupName}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-[#0f2a56]">
                        Kỳ {line.periodNumber}/{line.totalPeriods}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                      Giá thăm {formatVND(line.bidAmount)}
                    </p>
                  </div>

                  <div className="grid gap-4 p-4 sm:grid-cols-[190px_minmax(0,1fr)]">
                    <div className="grid grid-cols-2 gap-2">
                      <MiniShareBadge
                        label="Chân sống"
                        value={line.liveShares}
                        tone="live"
                      />
                      <MiniShareBadge
                        label="Chân chết"
                        value={line.deadShares}
                        tone="dead"
                      />
                    </div>

                    <div className="space-y-2 text-sm sm:text-base">
                      {line.payAmount > 0 && (
                        <ReceiptMoneyRow
                          label="Tiền phải đóng"
                          value={formatVND(line.payAmount)}
                        />
                      )}

                      {line.huiAmount > 0 && (
                        <ReceiptMoneyRow
                          label="Tiền hốt"
                          value={formatVND(line.huiAmount)}
                        />
                      )}

                      {line.feeAmount > 0 && (
                        <ReceiptMoneyRow
                          label="Trừ tiền thảo"
                          value={`−${formatVND(line.feeAmount)}`}
                          negative
                        />
                      )}

                      <div className="border-t border-slate-200 pt-2">
                        <ReceiptMoneyRow
                          label="Kết quả dây này"
                          value={`${lineNet >= 0 ? "+" : "−"}${formatVND(
                            Math.abs(lineNet),
                          )}`}
                          strong
                          positive={lineNet > 0}
                          negative={lineNet < 0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/60 p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-[#0f2a56]">
            Tổng kết
          </h3>

          <div className="space-y-2 text-sm sm:text-base">
            {receipt.totalPay > 0 && (
              <ReceiptMoneyRow
                label="Tổng phải đóng"
                value={formatVND(receipt.totalPay)}
              />
            )}

            {receipt.totalReceive > 0 && (
              <ReceiptMoneyRow
                label="Tổng được nhận"
                value={formatVND(receipt.totalReceive)}
              />
            )}

            {receipt.settlementAmount !== 0 && (
              <ReceiptMoneyRow
                label="Tất toán / điều chỉnh"
                value={`${
                  receipt.settlementAmount > 0 ? "+" : "−"
                }${formatVND(Math.abs(receipt.settlementAmount))}`}
              />
            )}

            {receipt.paidAmount > 0 && (
              <ReceiptMoneyRow
                label="Đã thu / chi"
                value={formatVND(receipt.paidAmount)}
              />
            )}

            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-100/80 p-3">
              <ReceiptMoneyRow
                label={
                  receipt.direction === "collect"
                    ? "CẦN THU"
                    : receipt.direction === "pay"
                      ? "CHỦ HỤI GIAO"
                      : "ĐÃ CÂN BẰNG"
                }
                value={formatVND(Math.abs(receipt.remainingAmount))}
                strong
                positive={receipt.direction === "collect"}
                negative={receipt.direction === "pay"}
              />
            </div>
          </div>
        </div>

        {qrUrl && receipt.status !== "cancelled" && (
          <div className="border-t border-slate-200 p-5 text-center sm:p-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
              <p className="font-bold text-[#0f2a56]">
                Quét QR để đóng đúng số tiền
              </p>
              <img
                src={qrUrl}
                alt={`QR đóng hụi ${receipt.member.full_name}`}
                className="mx-auto mt-4 h-auto w-full max-w-[300px]"
              />
              <p className="mt-3 text-sm text-slate-500">
                Nội dung:{" "}
                <span className="font-semibold text-[#0f2a56]">
                  {transferText(receipt, date)}
                </span>
              </p>
            </div>
          </div>
        )}
      </Card>

      {receipt.status !== "cancelled" && (
        <Card className="space-y-4 border-slate-200 p-4 shadow-sm">
          {receipt.direction !== "balanced" &&
            receipt.remainingAmount > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Xác nhận tiền
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-11"
                    onClick={onFull}
                    disabled={working || exporting}
                  >
                    <CheckCheck className="size-4" />
                    {receipt.direction === "collect"
                      ? "Đã thu đủ"
                      : "Đã chi đủ"}
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={onPartial}
                    disabled={working || exporting}
                  >
                    <CircleDollarSign className="size-4" />
                    {receipt.direction === "collect"
                      ? "Thu một phần"
                      : "Chi một phần"}
                  </Button>
                </div>
              </div>
            )}

          <div
            className={
              receipt.direction !== "balanced" &&
              receipt.remainingAmount > 0
                ? "border-t border-slate-200 pt-4"
                : ""
            }
          >
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Chia sẻ phiếu
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => void handleDownloadJpg()}
                disabled={working || exporting}
              >
                {exporting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Xuất JPG
              </Button>

              <Button
                variant="outline"
                onClick={() => void handleShareZalo()}
                disabled={working || exporting}
              >
                {exporting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Share2 className="size-4" />
                )}
                Gửi Zalo
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Gửi Zalo sẽ tạo ảnh JPG rồi mở bảng chia sẻ của điện thoại.
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Điều chỉnh
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={onEdit}
                disabled={working || exporting}
              >
                <Pencil className="size-4" />
                Sửa / điều chỉnh
              </Button>

              <Button
                variant="outline"
                className="text-destructive"
                onClick={onCancel}
                disabled={working || exporting}
              >
                <Ban className="size-4" />
                Hủy phiếu
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-[#0f2a56]">
          <History className="size-4" />
          <h3 className="font-semibold">Lịch sử thu / chi</h3>
        </div>

        {receipt.payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Chưa có giao dịch nào.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {receipt.payments.map((payment) => (
              <div
                key={payment.id}
                className={`rounded-md border border-slate-200 p-3 text-sm ${
                  payment.status === "cancelled" ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {payment.direction === "collect" ? "Thu" : "Chi"}{" "}
                        {formatVND(Number(payment.amount))}
                      </p>
                      {(payment.method === "legacy_import" || payment.method === "other") && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Dữ liệu cũ
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {paymentMethodLabel(payment.method)} · Ngày thanh toán {formatDate(payment.transaction_date)}
                    </p>

                    {payment.note && (
                      <p className="mt-1 text-xs">{payment.note}</p>
                    )}

                    {payment.status === "cancelled" && (
                      <p className="mt-1 text-xs text-destructive">
                        Đã hủy: {payment.cancel_reason || "Không ghi lý do"}
                      </p>
                    )}
                  </div>

                  {payment.status === "active" && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditPayment(payment)}
                        disabled={working || exporting}
                      >
                        <Pencil className="size-4" />
                        Sửa
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onCancelPayment(payment)}
                        disabled={working || exporting}
                      >
                        <Undo2 className="size-4" />
                        Hủy
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function MiniShareBadge({
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

function ReceiptMoneyRow({
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
