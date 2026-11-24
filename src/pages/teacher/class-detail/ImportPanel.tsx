import { Check, Copy, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/input'
import { createStudents, type CreatedStudentResult, type NewStudentInput } from '@/lib/api/classes'

interface ParsedRow {
  full_name: string
  student_code: string
  password: string
  error: string | null
}

/** Tách mỗi dòng theo tab, dấu phẩy hoặc nhiều khoảng trắng. */
function parseLines(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(/\t|,|\s{2,}/).map((c) => c.trim())
      const full_name = cols[0] ?? ''
      const student_code = cols[1] ?? ''
      const password = cols[2] ?? ''
      let error: string | null = null
      if (!full_name) error = 'Thiếu họ tên'
      else if (!student_code) error = 'Thiếu mã học sinh'
      return { full_name, student_code, password, error }
    })
}

export function ImportPanel({ classId }: { classId: string }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CreatedStudentResult[] | null>(null)
  const [copied, setCopied] = useState(false)

  const rows = useMemo(() => parseLines(text), [text])
  const validRows = rows.filter((r) => !r.error)
  const errorCount = rows.length - validRows.length

  async function onSubmit() {
    setError(null)
    setResults(null)
    if (validRows.length === 0) {
      setError('Chưa có dòng hợp lệ nào để tạo.')
      return
    }
    setSubmitting(true)
    try {
      const input: NewStudentInput[] = validRows.map((r) => ({
        full_name: r.full_name,
        student_code: r.student_code,
        password: r.password || undefined,
      }))
      const res = await createStudents(classId, input)
      setResults(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được danh sách tài khoản.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyAccounts() {
    if (!results) return
    const lines = results
      .filter((r) => r.status === 'created')
      .map((r) => `${r.full_name}\t${r.email}\t${r.password}`)
    try {
      await navigator.clipboard.writeText(['Họ tên\tĐăng nhập\tMật khẩu', ...lines].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* bỏ qua */
    }
  }

  if (results) {
    const created = results.filter((r) => r.status === 'created')
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">
              Đã tạo {created.length}/{results.length} tài khoản
            </p>
            <p className="text-sm text-muted-foreground">
              Lưu lại mật khẩu để phát cho học sinh — mật khẩu không hiện lại sau khi rời trang.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyAccounts}>
              {copied ? (
                <Check className="size-4 text-ok-foreground" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              Sao chép tất cả
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setResults(null)
                setText('')
              }}
            >
              Thêm tiếp
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.email ?? '—'}
                    {r.password && (
                      <>
                        {' · '}
                        <span className="font-mono">mật khẩu: {r.password}</span>
                      </>
                    )}
                  </p>
                </div>
                {r.status === 'created' ? (
                  <Badge tone="ok" variant="soft">
                    Đã tạo
                  </Badge>
                ) : (
                  <Badge tone="danger" variant="soft">
                    {r.message ?? 'Lỗi'}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <Label htmlFor="bulk">Dán danh sách học sinh</Label>
          <p className="mb-2 text-sm text-muted-foreground">
            Mỗi dòng một học sinh, các cột cách nhau bằng Tab hoặc dấu phẩy:
            <br />
            <span className="font-mono text-xs">Họ tên · Mã học sinh · Mật khẩu (tuỳ chọn)</span>
            . Không nhập mật khẩu thì hệ thống tự tạo. Mã học sinh dùng để đăng nhập (sẽ thành{' '}
            <span className="font-mono text-xs">mã@hs.local</span>).
          </p>
          <Textarea
            id="bulk"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Nguyễn Văn An\ths2401\nTrần Thị Bình\ths2402'}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm">
              <Users className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <span className="font-semibold">Xem trước {rows.length} dòng</span>
              {errorCount > 0 && (
                <Badge tone="danger" variant="soft">
                  {errorCount} dòng lỗi
                </Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                    r.error ? 'bg-danger' : 'bg-neutral'
                  }`}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{r.full_name || '(trống)'}</span>
                    {r.student_code && <span className="ml-2 font-mono text-xs">{r.student_code}</span>}
                  </span>
                  {r.error && (
                    <span className="shrink-0 text-xs font-semibold text-danger-foreground">
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={onSubmit} loading={submitting} disabled={validRows.length === 0}>
          <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Tạo {validRows.length > 0 ? `${validRows.length} ` : ''}tài khoản
        </Button>
      </div>
    </div>
  )
}
