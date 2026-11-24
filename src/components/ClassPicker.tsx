import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { listTeacherClasses, type ClassRow } from '@/lib/api/classes'

/**
 * Chọn lớp của giáo viên. Tự tải danh sách; gọi onChange với lớp đầu tiên khi sẵn sàng.
 * Trả về trạng thái tải / rỗng qua render prop phía cha nếu cần.
 */
export function ClassPicker({
  value,
  onChange,
  label = 'Lớp',
}: {
  value: string | null
  onChange: (classId: string) => void
  label?: string
}) {
  const { user } = useAuth()
  const [classes, setClasses] = useState<ClassRow[] | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    listTeacherClasses(user.id)
      .then((list) => {
        if (!active) return
        setClasses(list)
        if (list.length > 0 && !value) onChange(list[0].id)
      })
      .catch(() => active && setClasses([]))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (classes === null) {
    return <div className="h-11 w-full max-w-xs animate-pulse rounded-2xl bg-black/[0.04]" />
  }

  if (classes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-semibold">Bạn chưa có lớp nào</p>
          <Link to="/teacher/classes" className="mt-1 inline-block font-semibold text-info">
            Tạo lớp đầu tiên →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-xs">
      <Label htmlFor="class-picker">{label}</Label>
      <Select
        id="class-picker"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.subject ? ` · ${c.subject}` : ''}
          </option>
        ))}
      </Select>
    </div>
  )
}
