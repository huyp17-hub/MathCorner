import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Users,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { listTeacherClasses, type ClassRow } from '@/lib/api/classes'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import type { AssignmentType, SubmissionStatus } from '@/lib/types'
import dayjs from 'dayjs'

interface TodaySession {
  id: string
  class_id: string
  class_name: string
  date: string
  period: string | null
  attendanceCount: number
  memberCount: number
}

interface PendingAssignment {
  id: string
  title: string
  type: AssignmentType
  class_name: string
  due_at: string
  submitted: number
  total: number
  graded: number
}

interface AbsentStudent {
  student_id: string
  full_name: string
  class_name: string
  absent_count: number
}

interface LowTuitionStudent {
  student_id: string
  full_name: string
  class_name: string
  sessions_remaining: number | null
  balance: number
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([])
  const [pending, setPending] = useState<PendingAssignment[]>([])
  const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([])
  const [lowTuition, setLowTuition] = useState<LowTuitionStudent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const cls = await listTeacherClasses(profile.id)
      setClasses(cls)
      const classIds = cls.map((c) => c.id)
      if (classIds.length === 0) {
        setLoading(false)
        return
      }
      const classMap = new Map(cls.map((c) => [c.id, c.name]))

      const today = dayjs().format('YYYY-MM-DD')
      const { data: sessData } = await supabase
        .from('class_sessions')
        .select('id, class_id, date, period')
        .in('class_id', classIds)
        .eq('date', today)
      const sessions: TodaySession[] = []
      for (const s of sessData ?? []) {
        const { count: attCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', s.id)
        const { count: memCount } = await supabase
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', s.class_id)
        sessions.push({
          id: s.id,
          class_id: s.class_id,
          class_name: classMap.get(s.class_id) ?? '',
          date: s.date,
          period: s.period,
          attendanceCount: attCount ?? 0,
          memberCount: memCount ?? 0,
        })
      }
      setTodaySessions(sessions)

      const { data: asgData } = await supabase
        .from('assignments')
        .select('id, title, type, class_id, due_at')
        .in('class_id', classIds)
        .gte('due_at', dayjs().subtract(7, 'day').toISOString())
        .order('due_at', { ascending: true })
        .limit(20)
      const pendingList: PendingAssignment[] = []
      for (const a of asgData ?? []) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('student_id, status, attempt_no')
          .eq('assignment_id', a.id)
        const latest = new Map<string, { status: SubmissionStatus }>()
        for (const s of subs ?? []) {
          const cur = latest.get(s.student_id)
          if (!cur) latest.set(s.student_id, { status: s.status })
        }
        const { count: total } = await supabase
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', a.class_id)
        let submitted = 0
        let graded = 0
        for (const [, v] of latest) {
          if (v.status === 'submitted' || v.status === 'graded') submitted++
          if (v.status === 'graded') graded++
        }
        const needsGrading = submitted > graded
        const notAllSubmitted = submitted < (total ?? 0)
        if (needsGrading || notAllSubmitted) {
          pendingList.push({
            id: a.id,
            title: a.title,
            type: a.type as AssignmentType,
            class_name: classMap.get(a.class_id) ?? '',
            due_at: a.due_at,
            submitted,
            total: total ?? 0,
            graded,
          })
        }
      }
      setPending(pendingList.slice(0, 8))

      const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
      const absentMap = new Map<string, { count: number; name: string; class_name: string }>()
      for (const cls of classIds) {
        const { data: attData } = await supabase
          .from('attendance')
          .select('student_id, status, class_sessions!inner(date, class_id)')
          .eq('class_sessions.class_id', cls)
          .gte('class_sessions.date', thirtyDaysAgo)
          .in('status', ['absent', 'excused'])
        for (const r of (attData ?? []) as unknown as { student_id: string }[]) {
          const key = `${r.student_id}:${cls}`
          const cur = absentMap.get(key)
          if (cur) cur.count++
          else absentMap.set(key, { count: 1, name: '', class_name: classMap.get(cls) ?? '' })
        }
      }
      const absentIds = [...new Set([...absentMap.keys()].map((k) => k.split(':')[0]))]
      if (absentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', absentIds)
        const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))
        for (const [key, val] of absentMap) {
          val.name = nameMap.get(key.split(':')[0]) ?? 'Không rõ'
        }
      }
      setAbsentStudents(
        [...absentMap.entries()]
          .filter(([, v]) => v.count >= 3)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
          .map(([key, v]) => ({
            student_id: key.split(':')[0],
            full_name: v.name,
            class_name: v.class_name,
            absent_count: v.count,
          })),
      )

      const thisMonth = dayjs().format('YYYY-MM-01')
      const lowList: LowTuitionStudent[] = []
      for (const cls of classIds.slice(0, 5)) {
        try {
          const { data: tData } = await supabase.rpc('tuition_summary', {
            p_class_id: cls,
            p_month: thisMonth,
          })
          for (const t of (tData ?? []) as {
            student_id: string
            full_name: string
            low_sessions: boolean
            sessions_remaining: number | null
            balance: number
          }[]) {
            if (t.low_sessions || t.balance < 0) {
              lowList.push({
                student_id: t.student_id,
                full_name: t.full_name,
                class_name: classMap.get(cls) ?? '',
                sessions_remaining: t.sessions_remaining,
                balance: t.balance,
              })
            }
          }
        } catch {
          /* tuition_summary có thể lỗi nếu lớp chưa cấu hình billing */
        }
      }
      setLowTuition(lowList.slice(0, 10))
    } catch {
      /* lỗi không nghiêm trọng */
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          {greeting()}, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Trang giáo viên</h1>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[2rem] bg-border/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          {greeting()}, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Trang giáo viên</h1>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={Users}
          label="Lớp học"
          value={classes.length}
          to="/teacher/classes"
        />
        <StatCard
          icon={CalendarCheck}
          label="Buổi hôm nay"
          value={todaySessions.length}
          to="/teacher/attendance"
        />
        <StatCard
          icon={ClipboardList}
          label="Bài chờ chấm"
          value={pending.filter((p) => p.submitted > p.graded).length}
          to="/teacher/assignments"
        />
        <StatCard
          icon={Wallet}
          label="HS cần chú ý"
          value={lowTuition.length}
          to="/teacher/tuition"
        />
      </div>

      {/* Điểm danh hôm nay */}
      {todaySessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="size-5 text-primary" strokeWidth={1.75} />
              Buổi học hôm nay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todaySessions.map((s) => (
              <Link
                key={s.id}
                to="/teacher/attendance"
                className="flex items-center justify-between rounded-2xl bg-sage/50 px-4 py-3 transition-colors hover:bg-sage"
              >
                <div>
                  <p className="font-bold">{s.class_name}</p>
                  {s.period && <p className="text-xs text-muted-foreground">Tiết {s.period}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {s.attendanceCount > 0 ? (
                    <Badge tone="ok">
                      <CheckCircle2 className="size-3" />
                      {s.attendanceCount}/{s.memberCount}
                    </Badge>
                  ) : (
                    <Badge tone="warn">Chưa điểm danh</Badge>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bài tập cần xử lý */}
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" strokeWidth={1.75} />
              Bài tập cần xử lý
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((p) => {
              const needsGrading = p.submitted > p.graded && p.type === 'essay'
              return (
                <Link
                  key={p.id}
                  to={`/teacher/assignments/${p.id}/submissions`}
                  className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 transition-colors hover:bg-sage/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.class_name} · Hạn {formatDateTime(p.due_at)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      Nộp {p.submitted}/{p.total}
                    </span>
                    {needsGrading && (
                      <Badge tone="warn" variant="soft">
                        <Clock className="size-3" />
                        Chờ chấm {p.submitted - p.graded}
                      </Badge>
                    )}
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Học sinh vắng nhiều */}
        {absentStudents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-danger-foreground" strokeWidth={1.75} />
                Vắng nhiều (30 ngày)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {absentStudents.map((s) => (
                <div
                  key={`${s.student_id}-${s.class_name}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.class_name}</p>
                  </div>
                  <Badge tone="danger" variant="soft">
                    {s.absent_count} buổi vắng
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Học phí cần chú ý */}
        {lowTuition.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-5 text-warn-foreground" strokeWidth={1.75} />
                Học phí cần chú ý
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {lowTuition.map((s) => (
                <div
                  key={`${s.student_id}-${s.class_name}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.class_name}</p>
                  </div>
                  {s.sessions_remaining != null && s.sessions_remaining <= 2 ? (
                    <Badge tone="warn" variant="soft">
                      Còn {s.sessions_remaining} buổi
                    </Badge>
                  ) : s.balance < 0 ? (
                    <Badge tone="danger" variant="soft">
                      Nợ
                    </Badge>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {classes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="mt-3 font-bold">Chưa có lớp học nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tạo lớp đầu tiên để bắt đầu quản lý.
            </p>
            <Link to="/teacher/classes">
              <Button className="mt-4">Tạo lớp</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Users
  label: string
  value: number
  to: string
}) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sage text-foreground">
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
