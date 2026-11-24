import { supabase } from '@/lib/supabase'
import type { BillingMode, PaymentMethod } from '@/lib/types'

export interface TuitionRow {
  student_id: string
  full_name: string
  student_code: string | null
  billing_mode: BillingMode
  sessions_in_month: number
  absent_in_month: number
  sessions_used_total: number
  sessions_purchased: number | null
  sessions_remaining: number | null
  amount_due_month: number | null
  amount_total: number
  paid_month: number
  paid_total: number
  balance: number
  low_sessions: boolean
}

/** Bảng học phí theo tháng. p_month là ngày bất kỳ trong tháng (yyyy-MM-01). */
export async function tuitionSummary(classId: string, month: string): Promise<TuitionRow[]> {
  const { data, error } = await supabase.rpc('tuition_summary', {
    p_class_id: classId,
    p_month: month,
  })
  if (error) throw error
  return (data ?? []) as TuitionRow[]
}

export interface NewPackageInput {
  student_id: string
  sessions: number
  price: number | null
  start_date: string
  note?: string | null
}

export async function addPackage(classId: string, input: NewPackageInput): Promise<void> {
  const { error } = await supabase.from('tuition_packages').insert({
    class_id: classId,
    student_id: input.student_id,
    sessions: input.sessions,
    price: input.price,
    start_date: input.start_date,
    note: input.note || null,
  })
  if (error) throw error
}

export interface NewPaymentInput {
  student_id: string
  amount: number
  paid_on: string
  method: PaymentMethod
  note?: string | null
}

export async function addPayment(classId: string, input: NewPaymentInput): Promise<void> {
  const { error } = await supabase.from('tuition_payments').insert({
    class_id: classId,
    student_id: input.student_id,
    amount: input.amount,
    paid_on: input.paid_on,
    method: input.method,
    note: input.note || null,
  })
  if (error) throw error
}
