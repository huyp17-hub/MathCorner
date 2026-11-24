import { supabase } from '@/lib/supabase'
import type { AttendanceStatus, BillingMode, PaymentMethod } from '@/lib/types'

export interface ParentChild {
  student_id: string
  full_name: string
}

/** Danh sách con đã liên kết. */
export async function parentChildren(): Promise<ParentChild[]> {
  const { data, error } = await supabase.rpc('parent_children')
  if (error) throw error
  return (data ?? []) as ParentChild[]
}

/** Liên kết con bằng mã phụ huynh 8 ký tự. */
export async function linkParent(code: string): Promise<{ ok: boolean; message: string; student_id?: string }> {
  const { data, error } = await supabase.rpc('link_parent', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data as { ok: boolean; message: string; student_id?: string }
}

export interface ParentAssignment {
  assignment_id: string
  class_id: string
  class_name: string
  title: string
  type: 'quiz' | 'essay'
  due_at: string
  status: string | null
  is_late: boolean
  is_overdue: boolean
  score: number | null
  max_score: number | null
  submitted_at: string | null
  teacher_comment: string | null
}

/** Bài tập + điểm của con. */
export async function parentChildAssignments(studentId: string): Promise<ParentAssignment[]> {
  const { data, error } = await supabase.rpc('parent_child_assignments', {
    p_student_id: studentId,
  })
  if (error) throw error
  return (data ?? []) as ParentAssignment[]
}

export interface ParentAttendanceRow {
  date: string
  period: string | null
  note: string | null
  status: AttendanceStatus
  class_name: string
}

/** Điểm danh của con (RLS lọc tự động). */
export async function parentChildAttendance(studentId: string): Promise<ParentAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('status, class_sessions!inner(date, period, note, class_id, classes!inner(name))')
    .eq('student_id', studentId)
    .order('class_sessions(date)', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as {
    status: AttendanceStatus
    class_sessions: {
      date: string
      period: string | null
      note: string | null
      classes: { name: string }
    }
  }[]).map((r) => ({
    date: r.class_sessions.date,
    period: r.class_sessions.period,
    note: r.class_sessions.note,
    status: r.status,
    class_name: r.class_sessions.classes.name,
  }))
}

export interface ParentChildClass {
  class_id: string
  name: string
  billing_mode: BillingMode
}

/** Lớp học mà con đang tham gia (RLS qua parent_links). */
export async function parentChildClasses(studentId: string): Promise<ParentChildClass[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('class_id, classes!inner(name, billing_mode)')
    .eq('student_id', studentId)
  if (error) throw error
  return ((data ?? []) as unknown as {
    class_id: string
    classes: { name: string; billing_mode: BillingMode }
  }[]).map((r) => ({
    class_id: r.class_id,
    name: r.classes.name,
    billing_mode: r.classes.billing_mode,
  }))
}

export interface ParentPayment {
  amount: number
  paid_on: string
  method: PaymentMethod
  note: string | null
  class_id: string
}

/** Lịch sử đóng tiền của con (RLS qua parent_links). */
export async function parentChildPayments(studentId: string): Promise<ParentPayment[]> {
  const { data, error } = await supabase
    .from('tuition_payments')
    .select('amount, paid_on, method, note, class_id')
    .eq('student_id', studentId)
    .order('paid_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as ParentPayment[]
}
