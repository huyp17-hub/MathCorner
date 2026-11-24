import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/cn'
import { updateClassBilling } from '@/lib/api/classes'
import { attendanceLabel, type AttendanceStatus, type BillingMode, type Class } from '@/lib/types'

const BILLABLE_OPTIONS: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

export function BillingPanel({ cls, onSaved }: { cls: Class; onSaved: (c: Class) => void }) {
  const [mode, setMode] = useState<BillingMode>(cls.billing_mode)
  const [price, setPrice] = useState<string>(cls.price_per_session?.toString() ?? '')
  const [billable, setBillable] = useState<AttendanceStatus[]>(cls.billable_statuses)
  const [lowWarning, setLowWarning] = useState<string>(cls.low_session_warning.toString())
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(status: AttendanceStatus) {
    setBillable((list) =>
      list.includes(status) ? list.filter((s) => s !== status) : [...list, status],
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (billable.length === 0) {
      setError('Hãy chọn ít nhất một trạng thái được tính phí.')
      return
    }
    setSaving(true)
    try {
      const input = {
        billing_mode: mode,
        price_per_session: price ? Number(price) : null,
        billable_statuses: billable,
        low_session_warning: Number(lowWarning) || 0,
      }
      await updateClassBilling(cls.id, input)
      onSaved({ ...cls, ...input })
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch {
      setError('Không lưu được cài đặt. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label htmlFor="mode">Cách tính học phí</Label>
            <Select id="mode" value={mode} onChange={(e) => setMode(e.target.value as BillingMode)}>
              <option value="package">Theo gói buổi (mua trước N buổi)</option>
              <option value="per_session">Theo buổi (tính cuối tháng)</option>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {mode === 'package'
                ? 'Mỗi buổi được tính phí sẽ trừ 1 buổi trong gói của học sinh.'
                : 'Cuối tháng tính: số buổi được tính phí × đơn giá/buổi.'}
            </p>
          </div>

          <div>
            <Label htmlFor="price">Đơn giá mỗi buổi (đ)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="VD: 100000"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Dùng cho cách tính “theo buổi”; với gói buổi thì giá nhập khi thêm gói.
            </p>
          </div>

          <div>
            <Label>Trạng thái điểm danh được tính phí</Label>
            <div className="flex flex-wrap gap-2">
              {BILLABLE_OPTIONS.map((s) => {
                const active = billable.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                      active
                        ? 'border-primary bg-primary-softer text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-black/[0.04]',
                    )}
                  >
                    {active && <Check className="size-4" strokeWidth={2.25} aria-hidden="true" />}
                    {attendanceLabel[s]}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Mặc định tính “Có mặt” và “Đi muộn”.
            </p>
          </div>

          {mode === 'package' && (
            <div>
              <Label htmlFor="low">Cảnh báo khi còn ≤ (buổi)</Label>
              <Input
                id="low"
                type="number"
                min={0}
                inputMode="numeric"
                value={lowWarning}
                onChange={(e) => setLowWarning(e.target.value)}
                className="max-w-32"
              />
            </div>
          )}

          {error && (
            <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" loading={saving}>
              Lưu cài đặt
            </Button>
            {done && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok-foreground">
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                Đã lưu
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
