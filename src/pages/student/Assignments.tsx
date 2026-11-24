import dayjs from 'dayjs'
import { ArrowRight, FileText, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { listMyAssignments, type MyAssignment } from '@/lib/api/quiz'
import { describeDue } from '@/lib/format'
import { assignmentTypeLabel, submissionLabel, submissionTone } from '@/lib/types'

type Tab = 'todo' | 'submitted' | 'graded'

function bucketOf(a: MyAssignment): Tab {
  if (a.status === 'graded') return 'graded'
  if (a.status === 'submitted') return 'submitted'
  return 'todo'
}

export default function StudentAssignments() {
  const { user } = useAuth()
  const [rows, setRows] = useState<MyAssignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('todo')

  useEffect(() => {
    if (!user) return
    let active = true
    listMyAssignments(user.id)
      .then((list) => active && setRows(list))
      .catch(() => {
        if (!active) return
        setError('Không tải được bài tập.')
        setRows([])
      })
    return () => {
      active = false
    }
  }, [user])

  const counts = useMemo(() => {
    const c = { todo: 0, submitted: 0, graded: 0 }
    for (const a of rows ?? []) c[bucketOf(a)]++
    return c
  }, [rows])

  const visible = useMemo(
    () => (rows ?? []).filter((a) => bucketOf(a) === tab),
    [rows, tab],
  )

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bài tập của bạn</h1>
      <p className="mt-1 text-muted-foreground">Làm bài đúng hạn để không bị dồn nhé.</p>

      <WeekStrip assignments={rows ?? []} />

      <div className="mt-4 flex gap-1 rounded-full border border-border bg-card p-1 sm:w-fit">
        {(
          [
            { id: 'todo', label: 'Cần làm' },
            { id: 'submitted', label: 'Đã nộp' },
            { id: 'graded', label: 'Đã chấm' },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={
              'flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ' +
              (tab === t.id
                ? 'bg-primary-softer text-primary-foreground'
                : 'text-muted-foreground hover:bg-black/[0.04]')
            }
          >
            {t.label} ({counts[t.id]})
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="font-semibold">
              {tab === 'todo' ? 'Không có bài nào cần làm — nghỉ ngơi chút nhé!' : 'Chưa có bài nào ở đây.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((a) => (
            <AssignmentCard key={a.id} a={a} tab={tab} />
          ))}
        </div>
      )}
    </div>
  )
}

function WeekStrip({ assignments }: { assignments: MyAssignment[] }) {
  const today = dayjs().startOf('day')
  const days = Array.from({ length: 7 }, (_, i) => today.subtract(6 - i, 'day'))
  const dueDays = new Set(assignments.map((a) => dayjs(a.due_at).format('YYYY-MM-DD')))

  return (
    <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
      {days.map((d) => {
        const isToday = d.isSame(today, 'day')
        const hasDue = dueDays.has(d.format('YYYY-MM-DD'))
        return (
          <div
            key={d.toISOString()}
            className={
              'flex min-w-[3rem] flex-1 flex-col items-center rounded-2xl border px-2 py-2 ' +
              (isToday ? 'border-primary bg-primary-softer' : 'border-border bg-card')
            }
          >
            <span className="text-[11px] font-medium text-muted-foreground">
              {d.format('dd').replace('Th ', 'T')}
            </span>
            <span className={'text-base font-bold ' + (isToday ? 'text-primary-foreground' : '')}>
              {d.format('D')}
            </span>
            <span
              className={
                'mt-0.5 size-1.5 rounded-full ' + (hasDue ? 'bg-primary' : 'bg-transparent')
              }
              aria-hidden="true"
            />
          </div>
        )
      })}
    </div>
  )
}

function AssignmentCard({ a, tab }: { a: MyAssignment; tab: Tab }) {
  const due = describeDue(a.due_at)
  const Icon = a.type === 'quiz' ? ListChecks : FileText
  const action = tab === 'graded' ? 'Xem lại' : a.status === 'in_progress' ? 'Tiếp tục' : tab === 'submitted' ? 'Xem lại' : 'Làm bài'

  return (
    <Link to={`/student/assignments/${a.id}`} className="group block">
      <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.type === 'quiz' ? 'progress' : 'neutral'} variant="soft">
                <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {assignmentTypeLabel[a.type]}
              </Badge>
              {a.status ? (
                <Badge tone={submissionTone(a.status, a.is_late)} variant="soft">
                  {submissionLabel(a.status, a.is_late)}
                </Badge>
              ) : due.overdue && !a.allow_late ? (
                <Badge tone="danger" variant="soft">
                  {due.text}
                </Badge>
              ) : (
                <Badge tone={due.overdue ? 'danger' : due.urgent ? 'warn' : 'neutral'} variant="soft">
                  {due.text}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 truncate font-semibold">{a.title}</p>
            <p className="text-sm text-muted-foreground">
              {a.class_name}
              {a.status === 'graded' && a.score != null && a.max_score != null && (
                <span className="font-semibold text-foreground"> · {a.score}/{a.max_score} điểm</span>
              )}
              {a.type === 'quiz' && a.status == null && ` · ${a.question_count} câu`}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-info">
            {action}
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
