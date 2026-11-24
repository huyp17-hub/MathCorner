import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { getQuizReview, type QuizReview, type ReviewQuestion } from '@/lib/api/quiz'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const letter = (i: number) => LETTERS[i] ?? String(i + 1)

export default function QuizResult({
  submissionId,
  summary,
  canRetake,
  onRetake,
  onExit,
  audience = 'student',
  exitLabel = 'Về danh sách bài tập',
}: {
  submissionId: string
  summary?: { score: number | null; max_score: number | null }
  canRetake?: boolean
  onRetake?: () => void
  onExit: () => void
  audience?: 'student' | 'teacher'
  exitLabel?: string
}) {
  const [review, setReview] = useState<QuizReview | null>(null)
  const [locked, setLocked] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getQuizReview(submissionId)
      .then((r) => active && setReview(r))
      .catch((e) => {
        if (!active) return
        setLocked(e instanceof Error ? e.message : 'Chưa xem được đáp án.')
      })
    return () => {
      active = false
    }
  }, [submissionId])

  const score = review?.score ?? summary?.score ?? null
  const maxScore = review?.max_score ?? summary?.max_score ?? null

  return (
    <div>
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">Kết quả</p>
          <p className="text-4xl font-bold tracking-tight">
            {score != null ? score : '—'}
            {maxScore != null && <span className="text-xl text-muted-foreground">/{maxScore}</span>}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {audience === 'teacher'
              ? 'Bài làm của học sinh'
              : score != null && maxScore != null && maxScore > 0
                ? score / maxScore >= 0.5
                  ? 'Làm tốt lắm! Xem lại để chắc hơn nhé.'
                  : 'Chưa sao cả — xem lời giải rồi làm lại nhé.'
                : 'Đã nộp bài.'}
          </p>
          {canRetake && onRetake && (
            <Button variant="soft" className="mt-3" onClick={onRetake}>
              <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Làm lại
            </Button>
          )}
        </CardContent>
      </Card>

      {locked ? (
        <Card className="mt-4">
          <CardContent className="py-8 text-center">
            <p className="font-semibold">{locked}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bạn sẽ xem được đáp án và lời giải theo cài đặt của giáo viên.
            </p>
            <Button variant="outline" className="mt-4" onClick={onExit}>
              {exitLabel}
            </Button>
          </CardContent>
        </Card>
      ) : !review ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {review.questions.map((q, i) => (
              <ReviewCard key={q.id} q={q} index={i} />
            ))}
          </div>
          <Button variant="outline" className="mt-5" onClick={onExit}>
            {exitLabel}
          </Button>
        </>
      )}
    </div>
  )
}

function verdict(q: ReviewQuestion): { tone: 'ok' | 'warn' | 'danger'; label: string } {
  const got = q.points_awarded ?? 0
  if (got >= q.points) return { tone: 'ok', label: 'Đúng' }
  if (got <= 0) return { tone: 'danger', label: 'Chưa đúng' }
  return { tone: 'warn', label: 'Đúng một phần' }
}

function ReviewCard({ q, index }: { q: ReviewQuestion; index: number }) {
  const v = verdict(q)
  const selected = new Set(q.selected_choice_ids ?? [])
  return (
    <Card className={cn('border-l-4', v.tone === 'ok' ? 'border-l-ok-foreground' : v.tone === 'warn' ? 'border-l-warn-foreground' : 'border-l-danger-foreground')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold">Câu {index + 1}</p>
          <div className="flex items-center gap-2">
            <Badge tone={v.tone} variant="soft">
              {v.tone === 'ok' ? (
                <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
              ) : v.tone === 'danger' ? (
                <XCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
              ) : null}
              {v.label}
            </Badge>
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {q.points_awarded ?? 0}/{q.points}
            </span>
          </div>
        </div>

        <MarkdownContent>{q.content}</MarkdownContent>

        {q.kind === 'multiple_choice' && (
          <ul className="space-y-1.5">
            {q.choices.map((c, idx) => {
              const chosen = selected.has(c.id)
              return (
                <li
                  key={c.id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-[15px]',
                    c.is_correct
                      ? 'border-ok-foreground/40 bg-ok'
                      : chosen
                        ? 'border-danger-foreground/40 bg-danger'
                        : 'border-border',
                  )}
                >
                  <span className="font-semibold text-muted-foreground">{letter(idx)})</span>
                  <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
                  {c.is_correct && <span className="ml-auto text-xs font-bold text-ok-foreground">Đáp án</span>}
                  {chosen && !c.is_correct && (
                    <span className="ml-auto text-xs font-bold text-danger-foreground">Bạn chọn</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {q.kind === 'true_false' && (
          <ul className="space-y-1.5">
            {q.choices.map((c, idx) => {
              const studentVal = q.tf_answers?.[c.id]
              const right = studentVal === c.is_correct && studentVal !== undefined
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 text-[15px]">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="font-semibold text-muted-foreground">{letter(idx)})</span>
                    <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                    <span className="text-muted-foreground">
                      Bạn: {studentVal === undefined ? '—' : studentVal ? 'Đúng' : 'Sai'}
                    </span>
                    <Badge tone={right ? 'ok' : 'danger'} variant="soft">
                      {c.is_correct ? 'Đúng' : 'Sai'}
                    </Badge>
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {q.kind === 'short_answer' && (
          <div className="space-y-1 text-[15px]">
            <p>
              <span className="text-muted-foreground">Bạn trả lời: </span>
              <span className="font-semibold">{q.text_answer?.trim() || '—'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Đáp án: </span>
              <span className="font-semibold text-ok-foreground">
                {(q.accepted_answers ?? []).join(' hoặc ') || '—'}
              </span>
            </p>
          </div>
        )}

        {q.explanation && (
          <details className="rounded-xl bg-background px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-info">Lời giải</summary>
            <div className="mt-2">
              <MarkdownContent>{q.explanation}</MarkdownContent>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}
