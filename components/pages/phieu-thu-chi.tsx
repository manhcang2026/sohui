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
import { AppPage, ErrorState, LoadingState, PageHeader } from "@/components/hui-design"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { buildReceipts } from "./phieu/calculation"
import {
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
  const paymentOperationKey = useRef<string | null>(null)
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

  useEffect(() => {
    if (paymentDialog === null) {
      paymentOperationKey.current = null
    } else if (paymentOperationKey.current === null) {
      paymentOperationKey.current = crypto.randomUUID()
    }
  }, [paymentDialog])

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

  function rpcErrorMessage(caught: unknown) {
    return typeof caught === "object" && caught && "message" in caught
      ? String(caught.message)
      : "Lỗi không xác định"
  }

  async function createPaymentsAtomic(input: {
    receipts: Receipt[]
    transactionDate: string
    method: "cash" | "transfer"
    note: string
    amount?: number
  }) {
    if (input.receipts.length === 0 || paymentWriteLock.current) return

    paymentWriteLock.current = true
    setWorking(true)
    setError("")

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

      const idempotencyKey =
        paymentOperationKey.current ?? crypto.randomUUID()
      paymentOperationKey.current = idempotencyKey

      const { data, error: rpcError } = await createClient().rpc(
        "record_receipt_payment_atomic",
        {
          p_idempotency_key: idempotencyKey,
          p_items: candidates.map((receipt) => ({
            member_id: receipt.member.id,
            receipt_date: receipt.receiptDate,
            source_total_pay: receipt.totalPay,
            source_total_receive: receipt.totalReceive,
            source_total_fee: receipt.totalFee,
            requested_amount:
              candidates.length === 1 && input.amount != null
                ? input.amount
                : null,
            source_period_id: null,
            existing_payment_id: null,
          })),
          p_method: input.method,
          p_transaction_date: input.transactionDate,
          p_note: input.note.trim() || null,
        },
      )

      if (rpcError) throw rpcError

      const result = data as { payments?: unknown[] } | null
      const paymentCount = Array.isArray(result?.payments)
        ? result.payments.length
        : candidates.length
      const actionLabel = candidates[0]?.direction === "pay" ? "chi" : "thu"

      setPaymentDialog(null)
      setSelectedKeys([])
      await loadData()
      window.alert(`Đã ghi nhận ${actionLabel} ${paymentCount} phiếu.`)
    } catch (caught) {
      console.error(caught)
      const message = rpcErrorMessage(caught)
      setError(
        message.includes("stale_snapshot")
          ? "Phiếu đã thay đổi trên hệ thống. Hãy làm mới dữ liệu rồi xác nhận lại."
          : `Không thể ghi nhận giao dịch: ${message}`,
      )
    } finally {
      paymentWriteLock.current = false
      setWorking(false)
    }
  }

  async function editPaymentAtomic(
    receipt: Receipt,
    payment: PaymentRow,
    input: {
      amount: number
      transactionDate: string
      method: EditablePaymentMethod
      note: string
    },
  ) {
    if (payment.status !== "active" || paymentWriteLock.current) return

    paymentWriteLock.current = true
    setWorking(true)
    setError("")

    try {
      const idempotencyKey =
        paymentOperationKey.current ?? crypto.randomUUID()
      paymentOperationKey.current = idempotencyKey

      const { error: rpcError } = await createClient().rpc(
        "record_receipt_payment_atomic",
        {
          p_idempotency_key: idempotencyKey,
          p_items: [
            {
              member_id: receipt.member.id,
              receipt_date: receipt.receiptDate,
              source_total_pay: receipt.totalPay,
              source_total_receive: receipt.totalReceive,
              source_total_fee: receipt.totalFee,
              requested_amount: input.amount,
              source_period_id: payment.source_period_id,
              existing_payment_id: payment.id,
            },
          ],
          p_method: input.method,
          p_transaction_date: input.transactionDate,
          p_note: input.note.trim() || null,
        },
      )

      if (rpcError) throw rpcError

      setPaymentDialog(null)
      await loadData()
    } catch (caught) {
      console.error(caught)
      const message = rpcErrorMessage(caught)
      setError(
        message.includes("stale_snapshot")
          ? "Phiếu đã thay đổi trên hệ thống. Hãy làm mới dữ liệu rồi sửa lại."
          : `Không thể sửa giao dịch: ${message}`,
      )
    } finally {
      paymentWriteLock.current = false
      setWorking(false)
    }
  }

  async function cancelPaymentAtomic(payment: PaymentRow) {
    const reason = window.prompt("Lý do hủy giao dịch này:")
    if (!reason?.trim()) return

    setWorking(true)
    setError("")
    try {
      const { error: rpcError } = await createClient().rpc(
        "cancel_receipt_payment_atomic",
        { p_payment_id: payment.id, p_reason: reason.trim() },
      )
      if (rpcError) throw rpcError
      await loadData()
    } catch (caught) {
      console.error(caught)
      setError(`Không thể hủy giao dịch: ${rpcErrorMessage(caught)}`)
    } finally {
      setWorking(false)
    }
  }

  async function cancelReceiptAtomic(receipt: Receipt) {
    const reason = window.prompt("Lý do hủy phiếu:")
    if (!reason?.trim()) return
    if (!receipt.db) {
      window.alert("Phiếu này chưa được lưu nên không có bản ghi để hủy.")
      return
    }

    setWorking(true)
    setError("")
    try {
      const { error: rpcError } = await createClient().rpc(
        "cancel_receipt_atomic",
        { p_receipt_id: receipt.db.id, p_reason: reason.trim() },
      )
      if (rpcError) throw rpcError
      await loadData()
    } catch (caught) {
      console.error(caught)
      const message = rpcErrorMessage(caught)
      setError(
        message.includes("receipt_has_active_payment")
          ? "Không thể hủy phiếu khi còn giao dịch đang hiệu lực."
          : `Không thể hủy phiếu: ${message}`,
      )
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
    return <LoadingState label="Đang lập phiếu từ dữ liệu hụi..." />
  }

  if (error && groups.length === 0) {
    return (
      <AppPage>
        <ErrorState description={error} action={<Button variant="outline" onClick={() => void loadData(true)}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>} />
      </AppPage>
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
          onCancel={() => void cancelReceiptAtomic(preview)}
          onEditPayment={(payment) =>
            setPaymentDialog({
              mode: "edit",
              receipt: preview,
              payment,
            })
          }
          onCancelPayment={(payment) =>
            void cancelPaymentAtomic(payment)
          }
        />

        <PaymentDialog
          state={paymentDialog}
          working={working}
          onClose={() => setPaymentDialog(null)}
          onCreate={(input) => void createPaymentsAtomic(input)}
          onEdit={(receipt, payment, input) =>
            void editPaymentAtomic(receipt, payment, input)
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
    <AppPage wide>
      <PageHeader
        title="Phiếu hụi"
        subtitle="Theo dõi phiếu, thu/chi thực tế và gửi ảnh qua Zalo."
        actions={<Button
          variant="outline"
          size="sm"
          onClick={() => void loadData(true)}
          disabled={working || refreshing}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Làm mới</span>
        </Button>}
      />

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
        onCreate={(input) => void createPaymentsAtomic(input)}
        onEdit={(receipt, payment, input) =>
          void editPaymentAtomic(receipt, payment, input)
        }
      />
    </AppPage>
  )
}

