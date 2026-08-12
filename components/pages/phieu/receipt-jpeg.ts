import type { Receipt, SettingsRow } from "./types"
import { formatDate, formatVND, receiptFileName, transferText, vietQrUrl } from "./utils"

export function downloadFile(file: File) {
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

export async function createReceiptJpeg(
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

export async function shareReceiptJpg(
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

