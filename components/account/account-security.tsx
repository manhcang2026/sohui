"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  displayVietnamPhone,
  isFourDigitPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/hui-design"

type AppRole = "super_admin" | "admin" | "member"

type CurrentProfile = {
  auth_user_id: string
  email: string | null
  phone: string | null
  display_name: string | null
  role: AppRole
  member_id: string | null
  is_active: boolean
}

type MemberOption = {
  id: string
  full_name: string
  phone: string | null
}

type ManagedUser = CurrentProfile & {
  created_at: string
  updated_at: string
}

type MemberDeletePreflight = {
  member: MemberOption
  counts: {
    hui_shares: number
    hui_receipts: number
    receipt_payments: number
    receipts: number
    transactions: number
    app_users: number
    profiles: number
  }
  has_business_history: boolean
  has_login_link: boolean
  member_delete_enabled: false
  member_delete_blocker: string
}

export function AccountSecurity() {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [members, setMembers] = useState<MemberOption[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const isSuper = profile?.role === "super_admin"

  async function getAccessToken() {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token ?? ""
  }

  async function loadAll() {
    setLoading(true)
    setError("")

    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData.user

    if (!authUser) {
      setError("Không tìm thấy phiên đăng nhập.")
      setLoading(false)
      return
    }

    const [{ data: profileData, error: profileError }, { data: memberData }] =
      await Promise.all([
        supabase
          .from("app_users")
          .select("auth_user_id, email, phone, display_name, role, member_id, is_active")
          .eq("auth_user_id", authUser.id)
          .maybeSingle(),
        supabase.from("members").select("id, full_name, phone").order("full_name"),
      ])

    if (profileError || !profileData) {
      setError("Tài khoản chưa có role.")
      setLoading(false)
      return
    }

    const nextProfile = profileData as CurrentProfile
    setProfile(nextProfile)
    setMembers((memberData ?? []) as MemberOption[])

    if (nextProfile.role === "super_admin") {
      const token = await getAccessToken()
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (response.ok) setUsers((result.users ?? []) as ManagedUser[])
      else setError(result.error ?? "Không tải được danh sách tài khoản.")
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [])

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải tài khoản...
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {profile?.phone && (
        <ChangePinCard
          profile={profile}
          onChanged={(text) => {
            setMessage(text)
            setError("")
          }}
          onError={(text) => {
            setError(text)
            setMessage("")
          }}
        />
      )}

      {isSuper && (
        <SuperAdminUsers
          currentUserId={profile?.auth_user_id ?? ""}
          users={users}
          members={members}
          onReload={() => void loadAll()}
          onMessage={(text) => {
            setMessage(text)
            setError("")
          }}
          onError={(text) => {
            setError(text)
            setMessage("")
          }}
        />
      )}

      {message && <p className="text-sm font-medium text-status-green-fg">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function ChangePinCard({
  profile,
  onChanged,
  onError,
}: {
  profile: CurrentProfile
  onChanged: (message: string) => void
  onError: (message: string) => void
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-primary" />
        <div>
          <h2 className="font-semibold">Mã đăng nhập 4 số</h2>
          <p className="text-xs text-muted-foreground">
            {displayVietnamPhone(profile.phone)}
          </p>
        </div>
      </div>

      <ChangePinForm
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onChanged={onChanged}
        onError={onError}
      />
    </Card>
  )
}

export function ChangePinForm({
  onChanged,
  onError,
  className = "grid gap-3",
}: {
  onChanged: (message: string) => void
  onError: (message: string) => void
  className?: string
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isFourDigitPin(pin)) return onError("Mã mới phải gồm đúng 4 số.")
    if (pin !== confirmPin) return onError("Hai lần nhập mã chưa giống nhau.")

    setSaving(true)

    try {
      const { data } = await createClient().auth.getSession()
      const accessToken = data.session?.access_token ?? ""

      const response = await fetch("/api/account/change-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ pin }),
      })
      const result = await response.json()

      if (!response.ok) {
        onError(result.error ?? "Không thể đổi mã 4 số.")
        return
      }

      setPin("")
      setConfirmPin("")
      onChanged("Đã đổi mã đăng nhập 4 số.")
    } catch (caught) {
      onError(
        caught instanceof Error
          ? caught.message
          : "Không thể đổi mã 4 số.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
      <form className={className} onSubmit={submit}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Mã mới
          <Input inputMode="numeric" type="password" maxLength={4} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nhập lại
          <Input inputMode="numeric" type="password" maxLength={4} value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircle className="size-4 animate-spin" />}
          Đổi mã
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-full">
          Nếu quên mã, liên hệ super admin để reset về 0000.
        </p>
      </form>
  )
}

function SuperAdminUsers({
  currentUserId,
  users,
  members,
  onReload,
  onMessage,
  onError,
}: {
  currentUserId: string
  users: ManagedUser[]
  members: MemberOption[]
  onReload: () => void
  onMessage: (message: string) => void
  onError: (message: string) => void
}) {
  const [phone, setPhone] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<AppRole>("member")
  const [memberId, setMemberId] = useState("")
  const [workingId, setWorkingId] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)

  const suggestedPhone = useMemo(() => {
    if (!memberId) return ""
    return members.find((m) => m.id === memberId)?.phone ?? ""
  }, [memberId, members])

  useEffect(() => {
    if (suggestedPhone) setPhone(suggestedPhone)
  }, [suggestedPhone])

  async function token() {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token ?? ""
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)

    try {
      const normalizedPhone = normalizeVietnamPhone(phone)
      const accessToken = await token()
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          display_name: displayName,
          role,
          member_id: memberId || null,
        }),
      })
      const result = await response.json()

      if (!response.ok) return onError(result.error ?? "Không thể tạo tài khoản.")

      setPhone("")
      setDisplayName("")
      setRole("member")
      setMemberId("")
      onMessage("Đã tạo tài khoản. Mã mặc định: 0000.")
      onReload()
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không thể tạo tài khoản.")
    } finally {
      setCreating(false)
    }
  }

  async function resetPin(user: ManagedUser) {
    const confirmed = window.confirm(
      `Reset mã đăng nhập của ${user.display_name || displayVietnamPhone(user.phone)} về 0000?`,
    )
    if (!confirmed) return
    setWorkingId(user.auth_user_id)

    const accessToken = await token()
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ auth_user_id: user.auth_user_id, action: "reset_pin" }),
    })
    const result = await response.json()
    setWorkingId("")

    if (!response.ok) return onError(result.error ?? "Không reset được mã.")
    onMessage(`Đã reset ${user.display_name || displayVietnamPhone(user.phone)} về 0000.`)
  }

  async function updateUser(user: ManagedUser, next: Partial<ManagedUser>) {
    setWorkingId(user.auth_user_id)
    const accessToken = await token()
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_user_id: user.auth_user_id,
        action: "update_profile",
        display_name: next.display_name ?? user.display_name ?? displayVietnamPhone(user.phone),
        role: next.role ?? user.role,
        member_id: next.member_id !== undefined ? next.member_id : user.member_id,
        is_active: next.is_active !== undefined ? next.is_active : user.is_active,
      }),
    })
    const result = await response.json()
    setWorkingId("")

    if (!response.ok) return onError(result.error ?? "Không cập nhật được tài khoản.")
    onMessage("Đã cập nhật phân quyền.")
    onReload()
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Shield className="size-5" />
        <div>
          <h2 className="font-semibold">Tài khoản & phân quyền</h2>
          <p className="text-xs text-muted-foreground">Tất cả tài khoản dùng SĐT + PIN 4 số.</p>
        </div>
      </div>

      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createAccount}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Liên kết hụi viên
          <select
            required={role === "member"}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">Không liên kết</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}{member.phone ? ` — ${member.phone}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Số điện thoại đăng nhập
          <Input
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxx"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tên hiển thị
          <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Vai trò
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
          >
            <option value="member">Hụi viên</option>
            <option value="admin">Admin vận hành</option>
          </select>
        </label>

        <div className="md:col-span-2">
          <Button type="submit" disabled={creating}>
            {creating ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Tạo tài khoản — mã 0000
          </Button>
        </div>
      </form>

      <div className="mt-5 border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Danh sách tài khoản</p>
          <Button variant="outline" size="sm" onClick={onReload}>
            <RefreshCw className="size-4" />Làm mới
          </Button>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Tài khoản</th>
                <th className="px-3 py-2 text-left">Vai trò</th>
                <th className="px-3 py-2 text-left">Hụi viên liên kết</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.auth_user_id}>
                  <td className="px-3 py-3">
                    <p className="font-medium">{user.display_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.phone ? displayVietnamPhone(user.phone) : "Chưa chuyển sang SĐT"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-9 rounded-md border bg-background px-2"
                      value={user.role}
                      disabled={workingId === user.auth_user_id || user.role === "super_admin"}
                      onChange={(e) => void updateUser(user, { role: e.target.value as AppRole })}
                    >
                      <option value="super_admin">Super admin</option>
                      <option value="admin">Admin</option>
                      <option value="member">Hụi viên</option>
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-9 min-w-[180px] rounded-md border bg-background px-2"
                      value={user.member_id ?? ""}
                      disabled={workingId === user.auth_user_id || user.role === "super_admin"}
                      onChange={(e) => void updateUser(user, { member_id: e.target.value || null })}
                    >
                      <option value="">Không liên kết</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{member.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={user.role === "super_admin" || workingId === user.auth_user_id}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void updateUser(user, { is_active: !user.is_active })}
                    >
                      {user.is_active ? "Hoạt động" : "Khóa"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!user.phone || workingId === user.auth_user_id}
                        onClick={() => void resetPin(user)}
                      >
                        {workingId === user.auth_user_id ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        Reset 0000
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        title={
                          user.auth_user_id === currentUserId
                            ? "Không thể tự xóa tài khoản đang đăng nhập"
                            : user.role === "super_admin"
                              ? "Không thể xóa super admin bằng thao tác thông thường"
                              : "Mở lựa chọn xóa tài khoản và kiểm tra hồ sơ"
                        }
                        disabled={
                          user.auth_user_id === currentUserId ||
                          user.role === "super_admin" ||
                          workingId === user.auth_user_id
                        }
                        onClick={() => setDeleteTarget(user)}
                      >
                        <Trash2 className="size-4" />
                        Xóa...
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteAccountDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(message) => {
          setDeleteTarget(null)
          onMessage(message)
          onReload()
        }}
      />
    </Card>
  )
}

function DeleteAccountDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: ManagedUser | null
  onClose: () => void
  onDeleted: (message: string) => void
}) {
  const [preflight, setPreflight] = useState<MemberDeletePreflight | null>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPreflight(null)
    setReason("")
    setConfirmation("")
    setError("")

    if (!target?.member_id) return

    const targetMemberId = target.member_id
    let active = true
    setLoadingPreflight(true)

    async function loadPreflight() {
      try {
        const { data } = await createClient().auth.getSession()
        const accessToken = data.session?.access_token ?? ""
        const response = await fetch(
          `/api/admin/users?member_id=${encodeURIComponent(targetMemberId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error ?? "Không kiểm tra được hồ sơ.")
        }
        if (active) setPreflight(result as MemberDeletePreflight)
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Không kiểm tra được hồ sơ.",
          )
        }
      } finally {
        if (active) setLoadingPreflight(false)
      }
    }

    void loadPreflight()
    return () => {
      active = false
    }
  }, [target])

  if (!target) return null

  const targetUserId = target.auth_user_id
  const displayName =
    target.display_name || displayVietnamPhone(target.phone)
  const targetPhone = target.phone
    ? displayVietnamPhone(target.phone)
    : "Chưa có số điện thoại"
  let normalizedTargetPhone = ""
  if (target.phone) {
    try {
      normalizedTargetPhone = normalizeVietnamPhone(target.phone)
    } catch {
      normalizedTargetPhone = ""
    }
  }
  const hasLegacyInvalidPhone = Boolean(target.phone) && !normalizedTargetPhone
  let confirmationMatchesPhone = false
  if (normalizedTargetPhone && confirmation.trim()) {
    try {
      confirmationMatchesPhone =
        normalizeVietnamPhone(confirmation) === normalizedTargetPhone
    } catch {
      confirmationMatchesPhone = false
    }
  }
  const confirmationValid =
    confirmation.trim() === "XOA" ||
    confirmationMatchesPhone
  const canDeleteLogin =
    reason.trim().length >= 5 && confirmationValid

  async function deleteLoginAccount() {
    if (deleting || !canDeleteLogin) return
    setDeleting(true)
    setError("")

    try {
      const { data } = await createClient().auth.getSession()
      const accessToken = data.session?.access_token ?? ""
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          auth_user_id: targetUserId,
          reason,
          confirmation,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ?? "Không thể xóa tài khoản đăng nhập.",
        )
      }

      onDeleted(
        result.audit_warning
          ? `Đã xóa tài khoản đăng nhập. ${result.audit_warning}`
          : "Đã xóa tài khoản đăng nhập; hồ sơ hụi viên và lịch sử tiền được giữ nguyên.",
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xóa tài khoản đăng nhập.",
      )
    } finally {
      setDeleting(false)
    }
  }

  const dependencyRows = preflight
    ? ([
        ["Chân hụi", preflight.counts.hui_shares],
        ["Phiếu thu/chi", preflight.counts.hui_receipts],
        ["Khoản đã thu/chi", preflight.counts.receipt_payments],
        ["Phiếu cũ", preflight.counts.receipts],
        ["Giao dịch cũ", preflight.counts.transactions],
        [
          "Liên kết đăng nhập",
          preflight.counts.app_users + preflight.counts.profiles,
        ],
      ] as const)
    : []

  return (
    <Dialog open onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý xóa tài khoản và hồ sơ</DialogTitle>
          <DialogDescription>
            Hai thao tác dưới đây có phạm vi hoàn toàn khác nhau. Hãy đọc kỹ
            trước khi xác nhận.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary p-3">
          <p className="font-bold">{displayName}</p>
          <p className="text-sm text-muted-foreground">{targetPhone}</p>
        </div>

        <section className="rounded-lg border border-danger/25 bg-danger-soft p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <h3 className="font-bold text-danger">
                Xóa tài khoản đăng nhập
              </h3>
              <p className="mt-1 text-sm leading-relaxed">
                Người này sẽ không đăng nhập được nữa. Hồ sơ hụi viên, chân
                hụi, phiếu và toàn bộ lịch sử tiền vẫn được giữ. Nếu chỉ muốn
                ngăn truy cập tạm thời, hãy đóng dialog và dùng “Khóa tài
                khoản”.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Lý do bắt buộc
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {hasLegacyInvalidPhone
                ? "Gõ XOA để xác nhận"
                : "Gõ XOA hoặc đúng số điện thoại"}
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
              {hasLegacyInvalidPhone && (
                <span className="text-xs font-normal text-muted-foreground">
                  Số điện thoại cũ không hợp lệ nên không thể dùng để xác nhận.
                </span>
              )}
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">Xóa hồ sơ hụi viên</h3>
              <p className="text-sm text-muted-foreground">
                Chỉ dành cho hồ sơ hoàn toàn chưa phát sinh nghiệp vụ.
              </p>
            </div>
            <StatusBadge label="Chưa bật" tone="warning" />
          </div>

          {!target.member_id ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Tài khoản này không liên kết hồ sơ hụi viên.
            </p>
          ) : loadingPreflight ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Đang kiểm tra phụ thuộc bằng truy vấn đếm chính xác...
            </p>
          ) : preflight ? (
            <>
              <div className="mt-3 overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {dependencyRows.map(([label, count]) => (
                      <tr key={label}>
                        <td className="px-3 py-2 text-muted-foreground">
                          {label}
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm font-medium text-warning-foreground">
                {preflight.member_delete_blocker}
              </p>
              {preflight.has_business_history && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Không xóa lịch sử. Có thể khóa tài khoản, ngừng sử dụng hồ
                  sơ cho nghiệp vụ mới, hoặc chỉ xóa cổng đăng nhập.
                </p>
              )}
            </>
          ) : null}

          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled
            title="Chờ RPC atomic fail-closed được review và triển khai"
          >
            <Trash2 className="size-4" />
            Xóa hồ sơ hụi viên
          </Button>
        </section>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Đóng
          </Button>
          <Button
            variant="destructive"
            disabled={!canDeleteLogin || deleting}
            onClick={() => void deleteLoginAccount()}
          >
            {deleting ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Xóa tài khoản đăng nhập
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
