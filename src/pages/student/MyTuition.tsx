import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { getMyClasses, listMyPayments, type MyClass, type MyPayment } from '@/lib/api/student'
import { tuitionSummary, type TuitionRow } from '@/lib/api/tuition'
import { formatDate, formatMoney } from '@/lib/format'
import { paymentMethodLabel } from '@/lib/types'

interface ClassTuition {
  cls: MyClass
  row: TuitionRow | null
}

export default function MyTuition() {
  const { user } = useAuth()
  const [items, setItems] = useState<ClassTuition[] | null>(null)
  const [payments, setPayments] = useState<MyPayment[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      const classes = await getMyClasses(user.id)
      const month = dayjs().format('YYYY-MM-01')
      const results = await Promise.all(
        classes.map(async (cls) => {
          try {
            const rows = await tuitionSummary(cls.class_id, month)
            return { cls, row: rows.find((r) => r.student_id === user.id) ?? null }
          } catch {
            return { cls, row: null }
          }
        }),
      )
      setItems(results)
      setPayments(await listMyPayments(user.id))
    } catch {
      setError('Không tải được thông tin học phí.')
      setItems([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Học phí của tôi</h1>
      <p className="mt-1 text-muted-foreground">Số buổi còn lại và các lần đã đóng.</p>

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {items === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bạn chưa tham gia lớp nào.
          </CardContent>
        </Card>
      ) : (
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

      {payments.length > 0 && (
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
