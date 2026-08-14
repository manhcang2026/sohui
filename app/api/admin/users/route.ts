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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function technicalEmailFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  return `${digits}@phone.sohui.app`
}

async function requireSuperAdmin(request: NextRequest) {
  const header = request.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : ""

  if (!token) {
    return { error: "Thiếu phiên đăng nhập.", status: 401 as const }
  }

  const supabase = adminClient()
  const { data: authData, error: authError } =
    await supabase.auth.getUser(token)

  if (authError || !authData.user) {
    return { error: "Phiên đăng nhập không hợp lệ.", status: 401 as const }
  }

  const { data: profile, error: profileError } = await supabase
    .from("app_users")
    .select("role, is_active")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle()

  if (
    profileError ||
    !profile ||
    !profile.is_active ||
    profile.role !== "super_admin"
  ) {
    return {
      error: "Chỉ super admin được phép thao tác.",
      status: 403 as const,
    }
  }

  return { supabase, user: authData.user }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const memberId = request.nextUrl.searchParams.get("member_id")

    if (memberId) {
      const { data: member, error: memberError } = await auth.supabase
        .from("members")
        .select("id, full_name, phone")
        .eq("id", memberId)
        .maybeSingle()

      if (memberError) throw memberError
      if (!member) {
        return NextResponse.json(
          { error: "Không tìm thấy hồ sơ hụi viên." },
          { status: 404 },
        )
      }

      const [
        shares,
        receipts,
        payments,
        legacyReceipts,
        legacyTransactions,
        appUsers,
        profiles,
      ] = await Promise.all([
        auth.supabase.from("hui_shares").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        auth.supabase.from("hui_receipts").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        auth.supabase
          .from("receipt_payments")
          .select("id, hui_receipts!inner(member_id)", { count: "exact", head: true })
          .eq("hui_receipts.member_id", memberId),
        auth.supabase.from("receipts").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        auth.supabase.from("transactions").select("id", { count: "exact", head: true }).eq("member_id", memberId),
        auth.supabase.from("app_users").select("auth_user_id", { count: "exact", head: true }).eq("member_id", memberId),
        auth.supabase.from("profiles").select("id", { count: "exact", head: true }).eq("member_id", memberId),
      ])

      const firstError = [
        shares.error,
        receipts.error,
        payments.error,
        legacyReceipts.error,
        legacyTransactions.error,
        appUsers.error,
        profiles.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const counts = {
        hui_shares: shares.count ?? 0,
        hui_receipts: receipts.count ?? 0,
        receipt_payments: payments.count ?? 0,
        receipts: legacyReceipts.count ?? 0,
        transactions: legacyTransactions.count ?? 0,
        app_users: appUsers.count ?? 0,
        profiles: profiles.count ?? 0,
      }

      const businessCount =
        counts.hui_shares +
        counts.hui_receipts +
        counts.receipt_payments +
        counts.receipts +
        counts.transactions

      return NextResponse.json({
        member,
        counts,
        has_business_history: businessCount > 0,
        has_login_link: counts.app_users > 0 || counts.profiles > 0,
        member_delete_enabled: false,
        member_delete_blocker:
          businessCount > 0
            ? "Hồ sơ đã có lịch sử nghiệp vụ nên không được xóa."
            : counts.app_users > 0 || counts.profiles > 0
              ? "Phải xóa tài khoản đăng nhập liên kết trước."
              : "Cần triển khai RPC atomic đã được duyệt trước khi bật xóa hồ sơ.",
      })
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const body = await request.json()
    const userId = String(body.auth_user_id ?? "")
    const reason = String(body.reason ?? "").trim()
    const confirmation = String(body.confirmation ?? "").trim()

    if (!userId) {
      return NextResponse.json({ error: "Thiếu user id." }, { status: 400 })
    }

    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "Không thể tự xóa tài khoản đang đăng nhập." },
        { status: 400 },
      )
    }

    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Lý do xóa phải có ít nhất 5 ký tự." },
        { status: 400 },
      )
    }

    const { data: target, error: targetError } = await auth.supabase
      .from("app_users")
      .select("auth_user_id, phone, display_name, role, member_id, is_active, created_at, updated_at")
      .eq("auth_user_id", userId)
      .maybeSingle()

    if (targetError) throw targetError

    if (!target) {
      const { data: priorAttempt } = await auth.supabase
        .from("audit_logs")
        .select("id, action")
        .eq("entity_type", "app_user")
        .eq("entity_id", userId)
        .in("action", ["delete_login_attempt", "delete_login_succeeded"])
        .limit(1)
        .maybeSingle()

      if (priorAttempt) {
        const { data: authTarget, error: authLookupError } =
          await auth.supabase.auth.admin.getUserById(userId)

        if (authLookupError) {
          if (
            authLookupError.code === "user_not_found" ||
            authLookupError.status === 404
          ) {
            return NextResponse.json({ ok: true, already_deleted: true })
          }

          return NextResponse.json(
            {
              error:
                "Không thể xác minh trạng thái Auth; đã dừng và chưa thực hiện thêm thao tác nào.",
            },
            { status: 503 },
          )
        }

        if (!authTarget.user) {
          return NextResponse.json(
            {
              error:
                "Auth không trả về người dùng hoặc lỗi xác nhận; đã dừng để tránh báo xóa thành công sai.",
            },
            { status: 502 },
          )
        }

        return NextResponse.json(
          {
            error:
              "Auth user vẫn tồn tại nhưng app_users bị thiếu; đã dừng để tránh xóa sai trạng thái.",
          },
          { status: 409 },
        )
      }

      return NextResponse.json(
        { error: "Tài khoản không còn tồn tại." },
        { status: 404 },
      )
    }

    if (target.role === "super_admin") {
      return NextResponse.json(
        { error: "Không thể xóa tài khoản super admin bằng thao tác thông thường." },
        { status: 400 },
      )
    }

    let normalizedTargetPhone = ""
    if (target.phone) {
      try {
        normalizedTargetPhone = normalizeVietnamPhone(target.phone)
      } catch {
        normalizedTargetPhone = ""
      }
    }
    let normalizedConfirmation = ""
    if (confirmation === "XOA") {
      normalizedConfirmation = "XOA"
    } else {
      try {
        normalizedConfirmation = normalizeVietnamPhone(confirmation)
      } catch {
        normalizedConfirmation = ""
      }
    }

    if (
      normalizedConfirmation !== "XOA" &&
      (!normalizedTargetPhone || normalizedConfirmation !== normalizedTargetPhone)
    ) {
      return NextResponse.json(
        { error: "Hãy gõ XOA hoặc đúng số điện thoại để xác nhận." },
        { status: 400 },
      )
    }

    const { data: legacyProfile, error: profileError } = await auth.supabase
      .from("profiles")
      .select("id, member_id, full_name, phone, role, is_active, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) throw profileError

    const { data: auditRow, error: auditError } = await auth.supabase
      .from("audit_logs")
      .insert({
        entity_type: "app_user",
        entity_id: userId,
        action: "delete_login_attempt",
        before_data: {
          app_user: target,
          profile: legacyProfile,
        },
        after_data: { status: "pending" },
        reason,
        actor_id: auth.user.id,
      })
      .select("id")
      .single()

    if (auditError || !auditRow) {
      return NextResponse.json(
        { error: "Không thể tạo audit trail; tài khoản chưa bị xóa." },
        { status: 500 },
      )
    }

    const { error: deleteError } =
      await auth.supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      await auth.supabase
        .from("audit_logs")
        .update({
          action: "delete_login_failed",
          after_data: { status: "failed", error: deleteError.message },
        })
        .eq("id", auditRow.id)

      return NextResponse.json(
        { error: "Không thể xóa tài khoản Auth; hồ sơ đăng nhập không bị dọn thủ công." },
        { status: 400 },
      )
    }

    const { error: auditUpdateError } = await auth.supabase
      .from("audit_logs")
      .update({
        action: "delete_login_succeeded",
        after_data: {
          status: "succeeded",
          member_history_preserved: true,
        },
      })
      .eq("id", auditRow.id)

    if (auditUpdateError) {
      console.error("Deleted Auth user but could not finalize audit row", auditUpdateError)
    }

    return NextResponse.json({
      ok: true,
      audit_warning: auditUpdateError
        ? "Tài khoản đã xóa; audit attempt đã được giữ nhưng chưa cập nhật trạng thái cuối."
        : null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: "Không thể xóa tài khoản đăng nhập." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const body = await request.json()
    const phone = normalizeVietnamPhone(String(body.phone ?? ""))
    const displayName = String(body.display_name ?? "").trim()
    const role = String(body.role ?? "")
    const memberId = body.member_id ? String(body.member_id) : null

    if (!displayName) {
      return NextResponse.json(
        { error: "Tên hiển thị là bắt buộc." },
        { status: 400 },
      )
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json(
        { error: "Vai trò không hợp lệ." },
        { status: 400 },
      )
    }

    if (role === "member" && !memberId) {
      return NextResponse.json(
        { error: "Tài khoản hụi viên phải liên kết với một hụi viên." },
        { status: 400 },
      )
    }

    const { data: existingPhone } = await auth.supabase
      .from("app_users")
      .select("auth_user_id")
      .eq("phone", phone)
      .maybeSingle()

    if (existingPhone) {
      return NextResponse.json(
        { error: "Số điện thoại này đã có tài khoản." },
        { status: 400 },
      )
    }

    const technicalEmail = technicalEmailFromPhone(phone)

    const { data: created, error: createError } =
      await auth.supabase.auth.admin.createUser({
        email: technicalEmail,
        password: authPasswordFromPin("0000"),
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          login_phone: phone,
        },
      })

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Không thể tạo tài khoản." },
        { status: 400 },
      )
    }

    const { error: profileError } = await auth.supabase
      .from("app_users")
      .insert({
        auth_user_id: created.user.id,
        email: technicalEmail,
        phone,
        display_name: displayName,
        role,
        member_id: memberId,
        is_active: true,
      })

    if (profileError) {
      await auth.supabase.auth.admin.deleteUser(created.user.id)

      return NextResponse.json(
        { error: profileError.message },
        { status: 400 },
      )
    }

    return NextResponse.json({
      ok: true,
      default_pin: "0000",
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tạo tài khoản.",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      )
    }

    const body = await request.json()
    const userId = String(body.auth_user_id ?? "")
    const action = String(body.action ?? "")

    if (!userId) {
      return NextResponse.json(
        { error: "Thiếu user id." },
        { status: 400 },
      )
    }

    if (action === "reset_pin") {
      const { error } =
        await auth.supabase.auth.admin.updateUserById(userId, {
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

      if (userId === auth.user.id) {
        if (role !== "super_admin") {
          return NextResponse.json(
            { error: "Không thể hạ quyền tài khoản super admin đang đăng nhập." },
            { status: 400 },
          )
        }

        if (!isActive) {
          return NextResponse.json(
            { error: "Không thể tự khóa tài khoản super admin đang đăng nhập." },
            { status: 400 },
          )
        }
      }

      if (!["super_admin", "admin", "member"].includes(role)) {
        return NextResponse.json(
          { error: "Vai trò không hợp lệ." },
          { status: 400 },
        )
      }

      if (role === "member" && !memberId) {
        return NextResponse.json(
          { error: "Hụi viên phải có member_id." },
          { status: 400 },
        )
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

    return NextResponse.json(
      { error: "Action không hợp lệ." },
      { status: 400 },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật tài khoản.",
      },
      { status: 500 },
    )
  }
}
