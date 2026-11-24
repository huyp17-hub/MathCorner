import {
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  LinkIcon,
  Star,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import dayjs from 'dayjs'

interface Child {
  student_id: string
  full_name: string
}

interface ChildAssignment {
  assignment_id: string
  title: string
  due_at: string
  status: string | null
  is_late: boolean
  is_overdue: boolean
  score: number | null
  teacher_comment: string | null
}

interface ChildAbsence {
  date: string
  status: string
}

export default function ParentDashboard() {
  const { profile } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [childAssignments, setChildAssignments] = useState<Map<string, ChildAssignment[]>>(
    new Map(),
  )
  const [childAbsences, setChildAbsences] = useState<Map<string, ChildAbsence[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    try {
      const { data: childrenData, error: cErr } = await supabase.rpc('parent_children')
      if (cErr) throw cErr
      const kids = (childrenData ?? []) as Child[]
      setChildren(kids)

      const asgMap = new Map<string, ChildAssignment[]>()
      const absMap = new Map<string, ChildAbsence[]>()

      for (const kid of kids) {
        try {
          const { data: asgData } = await supabase.rpc('parent_child_assignments', {
            p_student_id: kid.student_id,
          })
          asgMap.set(kid.student_id, (asgData ?? []) as ChildAssignment[])
        } catch {
          asgMap.set(kid.student_id, [])
        }

        const thirtyDaysAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
        const { data: attData } = await supabase
          .from('attendance')
          .select('status, class_sessions!inner(date)')
          .eq('student_id', kid.student_id)
          .gte('class_sessions.date', thirtyDaysAgo)
          .in('status', ['absent', 'excused', 'late'])
        const absences = ((attData ?? []) as unknown as {
          status: string
          class_sessions: { date: string }
        }[]).map((r) => ({ date: r.class_sessions.date, status: r.status }))
        absMap.set(kid.student_id, absences)
      }
      setChildAssignments(asgMap)
      setChildAbsences(absMap)
    } catch {
      /* không nghiêm trọng */
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
          Xin chào, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Theo dõi con</h1>
        <div className="mt-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-[2rem] bg-border/50" />
          ))}
        </div>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          Xin chào, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Theo dõi con</h1>
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <LinkIcon className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="mt-3 font-bold">Chưa liên kết với con nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập mã phụ huynh của con để bắt đầu theo dõi.
            </p>
            <Link to="/parent/link">
              <Button className="mt-4">Liên kết con</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-hand text-2xl text-primary-foreground">
          Xin chào, {profile?.full_name}!
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Theo dõi con</h1>
      </div>

      {children.map((kid) => {
        const asgs = childAssignments.get(kid.student_id) ?? []
        const absences = childAbsences.get(kid.student_id) ?? []

        const overdue = asgs.filter((a) => a.is_overdue && !a.status)
        const upcoming = asgs.filter(
          (a) =>
            !a.is_overdue &&
            (!a.status || a.status === 'in_progress') &&
            dayjs(a.due_at).isAfter(dayjs()),
        )
        const recentScores = asgs
          .filter((a) => a.score != null)
          .slice(0, 5)

        return (
          <Card key={kid.student_id}>
            <CardHeader>
              <CardTitle className="text-xl">{kid.full_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quá hạn */}
              {overdue.length > 0 && (
                <div className="rounded-2xl bg-danger/10 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-danger-foreground">
                    <AlertTriangle className="size-4" />
                    Quá hạn chưa nộp ({overdue.length})
                  </p>
                  {overdue.slice(0, 3).map((a) => (
                    <div key={a.assignment_id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{a.title}</span>
                      <span className="text-xs text-danger-foreground">
                        Hạn {formatDateTime(a.due_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sắp đến hạn */}
              {upcoming.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <ClipboardList className="size-4" />
                    Bài sắp đến hạn ({upcoming.length})
                  </p>
                  {upcoming.slice(0, 3).map((a) => (
                    <div key={a.assignment_id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{a.title}</span>
                      <span className="text-xs text-muted-foreground">
                        Hạn {formatDateTime(a.due_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Điểm gần đây */}
              {recentScores.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <Star className="size-4" />
                    Điểm gần đây
                  </p>
                  {recentScores.map((a) => (
                    <div key={a.assignment_id} className="flex items-center justify-between py-1">
                      <span className="text-sm">{a.title}</span>
                      <span className="font-bold">{a.score}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Vắng gần đây */}
              {absences.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                    <CalendarCheck className="size-4" />
                    Buổi vắng/muộn gần đây ({absences.length})
                  </p>
                  {absences.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm">{a.date}</span>
                      <Badge
                        tone={
                          a.status === 'absent'
                            ? 'danger'
                            : a.status === 'late'
                              ? 'warn'
                              : 'neutral'
                        }
                        variant="soft"
                      >
                        {a.status === 'absent'
                          ? 'Vắng'
                          : a.status === 'late'
                            ? 'Muộn'
                            : 'Vắng có phép'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {overdue.length === 0 &&
                upcoming.length === 0 &&
                recentScores.length === 0 &&
                absences.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Chưa có dữ liệu.
                  </p>
                )}
            </CardContent>
          </Card>
        )
      })}

      {/* Lối tắt */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { to: '/parent/link', label: 'Liên kết con', icon: LinkIcon },
          { to: '/parent/assignments', label: 'Bài tập', icon: ClipboardList },
          { to: '/parent/attendance', label: 'Điểm danh', icon: CalendarCheck },
          { to: '/parent/tuition', label: 'Học phí', icon: Wallet },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <CardContent className="flex flex-col items-center gap-2 p-4">
                <div className="grid size-10 place-items-center rounded-2xl bg-lavender text-foreground">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <p className="text-xs font-bold">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
