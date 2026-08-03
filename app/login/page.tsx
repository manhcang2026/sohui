"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSubmitting(true)

    const { error: authError } = await createClient().auth.signInWithPassword({ email, password })
    if (authError) {
      setError("Email hoặc mật khẩu không đúng.")
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
          <p className="text-sm text-muted-foreground">Nhập tài khoản để tiếp tục quản lý.</p>
        </div>
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Mật khẩu
            <Input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting && <LoaderCircle className="size-4 animate-spin" />}
            Đăng nhập
          </Button>
        </form>
      </Card>
    </main>
  )
}
