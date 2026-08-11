"use client"

import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AppShell, type Page } from "@/components/app-shell"
import { TongQuanPage } from "@/components/pages/tong-quan"
import { KhuiHomNayPage } from "@/components/pages/khui-hom-nay"
import { DayHuiPage } from "@/components/pages/day-hui"
import { HuiVienPage } from "@/components/pages/hui-vien"
import { PhieuThuChiPage } from "@/components/pages/phieu-thu-chi"
import { CanDoiPage } from "@/components/pages/can-doi"
import { CaiDatPage } from "@/components/pages/cai-dat"
import { MemberPortalPage } from "@/components/pages/member-portal"

type AppProfile = {
  auth_user_id: string
  email: string | null
  display_name: string | null
  role: "super_admin" | "admin" | "member"
  member_id: string | null
  is_active: boolean
}

export default function Home() {
  const [page, setPage] = useState<Page>("tongguan")
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    void loadProfile()
  }, [])

  async function loadProfile() {
    const supabase = createClient()
    const { data: authData } = await supabase.auth.getUser()
    const user = authData.user

    if (!user) {
      setLoading(false)
      return
    }

    const { data, error: profileError } = await supabase
      .from("app_users")
      .select(
        "auth_user_id, email, display_name, role, member_id, is_active",
      )
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (profileError || !data) {
      setError(
        "Tài khoản chưa được phân quyền. Liên hệ super admin.",
      )
      setLoading(false)
      return
    }

    setProfile(data as AppProfile)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-5 animate-spin" />
        Đang tải quyền tài khoản...
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">
        {error || "Không tìm thấy quyền tài khoản."}
      </div>
    )
  }

  if (!profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        Tài khoản đang bị khóa. Liên hệ super admin.
      </div>
    )
  }

  if (profile.role === "member") {
    if (!profile.member_id) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-destructive">
          Tài khoản hụi viên chưa được liên kết hồ sơ.
        </div>
      )
    }

    return (
      <MemberPortalPage
        profile={{
          ...profile,
          role: "member",
          member_id: profile.member_id,
        }}
      />
    )
  }

  return (
    <AppShell page={page} onNavigate={setPage}>
      {page === "tongguan" && <TongQuanPage onNavigate={setPage} />}
      {page === "khui" && <KhuiHomNayPage />}
      {page === "day" && <DayHuiPage />}
      {page === "huivien" && <HuiVienPage />}
      {page === "phieu" && <PhieuThuChiPage />}
      {page === "candoi" && <CanDoiPage />}
      {page === "caidat" && <CaiDatPage />}
    </AppShell>
  )
}
