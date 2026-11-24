import { CalendarCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChildPicker } from '@/components/ChildPicker'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { parentChildAttendance, type ParentAttendanceRow } from '@/lib/api/parent'
import { formatDate } from '@/lib/format'
import { attendanceLabel, attendanceTone } from '@/lib/types'

export default function ChildAttendance() {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [rows, setRows] = useState<ParentAttendanceRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      setRows(await parentChildAttendance(sid))
    } catch {
      setError('Không tải được lịch sử điểm danh.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (studentId) load(studentId)
  }, [studentId, load])

  function handleChildChange(sid: string) {
    setStudentId(sid)
    setRows(null)
  }

  const summary = useMemo(() => {
    if (!rows || rows.length === 0) return null
    const present = rows.filter((r) => r.status === 'present').length
    const late = rows.filter((r) => r.status === 'late').length
    const absent = rows.filter((r) => r.status === 'absent').length
    const excused = rows.filter((r) => r.status === 'excused').length
    const total = rows.length
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    return { present, late, absent, excused, total, rate }
  }, [rows])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Điểm danh của con</h1>
      <p className="mt-1 text-muted-foreground">Lịch sử chuyên cần.</p>

      <div className="mt-4">
        <ChildPicker value={studentId} onChange={handleChildChange} />
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-border/50" />
          ))}
        </div>
      )}

      {!loading && summary && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                Có mặt <b>{summary.present}</b>
              </span>
              <span>
                Đi muộn <b>{summary.late}</b>
              </span>
              <span>
                Vắng <b>{summary.absent}</b>
              </span>
              <span>
                Có phép <b>{summary.excused}</b>
              </span>
            </div>
            <Badge
              tone={summary.rate >= 90 ? 'ok' : summary.rate >= 75 ? 'warn' : 'danger'}
              variant="soft"
            >
              Chuyên cần {summary.rate}%
            </Badge>
          </CardContent>
        </Card>
      )}

      {!loading && rows && rows.length === 0 && (
        <Card className="mt-6">
          <CardContent className="py-10 text-center">
            <CalendarCheck
              className="mx-auto size-10 text-muted-foreground/50"
              strokeWidth={1.5}
            />
            <p className="mt-2 text-sm text-muted-foreground">Chưa có buổi điểm danh nào.</p>
          </CardContent>
        </Card>
      )}

      {!loading && rows && rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {formatDate(r.date)}
                    {r.period ? ` · ${r.period}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.class_name}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
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
