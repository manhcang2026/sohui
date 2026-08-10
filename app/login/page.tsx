"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import {
  authPasswordFromPin,
  isFourDigitPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"

function looksLikeEmail(value: string) {
  return value.includes("@")
}

export default function LoginPage() {
  const router = useRouter()
  const [account, setAccount] = useState("")
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    try {
      const supabase = createClient()
      const loginValue = account.trim()

      if (looksLikeEmail(loginValue)) {
        // CỨU HỘ: tài khoản cũ vẫn login bằng email + password cũ.
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: loginValue.toLowerCase(),
          password: secret,
        })

        if (authError) {
          setError("Email hoặc mật khẩu cũ không đúng.")
          setSubmitting(false)
          return
        }
      } else {
        // Login mới: SĐT + PIN 4 số.
        if (!isFourDigitPin(secret)) {
          setError("Mã đăng nhập phải gồm đúng 4 số.")
          setSubmitting(false)
          return
        }

        const phone = normalizeVietnamPhone(loginValue)
        const { error: authError } = await supabase.auth.signInWithPassword({
          phone,
          password: authPasswordFromPin(secret),
        })

        if (authError) {
          setError("Số điện thoại hoặc mã 4 số không đúng.")
          setSubmitting(false)
          return
        }
      }

      router.replace("/")
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đăng nhập.",
      )
      setSubmitting(false)
    }
  }

  const emailMode = looksLikeEmail(account)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <h1 className="text-xl font-bold">Đăng nhập Sổ Hụi</h1>
          <p className="text-sm text-muted-foreground">
            SĐT + mã 4 số. Tài khoản cũ có thể dùng email để chuyển đổi.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Số điện thoại / Email cũ
            <Input
              autoComplete="username"
              required
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="09xxxxxxxx hoặc email cũ"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {emailMode ? "Mật khẩu cũ" : "Mã 4 số"}
            <Input
              type="password"
              inputMode={emailMode ? "text" : "numeric"}
              autoComplete="current-password"
              required
              value={secret}
              onChange={(event) =>
                setSecret(
                  emailMode
                    ? event.target.value
                    : event.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              placeholder={emailMode ? "Mật khẩu Supabase cũ" : "0000"}
            />
          </label>

          {emailMode && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              Chế độ cứu hộ: đăng nhập bằng email + mật khẩu cũ, sau đó vào
              Cài đặt để chuyển tài khoản sang SĐT.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="size-4 animate-spin" />}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
