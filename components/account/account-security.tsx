"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import {
  KeyRound,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  UserPlus,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  authPasswordFromPin,
  displayVietnamPhone,
  isFourDigitPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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
      {isSuper && !profile?.phone && (
        <MigrateSelfToPhone
          profile={profile}
          onSuccess={(text) => {
            setMessage(text)
            setError("")
            void loadAll()
          }}
          onError={(text) => {
            setError(text)
            setMessage("")
          }}
        />
      )}

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

function MigrateSelfToPhone({
  profile,
  onSuccess,
  onError,
}: {
  profile: CurrentProfile
  onSuccess: (message: string) => void
  onError: (message: string) => void
}) {
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isFourDigitPin(pin)) {
      onError("PIN mới phải gồm đúng 4 số.")
      return
    }

    setSaving(true)
    try {
      const normalizedPhone = normalizeVietnamPhone(phone)
      const { data } = await createClient().auth.getSession()
      const token = data.session?.access_token ?? ""

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auth_user_id: profile.auth_user_id,
          action: "migrate_self_to_phone",
          phone: normalizedPhone,
          pin,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        onError(result.error ?? "Không chuyển được tài khoản sang SĐT.")
        return
      }

      onSuccess(
        `Đã gắn SĐT ${displayVietnamPhone(result.phone)}. Hãy logout rồi đăng nhập lại bằng SĐT + PIN mới.`,
      )
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Không chuyển được tài khoản.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-primary/30 p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="size-5" />
        <div>
          <h2 className="font-semibold">Chuyển tài khoản của bạn sang SĐT</h2>
          <p className="text-xs text-muted-foreground">
            Tài khoản hiện tại vẫn đang là {profile.email}. Làm bước này một lần.
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          SĐT của bạn
          <Input
            inputMode="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="09xxxxxxxx"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          PIN mới 4 số
          <Input
            inputMode="numeric"
            type="password"
            maxLength={4}
            required
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>

        <Button type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
          Chuyển sang SĐT
        </Button>
      </form>
    </Card>
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
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isFourDigitPin(pin)) return onError("Mã mới phải gồm đúng 4 số.")
    if (pin !== confirmPin) return onError("Hai lần nhập mã chưa giống nhau.")

    setSaving(true)
    const { error } = await createClient().auth.updateUser({
      password: authPasswordFromPin(pin),
    })
    setSaving(false)

    if (error) return onError("Không thể đổi mã 4 số.")
    setPin("")
    setConfirmPin("")
    onChanged("Đã đổi mã đăng nhập 4 số.")
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5" />
        <div>
          <h2 className="font-semibold">Mã đăng nhập 4 số</h2>
          <p className="text-xs text-muted-foreground">
            {displayVietnamPhone(profile.phone)}
          </p>
        </div>
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
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
        <Button type="submit" disabled={saving}>Đổi mã</Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Nếu quên mã, liên hệ super admin để reset về 0000.
      </p>
    </Card>
  )
}

function SuperAdminUsers({
  users,
  members,
  onReload,
  onMessage,
  onError,
}: {
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
            <option value="super_admin">Super admin</option>
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
                      disabled={workingId === user.auth_user_id}
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
                      disabled={workingId === user.auth_user_id}
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
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                      onClick={() => void updateUser(user, { is_active: !user.is_active })}
                    >
                      {user.is_active ? "Hoạt động" : "Khóa"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  )
}
