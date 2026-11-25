import {
  BookOpen,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Image,
  Link2,
  Music,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createLesson,
  deleteLesson,
  deleteLessonFile,
  getLessonWithFiles,
  listLessons,
  updateLesson,
  uploadLessonFile,
  validateLessonFile,
  addLessonLink,
  type Lesson,
  type LessonFile,
  type LessonInput,
} from '@/lib/api/lessons'

export function LessonsPanel({ classId }: { classId: string }) {
  const [rows, setRows] = useState<Lesson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Lesson | null>(null)
  const [managing, setManaging] = useState<Lesson | null>(null)
  const [deleting, setDeleting] = useState<Lesson | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listLessons(classId))
    } catch {
      setError('Không tải được danh sách bài giảng.')
      setRows([])
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Bài giảng</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Thêm bài giảng
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {rows === null ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.5} />
            <p className="mt-2 font-semibold">Chưa có bài giảng nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Thêm bài giảng để học sinh xem lại tài liệu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onEdit={() => setEditing(lesson)}
              onManageFiles={() => setManaging(lesson)}
              onDelete={() => setDeleting(lesson)}
              onTogglePublish={async () => {
                await updateLesson(lesson.id, { published: !lesson.published })
                void load()
              }}
            />
          ))}
        </div>
      )}

      {creating && (
        <LessonFormDialog
          mode="create"
          classId={classId}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            void load()
          }}
        />
      )}
      {editing && (
        <LessonFormDialog
          mode="edit"
          lesson={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      {managing && (
        <ManageFilesDialog
          classId={classId}
          lesson={managing}
          onClose={() => {
            setManaging(null)
            void load()
          }}
        />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          lesson={deleting}
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

function LessonCard({
  lesson,
  onEdit,
  onManageFiles,
  onDelete,
  onTogglePublish,
}: {
  lesson: Lesson
  onEdit: () => void
  onManageFiles: () => void
  onDelete: () => void
  onTogglePublish: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {lesson.topic && (
              <Badge tone="neutral" variant="soft">
                {lesson.topic}
              </Badge>
            )}
            <Badge
              tone={lesson.published ? 'ok' : 'neutral'}
              variant="soft"
            >
              {lesson.published ? (
                <><Eye className="size-3.5" strokeWidth={2} aria-hidden="true" /> Đã đăng</>
              ) : (
                <><EyeOff className="size-3.5" strokeWidth={2} aria-hidden="true" /> Nháp</>
              )}
            </Badge>
          </div>
          <p className="mt-1.5 font-semibold">{lesson.title}</p>
          {lesson.description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
              {lesson.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="soft" size="sm" onClick={onManageFiles}>
            <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tài liệu
          </Button>
          <Button variant="outline" size="sm" onClick={onTogglePublish}>
            {lesson.published ? (
              <><EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" /> Ẩn</>
            ) : (
              <><Eye className="size-4" strokeWidth={1.75} aria-hidden="true" /> Đăng</>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Sửa
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Xoá bài giảng">
            <Trash2 className="size-4 text-danger-foreground" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LessonFormDialog(
  props:
    | { mode: 'create'; classId: string; onClose: () => void; onDone: () => void }
    | { mode: 'edit'; lesson: Lesson; onClose: () => void; onDone: () => void },
) {
  const initial: LessonInput =
    props.mode === 'edit'
      ? {
          title: props.lesson.title,
          description: props.lesson.description,
          topic: props.lesson.topic,
          published: props.lesson.published,
        }
      : { title: '', description: null, topic: null, published: false }

  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof LessonInput>(key: K, val: LessonInput[K]) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Nhập tiêu đề bài giảng.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      if (props.mode === 'create') {
        await createLesson(props.classId, {
          ...form,
          description: form.description?.trim() || null,
          topic: form.topic?.trim() || null,
        })
      } else {
        await updateLesson(props.lesson.id, {
          ...form,
          description: form.description?.trim() || null,
          topic: form.topic?.trim() || null,
        })
      }
      props.onDone()
    } catch {
      setError('Không lưu được. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={props.onClose}
      title={props.mode === 'create' ? 'Thêm bài giảng' : 'Sửa bài giảng'}
      footer={
        <>
          <Button variant="outline" onClick={props.onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="lesson-form" loading={saving}>
            {props.mode === 'create' ? 'Tạo' : 'Lưu'}
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="l-title">Tiêu đề</Label>
          <Input
            id="l-title"
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="VD: Chương 1 — Hàm số"
          />
        </div>
        <div>
          <Label htmlFor="l-topic">Chủ đề (tuỳ chọn)</Label>
          <Input
            id="l-topic"
            value={form.topic ?? ''}
            onChange={(e) => set('topic', e.target.value)}
            placeholder="VD: Đại số, Hình học…"
          />
        </div>
        <div>
          <Label htmlFor="l-desc">Mô tả (tuỳ chọn)</Label>
          <Textarea
            id="l-desc"
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Nội dung tóm tắt bài giảng…"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set('published', e.target.checked)}
            className="size-5 shrink-0 accent-primary"
          />
          Đăng ngay (học sinh có thể xem)
        </label>
        {error && (
          <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

const KIND_ICON: Record<string, typeof FileText> = {
  image: Image,
  video: Video,
  audio: Music,
  link: Link2,
  document: FileText,
}

function ManageFilesDialog({
  classId,
  lesson,
  onClose,
}: {
  classId: string
  lesson: Lesson
  onClose: () => void
}) {
  const [files, setFiles] = useState<(LessonFile & { signed_url: string | null })[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const loadFiles = useCallback(async () => {
    try {
      const data = await getLessonWithFiles(lesson.id)
      setFiles(data.files)
    } catch {
      setError('Không tải được tài liệu.')
    } finally {
      setLoading(false)
    }
  }, [lesson.id])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  async function handleUpload(picked: FileList | null) {
    if (!picked || picked.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(picked)) {
        const err = validateLessonFile(file)
        if (err) {
          setError(`${file.name}: ${err}`)
          continue
        }
        const row = await uploadLessonFile(classId, lesson.id, file)
        setFiles((prev) => [...prev, { ...row, signed_url: null }])
      }
      await loadFiles()
    } catch {
      setError('Không tải file lên được.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleRemove(f: LessonFile & { signed_url: string | null }) {
    try {
      await deleteLessonFile(f)
      setFiles((prev) => prev.filter((x) => x.id !== f.id))
    } catch {
      setError('Không xoá được file.')
    }
  }

  async function handleAddLink() {
    if (!linkUrl.trim()) return
    setError(null)
    try {
      const row = await addLessonLink(lesson.id, linkUrl.trim(), linkName.trim() || linkUrl.trim())
      setFiles((prev) => [...prev, { ...row, signed_url: row.url }])
      setLinkUrl('')
      setLinkName('')
      setLinkMode(false)
    } catch {
      setError('Không thêm được link.')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Tài liệu — ${lesson.title}`}
      className="max-w-lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            loading={uploading}
          >
            <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Tải file lên
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLinkMode(!linkMode)}>
            <Link2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Thêm link
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.mp3"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        {linkMode && (
          <div className="space-y-2 rounded-2xl bg-background p-3">
            <Input
              placeholder="URL (VD: https://youtube.com/...)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Input
              placeholder="Tên hiển thị (tuỳ chọn)"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddLink} disabled={!linkUrl.trim()}>
                Thêm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLinkMode(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}

        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-black/[0.04]" />
        ) : files.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có tài liệu nào. Tải file hoặc thêm link.
          </p>
        ) : (
          <div className="space-y-1.5">
            {files.map((f) => {
              const Icon = KIND_ICON[f.kind] ?? FileText
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.file_name}</p>
                    {f.size_bytes != null && (
                      <p className="text-xs text-muted-foreground">
                        {(f.size_bytes / 1024 / 1024).toFixed(1)} MB
                      </p>
                    )}
                  </div>
                  {f.signed_url && (
                    <a
                      href={f.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-info hover:text-info/80"
                      aria-label="Mở"
                    >
                      <ExternalLink className="size-4" strokeWidth={1.75} />
                    </a>
                  )}
                  <button
                    onClick={() => handleRemove(f)}
                    className="shrink-0 text-muted-foreground hover:text-danger-foreground"
                    aria-label="Xoá file"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  lesson,
  onClose,
  onDone,
}: {
  lesson: Lesson
  onClose: () => void
  onDone: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onConfirm() {
    setSaving(true)
    setError(null)
    try {
      await deleteLesson(lesson.id)
      onDone()
    } catch {
      setError('Không xoá được bài giảng.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Xoá bài giảng?"
      description={`"${lesson.title}" và tài liệu đính kèm sẽ bị xoá vĩnh viễn.`}
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
