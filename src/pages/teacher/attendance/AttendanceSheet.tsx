import { ArrowLeft, Check, MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { listMembers, type MemberRow } from '@/lib/api/classes'
import { getSessionAttendance, saveAttendance, type AttendanceEntry } from '@/lib/api/attendance'
import { formatDate } from '@/lib/format'
import { attendanceLabel, type AttendanceStatus, type ClassSession } from '@/lib/types'

interface Entry {
  status: AttendanceStatus
  note: string | null
}

// 3 nút lớn; "Vắng có phép" đặt trong menu phụ (nút ghi chú).
const BIG: { status: AttendanceStatus; label: string; active: string }[] = [
  { status: 'present', label: 'Có mặt', active: 'bg-ok text-ok-foreground border-ok-foreground/40' },
  { status: 'late', label: 'Muộn', active: 'bg-warn text-warn-foreground border-warn-foreground/40' },
  { status: 'absent', label: 'Vắng', active: 'bg-danger text-danger-foreground border-danger-foreground/40' },
]

export function AttendanceSheet({
  classId,
  session,
  onBack,
}: {
  classId: string
  session: ClassSession
  onBack: () => void
}) {
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [entries, setEntries] = useState<Record<string, Entry>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [noteFor, setNoteFor] = useState<MemberRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [mem, existing] = await Promise.all([
        listMembers(classId),
        getSessionAttendance(session.id),
      ])
      const init: Record<string, Entry> = {}
      for (const m of mem) {
        const e = existing.get(m.student_id)
        init[m.student_id] = e ? { status: e.status, note: e.note } : { status: 'present', note: null }
      }
      setMembers(mem)
      setEntries(init)
    } catch {
      setError('Không tải được danh sách. Bạn thử lại nhé.')
      setMembers([])
    }
  }, [classId, session.id])

  useEffect(() => {
    void load()
  }, [load])

  const presentCount = useMemo(
    () => Object.values(entries).filter((e) => e.status === 'present' || e.status === 'late').length,
    [entries],
  )

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSaved(false)
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  function markAllPresent() {
    setSaved(false)
    setEntries((prev) => {
      const next: Record<string, Entry> = {}
      for (const id of Object.keys(prev)) next[id] = { ...prev[id], status: 'present' }
      return next
    })
  }

  async function onSave() {
    if (!members) return
    setError(null)
    setSaving(true)
    try {
      const list: AttendanceEntry[] = members.map((m) => ({
        student_id: m.student_id,
        status: entries[m.student_id]?.status ?? 'present',
        note: entries[m.student_id]?.note ?? null,
      }))
      await saveAttendance(session.id, list)
      setSaved(true)
    } catch {
      setError('Không lưu được điểm danh. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  if (members === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/[0.04]" />
        ))}
      </div>
    )
  }

  return (
    <div className="pb-24">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Danh sách buổi
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Buổi {formatDate(session.date)}
            {session.period ? ` · ${session.period}` : ''}
          </h2>
          {session.note && <p className="text-sm text-muted-foreground">{session.note}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={markAllPresent}>
          <Check className="size-4" strokeWidth={2} aria-hidden="true" />
          Tất cả có mặt
        </Button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {members.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Lớp chưa có học sinh. Thêm học sinh trước khi điểm danh nhé.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {members.map((m) => {
            const entry = entries[m.student_id]
            const excused = entry?.status === 'excused'
            return (
              <Card key={m.student_id}>
                <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{m.full_name}</p>
                    {excused && (
                      <Badge tone="neutral" variant="soft" className="sm:hidden">
                        {attendanceLabel.excused}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-1 gap-1.5 sm:flex-none">
                      {BIG.map((b) => (
                        <button
                          key={b.status}
                          type="button"
                          onClick={() => setStatus(m.student_id, b.status)}
                          aria-pressed={entry?.status === b.status}
                          className={cn(
                            'min-h-11 flex-1 rounded-xl border px-3 text-sm font-semibold transition-colors sm:flex-none sm:px-4',
                            entry?.status === b.status
                              ? b.active
                              : 'border-border bg-card text-muted-foreground hover:bg-black/[0.04]',
                          )}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant={excused ? 'soft' : 'ghost'}
                      size="icon"
                      aria-label={`Vắng có phép / ghi chú cho ${m.full_name}`}
                      onClick={() => setNoteFor(m)}
                    >
                      <MessageSquare className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Thanh lưu cố định đáy */}
      {members.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 md:bottom-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-full border border-border bg-card/90 px-5 py-3 shadow-lift backdrop-blur-xl">
            <span className="text-sm font-semibold">
              Có mặt {presentCount}/{members.length}
            </span>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-ok-foreground">
                  <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                  Đã lưu
                </span>
              )}
              <Button onClick={onSave} loading={saving}>
                Lưu điểm danh
              </Button>
            </div>
          </div>
        </div>
      )}

      {noteFor && (
        <NoteDialog
          member={noteFor}
          entry={entries[noteFor.student_id]}
          onClose={() => setNoteFor(null)}
          onApply={(status, note) => {
            setSaved(false)
            setEntries((prev) => ({ ...prev, [noteFor.student_id]: { status, note } }))
            setNoteFor(null)
          }}
        />
      )}
    </div>
  )
}

function NoteDialog({
  member,
  entry,
  onClose,
  onApply,
}: {
  member: MemberRow
  entry: Entry | undefined
  onClose: () => void
  onApply: (status: AttendanceStatus, note: string | null) => void
}) {
  const [status, setStatus] = useState<AttendanceStatus>(entry?.status ?? 'present')
  const [note, setNote] = useState(entry?.note ?? '')

  const options: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

  return (
    <Dialog
      open
      onClose={onClose}
      title={member.full_name}
      description="Chọn trạng thái và ghi chú (nếu cần)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => onApply(status, note.trim() || null)}>Áp dụng</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {options.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={cn(
                'rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                status === s
                  ? 'border-primary bg-primary-softer text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-black/[0.04]',
              )}
            >
              {attendanceLabel[s]}
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor="att-note">Ghi chú</Label>
          <Input
            id="att-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: xin nghỉ ốm"
          />
        </div>
      </div>
    </Dialog>
  )
}
