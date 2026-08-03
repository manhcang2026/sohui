"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

type TestStatus =
  | { state: "loading"; message: string }
  | { state: "success"; message: string }
  | { state: "error"; message: string }

export default function SupabaseTestPage() {
  const [status, setStatus] = useState<TestStatus>({
    state: "loading",
    message: "Đang kiểm tra kết nối Supabase...",
  })

  useEffect(() => {
    async function testConnection() {
      const { error } = await supabase
        .from("members")
        .select("id")
        .limit(1)

      if (error) {
        setStatus({
          state: "error",
          message: `Kết nối chưa thành công: ${error.message}`,
        })
        return
      }

      setStatus({
        state: "success",
        message: "Kết nối Supabase thành công.",
      })
    }

    void testConnection()
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Kiểm tra Supabase</h1>

        <p className="mt-4 text-base">
          {status.message}
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Trang này chỉ kiểm tra kết nối, chưa đọc hoặc ghi dữ liệu khách hàng.
        </p>
      </div>
    </main>
  )
}
