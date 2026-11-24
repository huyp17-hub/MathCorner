import dayjs from 'dayjs'
import { Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { listAttendanceInRange, type AttendanceRecord } from '@/lib/api/attendance'
import { listMembers, type MemberRow } from '@/lib/api/classes'
import { exportToXlsx } from '@/lib/xlsx'

interface StatRow {
  student_id: string
  full_name: string
  present: number
  late: number
  absent: number
  excused: number
  total: number
  rate: number // %
}

export function StatsView({ classId, className }: { classId: string; className: string }) {
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [to, setTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mem, recs] = await Promise.all([
        listMembers(classId),
        listAttendanceInRange(classId, from, to),
      ])
      setMembers(mem)
      setRecords(recs)
    } catch {
      setError('Không tải được thống kê.')
      setMembers([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [classId, from, to])

  useEffect(() => {
    void load()
  }, [load])

  const rows: StatRow[] = useMemo(() => {
    if (!members) return []
    return members.map((m) => {
      const recs = records.filter((r) => r.student_id === m.student_id)
      const present = recs.filter((r) => r.status === 'present').length
      const late = recs.filter((r) => r.status === 'late').length
      const absent = recs.filter((r) => r.status === 'absent').length
      const excused = recs.filter((r) => r.status === 'excused').length
      const total = recs.length
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0
      return { student_id: m.student_id, full_name: m.full_name, present, late, absent, excused, total, rate }
    })
  }, [members, records])

  function onExport() {
    const data = rows.map((r) => ({
      'Họ tên': r.full_name,
      'Có mặt': r.present,
      'Đi muộn': r.late,
      'Vắng KP': r.absent,
      'Vắng CP': r.excused,
      'Tổng buổi': r.total,
      'Chuyên cần (%)': r.rate,
    }))
    exportToXlsx(data, `diem-danh-${className}-${from}_${to}`, 'Điểm danh')
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">Từ ngày</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">Đến ngày</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="outline" onClick={onExport} disabled={rows.length === 0}>
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Xuất Excel
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <Card key={r.student_id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    <span>Có mặt {r.present}</span>
                    <span>Muộn {r.late}</span>
                    <span>Vắng {r.absent}</span>
                    {r.excused > 0 && <span>Có phép {r.excused}</span>}
                  </p>
                </div>
                <Badge
                  tone={r.rate >= 90 ? 'ok' : r.rate >= 75 ? 'warn' : 'danger'}
                  variant="soft"
                >
                  Chuyên cần {r.rate}%
                </Badge>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Chưa có dữ liệu trong khoảng thời gian này.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
