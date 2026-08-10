"use client"

import { FormEvent, useEffect, useState } from "react"
import { LoaderCircle, Save, Settings2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type SettingsRow = {
  id: number
  owner_name: string
  owner_phone: string
  bank_id: string
  bank_name: string
  bank_account_number: string
  bank_account_name: string
  transfer_prefix: string
}

const EMPTY_SETTINGS: SettingsRow = {
  id: 1,
  owner_name: "",
  owner_phone: "",
  bank_id: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  transfer_prefix: "HUI",
}

export function CaiDatPage() {
  const [form, setForm] = useState<SettingsRow>(EMPTY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => { void loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    setError("")
    const { data, error } = await createClient()
      .from("app_settings")
      .select("id, owner_name, owner_phone, bank_id, bank_name, bank_account_number, bank_account_name, transfer_prefix")
      .eq("id", 1)
      .maybeSingle()

    if (error) {
      console.error(error)
      setError("Chưa tải được Cài đặt. Hãy chắc chắn bạn đã chạy file SQL tạo bảng.")
    } else if (data) {
      setForm(data as SettingsRow)
    }
    setLoading(false)
  }

  function setField(key: keyof SettingsRow, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage("")
    setError("")

    const payload = {
      id: 1,
      owner_name: form.owner_name.trim(),
      owner_phone: form.owner_phone.trim(),
      bank_id: form.bank_id.trim(),
      bank_name: form.bank_name.trim(),
      bank_account_number: form.bank_account_number.replace(/\s/g, ""),
      bank_account_name: form.bank_account_name.trim(),
      transfer_prefix: form.transfer_prefix.trim() || "HUI",
      updated_at: new Date().toISOString(),
    }

    const { error } = await createClient().from("app_settings").upsert(payload, { onConflict: "id" })
    if (error) {
      console.error(error)
      setError("Không thể lưu cài đặt.")
    } else {
      setMessage("Đã lưu cài đặt.")
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin" />Đang tải cài đặt...</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2"><Settings2 className="size-5" /><h1 className="text-xl font-bold">Cài đặt</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Thông tin này sẽ được dùng trên phiếu và mã QR nhận tiền.</p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold">Thông tin chủ hụi</h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Họ và tên<Input value={form.owner_name} onChange={(e) => setField("owner_name", e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Số điện thoại<Input value={form.owner_phone} onChange={(e) => setField("owner_phone", e.target.value)} placeholder="090..." /></label>
        </Card>

        <Card className="space-y-4 p-4">
          <div><h2 className="font-semibold">Tài khoản nhận tiền</h2><p className="mt-1 text-xs text-muted-foreground">Mã ngân hàng có thể dùng BIN hoặc mã viết tắt VietQR, ví dụ 970436 hoặc VCB.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">Tên ngân hàng<Input value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} placeholder="Vietcombank" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">Mã ngân hàng / BIN<Input value={form.bank_id} onChange={(e) => setField("bank_id", e.target.value)} placeholder="VCB hoặc 970436" /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Số tài khoản<Input value={form.bank_account_number} onChange={(e) => setField("bank_account_number", e.target.value)} placeholder="Số tài khoản nhận tiền" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Tên chủ tài khoản<Input value={form.bank_account_name} onChange={(e) => setField("bank_account_name", e.target.value)} placeholder="NGUYEN VAN A" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Tiền tố nội dung chuyển khoản<Input value={form.transfer_prefix} onChange={(e) => setField("transfer_prefix", e.target.value)} placeholder="HUI" /></label>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm font-medium text-status-green-fg">{message}</p>}
        <Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Lưu cài đặt</Button>
      </form>
    </div>
  )
}
