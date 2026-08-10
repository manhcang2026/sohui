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

      const { error: authError } =
        await createClient().auth.signInWithPassword({
          phone: normalizedPhone,
          password: authPasswordFromPin(pin),
        })

      if (authError) {
        setError("Số điện thoại hoặc mã 4 số không đúng.")
        setSubmitting(false)
        return
      }

      router.replace("/")
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Số điện thoại không hợp lệ.")
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
          <h1 className="text-xl font-bold">Đăng nhập Sổ Hụi</h1>
          <p className="text-sm text-muted-foreground">
            Nhập số điện thoại và mã 4 số.
          </p>
        </div>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
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
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
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
            {submitting && <LoaderCircle className="size-4 animate-spin" />}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
