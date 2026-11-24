import { useCallback, useEffect, useState } from 'react'
import { Select } from '@/components/ui/select'
import { parentChildren, type ParentChild } from '@/lib/api/parent'

interface ChildPickerProps {
  value: string | null
  onChange: (studentId: string) => void
}

/** Ô chọn con cho phụ huynh. Tự tải danh sách con; nếu chỉ có 1 thì tự chọn. */
export function ChildPicker({ value, onChange }: ChildPickerProps) {
  const [children, setChildren] = useState<ParentChild[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const kids = await parentChildren()
      setChildren(kids)
      if (kids.length === 1 && !value) {
        onChange(kids[0].student_id)
      }
    } catch {
      /* lỗi tải */
    } finally {
      setLoading(false)
    }
  }, [onChange, value])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <div className="h-11 animate-pulse rounded-2xl bg-border/50" />
  }

  if (children.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa liên kết với con nào.
      </p>
    )
  }

  if (children.length === 1) {
    return (
      <p className="text-sm font-medium">
        {children[0].full_name}
      </p>
    )
  }

  return (
    <Select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Chọn con"
    >
      <option value="" disabled>
        Chọn con
      </option>
      {children.map((c) => (
        <option key={c.student_id} value={c.student_id}>
          {c.full_name}
        </option>
      ))}
    </Select>
  )
}
