import { supabase } from '@/lib/supabase'
import type {
  Assignment,
  AssignmentType,
  QuestionKind,
  ShowAnswersMode,
} from '@/lib/types'

export interface AssignmentRow extends Assignment {
  question_count: number
}

/** Danh sách bài tập của một lớp (kèm số câu hỏi), mới hạn trước. */
export async function listAssignments(classId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select('*, questions(count)')
    .eq('class_id', classId)
    .order('due_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((a) => {
    const { questions, ...rest } = a as Assignment & { questions: { count: number }[] }
    return { ...rest, question_count: questions?.[0]?.count ?? 0 }
  })
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const { data, error } = await supabase.from('assignments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export interface AssignmentInput {
  title: string
  description: string | null
  type: AssignmentType
  open_at: string
  due_at: string
  allow_late: boolean
  time_limit_minutes: number | null
  max_attempts: number
  shuffle: boolean
  show_answers: ShowAnswersMode
}

export async function createAssignment(
  classId: string,
  input: AssignmentInput,
): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({ class_id: classId, exam_format: 'standard', ...input })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateAssignment(
  id: string,
  patch: Partial<AssignmentInput>,
): Promise<void> {
  const { error } = await supabase.from('assignments').update(patch).eq('id', id)
  if (error) throw error
}

/** Xoá bài tập. FK chặn nếu đã có bài nộp → thông báo thân thiện. */
export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Bài tập đã có học sinh làm nên không xoá được. Bạn có thể ẩn bằng cách đổi hạn nộp.')
    }
    throw error
  }
}

/** Tạo đề TSA với 3 phần thi chuẩn. */
export async function createTsaAssignment(
  classId: string,
  input: AssignmentInput,
): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({ class_id: classId, exam_format: 'tsa', allow_pause: false, ...input })
    .select('*')
    .single()
  if (error) throw error

  const sections = [
    { assignment_id: data.id, order_index: 0, title: 'Tư duy Toán học', time_limit_minutes: 60 },
    { assignment_id: data.id, order_index: 1, title: 'Tư duy Đọc hiểu', time_limit_minutes: 30 },
    { assignment_id: data.id, order_index: 2, title: 'Tư duy Khoa học / Giải quyết vấn đề', time_limit_minutes: 60 },
  ]
  const { error: secErr } = await supabase.from('exam_sections').insert(sections)
  if (secErr) throw secErr

  return data
}

/** Danh sách phần thi của đề TSA. */
export interface ExamSectionRow {
  id: string
  assignment_id: string
  order_index: number
  title: string
  time_limit_minutes: number
}

export async function listExamSections(assignmentId: string): Promise<ExamSectionRow[]> {
  const { data, error } = await supabase
    .from('exam_sections')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as ExamSectionRow[]
}

/** Tải danh sách đoạn văn/nhóm câu hỏi. */
export interface QuestionGroupRow {
  id: string
  assignment_id: string
  section_id: string | null
  order_index: number
  title: string | null
  content: string
}

export async function listQuestionGroups(assignmentId: string): Promise<QuestionGroupRow[]> {
  const { data, error } = await supabase
    .from('question_groups')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []) as QuestionGroupRow[]
}

export async function createQuestionGroup(
  assignmentId: string,
  sectionId: string | null,
  title: string | null,
  content: string,
  orderIndex: number,
): Promise<QuestionGroupRow> {
  const { data, error } = await supabase
    .from('question_groups')
    .insert({ assignment_id: assignmentId, section_id: sectionId, order_index: orderIndex, title, content })
    .select('*')
    .single()
  if (error) throw error
  return data as QuestionGroupRow
}

export async function updateQuestionGroup(
  id: string,
  patch: { title?: string | null; content?: string },
): Promise<void> {
  const { error } = await supabase.from('question_groups').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteQuestionGroup(id: string): Promise<void> {
  const { error } = await supabase.from('question_groups').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error('Nhóm câu hỏi này có câu liên kết, không xoá được.')
    throw error
  }
}

// ---- Soạn câu hỏi (trắc nghiệm chuẩn: 3 loại câu) ----

export interface EditorChoice {
  content: string
  is_correct: boolean
  blank_no?: number | null
}

export interface EditorQuestion {
  key: string
  kind: QuestionKind
  content: string
  points: number
  multiple_correct: boolean
  choices: EditorChoice[] // multiple_choice + true_false + drag_drop
  answer_keys: string[] // short_answer: các đáp án chấp nhận
  explanation: string // lời giải
  section_id: string | null
  group_id: string | null
}

/** Tải toàn bộ câu hỏi của bài để soạn (gồm đáp án, lời giải — chỉ giáo viên đọc được). */
export async function loadEditorQuestions(assignmentId: string): Promise<EditorQuestion[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(
      '*, choices(content, is_correct, order_index, blank_no), question_answer_keys(answer), question_solutions(explanation)',
    )
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true })
  if (error) throw error

  type Row = {
    id: string
    kind: QuestionKind
    content: string
    points: number
    multiple_correct: boolean
    section_id: string | null
    group_id: string | null
    choices: { content: string; is_correct: boolean; order_index: number; blank_no: number | null }[]
    question_answer_keys: { answer: string }[]
    question_solutions: { explanation: string }[]
  }

  return (data as unknown as Row[]).map((q) => ({
    key: q.id,
    kind: q.kind,
    content: q.content,
    points: Number(q.points),
    multiple_correct: q.multiple_correct,
    choices: [...q.choices]
      .sort((a, b) => a.order_index - b.order_index)
      .map((c) => ({ content: c.content, is_correct: c.is_correct, blank_no: c.blank_no })),
    answer_keys: q.question_answer_keys.map((k) => k.answer),
    explanation: q.question_solutions[0]?.explanation ?? '',
    section_id: q.section_id,
    group_id: q.group_id,
  }))
}

/**
 * Ghi lại toàn bộ câu hỏi của bài: xoá hết câu cũ rồi tạo lại theo thứ tự hiện tại.
 * Chỉ dùng khi soạn đề (trước khi học sinh làm). Xoá câu sẽ xoá kèm đáp án/bài làm liên quan.
 */
export async function saveEditorQuestions(
  assignmentId: string,
  questions: EditorQuestion[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('questions')
    .delete()
    .eq('assignment_id', assignmentId)
  if (delErr) {
    if (delErr.code === '23503') {
      throw new Error('Bài tập đã có học sinh làm nên không sửa câu hỏi được nữa.')
    }
    throw delErr
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const { data: inserted, error: qErr } = await supabase
      .from('questions')
      .insert({
        assignment_id: assignmentId,
        order_index: i,
        kind: q.kind,
        content: q.content,
        points: q.points,
        multiple_correct: q.kind === 'multiple_choice' ? q.multiple_correct : false,
        section_id: q.section_id ?? null,
        group_id: q.group_id ?? null,
      })
      .select('id')
      .single()
    if (qErr) throw qErr
    const questionId = inserted.id

    if (q.kind === 'multiple_choice' || q.kind === 'true_false') {
      const rows = q.choices.map((c, idx) => ({
        question_id: questionId,
        order_index: idx,
        content: c.content,
        is_correct: c.is_correct,
      }))
      if (rows.length) {
        const { error } = await supabase.from('choices').insert(rows)
        if (error) throw error
      }
    } else if (q.kind === 'short_answer') {
      const rows = q.answer_keys
        .map((a) => a.trim())
        .filter(Boolean)
        .map((answer) => ({ question_id: questionId, answer }))
      if (rows.length) {
        const { error } = await supabase.from('question_answer_keys').insert(rows)
        if (error) throw error
      }
    } else if (q.kind === 'drag_drop') {
      const rows = q.choices.map((c, idx) => ({
        question_id: questionId,
        order_index: idx,
        content: c.content,
        is_correct: false,
        blank_no: c.blank_no ?? null,
      }))
      if (rows.length) {
        const { error } = await supabase.from('choices').insert(rows)
        if (error) throw error
      }
    }

    if (q.explanation.trim()) {
      const { error } = await supabase
        .from('question_solutions')
        .insert({ question_id: questionId, explanation: q.explanation.trim() })
      if (error) throw error
    }
  }
}

/** Tổng điểm tối đa của đề = tổng điểm các câu. */
export function totalPoints(questions: { points: number }[]): number {
  return questions.reduce((s, q) => s + (Number(q.points) || 0), 0)
}
