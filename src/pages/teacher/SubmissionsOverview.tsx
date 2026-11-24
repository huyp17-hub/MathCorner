import { ArrowLeft, Eye, PenLine } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import QuizResult from '@/pages/student/QuizResult'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  getEssayDetail,
  gradeEssay,
  overviewSubmissions,
  type EssayDetail,
  type Overview,
  type OverviewRow,
} from '@/lib/api/submissions'
import { formatDateTime } from '@/lib/format'
import { submissionLabel, submissionTone } from '@/lib/types'

export default function SubmissionsOverview() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [grading, setGrading] = useState<OverviewRow | null>(null)
  const [viewingQuiz, setViewingQuiz] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!assignmentId) return
    setData(null)
    setError(null)
    try {
      setData(await overviewSubmissions(assignmentId))
    } catch {
      setError('Không tải được danh sách bài nộp.')
    }
  }, [assignmentId])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const rows = data?.rows ?? []
    const done = rows.filter((r) => r.status === 'submitted' || r.status === 'graded')
    const graded = rows.filter((r) => r.status === 'graded')
    const scored = graded.filter((r) => r.score != null)
    const avg = scored.length ? scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length : null
    return { total: rows.length, done: done.length, graded: graded.length, avg }
  }, [data])

  return (
    <div>
      <button
        onClick={() => navigate('/teacher/assignments')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Danh sách bài tập
      </button>

      <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
        {data ? data.title : 'Bài nộp'}
      </h1>
      <p className="mt-1 text-muted-foreground">Theo dõi ai đã nộp và chấm bài.</p>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {data === null && !error ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Đã nộp" value={`${stats.done}/${stats.total}`} />
            <Stat label="Đã chấm" value={`${stats.graded}`} />
            <Stat label="Điểm TB" value={stats.avg != null ? stats.avg.toFixed(2) : '—'} />
          </div>

          <div className="mt-4 space-y-2">
            {data.rows.map((r) => (
              <Card key={r.student_id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.full_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={submissionTone(r.status, r.is_late)} variant="soft">
                        {submissionLabel(r.status, r.is_late)}
                      </Badge>
                      {r.status === 'graded' && r.score != null && (
                        <span className="text-sm font-semibold">
                          {r.score}
                          {r.max_score != null && (
                            <span className="text-muted-foreground">/{r.max_score}</span>
                          )}{' '}
                          điểm
                        </span>
                      )}
                      {r.submitted_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(r.submitted_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.submission_id && (r.status === 'submitted' || r.status === 'graded') && (
                    <div className="shrink-0">
                      {data.type === 'essay' ? (
                        <Button variant={r.status === 'graded' ? 'outline' : 'soft'} size="sm" onClick={() => setGrading(r)}>
                          <PenLine className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          {r.status === 'graded' ? 'Sửa điểm' : 'Chấm'}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setViewingQuiz(r.submission_id)}>
                          <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
                          Xem bài
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {data.rows.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Lớp chưa có học sinh.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      ) : null}

      {grading && grading.submission_id && (
        <GradeEssayDialog
          row={grading}
          submissionId={grading.submission_id}
          onClose={() => setGrading(null)}
          onDone={() => {
            setGrading(null)
            void load()
          }}
        />
      )}

      {viewingQuiz && (
        <Dialog open onClose={() => setViewingQuiz(null)} title="Bài làm trắc nghiệm" className="max-w-2xl">
          <QuizResult
            submissionId={viewingQuiz}
            audience="teacher"
            exitLabel="Đóng"
            onExit={() => setViewingQuiz(null)}
          />
        </Dialog>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function GradeEssayDialog({
  row,
  submissionId,
  onClose,
  onDone,
}: {
  row: OverviewRow
  submissionId: string
  onClose: () => void
  onDone: () => void
}) {
  const [detail, setDetail] = useState<EssayDetail | null>(null)
  const [score, setScore] = useState('')
  const [maxScore, setMaxScore] = useState('10')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getEssayDetail(submissionId)
      .then((d) => {
        if (!active) return
        setDetail(d)
        if (d.score != null) setScore(String(d.score))
        if (d.max_score != null) setMaxScore(String(d.max_score))
        if (d.teacher_comment) setComment(d.teacher_comment)
      })
      .catch(() => active && setError('Không tải được bài làm.'))
    return () => {
      active = false
    }
  }, [submissionId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await gradeEssay(submissionId, {
        score: Number(score),
        max_score: maxScore ? Number(maxScore) : null,
        comment: comment.trim() || null,
      })
      onDone()
    } catch {
      setError('Không lưu được điểm. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Chấm bài — ${row.full_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="grade-form" loading={saving}>
            Lưu điểm
          </Button>
        </>
      }
    >
      {!detail ? (
        <div className="h-32 animate-pulse rounded-2xl bg-black/[0.04]" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Bài làm của học sinh</p>
            {detail.essay_text ? (
              <p className="mt-1 whitespace-pre-wrap text-[15px]">{detail.essay_text}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Không có phần trả lời bằng chữ.</p>
            )}
            {detail.files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {detail.files.map((f) =>
                  f.url ? (
                    <li key={f.id}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-info hover:underline"
                      >
                        {f.file_name}
                      </a>
                    </li>
                  ) : (
                    <li key={f.id} className="text-sm text-muted-foreground">
                      {f.file_name}
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <form id="grade-form" onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="g-score">Điểm</Label>
                <Input
                  id="g-score"
                  type="number"
                  min={0}
                  step={0.25}
                  required
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="g-max">Trên thang</Label>
                <Input
                  id="g-max"
                  type="number"
                  min={1}
                  step={0.5}
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="g-comment">Nhận xét</Label>
              <Textarea
                id="g-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Nhận xét cho học sinh…"
              />
            </div>
            {error && (
              <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
                {error}
              </p>
            )}
          </form>
        </div>
      )}
    </Dialog>
  )
}
