"use client"

import { useState } from "react"
import { ArrowLeft, Ban, CheckCheck, CircleDollarSign, Download, History, LoaderCircle, Pencil, Phone, Share2, Undo2, UserRound, WalletCards } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { PaymentRow, Receipt, SettingsRow } from "./types"
import { formatDate, formatVND, paymentMethodLabel, receiptStatusLabel, transferText, vietQrUrl } from "./utils"
import { createReceiptJpeg, downloadFile, shareReceiptJpg } from "./receipt-jpeg"
import { RECEIPT_WEB } from "./receipt-design"
import { MiniShareBadge, ReceiptMoneyRow } from "./receipt-list-ui"

export function ReceiptPreview({
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
    ? "text-success-foreground"
    : isPay
      ? "text-danger-foreground"
      : "text-muted-foreground"

  const actionBoxClass = isCollect
    ? RECEIPT_WEB.action.collect
    : isPay
      ? RECEIPT_WEB.action.pay
      : RECEIPT_WEB.action.neutral

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
          <h1 className="text-lg font-bold text-foreground">Phiếu hụi</h1>
          <p className="text-sm text-muted-foreground">
            {receiptStatusLabel(receipt.status)}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 text-center sm:p-6">
          <p className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
            PHIẾU HỤI
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">
            {receipt.member.full_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {formatDate(date)}
          </p>

          <div
            className={`mt-5 flex items-center gap-4 rounded-xl border px-4 py-4 text-left sm:px-5 ${actionBoxClass}`}
          >
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                isCollect
                  ? RECEIPT_WEB.icon.collect
                  : isPay
                    ? RECEIPT_WEB.icon.pay
                    : RECEIPT_WEB.icon.neutral
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
                <p className="mt-1 text-sm text-muted-foreground">
                  {actionDescription}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="space-y-0">
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UserRound className="size-4" />
                </div>
                <span className="text-sm sm:text-base">Chủ hụi</span>
              </div>
              <span className="text-right text-sm font-bold text-foreground sm:text-base">
                {settings.owner_name || "Chưa khai báo"}
              </span>
            </div>

            <div className="border-t border-border" />

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Phone className="size-4" />
                </div>
                <span className="text-sm sm:text-base">SĐT</span>
              </div>
              <span className="text-right text-sm font-bold text-foreground sm:text-base">
                {settings.owner_phone || "Chưa khai báo"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-primary">
            <CircleDollarSign className="size-5" />
            <h3 className="text-lg font-bold">Chi tiết hụi</h3>
          </div>

          <div className="space-y-4">
            {receipt.lines.map((line) => {
              const lineNet = line.receiveAmount - line.payAmount

              return (
                <div
                  key={line.periodId}
                  className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                >
                  <div className="border-b border-border bg-secondary px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-bold text-foreground">
                        {line.groupCode
                          ? `${line.groupCode} · ${line.groupName}`
                          : line.groupName}
                      </p>
                      <p className="shrink-0 text-sm font-bold text-primary">
                        Kỳ {line.periodNumber}/{line.totalPeriods}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
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

                      <div className="border-t border-border pt-2">
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

        <div className="border-t border-border bg-muted/50 p-5 sm:p-6">
          <h3 className="mb-3 text-lg font-bold text-foreground">
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

            <div className="mt-3 rounded-lg border border-border bg-secondary p-3">
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
          <div className="border-t border-border p-5 text-center sm:p-6">
            <div className="rounded-lg border border-primary/20 bg-primary-soft p-4">
              <p className="font-bold text-foreground">
                Quét QR để đóng đúng số tiền
              </p>
              <img
                src={qrUrl}
                alt={`QR đóng hụi ${receipt.member.full_name}`}
                className="mx-auto mt-4 h-auto w-full max-w-[300px]"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                Nội dung:{" "}
                <span className="font-semibold text-primary">
                  {transferText(receipt, date)}
                </span>
              </p>
            </div>
          </div>
        )}
      </Card>

      {receipt.status !== "cancelled" && (
        <Card className="space-y-4 p-4">
          {receipt.direction !== "balanced" &&
            receipt.remainingAmount > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">
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
                ? "border-t border-border pt-4"
                : ""
            }
          >
            <p className="mb-2 text-sm font-semibold text-foreground">
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

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-semibold text-foreground">
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

      <Card className="p-4">
        <div className="flex items-center gap-2 text-primary">
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
                className={`rounded-md border border-border p-3 text-sm ${
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
                        <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
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

