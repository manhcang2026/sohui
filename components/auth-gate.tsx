"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import { LoaderCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const isPublicRoute = pathname === "/login"

  useEffect(() => {
    const supabase = createClient()

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (!data.session && !isPublicRoute) router.replace("/login")
      if (data.session && isPublicRoute) router.replace("/")
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (!nextSession && !isPublicRoute) router.replace("/login")
    })

    return () => listener.subscription.unsubscribe()
  }, [isPublicRoute, router])

  if (isPublicRoute) return <>{children}</>

  if (loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-5 animate-spin" />
          Đang kiểm tra đăng nhập...
        </div>
      </main>
    )
  }

  return <>{children}</>
}
