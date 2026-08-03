import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | undefined

export function createClient() {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error("Thiếu cấu hình kết nối Supabase.")
  }

  client = createSupabaseClient(url, publishableKey)
  return client
}
