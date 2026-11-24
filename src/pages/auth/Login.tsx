import { GraduationCap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { DecorBlobs } from '@/components/DecorBlobs'
import { GrainOverlay } from '@/components/GrainOverlay'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { toEmail } from '@/lib/format'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: toEmail(login),
      password,
    })
    setLoading(false)
    if (error) {
      setError('Thông tin đăng nhập hoặc mật khẩu chưa đúng. Bạn thử lại nhé.')
      return
    }
    // Về trang chủ; HomeRedirect sẽ đưa tới đúng khu vực theo vai trò.
    navigate('/')
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
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Chào mừng trở lại</h1>
          <p className="mt-1 text-sm text-muted-foreground">Đăng nhập để tiếp tục học nhé</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="login">Email hoặc tên đăng nhập</Label>
                <Input
                  id="login"
                  autoComplete="username"
                  required
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="ban@email.com hoặc hs2401"
                />
              </div>
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" loading={loading}>
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-semibold text-info">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  )
}
