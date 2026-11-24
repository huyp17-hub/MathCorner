import { Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ClassPicker } from '@/components/ClassPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getGradebook, gradebookToRows, type GradebookData } from '@/lib/api/gradebook'
import { formatDate } from '@/lib/format'
import { submissionLabel, submissionTone } from '@/lib/types'
import { exportToXlsx } from '@/lib/xlsx'

export default function Gradebook() {
  const [classId, setClassId] = useState<string | null>(null)
  const [data, setData] = useState<GradebookData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (cid: string) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getGradebook(cid))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải bảng điểm.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (classId) load(classId)
  }, [classId, load])

  async function handleExport() {
    if (!data) return
    const rows = gradebookToRows(data)
    await exportToXlsx(rows, 'bang-diem.xlsx', 'Bảng điểm')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bảng điểm</h1>
          <p className="mt-1 text-muted-foreground">Điểm toàn bộ bài tập theo lớp.</p>
        </div>
        {data && data.assignments.length > 0 && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-1.5 size-4" strokeWidth={1.75} />
            Xuất Excel
          </Button>
        )}
      </div>

      <div className="mt-4">
        <ClassPicker value={classId} onChange={setClassId} />
      </div>

      {loading && <Skeleton />}
      {error && <p className="mt-4 text-sm text-danger-foreground">{error}</p>}

      {!loading && data && data.assignments.length === 0 && (
        <p className="mt-8 text-center text-muted-foreground">Lớp chưa có bài tập nào.</p>
      )}

      {!loading && data && data.assignments.length > 0 && (
        <Card className="mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="sticky left-0 z-10 bg-background px-3 py-2.5 text-left font-bold shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                    Học sinh
                  </th>
                  {data.assignments.map((a) => (
                    <th
                      key={a.id}
                      className="min-w-[100px] px-3 py-2.5 text-center font-bold"
                      title={`${a.title} — Hạn ${formatDate(a.due_at)}`}
                    >
                      <span className="line-clamp-2">{a.title}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        /{a.max_score}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-bold">TB</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => {
                  let total = 0
                  let maxTotal = 0
                  let graded = 0
                  for (const a of data.assignments) {
                    const cell = s.cells.get(a.id)
                    if (cell?.score != null && cell.max_score != null) {
                      total += cell.score
                      maxTotal += cell.max_score
                      graded++
                    }
                  }
                  const avg = graded > 0 ? (total / maxTotal) * 10 : null
                  return (
                    <tr key={s.student_id} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                        <div className="max-w-[160px] truncate">{s.full_name}</div>
                        {s.student_code && (
                          <span className="text-xs text-muted-foreground">{s.student_code}</span>
                        )}
                      </td>
                      {data.assignments.map((a) => {
                        const cell = s.cells.get(a.id)!
                        return (
                          <td key={a.id} className="px-3 py-2 text-center">
                            {cell.score != null ? (
                              <span className="font-bold">{cell.score}</span>
                            ) : (
                              <Badge tone={submissionTone(cell.status, cell.is_late)} variant="soft">
                                {submissionLabel(cell.status, cell.is_late)}
                              </Badge>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-bold">
                        {avg != null ? avg.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-4 space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded-2xl bg-border/50" />
      ))}
    </div>
  )
}
