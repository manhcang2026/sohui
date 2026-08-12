"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  CalendarDays,
  CalendarRange,
  CheckCheck,
  LoaderCircle,
  RefreshCw,
  WalletCards,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { buildReceipts } from "./phieu/calculation"
import {
  fetchActivePaymentTotals,
  loadReceiptBaseData,
  loadReceiptLedgerData,
} from "./phieu/data"
import { PaymentDialog } from "./phieu/payment-dialog"
import { shareReceiptJpg } from "./phieu/receipt-jpeg"
import {
  ReceiptMobileCard,
  ReceiptTableRow,
  SummaryCard,
} from "./phieu/receipt-list-ui"
import { ReceiptPreview } from "./phieu/receipt-preview"
import type {
  DateMode,
  EditablePaymentMethod,
  GroupRow,
  ListFilter,
  MemberRow,
  PaymentDialogState,
  PaymentRow,
  PeriodRow,
  Receipt,
  ReceiptDbRow,
  SettingsRow,
  ShareRow,
} from "./phieu/types"
import { EMPTY_SETTINGS } from "./phieu/types"
import {
  formatDateRange,
  formatVND,
  todayInVietnam,
} from "./phieu/utils"

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
  const [refreshing, setRefreshing] = useState(false)
  const [working, setWorking] = useState(false)
  const [sharingKey, setSharingKey] = useState<string | null>(null)
  const [error, setError] = useState("")
  const paymentWriteLock = useRef(false)
  const dataRequestId = useRef(0)
  const baseLoaded = useRef(false)

  const effectiveFrom = dateMode === "single" ? singleDate : dateFrom
  const effectiveTo = dateMode === "single" ? singleDate : dateTo

  const [loadedFrom, setLoadedFrom] = useState(effectiveFrom)
  const [loadedTo, setLoadedTo] = useState(effectiveTo)

  const loadData = useCallback(async (reloadBase = false) => {
    if (!effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo) {
      return
    }

    const requestId = ++dataRequestId.current
    const initialLoad = !baseLoaded.current
    const needsBase = reloadBase || initialLoad

    if (initialLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError("")

    try {
      const [base, ledger] = await Promise.all([
        needsBase ? loadReceiptBaseData() : Promise.resolve(null),
        loadReceiptLedgerData(effectiveFrom, effectiveTo),
      ])

      if (requestId !== dataRequestId.current) return

      if (base) {
        setGroups(base.groups)
        setShares(base.shares)
        setPeriods(base.periods)
        setMembers(base.members)
        setSettings(base.settings)
        baseLoaded.current = true
      }

      setReceiptRows(ledger.receiptRows)
      setPayments(ledger.payments)
      setLoadedFrom(effectiveFrom)
      setLoadedTo(effectiveTo)
    } catch (caught) {
      if (requestId !== dataRequestId.current) return
      console.error(caught)
      setError(
        "Không thể tải dữ liệu phiếu. Vui lòng làm mới và thử lại.",
      )
    } finally {
      if (requestId === dataRequestId.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [effectiveFrom, effectiveTo])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const receipts = useMemo(
    () =>
      buildReceipts({
        effectiveFrom: loadedFrom,
        effectiveTo: loadedTo,
        groups,
        members,
        payments,
        periods,
        receiptRows,
        shares,
      }),
    [
      loadedFrom,
      loadedTo,
      groups,
      members,
      payments,
      periods,
      receiptRows,
      shares,
    ],
  )

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
    if (input.receipts.length === 0 || paymentWriteLock.current) return

    // Khóa đồng bộ ngay từ lần bấm đầu tiên. setWorking là state nên có thể
    // chưa kịp render trước cú double-click thứ hai.
    paymentWriteLock.current = true
    setWorking(true)
    setError("")

    let insertedCount = 0

    try {
      const candidates = input.receipts.filter(
        (receipt) =>
          receipt.status !== "cancelled" &&
          receipt.direction !== "balanced" &&
          receipt.remainingAmount > 0,
      )

      if (candidates.length === 0) {
        setPaymentDialog(null)
        setSelectedKeys([])
        return
      }

      const supabase = createClient()
      const now = new Date().toISOString()

      // Upsert phiếu theo lô thay vì gọi ensureReceipt hàng trăm lần.
      // Không ghi đè status/settlement của phiếu đang có.
      const receiptPayloads = candidates.map((receipt) => ({
        member_id: receipt.member.id,
        receipt_date: receipt.receiptDate,
        source_total_pay: receipt.totalPay,
        source_total_receive: receipt.totalReceive,
        source_total_fee: receipt.totalFee,
        source_total_profit: 0,
        updated_at: now,
      }))

      const freshReceiptRows: ReceiptDbRow[] = []
      const receiptBatchSize = 100

      for (let i = 0; i < receiptPayloads.length; i += receiptBatchSize) {
        const chunk = receiptPayloads.slice(i, i + receiptBatchSize)
        const { data, error: receiptError } = await supabase
          .from("hui_receipts")
          .upsert(chunk, { onConflict: "member_id,receipt_date" })
          .select(
            "id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason",
          )

        if (receiptError) throw receiptError
        freshReceiptRows.push(...((data ?? []) as ReceiptDbRow[]))
      }

      const dbByKey = new Map(
        freshReceiptRows.map((row) => [
          `${row.receipt_date}|${row.member_id}`,
          row,
        ]),
      )

      const receiptIds = freshReceiptRows.map((row) => row.id)

      // Luôn đọc lại ledger thật và có phân trang trước khi insert. Không dựa
      // vào dữ liệu đang hiển thị trên UI vì UI có thể vừa cũ hoặc vừa retry.
      const paidByReceiptDirection = await fetchActivePaymentTotals(receiptIds)

      const pending: Array<{
        receipt: Receipt
        db: ReceiptDbRow
        amount: number
        freshPaid: number
        totalRequired: number
      }> = []
      let skippedCount = 0

      for (const receipt of candidates) {
        const db = dbByKey.get(`${receipt.receiptDate}|${receipt.member.id}`)

        if (!db || db.status === "cancelled") {
          skippedCount += 1
          continue
        }

        const freshPaid =
          paidByReceiptDirection.get(`${db.id}|${receipt.direction}`) ?? 0

        const totalRequired = Math.abs(receipt.netAmount)
        const freshRemaining = Math.max(0, totalRequired - freshPaid)

        if (freshRemaining <= 0) {
          skippedCount += 1
          continue
        }

        const requestedAmount =
          candidates.length === 1 && input.amount != null
            ? input.amount
            : freshRemaining

        if (requestedAmount <= 0) {
          skippedCount += 1
          continue
        }

        if (requestedAmount > freshRemaining) {
          throw new Error(
            `Phiếu của ${receipt.member.full_name} vừa thay đổi. ` +
              `Hiện chỉ còn ${formatVND(freshRemaining)}. Hãy mở lại phiếu rồi xác nhận lại.`,
          )
        }

        pending.push({
          receipt,
          db,
          amount: requestedAmount,
          freshPaid,
          totalRequired,
        })
      }

      if (pending.length === 0) {
        setPaymentDialog(null)
        setSelectedKeys([])
        await loadData()
        window.alert(
          `Không tạo thêm giao dịch. ${skippedCount} phiếu đã đủ, đã hủy hoặc không còn số tiền cần thanh toán.`,
        )
        return
      }

      const paymentPayload = pending.map((item) => ({
        receipt_id: item.db.id,
        direction: item.receipt.direction,
        amount: item.amount,
        method: input.method,
        transaction_date: input.transactionDate,
        note: input.note.trim() || null,
      }))

      // Chia nhỏ insert để tránh một request quá lớn. Nếu một batch sau lỗi,
      // batch đã thành công vẫn được ledger ghi nhận; lần retry sẽ đọc lại và
      // tự bỏ qua các phiếu đó thay vì tạo trùng.
      const insertBatchSize = 100
      for (let i = 0; i < paymentPayload.length; i += insertBatchSize) {
        const chunk = paymentPayload.slice(i, i + insertBatchSize)
        const { error: insertError } = await supabase
          .from("receipt_payments")
          .insert(chunk)

        if (insertError) throw insertError
        insertedCount += chunk.length
      }

      // Tất cả bulk/full sẽ thành paid. Trường hợp một phiếu nhập một phần
      // có thể là partial hoặc paid nếu số nhập bằng đúng phần còn lại.
      const paidIds: string[] = []
      const partialIds: string[] = []

      for (const item of pending) {
        const afterPaid = item.freshPaid + item.amount
        if (item.totalRequired > 0 && afterPaid >= item.totalRequired) {
          paidIds.push(item.db.id)
        } else {
          partialIds.push(item.db.id)
        }
      }

      const statusBatchSize = 100
      for (const [status, ids] of [
        ["paid", paidIds],
        ["partial", partialIds],
      ] as const) {
        for (let i = 0; i < ids.length; i += statusBatchSize) {
          const chunk = ids.slice(i, i + statusBatchSize)
          if (chunk.length === 0) continue

          const { error: statusError } = await supabase
            .from("hui_receipts")
            .update({ status, updated_at: new Date().toISOString() })
            .in("id", chunk)

          if (statusError) throw statusError
        }
      }

      const auditPayload = pending.map((item) => ({
        entity_type: "receipt",
        entity_id: item.db.id,
        action:
          item.receipt.direction === "collect"
            ? "collect_payment"
            : "pay_payment",
        after_data: {
          amount: item.amount,
          method: input.method,
          transaction_date: input.transactionDate,
          note: input.note.trim() || null,
        },
      }))

      const auditBatchSize = 100
      for (let i = 0; i < auditPayload.length; i += auditBatchSize) {
        const chunk = auditPayload.slice(i, i + auditBatchSize)
        const { error: auditError } = await supabase
          .from("audit_logs")
          .insert(chunk)

        if (auditError) {
          // Payment đã ghi thành công thì không được coi audit lỗi là lý do để
          // người dùng phải ghi payment lại. Giữ log console để kiểm tra sau.
          console.error("Không thể ghi một batch audit_logs:", auditError)
        }
      }

      setPaymentDialog(null)
      setSelectedKeys([])
      await loadData()

      const actionLabel =
        pending[0]?.receipt.direction === "pay" ? "chi" : "thu"
      window.alert(
        `Đã ghi nhận ${actionLabel} ${pending.length} phiếu.` +
          (skippedCount > 0
            ? ` Bỏ qua ${skippedCount} phiếu đã đủ/hủy hoặc không còn số tiền.`
            : ""),
      )
    } catch (caught) {
      console.error(caught)

      // Nếu một batch payment đã insert rồi nhưng bước sau gặp lỗi, tải lại
      // ngay để UI phản ánh ledger thật. Retry sau đó cũng sẽ không tạo trùng.
      if (insertedCount > 0) {
        try {
          await loadData()
        } catch (reloadError) {
          console.error(reloadError)
        }
      }

      setError(
        caught instanceof Error
          ? `Không thể ghi nhận giao dịch: ${caught.message}`
          : "Không thể ghi nhận giao dịch.",
      )
    } finally {
      paymentWriteLock.current = false
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
          <Button variant="outline" onClick={() => void loadData(true)}>
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
          onClick={() => void loadData(true)}
          disabled={working || refreshing}
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

      {refreshing && !invalidRange && (
        <Card className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải phiếu và đối chiếu giao dịch...
        </Card>
      )}

      {!invalidRange && !refreshing && filteredReceipts.length > 0 && (
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

      {!invalidRange && !refreshing && filteredReceipts.length === 0 ? (
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

      {!invalidRange && !refreshing && filteredReceipts.length > 0 && (
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

      {!refreshing && selectedKeys.length > 0 && (
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

