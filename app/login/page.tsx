"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { authPasswordFromPin, isFourDigitPin } from "@/lib/auth/passcode"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [secret, setSecret] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    // Tương thích ngược:
    // - nhập đúng 4 số => dùng PIN mới
    // - nhập chuỗi khác => dùng password Supabase cũ
    const password = isFourDigitPin(secret)
      ? authPasswordFromPin(secret)
      : secret

    const { error: authError } =
      await createClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

    if (authError) {
      setError("Email hoặc mã đăng nhập không đúng.")
      setSubmitting(false)
      return
    }

    router.replace("/")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <h1 className="text-xl font-bold">Đăng nhập Sổ Hụi</h1>
          <p className="text-sm text-muted-foreground">
            Nhập email và mã 4 số.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Mã 4 số
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="0000"
            />
            <span className="text-xs font-normal text-muted-foreground">
              Tài khoản cũ chưa đổi mã vẫn có thể nhập mật khẩu cũ.
            </span>
          </label>

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
