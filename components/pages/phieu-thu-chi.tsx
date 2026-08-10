"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, Ban, CalendarDays, CheckCheck, ChevronRight, CircleDollarSign, History, LoaderCircle, Pencil, RefreshCw, Share2, Undo2, UserRound } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type GroupRow = { id: string; code: string | null; name: string; contribution_amount: number; total_shares: number; fee_amount: number }
type ShareRow = { id: string; group_id: string; member_id: string; share_number: number; status: string }
type PeriodRow = { id: string; group_id: string; period_number: number; scheduled_date: string; opened_at: string | null; winner_share_id: string | null; bid_amount: number; fee_amount: number; status: string }
type MemberRow = { id: string; full_name: string; phone: string | null }
type SettingsRow = { owner_name: string; owner_phone: string; bank_id: string; bank_name: string; bank_account_number: string; bank_account_name: string; transfer_prefix: string }
type ReceiptDbRow = { id: string; member_id: string; receipt_date: string; settlement_amount: number; note: string | null; status: "open" | "partial" | "paid" | "cancelled"; cancelled_at: string | null; cancel_reason: string | null }
type PaymentRow = { id: string; receipt_id: string; direction: "collect" | "pay"; amount: number; method: "cash" | "transfer" | "other"; note: string | null; status: "active" | "cancelled"; cancelled_at: string | null; cancel_reason: string | null; created_at: string }
type ReceiptLine = { periodId: string; groupId: string; groupCode: string; groupName: string; periodNumber: number; totalPeriods: number; bidAmount: number; liveShares: number; deadShares: number; payAmount: number; receiveAmount: number; feeAmount: number; profitAmount: number }
type Receipt = { member: MemberRow; lines: ReceiptLine[]; groupCount: number; totalShares: number; liveShares: number; deadShares: number; totalPay: number; totalReceive: number; totalFee: number; totalProfit: number; db: ReceiptDbRow | null; payments: PaymentRow[]; settlementAmount: number; netAmount: number; paidAmount: number; remainingAmount: number; direction: "collect" | "pay" | "balanced"; status: "open" | "partial" | "paid" | "cancelled" }

const EMPTY_SETTINGS: SettingsRow = { owner_name: "", owner_phone: "", bank_id: "", bank_name: "", bank_account_number: "", bank_account_name: "", transfer_prefix: "HUI" }

function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
function formatDate(value: string) { const [y, m, d] = value.slice(0, 10).split("-"); return `${d}/${m}/${y}` }
function formatVND(value: number) { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0)) }
function isCompleted(status: string) { return status === "completed" || status === "opened" }
function receiptStatusLabel(status: Receipt["status"]) { return status === "cancelled" ? "Đã hủy" : status === "paid" ? "Đã đủ" : status === "partial" ? "Một phần" : "Chưa thanh toán" }
function paymentMethodLabel(method: PaymentRow["method"]) { return method === "cash" ? "Tiền mặt" : method === "transfer" ? "Chuyển khoản" : "Khác" }
function parseAmount(value: string) { const clean = value.replace(/\./g, "").replace(/,/g, "").trim(); const n = Number(clean); return Number.isFinite(n) ? n : 0 }

function transferText(
  settings: SettingsRow,
  receipt: Receipt,
  date: string,
) {
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

  const asciiName = receipt.member.full_name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ")

  const parts = asciiName.split(" ").filter(Boolean)

  while (
    parts.length > 1 &&
    honorifics.has(parts[0].toLocaleLowerCase("vi"))
  ) {
    parts.shift()
  }

  const cleanName = parts.join(" ").slice(0, 24)

  const [year, month, day] = date.slice(0, 10).split("-")
  const ddmmyy = `${day}${month}${year.slice(-2)}`

  return `${cleanName} ck ngay ${ddmmyy}`.trim().slice(0, 50)
}

function vietQrUrl(settings: SettingsRow, receipt: Receipt, date: string) {
  if (receipt.direction !== "collect" || receipt.remainingAmount <= 0 || !settings.bank_id || !settings.bank_account_number) return ""
  const q = new URLSearchParams({ amount: String(Math.round(receipt.remainingAmount)), addInfo: transferText(settings, receipt, date), accountName: settings.bank_account_name })
  return `https://img.vietqr.io/image/${encodeURIComponent(settings.bank_id)}-${encodeURIComponent(settings.bank_account_number)}-compact2.png?${q.toString()}`
}

export function PhieuThuChiPage() {
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([])
  const [periods, setPeriods] = useState<PeriodRow[]>([])
  const [members, setMembers] = useState<MemberRow[]>([])
  const [settings, setSettings] = useState<SettingsRow>(EMPTY_SETTINGS)
  const [receiptRows, setReceiptRows] = useState<ReceiptDbRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [selectedDate, setSelectedDate] = useState(todayInVietnam())
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true); setError("")
    const supabase = createClient()
    const [g, s, p, m, cfg, r, pay] = await Promise.all([
      supabase.from("hui_groups").select("id, code, name, contribution_amount, total_shares, fee_amount"),
      supabase.from("hui_shares").select("id, group_id, member_id, share_number, status").order("share_number"),
      supabase.from("hui_periods").select("id, group_id, period_number, scheduled_date, opened_at, winner_share_id, bid_amount, fee_amount, status").order("period_number"),
      supabase.from("members").select("id, full_name, phone"),
      supabase.from("app_settings").select("owner_name, owner_phone, bank_id, bank_name, bank_account_number, bank_account_name, transfer_prefix").eq("id", 1).maybeSingle(),
      supabase.from("hui_receipts").select("id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason"),
      supabase.from("receipt_payments").select("id, receipt_id, direction, amount, method, note, status, cancelled_at, cancel_reason, created_at").order("created_at", { ascending: false }),
    ])
    const firstError = g.error ?? s.error ?? p.error ?? m.error ?? cfg.error ?? r.error ?? pay.error
    if (firstError) { console.error(firstError); setError("Không thể tải dữ liệu phiếu. Nếu vừa cập nhật, hãy chạy file SQL trước."); setLoading(false); return }
    setGroups((g.data ?? []) as GroupRow[]); setShares((s.data ?? []) as ShareRow[]); setPeriods((p.data ?? []) as PeriodRow[]); setMembers((m.data ?? []) as MemberRow[])
    setSettings((cfg.data as SettingsRow | null) ?? EMPTY_SETTINGS); setReceiptRows((r.data ?? []) as ReceiptDbRow[]); setPayments((pay.data ?? []) as PaymentRow[]); setLoading(false)
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  const receipts = useMemo(() => {
    const groupsById = new Map(groups.map((x) => [x.id, x])); const membersById = new Map(members.map((x) => [x.id, x]))
    const sharesByGroup = new Map<string, ShareRow[]>(); const periodsByGroup = new Map<string, PeriodRow[]>()
    for (const x of shares) { const a = sharesByGroup.get(x.group_id) ?? []; a.push(x); sharesByGroup.set(x.group_id, a) }
    for (const x of periods) { const a = periodsByGroup.get(x.group_id) ?? []; a.push(x); periodsByGroup.set(x.group_id, a) }
    const linesByMember = new Map<string, ReceiptLine[]>()

    for (const period of periods.filter((x) => isCompleted(x.status) && x.scheduled_date === selectedDate)) {
      const group = groupsById.get(period.group_id); if (!group || !period.winner_share_id) continue
      const groupShares = (sharesByGroup.get(group.id) ?? []).filter((x) => x.status === "active" || x.id === period.winner_share_id)
      const groupPeriods = periodsByGroup.get(group.id) ?? []
      const previousWinnerIds = new Set(groupPeriods.filter((x) => x.period_number < period.period_number && isCompleted(x.status) && x.winner_share_id).map((x) => x.winner_share_id as string))
      const bid = Number(period.bid_amount || 0); const contribution = Number(group.contribution_amount || 0); const liveContribution = Math.max(0, contribution - bid)
      const amountByShare = new Map<string, number>(); let pot = 0
      for (const share of groupShares) {
        if (share.id === period.winner_share_id) { amountByShare.set(share.id, 0); continue }
        const amount = previousWinnerIds.has(share.id) ? contribution : liveContribution; amountByShare.set(share.id, amount); pot += amount
      }
      const winner = groupShares.find((x) => x.id === period.winner_share_id); const winnerMemberId = winner?.member_id ?? null
      const fee = Number(period.fee_amount ?? group.fee_amount ?? 0)
      // pot - fee = TIỀN HỐT trước khi trừ tiền thảo.
      const huiAmount = Math.max(0, pot - fee)
      // THỰC CHI = TIỀN HỐT - TIỀN THẢO.
      const winnerReceive = Math.max(0, huiAmount - fee)
      for (const memberId of new Set(groupShares.map((x) => x.member_id))) {
        if (!membersById.has(memberId)) continue
        let liveShares = 0, deadShares = 0, payAmount = 0, profitAmount = 0
        for (const share of groupShares.filter((x) => x.member_id === memberId)) {
          if (share.id === period.winner_share_id) {
            // Ngay sau khi chốt kỳ, chân vừa hốt được tính là chân chết/đã hốt.
            deadShares += 1
            continue
          }
          if (previousWinnerIds.has(share.id)) {
            deadShares += 1
          } else {
            liveShares += 1
            profitAmount += bid
          }
          payAmount += amountByShare.get(share.id) ?? 0
        }
        const line: ReceiptLine = { periodId: period.id, groupId: group.id, groupCode: group.code ?? "", groupName: group.name, periodNumber: period.period_number, totalPeriods: Math.max(group.total_shares, groupPeriods.length), bidAmount: bid, liveShares, deadShares, payAmount, receiveAmount: memberId === winnerMemberId ? winnerReceive : 0, feeAmount: memberId === winnerMemberId ? fee : 0, profitAmount }
        const a = linesByMember.get(memberId) ?? []; a.push(line); linesByMember.set(memberId, a)
      }
    }

    const result: Receipt[] = []
    for (const [memberId, lines] of linesByMember) {
      const member = membersById.get(memberId); if (!member) continue
      const totalPay = lines.reduce((n, x) => n + x.payAmount, 0); const totalReceive = lines.reduce((n, x) => n + x.receiveAmount, 0); const totalFee = lines.reduce((n, x) => n + x.feeAmount, 0); const totalProfit = lines.reduce((n, x) => n + x.profitAmount, 0)
      const db = receiptRows.find((x) => x.member_id === memberId && x.receipt_date === selectedDate) ?? null
      const settlementAmount = Number(db?.settlement_amount ?? 0); const netAmount = totalPay - totalReceive + settlementAmount
      const direction: Receipt["direction"] = netAmount > 0 ? "collect" : netAmount < 0 ? "pay" : "balanced"
      const allReceiptPayments = db ? payments.filter((x) => x.receipt_id === db.id) : []
      const active = allReceiptPayments.filter((x) => x.status === "active" && x.direction === direction)
      const paidAmount = active.reduce((n, x) => n + Number(x.amount), 0); const remainingAmount = Math.max(0, Math.abs(netAmount) - paidAmount)
      let status: Receipt["status"] = db?.status ?? "open"
      if (status !== "cancelled") status = remainingAmount <= 0 && Math.abs(netAmount) > 0 ? "paid" : paidAmount > 0 ? "partial" : "open"
      result.push({ member, lines, groupCount: new Set(lines.map((x) => x.groupId)).size, totalShares: lines.reduce((n, x) => n + x.liveShares + x.deadShares, 0), liveShares: lines.reduce((n, x) => n + x.liveShares, 0), deadShares: lines.reduce((n, x) => n + x.deadShares, 0), totalPay, totalReceive, totalFee, totalProfit, db, payments: allReceiptPayments, settlementAmount, netAmount, paidAmount, remainingAmount, direction, status })
    }
    return result.sort((a, b) => a.member.full_name.localeCompare(b.member.full_name, "vi"))
  }, [groups, members, payments, periods, receiptRows, selectedDate, shares])

  const preview = receipts.find((x) => x.member.id === previewMemberId)

  async function ensureReceipt(receipt: Receipt) {
    const payload = { member_id: receipt.member.id, receipt_date: selectedDate, source_total_pay: receipt.totalPay, source_total_receive: receipt.totalReceive, source_total_fee: receipt.totalFee, source_total_profit: receipt.totalProfit, updated_at: new Date().toISOString() }
    const q = receipt.db
      ? createClient().from("hui_receipts").update(payload).eq("id", receipt.db.id)
      : createClient().from("hui_receipts").upsert(payload, { onConflict: "member_id,receipt_date" })
    const { data, error } = await q.select("id, member_id, receipt_date, settlement_amount, note, status, cancelled_at, cancel_reason").single()
    if (error) throw error; return data as ReceiptDbRow
  }

  async function addPayment(receipt: Receipt, amount: number) {
    if (receipt.direction === "balanced" || amount <= 0 || amount > receipt.remainingAmount) return
    const methodAnswer = window.prompt("Hình thức: 1 = Chuyển khoản, 2 = Tiền mặt, 3 = Khác", "1"); if (methodAnswer === null) return
    const method = methodAnswer === "2" ? "cash" : methodAnswer === "3" ? "other" : "transfer"; const note = window.prompt("Ghi chú giao dịch (có thể bỏ trống):", "") ?? ""
    setWorking(true); setError("")
    try {
      const db = await ensureReceipt(receipt); const supabase = createClient()
      const { error } = await supabase.from("receipt_payments").insert({ receipt_id: db.id, direction: receipt.direction, amount, method, note: note.trim() || null }); if (error) throw error
      const newStatus = receipt.paidAmount + amount >= Math.abs(receipt.netAmount) ? "paid" : "partial"
      await supabase.from("hui_receipts").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", db.id)
      await supabase.from("audit_logs").insert({ entity_type: "receipt", entity_id: db.id, action: receipt.direction === "collect" ? "collect_payment" : "pay_payment", after_data: { amount, method, note: note.trim() || null } })
      await loadData()
    } catch (e) { console.error(e); setError("Không thể ghi nhận giao dịch.") } finally { setWorking(false) }
  }

  async function handlePartial(receipt: Receipt) {
    const answer = window.prompt(`${receipt.direction === "collect" ? "Số tiền vừa thu" : "Số tiền vừa chi"} (còn ${formatVND(receipt.remainingAmount)}):`, String(receipt.remainingAmount)); if (answer === null) return
    const amount = parseAmount(answer); if (amount <= 0 || amount > receipt.remainingAmount) { window.alert("Số tiền không hợp lệ hoặc lớn hơn số còn lại."); return }
    await addPayment(receipt, amount)
  }

  async function editReceipt(receipt: Receipt) {
    const answer = window.prompt("Điều chỉnh/tất toán thêm. Số dương = hụi viên đóng thêm; số âm = chủ hụi giao thêm.", String(receipt.settlementAmount)); if (answer === null) return
    const settlement = Number(answer.replace(/\./g, "").replace(/,/g, "")); if (!Number.isFinite(settlement)) { window.alert("Số điều chỉnh không hợp lệ."); return }
    const note = window.prompt("Ghi chú/lý do điều chỉnh:", receipt.db?.note ?? "") ?? ""; const reason = window.prompt("Lý do sửa phiếu:", "Điều chỉnh nghiệp vụ"); if (!reason?.trim()) return
    setWorking(true)
    try {
      const db = await ensureReceipt(receipt); const supabase = createClient(); const before = { settlement_amount: receipt.settlementAmount, note: receipt.db?.note ?? null }; const after = { settlement_amount: settlement, note: note.trim() || null }
      const { error } = await supabase.from("hui_receipts").update({ ...after, status: "open", updated_at: new Date().toISOString() }).eq("id", db.id); if (error) throw error
      await supabase.from("audit_logs").insert({ entity_type: "receipt", entity_id: db.id, action: "edit", before_data: before, after_data: after, reason: reason.trim() }); await loadData()
    } catch (e) { console.error(e); setError("Không thể sửa phiếu.") } finally { setWorking(false) }
  }

  async function cancelReceipt(receipt: Receipt) {
    const reason = window.prompt("Lý do hủy phiếu:"); if (!reason?.trim()) return
    if (receipt.payments.some((x) => x.status === "active") && !window.confirm("Phiếu đang có giao dịch thu/chi. Nên hủy từng giao dịch trước. Vẫn hủy phiếu?")) return
    setWorking(true)
    try {
      const db = await ensureReceipt(receipt); const supabase = createClient(); const { error } = await supabase.from("hui_receipts").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.trim(), updated_at: new Date().toISOString() }).eq("id", db.id); if (error) throw error
      await supabase.from("audit_logs").insert({ entity_type: "receipt", entity_id: db.id, action: "cancel", before_data: { status: receipt.status }, after_data: { status: "cancelled" }, reason: reason.trim() }); await loadData()
    } catch (e) { console.error(e); setError("Không thể hủy phiếu.") } finally { setWorking(false) }
  }

  async function cancelPayment(receipt: Receipt, payment: PaymentRow) {
    const reason = window.prompt("Lý do hủy giao dịch này:"); if (!reason?.trim()) return
    setWorking(true)
    try {
      const supabase = createClient(); const { error } = await supabase.from("receipt_payments").update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason.trim(), updated_at: new Date().toISOString() }).eq("id", payment.id); if (error) throw error
      if (receipt.db) await supabase.from("hui_receipts").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", receipt.db.id)
      await supabase.from("audit_logs").insert({ entity_type: "payment", entity_id: payment.id, action: "cancel", before_data: payment, after_data: { ...payment, status: "cancelled" }, reason: reason.trim() }); await loadData()
    } catch (e) { console.error(e); setError("Không thể hủy giao dịch.") } finally { setWorking(false) }
  }

  async function shareReceipt(receipt: Receipt) {
    const action = receipt.direction === "collect" ? `Cần đóng ${formatVND(receipt.remainingAmount)}` : receipt.direction === "pay" ? `Được nhận ${formatVND(receipt.remainingAmount)}` : "Phiếu đã cân bằng"
    const text = `PHIẾU HỤI ${formatDate(selectedDate)}\n${receipt.member.full_name}\n${action}`
    if (navigator.share) { try { await navigator.share({ title: "Phiếu hụi", text }); return } catch { return } }
    await navigator.clipboard.writeText(text); window.alert("Thiết bị chưa hỗ trợ chia sẻ trực tiếp. Nội dung phiếu đã được sao chép.")
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Đang lập phiếu từ dữ liệu hụi...</div>
  if (error && groups.length === 0) return <div className="mx-auto max-w-3xl p-4 md:p-6"><Card className="flex flex-col items-center gap-3 p-8 text-center"><p className="font-medium text-destructive">{error}</p><Button variant="outline" onClick={() => void loadData()}><RefreshCw className="size-4" />Thử lại</Button></Card></div>

  if (preview) return <ReceiptPreview receipt={preview} date={selectedDate} settings={settings} working={working} onBack={() => setPreviewMemberId(null)} onShare={() => void shareReceipt(preview)} onFull={() => void addPayment(preview, preview.remainingAmount)} onPartial={() => void handlePartial(preview)} onEdit={() => void editReceipt(preview)} onCancel={() => void cancelReceipt(preview)} onCancelPayment={(p) => void cancelPayment(preview, p)} />

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div><h1 className="text-xl font-bold">Lập phiếu thu–chi</h1><p className="mt-1 text-sm text-muted-foreground">Phiếu được tự tổng hợp từ các kỳ hụi đã chốt trong ngày.</p></div>
      <Card className="p-4"><label className="flex max-w-xs flex-col gap-1.5 text-sm font-medium">Ngày lập phiếu<Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setPreviewMemberId(null) }} /></label></Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">Phiếu ngày {formatDate(selectedDate)}</p><p className="text-sm text-muted-foreground">{receipts.length} hụi viên có phát sinh</p></div><Button variant="outline" size="sm" onClick={() => void loadData()}><RefreshCw className="size-4" />Làm mới</Button></div>
      {receipts.length === 0 ? <Card className="flex flex-col items-center gap-3 p-10 text-center"><CalendarDays className="size-8 text-muted-foreground" /><div><p className="font-medium">Chưa có phiếu trong ngày này</p><p className="mt-1 text-sm text-muted-foreground">Hãy chốt kết quả kỳ hụi trước.</p></div></Card> : <div className="space-y-3">{receipts.map((r) => <Card key={r.member.id} className={`cursor-pointer p-4 transition-shadow hover:shadow-md ${r.status === "cancelled" ? "opacity-60" : ""}`} onClick={() => setPreviewMemberId(r.member.id)}><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{r.member.full_name}</p><p className="text-xs text-muted-foreground">{r.groupCount} dây · {r.lines.length} phát sinh · {receiptStatusLabel(r.status)}</p></div><ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" /></div><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><SummaryCell label="Tiền đóng" value={formatVND(r.totalPay)} /><SummaryCell label="Tiền hốt" value={formatVND(r.totalReceive)} /><SummaryCell label="Đã thu/chi" value={formatVND(r.paidAmount)} /><SummaryCell label={r.direction === "collect" ? "Còn phải thu" : r.direction === "pay" ? "Còn phải chi" : "Cân bằng"} value={formatVND(r.remainingAmount)} emphasize /></div></div></div></Card>)}</div>}
    </div>
  )
}

function SummaryCell({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) { return <div className="min-w-0 rounded-md bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-0.5 break-words text-sm ${emphasize ? "font-bold" : "font-semibold"}`}>{value}</p></div> }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 items-start justify-between gap-3"><span className="shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 break-words text-right font-medium">{value}</span></div> }
function TotalRow({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) { return <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="shrink-0 font-semibold">{signed && value > 0 ? "+" : ""}{formatVND(value)}</span></div> }

function ReceiptPreview({ receipt, date, settings, working, onBack, onShare, onFull, onPartial, onEdit, onCancel, onCancelPayment }: { receipt: Receipt; date: string; settings: SettingsRow; working: boolean; onBack: () => void; onShare: () => void; onFull: () => void; onPartial: () => void; onEdit: () => void; onCancel: () => void; onCancelPayment: (payment: PaymentRow) => void }) {
  const qrUrl = vietQrUrl(settings, receipt, date)
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-4" /></Button><div><h1 className="text-lg font-bold">Phiếu hụi</h1><p className="text-sm text-muted-foreground">{receiptStatusLabel(receipt.status)}</p></div></div>
      <Card className="overflow-hidden">
        <div className="border-b p-4 sm:p-5"><h2 className="text-center text-xl font-bold">PHIẾU THU / CHI HỤI</h2><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><InfoRow label="Chủ hụi" value={settings.owner_name || "Chưa khai báo"} /><InfoRow label="SĐT chủ hụi" value={settings.owner_phone || "Chưa khai báo"} /><InfoRow label="Tên hụi viên" value={receipt.member.full_name} /><InfoRow label="Ngày lập phiếu" value={formatDate(date)} /></div></div>
        <div className="border-b p-4 sm:p-5"><div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><SummaryCell label="Số dây" value={String(receipt.groupCount)} /><SummaryCell label="Số chân" value={String(receipt.totalShares)} /><SummaryCell label="Chân sống" value={String(receipt.liveShares)} /><SummaryCell label="Chân chết" value={String(receipt.deadShares)} /></div></div>
        <div className="space-y-3 p-4 sm:p-5"><h3 className="font-bold">Chi tiết nhận / đóng tiền</h3>{receipt.lines.map((line, i) => <div key={line.periodId} className="rounded-lg border p-3.5"><div className="flex items-start justify-between gap-3 border-b pb-2.5"><div className="min-w-0"><p className="font-semibold">{i + 1}. {line.groupName}</p>{line.groupCode && <p className="mt-0.5 text-xs text-muted-foreground">{line.groupCode}</p>}</div><p className="shrink-0 text-sm font-semibold">Kỳ {line.periodNumber}/{line.totalPeriods}</p></div><div className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2"><InfoRow label="Giá thăm" value={formatVND(line.bidAmount)} /><InfoRow label="Chân sống / chết" value={`${line.liveShares} / ${line.deadShares}`} /><InfoRow label="Tiền đóng" value={formatVND(line.payAmount)} /><InfoRow label="Tiền hốt" value={formatVND(line.receiveAmount)} />{line.feeAmount > 0 && <InfoRow label="Tiền thảo (đã trừ tiền hốt)" value={formatVND(line.feeAmount)} />}{line.profitAmount > 0 && <InfoRow label="Lợi hụi" value={formatVND(line.profitAmount)} />}</div></div>)}</div>
        <div className="border-t bg-muted/20 p-4 sm:p-5"><div className="space-y-2 text-sm"><TotalRow label="Lợi hụi chân sống" value={receipt.totalProfit} /><TotalRow label="Tổng tiền đóng hụi" value={receipt.totalPay} /><TotalRow label="Tổng hốt hụi" value={receipt.totalReceive} /><TotalRow label="Tiền thảo chủ hụi giữ" value={receipt.totalFee} /><TotalRow label="Tất toán / điều chỉnh" value={receipt.settlementAmount} signed /><TotalRow label="Đã thu / chi" value={receipt.paidAmount} /></div><div className="mt-4 border-t pt-4 text-center"><p className="text-sm font-bold uppercase">{receipt.status === "cancelled" ? "Phiếu đã hủy" : receipt.remainingAmount <= 0 ? "Đã thanh toán đủ" : receipt.direction === "collect" ? "Hụi viên còn phải đóng cho chủ hụi" : receipt.direction === "pay" ? "Chủ hụi còn phải giao cho hụi viên" : "Phiếu đã cân bằng"}</p><p className="mt-1 text-2xl font-black">{formatVND(receipt.remainingAmount)}</p></div></div>
        {qrUrl && receipt.status !== "cancelled" && <div className="border-t p-4 text-center sm:p-5"><p className="font-semibold">Quét QR để đóng đúng số tiền còn lại</p><p className="mt-1 text-xs text-muted-foreground">{settings.bank_name} · {settings.bank_account_number}</p><img src={qrUrl} alt={`QR đóng hụi ${receipt.member.full_name}`} className="mx-auto mt-3 w-full max-w-[320px] rounded-lg border" /><p className="mt-2 text-xs text-muted-foreground">Nội dung: {transferText(settings, receipt, date)}</p></div>}
      </Card>
      {receipt.status !== "cancelled" && <Card className="space-y-3 p-4"><h3 className="font-semibold">Thao tác phiếu</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Button variant="outline" onClick={onShare} disabled={working}><Share2 className="size-4" />Gửi Zalo</Button>{receipt.direction !== "balanced" && receipt.remainingAmount > 0 && <><Button onClick={onFull} disabled={working}><CheckCheck className="size-4" />{receipt.direction === "collect" ? "Đã thu đủ" : "Đã chi đủ"}</Button><Button variant="outline" onClick={onPartial} disabled={working}><CircleDollarSign className="size-4" />{receipt.direction === "collect" ? "Thu một phần" : "Chi một phần"}</Button></>}<Button variant="outline" onClick={onEdit} disabled={working}><Pencil className="size-4" />Sửa / điều chỉnh</Button><Button variant="outline" className="text-destructive" onClick={onCancel} disabled={working}><Ban className="size-4" />Hủy phiếu</Button></div><p className="text-xs leading-relaxed text-muted-foreground">Nếu sai giá thăm, người hốt hoặc mệnh giá, hãy sửa tại kỳ hụi gốc. Sửa/điều chỉnh ở đây dành cho tất toán hoặc điều chỉnh vận hành và luôn lưu lịch sử.</p></Card>}
      <Card className="p-4"><div className="flex items-center gap-2"><History className="size-4" /><h3 className="font-semibold">Lịch sử thu / chi</h3></div>{receipt.payments.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Chưa có giao dịch nào.</p> : <div className="mt-3 space-y-2">{receipt.payments.map((p) => <div key={p.id} className={`rounded-md border p-3 text-sm ${p.status === "cancelled" ? "opacity-50" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{p.direction === "collect" ? "Thu" : "Chi"} {formatVND(Number(p.amount))}</p><p className="text-xs text-muted-foreground">{paymentMethodLabel(p.method)} · {new Date(p.created_at).toLocaleString("vi-VN")}</p>{p.note && <p className="mt-1 text-xs">{p.note}</p>}{p.status === "cancelled" && <p className="mt-1 text-xs text-destructive">Đã hủy: {p.cancel_reason || "Không ghi lý do"}</p>}</div>{p.status === "active" && <Button variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => onCancelPayment(p)} disabled={working}><Undo2 className="size-4" />Hủy</Button>}</div></div>)}</div>}</Card>
    </div>
  )
}
