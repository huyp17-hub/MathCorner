import { supabase } from '@/lib/supabase'
import type { AssignmentType, SubmissionStatus } from '@/lib/types'

export interface GradebookAssignment {
  id: string
  title: string
  type: AssignmentType
  due_at: string
  max_score: number
}

export interface GradebookCell {
  assignment_id: string
  status: SubmissionStatus | null
  is_late: boolean
  score: number | null
  max_score: number | null
}

export interface GradebookStudent {
  student_id: string
  full_name: string
  student_code: string | null
  cells: Map<string, GradebookCell>
}

export interface GradebookData {
  assignments: GradebookAssignment[]
  students: GradebookStudent[]
}

/** Bảng điểm: hàng = học sinh, cột = bài tập, ô = điểm lần nộp gần nhất. */
export async function getGradebook(classId: string): Promise<GradebookData> {
  const { data: asgs, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, type, due_at, questions(count)')
    .eq('class_id', classId)
    .order('due_at', { ascending: true })
  if (aErr) throw aErr

  type AsgRow = {
    id: string
    title: string
    type: AssignmentType
    due_at: string
    questions: { count: number }[]
  }
  const asgRows = (asgs ?? []) as unknown as AsgRow[]

  const { data: qPoints, error: qErr } = await supabase
    .from('questions')
    .select('assignment_id, points')
    .in('assignment_id', asgRows.map((a) => a.id))
  if (qErr) throw qErr
  const pointsMap = new Map<string, number>()
  for (const q of qPoints ?? []) {
    pointsMap.set(q.assignment_id, (pointsMap.get(q.assignment_id) ?? 0) + Number(q.points))
  }

  const assignments: GradebookAssignment[] = asgRows.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    due_at: a.due_at,
    max_score: pointsMap.get(a.id) ?? 0,
  }))

  const { data: members, error: mErr } = await supabase
    .from('class_members')
    .select('student_id, profiles!inner(full_name, student_code)')
    .eq('class_id', classId)
  if (mErr) throw mErr

  type MemRow = {
    student_id: string
    profiles: { full_name: string; student_code: string | null }
  }
  const memRows = (members ?? []) as unknown as MemRow[]

  const asgIds = assignments.map((a) => a.id)
  const stuIds = memRows.map((m) => m.student_id)

  let subs: {
    assignment_id: string
    student_id: string
    status: SubmissionStatus
    is_late: boolean
    score: number | null
    max_score: number | null
    attempt_no: number
  }[] = []

  if (asgIds.length > 0 && stuIds.length > 0) {
    const { data, error } = await supabase
      .from('submissions')
      .select('assignment_id, student_id, status, is_late, score, max_score, attempt_no')
      .in('assignment_id', asgIds)
      .in('student_id', stuIds)
    if (error) throw error
    subs = data ?? []
  }

  const latest = new Map<string, (typeof subs)[number]>()
  for (const s of subs) {
    const key = `${s.student_id}:${s.assignment_id}`
    const cur = latest.get(key)
    if (!cur || s.attempt_no > cur.attempt_no) latest.set(key, s)
  }

  const students: GradebookStudent[] = memRows
    .map((m) => {
      const cells = new Map<string, GradebookCell>()
      for (const a of assignments) {
        const s = latest.get(`${m.student_id}:${a.id}`)
        cells.set(a.id, {
          assignment_id: a.id,
          status: s?.status ?? null,
          is_late: s?.is_late ?? false,
          score: s?.score != null ? Number(s.score) : null,
          max_score: s?.max_score != null ? Number(s.max_score) : null,
        })
      }
      return {
        student_id: m.student_id,
        full_name: m.profiles.full_name,
        student_code: m.profiles.student_code,
        cells,
      }
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'))

  return { assignments, students }
}

/** Chuyển bảng điểm thành mảng phẳng để xuất Excel. */
export function gradebookToRows(
  data: GradebookData,
): Record<string, string | number | null>[] {
  return data.students.map((s) => {
    const row: Record<string, string | number | null> = {
      'Mã HS': s.student_code,
      'Họ tên': s.full_name,
    }
    for (const a of data.assignments) {
      const cell = s.cells.get(a.id)
      row[a.title] = cell?.score != null ? cell.score : null
    }
    return row
  })
}
