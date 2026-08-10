import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  authPasswordFromPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function adminClient() {
  if (!url) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL")
  if (!serviceRoleKey) throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY")

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireSuperAdmin(request: NextRequest) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token) return { error: "Thiếu phiên đăng nhập.", status: 401 as const }

  const supabase = adminClient()
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return { error: "Phiên đăng nhập không hợp lệ.", status: 401 as const }
  }

  const { data: profile } = await supabase
    .from("app_users")
    .select("role, is_active")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  if (!profile || !profile.is_active || profile.role !== "super_admin") {
    return { error: "Chỉ super admin được phép thao tác.", status: 403 as const }
  }

  return { supabase, user: authData.user }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await auth.supabase
      .from("app_users")
      .select(
        "auth_user_id, email, phone, display_name, role, member_id, is_active, created_at, updated_at",
      )
      .order("display_name")

    if (error) throw error
    return NextResponse.json({ users: data ?? [] })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Không thể tải danh sách tài khoản." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const phone = normalizeVietnamPhone(String(body.phone ?? ""))
    const displayName = String(body.display_name ?? "").trim()
    const role = String(body.role ?? "")
    const memberId = body.member_id ? String(body.member_id) : null

    if (!displayName) {
      return NextResponse.json({ error: "Tên hiển thị là bắt buộc." }, { status: 400 })
    }
    if (!["super_admin", "admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Vai trò không hợp lệ." }, { status: 400 })
    }
    if (role === "member" && !memberId) {
      return NextResponse.json(
        { error: "Tài khoản hụi viên phải liên kết với một hụi viên." },
        { status: 400 },
      )
    }

    const { data: created, error: createError } =
      await auth.supabase.auth.admin.createUser({
        phone,
        password: authPasswordFromPin("0000"),
        phone_confirm: true,
        user_metadata: { display_name: displayName },
      })

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Không thể tạo tài khoản." },
        { status: 400 },
      )
    }

    const { error: profileError } = await auth.supabase.from("app_users").insert({
      auth_user_id: created.user.id,
      email: null,
      phone,
      display_name: displayName,
      role,
      member_id: memberId,
      is_active: true,
    })

    if (profileError) {
      await auth.supabase.auth.admin.deleteUser(created.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, default_pin: "0000" })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể tạo tài khoản." },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const userId = String(body.auth_user_id ?? "")
    const action = String(body.action ?? "")

    if (!userId) {
      return NextResponse.json({ error: "Thiếu user id." }, { status: 400 })
    }

    if (action === "migrate_self_to_phone") {
      if (userId !== auth.user.id) {
        return NextResponse.json(
          { error: "Chỉ được chuyển tài khoản đang đăng nhập." },
          { status: 400 },
        )
      }

      const phone = normalizeVietnamPhone(String(body.phone ?? ""))
      const pin = String(body.pin ?? "")

      const { error: authUpdateError } =
        await auth.supabase.auth.admin.updateUserById(userId, {
          phone,
          phone_confirm: true,
          password: authPasswordFromPin(pin),
        })
      if (authUpdateError) throw authUpdateError

      const { error: profileUpdateError } = await auth.supabase
        .from("app_users")
        .update({
          phone,
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", userId)

      if (profileUpdateError) throw profileUpdateError

      return NextResponse.json({ ok: true, phone })
    }

    if (action === "reset_pin") {
      const { error } = await auth.supabase.auth.admin.updateUserById(userId, {
        password: authPasswordFromPin("0000"),
      })
      if (error) throw error
      return NextResponse.json({ ok: true, pin: "0000" })
    }

    if (action === "update_profile") {
      const role = String(body.role ?? "")
      const memberId = body.member_id ? String(body.member_id) : null
      const displayName = String(body.display_name ?? "").trim()
      const isActive = Boolean(body.is_active)

      if (!["super_admin", "admin", "member"].includes(role)) {
        return NextResponse.json({ error: "Vai trò không hợp lệ." }, { status: 400 })
      }
      if (role === "member" && !memberId) {
        return NextResponse.json({ error: "Hụi viên phải có member_id." }, { status: 400 })
      }

      const { error } = await auth.supabase
        .from("app_users")
        .update({
          display_name: displayName,
          role,
          member_id: memberId,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("auth_user_id", userId)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Action không hợp lệ." }, { status: 400 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Không thể cập nhật tài khoản." },
      { status: 500 },
    )
  }
}
