import { ArrowRight, BookOpen, LogIn, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { getMyClasses, joinClass, type MyClass } from '@/lib/api/student'

export default function MyClasses() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<MyClass[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function load() {
    if (!user) return
    getMyClasses(user.id)
      .then(setClasses)
      .catch(() => {
        setError('Không tải được danh sách lớp.')
        setClasses([])
      })
  }

  useEffect(load, [user])

  async function onJoin(e: FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    setJoinMsg(null)
    try {
      await joinClass(code)
      setJoinMsg({ ok: true, text: 'Vào lớp thành công!' })
      setCode('')
      load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không vào được lớp.'
      if (msg.includes('Invalid') || msg.includes('not found') || msg.includes('invalid'))
        setJoinMsg({ ok: false, text: 'Mã lớp không đúng. Kiểm tra lại nhé.' })
      else if (msg.includes('already') || msg.includes('duplicate') || msg.includes('23505'))
        setJoinMsg({ ok: false, text: 'Bạn đã ở trong lớp này rồi.' })
      else setJoinMsg({ ok: false, text: msg })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Lớp học của bạn</h1>
      <p className="mt-1 text-muted-foreground">Chọn lớp để xem bài tập, bài học và điểm.</p>

      {/* Nhập mã lớp */}
      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
            <p className="font-bold">Vào lớp mới</p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Nhập mã lớp 6 ký tự mà giáo viên đưa cho bạn.
          </p>
          <form onSubmit={onJoin} className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="join-code" className="sr-only">Mã lớp</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: TOAN9A"
                maxLength={6}
                className="text-center text-lg font-bold uppercase tracking-widest"
              />
            </div>
            <Button type="submit" loading={joining} disabled={code.trim().length < 4}>
              <LogIn className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Vào lớp
            </Button>
          </form>
          {joinMsg && (
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-sm font-medium ${
                joinMsg.ok ? 'bg-ok text-ok-foreground' : 'bg-danger text-danger-foreground'
              }`}
            >
              {joinMsg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danh sách lớp */}
      {error && (
        <p className="mt-4 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {classes === null ? (
        <div className="mt-4 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-black/[0.04]" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center">
            <p className="font-semibold">Bạn chưa tham gia lớp nào.</p>
            <p className="mt-1 text-sm text-muted-foreground">Nhập mã lớp ở trên để bắt đầu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {classes.map((c) => (
            <Link key={c.class_id} to={`/student/classes/${c.class_id}`} className="group block">
              <Card className="transition-transform group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-peach text-foreground">
                    <BookOpen className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{c.name}</p>
                    {c.subject && (
                      <Badge tone="neutral" variant="soft" className="mt-0.5">
                        {c.subject}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
