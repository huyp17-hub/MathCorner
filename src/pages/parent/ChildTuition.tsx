import dayjs from 'dayjs'
import { Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ChildPicker } from '@/components/ChildPicker'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  parentChildClasses,
  parentChildPayments,
  type ParentChildClass,
  type ParentPayment,
} from '@/lib/api/parent'
import { tuitionSummary, type TuitionRow } from '@/lib/api/tuition'
import { formatDate, formatMoney } from '@/lib/format'
import { paymentMethodLabel } from '@/lib/types'

interface ClassTuition {
  cls: ParentChildClass
  row: TuitionRow | null
}

export default function ChildTuition() {
  const [studentId, setStudentId] = useState<string | null>(null)
  const [items, setItems] = useState<ClassTuition[] | null>(null)
  const [payments, setPayments] = useState<ParentPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      const classes = await parentChildClasses(sid)
      const month = dayjs().format('YYYY-MM-01')
      const results = await Promise.all(
        classes.map(async (cls) => {
          try {
            const rows = await tuitionSummary(cls.class_id, month)
            return { cls, row: rows.find((r) => r.student_id === sid) ?? null }
          } catch {
            return { cls, row: null }
          }
        }),
      )
      setItems(results)
      setPayments(await parentChildPayments(sid))
    } catch {
      setError('Không tải được thông tin học phí.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (studentId) load(studentId)
  }, [studentId, load])

  function handleChildChange(sid: string) {
    setStudentId(sid)
    setItems(null)
    setPayments([])
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Học phí của con</h1>
      <p className="mt-1 text-muted-foreground">Số buổi còn lại và các lần đã đóng.</p>

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
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[2rem] bg-border/50" />
          ))}
        </div>
      )}

      {!loading && items && items.length === 0 && (
        <Card className="mt-6">
          <CardContent className="py-10 text-center">
            <Wallet className="mx-auto size-10 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="mt-2 text-sm text-muted-foreground">Chưa có lớp nào.</p>
          </CardContent>
        </Card>
      )}

      {!loading && items && items.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map(({ cls, row }) => (
            <Card key={cls.class_id}>
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {!row ? (
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu học phí.</p>
                ) : cls.billing_mode === 'package' ? (
                  <div>
                    <p className="text-3xl font-extrabold tracking-tight">
                      {row.sessions_remaining ?? 0}
                      <span className="ml-1 text-base font-semibold text-muted-foreground">
                        buổi còn lại
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Đã mua {row.sessions_purchased ?? 0} · đã dùng {row.sessions_used_total}
                    </p>
                    {row.low_sessions && (
                      <Badge tone="warn" variant="soft" className="mt-2">
                        Sắp hết gói
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Tháng này</p>
                    <p className="text-2xl font-extrabold tracking-tight">
                      {row.sessions_in_month} buổi
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Phải đóng {formatMoney(row.amount_due_month)}
                    </p>
                  </div>
                )}
                {row && row.balance > 0 && (
                  <Badge tone="danger" variant="soft" className="mt-2">
                    Còn nợ {formatMoney(row.balance)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && payments.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-bold tracking-tight">Lịch sử đóng tiền</h2>
          <div className="mt-3 space-y-2">
            {payments.map((p, i) => (
              <Card key={i}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold">{formatMoney(p.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(p.paid_on)} · {paymentMethodLabel[p.method]}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
