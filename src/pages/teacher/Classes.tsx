import { BookOpen, Plus, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { createClass, listTeacherClasses, type ClassRow } from '@/lib/api/classes'

export default function TeacherClasses() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState<ClassRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    try {
      setClasses(await listTeacherClasses(user.id))
    } catch {
      setError('Không tải được danh sách lớp. Bạn thử lại nhé.')
      setClasses([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Lớp học</h1>
          <p className="mt-1 text-muted-foreground">Quản lý lớp, mã tham gia và học sinh.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Tạo lớp
        </Button>
      </div>

      {error && (
        <p className="mt-5 rounded-2xl bg-danger px-4 py-3 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {classes === null ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-[2rem] bg-black/[0.04]" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="mt-5">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary-softer text-primary-foreground">
              <BookOpen className="size-7" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="font-semibold">Chưa có lớp nào</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tạo lớp đầu tiên để thêm học sinh, điểm danh và giao bài nhé.
            </p>
            <Button className="mt-1" onClick={() => setOpen(true)}>
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Tạo lớp
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/teacher/classes/${c.id}`)}
              className="group text-left"
            >
              <Card className="h-full transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold tracking-tight">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[c.subject, c.school_year].filter(Boolean).join(' · ') || 'Chưa đặt môn'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Badge tone="neutral" variant="soft" className="font-mono tracking-widest">
                      {c.join_code}
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                      <Users className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      {c.student_count} học sinh
                    </span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <CreateClassDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(id) => {
          setOpen(false)
          navigate(`/teacher/classes/${id}`)
        }}
      />
    </div>
  )
}

function CreateClassDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [year, setYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setSaving(true)
    try {
      const cls = await createClass(user.id, { name, subject, school_year: year })
      setName('')
      setSubject('')
      setYear('')
      onCreated(cls.id)
    } catch {
      setError('Không tạo được lớp. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tạo lớp mới"
      description="Đặt tên lớp; môn và năm học có thể để trống."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="create-class-form" loading={saving}>
            Tạo lớp
          </Button>
        </>
      }
    >
      <form id="create-class-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="c-name">Tên lớp</Label>
          <Input
            id="c-name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VD: Toán 9A"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-subject">Môn</Label>
            <Input
              id="c-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Toán"
            />
          </div>
          <div>
            <Label htmlFor="c-year">Năm học</Label>
            <Input
              id="c-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2025-2026"
            />
          </div>
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
