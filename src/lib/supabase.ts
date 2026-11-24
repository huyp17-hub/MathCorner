import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  const msg = 'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Xem .env.example.'
  console.error(msg)
  document.body.innerHTML = `<div style="display:grid;place-items:center;min-height:100dvh;font-family:sans-serif;padding:2rem;text-align:center;background:#fdfcf8;color:#292524"><div><h1 style="font-size:1.5rem">⚠️ Chưa cấu hình Supabase</h1><p style="margin-top:.5rem;color:#6b625c">${msg}</p></div></div>`
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
