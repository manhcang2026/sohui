"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Runtime error:", error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />

        <h1 className="mt-3 text-lg font-bold">
          Màn hình vừa gặp lỗi
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Dữ liệu đã lưu trên Supabase không tự bị xóa. Hãy thử tải lại màn hình.
        </p>

        {error?.message && (
          <pre className="mt-4 max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs">
            {error.message}
          </pre>
        )}

        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>

          <Button
            variant="outline"
            onClick={() => window.location.assign("/")}
          >
            Về trang chính
          </Button>
        </div>
      </Card>
    </main>
  )
}
