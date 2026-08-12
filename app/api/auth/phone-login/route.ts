import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  authPasswordFromPin,
  isFourDigitPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function requireEnv() {
  if (!url) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL")
  if (!publishableKey) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
  }
  if (!serviceRoleKey) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY")
  }
}

function adminClient() {
  requireEnv()
  return createClient(url!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function loginClient() {
  requireEnv()
  return createClient(url!, publishableKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = normalizeVietnamPhone(String(body.phone ?? ""))
    const pin = String(body.pin ?? "")

    if (!isFourDigitPin(pin)) {
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 400 },
      )
    }

    const admin = adminClient()

    async function registerFailure() {
      const { error } = await admin.rpc("register_pin_failure", {
        p_phone: phone,
      })
      if (error) console.error("register_pin_failure:", error)
    }

    // Hai bước đọc độc lập nên chạy song song. app_users là nguồn ánh xạ
    // SĐT -> Supabase Auth user và cũng lưu email Auth hiện tại.
    // Hụi viên/admin có thể dùng email kỹ thuật; super admin vẫn giữ email
    // thật để còn đường recovery. Không suy diễn email từ số điện thoại ở đây.
    const [lockResult, profileResult] = await Promise.all([
      admin
        .from("login_pin_attempts")
        .select("locked_until")
        .eq("phone", phone)
        .maybeSingle(),
      admin
        .from("app_users")
        .select("auth_user_id, email, is_active")
        .eq("phone", phone)
        .maybeSingle(),
    ])

    if (lockResult.error) {
      console.error("login lock check:", lockResult.error)
    }

    if (
      lockResult.data?.locked_until &&
      new Date(lockResult.data.locked_until).getTime() > Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Bạn đã nhập sai nhiều lần. Tài khoản tạm khóa 15 phút.",
        },
        { status: 429 },
      )
    }

    const profile = profileResult.data

    if (
      profileResult.error ||
      !profile ||
      !profile.is_active ||
      !profile.auth_user_id
    ) {
      await registerFailure()
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 401 },
      )
    }

    // Bình thường không cần gọi Admin Auth thêm một vòng chỉ để lấy email.
    // Fallback này giữ tương thích cho tài khoản cũ nếu app_users.email trống.
    let authEmail = String(profile.email ?? "").trim()

    if (!authEmail) {
      const { data: authData, error: authUserError } =
        await admin.auth.admin.getUserById(profile.auth_user_id)

      if (authUserError || !authData.user?.email) {
        await registerFailure()
        return NextResponse.json(
          { error: "Số điện thoại hoặc mã 4 số không đúng." },
          { status: 401 },
        )
      }

      authEmail = authData.user.email
    }

    const login = loginClient()
    const internalPassword = authPasswordFromPin(pin)

    // Chuẩn chính: email Auth (email kỹ thuật hoặc email thật của super admin)
    // + password nội bộ SOHUI-xxxx.
    let signIn = await login.auth.signInWithPassword({
      email: authEmail,
      password: internalPassword,
    })

    // Cứu hộ tài khoản đã từng recovery trực tiếp thành password 0000.
    // Nếu login được bằng PIN thô, tự chuyển về chuẩn nội bộ.
    if (signIn.error) {
      const legacy = await login.auth.signInWithPassword({
        email: authEmail,
        password: pin,
      })

      if (!legacy.error && legacy.data.session) {
        const { error: migrateError } =
          await admin.auth.admin.updateUserById(profile.auth_user_id, {
            password: internalPassword,
          })

        if (migrateError) {
          console.error("PIN password migration failed:", migrateError)
        }

        signIn = legacy
      }
    }

    if (signIn.error || !signIn.data.session) {
      await registerFailure()
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 401 },
      )
    }

    const { error: clearError } = await admin.rpc(
      "clear_pin_failures",
      {
        p_phone: phone,
      },
    )
    if (clearError) {
      console.error("clear_pin_failures:", clearError)
    }

    // Chỉ trả token phiên; tuyệt đối không trả email Auth kỹ thuật/email thật.
    return NextResponse.json(
      {
        access_token: signIn.data.session.access_token,
        refresh_token: signIn.data.session.refresh_token,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("phone-login error:", error)
    return NextResponse.json(
      { error: "Không thể đăng nhập lúc này." },
      { status: 500 },
    )
  }
}
