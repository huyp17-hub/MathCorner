import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Thông báo rõ khi thiếu cấu hình môi trường (xem .env.example)
  console.warn('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong .env.local')
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
