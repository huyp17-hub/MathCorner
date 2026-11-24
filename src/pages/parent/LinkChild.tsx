import { Check, LinkIcon, Unlink } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { linkParent, parentChildren, type ParentChild } from '@/lib/api/parent'

export default function LinkChild() {
  const [children, setChildren] = useState<ParentChild[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [linking, setLinking] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setChildren(await parentChildren())
    } catch {
      /* bỏ qua */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (code.trim().length < 8) return
    setLinking(true)
    setResult(null)
    try {
      const res = await linkParent(code.trim())
      setResult(res)
      if (res.ok) {
        setCode('')
        await load()
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Lỗi kết nối.' })
    } finally {
      setLinking(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Liên kết con</h1>
      <p className="mt-1 text-muted-foreground">
        Nhập mã phụ huynh (8 ký tự) mà giáo viên đã phát để liên kết với con.
      </p>

      <Card className="mt-5">
        <CardContent className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="parent-code">Mã phụ huynh</Label>
              <Input
                id="parent-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: AB12CD34"
                maxLength={8}
                className="font-mono text-lg tracking-widest"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Mã gồm 8 ký tự, không phân biệt hoa thường.
              </p>
            </div>
            <Button type="submit" loading={linking} disabled={code.trim().length < 8}>
              <LinkIcon className="size-4" />
              Liên kết
            </Button>
          </form>

          {result && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                result.ok
                  ? 'bg-ok text-ok-foreground'
                  : 'bg-danger text-danger-foreground'
              }`}
            >
              {result.ok && <Check className="mb-0.5 mr-1 inline size-4" />}
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danh sách con đã liên kết */}
      <h2 className="mt-8 text-lg font-bold tracking-tight">Con đã liên kết</h2>
      {loading ? (
        <div className="mt-3 space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-border/50" />
          ))}
        </div>
      ) : children.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="py-8 text-center">
            <Unlink className="mx-auto size-8 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa liên kết với con nào. Nhập mã phụ huynh ở trên.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-3 space-y-2">
          {children.map((c) => (
            <Card key={c.student_id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender text-foreground font-bold">
                  {c.full_name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{c.full_name}</p>
                  <Badge tone="ok" variant="soft" className="mt-0.5">
                    Đã liên kết
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
