import dayjs from 'dayjs'
import { supabase } from '@/lib/supabase'
import type { AttendanceStatus, ClassSession } from '@/lib/types'

export interface AttendanceEntry {
  student_id: string
  status: AttendanceStatus
  note: string | null
}

/** Danh sách buổi học của lớp, mới nhất trước, kèm sĩ số đã điểm danh. */
export async function listSessions(classId: string): Promise<ClassSession[]> {
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', classId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface NewSessionInput {
  date: string // yyyy-MM-dd
  period?: string | null
  note?: string | null
}

export async function createSession(
  classId: string,
  input: NewSessionInput,
): Promise<ClassSession> {
  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      class_id: classId,
      date: input.date,
      period: input.period || null,
      note: input.note || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Tìm buổi học hôm nay; nếu chưa có thì tạo mới. */
export async function ensureTodaySession(classId: string): Promise<ClassSession> {
  const today = dayjs().format('YYYY-MM-DD')
  const { data, error } = await supabase
    .from('class_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('date', today)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  if (data && data.length > 0) return data[0]
  return createSession(classId, { date: today })
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('class_sessions').delete().eq('id', sessionId)
  if (error) throw error
}

/** Điểm danh đã ghi của một buổi: map student_id → {status, note}. */
export async function getSessionAttendance(
  sessionId: string,
): Promise<Map<string, { status: AttendanceStatus; note: string | null }>> {
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, note')
    .eq('session_id', sessionId)
  if (error) throw error
  const map = new Map<string, { status: AttendanceStatus; note: string | null }>()
  for (const r of data ?? []) map.set(r.student_id, { status: r.status, note: r.note })
  return map
}

/** Lưu điểm danh cả buổi (upsert theo session_id + student_id). */
export async function saveAttendance(
  sessionId: string,
  entries: AttendanceEntry[],
): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((e) => ({
    session_id: sessionId,
    student_id: e.student_id,
    status: e.status,
    note: e.note,
  }))
  const { error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'session_id,student_id' })
  if (error) throw error
}

export interface AttendanceRecord {
  student_id: string
  date: string
  status: AttendanceStatus
}

/** Điểm danh trong khoảng thời gian (để thống kê chuyên cần). */
export async function listAttendanceInRange(
  classId: string,
  from: string,
  to: string,
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, status, class_sessions!inner(date, class_id)')
    .eq('class_sessions.class_id', classId)
    .gte('class_sessions.date', from)
    .lte('class_sessions.date', to)
  if (error) throw error
  return ((data ?? []) as unknown as {
    student_id: string
    status: AttendanceStatus
    class_sessions: { date: string }
  }[]).map((r) => ({ student_id: r.student_id, status: r.status, date: r.class_sessions.date }))
}

/** Lịch sử điểm danh của một học sinh (cho trang học sinh / phụ huynh). */
export async function listStudentAttendance(
  studentId: string,
  classId?: string,
): Promise<{ date: string; period: string | null; note: string | null; status: AttendanceStatus }[]> {
  let q = supabase
    .from('attendance')
    .select('status, class_sessions!inner(date, period, note, class_id)')
    .eq('student_id', studentId)
  if (classId) q = q.eq('class_sessions.class_id', classId)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as {
    status: AttendanceStatus
    class_sessions: { date: string; period: string | null; note: string | null }
  }[])
    .map((r) => ({
      date: r.class_sessions.date,
      period: r.class_sessions.period,
      note: r.class_sessions.note,
      status: r.status,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}
