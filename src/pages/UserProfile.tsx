import { ArrowLeft, Camera, LogOut, Pencil, User } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { roleHome, roleLabel } from '@/lib/types'

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'

export default function UserProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  if (!user || !profile) return null

  const avatarUrl = profile.avatar_url

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > AVATAR_MAX_BYTES) {
      setError('Ảnh vượt quá 2 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user!.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id)
      if (dbErr) throw dbErr
      await refreshProfile()
      setSuccess('Đã cập nhật ảnh đại diện.')
    } catch {
      setError('Không tải ảnh lên được. Bạn thử lại nhé.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const trimmed = fullName.trim()
    if (!trimmed) {
      setError('Họ tên không được để trống.')
      return
    }
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ full_name: trimmed, phone: phone.trim() || null })
        .eq('id', user!.id)
      if (dbErr) throw dbErr
      await refreshProfile()
      setEditing(false)
      setSuccess('Đã lưu thông tin.')
    } catch {
      setError('Không lưu được. Bạn thử lại nhé.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit() {
    setFullName(profile!.full_name)
    setPhone(profile!.phone ?? '')
    setEditing(true)
    setError(null)
    setSuccess(null)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = profile.full_name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-md space-y-6">
      <button
        onClick={() => navigate(roleHome[profile.role])}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Quay lại
      </button>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={profile.full_name}
              className="size-28 rounded-full border-4 border-primary-softer object-cover"
            />
          ) : (
            <div className="grid size-28 place-items-center rounded-full border-4 border-primary-softer bg-primary-softer text-3xl font-bold text-primary-foreground">
              {initials || <User className="size-10" strokeWidth={1.75} />}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 grid size-9 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            aria-label="Đổi ảnh đại diện"
          >
            <Camera className="size-4" strokeWidth={2} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        {uploading && <p className="text-sm text-muted-foreground">Đang tải ảnh lên...</p>}
      </div>

      {/* Info card */}
      <div className="rounded-[2rem] border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Thông tin cá nhân</h2>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={startEdit}>
              <Pencil className="size-4" strokeWidth={1.75} />
              Sửa
            </Button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="prof-name">Họ tên</Label>
              <Input
                id="prof-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prof-phone">Số điện thoại</Label>
              <Input
                id="prof-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Chưa có"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                Lưu
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Huỷ
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3 text-sm">
            <Row label="Họ tên" value={profile.full_name} />
            <Row label="Vai trò" value={roleLabel[profile.role]} />
            {profile.student_code && <Row label="Mã học sinh" value={profile.student_code} />}
            <Row label="Số điện thoại" value={profile.phone || 'Chưa có'} />
            <Row label="Email" value={user.email ?? 'Chưa có'} />
          </dl>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 rounded-2xl bg-[#E3F4EA] px-4 py-2.5 text-sm font-medium text-[#1F6F4A]">
            {success}
          </p>
        )}
      </div>

      {/* Sign out */}
      <Button
        variant="outline"
        className="w-full text-muted-foreground"
        onClick={handleSignOut}
      >
        <LogOut className="size-4" strokeWidth={1.75} />
        Đăng xuất
      </Button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold text-foreground">{value}</dd>
    </div>
  )
}
