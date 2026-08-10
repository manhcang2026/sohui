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

    // Dùng app_users làm bảng ánh xạ SĐT -> Supabase Auth user.
    const { data: profile, error: profileError } = await admin
      .from("app_users")
      .select("auth_user_id, is_active")
      .eq("phone", phone)
      .maybeSingle()

    if (
      profileError ||
      !profile ||
      !profile.is_active ||
      !profile.auth_user_id
    ) {
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 401 },
      )
    }

    const { data: authData, error: authUserError } =
      await admin.auth.admin.getUserById(profile.auth_user_id)

    const authUser = authData.user

    if (authUserError || !authUser?.email) {
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 401 },
      )
    }

    const login = loginClient()
    const internalPassword = authPasswordFromPin(pin)

    // Chuẩn chính: email Auth phía dưới + password nội bộ SOHUI-xxxx.
    let signIn = await login.auth.signInWithPassword({
      email: authUser.email,
      password: internalPassword,
    })

    // Cứu hộ tài khoản đã từng recovery trực tiếp thành password 0000.
    // Nếu login được bằng PIN thô, tự chuyển về chuẩn nội bộ.
    if (signIn.error) {
      const legacy = await login.auth.signInWithPassword({
        email: authUser.email,
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
      return NextResponse.json(
        { error: "Số điện thoại hoặc mã 4 số không đúng." },
        { status: 401 },
      )
    }

    // Chỉ trả token phiên; tuyệt đối không trả email Auth kỹ thuật.
    return NextResponse.json({
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
    })
  } catch (error) {
    console.error("phone-login error:", error)
    return NextResponse.json(
      { error: "Không thể đăng nhập lúc này." },
      { status: 500 },
    )
  }
}
