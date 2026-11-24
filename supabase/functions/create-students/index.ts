// Edge Function: create-students
// Giáo viên tạo tài khoản học sinh hàng loạt và thêm vào lớp.
// Dùng service role key (chỉ có trong môi trường Edge Function, KHÔNG ở frontend).
//
// Body: { class_id: string, students: { full_name: string, student_code?: string,
//         email?: string, password?: string }[] }
// Trả về: { results: { full_name, student_code, email, password, status, message }[] }
//
// Quy tắc: kiểm tra người gọi là giáo viên của lớp → tạo auth user (email thật hoặc
// {student_code}@hs.local) với email_confirm=true, metadata role=student → thêm class_members.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface StudentInput {
  full_name: string
  student_code?: string
  email?: string
  password?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function randomPassword(len = 8): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function toEmail(code: string): string {
  const v = code.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@hs.local`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Chỉ chấp nhận POST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Thiếu thông tin đăng nhập' }, 401)

  // Client theo quyền người gọi — để biết ai đang gọi.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Phiên đăng nhập không hợp lệ' }, 401)

  let payload: { class_id?: string; students?: StudentInput[] }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Dữ liệu gửi lên không đọc được' }, 400)
  }
  const classId = payload.class_id
  const students = Array.isArray(payload.students) ? payload.students : []
  if (!classId) return json({ error: 'Thiếu mã lớp' }, 400)
  if (students.length === 0) return json({ error: 'Danh sách học sinh trống' }, 400)
  if (students.length > 200) return json({ error: 'Mỗi lần tối đa 200 học sinh' }, 400)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Xác nhận người gọi là giáo viên của lớp này.
  const { data: cls, error: clsErr } = await admin
    .from('classes')
    .select('id, teacher_id')
    .eq('id', classId)
    .maybeSingle()
  if (clsErr) return json({ error: 'Không đọc được lớp' }, 500)
  if (!cls || cls.teacher_id !== user.id) {
    return json({ error: 'Bạn không phải giáo viên của lớp này' }, 403)
  }

  const results: Array<{
    full_name: string
    student_code: string | null
    email: string | null
    password: string | null
    status: 'created' | 'error'
    message?: string
  }> = []

  for (const s of students) {
    const fullName = (s.full_name ?? '').trim()
    const code = (s.student_code ?? '').trim()
    if (!fullName) {
      results.push({ full_name: fullName, student_code: code || null, email: null, password: null, status: 'error', message: 'Thiếu họ tên' })
      continue
    }
    const loginEmail = s.email?.trim() ? s.email.trim().toLowerCase() : code ? toEmail(code) : ''
    if (!loginEmail) {
      results.push({ full_name: fullName, student_code: null, email: null, password: null, status: 'error', message: 'Cần mã học sinh hoặc email' })
      continue
    }
    const password = s.password?.trim() || randomPassword()

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { role: 'student', full_name: fullName, student_code: code || null },
    })

    if (createErr || !created?.user) {
      results.push({
        full_name: fullName,
        student_code: code || null,
        email: loginEmail,
        password: null,
        status: 'error',
        message: createErr?.message?.includes('already')
          ? 'Tài khoản đã tồn tại'
          : createErr?.message ?? 'Không tạo được tài khoản',
      })
      continue
    }

    // Trigger đã tạo profiles + mã phụ huynh. Thêm vào lớp.
    const { error: memberErr } = await admin
      .from('class_members')
      .insert({ class_id: classId, student_id: created.user.id })

    if (memberErr && !memberErr.message.includes('duplicate')) {
      results.push({ full_name: fullName, student_code: code || null, email: loginEmail, password, status: 'error', message: 'Đã tạo tài khoản nhưng chưa thêm được vào lớp' })
      continue
    }

    results.push({ full_name: fullName, student_code: code || null, email: loginEmail, password, status: 'created' })
  }

  return json({ results })
})
