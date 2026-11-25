import { ArrowLeft, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import {
  deleteClass,
  getClass,
  regenerateJoinCode,
  updateClass,
} from '@/lib/api/classes'
import type { Class } from '@/lib/types'
import { ChatPanel } from '@/components/ChatPanel'
import { useAuth } from '@/hooks/useAuth'
import { BillingPanel } from './class-detail/BillingPanel'
import { ImportPanel } from './class-detail/ImportPanel'
import { LessonsPanel } from './class-detail/LessonsPanel'
import { StudentsPanel } from './class-detail/StudentsPanel'

type Tab = 'students' | 'import' | 'lessons' | 'chat' | 'billing'

const tabs: { id: Tab; label: string }[] = [
  { id: 'students', label: 'Học sinh' },
  { id: 'import', label: 'Thêm hàng loạt' },
  { id: 'lessons', label: 'Bài giảng' },
  { id: 'chat', label: 'Thông báo' },
  { id: 'billing', label: 'Học phí' },
]

export default function ClassDetail() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [cls, setCls] = useState<Class | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('students')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [codeMsg, setCodeMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!classId) return
    try {
      const c = await getClass(classId)
      if (!c) setNotFound(true)
      else setCls(c)
    } catch {
      setNotFound(true)
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  async function onRegenerate() {
    if (!classId) return
    setCodeMsg(null)
    try {
      const code = await regenerateJoinCode(classId)
      setCls((c) => (c ? { ...c, join_code: code } : c))
      setCodeMsg('Đã tạo mã mới. Mã cũ không dùng được nữa.')
    } catch {
      setCodeMsg('Không tạo lại được mã. Bạn thử lại nhé.')
    }
  }

  if (notFound) {
    return (
      <div className="py-12 text-center">
        <p className="font-semibold">Không tìm thấy lớp này</p>
        <Link to="/teacher/classes" className="mt-2 inline-block font-semibold text-info">
          ← Về danh sách lớp
        </Link>
      </div>
    )
  }
  if (!cls) return <FullScreenLoader label="Đang tải lớp…" />

  return (
    <div>
      <Link
        to="/teacher/classes"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Danh sách lớp
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{cls.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {[cls.subject, cls.school_year].filter(Boolean).join(' · ') || 'Chưa đặt môn / năm học'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Sửa
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Xoá
          </Button>
        </div>
      </div>

      {/* Mã tham gia lớp */}
      <Card className="mt-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Mã tham gia lớp</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.3em]">
              {cls.join_code}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Học sinh nhập mã này để vào lớp.
            </p>
          </div>
          <Button variant="soft" size="sm" onClick={onRegenerate}>
            <RefreshCw className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tạo lại mã
          </Button>
        </CardContent>
      </Card>
      {codeMsg && <p className="mt-2 text-sm font-medium text-info">{codeMsg}</p>}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Nội dung lớp"
        className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              tab === t.id
                ? 'bg-primary-softer text-primary-foreground'
                : 'text-muted-foreground hover:bg-black/[0.04]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'students' && <StudentsPanel classId={cls.id} />}
        {tab === 'import' && <ImportPanel classId={cls.id} />}
        {tab === 'lessons' && <LessonsPanel classId={cls.id} />}
        {tab === 'chat' && user && (
          <ChatPanel classId={cls.id} userId={user.id} userRole="teacher" />
        )}
        {tab === 'billing' && <BillingPanel cls={cls} onSaved={(c) => setCls(c)} />}
      </div>

      <EditClassDialog
        open={editOpen}
        cls={cls}
        onClose={() => setEditOpen(false)}
        onSaved={(patch) => {
          setCls((c) => (c ? { ...c, ...patch } : c))
          setEditOpen(false)
        }}
      />
      <DeleteClassDialog
        open={deleteOpen}
        className={cls.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteClass(cls.id)
          navigate('/teacher/classes')
        }}
      />
    </div>
  )
}

function EditClassDialog({
  open,
  cls,
  onClose,
  onSaved,
}: {
  open: boolean
  cls: Class
  onClose: () => void
  onSaved: (patch: Pick<Class, 'name' | 'subject' | 'school_year'>) => void
}) {
  const [name, setName] = useState(cls.name)
  const [subject, setSubject] = useState(cls.subject ?? '')
  const [year, setYear] = useState(cls.school_year ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(cls.name)
      setSubject(cls.subject ?? '')
      setYear(cls.school_year ?? '')
      setError(null)
    }
  }, [open, cls])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const patch = { name, subject: subject || null, school_year: year || null }
      await updateClass(cls.id, patch)
      onSaved(patch)
    } catch {
      setError('Không lưu được. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sửa thông tin lớp"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="edit-class-form" loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="edit-class-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="e-name">Tên lớp</Label>
          <Input id="e-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="e-subject">Môn</Label>
            <Input id="e-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="e-year">Năm học</Label>
            <Input id="e-year" value={year} onChange={(e) => setYear(e.target.value)} />
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

function DeleteClassDialog({
  open,
  className: cName,
  onClose,
  onConfirm,
}: {
  open: boolean
  className: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doDelete() {
    setError(null)
    setDeleting(true)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xoá được lớp.')
      setDeleting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Xoá lớp?"
      description={`Lớp "${cName}" và dữ liệu điểm danh, bài tập của lớp sẽ bị xoá. Hành động này không hoàn tác được.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={doDelete} loading={deleting}>
            Xoá lớp
          </Button>
        </>
      }
    >
      {error && (
        <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-sm text-muted-foreground">
          Tài khoản học sinh không bị xoá, chỉ gỡ khỏi lớp này.
        </p>
      )}
    </Dialog>
  )
}
