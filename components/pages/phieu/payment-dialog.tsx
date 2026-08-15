"use client"

import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EditablePaymentMethod, PaymentDialogState, PaymentRow, Receipt } from "./types"
import { formatAmountInput, formatDate, formatVND, normalizeEditableMethod, parseAmount, todayInVietnam } from "./utils"

export function PaymentDialog({
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
            <p className="rounded-lg bg-warning-soft p-3 text-xs leading-relaxed text-warning-foreground">
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

