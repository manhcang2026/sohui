"use client"

import { useState } from "react"
import { AppShell, type Page } from "@/components/app-shell"
import { TongQuanPage } from "@/components/pages/tong-quan"
import { KhuiHomNayPage } from "@/components/pages/khui-hom-nay"
import { DayHuiPage } from "@/components/pages/day-hui"
import { HuiVienPage } from "@/components/pages/hui-vien"
import { PhieuThuChiPage } from "@/components/pages/phieu-thu-chi"

export default function Home() {
  const [page, setPage] = useState<Page>("tongguan")

  return (
    <AppShell page={page} onNavigate={setPage}>
      {page === "tongguan" && <TongQuanPage onNavigate={setPage} />}
      {page === "khui"     && <KhuiHomNayPage />}
      {page === "day"      && <DayHuiPage />}
      {page === "huivien"  && <HuiVienPage />}
      {page === "phieu"    && <PhieuThuChiPage />}
    </AppShell>
  )
}
