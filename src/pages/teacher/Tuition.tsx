import dayjs from 'dayjs'
import { Download, PackagePlus, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClassPicker } from '@/components/ClassPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import {
  addPackage,
  addPayment,
  tuitionSummary,
  type TuitionRow,
} from '@/lib/api/tuition'
import { formatMoney } from '@/lib/format'
import { exportToXlsx } from '@/lib/xlsx'
import { paymentMethodLabel, type PaymentMethod } from '@/lib/types'

type Filter = 'all' | 'low' | 'debt'

export default function Tuition() {
  const [classId, setClassId] = useState<string | null>(null)
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [rows, setRows] = useState<TuitionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [pkgFor, setPkgFor] = useState<TuitionRow | null>(null)
  const [payFor, setPayFor] = useState<TuitionRow | null>(null)

  const load = useCallback(async () => {
    if (!classId) return
    setRows(null)
    setError(null)
    try {
      setRows(await tuitionSummary(classId, `${month}-01`))
    } catch {
      setError('Không tải được bảng học phí.')
      setRows([])
    }
  }, [classId, month])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!rows) return []
    if (filter === 'low') return rows.filter((r) => r.low_sessions)
    if (filter === 'debt') return rows.filter((r) => r.balance > 0)
    return rows
  }, [rows, filter])

  function onExport() {
    if (!rows) return
    const data = rows.map((r) => {
      const base: Record<string, string | number | null> = { 'Họ tên': r.full_name }
      if (r.billing_mode === 'package') {
        base['Đã mua (buổi)'] = r.sessions_purchased ?? 0
        base['Đã dùng'] = r.sessions_used_total
        base['Còn lại'] = r.sessions_remaining ?? 0
      } else {
        base['Buổi tháng này'] = r.sessions_in_month
        base['Phải đóng tháng'] = r.amount_due_month ?? 0
      }
      base['Tổng phải đóng'] = r.amount_total
      base['Đã đóng'] = r.paid_total
      base['Còn nợ'] = r.balance
      return base
    })
    exportToXlsx(data, `hoc-phi-${month}`, 'Học phí')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Học phí</h1>
      <p className="mt-1 text-muted-foreground">
        Theo dõi buổi học và khoản đã đóng. Web chỉ ghi nhận, không thu tiền.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <ClassPicker value={classId} onChange={setClassId} />
        <div>
          <Label htmlFor="month">Tháng</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <Button variant="outline" onClick={onExport} disabled={!rows || rows.length === 0}>
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Xuất Excel
        </Button>
      </div>

      {classId && (
        <div className="mt-4 flex gap-1 rounded-full border border-border bg-card p-1 sm:w-fit">
          {(
            [
              { id: 'all', label: 'Tất cả' },
              { id: 'low', label: 'Sắp hết gói' },
              { id: 'debt', label: 'Còn nợ' },
            ] as { id: Filter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:flex-none',
                filter === f.id
                  ? 'bg-primary-softer text-primary-foreground'
                  : 'text-muted-foreground hover:bg-black/[0.04]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((r) => (
            <Card key={r.student_id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{r.full_name}</p>
                    {r.low_sessions && (
                      <Badge tone="warn" variant="soft">
                        Sắp hết gói
                      </Badge>
                    )}
                    {r.balance > 0 && (
                      <Badge tone="danger" variant="soft">
                        Nợ {formatMoney(r.balance)}
                      </Badge>
                    )}
                    {r.balance <= 0 && r.amount_total > 0 && (
                      <Badge tone="ok" variant="soft">
                        Đã đủ
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                    {r.billing_mode === 'package' ? (
                      <>
                        <span>Đã mua {r.sessions_purchased ?? 0} buổi</span>
                        <span>Đã dùng {r.sessions_used_total}</span>
                        <span
                          className={cn(
                            'font-semibold',
                            (r.sessions_remaining ?? 0) <= 0
                              ? 'text-danger-foreground'
                              : 'text-foreground',
                          )}
                        >
                          Còn {r.sessions_remaining ?? 0} buổi
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{r.sessions_in_month} buổi tháng này</span>
                        <span>Phải đóng {formatMoney(r.amount_due_month)}</span>
                      </>
                    )}
                    <span>Đã đóng {formatMoney(r.paid_total)}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.billing_mode === 'package' && (
                    <Button variant="outline" size="sm" onClick={() => setPkgFor(r)}>
                      <PackagePlus className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      Thêm gói
                    </Button>
                  )}
                  <Button variant="soft" size="sm" onClick={() => setPayFor(r)}>
                    <Wallet className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    Ghi đóng tiền
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {rows.length === 0 ? 'Lớp chưa có học sinh.' : 'Không có học sinh phù hợp bộ lọc.'}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {pkgFor && classId && (
        <AddPackageDialog
          classId={classId}
          row={pkgFor}
          onClose={() => setPkgFor(null)}
          onDone={() => {
            setPkgFor(null)
            void load()
          }}
        />
      )}
      {payFor && classId && (
        <AddPaymentDialog
          classId={classId}
          row={payFor}
          onClose={() => setPayFor(null)}
          onDone={() => {
            setPayFor(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function AddPackageDialog({
  classId,
  row,
  onClose,
  onDone,
}: {
  classId: string
  row: TuitionRow
  onClose: () => void
  onDone: () => void
}) {
  const [sessions, setSessions] = useState('12')
  const [price, setPrice] = useState('1200000')
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addPackage(classId, {
        student_id: row.student_id,
        sessions: Number(sessions),
        price: price ? Number(price) : null,
        start_date: startDate,
        note,
      })
      onDone()
    } catch {
      setError('Không thêm được gói. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Thêm gói cho ${row.full_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="add-pkg-form" loading={saving}>
            Thêm gói
          </Button>
        </>
      }
    >
      <form id="add-pkg-form" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pk-sessions">Số buổi</Label>
            <Input
              id="pk-sessions"
              type="number"
              min={1}
              required
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pk-price">Giá gói (đ)</Label>
            <Input
              id="pk-price"
              type="number"
              min={0}
              step={1000}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="pk-date">Ngày bắt đầu</Label>
          <Input
            id="pk-date"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pk-note">Ghi chú</Label>
          <Input id="pk-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

function AddPaymentDialog({
  classId,
  row,
  onClose,
  onDone,
}: {
  classId: string
  row: TuitionRow
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState(row.balance > 0 ? String(row.balance) : '')
  const [paidOn, setPaidOn] = useState(dayjs().format('YYYY-MM-DD'))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await addPayment(classId, {
        student_id: row.student_id,
        amount: Number(amount),
        paid_on: paidOn,
        method,
        note,
      })
      onDone()
    } catch {
      setError('Không ghi được khoản đóng. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Ghi nhận đóng tiền — ${row.full_name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="add-pay-form" loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="add-pay-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="pay-amount">Số tiền (đ)</Label>
          <Input
            id="pay-amount"
            type="number"
            min={0}
            step={1000}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="VD: 1200000"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pay-date">Ngày đóng</Label>
            <Input
              id="pay-date"
              type="date"
              required
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay-method">Hình thức</Label>
            <Select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{paymentMethodLabel.cash}</option>
              <option value="transfer">{paymentMethodLabel.transfer}</option>
              <option value="other">{paymentMethodLabel.other}</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="pay-note">Ghi chú</Label>
          <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}
