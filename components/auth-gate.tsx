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
    let mounted = true
    const supabase = createClient()

    async function initialize() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return

        if (error) {
          console.error("getSession error:", error)
          setLoading(false)
          return
        }

        setSession(data.session)
        setLoading(false)

        if (!data.session && !isPublicRoute) {
          router.replace("/login")
        } else if (data.session && isPublicRoute) {
          router.replace("/")
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        if (mounted) setLoading(false)
      }
    }

    void initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return

        // Chỉ SIGNED_OUT mới được xem là đăng xuất thật.
        // Không đá user vì một event refresh/session tạm thời trả null.
        if (event === "SIGNED_OUT") {
          setSession(null)
          setLoading(false)
          if (!isPublicRoute) router.replace("/login")
          return
        }

        if (nextSession) {
          setSession(nextSession)
          setLoading(false)
          if (isPublicRoute) router.replace("/")
        }
      },
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [isPublicRoute, router])

  if (isPublicRoute) return <>{children}</>

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <LoaderCircle className="size-5 animate-spin" />
          Đang kiểm tra đăng nhập...
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">
          Đang chuyển đến trang đăng nhập...
        </div>
      </main>
    )
  }

  return <>{children}</>
}
