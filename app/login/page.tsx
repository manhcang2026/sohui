"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage("Email hoặc mật khẩu không đúng.")
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-2xl font-bold">Đăng nhập Sổ Hụi</h1>

        <label className="mt-6 block text-sm font-medium">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="mt-2 w-full rounded-lg border px-3 py-2"
        />

        <label className="mt-4 block text-sm font-medium">
          Mật khẩu
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-lg border px-3 py-2"
        />

        {message ? (
          <p className="mt-4 text-sm text-red-600">{message}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  )
}
