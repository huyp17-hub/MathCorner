import { GraduationCap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { DecorBlobs } from '@/components/DecorBlobs'
import { GrainOverlay } from '@/components/GrainOverlay'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type Role = 'teacher' | 'student' | 'parent'

const roles: { value: Role; label: string; hint: string }[] = [
  { value: 'student', label: 'Học sinh', hint: 'Làm bài, xem điểm' },
  { value: 'teacher', label: 'Giáo viên', hint: 'Quản lý lớp' },
  { value: 'parent', label: 'Phụ huynh', hint: 'Theo dõi con' },
]

export default function Register() {
  const navigate = useNavigate()
  const [role, setRole] = useState<Role>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: fullName } },
    })
    setLoading(false)
    if (error) {
      setError('Không tạo được tài khoản. Email có thể đã được dùng — bạn thử email khác nhé.')
      return
    }
    // Nếu không cần xác nhận email, Supabase trả về phiên luôn → vào thẳng app.
    if (data.session) {
      navigate('/')
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="relative grid min-h-dvh place-items-center bg-background px-5">
        <GrainOverlay />
        <DecorBlobs />
        <Card className="relative z-10 w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="font-hand text-3xl">Xong rồi!</p>
            <p className="mt-2 text-muted-foreground">
              Tài khoản đã được tạo. Hãy kiểm tra email để xác nhận (nếu cần) rồi đăng nhập.
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate('/login')}>
              Tới trang đăng nhập
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative grid min-h-dvh place-items-center bg-background px-5 py-10">
      <GrainOverlay />
      <DecorBlobs />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <GraduationCap className="size-7" strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Tạo tài khoản</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chọn vai trò của bạn để bắt đầu</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>Bạn là</Label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={cn(
                        'rounded-2xl border p-3 text-left transition-colors',
                        role === r.value
                          ? 'border-primary bg-primary-softer'
                          : 'border-border bg-card hover:bg-background',
                      )}
                    >
                      <span className="block text-sm font-bold">{r.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="name">Họ và tên</Label>
                <Input
                  id="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@email.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                />
              </div>

              {error && (
                <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                Đăng ký
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-info">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  )
}
