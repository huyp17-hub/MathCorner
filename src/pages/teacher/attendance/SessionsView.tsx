import { CalendarPlus, ChevronRight, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import dayjs from 'dayjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import {
  createSession,
  deleteSession,
  ensureTodaySession,
  listSessions,
  type NewSessionInput,
} from '@/lib/api/attendance'
import { formatDate } from '@/lib/format'
import type { ClassSession } from '@/lib/types'

export function SessionsView({
  classId,
  onOpen,
}: {
  classId: string
  onOpen: (session: ClassSession) => void
}) {
  const [sessions, setSessions] = useState<ClassSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [startingToday, setStartingToday] = useState(false)
  const [deleting, setDeleting] = useState<ClassSession | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSessions(await listSessions(classId))
    } catch {
      setError('Không tải được danh sách buổi học.')
      setSessions([])
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  async function startToday() {
    setError(null)
    setStartingToday(true)
    try {
      const s = await ensureTodaySession(classId)
      onOpen(s)
    } catch {
      setError('Không mở được buổi hôm nay.')
    } finally {
      setStartingToday(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" onClick={startToday} loading={startingToday}>
          <Zap className="size-5" strokeWidth={1.75} aria-hidden="true" />
          Điểm danh hôm nay
        </Button>
        <Button variant="outline" size="lg" onClick={() => setCreating(true)}>
          <CalendarPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
          Tạo buổi khác
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {sessions === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center">
            <p className="font-semibold">Chưa có buổi học nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bấm “Điểm danh hôm nay” để tạo buổi đầu tiên.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-2 p-4">
                <button
                  type="button"
                  onClick={() => onOpen(s)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatDate(s.date)}
                      {s.period ? ` · ${s.period}` : ''}
                    </p>
                    {s.note && <p className="truncate text-sm text-muted-foreground">{s.note}</p>}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá buổi ${formatDate(s.date)}`}
                  onClick={() => setDeleting(s)}
                >
                  <Trash2 className="size-4 text-danger-foreground" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateSessionDialog
          onClose={() => setCreating(false)}
          onCreate={async (input) => {
            const s = await createSession(classId, input)
            setCreating(false)
            onOpen(s)
          }}
        />
      )}
      {deleting && (
        <Dialog
          open
          onClose={() => setDeleting(null)}
          title="Xoá buổi học?"
          description={`Buổi ${formatDate(deleting.date)} và điểm danh của buổi sẽ bị xoá.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Huỷ
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await deleteSession(deleting.id)
                    setSessions((list) => (list ? list.filter((x) => x.id !== deleting.id) : list))
                  } catch {
                    setError('Không xoá được buổi học.')
                  } finally {
                    setDeleting(null)
                  }
                }}
              >
                Xoá buổi
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">Hành động này không hoàn tác được.</p>
        </Dialog>
      )}
    </div>
  )
}

function CreateSessionDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: NewSessionInput) => Promise<void>
}) {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [period, setPeriod] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onCreate({ date, period, note })
    } catch {
      setError('Không tạo được buổi. Bạn thử lại nhé.')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Tạo buổi học"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="create-session-form" loading={saving}>
            Tạo & điểm danh
          </Button>
        </>
      }
    >
      <form id="create-session-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="ss-date">Ngày</Label>
          <Input
            id="ss-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="ss-period">Tiết / giờ (tuỳ chọn)</Label>
          <Input
            id="ss-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="VD: Ca tối 19:30"
          />
        </div>
        <div>
          <Label htmlFor="ss-note">Ghi chú (tuỳ chọn)</Label>
          <Input
            id="ss-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ôn tập chương 2"
          />
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
