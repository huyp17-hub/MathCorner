import dayjs from 'dayjs'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  Image,
  Link2,
  ListChecks,
  MessageCircle,
  Music,
  Trophy,
  Video,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChatPanel } from '@/components/ChatPanel'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { listStudentAttendance } from '@/lib/api/attendance'
import { getLessonWithFiles, listLessons, type Lesson, type LessonWithFiles } from '@/lib/api/lessons'
import { listClassAssignments, type MyAssignment } from '@/lib/api/quiz'
import { getMyClasses, type MyClass } from '@/lib/api/student'
import { describeDue, formatDate } from '@/lib/format'
import {
  assignmentTypeLabel,
  attendanceLabel,
  attendanceTone,
  submissionLabel,
  submissionTone,
  type AttendanceStatus,
} from '@/lib/types'

type Tab = 'assignments' | 'lessons' | 'chat' | 'attendance' | 'grades'

export default function MyClassDetail() {
  const { classId } = useParams<{ classId: string }>()
  const { user } = useAuth()
  const [cls, setCls] = useState<MyClass | null>(null)
  const [tab, setTab] = useState<Tab>('assignments')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !classId) return
    getMyClasses(user.id).then((list) => {
      setCls(list.find((c) => c.class_id === classId) ?? null)
      setLoading(false)
    })
  }, [user, classId])

  if (loading) return <div className="h-72 animate-pulse rounded-[2rem] bg-black/[0.04]" />

  if (!cls || !classId || !user) {
    return (
      <div>
        <BackBtn />
        <Card className="mt-3">
          <CardContent className="py-10 text-center">
            <p className="font-semibold">Không tìm thấy lớp học.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
    { id: 'assignments', label: 'BTVN', icon: ClipboardList },
    { id: 'lessons', label: 'Bài giảng', icon: BookOpen },
    { id: 'chat', label: 'Thông báo', icon: MessageCircle },
    { id: 'attendance', label: 'Điểm danh', icon: CalendarCheck },
    { id: 'grades', label: 'Điểm', icon: Trophy },
  ]

  return (
    <div>
      <BackBtn />

      {/* Header */}
      <div className="mt-3 flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-peach text-foreground">
          <BookOpen className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{cls.name}</h1>
          {cls.subject && <p className="text-sm text-muted-foreground">{cls.subject}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 rounded-full border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-colors ' +
              (tab === t.id
                ? 'bg-primary-softer text-primary-foreground'
                : 'text-muted-foreground hover:bg-black/[0.04]')
            }
          >
            <t.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'assignments' && <AssignmentsTab classId={classId} studentId={user.id} />}
        {tab === 'lessons' && <LessonsTab classId={classId} />}
        {tab === 'chat' && (
          <ChatPanel classId={classId} userId={user.id} userRole="student" />
        )}
        {tab === 'attendance' && <AttendanceTab classId={classId} studentId={user.id} />}
        {tab === 'grades' && <GradesTab classId={classId} studentId={user.id} />}
      </div>
    </div>
  )
}

function BackBtn() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/student/classes')}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
      Danh sách lớp
    </button>
  )
}

/* ───── Tab BTVN ───── */

function AssignmentsTab({ classId, studentId }: { classId: string; studentId: string }) {
  const [rows, setRows] = useState<MyAssignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listClassAssignments(classId, studentId)
      .then(setRows)
      .catch(() => {
        setError('Không tải được bài tập.')
        setRows([])
      })
  }, [classId, studentId])

  if (error) {
    return <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">{error}</p>
  }
  if (rows === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/[0.04]" />)}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="font-semibold">Chưa có bài tập nào.</p>
          <p className="mt-1 text-sm text-muted-foreground">Giáo viên sẽ giao bài sớm thôi!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((a) => {
        const due = describeDue(a.due_at)
        const Icon = a.type === 'quiz' ? ListChecks : FileText
        const action =
          a.status === 'graded' ? 'Xem lại'
          : a.status === 'in_progress' ? 'Tiếp tục'
          : a.status === 'submitted' ? 'Xem lại'
          : 'Làm bài'

        return (
          <Link key={a.id} to={`/student/assignments/${a.id}`} className="group block">
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
                    ) : (
                      <Badge tone={due.overdue ? 'danger' : due.urgent ? 'warn' : 'neutral'} variant="soft">
                        {due.text}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 truncate font-semibold">{a.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.type === 'quiz' && a.status == null && `${a.question_count} câu · `}
                    Hạn: {dayjs(a.due_at).format('DD/MM HH:mm')}
                    {a.status === 'graded' && a.score != null && a.max_score != null && (
                      <span className="font-semibold text-foreground"> · {a.score}/{a.max_score} điểm</span>
                    )}
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
      })}
    </div>
  )
}

/* ───── Tab Điểm danh ───── */

function AttendanceTab({ classId, studentId }: { classId: string; studentId: string }) {
  const [rows, setRows] = useState<
    { date: string; period: string | null; note: string | null; status: AttendanceStatus }[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listStudentAttendance(studentId, classId)
      .then(setRows)
      .catch(() => {
        setError('Không tải được điểm danh.')
        setRows([])
      })
  }, [classId, studentId])

  const stats = useMemo(() => {
    if (!rows) return null
    const total = rows.length
    const present = rows.filter((r) => r.status === 'present').length
    const late = rows.filter((r) => r.status === 'late').length
    const absent = rows.filter((r) => r.status === 'absent' || r.status === 'excused').length
    return { total, present, late, absent }
  }, [rows])

  if (error) {
    return <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">{error}</p>
  }
  if (rows === null) {
    return <div className="h-40 animate-pulse rounded-2xl bg-black/[0.04]" />
  }

  return (
    <div>
      {/* Thống kê */}
      {stats && stats.total > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatCard label="Có mặt" value={stats.present + stats.late} total={stats.total} tone="ok" />
          <StatCard label="Đi muộn" value={stats.late} total={stats.total} tone="warn" />
          <StatCard label="Vắng" value={stats.absent} total={stats.total} tone="danger" />
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-semibold">Chưa có dữ liệu điểm danh.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between p-3 px-4">
                <div>
                  <p className="text-sm font-semibold">{formatDate(r.date)}</p>
                  {r.period && <p className="text-xs text-muted-foreground">{r.period}</p>}
                </div>
                <Badge tone={attendanceTone[r.status]} variant="soft">
                  {attendanceLabel[r.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  total,
  tone,
}: {
  label: string
  value: number
  total: number
  tone: 'ok' | 'warn' | 'danger'
}) {
  const bg = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-danger'
  const fg = tone === 'ok' ? 'text-ok-foreground' : tone === 'warn' ? 'text-warn-foreground' : 'text-danger-foreground'
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className={`text-2xl font-bold ${fg}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mx-auto mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className={`h-full rounded-full ${bg}`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
        </div>
      </CardContent>
    </Card>
  )
}

/* ───── Tab Bài giảng ───── */

const KIND_ICON: Record<string, typeof FileText> = {
  image: Image,
  video: Video,
  audio: Music,
  link: Link2,
  document: FileText,
}

function LessonsTab({ classId }: { classId: string }) {
  const [lessons, setLessons] = useState<Lesson[] | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<LessonWithFiles | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listLessons(classId)
      .then(setLessons)
      .catch(() => {
        setError('Không tải được bài giảng.')
        setLessons([])
      })
  }, [classId])

  async function toggleExpand(lessonId: string) {
    if (expanded === lessonId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(lessonId)
    setDetail(null)
    setLoadingDetail(true)
    try {
      const d = await getLessonWithFiles(lessonId)
      setDetail(d)
    } catch {
      setError('Không tải được tài liệu.')
    } finally {
      setLoadingDetail(false)
    }
  }

  if (error && !lessons) {
    return <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">{error}</p>
  }
  if (lessons === null) {
    return <div className="h-40 animate-pulse rounded-2xl bg-black/[0.04]" />
  }
  if (lessons.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="mt-2 font-semibold">Chưa có bài giảng nào.</p>
          <p className="mt-1 text-sm text-muted-foreground">Giáo viên sẽ đăng tài liệu sớm thôi!</p>
        </CardContent>
      </Card>
    )
  }

  const grouped = new Map<string, Lesson[]>()
  for (const l of lessons) {
    const key = l.topic || ''
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(l)
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([topic, items]) => (
        <div key={topic || '__none'}>
          {topic && (
            <p className="mb-2 text-sm font-bold text-muted-foreground">{topic}</p>
          )}
          <div className="space-y-2">
            {items.map((lesson) => (
              <Card key={lesson.id}>
                <CardContent className="p-0">
                  <button
                    onClick={() => toggleExpand(lesson.id)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-peach">
                      <BookOpen className="size-5 text-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{lesson.title}</p>
                      {lesson.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      className={
                        'size-5 shrink-0 text-muted-foreground transition-transform ' +
                        (expanded === lesson.id ? 'rotate-90' : '')
                      }
                      strokeWidth={1.75}
                    />
                  </button>

                  {expanded === lesson.id && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      {loadingDetail ? (
                        <div className="h-16 animate-pulse rounded-xl bg-black/[0.04]" />
                      ) : detail && detail.files.length > 0 ? (
                        <div className="space-y-1.5">
                          {detail.files.map((f) => {
                            const Icon = KIND_ICON[f.kind] ?? FileText
                            const href = f.signed_url ?? f.url
                            return (
                              <a
                                key={f.id}
                                href={href ?? '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 transition-colors hover:bg-black/[0.02]"
                              >
                                <Icon className="size-5 shrink-0 text-info" strokeWidth={1.75} />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                  {f.file_name}
                                </span>
                                <ExternalLink className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                              </a>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Chưa có tài liệu đính kèm.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───── Tab Điểm ───── */

function GradesTab({ classId, studentId }: { classId: string; studentId: string }) {
  const [rows, setRows] = useState<MyAssignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listClassAssignments(classId, studentId)
      .then((all) => setRows(all.filter((a) => a.status === 'graded' || a.status === 'submitted')))
      .catch(() => {
        setError('Không tải được điểm.')
        setRows([])
      })
  }, [classId, studentId])

  const avg = useMemo(() => {
    if (!rows) return null
    const scored = rows.filter((r) => r.score != null && r.max_score)
    if (scored.length === 0) return null
    const pct = scored.reduce((s, r) => s + (r.score! / r.max_score!) * 10, 0) / scored.length
    return pct.toFixed(1)
  }, [rows])

  if (error) {
    return <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">{error}</p>
  }
  if (rows === null) {
    return <div className="h-40 animate-pulse rounded-2xl bg-black/[0.04]" />
  }

  return (
    <div>
      {/* Điểm trung bình */}
      {avg && (
        <Card className="mb-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-ok text-ok-foreground">
              <Trophy className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Điểm trung bình (thang 10)</p>
              <p className="text-2xl font-bold">{avg}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-semibold">Chưa có bài nào được chấm điểm.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {rows.map((a) => (
            <Link key={a.id} to={`/student/assignments/${a.id}`} className="group block">
              <Card className="transition-transform group-hover:-translate-y-0.5">
                <CardContent className="flex items-center justify-between p-3 px-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignmentTypeLabel[a.type]} · {dayjs(a.due_at).format('DD/MM/YYYY')}
                    </p>
                  </div>
                  <div className="text-right">
                    {a.score != null && a.max_score != null ? (
                      <>
                        <p className="text-lg font-bold">{a.score}/{a.max_score}</p>
                        <p className="text-xs text-muted-foreground">
                          {((a.score / a.max_score) * 10).toFixed(1)}/10
                        </p>
                      </>
                    ) : (
                      <Badge tone="progress" variant="soft">Chờ chấm</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
