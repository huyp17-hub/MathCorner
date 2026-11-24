import { Bookmark, ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import {
  getQuiz,
  saveAnswer,
  startAttempt,
  submitQuiz,
  type QuizData,
  type QuizQuestion,
} from '@/lib/api/quiz'

interface LocalAnswer {
  selected_choice_ids: string[]
  tf_answers: Record<string, boolean>
  text_answer: string
  flagged: boolean
}

function toLocal(q: QuizQuestion): LocalAnswer {
  return {
    selected_choice_ids: q.selected_choice_ids ?? [],
    tf_answers: q.tf_answers ?? {},
    text_answer: q.text_answer ?? '',
    flagged: q.flagged ?? false,
  }
}

function isAnswered(kind: string, a: LocalAnswer): boolean {
  if (kind === 'short_answer') return a.text_answer.trim() !== ''
  if (kind === 'true_false') return Object.keys(a.tf_answers).length > 0
  return a.selected_choice_ids.length > 0
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function TakeQuiz({
  assignmentId,
  onSubmitted,
  onExit,
}: {
  assignmentId: string
  onSubmitted: (submissionId: string) => void
  onExit: () => void
}) {
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({})
  const [current, setCurrent] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const answersRef = useRef(answers)
  answersRef.current = answers
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const submittedRef = useRef(false)

  // Khởi tạo lượt làm.
  useEffect(() => {
    let active = true
    startAttempt(assignmentId)
      .then((sub) => getQuiz(sub.id))
      .then((data) => {
        if (!active) return
        setQuiz(data)
        const init: Record<string, LocalAnswer> = {}
        for (const q of data.questions) init[q.id] = toLocal(q)
        setAnswers(init)
      })
      .catch((e) => active && setStartError(e instanceof Error ? e.message : 'Không mở được bài làm.'))
    return () => {
      active = false
    }
  }, [assignmentId])

  // Thứ tự câu + đáp án (xáo trộn nếu bật).
  const orderedQuestions = useMemo(() => {
    if (!quiz) return []
    const seedBase = quiz.submission_id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    let qs = quiz.questions
    if (quiz.shuffle) qs = shuffle(qs, seedBase)
    return qs.map((q, i) => {
      if (quiz.shuffle && q.kind === 'multiple_choice') {
        return { ...q, choices: shuffle(q.choices, seedBase + i + 1) }
      }
      return q
    })
  }, [quiz])

  // Đồng hồ: tính theo deadline server, bù lệch giờ máy.
  const offset = useMemo(
    () => (quiz ? Date.now() - new Date(quiz.server_now).getTime() : 0),
    [quiz],
  )
  const deadlineMs = quiz?.deadline ? new Date(quiz.deadline).getTime() : null
  const hasDeadline = deadlineMs != null
  const remainingMs = deadlineMs != null ? deadlineMs - (now - offset) : null

  const doSubmit = useCallback(async () => {
    if (!quiz || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    // Xả hết câu trả lời còn chờ lưu.
    for (const t of Object.values(timers.current)) clearTimeout(t)
    try {
      const pending = Object.entries(answersRef.current).map(([qid, a]) =>
        saveAnswer({
          submission_id: quiz.submission_id,
          question_id: qid,
          selected_choice_ids: a.selected_choice_ids,
          tf_answers: a.tf_answers,
          text_answer: a.text_answer || null,
          flagged: a.flagged,
        }),
      )
      await Promise.allSettled(pending)
      const sub = await submitQuiz(quiz.submission_id)
      onSubmitted(sub.id)
    } catch {
      submittedRef.current = false
      setSubmitting(false)
      setConfirming(false)
    }
  }, [quiz, onSubmitted])

  useEffect(() => {
    if (!hasDeadline) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasDeadline])

  // Hết giờ → tự nộp.
  useEffect(() => {
    if (remainingMs != null && remainingMs <= 0 && !submittedRef.current) void doSubmit()
  }, [remainingMs, doSubmit])

  const queueSave = useCallback(
    (qid: string, next: LocalAnswer) => {
      if (!quiz) return
      clearTimeout(timers.current[qid])
      timers.current[qid] = setTimeout(() => {
        void saveAnswer({
          submission_id: quiz.submission_id,
          question_id: qid,
          selected_choice_ids: next.selected_choice_ids,
          tf_answers: next.tf_answers,
          text_answer: next.text_answer || null,
          flagged: next.flagged,
        }).catch(() => {})
      }, 800)
    },
    [quiz],
  )

  const setAnswer = useCallback(
    (qid: string, patch: Partial<LocalAnswer>) => {
      setAnswers((prev) => {
        const next = { ...prev[qid], ...patch }
        const all = { ...prev, [qid]: next }
        queueSave(qid, next)
        return all
      })
    },
    [queueSave],
  )

  if (startError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="font-semibold">{startError}</p>
          <Button variant="outline" onClick={onExit}>
            Quay lại
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!quiz) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-black/[0.04]" />
  }

  const total = orderedQuestions.length
  if (total === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-10 text-center">
          <p className="font-semibold">Đề này chưa có câu hỏi nào.</p>
          <Button variant="outline" onClick={onExit}>
            Quay lại
          </Button>
        </CardContent>
      </Card>
    )
  }
  // Chờ câu trả lời khởi tạo xong (tránh nhấp nháy trước khi state sẵn sàng).
  if (!answers[orderedQuestions[0].id]) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-black/[0.04]" />
  }

  const safeCurrent = Math.min(current, total - 1)
  const q = orderedQuestions[safeCurrent]
  const answeredCount = orderedQuestions.filter((qq) => isAnswered(qq.kind, answers[qq.id])).length
  const flaggedCount = orderedQuestions.filter((qq) => answers[qq.id]?.flagged).length
  const unanswered = total - answeredCount
  const a = answers[q.id]
  const urgent = remainingMs != null && remainingMs < 5 * 60 * 1000

  return (
    <div className="pb-28">
      {/* Đầu trang: tên đề + đồng hồ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Đã làm {answeredCount}/{total}
          </p>
        </div>
        {remainingMs != null && (
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums',
              urgent ? 'bg-danger text-danger-foreground' : 'bg-progress text-progress-foreground',
            )}
          >
            <Clock className="size-4" strokeWidth={2} aria-hidden="true" />
            {formatRemaining(remainingMs)}
          </div>
        )}
      </div>

      {/* Thanh tiến độ */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
        />
      </div>

      {/* Lưới số câu */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {orderedQuestions.map((qq, i) => {
          const ans = isAnswered(qq.kind, answers[qq.id])
          const flg = answers[qq.id]?.flagged
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              aria-label={`Câu ${i + 1}${ans ? ', đã làm' : ''}${flg ? ', đã đánh dấu' : ''}`}
              className={cn(
                'grid size-9 place-items-center rounded-xl text-sm font-bold transition-colors',
                i === safeCurrent && 'ring-2 ring-primary ring-offset-1',
                flg
                  ? 'bg-warn text-warn-foreground'
                  : ans
                    ? 'bg-progress text-progress-foreground'
                    : 'bg-neutral text-neutral-foreground',
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Câu hiện tại */}
      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold">
              Câu {safeCurrent + 1}
              <span className="ml-2 text-sm font-medium text-muted-foreground">
                {q.points} điểm
              </span>
            </p>
            <button
              onClick={() => setAnswer(q.id, { flagged: !a.flagged })}
              aria-pressed={a.flagged}
              aria-label="Đánh dấu câu"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold',
                a.flagged
                  ? 'border-warn-foreground/40 bg-warn text-warn-foreground'
                  : 'border-border text-muted-foreground hover:bg-black/[0.04]',
              )}
            >
              <Bookmark
                className="size-4"
                strokeWidth={1.75}
                fill={a.flagged ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              {a.flagged ? 'Đã đánh dấu' : 'Đánh dấu'}
            </button>
          </div>

          <div className="mt-2">
            <MarkdownContent>{q.content}</MarkdownContent>
          </div>

          <div className="mt-4">
            <AnswerInput q={q} a={a} onChange={(patch) => setAnswer(q.id, patch)} />
          </div>
        </CardContent>
      </Card>

      {/* Điều hướng câu */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrent(Math.max(0, safeCurrent - 1))}
          disabled={safeCurrent === 0}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Câu trước
        </Button>
        {safeCurrent < total - 1 ? (
          <Button variant="outline" onClick={() => setCurrent(Math.min(total - 1, safeCurrent + 1))}>
            Câu tiếp
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">Câu cuối</span>
        )}
      </div>

      {/* Thanh nộp cố định đáy */}
      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-border bg-card/90 backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <p className="text-sm text-muted-foreground">
            Còn <span className="font-semibold text-foreground">{unanswered}</span> câu chưa làm
          </p>
          <Button onClick={() => setConfirming(true)} loading={submitting}>
            <Send className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Nộp bài
          </Button>
        </div>
      </div>

      {confirming && (
        <Dialog
          open
          onClose={() => !submitting && setConfirming(false)}
          title="Nộp bài?"
          description={
            unanswered > 0
              ? `Bạn còn ${unanswered} câu chưa làm${flaggedCount ? ` và ${flaggedCount} câu đã đánh dấu` : ''}. Nộp rồi sẽ không sửa được.`
              : `${flaggedCount ? `Bạn có ${flaggedCount} câu đã đánh dấu. ` : ''}Nộp rồi sẽ không sửa được.`
          }
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
                Xem lại
              </Button>
              <Button onClick={() => void doSubmit()} loading={submitting}>
                Nộp bài
              </Button>
            </>
          }
        />
      )}
    </div>
  )
}

function AnswerInput({
  q,
  a,
  onChange,
}: {
  q: QuizQuestion
  a: LocalAnswer
  onChange: (patch: Partial<LocalAnswer>) => void
}) {
  if (q.kind === 'short_answer') {
    return (
      <Input
        value={a.text_answer}
        onChange={(e) => onChange({ text_answer: e.target.value })}
        placeholder="Nhập đáp án"
        className="max-w-xs"
      />
    )
  }

  if (q.kind === 'true_false') {
    return (
      <ul className="space-y-2">
        {q.choices.map((c, idx) => {
          const val = a.tf_answers[c.id]
          return (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="font-semibold text-muted-foreground">{letter(idx)})</span>
                <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
              </span>
              <div className="flex shrink-0 overflow-hidden rounded-full border border-border">
                <button
                  onClick={() => onChange({ tf_answers: { ...a.tf_answers, [c.id]: true } })}
                  aria-pressed={val === true}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold',
                    val === true ? 'bg-ok text-ok-foreground' : 'text-muted-foreground',
                  )}
                >
                  Đúng
                </button>
                <button
                  onClick={() => onChange({ tf_answers: { ...a.tf_answers, [c.id]: false } })}
                  aria-pressed={val === false}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold',
                    val === false ? 'bg-danger text-danger-foreground' : 'text-muted-foreground',
                  )}
                >
                  Sai
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  // multiple_choice
  const multi = q.multiple_correct
  function toggle(id: string) {
    if (multi) {
      const has = a.selected_choice_ids.includes(id)
      onChange({
        selected_choice_ids: has
          ? a.selected_choice_ids.filter((x) => x !== id)
          : [...a.selected_choice_ids, id],
      })
    } else {
      onChange({ selected_choice_ids: [id] })
    }
  }
  return (
    <ul className="space-y-2">
      {q.choices.map((c, idx) => {
        const checked = a.selected_choice_ids.includes(c.id)
        return (
          <li key={c.id}>
            <button
              onClick={() => toggle(c.id)}
              aria-pressed={checked}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                checked
                  ? 'border-primary bg-primary-softer'
                  : 'border-border bg-card hover:bg-background',
              )}
            >
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center border text-xs font-bold',
                  multi ? 'rounded' : 'rounded-full',
                  checked ? 'border-primary-foreground bg-primary text-primary-foreground' : 'border-border',
                )}
                aria-hidden="true"
              >
                {checked ? '✓' : letter(idx)}
              </span>
              <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
function letter(i: number): string {
  return LETTERS[i] ?? String(i + 1)
}

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
