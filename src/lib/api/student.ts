import { supabase } from '@/lib/supabase'
import type { BillingMode, PaymentMethod } from '@/lib/types'

export interface MyClass {
  class_id: string
  name: string
  subject: string | null
  billing_mode: BillingMode
}

/** Học sinh nhập mã lớp để vào lớp. Trả về class_id. */
export async function joinClass(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_class', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  return data as string
}

/** Các lớp mà học sinh đang tham gia. */
export async function getMyClasses(studentId: string): Promise<MyClass[]> {
  const { data, error } = await supabase
    .from('class_members')
    .select('class_id, classes!inner(name, subject, billing_mode)')
    .eq('student_id', studentId)
  if (error) throw error
  return ((data ?? []) as unknown as {
    class_id: string
    classes: { name: string; subject: string | null; billing_mode: BillingMode }
  }[]).map((r) => ({
    class_id: r.class_id,
    name: r.classes.name,
    subject: r.classes.subject,
    billing_mode: r.classes.billing_mode,
  }))
}

export interface MyPayment {
  amount: number
  paid_on: string
  method: PaymentMethod
  note: string | null
  class_id: string
}

/** Lịch sử đóng tiền của học sinh (RLS chỉ trả của chính mình / con mình). */
export async function listMyPayments(studentId: string): Promise<MyPayment[]> {
  const { data, error } = await supabase
    .from('tuition_payments')
    .select('amount, paid_on, method, note, class_id')
    .eq('student_id', studentId)
    .order('paid_on', { ascending: false })
  if (error) throw error
  return (data ?? []) as MyPayment[]
}
