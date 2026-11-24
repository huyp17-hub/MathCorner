import { Check, Copy, KeyRound, Pencil, Trash2, UserX } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import {
  listMembers,
  regenerateParentCode,
  removeMember,
  updateStudentProfile,
  type MemberRow,
} from '@/lib/api/classes'

export function StudentsPanel({ classId }: { classId: string }) {
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MemberRow | null>(null)
  const [removing, setRemoving] = useState<MemberRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setMembers(await listMembers(classId))
    } catch {
      setError('Không tải được danh sách học sinh.')
      setMembers([])
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  async function onRegenerateParent(studentId: string) {
    try {
      const code = await regenerateParentCode(studentId)
      setMembers((list) =>
        list ? list.map((m) => (m.student_id === studentId ? { ...m, parent_code: code } : m)) : list,
      )
    } catch {
      setError('Không tạo lại được mã phụ huynh.')
    }
  }

  if (members === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/[0.04]" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary-softer text-primary-foreground">
              <UserX className="size-6" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <p className="font-semibold">Lớp chưa có học sinh</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Dùng tab “Thêm hàng loạt” để tạo tài khoản, hoặc đưa mã lớp cho học sinh tự vào.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{members.length} học sinh</p>
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.student_id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.full_name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {m.student_code && (
                        <span>
                          Mã HS: <span className="font-mono">{m.student_code}</span>
                        </span>
                      )}
                      {m.phone && <span>{m.phone}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ParentCode
                      code={m.parent_code}
                      onRegenerate={() => onRegenerateParent(m.student_id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Sửa ${m.full_name}`}
                      onClick={() => setEditing(m)}
                    >
                      <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Gỡ ${m.full_name} khỏi lớp`}
                      onClick={() => setRemoving(m)}
                    >
                      <Trash2 className="size-4 text-danger-foreground" strokeWidth={1.75} aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditStudentDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={(patch) => {
            setMembers((list) =>
              list ? list.map((m) => (m.student_id === editing.student_id ? { ...m, ...patch } : m)) : list,
            )
            setEditing(null)
          }}
        />
      )}
      {removing && (
        <RemoveStudentDialog
          member={removing}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await removeMember(classId, removing.student_id)
            setMembers((list) => (list ? list.filter((m) => m.student_id !== removing.student_id) : list))
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}

function ParentCode({ code, onRegenerate }: { code: string | null; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* bỏ qua */
    }
  }

  return (
    <span className="hidden items-center gap-1 sm:inline-flex">
      <Badge tone="neutral" variant="soft" title="Mã phụ huynh" className="font-mono">
        PH: {code}
      </Badge>
      <Button variant="ghost" size="icon" aria-label="Sao chép mã phụ huynh" onClick={copy}>
        {copied ? (
          <Check className="size-4 text-ok-foreground" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
        )}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Tạo lại mã phụ huynh" onClick={onRegenerate}>
        <KeyRound className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </span>
  )
}

function EditStudentDialog({
  member,
  onClose,
  onSaved,
}: {
  member: MemberRow
  onClose: () => void
  onSaved: (patch: Partial<MemberRow>) => void
}) {
  const [fullName, setFullName] = useState(member.full_name)
  const [code, setCode] = useState(member.student_code ?? '')
  const [phone, setPhone] = useState(member.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const patch = { full_name: fullName, student_code: code || null, phone: phone || null }
      await updateStudentProfile(member.student_id, patch)
      onSaved(patch)
    } catch {
      setError('Không lưu được. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Sửa học sinh"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="edit-student-form" loading={saving}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="edit-student-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="s-name">Họ và tên</Label>
          <Input id="s-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-code">Mã học sinh</Label>
          <Input id="s-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-phone">Số điện thoại</Label>
          <Input id="s-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

function RemoveStudentDialog({
  member,
  onClose,
  onConfirm,
}: {
  member: MemberRow
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog
      open
      onClose={onClose}
      title="Gỡ học sinh khỏi lớp?"
      description={`${member.full_name} sẽ không còn trong lớp này. Tài khoản học sinh vẫn giữ nguyên.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setError(null)
              setBusy(true)
              try {
                await onConfirm()
              } catch {
                setError('Không gỡ được. Bạn thử lại nhé.')
                setBusy(false)
              }
            }}
          >
            Gỡ khỏi lớp
          </Button>
        </>
      }
    >
      {error ? (
        <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Bạn có thể thêm lại sau nếu cần.</p>
      )}
    </Dialog>
  )
}
