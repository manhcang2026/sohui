"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import {
  isFourDigitPin,
  normalizeVietnamPhone,
} from "@/lib/auth/passcode"

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!isFourDigitPin(pin)) {
      setError("Mã đăng nhập phải gồm đúng 4 số.")
      return
    }

    setSubmitting(true)

    try {
      const normalizedPhone = normalizeVietnamPhone(phone)

      const response = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          phone: normalizedPhone,
          pin,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error ?? "Số điện thoại hoặc mã 4 số không đúng.")
        setSubmitting(false)
        return
      }

      const { error: sessionError } = await createClient().auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })

      if (sessionError) {
        console.error(sessionError)
        setError("Đăng nhập thành công nhưng không tạo được phiên.")
        setSubmitting(false)
        return
      }

      // replace đã đủ để mount trang chủ với session vừa lưu.
      // Không refresh thêm ngay sau đó vì sẽ tạo một lượt tải trùng.
      router.replace("/")
    } catch (caught) {
      console.error(caught)
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể đăng nhập.",
      )
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>

          <h1 className="text-xl font-bold">
            Đăng nhập Sổ Hụi
          </h1>

          <p className="text-sm text-muted-foreground">
            Nhập số điện thoại và mã 4 số.
          </p>
        </div>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Số điện thoại
            <Input
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="09xxxxxxxx"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Mã 4 số
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              required
              value={pin}
              onChange={(event) =>
                setPin(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4),
                )
              }
              placeholder="0000"
            />
          </label>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
