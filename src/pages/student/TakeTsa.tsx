import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Moon,
  Pause,
  Play,
  Send,
  Sun,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import {
  finishSection,
  getQuiz,
  pauseAttempt,
  resumeAttempt,
  saveAnswer,
  startAttempt,
  startSection,
  type AnswerPatch,
  type QuizData,
  type QuizGroup,
  type QuizQuestion,
  type QuizSection,
} from '@/lib/api/quiz'

/* ================================================================
   Types
   ================================================================ */

interface LocalAnswer {
  selected_choice_ids: string[]
  tf_answers: Record<string, boolean>
  text_answer: string
  blank_answers: Record<string, string>
  flagged: boolean
  time_spent_seconds: number
}

function toLocal(q: QuizQuestion): LocalAnswer {
  return {
    selected_choice_ids: q.selected_choice_ids ?? [],
    tf_answers: q.tf_answers ?? {},
    text_answer: q.text_answer ?? '',
    blank_answers: q.blank_answers ?? {},
    flagged: q.flagged ?? false,
    time_spent_seconds: q.time_spent_seconds ?? 0,
  }
}

function isAnswered(kind: string, a: LocalAnswer): boolean {
  if (kind === 'short_answer') return a.text_answer.trim() !== ''
  if (kind === 'true_false') return Object.keys(a.tf_answers).length > 0
  if (kind === 'drag_drop') return Object.keys(a.blank_answers).length > 0
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

/* ================================================================
   Main component
   ================================================================ */

export default function TakeTsa({
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
  const [confirming, setConfirming] = useState<'section' | 'all' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dark, setDark] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [paused, setPaused] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)

  const answersRef = useRef(answers)
  answersRef.current = answers
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const submittedRef = useRef(false)
  const questionTimeRef = useRef(0)
  const lastQuestionRef = useRef<string | null>(null)

  // Khởi tạo lượt làm
  useEffect(() => {
    let active = true
    startAttempt(assignmentId)
      .then((sub) => getQuiz(sub.id))
      .then((data) => {
        if (!active) return
        setQuiz(data)
        setPaused(data.paused ?? false)
        const init: Record<string, LocalAnswer> = {}
        for (const q of data.questions) init[q.id] = toLocal(q)
        setAnswers(init)
      })
      .catch((e) => active && setStartError(e instanceof Error ? e.message : 'Không mở được bài làm.'))
    return () => { active = false }
  }, [assignmentId])

  // Đồng hồ 1s
  useEffect(() => {
    if (!quiz || paused) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [quiz, paused])

  // Tính offset server
  const offset = useMemo(
    () => (quiz ? Date.now() - new Date(quiz.server_now).getTime() : 0),
    [quiz],
  )

  // Active section
  const activeSection = useMemo(
    () => quiz?.sections.find((s) => s.id === quiz.active_section_id) ?? null,
    [quiz],
  )

  // Deadline cho section hiện tại
  const deadlineMs = activeSection?.deadline
    ? new Date(activeSection.deadline).getTime()
    : quiz?.deadline
      ? new Date(quiz.deadline).getTime()
      : null
  const remainingMs = deadlineMs != null ? deadlineMs - (now - offset) : null
  const urgent = remainingMs != null && remainingMs < 5 * 60 * 1000

  // Thứ tự câu
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

  // Groups map
  const groupsMap = useMemo(() => {
    const m = new Map<string, QuizGroup>()
    for (const g of quiz?.groups ?? []) m.set(g.id, g)
    return m
  }, [quiz])

  // Ghi thời gian từng câu
  useEffect(() => {
    if (!quiz || paused) return
    const id = setInterval(() => { questionTimeRef.current += 1 }, 1000)
    return () => clearInterval(id)
  }, [quiz, paused])

  useEffect(() => {
    const q = orderedQuestions[current]
    if (!q) return
    if (lastQuestionRef.current && lastQuestionRef.current !== q.id) {
      const prevId = lastQuestionRef.current
      const time = questionTimeRef.current
      setAnswers((prev) => {
        const a = prev[prevId]
        if (!a) return prev
        return { ...prev, [prevId]: { ...a, time_spent_seconds: a.time_spent_seconds + time } }
      })
    }
    lastQuestionRef.current = q.id
    questionTimeRef.current = 0
  }, [current, orderedQuestions])

  const flushQueue = useCallback(async () => {
    if (!quiz) return
    for (const t of Object.values(timers.current)) clearTimeout(t)
    const patches = Object.entries(answersRef.current).map(([qid, a]) => ({
      submission_id: quiz.submission_id,
      question_id: qid,
      selected_choice_ids: a.selected_choice_ids,
      tf_answers: a.tf_answers,
      text_answer: a.text_answer || null,
      blank_answers: a.blank_answers,
      flagged: a.flagged,
      time_spent_seconds: a.time_spent_seconds + (qid === lastQuestionRef.current ? questionTimeRef.current : 0),
    } as AnswerPatch))
    await Promise.allSettled(patches.map((p) => saveAnswer(p)))
  }, [quiz])

  // Nộp phần thi
  const doFinishSection = useCallback(async () => {
    if (!quiz || !activeSection || submittedRef.current) return
    setSubmitting(true)
    try {
      await flushQueue()
      const data = await finishSection(quiz.submission_id, activeSection.id)
      setQuiz(data)
      setPaused(data.paused ?? false)
      setCurrent(0)
      setConfirming(null)
      // Nếu tất cả phần đã xong → bài đã nộp
      if (data.status === 'submitted' || data.status === 'graded') {
        submittedRef.current = true
        onSubmitted(data.submission_id)
        return
      }
      // Khởi tạo lại answers cho câu hỏi mới (nếu auto-load phần tiếp)
      const init: Record<string, LocalAnswer> = {}
      for (const q of data.questions) init[q.id] = toLocal(q)
      setAnswers(init)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [quiz, activeSection, onSubmitted, flushQueue])

  // Hết giờ → tự nộp phần
  useEffect(() => {
    if (remainingMs != null && remainingMs <= 0 && activeSection && !submittedRef.current) {
      void doFinishSection()
    }
  }, [remainingMs, activeSection, doFinishSection])

  // Bắt đầu phần thi
  const doStartSection = useCallback(async (sectionId: string) => {
    if (!quiz) return
    setSubmitting(true)
    try {
      const data = await startSection(quiz.submission_id, sectionId)
      setQuiz(data)
      setPaused(data.paused ?? false)
      setCurrent(0)
      const init: Record<string, LocalAnswer> = {}
      for (const q of data.questions) init[q.id] = toLocal(q)
      setAnswers(init)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [quiz])

  // Tạm dừng / tiếp tục
  const togglePause = useCallback(async () => {
    if (!quiz) return
    setPauseLoading(true)
    try {
      const data = paused
        ? await resumeAttempt(quiz.submission_id)
        : await pauseAttempt(quiz.submission_id)
      setQuiz(data)
      setPaused(data.paused ?? false)
    } catch {
      // ignore
    } finally {
      setPauseLoading(false)
    }
  }, [quiz, paused])

  // Lưu tự động
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
          blank_answers: next.blank_answers,
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

  /* ---- Render: lỗi / loading ---- */

  if (startError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="font-semibold">{startError}</p>
          <Button variant="outline" onClick={onExit}>Quay lại</Button>
        </div>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  /* ---- Render: Section overview (chưa bắt đầu phần nào) ---- */

  const noActiveSection = !activeSection && quiz.sections.length > 0

  if (noActiveSection) {
    const nextSection = quiz.sections
      .sort((a, b) => a.order_index - b.order_index)
      .find((s) => s.status === 'not_started')

    return (
      <TsaShell dark={dark} onToggleDark={() => setDark(!dark)}>
        <div className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{quiz.title}</h1>
          <p className={cn('mt-2 text-sm', dark ? 'text-stone-400' : 'text-muted-foreground')}>
            Đề có {quiz.sections.length} phần thi. Làm lần lượt, hết giờ tự khoá.
            {quiz.allow_pause && ' Bạn có thể tạm dừng giữa các phần.'}
          </p>

          <div className="mt-8 space-y-4">
            {quiz.sections
              .sort((a, b) => a.order_index - b.order_index)
              .map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'rounded-2xl border p-5',
                    dark ? 'border-stone-700 bg-stone-800' : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{s.title}</h3>
                      <p className={cn('text-sm', dark ? 'text-stone-400' : 'text-muted-foreground')}>
                        {s.time_limit_minutes} phút
                      </p>
                    </div>
                    {s.status === 'finished' && (
                      <span className="rounded-full bg-ok px-3 py-1 text-sm font-semibold text-ok-foreground">
                        Đã xong
                      </span>
                    )}
                    {s.status === 'not_started' && s.id === nextSection?.id && (
                      <Button
                        onClick={() => doStartSection(s.id)}
                        loading={submitting}
                      >
                        Bắt đầu
                      </Button>
                    )}
                    {s.status === 'not_started' && s.id !== nextSection?.id && (
                      <span className={cn('text-sm', dark ? 'text-stone-500' : 'text-muted-foreground')}>
                        Chưa tới lượt
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-8">
            <Button variant="ghost" onClick={onExit}>Thoát</Button>
          </div>
        </div>
      </TsaShell>
    )
  }

  /* ---- Render: đề trắc nghiệm đang hoạt động ---- */

  const total = orderedQuestions.length
  if (total === 0) {
    return (
      <TsaShell dark={dark} onToggleDark={() => setDark(!dark)}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-3">
            <p className="font-semibold">Phần này chưa có câu hỏi nào.</p>
            <Button variant="outline" onClick={onExit}>Quay lại</Button>
          </div>
        </div>
      </TsaShell>
    )
  }

  if (!answers[orderedQuestions[0]?.id]) {
    return (
      <TsaShell dark={dark} onToggleDark={() => setDark(!dark)}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </TsaShell>
    )
  }

  const safeCurrent = Math.min(current, total - 1)
  const q = orderedQuestions[safeCurrent]
  const a = answers[q.id]
  const answeredCount = orderedQuestions.filter((qq) => isAnswered(qq.kind, answers[qq.id])).length
  const flaggedCount = orderedQuestions.filter((qq) => answers[qq.id]?.flagged).length
  const unanswered = total - answeredCount

  // Tìm group chung cho câu hiện tại
  const currentGroup = q.group_id ? groupsMap.get(q.group_id) : null
  const groupQuestions = currentGroup
    ? orderedQuestions.filter((qq) => qq.group_id === currentGroup.id)
    : null

  return (
    <TsaShell dark={dark} onToggleDark={() => setDark(!dark)}>
      {/* Overlay khi tạm dừng */}
      {paused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <Pause className="mx-auto size-12 text-white" />
            <p className="text-xl font-bold text-white">Đã tạm dừng</p>
            <Button onClick={togglePause} loading={pauseLoading}>
              <Play className="size-4" />
              Tiếp tục
            </Button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={cn(
          'sticky top-0 z-40 border-b px-4 py-2.5',
          dark ? 'border-stone-700 bg-stone-900/95' : 'border-border bg-card/95',
          'backdrop-blur-md',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <span className={cn('text-sm font-bold', dark ? 'text-[#FF9F94]' : 'text-primary')}>
              {activeSection?.title ?? quiz.title}
            </span>
            {activeSection && (
              <span className={cn('ml-2 text-xs', dark ? 'text-stone-400' : 'text-muted-foreground')}>
                {activeSection.time_limit_minutes} phút
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {quiz.allow_pause && !paused && (
              <button
                onClick={togglePause}
                disabled={pauseLoading}
                className={cn(
                  'rounded-full p-2 transition-colors',
                  dark ? 'hover:bg-stone-700' : 'hover:bg-black/[0.05]',
                )}
                aria-label="Tạm dừng"
              >
                <Pause className="size-4" />
              </button>
            )}

            {remainingMs != null && (
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums',
                  urgent
                    ? 'bg-danger text-danger-foreground'
                    : dark
                      ? 'bg-stone-700 text-stone-200'
                      : 'bg-progress text-progress-foreground',
                  urgent && remainingMs < 60 * 1000 && 'animate-pulse',
                )}
              >
                <Clock className="size-4" strokeWidth={2} />
                {formatRemaining(remainingMs)}
              </div>
            )}

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                'rounded-full p-2 transition-colors md:hidden',
                dark ? 'hover:bg-stone-700' : 'hover:bg-black/[0.05]',
              )}
              aria-label="Danh sách câu"
            >
              <ListChecks className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4">
        {/* Cột trái: đoạn văn hoặc câu hỏi */}
        <div className="min-w-0 flex-1">
          {currentGroup && groupQuestions ? (
            <PassageLayout
              dark={dark}
              group={currentGroup}
              questions={groupQuestions}
              answers={answers}
              current={safeCurrent}
              orderedQuestions={orderedQuestions}
              onNavigate={setCurrent}
              onAnswer={setAnswer}
            />
          ) : (
            <SingleQuestion
              dark={dark}
              q={q}
              a={a}
              idx={safeCurrent}
              onAnswer={(patch) => setAnswer(q.id, patch)}
            />
          )}

          {/* Nav câu trước / sau */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setCurrent(Math.max(0, safeCurrent - 1))}
              disabled={safeCurrent === 0}
              className={dark ? 'text-stone-300 hover:bg-stone-700' : ''}
            >
              <ChevronLeft className="size-4" /> Câu trước
            </Button>
            {safeCurrent < total - 1 ? (
              <Button
                variant="ghost"
                onClick={() => setCurrent(Math.min(total - 1, safeCurrent + 1))}
                className={dark ? 'text-stone-300 hover:bg-stone-700' : ''}
              >
                Câu tiếp <ChevronRight className="size-4" />
              </Button>
            ) : (
              <span className={cn('text-sm', dark ? 'text-stone-500' : 'text-muted-foreground')}>
                Câu cuối
              </span>
            )}
          </div>
        </div>

        {/* Cột phải (desktop): bảng điều khiển */}
        <div className={cn('hidden w-64 shrink-0 md:block')}>
          <ControlPanel
            dark={dark}
            quiz={quiz}
            activeSection={activeSection}
            orderedQuestions={orderedQuestions}
            answers={answers}
            current={safeCurrent}
            onNavigate={setCurrent}
            answeredCount={answeredCount}
            total={total}
            onSubmit={() => setConfirming(activeSection ? 'section' : 'all')}
            submitting={submitting}
          />
        </div>
      </div>

      {/* Mobile grid overlay */}
      {showGrid && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGrid(false)} />
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 max-h-[75vh] overflow-auto rounded-t-3xl p-6',
              dark ? 'bg-stone-900' : 'bg-card',
            )}
          >
            <ControlPanel
              dark={dark}
              quiz={quiz}
              activeSection={activeSection}
              orderedQuestions={orderedQuestions}
              answers={answers}
              current={safeCurrent}
              onNavigate={(i) => { setCurrent(i); setShowGrid(false) }}
              answeredCount={answeredCount}
              total={total}
              onSubmit={() => { setShowGrid(false); setConfirming(activeSection ? 'section' : 'all') }}
              submitting={submitting}
            />
          </div>
        </div>
      )}

      {/* Thanh dưới: tiến độ câu */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t px-4 py-2',
          dark ? 'border-stone-700 bg-stone-900/95' : 'border-border bg-card/95',
          'backdrop-blur-md',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm">
          <span className={dark ? 'text-stone-400' : 'text-muted-foreground'}>
            Đã hoàn thành {answeredCount}/{total}
          </span>
          <div className="h-2 flex-1 mx-4 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${total ? (answeredCount / total) * 100 : 0}%` }}
            />
          </div>
          <Button
            size="sm"
            onClick={() => setConfirming(activeSection ? 'section' : 'all')}
            loading={submitting}
            className="md:hidden"
          >
            <Send className="size-3.5" /> Nộp
          </Button>
        </div>
      </div>

      {/* Dialog xác nhận nộp */}
      {confirming && (
        <Dialog
          open
          onClose={() => !submitting && setConfirming(null)}
          title={confirming === 'section' ? `Nộp phần "${activeSection?.title}"?` : 'Nộp bài?'}
          description={
            unanswered > 0
              ? `Bạn còn ${unanswered} câu chưa làm${flaggedCount ? ` và ${flaggedCount} câu đã đánh dấu` : ''}. ${confirming === 'section' ? 'Nộp rồi không quay lại phần này được.' : 'Nộp rồi không sửa được.'}`
              : `${flaggedCount ? `Bạn có ${flaggedCount} câu đã đánh dấu. ` : ''}${confirming === 'section' ? 'Nộp rồi không quay lại phần này được.' : 'Nộp rồi không sửa được.'}`
          }
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={submitting}>
                Xem lại
              </Button>
              <Button onClick={() => void doFinishSection()} loading={submitting}>
                {confirming === 'section' ? 'Nộp phần' : 'Nộp bài'}
              </Button>
            </>
          }
        />
      )}
    </TsaShell>
  )
}

/* ================================================================
   Shell (nền tối/sáng + bao bọc toàn màn hình)
   ================================================================ */

function TsaShell({
  dark,
  onToggleDark,
  children,
}: {
  dark: boolean
  onToggleDark: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'min-h-screen pb-16 transition-colors duration-300',
        dark ? 'bg-[#1C1917] text-[#E7E5E4]' : 'bg-background text-foreground',
      )}
    >
      {/* Nút chuyển sáng/tối */}
      <button
        onClick={onToggleDark}
        className={cn(
          'fixed right-4 top-16 z-50 rounded-full p-2 shadow-soft transition-colors',
          dark ? 'bg-stone-700 hover:bg-stone-600' : 'bg-card hover:bg-background',
        )}
        aria-label={dark ? 'Chế độ sáng' : 'Chế độ tối'}
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
      {children}
    </div>
  )
}

/* ================================================================
   Bảng điều khiển (lưới câu, nút nộp)
   ================================================================ */

function ControlPanel({
  dark,
  quiz,
  activeSection,
  orderedQuestions,
  answers,
  current,
  onNavigate,
  answeredCount,
  total,
  onSubmit,
  submitting,
}: {
  dark: boolean
  quiz: QuizData
  activeSection: QuizSection | null
  orderedQuestions: QuizQuestion[]
  answers: Record<string, LocalAnswer>
  current: number
  onNavigate: (i: number) => void
  answeredCount: number
  total: number
  onSubmit: () => void
  submitting: boolean
}) {
  const unanswered = total - answeredCount
  return (
    <div className="space-y-4">
      {/* Trạng thái chỉ thị */}
      <div className={cn('flex gap-4 text-xs', dark ? 'text-stone-400' : 'text-muted-foreground')}>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-neutral" /> Chưa làm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-info" /> Đã làm
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-warn-foreground" /> Đánh dấu
        </span>
      </div>

      {/* Lưới câu */}
      <div className="flex flex-wrap gap-1.5">
        {orderedQuestions.map((qq, i) => {
          const ans = isAnswered(qq.kind, answers[qq.id])
          const flg = answers[qq.id]?.flagged
          return (
            <button
              key={qq.id}
              onClick={() => onNavigate(i)}
              aria-label={`Câu ${i + 1}`}
              className={cn(
                'grid size-9 place-items-center rounded-xl text-sm font-bold transition-all hover:scale-110',
                i === current && 'ring-2 ring-primary ring-offset-1',
                flg
                  ? 'border-2 border-warn-foreground bg-warn text-warn-foreground'
                  : ans
                    ? 'bg-info text-white'
                    : dark
                      ? 'bg-stone-700 text-stone-400'
                      : 'bg-neutral text-neutral-foreground',
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {/* Tóm tắt */}
      <div className={cn('text-sm space-y-1', dark ? 'text-stone-300' : 'text-foreground')}>
        <p>Đã làm: <span className="font-bold text-info">{answeredCount}</span>/{total}</p>
        {unanswered > 0 && (
          <p>Chưa làm: <span className="font-bold">{unanswered}</span></p>
        )}
      </div>

      {/* Nút nộp */}
      <Button onClick={onSubmit} loading={submitting} className="w-full">
        <Send className="size-4" />
        {activeSection ? `Nộp phần "${activeSection.title}"` : 'Nộp bài'}
      </Button>

      {/* Danh sách phần (nếu TSA) */}
      {quiz.sections.length > 1 && (
        <div className={cn('border-t pt-3 space-y-2', dark ? 'border-stone-700' : 'border-border')}>
          <p className={cn('text-xs font-semibold uppercase tracking-wider', dark ? 'text-stone-500' : 'text-muted-foreground')}>
            Phần thi
          </p>
          {quiz.sections
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className={cn(s.id === activeSection?.id && 'font-bold')}>
                  {s.title}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    s.status === 'finished'
                      ? 'bg-ok text-ok-foreground'
                      : s.status === 'active'
                        ? 'bg-progress text-progress-foreground'
                        : dark
                          ? 'bg-stone-700 text-stone-400'
                          : 'bg-neutral text-neutral-foreground',
                  )}
                >
                  {s.status === 'finished' ? 'Xong' : s.status === 'active' ? 'Đang làm' : 'Chưa'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================
   Câu hỏi đơn lẻ (không có đoạn văn)
   ================================================================ */

function SingleQuestion({
  dark,
  q,
  a,
  idx,
  onAnswer,
}: {
  dark: boolean
  q: QuizQuestion
  a: LocalAnswer
  idx: number
  onAnswer: (patch: Partial<LocalAnswer>) => void
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5',
        dark ? 'border-stone-700 bg-stone-800' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold">
          Câu {idx + 1}
          <span className={cn('ml-2 text-sm font-medium', dark ? 'text-stone-400' : 'text-muted-foreground')}>
            {q.points} điểm
          </span>
        </p>
        <FlagButton dark={dark} flagged={a.flagged} onToggle={() => onAnswer({ flagged: !a.flagged })} />
      </div>

      <div className="mt-2">
        <MarkdownContent>{q.content}</MarkdownContent>
      </div>

      <div className="mt-4">
        <AnswerInput dark={dark} q={q} a={a} onChange={onAnswer} />
      </div>
    </div>
  )
}

/* ================================================================
   Layout đoạn văn chia đôi (Đọc hiểu / Khoa học)
   ================================================================ */

function PassageLayout({
  dark,
  group,
  questions,
  answers,
  current,
  orderedQuestions,
  onNavigate,
  onAnswer,
}: {
  dark: boolean
  group: QuizGroup
  questions: QuizQuestion[]
  answers: Record<string, LocalAnswer>
  current: number
  orderedQuestions: QuizQuestion[]
  onNavigate: (i: number) => void
  onAnswer: (qid: string, patch: Partial<LocalAnswer>) => void
}) {
  const currentQ = orderedQuestions[current]
  const isInGroup = questions.some((qq) => qq.id === currentQ?.id)

  if (!isInGroup || !currentQ) {
    return null
  }

  const a = answers[currentQ.id]
  const idxInGroup = questions.findIndex((qq) => qq.id === currentQ.id)

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Đoạn văn */}
      <div
        className={cn(
          'rounded-2xl border p-5 lg:w-1/2 lg:max-h-[70vh] lg:overflow-auto',
          dark ? 'border-stone-700 bg-stone-800' : 'border-border bg-card',
        )}
      >
        {group.title && (
          <h3 className={cn('mb-3 text-sm font-bold uppercase tracking-wider', dark ? 'text-stone-400' : 'text-muted-foreground')}>
            {group.title}
          </h3>
        )}
        <div className="prose-sm">
          <MarkdownContent>{group.content}</MarkdownContent>
        </div>
      </div>

      {/* Câu hỏi */}
      <div className="lg:w-1/2 space-y-4">
        {/* Mini nav trong nhóm */}
        <div className="flex gap-1.5">
          {questions.map((qq, gi) => {
            const globalIdx = orderedQuestions.findIndex((o) => o.id === qq.id)
            const ans = isAnswered(qq.kind, answers[qq.id])
            return (
              <button
                key={qq.id}
                onClick={() => onNavigate(globalIdx)}
                className={cn(
                  'grid size-8 place-items-center rounded-lg text-xs font-bold transition-colors',
                  gi === idxInGroup && 'ring-2 ring-primary ring-offset-1',
                  ans
                    ? 'bg-info text-white'
                    : dark
                      ? 'bg-stone-700 text-stone-400'
                      : 'bg-neutral text-neutral-foreground',
                )}
              >
                {globalIdx + 1}
              </button>
            )
          })}
        </div>

        <div
          className={cn(
            'rounded-2xl border p-5',
            dark ? 'border-stone-700 bg-stone-800' : 'border-border bg-card',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-bold">
              Câu {orderedQuestions.findIndex((o) => o.id === currentQ.id) + 1}
              <span className={cn('ml-2 text-sm font-medium', dark ? 'text-stone-400' : 'text-muted-foreground')}>
                {currentQ.points} điểm
              </span>
            </p>
            <FlagButton
              dark={dark}
              flagged={a.flagged}
              onToggle={() => onAnswer(currentQ.id, { flagged: !a.flagged })}
            />
          </div>
          <div className="mt-2">
            <MarkdownContent>{currentQ.content}</MarkdownContent>
          </div>
          <div className="mt-4">
            <AnswerInput
              dark={dark}
              q={currentQ}
              a={a}
              onChange={(patch) => onAnswer(currentQ.id, patch)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   Nút đánh dấu
   ================================================================ */

function FlagButton({ dark, flagged, onToggle }: { dark: boolean; flagged: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={flagged}
      aria-label="Đánh dấu câu"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
        flagged
          ? 'border-warn-foreground/40 bg-warn text-warn-foreground'
          : dark
            ? 'border-stone-600 text-stone-400 hover:bg-stone-700'
            : 'border-border text-muted-foreground hover:bg-black/[0.04]',
      )}
    >
      <Bookmark
        className="size-4"
        strokeWidth={1.75}
        fill={flagged ? 'currentColor' : 'none'}
      />
      {flagged ? 'Đã đánh dấu' : 'Đánh dấu'}
    </button>
  )
}

/* ================================================================
   Nhập đáp án (4 loại câu)
   ================================================================ */

function AnswerInput({
  dark,
  q,
  a,
  onChange,
}: {
  dark: boolean
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
        className={cn('max-w-xs', dark && 'bg-stone-700 border-stone-600 text-stone-100')}
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
                <span className={cn('font-semibold', dark ? 'text-stone-400' : 'text-muted-foreground')}>
                  {letter(idx)})
                </span>
                <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
              </span>
              <div className={cn('flex shrink-0 overflow-hidden rounded-full border', dark ? 'border-stone-600' : 'border-border')}>
                <button
                  onClick={() => onChange({ tf_answers: { ...a.tf_answers, [c.id]: true } })}
                  aria-pressed={val === true}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold transition-colors',
                    val === true
                      ? 'bg-ok text-ok-foreground'
                      : dark
                        ? 'text-stone-400'
                        : 'text-muted-foreground',
                  )}
                >
                  Đúng
                </button>
                <button
                  onClick={() => onChange({ tf_answers: { ...a.tf_answers, [c.id]: false } })}
                  aria-pressed={val === false}
                  className={cn(
                    'px-4 py-2 text-sm font-semibold transition-colors',
                    val === false
                      ? 'bg-danger text-danger-foreground'
                      : dark
                        ? 'text-stone-400'
                        : 'text-muted-foreground',
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

  if (q.kind === 'drag_drop') {
    return <DragDropInput dark={dark} q={q} a={a} onChange={onChange} />
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
                  ? dark
                    ? 'border-[#FF9F94] bg-[#FF9F94]/10'
                    : 'border-primary bg-primary-softer'
                  : dark
                    ? 'border-stone-600 hover:bg-stone-700'
                    : 'border-border bg-card hover:bg-background',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center border text-xs font-bold',
                  multi ? 'rounded' : 'rounded-full',
                  checked
                    ? dark
                      ? 'border-[#FF9F94] bg-[#FF9F94] text-stone-900'
                      : 'border-primary-foreground bg-primary text-primary-foreground'
                    : dark
                      ? 'border-stone-500'
                      : 'border-border',
                )}
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

/* ================================================================
   Kéo thả (mobile-friendly: bấm chọn rồi bấm ô)
   ================================================================ */

function DragDropInput({
  dark,
  q,
  a,
  onChange,
}: {
  dark: boolean
  q: QuizQuestion
  a: LocalAnswer
  onChange: (patch: Partial<LocalAnswer>) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)

  // Phương án đã sử dụng
  const usedChoiceIds = new Set(Object.values(a.blank_answers))

  const handleBlankClick = (blankNo: string) => {
    if (selected) {
      // Đặt phương án vào ô
      onChange({ blank_answers: { ...a.blank_answers, [blankNo]: selected } })
      setSelected(null)
    } else {
      // Gỡ phương án khỏi ô
      if (a.blank_answers[blankNo]) {
        const next = { ...a.blank_answers }
        delete next[blankNo]
        onChange({ blank_answers: next })
      }
    }
  }

  const handleChoiceClick = (choiceId: string) => {
    if (selected === choiceId) {
      setSelected(null)
    } else {
      setSelected(choiceId)
    }
  }

  // Render nội dung với ô trống xen kẽ
  const parts = q.content.split(/(\[\[\d+\]\])/)

  return (
    <div className="space-y-4">
      {/* Nội dung câu với ô trống inline */}
      <div className="leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/^\[\[(\d+)\]\]$/)
          if (match) {
            const blankNo = match[1]
            const filledId = a.blank_answers[blankNo]
            const filledChoice = filledId ? q.choices.find((c) => c.id === filledId) : null
            return (
              <button
                key={i}
                onClick={() => handleBlankClick(blankNo)}
                className={cn(
                  'mx-1 inline-flex min-w-[4rem] items-center justify-center rounded-xl border-2 border-dashed px-3 py-1 text-sm font-semibold transition-colors',
                  filledChoice
                    ? dark
                      ? 'border-[#FF9F94] bg-[#FF9F94]/10 text-[#FF9F94]'
                      : 'border-primary bg-primary-softer text-foreground'
                    : selected
                      ? dark
                        ? 'border-[#FF9F94]/50 bg-stone-700'
                        : 'border-primary/50 bg-primary-softer/30'
                      : dark
                        ? 'border-stone-600 bg-stone-700'
                        : 'border-border bg-neutral',
                )}
              >
                {filledChoice ? (
                  <MarkdownContent className="[&_p]:my-0 inline">{filledChoice.content}</MarkdownContent>
                ) : (
                  <span className={dark ? 'text-stone-500' : 'text-muted-foreground'}>
                    [{blankNo}]
                  </span>
                )}
              </button>
            )
          }
          return <MarkdownContent key={i} className="inline [&_p]:inline">{part}</MarkdownContent>
        })}
      </div>

      {/* Kho phương án */}
      <div>
        <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', dark ? 'text-stone-500' : 'text-muted-foreground')}>
          Phương án
        </p>
        <div className="flex flex-wrap gap-2">
          {q.choices.map((c) => {
            const used = usedChoiceIds.has(c.id)
            const isSelected = selected === c.id
            return (
              <button
                key={c.id}
                onClick={() => !used && handleChoiceClick(c.id)}
                disabled={used}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                  used
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                      ? dark
                        ? 'border-[#FF9F94] bg-[#FF9F94]/10 ring-2 ring-[#FF9F94] scale-105'
                        : 'border-primary bg-primary-softer ring-2 ring-primary scale-105'
                      : dark
                        ? 'border-stone-600 hover:bg-stone-700'
                        : 'border-border hover:bg-background',
                )}
              >
                <MarkdownContent className="[&_p]:my-0">{c.content}</MarkdownContent>
              </button>
            )
          })}
        </div>
      </div>

      {selected && (
        <p className={cn('text-xs', dark ? 'text-stone-400' : 'text-muted-foreground')}>
          Bấm vào ô trống để đặt phương án đã chọn.
        </p>
      )}
    </div>
  )
}
