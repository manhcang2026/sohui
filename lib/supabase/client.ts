import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL")
}

if (!supabasePublishableKey) {
  throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
}

export const supabase = createSupabaseClient(
  supabaseUrl,
  supabasePublishableKey,
)

export function createClient() {
  return supabase
}
