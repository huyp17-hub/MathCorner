import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Flame,
  Star,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { listStudentAttendance } from '@/lib/api/attendance'
import { listMyAssignments, type MyAssignment } from '@/lib/api/quiz'
import { getMyClasses, type MyClass } from '@/lib/api/student'
import { describeDue } from '@/lib/format'
import {
  assignmentTypeLabel,
  attendanceTone,
  type AttendanceStatus,
} from '@/lib/types'
import dayjs from 'dayjs'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

interface DayInfo {
  date: string
  label: string
  isToday: boolean
  attendance: AttendanceStatus | null
  hasDue: boolean
  submitted: boolean
}

export default function StudentDashboard() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState<MyClass[]>([])
  const [assignments, setAssignments] = useState<MyAssignment[]>([])
  const [streak, setStreak] = useState(0)
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [cls, asgs, attendance] = await Promise.all([
        getMyClasses(profile.id),
        listMyAssignments(profile.id),
        listStudentAttendance(profile.id),
      ])
      setClasses(cls)
      setAssignments(asgs)

      const today = dayjs()
      const attMap = new Map<string, AttendanceStatus>()
      for (const a of attendance) {
        attMap.set(a.date, a.status)
      }

      let currentStreak = 0
      for (let i = 0; i < 60; i++) {
        const d = today.subtract(i, 'day').format('YYYY-MM-DD')
        const status = attMap.get(d)
        if (status === 'present' || status === 'late') currentStreak++
        else if (status === 'absent' || status === 'excused') break
        else if (i > 0) break
      }
      setStreak(currentStreak)

      const dueByDate = new Map<string, boolean>()
      const submittedByDate = new Map<string, boolean>()
      for (const a of asgs) {
        const dDate = dayjs(a.due_at).format('YYYY-MM-DD')
        dueByDate.set(dDate, true)
        if (a.status === 'submitted' || a.status === 'graded') {
          submittedByDate.set(dDate, true)
        }
      }

      const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
      const dayList: DayInfo[] = []
      for (let i = -3; i <= 3; i++) {
        const d = today.add(i, 'day')
        const dateStr = d.format('YYYY-MM-DD')
        dayList.push({
          date: dateStr,
          label: i === 0 ? 'Nay' : dayNames[d.day()],
          isToday: i === 0,
          attendance: attMap.get(dateStr) ?? null,
          hasDue: dueByDate.get(dateStr) ?? false,
          submitted: submittedByDate.get(dateStr) ?? false,
        })
      }
      setDays(dayList)
    } catch {
      /* không nghiêm trọng */
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  const toDo = assignments.filter(
    (a) => !a.status || a.status === 'in_progress',
  )
  const recent = assignments
    .filter((a) => a.status === 'graded' && a.score != null)
    .slice(0, 5)

  if (loading) {
    return (
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          {greeting()}, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Little Math Corner</h1>
        <div className="mt-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[2rem] bg-border/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          {greeting()}, {profile?.full_name}! ☀️
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Little Math Corner</h1>
      </div>

      {/* Dải 7 ngày + streak */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold">Tuần này</span>
            {streak > 0 && (
              <span className="flex items-center gap-1 text-sm font-bold text-warn-foreground">
                <Flame className="size-4 animate-pulse" />
                {streak} ngày liên tiếp
              </span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => (
              <div
                key={d.date}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-center transition-colors ${
                  d.isToday
                    ? 'bg-primary/15 ring-2 ring-primary/40'
                    : 'bg-background'
                }`}
              >
                <span className="text-[10px] font-bold text-muted-foreground">{d.label}</span>
                <span className="text-xs">{dayjs(d.date).format('DD')}</span>
                {d.attendance && (
                  <Badge
                    tone={attendanceTone[d.attendance]}
                    variant="soft"
                    className="mt-0.5 px-1.5 py-0.5 text-[9px]"
                  >
                    {d.attendance === 'present'
                      ? '✓'
                      : d.attendance === 'late'
                        ? 'Muộn'
                        : 'Vắng'}
                  </Badge>
                )}
                {d.hasDue && !d.attendance && (
                  <span className="mt-0.5 size-1.5 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bài cần làm */}
      {toDo.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary" strokeWidth={1.75} />
              Bài cần làm ({toDo.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {toDo.slice(0, 6).map((a) => {
              const due = describeDue(a.due_at)
              return (
                <Link
                  key={a.id}
                  to={`/student/assignments/${a.id}`}
                  className="flex items-center justify-between rounded-2xl bg-peach/50 px-4 py-3 transition-colors hover:bg-peach"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={a.type === 'quiz' ? 'progress' : 'neutral'}
                        variant="soft"
                        className="shrink-0 text-[10px]"
                      >
                        {assignmentTypeLabel[a.type]}
                      </Badge>
                      <p className="truncate font-bold">{a.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.class_name} · {a.question_count > 0 ? `${a.question_count} câu` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      due.overdue
                        ? 'text-danger-foreground'
                        : due.urgent
                          ? 'text-warn-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {due.text}
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-ok-foreground/50" strokeWidth={1.5} />
            <p className="mt-2 font-bold">Không có bài nào cần làm</p>
            <p className="mt-1 text-sm text-muted-foreground">Nghỉ ngơi chút nhé!</p>
          </CardContent>
        </Card>
      )}

      {/* Điểm gần đây */}
      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="size-5 text-warn-foreground" strokeWidth={1.75} />
              Điểm gần đây
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((a) => (
              <Link
                key={a.id}
                to={`/student/assignments/${a.id}`}
                className="flex items-center justify-between rounded-2xl px-4 py-2.5 transition-colors hover:bg-peach/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.class_name}</p>
                </div>
                <span className="text-lg font-bold">
                  {a.score}
                  <span className="text-xs font-normal text-muted-foreground">
                    /{a.max_score}
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lối tắt */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            to: '/student/classes',
            label: 'Lớp học',
            icon: BookOpen,
            hint: `${classes.length} lớp`,
          },
          {
            to: '/student/assignments',
            label: 'Bài tập',
            icon: ClipboardList,
            hint: `${toDo.length} cần làm`,
          },
          {
            to: '/student/attendance',
            label: 'Điểm danh',
            icon: CalendarCheck,
            hint: 'Lịch sử chuyên cần',
          },
        ].map(({ to, label, icon: Icon, hint }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="grid size-11 place-items-center rounded-2xl bg-peach text-foreground">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-bold">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
