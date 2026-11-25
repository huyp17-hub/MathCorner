import { FileUp, ImagePlus, Loader2, Paperclip, Send, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteSubmissionFile,
  getLatestSubmission,
  getQuestionIdFromPath,
  listSubmissionFiles,
  loadEssayQuestions,
  saveAnswer,
  saveEssay,
  startAttempt,
  submitEssay,
  uploadSubmissionFile,
  validateFile,
  type EssayQuestion,
  type SubmissionFile,
} from '@/lib/api/quiz'
import { getEssayDetail, type EssayDetail } from '@/lib/api/submissions'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { submissionLabel, submissionTone } from '@/lib/types'

type Mode = 'loading' | 'edit' | 'done' | 'error'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface QuestionState {
  question: EssayQuestion
  textAnswer: string
  files: SubmissionFile[]
}

export default function SubmitEssay({
  assignmentId,
  studentId,
  title,
  onExit,
}: {
  assignmentId: string
  studentId: string
  title: string
  onExit: () => void
}) {
  const [mode, setMode] = useState<Mode>('loading')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuestionState[]>([])
  const [legacyText, setLegacyText] = useState('')
  const [legacyFiles, setLegacyFiles] = useState<SubmissionFile[]>([])
  const [hasQuestions, setHasQuestions] = useState(false)
  const [detail, setDetail] = useState<EssayDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const activeQuestionRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const latest = await getLatestSubmission(assignmentId, studentId)
        if (latest && latest.status !== 'in_progress') {
          const d = await getEssayDetail(latest.id)
          if (active) {
            setDetail(d)
            setMode('done')
          }
          return
        }

        const sub = await startAttempt(assignmentId)
        const qs = await loadEssayQuestions(assignmentId)
        const allFiles = await listSubmissionFiles(sub.id)

        if (!active) return

        setSubmissionId(sub.id)

        if (qs.length > 0) {
          setHasQuestions(true)
          const filesByQ = new Map<string, SubmissionFile[]>()
          const orphanFiles: SubmissionFile[] = []
          for (const f of allFiles) {
            const qId = getQuestionIdFromPath(f.storage_path)
            if (qId) {
              if (!filesByQ.has(qId)) filesByQ.set(qId, [])
              filesByQ.get(qId)!.push(f)
            } else {
              orphanFiles.push(f)
            }
          }

          const { data: existingAnswers } = await supabase
            .from('answers')
            .select('question_id, text_answer')
            .eq('submission_id', sub.id)
          const answerMap = new Map(
            (existingAnswers ?? []).map((a) => [a.question_id, a.text_answer ?? '']),
          )

          setQuestions(
            qs.map((q) => ({
              question: q,
              textAnswer: answerMap.get(q.id) ?? '',
              files: filesByQ.get(q.id) ?? [],
            })),
          )
          setLegacyFiles(orphanFiles)
        } else {
          setHasQuestions(false)
          setLegacyText(sub.essay_text ?? '')
          setLegacyFiles(allFiles)
        }

        setMode('edit')
      } catch (e) {
        if (!active) return
        try {
          const latest = await getLatestSubmission(assignmentId, studentId)
          if (latest) {
            const d = await getEssayDetail(latest.id)
            if (active) {
              setDetail(d)
              setMode('done')
            }
            return
          }
        } catch {
          /* bỏ qua */
        }
        setError(e instanceof Error ? e.message : 'Không mở được bài làm.')
        setMode('error')
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [assignmentId, studentId])

  const updateQuestionText = useCallback((questionId: string, text: string) => {
    setQuestions((prev) =>
      prev.map((qs) =>
        qs.question.id === questionId ? { ...qs, textAnswer: text } : qs,
      ),
    )
    setSavedNote(null)
  }, [])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!submissionId || picked.length === 0) return
    const questionId = activeQuestionRef.current
    setError(null)
    setUploading(questionId ?? '__legacy')
    try {
      for (const f of picked) {
        const err = validateFile(f)
        if (err) {
          setError(`${f.name}: ${err}`)
          continue
        }
        const row = await uploadSubmissionFile(
          assignmentId,
          studentId,
          submissionId,
          f,
          questionId ?? undefined,
        )
        if (questionId) {
          setQuestions((prev) =>
            prev.map((qs) =>
              qs.question.id === questionId
                ? { ...qs, files: [...qs.files, row] }
                : qs,
            ),
          )
        } else {
          setLegacyFiles((prev) => [...prev, row])
        }
      }
    } catch {
      setError('Không tải được file lên. Bạn thử lại nhé.')
    } finally {
      setUploading(null)
    }
  }

  async function onRemoveFile(f: SubmissionFile, questionId?: string) {
    try {
      await deleteSubmissionFile(f)
      if (questionId) {
        setQuestions((prev) =>
          prev.map((qs) =>
            qs.question.id === questionId
              ? { ...qs, files: qs.files.filter((x) => x.id !== f.id) }
              : qs,
          ),
        )
      } else {
        setLegacyFiles((prev) => prev.filter((x) => x.id !== f.id))
      }
    } catch {
      setError('Không xoá được file.')
    }
  }

  async function onSaveDraft() {
    if (!submissionId) return
    setSaving(true)
    setSavedNote(null)
    try {
      if (hasQuestions) {
        for (const qs of questions) {
          await saveAnswer({
            submission_id: submissionId,
            question_id: qs.question.id,
            text_answer: qs.textAnswer || null,
          })
        }
      }
      await saveEssay(submissionId, hasQuestions ? '' : legacyText)
      setSavedNote('Đã lưu nháp ✓')
    } catch {
      setError('Không lưu được nháp.')
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit() {
    if (!submissionId) return
    setSaving(true)
    try {
      if (hasQuestions) {
        for (const qs of questions) {
          await saveAnswer({
            submission_id: submissionId,
            question_id: qs.question.id,
            text_answer: qs.textAnswer || null,
          })
        }
      }
      await submitEssay(submissionId, hasQuestions ? '' : legacyText)
      const d = await getEssayDetail(submissionId)
      setDetail(d)
      setMode('done')
    } catch {
      setError('Không nộp được bài. Bạn thử lại nhé.')
      setSaving(false)
      setConfirming(false)
    }
  }

  function triggerFileUpload(questionId: string | null) {
    activeQuestionRef.current = questionId
    fileRef.current?.click()
  }

  if (mode === 'loading') {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-black/[0.04]" />
  }

  if (mode === 'error') {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="font-semibold">{error}</p>
          <Button variant="outline" onClick={onExit}>
            Quay lại
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (mode === 'done' && detail) {
    return (
      <DoneView
        title={title}
        detail={detail}
        assignmentId={assignmentId}
        onExit={onExit}
      />
    )
  }

  // edit mode
  return (
    <div className="pb-28">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
        className="hidden"
        onChange={onPickFiles}
      />

      {hasQuestions ? (
        <>
          <p className="mt-1 text-muted-foreground">
            Gửi ảnh bài làm và điền đáp án cuối cùng cho mỗi câu.
          </p>
          <div className="mt-4 space-y-4">
            {questions.map((qs, i) => (
              <QuestionAnswerCard
                key={qs.question.id}
                index={i}
                qs={qs}
                uploading={uploading === qs.question.id}
                onTextChange={(text) => updateQuestionText(qs.question.id, text)}
                onUpload={() => triggerFileUpload(qs.question.id)}
                onRemoveFile={(f) => void onRemoveFile(f, qs.question.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <LegacyEditor
          text={legacyText}
          files={legacyFiles}
          uploading={uploading === '__legacy'}
          error={error}
          onTextChange={(t) => {
            setLegacyText(t)
            setSavedNote(null)
          }}
          onUpload={() => triggerFileUpload(null)}
          onRemoveFile={(f) => void onRemoveFile(f)}
        />
      )}

      {error && (
        <p className="mt-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-border bg-card/90 backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <span className="text-sm text-ok-foreground">{savedNote}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void onSaveDraft()} loading={saving && !confirming}>
              Lưu nháp
            </Button>
            <Button onClick={() => setConfirming(true)}>
              <Send className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Nộp bài
            </Button>
          </div>
        </div>
      </div>

      {confirming && (
        <Dialog
          open
          onClose={() => !saving && setConfirming(false)}
          title="Nộp bài?"
          description="Nộp rồi bạn sẽ không sửa được nữa."
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                Xem lại
              </Button>
              <Button onClick={() => void onSubmit()} loading={saving}>
                Nộp bài
              </Button>
            </>
          }
        />
      )}
    </div>
  )
}

function QuestionAnswerCard({
  index,
  qs,
  uploading,
  onTextChange,
  onUpload,
  onRemoveFile,
}: {
  index: number
  qs: QuestionState
  uploading: boolean
  onTextChange: (text: string) => void
  onUpload: () => void
  onRemoveFile: (f: SubmissionFile) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-baseline gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-softer text-sm font-bold text-primary-foreground">
            {index + 1}
          </span>
          <span className="text-xs text-muted-foreground">{qs.question.points} điểm</span>
        </div>

        <div className="rounded-xl border border-border bg-background px-3 py-2">
          <MarkdownContent>{qs.question.content}</MarkdownContent>
        </div>

        <div>
          <Label className="mb-1.5 flex items-center gap-1.5">
            <ImagePlus className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Ảnh bài làm
          </Label>

          {qs.files.length > 0 && (
            <div className="mb-2 space-y-2">
              {qs.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.file_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <button
                    onClick={() => onRemoveFile(f)}
                    aria-label="Xoá file"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-danger-foreground hover:bg-danger"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onUpload}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            Tải ảnh lên
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">PDF, ảnh, Word · tối đa 10 MB.</p>
        </div>

        <div>
          <Label htmlFor={`answer-${qs.question.id}`}>Đáp án cuối cùng</Label>
          <Input
            id={`answer-${qs.question.id}`}
            value={qs.textAnswer}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Nhập đáp án cuối cùng…"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function LegacyEditor({
  text,
  files,
  uploading,
  error,
  onTextChange,
  onUpload,
  onRemoveFile,
}: {
  text: string
  files: SubmissionFile[]
  uploading: boolean
  error: string | null
  onTextChange: (text: string) => void
  onUpload: () => void
  onRemoveFile: (f: SubmissionFile) => void
}) {
  return (
    <>
      <p className="mt-1 text-muted-foreground">Gõ câu trả lời và/hoặc tải file lên (PDF, ảnh, Word).</p>
      <Card className="mt-4">
        <CardContent className="space-y-4 p-5">
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Trình bày lời giải ở đây…"
          />
          <div>
            <Button variant="outline" type="button" onClick={onUpload} disabled={uploading}>
              {uploading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              Tải file lên
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">Tối đa 10 MB mỗi file.</p>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2"
                  >
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.file_name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                    <button
                      onClick={() => onRemoveFile(f)}
                      aria-label="Xoá file"
                      className="grid size-8 shrink-0 place-items-center rounded-full text-danger-foreground hover:bg-danger"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && (
            <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function DoneView({
  title,
  detail,
  assignmentId,
  onExit,
}: {
  title: string
  detail: EssayDetail
  assignmentId: string
  onExit: () => void
}) {
  const [questions, setQuestions] = useState<EssayQuestion[]>([])
  const [answerMap, setAnswerMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let active = true
    async function load() {
      const qs = await loadEssayQuestions(assignmentId)
      if (!active || qs.length === 0) return
      setQuestions(qs)
      const { data: answers } = await supabase
        .from('answers')
        .select('question_id, text_answer')
        .eq('submission_id', detail.submission_id)
      if (!active) return
      setAnswerMap(new Map((answers ?? []).map((a) => [a.question_id, a.text_answer ?? ''])))
    }
    void load()
    return () => { active = false }
  }, [assignmentId, detail.submission_id])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <div className="mt-2">
        <Badge tone={submissionTone(detail.status, detail.is_late)} variant="soft">
          {submissionLabel(detail.status, detail.is_late)}
        </Badge>
      </div>

      {detail.status === 'graded' && (
        <Card className="mt-4">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground">Điểm</p>
            <p className="text-3xl font-bold tracking-tight">
              {detail.score ?? '—'}
              {detail.max_score != null && (
                <span className="text-lg text-muted-foreground">/{detail.max_score}</span>
              )}
            </p>
            {detail.teacher_comment && (
              <div className="mt-3 rounded-2xl bg-warn/60 p-3">
                <p className="text-xs font-semibold text-warn-foreground">Nhận xét của giáo viên</p>
                <p className="mt-1 whitespace-pre-wrap text-[15px]">{detail.teacher_comment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {questions.length > 0 ? (
        <div className="mt-4 space-y-3">
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="p-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold">Câu {i + 1}.</span>
                  <span className="text-xs text-muted-foreground">{q.points} điểm</span>
                </div>
                <div className="mt-1">
                  <MarkdownContent>{q.content}</MarkdownContent>
                </div>
                <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground">Đáp án của bạn</p>
                  <p className="mt-0.5 text-[15px]">
                    {answerMap.get(q.id) || <span className="text-muted-foreground">Chưa điền</span>}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-4">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-muted-foreground">
              Bài làm {detail.submitted_at && `· nộp ${formatDateTime(detail.submitted_at)}`}
            </p>
            {detail.essay_text ? (
              <p className="mt-2 whitespace-pre-wrap text-[15px]">{detail.essay_text}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Không có phần trả lời bằng chữ.</p>
            )}
          </CardContent>
        </Card>
      )}

      {detail.files.length > 0 && (
        <Card className="mt-3">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">File đã nộp</p>
            <div className="space-y-2">
              {detail.files.map((f) => (
                <FileLink key={f.id} name={f.file_name} size={f.size} url={f.url} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="outline" className="mt-5" onClick={onExit}>
        Về danh sách bài tập
      </Button>
    </div>
  )
}

function FileLink({ name, size, url }: { name: string; size: number; url: string | null }) {
  const inner = (
    <>
      <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(size)}</span>
    </>
  )
  if (!url) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 opacity-60">
        {inner}
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 hover:bg-card"
    >
      {inner}
    </a>
  )
}
