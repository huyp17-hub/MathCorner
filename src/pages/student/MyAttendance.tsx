import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { listStudentAttendance } from '@/lib/api/attendance'
import { formatDate } from '@/lib/format'
import { attendanceLabel, attendanceTone, type AttendanceStatus } from '@/lib/types'

export default function MyAttendance() {
  const { user } = useAuth()
  const [rows, setRows] = useState<
    { date: string; period: string | null; note: string | null; status: AttendanceStatus }[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      setRows(await listStudentAttendance(user.id))
    } catch {
      setError('Không tải được lịch sử điểm danh.')
      setRows([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    if (!rows) return null
    const present = rows.filter((r) => r.status === 'present').length
    const late = rows.filter((r) => r.status === 'late').length
    const absent = rows.filter((r) => r.status === 'absent').length
    const total = rows.length
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
    return { present, late, absent, total, rate }
  }, [rows])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Điểm danh của tôi</h1>
      <p className="mt-1 text-muted-foreground">Lịch sử chuyên cần của bạn.</p>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {summary && summary.total > 0 && (
        <Card className="mt-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>Có mặt <b>{summary.present}</b></span>
              <span>Đi muộn <b>{summary.late}</b></span>
              <span>Vắng <b>{summary.absent}</b></span>
            </div>
            <Badge tone={summary.rate >= 90 ? 'ok' : summary.rate >= 75 ? 'warn' : 'danger'} variant="soft">
              Chuyên cần {summary.rate}%
            </Badge>
          </CardContent>
        </Card>
      )}

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chưa có buổi nào được điểm danh.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {formatDate(r.date)}
                    {r.period ? ` · ${r.period}` : ''}
                  </p>
                  {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
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
