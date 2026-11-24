import { getAssignment } from '@/lib/api/assignments'
import { listMembers } from '@/lib/api/classes'
import { listSubmissionFiles, signedFileUrl, type SubmissionFile } from '@/lib/api/quiz'
import { supabase } from '@/lib/supabase'
import type { AssignmentType, SubmissionStatus } from '@/lib/types'

export interface OverviewRow {
  student_id: string
  full_name: string
  student_code: string | null
  submission_id: string | null
  status: SubmissionStatus | null
  is_late: boolean
  score: number | null
  max_score: number | null
  submitted_at: string | null
}

export interface Overview {
  type: AssignmentType
  title: string
  class_id: string
  rows: OverviewRow[]
}

/** Bảng theo dõi nộp bài: mọi học sinh trong lớp + lần làm gần nhất. */
export async function overviewSubmissions(assignmentId: string): Promise<Overview> {
  const a = await getAssignment(assignmentId)
  if (!a) throw new Error('Không tìm thấy bài tập.')
  const members = await listMembers(a.class_id)

  const { data: subs, error } = await supabase
    .from('submissions')
    .select('id, student_id, status, is_late, score, max_score, submitted_at, attempt_no')
    .eq('assignment_id', assignmentId)
  if (error) throw error

  type Sub = NonNullable<typeof subs>[number]
  const latest = new Map<string, Sub>()
  for (const s of subs ?? []) {
    const cur = latest.get(s.student_id)
    if (!cur || s.attempt_no > cur.attempt_no) latest.set(s.student_id, s)
  }

  const rows: OverviewRow[] = members.map((m) => {
    const s = latest.get(m.student_id)
    return {
      student_id: m.student_id,
      full_name: m.full_name,
      student_code: m.student_code,
      submission_id: s?.id ?? null,
      status: s?.status ?? null,
      is_late: s?.is_late ?? false,
      score: s?.score != null ? Number(s.score) : null,
      max_score: s?.max_score != null ? Number(s.max_score) : null,
      submitted_at: s?.submitted_at ?? null,
    }
  })

  return { type: a.type, title: a.title, class_id: a.class_id, rows }
}

export interface EssayDetail {
  submission_id: string
  essay_text: string | null
  status: SubmissionStatus
  is_late: boolean
  score: number | null
  max_score: number | null
  teacher_comment: string | null
  submitted_at: string | null
  files: (SubmissionFile & { url: string | null })[]
}

export async function getEssayDetail(submissionId: string): Promise<EssayDetail> {
  const { data: s, error } = await supabase
    .from('submissions')
    .select('id, essay_text, status, is_late, score, max_score, teacher_comment, submitted_at')
    .eq('id', submissionId)
    .single()
  if (error) throw error
  const files = await listSubmissionFiles(submissionId)
  const withUrls = await Promise.all(
    files.map(async (f) => ({ ...f, url: await signedFileUrl(f.storage_path) })),
  )
  return {
    submission_id: s.id,
    essay_text: s.essay_text,
    status: s.status,
    is_late: s.is_late,
    score: s.score != null ? Number(s.score) : null,
    max_score: s.max_score != null ? Number(s.max_score) : null,
    teacher_comment: s.teacher_comment,
    submitted_at: s.submitted_at,
    files: withUrls,
  }
}

/** Giáo viên chấm tự luận: ghi điểm + nhận xét, đánh dấu đã chấm. */
export async function gradeEssay(
  submissionId: string,
  input: { score: number; max_score: number | null; comment: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({
      score: input.score,
      max_score: input.max_score,
      teacher_comment: input.comment,
      status: 'graded',
      graded_at: new Date().toISOString(),
    })
    .eq('id', submissionId)
  if (error) throw error
}
