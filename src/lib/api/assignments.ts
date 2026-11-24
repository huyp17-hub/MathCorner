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

// ---- Soạn câu hỏi (trắc nghiệm chuẩn: 3 loại câu) ----

export interface EditorChoice {
  content: string
  is_correct: boolean
}

export interface EditorQuestion {
  // id của câu đã lưu (chỉ để React key); khi lưu sẽ ghi lại toàn bộ.
  key: string
  kind: QuestionKind
  content: string
  points: number
  multiple_correct: boolean
  choices: EditorChoice[] // multiple_choice + true_false (mỗi dòng là một ý a/b/c/d)
  answer_keys: string[] // short_answer: các đáp án chấp nhận
  explanation: string // lời giải
}

/** Tải toàn bộ câu hỏi của bài để soạn (gồm đáp án, lời giải — chỉ giáo viên đọc được). */
export async function loadEditorQuestions(assignmentId: string): Promise<EditorQuestion[]> {
  const { data, error } = await supabase
    .from('questions')
    .select(
      '*, choices(content, is_correct, order_index), question_answer_keys(answer), question_solutions(explanation)',
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
    choices: { content: string; is_correct: boolean; order_index: number }[]
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
      .map((c) => ({ content: c.content, is_correct: c.is_correct })),
    answer_keys: q.question_answer_keys.map((k) => k.answer),
    explanation: q.question_solutions[0]?.explanation ?? '',
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
