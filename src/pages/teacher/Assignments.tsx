import { FileText, ListChecks, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { ClassPicker } from '@/components/ClassPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment,
  type AssignmentInput,
  type AssignmentRow,
} from '@/lib/api/assignments'
import { describeDue, fromLocalInput, toLocalInput } from '@/lib/format'
import { assignmentTypeLabel, type AssignmentType, type ShowAnswersMode } from '@/lib/types'

export default function Assignments() {
  const navigate = useNavigate()
  const [classId, setClassId] = useState<string | null>(null)
  const [rows, setRows] = useState<AssignmentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AssignmentRow | null>(null)
  const [deleting, setDeleting] = useState<AssignmentRow | null>(null)

  const load = useCallback(async () => {
    if (!classId) return
    setRows(null)
    setError(null)
    try {
      setRows(await listAssignments(classId))
    } catch {
      setError('Không tải được danh sách bài tập.')
      setRows([])
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Bài tập</h1>
          <p className="mt-1 text-muted-foreground">Giao bài trắc nghiệm hoặc tự luận cho lớp.</p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!classId}>
          <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Tạo bài tập
        </Button>
      </div>

      <div className="mt-4">
        <ClassPicker value={classId} onChange={setClassId} />
      </div>

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
      ) : rows.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="font-semibold">Chưa có bài tập nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bấm “Tạo bài tập” để giao bài đầu tiên cho lớp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((a) => (
            <AssignmentCard
              key={a.id}
              row={a}
              onEdit={() => setEditing(a)}
              onDelete={() => setDeleting(a)}
              onCompose={() => navigate(`/teacher/assignments/${a.id}`)}
              onSubmissions={() => navigate(`/teacher/assignments/${a.id}/submissions`)}
            />
          ))}
        </div>
      )}

      {creating && classId && (
        <AssignmentFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false)
            navigate(`/teacher/assignments/${created}`)
          }}
          classId={classId}
        />
      )}
      {editing && (
        <AssignmentFormDialog
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          row={deleting}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function AssignmentCard({
  row,
  onEdit,
  onDelete,
  onCompose,
  onSubmissions,
}: {
  row: AssignmentRow
  onEdit: () => void
  onDelete: () => void
  onCompose: () => void
  onSubmissions: () => void
}) {
  const due = describeDue(row.due_at)
  const Icon = row.type === 'quiz' ? ListChecks : FileText
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.type === 'quiz' ? 'progress' : 'neutral'} variant="soft">
              <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
              {assignmentTypeLabel[row.type]}
            </Badge>
            {due.overdue ? (
              <Badge tone="danger" variant="soft">
                {due.text}
              </Badge>
            ) : (
              <Badge tone={due.urgent ? 'warn' : 'neutral'} variant="soft">
                {due.text}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 truncate font-semibold">{row.title}</p>
          <p className="text-sm text-muted-foreground">{row.question_count} câu hỏi</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="soft" size="sm" onClick={onCompose}>
            <ListChecks className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Soạn đề
          </Button>
          <Button variant="outline" size="sm" onClick={onSubmissions}>
            <Users className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Bài nộp
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} aria-label="Sửa bài tập">
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Sửa
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Xoá bài tập">
            <Trash2 className="size-4 text-danger-foreground" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const SHOW_ANSWERS_LABEL: Record<ShowAnswersMode, string> = {
  after_submit: 'Ngay sau khi nộp',
  after_due: 'Sau khi hết hạn',
  never: 'Không hiện',
}

function defaultInput(): AssignmentInput {
  const now = new Date()
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    title: '',
    description: null,
    type: 'quiz',
    open_at: now.toISOString(),
    due_at: due.toISOString(),
    allow_late: false,
    time_limit_minutes: null,
    max_attempts: 1,
    shuffle: false,
    show_answers: 'after_due',
  }
}

function AssignmentFormDialog(
  props:
    | {
        mode: 'create'
        classId: string
        onClose: () => void
        onCreated: (id: string) => void
      }
    | {
        mode: 'edit'
        initial: AssignmentRow
        onClose: () => void
        onSaved: () => void
      },
) {
  const initialInput: AssignmentInput =
    props.mode === 'edit'
      ? {
          title: props.initial.title,
          description: props.initial.description,
          type: props.initial.type,
          open_at: props.initial.open_at,
          due_at: props.initial.due_at,
          allow_late: props.initial.allow_late,
          time_limit_minutes: props.initial.time_limit_minutes,
          max_attempts: props.initial.max_attempts,
          shuffle: props.initial.shuffle,
          show_answers: props.initial.show_answers,
        }
      : defaultInput()

  const [form, setForm] = useState<AssignmentInput>(initialInput)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) {
      setError('Bạn hãy nhập tiêu đề bài tập.')
      return
    }
    if (new Date(form.due_at) <= new Date(form.open_at)) {
      setError('Hạn nộp phải sau thời gian mở bài.')
      return
    }
    setSaving(true)
    try {
      if (props.mode === 'create') {
        const created = await createAssignment(props.classId, {
          ...form,
          description: form.description?.trim() || null,
        })
        props.onCreated(created.id)
      } else {
        await updateAssignment(props.initial.id, {
          ...form,
          description: form.description?.trim() || null,
        })
        props.onSaved()
      }
    } catch {
      setError('Không lưu được bài tập. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Tạo bài tập' : 'Sửa bài tập'}
      footer={
        <>
          <Button variant="outline" onClick={props.onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="asg-form" loading={saving}>
            {props.mode === 'create' ? 'Tạo' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="asg-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="asg-title">Tiêu đề</Label>
          <Input
            id="asg-title"
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="VD: Kiểm tra 15 phút — Hàm số"
          />
        </div>
        <div>
          <Label htmlFor="asg-desc">Mô tả (tuỳ chọn)</Label>
          <Textarea
            id="asg-desc"
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="asg-type">Loại bài</Label>
            <Select
              id="asg-type"
              value={form.type}
              disabled={props.mode === 'edit'}
              onChange={(e) => set('type', e.target.value as AssignmentType)}
            >
              <option value="quiz">{assignmentTypeLabel.quiz}</option>
              <option value="essay">{assignmentTypeLabel.essay}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="asg-show">Hiện đáp án</Label>
            <Select
              id="asg-show"
              value={form.show_answers}
              onChange={(e) => set('show_answers', e.target.value as ShowAnswersMode)}
            >
              <option value="after_submit">{SHOW_ANSWERS_LABEL.after_submit}</option>
              <option value="after_due">{SHOW_ANSWERS_LABEL.after_due}</option>
              <option value="never">{SHOW_ANSWERS_LABEL.never}</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="asg-open">Mở bài lúc</Label>
            <Input
              id="asg-open"
              type="datetime-local"
              value={toLocalInput(form.open_at)}
              onChange={(e) => set('open_at', fromLocalInput(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="asg-due">Hạn nộp</Label>
            <Input
              id="asg-due"
              type="datetime-local"
              required
              value={toLocalInput(form.due_at)}
              onChange={(e) => set('due_at', fromLocalInput(e.target.value))}
            />
          </div>
        </div>

        {form.type === 'quiz' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="asg-limit">Giới hạn thời gian (phút)</Label>
              <Input
                id="asg-limit"
                type="number"
                min={0}
                value={form.time_limit_minutes ?? ''}
                placeholder="Không giới hạn"
                onChange={(e) =>
                  set('time_limit_minutes', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>
            <div>
              <Label htmlFor="asg-attempts">Số lần làm tối đa</Label>
              <Input
                id="asg-attempts"
                type="number"
                min={1}
                value={form.max_attempts}
                onChange={(e) => set('max_attempts', Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
        )}

        <div className="space-y-2.5 rounded-2xl bg-background p-3">
          <CheckRow
            id="asg-late"
            label="Cho phép nộp muộn"
            checked={form.allow_late}
            onChange={(v) => set('allow_late', v)}
          />
          {form.type === 'quiz' && (
            <CheckRow
              id="asg-shuffle"
              label="Xáo trộn câu hỏi và đáp án"
              checked={form.shuffle}
              onChange={(v) => set('shuffle', v)}
            />
          )}
        </div>

        {error && (
          <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}
        {props.mode === 'create' && (
          <p className="text-sm text-muted-foreground">Tạo xong sẽ mở màn soạn câu hỏi.</p>
        )}
      </form>
    </Dialog>
  )
}

function CheckRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm font-medium">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-primary"
      />
      {label}
    </label>
  )
}

function ConfirmDeleteDialog({
  row,
  onClose,
  onDone,
}: {
  row: AssignmentRow
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setSaving(true)
    setError(null)
    try {
      await deleteAssignment(row.id)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xoá được bài tập.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Xoá bài tập?"
      description={`“${row.title}” sẽ bị xoá vĩnh viễn cùng toàn bộ câu hỏi.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={saving}>
            Xoá
          </Button>
        </>
      }
    >
      {error && (
        <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}
    </Dialog>
  )
}
