import { ClipboardList } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ChildPicker } from '@/components/ChildPicker'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { parentChildAssignments, type ParentAssignment } from '@/lib/api/parent'
import { formatDateTime } from '@/lib/format'
import { submissionLabel, submissionTone } from '@/lib/types'
import type { SubmissionStatus } from '@/lib/types'

export default function ChildAssignments() {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<ParentAssignment[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      setAssignments(await parentChildAssignments(sid))
    } catch {
      setError('Không tải được bài tập của con.')
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (studentId) load(studentId)
  }, [studentId, load])

  function handleChildChange(sid: string) {
    setStudentId(sid)
    setAssignments(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bài tập của con</h1>
      <p className="mt-1 text-muted-foreground">Theo dõi bài tập, điểm và nhận xét.</p>

      <div className="mt-4">
        <ChildPicker value={studentId} onChange={handleChildChange} />
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {loading && <Skeleton />}

      {!loading && assignments && assignments.length === 0 && (
        <Card className="mt-6">
          <CardContent className="py-10 text-center">
            <ClipboardList className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="mt-2 text-sm text-muted-foreground">Chưa có bài tập nào.</p>
          </CardContent>
        </Card>
      )}

      {!loading && assignments && assignments.length > 0 && (
        <div className="mt-4 space-y-2">
          {assignments.map((a) => {
            const status = a.status as SubmissionStatus | null
            const isOverdue = a.is_overdue && !status
            return (
              <Card key={a.assignment_id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.class_name} · Hạn {formatDateTime(a.due_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isOverdue ? (
                        <Badge tone="danger" variant="soft">
                          Quá hạn
                        </Badge>
                      ) : (
                        <Badge tone={submissionTone(status, a.is_late)} variant="soft">
                          {submissionLabel(status, a.is_late)}
                        </Badge>
                      )}
                      {a.score != null && (
                        <span className="text-lg font-bold">
                          {a.score}
                          {a.max_score != null && (
                            <span className="text-xs font-normal text-muted-foreground">
                              /{a.max_score}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {a.teacher_comment && (
                    <div className="mt-2 rounded-xl bg-background px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Nhận xét:</span>{' '}
                      {a.teacher_comment}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-4 space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-[2rem] bg-border/50" />
      ))}
    </div>
  )
}
