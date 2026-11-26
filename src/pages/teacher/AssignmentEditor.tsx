import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileDown,
  ImagePlus,
  ListChecks,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import {
  getAssignment,
  loadEditorQuestions,
  saveEditorQuestions,
  totalPoints,
  type EditorQuestion,
} from '@/lib/api/assignments'
import {
  downloadQuestionTemplate,
  exportQuestionsToExcel,
  parseQuestionsFromExcel,
  type ImportResult,
} from '@/lib/question-excel'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Assignment, QuestionKind } from '@/lib/types'

const kindLabel: Record<Exclude<QuestionKind, 'drag_drop'>, string> = {
  multiple_choice: 'Nhiều lựa chọn',
  true_false: 'Đúng / Sai',
  short_answer: 'Trả lời ngắn',
}

const quizKinds: Exclude<QuestionKind, 'drag_drop'>[] = ['multiple_choice', 'true_false', 'short_answer']

const STATEMENT_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

async function uploadQuestionImage(file: File, teacherId: string): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Ảnh quá lớn (tối đa 5 MB).')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${teacherId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('question-media').upload(path, file)
  if (error) throw new Error('Không tải được ảnh: ' + error.message)
  const { data } = supabase.storage.from('question-media').getPublicUrl(path)
  return data.publicUrl
}

let seq = 0
function defaultPoints(kind: QuestionKind): number {
  if (kind === 'true_false') return 1
  if (kind === 'short_answer') return 0.5
  return 0.25
}

function blankQuestion(kind: Exclude<QuestionKind, 'drag_drop'>): EditorQuestion {
  const q: EditorQuestion = {
    key: `new-${Date.now()}-${seq++}`,
    kind,
    content: '',
    points: defaultPoints(kind),
    multiple_correct: false,
    choices: [],
    answer_keys: [''],
    explanation: '',
    section_id: null,
    group_id: null,
  }
  if (kind === 'multiple_choice' || kind === 'true_false') {
    q.choices = Array.from({ length: 4 }, () => ({ content: '', is_correct: false }))
  }
  return q
}

/** Lỗi từng câu (hiển thị khi bấm Lưu). */
function validate(q: EditorQuestion, isEssayAssignment = false): string | null {
  if (!q.content.trim()) return 'Chưa nhập nội dung câu hỏi.'
  if (!(q.points > 0)) return 'Điểm phải lớn hơn 0.'
  if (isEssayAssignment) return null
  if (q.kind === 'multiple_choice') {
    const filled = q.choices.filter((c) => c.content.trim())
    if (filled.length < 2) return 'Cần ít nhất 2 phương án.'
    if (!q.choices.some((c) => c.is_correct && c.content.trim()))
      return 'Chưa chọn đáp án đúng.'
  }
  if (q.kind === 'true_false') {
    const filled = q.choices.filter((c) => c.content.trim())
    if (filled.length < 1) return 'Cần ít nhất 1 ý.'
  }
  if (q.kind === 'short_answer') {
    if (!q.answer_keys.some((a) => a.trim())) return 'Chưa nhập đáp án chấp nhận.'
  }
  return null
}

export default function AssignmentEditor() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [questions, setQuestions] = useState<EditorQuestion[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [preview, setPreview] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!assignmentId) return
    let active = true
    Promise.all([getAssignment(assignmentId), loadEditorQuestions(assignmentId)])
      .then(([a, qs]) => {
        if (!active) return
        setAssignment(a)
        setQuestions(qs)
      })
      .catch(() => active && setLoadError('Không tải được bài tập.'))
    return () => {
      active = false
    }
  }, [assignmentId])

  const update = useCallback((i: number, patch: Partial<EditorQuestion>) => {
    setQuestions((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[i] = { ...next[i], ...patch }
      return next
    })
    setSaved(false)
  }, [])

  function add(kind: Exclude<QuestionKind, 'drag_drop'>) {
    setQuestions((prev) => [...(prev ?? []), blankQuestion(kind)])
    setSaved(false)
  }
  function remove(i: number) {
    setQuestions((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev))
    setSaved(false)
  }
  function move(i: number, dir: -1 | 1) {
    setQuestions((prev) => {
      if (!prev) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setSaved(false)
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImporting(true)
    try {
      const isTsa = assignment?.exam_format === 'tsa'
      const result = await parseQuestionsFromExcel(file, isTsa)
      setImportResult(result)
    } catch {
      setImportResult({ questions: [], errors: [{ row: 0, message: 'Không đọc được file.' }] })
    } finally {
      setImporting(false)
    }
  }

  function confirmImport() {
    if (!importResult) return
    setQuestions((prev) => [...(prev ?? []), ...importResult.questions])
    setImportResult(null)
    setSaved(false)
  }

  async function handleExport() {
    if (!questions || questions.length === 0 || !assignment) return
    await exportQuestionsToExcel(questions, `${assignment.title}.xlsx`)
  }

  const isEssay = assignment?.type === 'essay'

  const errors = useMemo(
    () => (questions ? questions.map((q) => validate(q, isEssay)) : []),
    [questions, isEssay],
  )

  async function onSave() {
    if (!questions || !assignmentId) return
    if (errors.some((e) => e !== null)) {
      setShowErrors(true)
      setSaveError('Còn câu chưa hợp lệ — hãy sửa các dòng được đánh dấu đỏ.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await saveEditorQuestions(assignmentId, questions)
      setSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Không lưu được đề.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div>
        <BackLink />
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {loadError}
        </p>
      </div>
    )
  }

  if (!assignment || !questions) {
    return (
      <div>
        <BackLink />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  const total = totalPoints(questions)

  return (
    <div className="pb-28">
      <BackLink />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{assignment.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {questions.length} câu · Tổng điểm {total}
          </p>
        </div>
        <Button variant="outline" onClick={() => setPreview(true)} disabled={questions.length === 0}>
          <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Xem trước
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {isEssay ? (
          <Button variant="soft" size="sm" onClick={() => add('short_answer')}>
            <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Thêm câu tự luận
          </Button>
        ) : (
          quizKinds.map((k) => (
            <Button key={k} variant="soft" size="sm" onClick={() => add(k)}>
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {kindLabel[k]}
            </Button>
          ))
        )}
        <span className="mx-1 self-center text-border">|</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          loading={importing}
        >
          <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Nhập từ Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={questions.length === 0}
        >
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Xuất đề
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadQuestionTemplate}>
          <FileDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Tải file mẫu
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileSelected}
          className="hidden"
          aria-label="Chọn file Excel"
        />
      </div>

      {questions.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <ListChecks
              className="mx-auto size-8 text-muted-foreground"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="mt-2 font-semibold">Đề chưa có câu nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEssay
                ? 'Bấm "Thêm câu tự luận" để thêm câu hỏi vào đề.'
                : 'Chọn một loại câu ở trên để bắt đầu soạn.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <QuestionEditorCard
              key={q.key}
              index={i}
              total={questions.length}
              q={q}
              error={showErrors ? errors[i] : null}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onMove={(dir) => move(i, dir)}
              teacherId={user?.id ?? ''}
              isEssayAssignment={isEssay}
            />
          ))}
        </div>
      )}

      {/* Thanh lưu cố định đáy */}
      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-border bg-card/90 backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0 text-sm">
            {saveError ? (
              <span className="font-medium text-danger-foreground">{saveError}</span>
            ) : saved ? (
              <span className="font-medium text-ok-foreground">Đã lưu đề ✓</span>
            ) : (
              <span className="text-muted-foreground">
                {questions.length} câu · {total} điểm
              </span>
            )}
          </div>
          <Button onClick={onSave} loading={saving} disabled={questions.length === 0}>
            <Save className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Lưu đề
          </Button>
        </div>
      </div>

      {importResult && (
        <ImportPreviewDialog
          result={importResult}
          existingCount={questions.length}
          onConfirm={confirmImport}
          onClose={() => setImportResult(null)}
        />
      )}

      {preview && (
        <PreviewDialog
          title={assignment.title}
          questions={questions}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  )

  function BackLink() {
    return (
      <button
        onClick={() => navigate('/teacher/assignments')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Danh sách bài tập
      </button>
    )
  }
}

function QuestionEditorCard({
  index,
  total,
  q,
  error,
  onChange,
  onRemove,
  onMove,
  teacherId,
  isEssayAssignment = false,
}: {
  index: number
  total: number
  q: EditorQuestion
  error: string | null
  onChange: (patch: Partial<EditorQuestion>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  teacherId: string
  isEssayAssignment?: boolean
}) {
  function setChoice(idx: number, patch: Partial<EditorQuestion['choices'][number]>) {
    const choices = q.choices.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    onChange({ choices })
  }
  function pickSingleCorrect(idx: number) {
    onChange({ choices: q.choices.map((c, i) => ({ ...c, is_correct: i === idx })) })
  }

  return (
    <Card className={cn(error && 'border-danger-foreground/50')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-primary-softer text-sm font-bold text-primary-foreground">
              {index + 1}
            </span>
            <Badge tone="neutral" variant="soft">
              {isEssayAssignment ? 'Tự luận' : q.kind === 'drag_drop' ? 'Kéo thả' : kindLabel[q.kind]}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Lên trên"
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05] disabled:opacity-30"
            >
              <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={index === total - 1}
              aria-label="Xuống dưới"
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05] disabled:opacity-30"
            >
              <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              onClick={onRemove}
              aria-label="Xoá câu"
              className="grid size-8 place-items-center rounded-full text-danger-foreground hover:bg-danger"
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor={`${q.key}-content`}>
            {q.kind === 'true_false' ? 'Câu dẫn' : 'Nội dung câu hỏi'} (Markdown + $LaTeX$)
          </Label>
          <Textarea
            id={`${q.key}-content`}
            rows={2}
            value={q.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="VD: Giải phương trình $x^2 - 5x + 6 = 0$"
          />
          {q.content.trim() && (
            <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Xem trước</p>
              <MarkdownContent>{q.content}</MarkdownContent>
            </div>
          )}
          <ImageUploadButton
            teacherId={teacherId}
            onUploaded={(url) => {
              const md = `\n![](${url})\n`
              onChange({ content: q.content + md })
            }}
          />
        </div>

        {!isEssayAssignment && q.kind === 'multiple_choice' && (
          <MultipleChoiceEditor q={q} onChange={onChange} setChoice={setChoice} pickSingle={pickSingleCorrect} />
        )}
        {!isEssayAssignment && q.kind === 'true_false' && <TrueFalseEditor q={q} onChange={onChange} setChoice={setChoice} />}
        {!isEssayAssignment && q.kind === 'short_answer' && <ShortAnswerEditor q={q} onChange={onChange} />}

        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="w-28">
            <Label htmlFor={`${q.key}-points`}>Điểm</Label>
            <Input
              id={`${q.key}-points`}
              type="number"
              min={0}
              step={0.25}
              value={q.points}
              onChange={(e) => onChange({ points: Number(e.target.value) })}
            />
          </div>
        </div>

        <details className="rounded-xl bg-background px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
            Lời giải (tuỳ chọn)
          </summary>
          <Textarea
            className="mt-2"
            rows={2}
            value={q.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Giải thích, hiện khi học sinh xem lại bài."
          />
        </details>

        {error && <p className="text-sm font-medium text-danger-foreground">{error}</p>}
      </CardContent>
    </Card>
  )
}

function MultipleChoiceEditor({
  q,
  onChange,
  setChoice,
  pickSingle,
}: {
  q: EditorQuestion
  onChange: (patch: Partial<EditorQuestion>) => void
  setChoice: (idx: number, patch: Partial<EditorQuestion['choices'][number]>) => void
  pickSingle: (idx: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={q.multiple_correct}
          onChange={(e) => {
            const multiple = e.target.checked
            // Khi chuyển về một đáp án, chỉ giữ đáp án đúng đầu tiên.
            if (!multiple) {
              const firstCorrect = q.choices.findIndex((c) => c.is_correct)
              onChange({
                multiple_correct: false,
                choices: q.choices.map((c, i) => ({ ...c, is_correct: i === firstCorrect })),
              })
            } else {
              onChange({ multiple_correct: true })
            }
          }}
          className="size-4 accent-primary"
        />
        Có nhiều đáp án đúng
      </label>
      {q.choices.map((c, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type={q.multiple_correct ? 'checkbox' : 'radio'}
            name={`${q.key}-correct`}
            checked={c.is_correct}
            aria-label={`Đáp án đúng ${idx + 1}`}
            onChange={() =>
              q.multiple_correct ? setChoice(idx, { is_correct: !c.is_correct }) : pickSingle(idx)
            }
            className="size-5 shrink-0 accent-ok-foreground"
          />
          <Input
            value={c.content}
            onChange={(e) => setChoice(idx, { content: e.target.value })}
            placeholder={`Phương án ${idx + 1}`}
          />
          <button
            onClick={() => onChange({ choices: q.choices.filter((_, i) => i !== idx) })}
            disabled={q.choices.length <= 2}
            aria-label="Xoá phương án"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05] disabled:opacity-30"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ choices: [...q.choices, { content: '', is_correct: false }] })}
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Thêm phương án
      </Button>
    </div>
  )
}

function TrueFalseEditor({
  q,
  onChange,
  setChoice,
}: {
  q: EditorQuestion
  onChange: (patch: Partial<EditorQuestion>) => void
  setChoice: (idx: number, patch: Partial<EditorQuestion['choices'][number]>) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Chọn Đúng/Sai cho từng ý.</p>
      {q.choices.map((c, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">
            {STATEMENT_LETTERS[idx] ?? idx + 1})
          </span>
          <Input
            value={c.content}
            onChange={(e) => setChoice(idx, { content: e.target.value })}
            placeholder={`Ý ${STATEMENT_LETTERS[idx] ?? idx + 1}`}
          />
          <div className="flex shrink-0 overflow-hidden rounded-full border border-border">
            <button
              onClick={() => setChoice(idx, { is_correct: true })}
              aria-pressed={c.is_correct}
              className={cn(
                'px-3 py-2 text-sm font-semibold',
                c.is_correct ? 'bg-ok text-ok-foreground' : 'text-muted-foreground',
              )}
            >
              Đúng
            </button>
            <button
              onClick={() => setChoice(idx, { is_correct: false })}
              aria-pressed={!c.is_correct}
              className={cn(
                'px-3 py-2 text-sm font-semibold',
                !c.is_correct ? 'bg-danger text-danger-foreground' : 'text-muted-foreground',
              )}
            >
              Sai
            </button>
          </div>
          <button
            onClick={() => onChange({ choices: q.choices.filter((_, i) => i !== idx) })}
            disabled={q.choices.length <= 1}
            aria-label="Xoá ý"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05] disabled:opacity-30"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ choices: [...q.choices, { content: '', is_correct: false }] })}
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Thêm ý
      </Button>
    </div>
  )
}

function ShortAnswerEditor({
  q,
  onChange,
}: {
  q: EditorQuestion
  onChange: (patch: Partial<EditorQuestion>) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Các đáp án được chấp nhận (không phân biệt hoa thường, 0,5 = 0.5).
      </p>
      {q.answer_keys.map((a, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={a}
            onChange={(e) =>
              onChange({ answer_keys: q.answer_keys.map((x, i) => (i === idx ? e.target.value : x)) })
            }
            placeholder="VD: 0,5"
          />
          <button
            onClick={() => onChange({ answer_keys: q.answer_keys.filter((_, i) => i !== idx) })}
            disabled={q.answer_keys.length <= 1}
            aria-label="Xoá đáp án"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05] disabled:opacity-30"
          >
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange({ answer_keys: [...q.answer_keys, ''] })}
      >
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Thêm đáp án chấp nhận
      </Button>
    </div>
  )
}

function ImageUploadButton({
  teacherId,
  onUploaded,
}: {
  teacherId: string
  onUploaded: (url: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (ref.current) ref.current.value = ''
    if (!file || !teacherId) return
    setUploading(true)
    setErr(null)
    try {
      const url = await uploadQuestionImage(file, teacherId)
      onUploaded(url)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Lỗi tải ảnh.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => ref.current?.click()}
        loading={uploading}
      >
        <ImagePlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Thêm hình minh hoạ
      </Button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={handleFile}
        className="hidden"
        aria-label="Chọn ảnh minh hoạ"
      />
      {err && <span className="text-xs text-danger-foreground">{err}</span>}
    </div>
  )
}

/** Xem trước danh sách câu nhập từ Excel, đánh dấu lỗi từng dòng. */
function ImportPreviewDialog({
  result,
  existingCount,
  onConfirm,
  onClose,
}: {
  result: ImportResult
  existingCount: number
  onConfirm: () => void
  onClose: () => void
}) {
  const { questions: qs, errors } = result
  return (
    <Dialog open onClose={onClose} title="Nhập câu hỏi từ Excel">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Đọc được <strong>{qs.length}</strong> câu hợp lệ
          {errors.length > 0 && (
            <>
              , <span className="font-semibold text-danger-foreground">{errors.length} dòng lỗi</span>
            </>
          )}
          .
          {existingCount > 0 && ` Sẽ thêm vào cuối đề (hiện có ${existingCount} câu).`}
        </p>

        {errors.length > 0 && (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-danger-foreground/20 bg-danger/50 p-3">
            <p className="mb-1.5 text-sm font-semibold text-danger-foreground">Dòng lỗi:</p>
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-danger-foreground">
                {e.row > 0 ? `Dòng ${e.row}: ` : ''}
                {e.message}
              </p>
            ))}
          </div>
        )}

        {qs.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Loại</th>
                  <th className="px-3 py-1.5">Câu hỏi</th>
                  <th className="px-3 py-1.5 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {qs.map((q, i) => (
                  <tr key={q.key} className="border-b border-border/50">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone="neutral" variant="soft">
                        {q.kind === 'drag_drop'
                          ? 'Kéo thả'
                          : kindLabel[q.kind as keyof typeof kindLabel] ?? q.kind}
                      </Badge>
                    </td>
                    <td className="max-w-[300px] truncate px-3 py-1.5">{q.content}</td>
                    <td className="px-3 py-1.5 text-right">{q.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={onConfirm} disabled={qs.length === 0}>
            Thêm {qs.length} câu
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** Xem trước toàn đề như học sinh thấy (không lộ đáp án). */
function PreviewDialog({
  title,
  questions,
  onClose,
}: {
  title: string
  questions: EditorQuestion[]
  onClose: () => void
}) {
  return (
    <Dialog open onClose={onClose} title={`Xem trước: ${title}`}>
      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.key} className="border-b border-border pb-4 last:border-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold">Câu {i + 1}.</span>
              <span className="text-xs text-muted-foreground">{q.points} điểm</span>
            </div>
            <div className="mt-1">
              <MarkdownContent>{q.content}</MarkdownContent>
            </div>
            {q.kind === 'multiple_choice' && (
              <ul className="mt-2 space-y-1.5">
                {q.choices
                  .filter((c) => c.content.trim())
                  .map((c, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[15px]">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center border border-border text-xs',
                          q.multiple_correct ? 'rounded' : 'rounded-full',
                        )}
                        aria-hidden="true"
                      />
                      <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
                    </li>
                  ))}
              </ul>
            )}
            {q.kind === 'true_false' && (
              <ul className="mt-2 space-y-1.5">
                {q.choices
                  .filter((c) => c.content.trim())
                  .map((c, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 text-[15px]">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-muted-foreground">
                          {STATEMENT_LETTERS[idx] ?? idx + 1})
                        </span>
                        <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">Đúng / Sai</span>
                    </li>
                  ))}
              </ul>
            )}
            {q.kind === 'short_answer' && (
              <div className="mt-2 h-10 w-40 rounded-xl border border-dashed border-border bg-background" />
            )}
          </div>
        ))}
      </div>
    </Dialog>
  )
}
