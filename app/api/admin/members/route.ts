import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeVietnamPhone } from "@/lib/auth/passcode"

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
      error: "Chỉ Super Admin đang hoạt động được phép thao tác.",
      status: 403 as const,
    }
  }

  return { supabase, user: authData.user }
}

async function loadMemberPreflight(
  supabase: ReturnType<typeof adminClient>,
  memberId: string,
) {
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, phone, is_active")
    .eq("id", memberId)
    .maybeSingle()

  if (memberError) throw memberError
  if (!member) return null

  const [
    shares,
    receipts,
    payments,
    legacyReceipts,
    legacyTransactions,
    appUsers,
    profiles,
  ] = await Promise.all([
    supabase
      .from("hui_shares")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
    supabase
      .from("hui_receipts")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
    supabase
      .from("receipt_payments")
      .select("id, hui_receipts!inner(member_id)", {
        count: "exact",
        head: true,
      })
      .eq("hui_receipts.member_id", memberId),
    supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
    supabase
      .from("app_users")
      .select("auth_user_id", { count: "exact", head: true })
      .eq("member_id", memberId),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId),
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
  const loginCount = counts.app_users + counts.profiles
  const memberDeleteEnabled = businessCount === 0 && loginCount === 0

  return {
    member,
    counts,
    has_business_history: businessCount > 0,
    has_login_link: loginCount > 0,
    member_delete_enabled: memberDeleteEnabled,
    member_delete_blocker: memberDeleteEnabled
      ? null
      : businessCount > 0
        ? "Hồ sơ đã có lịch sử nghiệp vụ nên không được xóa."
        : "Phải xóa tài khoản đăng nhập liên kết trước khi xóa hồ sơ.",
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const memberId = request.nextUrl.searchParams.get("member_id")?.trim()
    if (!memberId) {
      return NextResponse.json({ error: "Thiếu member_id." }, { status: 400 })
    }

    const preflight = await loadMemberPreflight(auth.supabase, memberId)
    if (!preflight) {
      return NextResponse.json(
        { error: "Không tìm thấy hồ sơ hụi viên." },
        { status: 404 },
      )
    }

    return NextResponse.json(preflight)
  } catch {
    return NextResponse.json(
      { error: "Không thể kiểm tra hồ sơ hụi viên." },
      { status: 500 },
    )
  }
}

function matchesRpcError(error: { message?: string; details?: string }, code: string) {
  return `${error.message ?? ""} ${error.details ?? ""}`.includes(code)
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const memberId = String(body.member_id ?? "").trim()
    const reason = String(body.reason ?? "").trim()
    const confirmation = String(body.confirmation ?? "").trim()

    if (!memberId) {
      return NextResponse.json({ error: "Thiếu member_id." }, { status: 400 })
    }
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Lý do xóa phải có ít nhất 5 ký tự." },
        { status: 400 },
      )
    }

    const { data: member, error: memberError } = await auth.supabase
      .from("members")
      .select("id, phone")
      .eq("id", memberId)
      .maybeSingle()

    if (memberError) {
      return NextResponse.json(
        { error: "Không thể xác minh hồ sơ; chưa thực hiện xóa." },
        { status: 503 },
      )
    }
    if (!member) {
      return NextResponse.json(
        { error: "Hồ sơ không còn tồn tại; không có dữ liệu nào bị xóa thêm." },
        { status: 404 },
      )
    }

    let normalizedPhone = ""
    let normalizedConfirmation = ""
    if (member.phone) {
      try {
        normalizedPhone = normalizeVietnamPhone(member.phone)
      } catch {
        normalizedPhone = ""
      }
    }
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
      (!normalizedPhone || normalizedConfirmation !== normalizedPhone)
    ) {
      return NextResponse.json(
        { error: "Hãy gõ XOA hoặc đúng số điện thoại để xác nhận." },
        { status: 400 },
      )
    }

    const { data, error } = await auth.supabase.rpc(
      "delete_clean_member_profile_atomic",
      {
        p_member_id: memberId,
        p_reason: reason,
        p_actor_id: auth.user.id,
      },
    )

    if (error) {
      if (matchesRpcError(error, "member_not_found")) {
        return NextResponse.json(
          { error: "Hồ sơ không còn tồn tại; không có dữ liệu nào bị xóa thêm." },
          { status: 404 },
        )
      }
      if (matchesRpcError(error, "member_has_dependencies")) {
        return NextResponse.json(
          {
            error:
              "Hồ sơ vừa phát sinh liên kết hoặc lịch sử. Hãy tải lại kiểm tra trước khi thử lại.",
            reload_preflight: true,
          },
          { status: 409 },
        )
      }
      if (matchesRpcError(error, "delete_reason_required")) {
        return NextResponse.json(
          { error: "Lý do xóa phải có ít nhất 5 ký tự." },
          { status: 400 },
        )
      }
      if (matchesRpcError(error, "super_admin_required")) {
        return NextResponse.json(
          { error: "Chỉ Super Admin đang hoạt động được phép thao tác." },
          { status: 403 },
        )
      }
      if (matchesRpcError(error, "service_role_required")) {
        return NextResponse.json(
          { error: "Máy chủ chưa được cấp quyền thực hiện thao tác an toàn." },
          { status: 500 },
        )
      }

      return NextResponse.json(
        { error: "Không thể xóa hồ sơ; dữ liệu được giữ nguyên." },
        { status: 500 },
      )
    }

    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
      return NextResponse.json(
        { error: "RPC không xác nhận xóa thành công; hãy tải lại danh sách." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, member_id: memberId })
  } catch {
    return NextResponse.json(
      { error: "Không thể xóa hồ sơ; dữ liệu được giữ nguyên." },
      { status: 500 },
    )
  }
}
