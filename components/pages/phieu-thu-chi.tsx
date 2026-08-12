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
  CheckCheck,
  ChevronRight,
  CircleDollarSign,
  Download,
  History,
  LoaderCircle,
  Pencil,
  Phone,
  RefreshCw,
  Share2,
  Undo2,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

type PaymentRow = {
  id: string
  receipt_id: string
  direction: "collect" | "pay"
  amount: number
  method: "cash" | "transfer" | "other"
  note: string | null
  status: "active" | "cancelled"
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
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

function paymentMethodLabel(method: PaymentRow["method"]) {
  if (method === "cash") return "Tiền mặt"
  if (method === "transfer") return "Chuyển khoản"
  return "Khác"
}

function parseAmount(value: string) {
  const clean = value
    .replace(/\./g, "")
    .replace(/,/g, "")
    .trim()

  const n = Number(clean)
  return Number.isFinite(n) ? n : 0
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

/*
 * Nội dung chuyển khoản:
 *
 * Nguyen Van A ck ngay 110826
 *
 * Không dấu tiếng Việt.
 * Bỏ Anh/Chị/Cô/Dì/Chú/Bác...
 * Không có dấu / trong ngày.
 */
function transferText(receipt: Receipt, date: string) {
  const cleanName = cleanMemberName(
    receipt.member.full_name,
  ).slice(0, 24)

  const [year, month, day] = date.slice(0, 10).split("-")

  const ddmmyy = `${day}${month}${year.slice(-2)}`

  return `${cleanName} ck ngay ${ddmmyy}`
    .trim()
    .slice(0, 50)
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

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
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
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  )
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

function drawLabelValue(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  ctx.fillStyle = "#6b7280"
  ctx.font = "26px Arial, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(label, x, y)

  ctx.fillStyle = "#111827"
  ctx.font = "600 26px Arial, sans-serif"
  ctx.textAlign = "right"
  ctx.fillText(value, x + width, y)
}

function drawSummaryBox(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#f3f4f6"

  roundedRect(ctx, x, y, width, height, 14)
  ctx.fill()

  ctx.fillStyle = "#6b7280"
  ctx.font = "22px Arial, sans-serif"
  ctx.textAlign = "left"
  ctx.fillText(label, x + 18, y + 34)

  ctx.fillStyle = "#111827"
  ctx.font = "700 27px Arial, sans-serif"
  ctx.fillText(value, x + 18, y + 72)
}

async function createReceiptJpeg(
  receipt: Receipt,
  date: string,
  settings: SettingsRow,
) {
  const width = 1080
  const margin = 54
  const contentWidth = width - margin * 2

  /*
   * Visual được đối chiếu theo prototype Lovable:
   * - Be Vietnam Pro
   * - nền xanh-xám rất nhẹ
   * - foreground navy/xám đậm
   * - border mỏng
   * - màu trạng thái tiết chế
   */
  const COLORS = {
    background: "#fbfcfe",
    white: "#ffffff",

    foreground: "#273247",
    strong: "#111c30",
    navy: "#253553",
    muted: "#738096",

    border: "#dce3ed",
    borderStrong: "#cfd8e5",

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

  /*
   * Chờ font trên trang load xong.
   *
   * Nếu sau này app chính đổi sang Be Vietnam Pro,
   * JPG sẽ dùng ngay font đó.
   *
   * Hiện tại repo thật đang dùng Inter nên fallback Inter.
   */
  await document.fonts.ready

  const bodyFont =
    getComputedStyle(document.body).fontFamily

  const fontFamily =
    `'Be Vietnam Pro', ${bodyFont || "'Inter', system-ui, sans-serif"}`

  function font(
    weight: number,
    size: number,
  ) {
    return `${weight} ${size}px ${fontFamily}`
  }

  const qrUrl = vietQrUrl(
    settings,
    receipt,
    date,
  )

  /*
   * Load QR trước để lấy đúng tỷ lệ ảnh VietQR.
   */
  let qrImage: HTMLImageElement | null = null

  if (
    qrUrl &&
    receipt.status !== "cancelled"
  ) {
    try {
      qrImage = await loadImage(qrUrl)
    } catch (error) {
      console.error(error)
    }
  }

  /*
   * Tính chiều cao từng dây dựa trên số dòng thật.
   * Không còn hard-code chiều cao khiến phiếu chi bị vỡ.
   */
  const detailLayouts =
    receipt.lines.map((line) => {
      let moneyRows = 1 // Giá thăm

      if (line.payAmount > 0) {
        moneyRows += 1
      }

      if (line.huiAmount > 0) {
        moneyRows += 1 // Hốt hụi

        if (line.feeAmount > 0) {
          moneyRows += 1
        }

        moneyRows += 1 // Thực nhận
      }

      const moneyHeight =
        moneyRows * 55 +
        (line.huiAmount > 0 ? 30 : 0)

      const statsHeight = 150

      return {
        height:
          112 +
          Math.max(
            statsHeight,
            moneyHeight,
          ) +
          32,
      }
    })

  const detailsHeight =
    detailLayouts.reduce(
      (sum, item) =>
        sum + item.height + 20,
      0,
    )

  const summaryRows = [
    receipt.totalPay > 0,
    receipt.totalHuiAmount > 0,
    receipt.totalFee > 0,
    receipt.settlementAmount !== 0,
    receipt.paidAmount > 0,
  ].filter(Boolean).length

  const summaryHighlight =
    receipt.totalReceive > 0

  const summaryHeight =
    60 +
    summaryRows * 56 +
    (summaryHighlight ? 92 : 16)

  const qrWidth = 400

  const qrHeight = qrImage
    ? qrWidth *
      (qrImage.naturalHeight /
        qrImage.naturalWidth)
    : 0

  const qrSectionHeight = qrImage
    ? 110 + qrHeight + 82
    : 0

  /*
   * Header được tăng khoảng thở phía trên.
   */
  const canvasHeight =
    205 + // title
    175 + // amount
    154 + // owner
    74 + // Chi tiết hụi
    detailsHeight +
    76 + // Tổng kết title
    summaryHeight +
    (qrImage
      ? 38 + qrSectionHeight
      : 0) +
    78

  const canvas =
    document.createElement("canvas")

  canvas.width = width
  canvas.height = Math.ceil(
    canvasHeight,
  )

  const ctx =
    canvas.getContext("2d")

  if (!ctx) {
    throw new Error(
      "Trình duyệt không hỗ trợ Canvas",
    )
  }

  ctx.fillStyle =
    COLORS.background

  ctx.fillRect(
    0,
    0,
    width,
    canvas.height,
  )

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

    roundedRect(
      ctx,
      x,
      y,
      w,
      h,
      radius,
    )

    ctx.fill()
    ctx.stroke()
  }

  function drawDivider(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    ctx.strokeStyle =
      COLORS.border

    ctx.lineWidth = 2

    drawLine(
      ctx,
      x1,
      y1,
      x2,
      y2,
    )
  }

  function drawPersonIcon(
    cx: number,
    cy: number,
    color: string,
  ) {
    ctx.fillStyle = color

    ctx.beginPath()
    ctx.arc(
      cx,
      cy - 8,
      9,
      0,
      Math.PI * 2,
    )
    ctx.fill()

    ctx.beginPath()
    ctx.arc(
      cx,
      cy + 15,
      17,
      Math.PI,
      Math.PI * 2,
    )
    ctx.lineTo(
      cx + 17,
      cy + 21,
    )
    ctx.lineTo(
      cx - 17,
      cy + 21,
    )
    ctx.closePath()
    ctx.fill()
  }

  function drawWalletIcon(
    cx: number,
    cy: number,
    color: string,
  ) {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 5

    roundedRect(
      ctx,
      cx - 24,
      cy - 18,
      48,
      38,
      8,
    )

    ctx.stroke()

    roundedRect(
      ctx,
      cx + 5,
      cy - 7,
      25,
      17,
      5,
    )

    ctx.stroke()

    ctx.beginPath()
    ctx.arc(
      cx + 15,
      cy + 1,
      3,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  function drawPhoneIcon(
    cx: number,
    cy: number,
  ) {
    ctx.fillStyle =
      COLORS.navy

    ctx.textAlign = "center"
    ctx.font = font(700, 29)

    ctx.fillText(
      "☎",
      cx,
      cy + 10,
    )
  }

  function drawOwnerRow(
    label: string,
    value: string,
    rowY: number,
    type: "person" | "phone",
  ) {
    const cx = margin + 35
    const cy = rowY - 9

    ctx.fillStyle =
      COLORS.secondary

    ctx.beginPath()
    ctx.arc(
      cx,
      cy,
      25,
      0,
      Math.PI * 2,
    )

    ctx.fill()

    if (type === "person") {
      drawPersonIcon(
        cx,
        cy,
        COLORS.navy,
      )
    } else {
      drawPhoneIcon(
        cx,
        cy,
      )
    }

    ctx.textAlign = "left"
    ctx.fillStyle =
      COLORS.muted

    ctx.font = font(400, 29)

    ctx.fillText(
      label,
      margin + 76,
      rowY,
    )

    ctx.textAlign = "right"
    ctx.fillStyle =
      COLORS.strong

    ctx.font = font(700, 29)

    ctx.fillText(
      value,
      width - margin - 20,
      rowY,
    )
  }

  function drawStatTile(
    label: string,
    value: number,
    x: number,
    y: number,
    w: number,
    kind: "live" | "dead",
  ) {
    const live =
      kind === "live"

    const color = live
      ? COLORS.live
      : COLORS.dead

    drawCard(
      x,
      y,
      w,
      138,
      live
        ? COLORS.liveSoft
        : COLORS.deadSoft,
      live
        ? COLORS.collectBorder
        : COLORS.payBorder,
      13,
    )

    drawPersonIcon(
      x + 34,
      y + 43,
      color,
    )

    ctx.textAlign = "left"
    ctx.fillStyle = color

    ctx.font = font(600, 24)

    ctx.fillText(
      label,
      x + 65,
      y + 49,
    )

    ctx.font = font(800, 44)

    ctx.fillText(
      String(value),
      x + 65,
      y + 104,
    )
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
    },
  ) {
    ctx.textAlign = "left"

    ctx.fillStyle =
      options?.strong
        ? COLORS.strong
        : COLORS.muted

    ctx.font =
      options?.strong
        ? font(700, 30)
        : font(400, 29)

    ctx.fillText(
      label,
      x,
      y,
    )

    ctx.textAlign = "right"

    ctx.fillStyle =
      options?.negative
        ? COLORS.pay
        : COLORS.strong

    ctx.font =
      options?.strong
        ? font(800, 31)
        : font(700, 29)

    ctx.fillText(
      value,
      x + w,
      y,
    )
  }

  /*
   * ---------------------------------------------------------
   * HEADER
   * ---------------------------------------------------------
   */
  let y = 92

  ctx.textAlign = "center"

  ctx.fillStyle =
    COLORS.navy

  /*
   * Lovable dùng heading uppercase,
   * tracking rộng và không quá lớn.
   */
  ctx.font = font(800, 47)

  ctx.fillText(
    "PHIẾU HỤI",
    width / 2,
    y,
  )

  y += 57

  ctx.fillStyle =
    COLORS.strong

  ctx.font = font(700, 38)

  ctx.fillText(
    receipt.member.full_name,
    width / 2,
    y,
  )

  y += 43

  ctx.fillStyle =
    COLORS.muted

  ctx.font = font(400, 27)

  ctx.fillText(
    formatDate(date),
    width / 2,
    y,
  )

  /*
   * ---------------------------------------------------------
   * CẦN THU / CẦN CHI
   * ---------------------------------------------------------
   */
  y += 38

  const cancelled =
    receipt.status ===
    "cancelled"

  const finished =
    !cancelled &&
    receipt.remainingAmount <= 0

  const collect =
    !cancelled &&
    !finished &&
    receipt.direction ===
      "collect"

  const pay =
    !cancelled &&
    !finished &&
    receipt.direction === "pay"

  let headline =
    "ĐÃ CÂN BẰNG"

  let amountText =
    formatVND(
      receipt.remainingAmount,
    )

  let description = ""

  let actionColor =
    COLORS.navy

  let actionBg =
    COLORS.secondary

  let actionBorder =
    COLORS.border

  if (cancelled) {
    headline =
      "PHIẾU ĐÃ HỦY"

    amountText = "—"
  } else if (finished) {
    headline =
      "ĐÃ THANH TOÁN ĐỦ"

    amountText =
      formatVND(0)
  } else if (collect) {
    headline = "CẦN THU"

    amountText =
      `+${formatVND(
        receipt.remainingAmount,
      )}`

    description =
      "Hụi viên đóng cho chủ hụi"

    actionColor =
      COLORS.collect

    actionBg =
      COLORS.collectSoft

    actionBorder =
      COLORS.collectBorder
  } else if (pay) {
    headline = "CẦN CHI"

    amountText =
      `−${formatVND(
        receipt.remainingAmount,
      )}`

    description =
      "Chủ hụi giao cho hụi viên"

    actionColor =
      COLORS.pay

    actionBg =
      COLORS.paySoft

    actionBorder =
      COLORS.payBorder
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
  const iconY =
    actionY + 74

  ctx.fillStyle = collect
    ? "#e2f1e7"
    : pay
      ? "#f5dddd"
      : COLORS.mutedBg

  ctx.beginPath()

  ctx.arc(
    iconX,
    iconY,
    48,
    0,
    Math.PI * 2,
  )

  ctx.fill()

  drawWalletIcon(
    iconX,
    iconY,
    actionColor,
  )

  ctx.strokeStyle =
    actionBorder

  drawLine(
    ctx,
    margin + 180,
    actionY + 24,
    margin + 180,
    actionY + 124,
  )

  const actionCenter =
    margin +
    180 +
    (contentWidth - 180) /
      2

  ctx.textAlign = "center"

  ctx.fillStyle =
    actionColor

  ctx.font = font(700, 28)

  ctx.fillText(
    headline,
    actionCenter,
    actionY + 42,
  )

  ctx.font = font(800, 50)

  ctx.fillText(
    amountText,
    actionCenter,
    actionY + 96,
  )

  if (description) {
    ctx.fillStyle =
      COLORS.muted

    ctx.font = font(400, 25)

    ctx.fillText(
      description,
      actionCenter,
      actionY + 126,
    )
  }

  /*
   * ---------------------------------------------------------
   * CHỦ HỤI
   * ---------------------------------------------------------
   */
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
    settings.owner_name ||
      "Chưa khai báo",
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
    settings.owner_phone ||
      "Chưa khai báo",
    y + 108,
    "phone",
  )

  /*
   * ---------------------------------------------------------
   * CHI TIẾT HỤI
   * ---------------------------------------------------------
   */
  y += 178

  ctx.textAlign = "left"

  ctx.fillStyle =
    COLORS.strong

  ctx.font = font(800, 35)

  ctx.fillText(
    "Chi tiết hụi",
    margin,
    y,
  )

  y += 27

  for (
    let index = 0;
    index < receipt.lines.length;
    index++
  ) {
    const line =
      receipt.lines[index]

    const layout =
      detailLayouts[index]

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

    /*
     * Header dây kiểu Lovable:
     * nền muted thay vì đường navy dày.
     */
    ctx.fillStyle =
      COLORS.secondary

    roundedRect(
      ctx,
      margin + 2,
      cardY + 2,
      contentWidth - 4,
      88,
      13,
    )

    ctx.fill()

    /*
     * Che phần bo dưới để header
     * trông giống một band phẳng.
     */
    ctx.fillRect(
      margin + 2,
      cardY + 54,
      contentWidth - 4,
      36,
    )

    ctx.textAlign = "left"

    ctx.fillStyle =
      COLORS.strong

    ctx.font = font(800, 29)

    const groupTitle =
      line.groupCode
        ? `${line.groupCode} · ${line.groupName}`
        : line.groupName

    ctx.fillText(
      groupTitle,
      margin + 24,
      cardY + 40,
    )

    ctx.textAlign = "right"

    ctx.font = font(700, 27)

    ctx.fillText(
      `Kỳ ${line.periodNumber}/${line.totalPeriods}`,
      width - margin - 24,
      cardY + 40,
    )

    ctx.textAlign = "left"

    ctx.fillStyle =
      COLORS.muted

    ctx.font = font(400, 23)

    ctx.fillText(
      `Giá thăm ${formatVND(
        line.bidAmount,
      )}`,
      margin + 24,
      cardY + 72,
    )

    const bodyY =
      cardY + 113

    /*
     * Hai ô Chân sống / Chân chết.
     */
    const statsWidth = 394

    const gap = 14

    const statWidth =
      (statsWidth - gap) / 2

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
      margin +
        24 +
        statWidth +
        gap,
      bodyY,
      statWidth,
      "dead",
    )

    const dividerX =
      margin +
      24 +
      statsWidth +
      24

    drawDivider(
      dividerX,
      bodyY,
      dividerX,
      cardY +
        layout.height -
        25,
    )

    /*
     * Cột tiền.
     *
     * Giá thăm đã nằm ở header dây,
     * nên không lặp lại ở cột này.
     */
    const moneyX =
      dividerX + 29

    const moneyWidth =
      width -
      margin -
      24 -
      moneyX

    let moneyY =
      bodyY + 35

    if (line.payAmount > 0) {
      drawMoneyRow(
        "Tiền đóng",
        formatVND(
          line.payAmount,
        ),
        moneyX,
        moneyY,
        moneyWidth,
      )

      moneyY += 55
    }

    if (line.huiAmount > 0) {
      drawMoneyRow(
        "Hốt hụi",
        formatVND(
          line.huiAmount,
        ),
        moneyX,
        moneyY,
        moneyWidth,
      )

      moneyY += 55

      if (
        line.feeAmount > 0
      ) {
        drawMoneyRow(
          "Tiền thảo",
          `−${formatVND(
            line.feeAmount,
          )}`,
          moneyX,
          moneyY,
          moneyWidth,
          {
            negative: true,
          },
        )

        moneyY += 24
      }

      drawDivider(
        moneyX,
        moneyY,
        moneyX +
          moneyWidth,
        moneyY,
      )

      moneyY += 43

      drawMoneyRow(
        "Thực nhận",
        formatVND(
          line.receiveAmount,
        ),
        moneyX,
        moneyY,
        moneyWidth,
        {
          strong: true,
        },
      )
    }

    y =
      cardY +
      layout.height +
      3
  }

  /*
   * ---------------------------------------------------------
   * TỔNG KẾT
   * ---------------------------------------------------------
   */
  y += 42

  ctx.textAlign = "left"

  ctx.fillStyle =
    COLORS.strong

  ctx.font = font(800, 35)

  ctx.fillText(
    "Tổng kết",
    margin,
    y,
  )

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

  let rowY =
    summaryY + 48

  if (receipt.totalPay > 0) {
    drawMoneyRow(
      "Tổng tiền đóng hụi",
      formatVND(
        receipt.totalPay,
      ),
      margin + 24,
      rowY,
      contentWidth - 48,
    )

    rowY += 56
  }

  if (
    receipt.totalHuiAmount >
    0
  ) {
    drawMoneyRow(
      "Tổng hốt hụi",
      formatVND(
        receipt.totalHuiAmount,
      ),
      margin + 24,
      rowY,
      contentWidth - 48,
    )

    rowY += 56
  }

  if (receipt.totalFee > 0) {
    drawMoneyRow(
      "Trừ tiền thảo",
      `−${formatVND(
        receipt.totalFee,
      )}`,
      margin + 24,
      rowY,
      contentWidth - 48,
      {
        negative: true,
      },
    )

    rowY += 56
  }

  if (
    receipt.settlementAmount !==
    0
  ) {
    const sign =
      receipt.settlementAmount >
      0
        ? "+"
        : "−"

    drawMoneyRow(
      "Tất toán / điều chỉnh",
      `${sign}${formatVND(
        Math.abs(
          receipt.settlementAmount,
        ),
      )}`,
      margin + 24,
      rowY,
      contentWidth - 48,
    )

    rowY += 56
  }

  if (receipt.paidAmount > 0) {
    drawMoneyRow(
      "Đã thu / chi",
      formatVND(
        receipt.paidAmount,
      ),
      margin + 24,
      rowY,
      contentWidth - 48,
    )

    rowY += 56
  }

  if (receipt.totalReceive > 0) {
    const highlightY =
      summaryY +
      summaryHeight -
      78

    drawCard(
      margin + 18,
      highlightY,
      contentWidth - 36,
      62,
      COLORS.secondary,
      COLORS.border,
      10,
    )

    drawMoneyRow(
      "Thực nhận sau tiền thảo",
      formatVND(
        receipt.totalReceive,
      ),
      margin + 36,
      highlightY + 41,
      contentWidth - 72,
      {
        strong: true,
      },
    )
  }

  y =
    summaryY +
    summaryHeight

  /*
   * ---------------------------------------------------------
   * QR — chỉ phiếu thu
   * ---------------------------------------------------------
   */
  if (qrImage) {
    y += 38

    const qrCardHeight =
      qrSectionHeight

    drawCard(
      margin,
      y,
      contentWidth,
      qrCardHeight,
      COLORS.secondary,
      COLORS.border,
      15,
    )

    ctx.fillStyle =
      COLORS.strong

    ctx.textAlign = "center"

    ctx.font = font(700, 30)

    ctx.fillText(
      "Quét QR để đóng đúng số tiền",
      width / 2,
      y + 49,
    )

    const qrX =
      (width - qrWidth) / 2

    const qrY = y + 76

    /*
     * QR giữ đúng tỷ lệ naturalWidth/naturalHeight.
     */
    ctx.drawImage(
      qrImage,
      qrX,
      qrY,
      qrWidth,
      qrHeight,
    )

    ctx.fillStyle =
      COLORS.muted

    ctx.font = font(400, 27)

    const prefix =
      "Nội dung: "

    const content =
      transferText(
        receipt,
        date,
      )

    const fullText =
      `${prefix}${content}`

    ctx.fillText(
      fullText,
      width / 2,
      qrY +
        qrHeight +
        42,
    )

    y += qrCardHeight
  }

  /*
   * Chừa khoảng trắng cuối ảnh.
   */
  y += 55

  return canvasToJpegFile(
    canvas,
    receiptFileName(
      receipt,
      date,
    ),
  )
}

export function PhieuThuChiPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [settings, setSettings] =
    useState<SettingsRow>(EMPTY_SETTINGS)
  const [receiptRows, setReceiptRows] =
    useState<ReceiptDbRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [selectedDate, setSelectedDate] =
    useState(todayInVietnam())

  const [previewMemberId, setPreviewMemberId] =
    useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

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
        .select(
          "id, group_id, member_id, share_number, status",
        )
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
          "id, receipt_id, direction, amount, method, note, status, cancelled_at, cancel_reason, created_at",
        )
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
        "Không thể tải dữ liệu phiếu. Nếu vừa cập nhật, hãy chạy file SQL trước.",
      )

      setLoading(false)
      return
    }

    setGroups((g.data ?? []) as GroupRow[])
    setShares((s.data ?? []) as ShareRow[])
    setPeriods((p.data ?? []) as PeriodRow[])
    setMembers((m.data ?? []) as MemberRow[])

    setSettings(
      (cfg.data as SettingsRow | null) ??
        EMPTY_SETTINGS,
    )

    setReceiptRows((r.data ?? []) as ReceiptDbRow[])
    setPayments((pay.data ?? []) as PaymentRow[])

    setLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const receipts = useMemo(() => {
    const groupsById = new Map(
      groups.map((x) => [x.id, x]),
    )

    const membersById = new Map(
      members.map((x) => [x.id, x]),
    )

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

    const linesByMember =
      new Map<string, ReceiptLine[]>()

    for (
      const period of periods.filter(
        (x) =>
          isCompleted(x.status) &&
          x.scheduled_date === selectedDate,
      )
    ) {
      const group = groupsById.get(period.group_id)

      if (!group || !period.winner_share_id) {
        continue
      }

      const groupShares = (
        sharesByGroup.get(group.id) ?? []
      ).filter(
        (x) =>
          x.status === "active" ||
          x.id === period.winner_share_id,
      )

      const groupPeriods =
        periodsByGroup.get(group.id) ?? []

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

      const contribution = Number(
        group.contribution_amount || 0,
      )

      const liveContribution = Math.max(
        0,
        contribution - bid,
      )

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

      const winnerMemberId =
        winner?.member_id ?? null

      const fee = Number(
        period.fee_amount ??
          group.fee_amount ??
          0,
      )

      /*
       * Tổng hốt hụi = tổng tiền đóng
       * của các chân còn lại.
       */
      const huiAmount = Math.max(0, pot)

      /*
       * Chủ hụi thực giao =
       * tổng hốt hụi - tiền thảo.
       */
      const winnerReceive = Math.max(
        0,
        huiAmount - fee,
      )

      const memberIds = new Set(
        groupShares.map((x) => x.member_id),
      )

      for (const memberId of memberIds) {
        if (!membersById.has(memberId)) {
          continue
        }

        let liveShares = 0
        let deadShares = 0
        let payAmount = 0

        const memberShares = groupShares.filter(
          (x) => x.member_id === memberId,
        )

        for (const share of memberShares) {
          if (
            share.id === period.winner_share_id
          ) {
            // Chân vừa hốt vẫn được tính là chân sống
            // trong chính kỳ hốt. Từ kỳ sau mới là chân chết.
            liveShares += 1
            continue
          }

          if (previousWinnerIds.has(share.id)) {
            deadShares += 1
          } else {
            liveShares += 1
          }

          payAmount +=
            amountByShare.get(share.id) ?? 0
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
            memberId === winnerMemberId
              ? huiAmount
              : 0,
          receiveAmount:
            memberId === winnerMemberId
              ? winnerReceive
              : 0,
          feeAmount:
            memberId === winnerMemberId
              ? fee
              : 0,
        }

        const arr =
          linesByMember.get(memberId) ?? []

        arr.push(line)
        linesByMember.set(memberId, arr)
      }
    }

    const result: Receipt[] = []

    for (const [memberId, lines] of linesByMember) {
      const member = membersById.get(memberId)

      if (!member) {
        continue
      }

      const totalPay = lines.reduce(
        (n, x) => n + x.payAmount,
        0,
      )

      const totalHuiAmount = lines.reduce(
        (n, x) => n + x.huiAmount,
        0,
      )

      const totalReceive = lines.reduce(
        (n, x) => n + x.receiveAmount,
        0,
      )

      const totalFee = lines.reduce(
        (n, x) => n + x.feeAmount,
        0,
      )

      const db =
        receiptRows.find(
          (x) =>
            x.member_id === memberId &&
            x.receipt_date === selectedDate,
        ) ?? null

      const settlementAmount = Number(
        db?.settlement_amount ?? 0,
      )

      const netAmount =
        totalPay -
        totalReceive +
        settlementAmount

      const direction: Receipt["direction"] =
        netAmount > 0
          ? "collect"
          : netAmount < 0
            ? "pay"
            : "balanced"

      const allReceiptPayments = db
        ? payments.filter(
            (x) => x.receipt_id === db.id,
          )
        : []

      const activePayments =
        allReceiptPayments.filter(
          (x) =>
            x.status === "active" &&
            x.direction === direction,
        )

      const paidAmount =
        activePayments.reduce(
          (n, x) => n + Number(x.amount),
          0,
        )

      const remainingAmount = Math.max(
        0,
        Math.abs(netAmount) - paidAmount,
      )

      let status: Receipt["status"] =
        db?.status ?? "open"

      if (status !== "cancelled") {
        if (
          remainingAmount <= 0 &&
          Math.abs(netAmount) > 0
        ) {
          status = "paid"
        } else if (paidAmount > 0) {
          status = "partial"
        } else {
          status = "open"
        }
      }

      result.push({
        member,
        lines,
        groupCount: new Set(
          lines.map((x) => x.groupId),
        ).size,
        totalShares: lines.reduce(
          (n, x) =>
            n +
            x.liveShares +
            x.deadShares,
          0,
        ),
        liveShares: lines.reduce(
          (n, x) => n + x.liveShares,
          0,
        ),
        deadShares: lines.reduce(
          (n, x) => n + x.deadShares,
          0,
        ),
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

    return result.sort((a, b) =>
      a.member.full_name.localeCompare(
        b.member.full_name,
        "vi",
      ),
    )
  }, [
    groups,
    members,
    payments,
    periods,
    receiptRows,
    selectedDate,
    shares,
  ])

  const preview = receipts.find(
    (x) => x.member.id === previewMemberId,
  )

  async function ensureReceipt(receipt: Receipt) {
    const payload = {
      member_id: receipt.member.id,
      receipt_date: selectedDate,
      source_total_pay: receipt.totalPay,
      source_total_receive: receipt.totalReceive,
      source_total_fee: receipt.totalFee,

      /*
       * Giữ field này để tương thích DB cũ,
       * nhưng không còn tính/hiển thị lợi hụi.
       */
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
            onConflict:
              "member_id,receipt_date",
          })

    const { data, error } = await q
      .select(
        "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
      )
      .single()

    if (error) {
      throw error
    }

    return data as ReceiptDbRow
  }

  async function addPayment(
    receipt: Receipt,
    amount: number,
  ) {
    if (
      receipt.direction === "balanced" ||
      amount <= 0 ||
      amount > receipt.remainingAmount
    ) {
      return
    }

    const methodAnswer = window.prompt(
      "Hình thức: 1 = Chuyển khoản, 2 = Tiền mặt, 3 = Khác",
      "1",
    )

    if (methodAnswer === null) {
      return
    }

    const method =
      methodAnswer === "2"
        ? "cash"
        : methodAnswer === "3"
          ? "other"
          : "transfer"

    const note =
      window.prompt(
        "Ghi chú giao dịch (có thể bỏ trống):",
        "",
      ) ?? ""

    setWorking(true)
    setError("")

    try {
      const db = await ensureReceipt(receipt)
      const supabase = createClient()

      const { error } = await supabase
        .from("receipt_payments")
        .insert({
          receipt_id: db.id,
          direction: receipt.direction,
          amount,
          method,
          note: note.trim() || null,
        })

      if (error) {
        throw error
      }

      const newStatus =
        receipt.paidAmount + amount >=
        Math.abs(receipt.netAmount)
          ? "paid"
          : "partial"

      await supabase
        .from("hui_receipts")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", db.id)

      await supabase
        .from("audit_logs")
        .insert({
          entity_type: "receipt",
          entity_id: db.id,
          action:
            receipt.direction === "collect"
              ? "collect_payment"
              : "pay_payment",
          after_data: {
            amount,
            method,
            note: note.trim() || null,
          },
        })

      await loadData()
    } catch (e) {
      console.error(e)

      setError(
        "Không thể ghi nhận giao dịch.",
      )
    } finally {
      setWorking(false)
    }
  }

  async function handlePartial(receipt: Receipt) {
    const answer = window.prompt(
      `${
        receipt.direction === "collect"
          ? "Số tiền vừa thu"
          : "Số tiền vừa chi"
      } (còn ${formatVND(
        receipt.remainingAmount,
      )}):`,
      String(receipt.remainingAmount),
    )

    if (answer === null) {
      return
    }

    const amount = parseAmount(answer)

    if (
      amount <= 0 ||
      amount > receipt.remainingAmount
    ) {
      window.alert(
        "Số tiền không hợp lệ hoặc lớn hơn số còn lại.",
      )
      return
    }

    await addPayment(receipt, amount)
  }

  async function editReceipt(receipt: Receipt) {
    const answer = window.prompt(
      "Điều chỉnh/tất toán thêm. Số dương = hụi viên đóng thêm; số âm = chủ hụi giao thêm.",
      String(receipt.settlementAmount),
    )

    if (answer === null) {
      return
    }

    const settlement = Number(
      answer
        .replace(/\./g, "")
        .replace(/,/g, ""),
    )

    if (!Number.isFinite(settlement)) {
      window.alert(
        "Số điều chỉnh không hợp lệ.",
      )
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

    if (!reason?.trim()) {
      return
    }

    setWorking(true)
    setError("")

    try {
      const db = await ensureReceipt(receipt)
      const supabase = createClient()

      const before = {
        settlement_amount:
          receipt.settlementAmount,
        note: receipt.db?.note ?? null,
      }

      const after = {
        settlement_amount: settlement,
        note: note.trim() || null,
      }

      const { error } = await supabase
        .from("hui_receipts")
        .update({
          ...after,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", db.id)

      if (error) {
        throw error
      }

      await supabase
        .from("audit_logs")
        .insert({
          entity_type: "receipt",
          entity_id: db.id,
          action: "edit",
          before_data: before,
          after_data: after,
          reason: reason.trim(),
        })

      await loadData()
    } catch (e) {
      console.error(e)
      setError("Không thể sửa phiếu.")
    } finally {
      setWorking(false)
    }
  }

  async function cancelReceipt(receipt: Receipt) {
    const reason = window.prompt(
      "Lý do hủy phiếu:",
    )

    if (!reason?.trim()) {
      return
    }

    if (
      receipt.payments.some(
        (x) => x.status === "active",
      ) &&
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

      const { error } = await supabase
        .from("hui_receipts")
        .update({
          status: "cancelled",
          cancelled_at:
            new Date().toISOString(),
          cancel_reason: reason.trim(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", db.id)

      if (error) {
        throw error
      }

      await supabase
        .from("audit_logs")
        .insert({
          entity_type: "receipt",
          entity_id: db.id,
          action: "cancel",
          before_data: {
            status: receipt.status,
          },
          after_data: {
            status: "cancelled",
          },
          reason: reason.trim(),
        })

      await loadData()
    } catch (e) {
      console.error(e)
      setError("Không thể hủy phiếu.")
    } finally {
      setWorking(false)
    }
  }

  async function cancelPayment(
    receipt: Receipt,
    payment: PaymentRow,
  ) {
    const reason = window.prompt(
      "Lý do hủy giao dịch này:",
    )

    if (!reason?.trim()) {
      return
    }

    setWorking(true)
    setError("")

    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("receipt_payments")
        .update({
          status: "cancelled",
          cancelled_at:
            new Date().toISOString(),
          cancel_reason: reason.trim(),
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id)

      if (error) {
        throw error
      }

      if (receipt.db) {
        await supabase
          .from("hui_receipts")
          .update({
            status: "open",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", receipt.db.id)
      }

      await supabase
        .from("audit_logs")
        .insert({
          entity_type: "payment",
          entity_id: payment.id,
          action: "cancel",
          before_data: payment,
          after_data: {
            ...payment,
            status: "cancelled",
          },
          reason: reason.trim(),
        })

      await loadData()
    } catch (e) {
      console.error(e)

      setError(
        "Không thể hủy giao dịch.",
      )
    } finally {
      setWorking(false)
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
          <p className="font-medium text-destructive">
            {error}
          </p>

          <Button
            variant="outline"
            onClick={() => void loadData()}
          >
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </Card>
      </div>
    )
  }

  if (preview) {
    return (
      <ReceiptPreview
        receipt={preview}
        date={selectedDate}
        settings={settings}
        working={working}
        onBack={() =>
          setPreviewMemberId(null)
        }
        onFull={() =>
          void addPayment(
            preview,
            preview.remainingAmount,
          )
        }
        onPartial={() =>
          void handlePartial(preview)
        }
        onEdit={() =>
          void editReceipt(preview)
        }
        onCancel={() =>
          void cancelReceipt(preview)
        }
        onCancelPayment={(payment) =>
          void cancelPayment(
            preview,
            payment,
          )
        }
      />
    )
  }

    return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            Phiếu
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Thu và chi hụi được tổng hợp tự động từ các kỳ đã chốt.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">
            Làm mới
          </span>
        </Button>
      </div>

      <Card className="p-4">
        <label className="flex max-w-[260px] flex-col gap-1.5 text-sm font-medium">
          Ngày phiếu

          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setPreviewMemberId(null)
            }}
          />
        </label>
      </Card>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <p className="font-semibold">
          Phiếu ngày {formatDate(selectedDate)}
        </p>

        <p className="mt-0.5 text-sm text-muted-foreground">
          {receipts.length} hụi viên có phát sinh
        </p>
      </div>

      {receipts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CalendarDays className="size-8 text-muted-foreground" />

          <div>
            <p className="font-medium">
              Chưa có phiếu trong ngày này
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Hãy chốt kết quả kỳ hụi trước.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {receipts.map((receipt) => {
            const isCancelled =
              receipt.status === "cancelled"

            const isFinished =
              !isCancelled &&
              receipt.remainingAmount <= 0

            const amountLabel =
              isCancelled
                ? "Đã hủy"
                : isFinished
                  ? "Đã thanh toán"
                  : receipt.direction === "collect"
                    ? "Cần thu"
                    : receipt.direction === "pay"
                      ? "Cần chi"
                      : "Cân bằng"

            const amountText =
              isCancelled
                ? "—"
                : receipt.direction === "collect" &&
                    receipt.remainingAmount > 0
                  ? `+${formatVND(
                      receipt.remainingAmount,
                    )}`
                  : receipt.direction === "pay" &&
                      receipt.remainingAmount > 0
                    ? `−${formatVND(
                        receipt.remainingAmount,
                      )}`
                    : formatVND(
                        receipt.remainingAmount,
                      )

            const amountClass =
              isCancelled || isFinished
                ? "text-muted-foreground"
                : receipt.direction === "collect"
                  ? "text-emerald-700"
                  : receipt.direction === "pay"
                    ? "text-red-600"
                    : "text-muted-foreground"

            const statusClass =
              receipt.status === "paid"
                ? "bg-emerald-100 text-emerald-700"
                : receipt.status === "partial"
                  ? "bg-amber-100 text-amber-800"
                  : receipt.status === "cancelled"
                    ? "bg-muted text-muted-foreground"
                    : "bg-amber-100 text-amber-800"

            return (
              <Card
                key={receipt.member.id}
                className={`cursor-pointer p-4 transition-shadow hover:shadow-md ${
                  isCancelled
                    ? "opacity-60"
                    : ""
                }`}
                onClick={() =>
                  setPreviewMemberId(
                    receipt.member.id,
                  )
                }
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserRound className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {receipt.member.full_name}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {receipt.groupCount} dây ·{" "}
                          {receipt.totalShares} chân
                        </p>
                      </div>

                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex items-end justify-between gap-4 border-t pt-3">
                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${statusClass}`}
                        >
                          {receiptStatusLabel(
                            receipt.status,
                          )}
                        </span>

                        {receipt.status ===
                          "partial" && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Đã{" "}
                            {receipt.direction ===
                            "collect"
                              ? "thu"
                              : "chi"}{" "}
                            {formatVND(
                              receipt.paidAmount,
                            )}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-muted-foreground">
                          {amountLabel}
                        </p>

                        <p
                          className={`mt-0.5 text-xl font-bold tabular-nums ${amountClass}`}
                        >
                          {amountText}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}


function SummaryCell({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p
        className={`mt-0.5 break-words text-sm ${
          emphasize
            ? "font-bold"
            : "font-semibold"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">
        {label}
      </span>

      <span className="min-w-0 break-words text-right font-medium">
        {value}
      </span>
    </div>
  )
}

function TotalRow({
  label,
  value,
  signed = false,
}: {
  label: string
  value: number
  signed?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span className="shrink-0 font-semibold">
        {signed && value > 0 ? "+" : ""}
        {formatVND(value)}
      </span>
    </div>
  )
}

function ReceiptPreview({
  receipt,
  date,
  settings,
  working,
  onBack,
  onFull,
  onPartial,
  onEdit,
  onCancel,
  onCancelPayment,
}: {
  receipt: Receipt
  date: string
  settings: SettingsRow
  working: boolean
  onBack: () => void
  onFull: () => void
  onPartial: () => void
  onEdit: () => void
  onCancel: () => void
  onCancelPayment: (
    payment: PaymentRow,
  ) => void
}) {
  const [exporting, setExporting] =
    useState(false)

  const qrUrl = vietQrUrl(
    settings,
    receipt,
    date,
  )

  const cancelled =
    receipt.status === "cancelled"

  const finished =
    !cancelled &&
    receipt.remainingAmount <= 0

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
    : receipt.direction === "collect" &&
        receipt.remainingAmount > 0
      ? `+${formatVND(
          receipt.remainingAmount,
        )}`
      : receipt.direction === "pay" &&
          receipt.remainingAmount > 0
        ? `−${formatVND(
            receipt.remainingAmount,
          )}`
        : formatVND(
            receipt.remainingAmount,
          )

  const isCollect =
    !cancelled &&
    !finished &&
    receipt.direction === "collect"

  const isPay =
    !cancelled &&
    !finished &&
    receipt.direction === "pay"

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
      const file =
        await createReceiptJpeg(
          receipt,
          date,
          settings,
        )

      downloadFile(file)
    } catch (e) {
      console.error(e)

      window.alert(
        "Không thể xuất ảnh JPG. Vui lòng thử lại.",
      )
    } finally {
      setExporting(false)
    }
  }

  async function handleShareZalo() {
    if (exporting) return

    setExporting(true)

    try {
      const file =
        await createReceiptJpeg(
          receipt,
          date,
          settings,
        )

      /*
       * Chỉ gửi một nội dung ngắn.
       * Không mang theo tên/số tiền/cần đóng như bản cũ.
       */
      const shareText =
        `Phiếu hụi ngày ${formatDate(
          date,
        )}`

      if (
        navigator.share &&
        (!navigator.canShare ||
          navigator.canShare({
            files: [file],
          }))
      ) {
        try {
          await navigator.share({
            title: shareText,
            text: shareText,
            files: [file],
          })

          return
        } catch (e) {
          if (
            e instanceof DOMException &&
            e.name === "AbortError"
          ) {
            return
          }

          console.error(e)
        }
      }

      downloadFile(file)

      window.alert(
        "Thiết bị này chưa hỗ trợ chia sẻ ảnh trực tiếp. Phiếu JPG đã được lưu xuống máy. Bạn mở Zalo và chọn ảnh vừa lưu để gửi.",
      )
    } catch (e) {
      console.error(e)

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
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
        </Button>

        <div>
          <h1 className="text-lg font-bold text-slate-900">
            Phiếu hụi
          </h1>

          <p className="text-sm text-muted-foreground">
            {receiptStatusLabel(
              receipt.status,
            )}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {/* HEADER */}
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

              {actionDescription &&
                !finished &&
                !cancelled && (
                  <p className="mt-1 text-sm text-slate-500">
                    {actionDescription}
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* OWNER */}
        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="space-y-0">
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[#0f2a56]">
                  <UserRound className="size-4" />
                </div>

                <span className="text-sm sm:text-base">
                  Chủ hụi
                </span>
              </div>

              <span className="text-right text-sm font-bold text-[#0f2a56] sm:text-base">
                {settings.owner_name ||
                  "Chưa khai báo"}
              </span>
            </div>

            <div className="border-t border-slate-100" />

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-slate-500">
                <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-[#0f2a56]">
                  <Phone className="size-4" />
                </div>

                <span className="text-sm sm:text-base">
                  SĐT
                </span>
              </div>

              <span className="text-right text-sm font-bold text-[#0f2a56] sm:text-base">
                {settings.owner_phone ||
                  "Chưa khai báo"}
              </span>
            </div>
          </div>
        </div>

        {/* CHI TIẾT */}
        <div className="border-t border-slate-200 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-[#0f2a56]">
            <CircleDollarSign className="size-5" />

            <h3 className="text-lg font-bold">
              Chi tiết hụi
            </h3>
          </div>

          <div className="space-y-4">
            {receipt.lines.map(
              (line) => (
                <div
                  key={line.periodId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="h-1.5 bg-[#0f2a56]" />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[#0f2a56]">
                          {line.groupCode
                            ? `${line.groupCode} · ${line.groupName}`
                            : line.groupName}
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-bold text-[#0f2a56]">
                        Kỳ{" "}
                        {line.periodNumber}/
                        {line.totalPeriods}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
                      {/* 2 Ô CHÂN */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                          <div className="flex items-center gap-2 text-emerald-700">
                            <UsersRound className="size-4" />

                            <span className="text-xs font-semibold">
                              Chân sống
                            </span>
                          </div>

                          <p className="mt-1 text-2xl font-black text-emerald-700">
                            {line.liveShares}
                          </p>
                        </div>

                        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                          <div className="flex items-center gap-2 text-red-600">
                            <UserRound className="size-4" />

                            <span className="text-xs font-semibold">
                              Chân chết
                            </span>
                          </div>

                          <p className="mt-1 text-2xl font-black text-red-600">
                            {line.deadShares}
                          </p>
                        </div>
                      </div>

                      {/* TIỀN CỦA DÂY */}
                      <div className="space-y-2 text-sm sm:text-base">
                        <ReceiptMoneyRow
                          label="Giá thăm"
                          value={formatVND(
                            line.bidAmount,
                          )}
                        />

                        {line.payAmount >
                          0 && (
                          <ReceiptMoneyRow
                            label="Tiền đóng"
                            value={formatVND(
                              line.payAmount,
                            )}
                          />
                        )}

                        {line.huiAmount >
                          0 && (
                          <>
                            <ReceiptMoneyRow
                              label="Hốt hụi"
                              value={formatVND(
                                line.huiAmount,
                              )}
                            />

                            {line.feeAmount >
                              0 && (
                              <ReceiptMoneyRow
                                label="Tiền thảo"
                                value={`−${formatVND(
                                  line.feeAmount,
                                )}`}
                                negative
                              />
                            )}

                            <div className="border-t border-slate-200 pt-2">
                              <ReceiptMoneyRow
                                label="Thực nhận"
                                value={formatVND(
                                  line.receiveAmount,
                                )}
                                strong
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* TỔNG KẾT */}
        <div className="border-t border-slate-200 bg-slate-50/60 p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-[#0f2a56]">
            Tổng kết
          </h3>

          <div className="space-y-2 text-sm sm:text-base">
            {receipt.totalPay > 0 && (
              <ReceiptMoneyRow
                label="Tổng tiền đóng hụi"
                value={formatVND(
                  receipt.totalPay,
                )}
              />
            )}

            {receipt.totalHuiAmount >
              0 && (
              <ReceiptMoneyRow
                label="Tổng hốt hụi"
                value={formatVND(
                  receipt.totalHuiAmount,
                )}
              />
            )}

            {receipt.totalFee > 0 && (
              <ReceiptMoneyRow
                label="Trừ tiền thảo"
                value={`−${formatVND(
                  receipt.totalFee,
                )}`}
                negative
              />
            )}

            {receipt.settlementAmount !==
              0 && (
              <ReceiptMoneyRow
                label="Tất toán / điều chỉnh"
                value={`${
                  receipt
                    .settlementAmount >
                  0
                    ? "+"
                    : "−"
                }${formatVND(
                  Math.abs(
                    receipt.settlementAmount,
                  ),
                )}`}
              />
            )}

            {receipt.paidAmount >
              0 && (
              <ReceiptMoneyRow
                label="Đã thu / chi"
                value={formatVND(
                  receipt.paidAmount,
                )}
              />
            )}

            {receipt.totalReceive >
              0 && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                <ReceiptMoneyRow
                  label="Thực nhận sau tiền thảo"
                  value={formatVND(
                    receipt.totalReceive,
                  )}
                  strong
                />
              </div>
            )}
          </div>
        </div>

        {/* QR CHỈ PHIẾU THU */}
        {qrUrl &&
          receipt.status !==
            "cancelled" && (
            <div className="border-t border-slate-200 p-5 text-center sm:p-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <p className="font-bold text-[#0f2a56]">
                  Quét QR để đóng đúng số tiền
                </p>

                {/*
                  Không hiện:
                  BIDV · 0931425905

                  img dùng width + h-auto,
                  giữ đúng tỷ lệ gốc VietQR.
                */}
                <img
                  src={qrUrl}
                  alt={`QR đóng hụi ${receipt.member.full_name}`}
                  className="mx-auto mt-4 h-auto w-full max-w-[300px]"
                />

                <p className="mt-3 text-sm text-slate-500">
                  Nội dung:{" "}
                  <span className="font-semibold text-[#0f2a56]">
                    {transferText(
                      receipt,
                      date,
                    )}
                  </span>
                </p>
              </div>
            </div>
          )}
      </Card>

      {/* THAO TÁC */}
      {receipt.status !==
        "cancelled" && (
        <Card className="space-y-4 border-slate-200 p-4 shadow-sm">
          {receipt.direction !==
            "balanced" &&
            receipt.remainingAmount >
              0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  Xác nhận tiền
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    className="h-11"
                    onClick={onFull}
                    disabled={
                      working ||
                      exporting
                    }
                  >
                    <CheckCheck className="size-4" />

                    {receipt.direction ===
                    "collect"
                      ? "Đã thu đủ"
                      : "Đã chi đủ"}
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={onPartial}
                    disabled={
                      working ||
                      exporting
                    }
                  >
                    <CircleDollarSign className="size-4" />

                    {receipt.direction ===
                    "collect"
                      ? "Thu một phần"
                      : "Chi một phần"}
                  </Button>
                </div>
              </div>
            )}

          <div
            className={
              receipt.direction !==
                "balanced" &&
              receipt.remainingAmount >
                0
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
                onClick={() =>
                  void handleDownloadJpg()
                }
                disabled={
                  working ||
                  exporting
                }
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
                onClick={() =>
                  void handleShareZalo()
                }
                disabled={
                  working ||
                  exporting
                }
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
                disabled={
                  working ||
                  exporting
                }
              >
                <Pencil className="size-4" />
                Sửa / điều chỉnh
              </Button>

              <Button
                variant="outline"
                className="text-destructive"
                onClick={onCancel}
                disabled={
                  working ||
                  exporting
                }
              >
                <Ban className="size-4" />
                Hủy phiếu
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* LỊCH SỬ */}
      <Card className="border-slate-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-[#0f2a56]">
          <History className="size-4" />

          <h3 className="font-semibold">
            Lịch sử thu / chi
          </h3>
        </div>

        {receipt.payments.length ===
        0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Chưa có giao dịch nào.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {receipt.payments.map(
              (payment) => (
                <div
                  key={payment.id}
                  className={`rounded-md border border-slate-200 p-3 text-sm ${
                    payment.status ===
                    "cancelled"
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {payment.direction ===
                        "collect"
                          ? "Thu"
                          : "Chi"}{" "}
                        {formatVND(
                          Number(
                            payment.amount,
                          ),
                        )}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {paymentMethodLabel(
                          payment.method,
                        )}{" "}
                        ·{" "}
                        {new Date(
                          payment.created_at,
                        ).toLocaleString(
                          "vi-VN",
                        )}
                      </p>

                      {payment.note && (
                        <p className="mt-1 text-xs">
                          {payment.note}
                        </p>
                      )}

                      {payment.status ===
                        "cancelled" && (
                        <p className="mt-1 text-xs text-destructive">
                          Đã hủy:{" "}
                          {payment.cancel_reason ||
                            "Không ghi lý do"}
                        </p>
                      )}
                    </div>

                    {payment.status ===
                      "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-destructive"
                        onClick={() =>
                          onCancelPayment(
                            payment,
                          )
                        }
                        disabled={
                          working ||
                          exporting
                        }
                      >
                        <Undo2 className="size-4" />
                        Hủy
                      </Button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

function ReceiptMoneyRow({
  label,
  value,
  negative = false,
  strong = false,
}: {
  label: string
  value: string
  negative?: boolean
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
