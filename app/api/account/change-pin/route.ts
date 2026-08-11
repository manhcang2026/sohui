import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  authPasswordFromPin,
  isFourDigitPin,
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

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get("authorization") ?? ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : ""

    if (!token) {
      return NextResponse.json(
        { error: "Thiếu phiên đăng nhập." },
        { status: 401 },
      )
    }

    const body = await request.json()
    const pin = String(body.pin ?? "")

    if (!isFourDigitPin(pin)) {
      return NextResponse.json(
        { error: "Mã mới phải gồm đúng 4 số." },
        { status: 400 },
      )
    }

    const supabase = adminClient()

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token)

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Phiên đăng nhập không hợp lệ." },
        { status: 401 },
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .select("is_active")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle()

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { error: "Tài khoản không hoạt động." },
        { status: 403 },
      )
    }

    const { error: updateError } =
      await supabase.auth.admin.updateUserById(authData.user.id, {
        password: authPasswordFromPin(pin),
      })

    if (updateError) {
      console.error("change pin:", updateError)
      return NextResponse.json(
        { error: `Không thể đổi mã 4 số: ${updateError.message}` },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("change-pin error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đổi mã 4 số.",
      },
      { status: 500 },
    )
  }
}
