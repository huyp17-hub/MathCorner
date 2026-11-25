import { supabase } from '@/lib/supabase'
import type {
  AssignmentType,
  ExamFormat,
  QuestionKind,
  Submission,
  SubmissionStatus,
} from '@/lib/types'

// ---- Danh sách bài tập của học sinh ----

export interface MyAssignment {
  id: string
  title: string
  type: AssignmentType
  exam_format: ExamFormat
  open_at: string
  due_at: string
  allow_late: boolean
  class_name: string
  question_count: number
  // trạng thái lần làm gần nhất
  submission_id: string | null
  status: SubmissionStatus | null
  is_late: boolean
  score: number | null
  max_score: number | null
}

/** Bài tập của các lớp học sinh đang học, kèm trạng thái lần làm gần nhất. */
export async function listMyAssignments(studentId: string): Promise<MyAssignment[]> {
  const { data: cm, error: cmErr } = await supabase
    .from('class_members')
    .select('class_id')
    .eq('student_id', studentId)
  if (cmErr) throw cmErr
  const classIds = (cm ?? []).map((r) => r.class_id)
  if (classIds.length === 0) return []

  const nowIso = new Date().toISOString()
  const { data: asgs, error: aErr } = await supabase
    .from('assignments')
    .select('*, classes!inner(name), questions(count)')
    .in('class_id', classIds)
    .lte('open_at', nowIso)
    .order('due_at', { ascending: true })
  if (aErr) throw aErr

  type AsgRow = {
    id: string
    title: string
    type: AssignmentType
    exam_format: ExamFormat
    open_at: string
    due_at: string
    allow_late: boolean
    classes: { name: string }
    questions: { count: number }[]
  }
  const rows = (asgs ?? []) as unknown as AsgRow[]
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []

  const { data: subs, error: sErr } = await supabase
    .from('submissions')
    .select('id, assignment_id, status, is_late, score, max_score, attempt_no')
    .eq('student_id', studentId)
    .in('assignment_id', ids)
  if (sErr) throw sErr

  // Lần làm gần nhất (attempt_no lớn nhất) của mỗi bài.
  const latest = new Map<string, (typeof subs)[number]>()
  for (const s of subs ?? []) {
    const cur = latest.get(s.assignment_id)
    if (!cur || s.attempt_no > cur.attempt_no) latest.set(s.assignment_id, s)
  }

  return rows.map((r) => {
    const s = latest.get(r.id)
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      exam_format: r.exam_format,
      open_at: r.open_at,
      due_at: r.due_at,
      allow_late: r.allow_late,
      class_name: r.classes.name,
      question_count: r.questions?.[0]?.count ?? 0,
      submission_id: s?.id ?? null,
      status: s?.status ?? null,
      is_late: s?.is_late ?? false,
      score: s?.score != null ? Number(s.score) : null,
      max_score: s?.max_score != null ? Number(s.max_score) : null,
    }
  })
}

/** Bài tập của MỘT lớp cho học sinh, kèm trạng thái lần làm gần nhất. */
export async function listClassAssignments(
  classId: string,
  studentId: string,
): Promise<MyAssignment[]> {
  const nowIso = new Date().toISOString()
  const { data: asgs, error: aErr } = await supabase
    .from('assignments')
    .select('*, classes!inner(name), questions(count)')
    .eq('class_id', classId)
    .lte('open_at', nowIso)
    .order('due_at', { ascending: true })
  if (aErr) throw aErr

  type AsgRow = {
    id: string; title: string; type: AssignmentType; exam_format: ExamFormat
    open_at: string; due_at: string; allow_late: boolean
    classes: { name: string }; questions: { count: number }[]
  }
  const rows = (asgs ?? []) as unknown as AsgRow[]
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []

  const { data: subs, error: sErr } = await supabase
    .from('submissions')
    .select('id, assignment_id, status, is_late, score, max_score, attempt_no')
    .eq('student_id', studentId)
    .in('assignment_id', ids)
  if (sErr) throw sErr

  const latest = new Map<string, (typeof subs)[number]>()
  for (const s of subs ?? []) {
    const cur = latest.get(s.assignment_id)
    if (!cur || s.attempt_no > cur.attempt_no) latest.set(s.assignment_id, s)
  }

  return rows.map((r) => {
    const s = latest.get(r.id)
    return {
      id: r.id, title: r.title, type: r.type, exam_format: r.exam_format,
      open_at: r.open_at, due_at: r.due_at, allow_late: r.allow_late,
      class_name: r.classes.name,
      question_count: r.questions?.[0]?.count ?? 0,
      submission_id: s?.id ?? null, status: s?.status ?? null, is_late: s?.is_late ?? false,
      score: s?.score != null ? Number(s.score) : null,
      max_score: s?.max_score != null ? Number(s.max_score) : null,
    }
  })
}

// ---- Làm bài trắc nghiệm (dùng ở Phase 5b) ----

export interface QuizChoice {
  id: string
  content: string
}

export interface QuizQuestion {
  id: string
  kind: QuestionKind
  content: string
  points: number
  multiple_correct: boolean
  selected_choice_ids: string[] | null
  tf_answers: Record<string, boolean> | null
  text_answer: string | null
  blank_answers: Record<string, string> | null
  flagged: boolean
  time_spent_seconds: number
  choices: QuizChoice[]
}

export interface QuizData {
  submission_id: string
  assignment_id: string
  title: string
  exam_format: ExamFormat
  shuffle: boolean
  allow_pause: boolean
  paused: boolean
  server_now: string
  time_limit_minutes: number | null
  started_at: string
  deadline: string | null
  status: SubmissionStatus
  questions: QuizQuestion[]
}

/** Bắt đầu / tiếp tục một lượt làm bài. */
export async function startAttempt(assignmentId: string): Promise<Submission> {
  const { data, error } = await supabase.rpc('start_attempt', { p_assignment_id: assignmentId })
  if (error) throw error
  return data as unknown as Submission
}

/** Lấy đề (không chứa đáp án). */
export async function getQuiz(submissionId: string): Promise<QuizData> {
  const { data, error } = await supabase.rpc('get_quiz', { p_submission_id: submissionId })
  if (error) throw error
  return data as unknown as QuizData
}

export interface AnswerPatch {
  submission_id: string
  question_id: string
  selected_choice_ids?: string[]
  tf_answers?: Record<string, boolean>
  text_answer?: string | null
  blank_answers?: Record<string, string>
  flagged?: boolean
  time_spent_seconds?: number
}

/** Lưu câu trả lời (upsert theo submission + question). */
export async function saveAnswer(patch: AnswerPatch): Promise<void> {
  const { error } = await supabase
    .from('answers')
    .upsert(patch, { onConflict: 'submission_id,question_id' })
  if (error) throw error
}

export async function submitQuiz(submissionId: string): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_quiz', { p_submission_id: submissionId })
  if (error) throw error
  return data as unknown as Submission
}

export async function saveEssay(submissionId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('save_essay', {
    p_submission_id: submissionId,
    p_essay_text: text,
  })
  if (error) throw error
}

export async function submitEssay(submissionId: string, text: string): Promise<Submission> {
  const { data, error } = await supabase.rpc('submit_essay', {
    p_submission_id: submissionId,
    p_essay_text: text,
  })
  if (error) throw error
  return data as unknown as Submission
}

// ---- Xem lại bài (có đáp án theo show_answers) ----

export interface ReviewQuestion extends QuizQuestion {
  points_awarded: number | null
  explanation: string | null
  accepted_answers: string[] | null
  choices: (QuizChoice & { is_correct?: boolean; blank_no?: number | null })[]
}

export interface QuizReview extends Omit<QuizData, 'questions'> {
  score: number | null
  max_score: number | null
  questions: ReviewQuestion[]
}

export async function getQuizReview(submissionId: string): Promise<QuizReview> {
  const { data, error } = await supabase.rpc('get_quiz_review', { p_submission_id: submissionId })
  if (error) throw error
  return data as unknown as QuizReview
}

/** Lần làm gần nhất của học sinh cho một bài (null nếu chưa làm). */
export async function getLatestSubmission(
  assignmentId: string,
  studentId: string,
): Promise<Submission | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('attempt_no', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// ---- Câu hỏi tự luận (đề bài, dùng cho học sinh) ----

export interface EssayQuestion {
  id: string
  content: string
  points: number
  order_index: number
}

export async function loadEssayQuestions(assignmentId: string): Promise<EssayQuestion[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, content, points, order_index')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map((q) => ({ ...q, points: Number(q.points) }))
}

export function getQuestionIdFromPath(path: string): string | null {
  const match = path.match(/\/q-([0-9a-f-]+)\//)
  return match ? match[1] : null
}

// ---- Nộp file (tự luận) ----

export interface SubmissionFile {
  id: string
  storage_path: string
  file_name: string
  size: number
}

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'doc', 'docx']

export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) return 'Chỉ nhận PDF, ảnh hoặc Word.'
  if (file.size > MAX_FILE_BYTES) return 'File vượt quá 10 MB.'
  return null
}

/** Tải một file bài nộp lên bucket `submissions` rồi ghi vào submission_files. */
export async function uploadSubmissionFile(
  assignmentId: string,
  studentId: string,
  submissionId: string,
  file: File,
  questionId?: string,
): Promise<SubmissionFile> {
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_')
  const questionPrefix = questionId ? `q-${questionId}/` : ''
  const path = `${assignmentId}/${studentId}/${submissionId}/${questionPrefix}${Date.now()}-${safeName}`
  const { error: upErr } = await supabase.storage.from('submissions').upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('submission_files')
    .insert({ submission_id: submissionId, storage_path: path, file_name: file.name, size: file.size })
    .select('id, storage_path, file_name, size')
    .single()
  if (error) throw error
  return data as SubmissionFile
}

export async function listSubmissionFiles(submissionId: string): Promise<SubmissionFile[]> {
  const { data, error } = await supabase
    .from('submission_files')
    .select('id, storage_path, file_name, size')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as SubmissionFile[]
}

export async function deleteSubmissionFile(file: SubmissionFile): Promise<void> {
  await supabase.storage.from('submissions').remove([file.storage_path])
  const { error } = await supabase.from('submission_files').delete().eq('id', file.id)
  if (error) throw error
}

/** Link tạm thời để xem/tải file bài nộp (bucket riêng tư). */
export async function signedFileUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from('submissions').createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}
