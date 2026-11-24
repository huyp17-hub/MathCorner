import { supabase } from '@/lib/supabase'
import type { AttendanceStatus, BillingMode, Class, Profile } from '@/lib/types'

export interface ClassRow extends Class {
  student_count?: number
}

export interface MemberRow {
  student_id: string
  joined_at: string
  full_name: string
  student_code: string | null
  phone: string | null
  parent_code: string | null
}

/** Danh sách lớp của giáo viên (kèm sĩ số). */
export async function listTeacherClasses(teacherId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_members(count)')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c) => {
    const { class_members, ...rest } = c as Class & {
      class_members: { count: number }[]
    }
    return { ...rest, student_count: class_members?.[0]?.count ?? 0 }
  })
}

export async function getClass(classId: string): Promise<Class | null> {
  const { data, error } = await supabase.from('classes').select('*').eq('id', classId).maybeSingle()
  if (error) throw error
  return data
}

export interface CreateClassInput {
  name: string
  subject?: string | null
  school_year?: string | null
}

export async function createClass(teacherId: string, input: CreateClassInput): Promise<Class> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name: input.name,
      subject: input.subject || null,
      school_year: input.school_year || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateClass(
  classId: string,
  patch: Partial<Pick<Class, 'name' | 'subject' | 'school_year'>>,
): Promise<void> {
  const { error } = await supabase.from('classes').update(patch).eq('id', classId)
  if (error) throw error
}

export interface BillingInput {
  billing_mode: BillingMode
  price_per_session: number | null
  billable_statuses: AttendanceStatus[]
  low_session_warning: number
}

export async function updateClassBilling(classId: string, input: BillingInput): Promise<void> {
  const { error } = await supabase.from('classes').update(input).eq('id', classId)
  if (error) throw error
}

/**
 * Xoá lớp. FK chặn khi đã phát sinh dữ liệu phụ thuộc không CASCADE → trả lỗi thân thiện.
 */
export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', classId)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Lớp đang có dữ liệu liên quan nên chưa xoá được. Hãy kiểm tra lại nhé.')
    }
    throw error
  }
}

export async function regenerateJoinCode(classId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_join_code', { p_class_id: classId })
  if (error) throw error
  return data as string
}

export async function regenerateParentCode(studentId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_parent_code', { p_student_id: studentId })
  if (error) throw error
  return data as string
}

/** Danh sách học sinh trong lớp + mã phụ huynh. */
export async function listMembers(classId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('student_id, joined_at, profiles!inner(full_name, student_code, phone)')
    .eq('class_id', classId)
  if (error) throw error

  const rows = (data ?? []) as unknown as {
    student_id: string
    joined_at: string
    profiles: Pick<Profile, 'full_name' | 'student_code' | 'phone'>
  }[]

  const ids = rows.map((r) => r.student_id)
  const codes = new Map<string, string>()
  if (ids.length) {
    const { data: codeData } = await supabase
      .from('student_parent_codes')
      .select('student_id, code')
      .in('student_id', ids)
    for (const c of codeData ?? []) codes.set(c.student_id, c.code)
  }

  return rows
    .map((r) => ({
      student_id: r.student_id,
      joined_at: r.joined_at,
      full_name: r.profiles.full_name,
      student_code: r.profiles.student_code,
      phone: r.profiles.phone,
      parent_code: codes.get(r.student_id) ?? null,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))
}

/** Giáo viên sửa hồ sơ học sinh của mình (RLS cho phép full_name/student_code/phone). */
export async function updateStudentProfile(
  studentId: string,
  patch: Partial<Pick<Profile, 'full_name' | 'student_code' | 'phone'>>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', studentId)
  if (error) throw error
}

/** Gỡ học sinh khỏi lớp (không xoá tài khoản). */
export async function removeMember(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('student_id', studentId)
  if (error) throw error
}

export interface NewStudentInput {
  full_name: string
  student_code?: string
  email?: string
  password?: string
}

export interface CreatedStudentResult {
  full_name: string
  student_code: string | null
  email: string | null
  password: string | null
  status: 'created' | 'error'
  message?: string
}

/** Tạo tài khoản học sinh hàng loạt qua Edge Function create-students. */
export async function createStudents(
  classId: string,
  students: NewStudentInput[],
): Promise<CreatedStudentResult[]> {
  const { data, error } = await supabase.functions.invoke('create-students', {
    body: { class_id: classId, students },
  })
  if (error) {
    // Lấy thông điệp từ phản hồi lỗi nếu có.
    let msg = 'Không tạo được danh sách tài khoản.'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) msg = body.error
      }
    } catch {
      /* bỏ qua */
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error as string)
  return (data?.results ?? []) as CreatedStudentResult[]
}
