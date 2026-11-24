import { FileUp, Loader2, Paperclip, Send, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteSubmissionFile,
  getLatestSubmission,
  listSubmissionFiles,
  saveEssay,
  startAttempt,
  submitEssay,
  uploadSubmissionFile,
  validateFile,
  type SubmissionFile,
} from '@/lib/api/quiz'
import { getEssayDetail, type EssayDetail } from '@/lib/api/submissions'
import { formatDateTime } from '@/lib/format'
import { submissionLabel, submissionTone } from '@/lib/types'

type Mode = 'loading' | 'edit' | 'done' | 'error'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
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
  const [text, setText] = useState('')
  const [files, setFiles] = useState<SubmissionFile[]>([])
  const [detail, setDetail] = useState<EssayDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        const fs = await listSubmissionFiles(sub.id)
        if (!active) return
        setSubmissionId(sub.id)
        setText(sub.essay_text ?? '')
        setFiles(fs)
        setMode('edit')
      } catch (e) {
        if (!active) return
        // Không mở được lượt mới (hết hạn / hết lượt) — thử xem bài đã nộp.
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

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!submissionId || picked.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const f of picked) {
        const err = validateFile(f)
        if (err) {
          setError(`${f.name}: ${err}`)
          continue
        }
        const row = await uploadSubmissionFile(assignmentId, studentId, submissionId, f)
        setFiles((prev) => [...prev, row])
      }
    } catch {
      setError('Không tải được file lên. Bạn thử lại nhé.')
    } finally {
      setUploading(false)
    }
  }

  async function onRemoveFile(f: SubmissionFile) {
    try {
      await deleteSubmissionFile(f)
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch {
      setError('Không xoá được file.')
    }
  }

  async function onSaveDraft() {
    if (!submissionId) return
    setSaving(true)
    setSavedNote(null)
    try {
      await saveEssay(submissionId, text)
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
      await submitEssay(submissionId, text)
      const d = await getEssayDetail(submissionId)
      setDetail(d)
      setMode('done')
    } catch {
      setError('Không nộp được bài. Bạn thử lại nhé.')
      setSaving(false)
      setConfirming(false)
    }
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
            {detail.files.length > 0 && (
              <div className="mt-4 space-y-2">
                {detail.files.map((f) => (
                  <FileLink key={f.id} name={f.file_name} size={f.size} url={f.url} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" className="mt-5" onClick={onExit}>
          Về danh sách bài tập
        </Button>
      </div>
    )
  }

  // edit
  return (
    <div className="pb-28">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-1 text-muted-foreground">Gõ câu trả lời và/hoặc tải file lên (PDF, ảnh, Word).</p>

      <Card className="mt-4">
        <CardContent className="space-y-4 p-5">
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSavedNote(null)
            }}
            placeholder="Trình bày lời giải ở đây…"
          />

          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx"
              className="hidden"
              onChange={onPickFiles}
            />
            <Button
              variant="outline"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
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
                      onClick={() => void onRemoveFile(f)}
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
