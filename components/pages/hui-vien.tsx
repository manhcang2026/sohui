"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { LoaderCircle, Pencil, Plus, Search, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

export type Member = {
  id: string
  full_name: string
  phone: string | null
  zalo_phone: string | null
  address: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type MemberForm = Omit<Member, "id" | "created_at" | "updated_at">

const EMPTY_FORM: MemberForm = {
  full_name: "",
  phone: "",
  zalo_phone: "",
  address: "",
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  notes: "",
  is_active: true,
}

export function HuiVienPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<Member | null | undefined>(undefined)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError("")
    const { data, error: loadError } = await createClient()
      .from("members")
      .select("id, full_name, phone, zalo_phone, address, bank_name, bank_account_number, bank_account_name, notes, is_active, created_at, updated_at")
      .order("full_name")

    if (loadError) setError("Không thể tải danh sách hụi viên. Vui lòng thử lại.")
    else setMembers((data ?? []) as Member[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    if (!normalized) return members
    return members.filter((member) =>
      member.full_name.toLocaleLowerCase("vi").includes(normalized) ||
      (member.phone ?? "").includes(normalized)
    )
  }, [members, query])

  async function toggleActive(member: Member) {
    setError("")
    const nextActive = !member.is_active
    const { error: updateError } = await createClient()
      .from("members")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", member.id)

    if (updateError) {
      setError("Không thể cập nhật trạng thái hụi viên.")
      return
    }
    setMembers((current) => current.map((item) => item.id === member.id ? { ...item, is_active: nextActive } : item))
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hụi viên</h1>
          <p className="text-sm text-muted-foreground">{members.length} người</p>
        </div>
        <Button onClick={() => setEditing(null)}><Plus className="size-4" />Thêm hụi viên</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Tìm hụi viên" placeholder="Tìm theo tên hoặc SĐT..." value={query} onChange={(event) => setQuery(event.target.value)} className="h-9 pl-9" />
      </div>

      {error && (
        <Card className="flex items-center justify-between gap-3 border-destructive/30 p-4 text-sm text-destructive" role="alert">
          <span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadMembers()}>Thử lại</Button>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-5 animate-spin" />Đang tải hụi viên...</div>
      ) : filteredMembers.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <UserRound className="size-8 text-muted-foreground" />
          <p className="font-medium">{query ? "Không tìm thấy hụi viên" : "Chưa có hụi viên"}</p>
          <p className="text-sm text-muted-foreground">{query ? "Thử tìm bằng tên hoặc số điện thoại khác." : "Thêm hụi viên đầu tiên để bắt đầu."}</p>
        </Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>{["Họ tên", "Điện thoại", "Số Zalo", "Ngân hàng", "Trạng thái", "Thao tác"].map((heading) => <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{member.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.zalo_phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.bank_name || "—"}</td>
                    <td className="px-4 py-3"><button onClick={() => void toggleActive(member)} className={member.is_active ? "rounded-full bg-status-green-bg px-2 py-1 text-xs font-medium text-status-green-fg" : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"}>{member.is_active ? "Hoạt động" : "Tạm ngưng"}</button></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => setEditing(member)}><Pencil className="size-4" />Sửa</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="flex flex-col gap-2 md:hidden">
            {filteredMembers.map((member) => (
              <Card key={member.id} className="p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{member.full_name}</p><p className="text-sm text-muted-foreground">{member.phone || "Chưa có SĐT"}</p></div><Button variant="ghost" size="icon" onClick={() => setEditing(member)} aria-label={`Sửa ${member.full_name}`}><Pencil className="size-4" /></Button></div>
                <button onClick={() => void toggleActive(member)} className={`mt-3 rounded-full px-2 py-1 text-xs font-medium ${member.is_active ? "bg-status-green-bg text-status-green-fg" : "bg-muted text-muted-foreground"}`}>{member.is_active ? "Hoạt động" : "Tạm ngưng"}</button>
              </Card>
            ))}
          </div>
        </>
      )}

      {editing !== undefined && <MemberDialog member={editing} onClose={() => setEditing(undefined)} onSaved={(saved) => { setMembers((current) => editing ? current.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")) : [...current, saved].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"))); setEditing(undefined) }} />}
    </div>
  )
}

function MemberDialog({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: (member: Member) => void }) {
  const [form, setForm] = useState<MemberForm>(member ? { full_name: member.full_name, phone: member.phone ?? "", zalo_phone: member.zalo_phone ?? "", address: member.address ?? "", bank_name: member.bank_name ?? "", bank_account_number: member.bank_account_number ?? "", bank_account_name: member.bank_account_name ?? "", notes: member.notes ?? "", is_active: member.is_active } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const setField = (field: keyof MemberForm, value: string | boolean) => setForm((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.full_name.trim()) { setError("Họ tên là bắt buộc."); return }
    setSaving(true); setError("")
    const payload = { ...form, full_name: form.full_name.trim(), updated_at: new Date().toISOString() }
    const query = member ? createClient().from("members").update(payload).eq("id", member.id) : createClient().from("members").insert(payload)
    const { data, error: saveError } = await query.select().single()
    if (saveError) { setError("Không thể lưu hụi viên. Vui lòng kiểm tra và thử lại."); setSaving(false); return }
    onSaved(data as Member)
  }

  const fields: { key: keyof MemberForm; label: string; required?: boolean }[] = [
    { key: "full_name", label: "Họ tên", required: true }, { key: "phone", label: "Điện thoại" }, { key: "zalo_phone", label: "Số Zalo" }, { key: "address", label: "Địa chỉ" }, { key: "bank_name", label: "Ngân hàng" }, { key: "bank_account_number", label: "Số tài khoản" }, { key: "bank_account_name", label: "Tên chủ tài khoản" }, { key: "notes", label: "Ghi chú" },
  ]

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
      <div className="flex items-center justify-between"><h2 id="member-dialog-title" className="text-lg font-bold">{member ? "Sửa hụi viên" : "Thêm hụi viên"}</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X className="size-4" /></Button></div>
      <form className="mt-4 flex flex-col gap-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">{fields.map((field) => <label key={field.key} className={field.key === "address" || field.key === "notes" ? "flex flex-col gap-1.5 text-sm font-medium md:col-span-2" : "flex flex-col gap-1.5 text-sm font-medium"}>{field.label}{field.required && <span className="sr-only">bắt buộc</span>}<Input required={field.required} value={String(form[field.key] ?? "")} onChange={(event) => setField(field.key, event.target.value)} /></label>)}</div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setField("is_active", event.target.checked)} className="size-4 accent-primary" />Đang hoạt động</label>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Hủy</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="size-4 animate-spin" />}Lưu</Button></div>
      </form>
    </Card>
  </div>
}
