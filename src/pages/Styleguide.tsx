import {
  BookMarked,
  CalendarCheck,
  GraduationCap,
  Home,
  Trophy,
  User,
  Wallet,
} from 'lucide-react'
import { DecorBlobs } from '@/components/DecorBlobs'
import { GrainOverlay } from '@/components/GrainOverlay'
import { Reveal } from '@/components/Reveal'
import { BottomNav } from '@/components/BottomNav'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'

const colorTokens = [
  { name: 'background', label: 'Nền (kem giấy)', cls: 'bg-background' },
  { name: 'card', label: 'Thẻ', cls: 'bg-card' },
  { name: 'primary', label: 'San hô (chính)', cls: 'bg-primary' },
  { name: 'primary-soft', label: 'San hô nhạt', cls: 'bg-primary-soft' },
  { name: 'primary-softer', label: 'San hô rất nhạt', cls: 'bg-primary-softer' },
  { name: 'peach', label: 'Học sinh', cls: 'bg-peach' },
  { name: 'sage', label: 'Giáo viên', cls: 'bg-sage' },
  { name: 'lavender', label: 'Phụ huynh', cls: 'bg-lavender' },
]

const statusTokens = [
  { tone: 'ok' as const, label: 'Có mặt' },
  { tone: 'warn' as const, label: 'Nộp muộn' },
  { tone: 'danger' as const, label: 'Quá hạn' },
  { tone: 'progress' as const, label: 'Đã nộp' },
  { tone: 'neutral' as const, label: 'Chưa làm' },
]

const badgeStyles: { variant: BadgeVariant; title: string; desc: string }[] = [
  { variant: 'soft', title: 'Kiểu 1 · Nền nhạt', desc: 'hiện tại' },
  { variant: 'dot', title: 'Kiểu 2 · Có chấm màu', desc: 'gọn, hợp bảng dày' },
  { variant: 'outline', title: 'Kiểu 3 · Viền', desc: 'nhẹ nhàng, nhiều khoảng trắng' },
  { variant: 'solid', title: 'Kiểu 4 · Nền đậm', desc: 'nổi bật, tương phản cao' },
]

const navItems = [
  { to: '#', label: 'Trang chủ', icon: Home },
  { to: '#a', label: 'Bài tập', icon: BookMarked },
  { to: '#b', label: 'Điểm danh', icon: CalendarCheck },
  { to: '#c', label: 'Học phí', icon: Wallet },
  { to: '#d', label: 'Hồ sơ', icon: User },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal className="mt-10">
      <h2 className="mb-4 text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </Reveal>
  )
}

export default function Styleguide() {
  return (
    <div className="relative min-h-dvh bg-peach">
      <GrainOverlay />
      <DecorBlobs />

      <main className="relative z-10 mx-auto max-w-2xl px-5 pb-32 pt-10">
        <header className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
            <GraduationCap className="size-6" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hệ thiết kế</p>
            <h1 className="text-3xl font-bold tracking-tight">Góc học ấm</h1>
          </div>
        </header>
        <p className="mt-3 text-muted-foreground">
          Trang duyệt token, chữ và component. <span className="font-hand text-2xl text-foreground">Chào bạn!</span>
        </p>

        {/* Màu */}
        <Section title="Bảng màu">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {colorTokens.map((c) => (
              <div key={c.name} className="rounded-2xl border border-border bg-card p-2 shadow-soft">
                <div className={`${c.cls} h-14 rounded-xl border border-border`} />
                <p className="mt-2 text-xs font-semibold">{c.label}</p>
                <p className="text-[11px] text-muted-foreground">--{c.name}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Chữ */}
        <Section title="Chữ">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <p className="text-3xl font-bold tracking-tight">Tiêu đề Be Vietnam Pro</p>
              <p className="text-base">
                Nội dung thường — kiểm tra dấu tiếng Việt: Ữ Ặ ỗ ự Đ ở ẩ ừ. Cỡ 16px, dễ đọc trên điện thoại.
              </p>
              <p className="font-hand text-3xl">Chữ viết tay Patrick Hand — Chào Minh!</p>
              <p className="text-xs text-muted-foreground">
                Lưu ý: Patrick Hand có thể thiếu một số dấu tiếng Việt mở rộng — chỉ dùng cho 1–3 chữ trang trí.
              </p>
            </CardContent>
          </Card>
        </Section>

        {/* Nút */}
        <Section title="Nút bấm">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Nộp bài</Button>
            <Button variant="soft">Làm bài</Button>
            <Button variant="outline">Huỷ</Button>
            <Button variant="ghost">Bỏ qua</Button>
            <Button variant="danger">Xoá</Button>
            <Button loading>Đang lưu</Button>
            <Button size="sm">Nhỏ</Button>
            <Button size="lg">Lớn</Button>
          </div>
        </Section>

        {/* Trạng thái — 4 kiểu để chọn */}
        <Section title="Nhãn trạng thái — chọn 1 kiểu">
          <div className="space-y-4">
            {badgeStyles.map((bs) => (
              <Card key={bs.variant}>
                <CardContent className="pt-5">
                  <p className="mb-3 text-sm font-bold">
                    {bs.title} <span className="font-normal text-muted-foreground">— {bs.desc}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {statusTokens.map((s) => (
                      <Badge key={s.tone} tone={s.tone} variant={bs.variant}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* Thẻ + ghi chú dán */}
        <Section title="Thẻ & ghi chú dán">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Kiểm tra Hàm số bậc hai</CardTitle>
                <p className="text-sm text-muted-foreground">Toán 10 · 15 câu</p>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge tone="warn">⏰ Còn 3 giờ</Badge>
                <Button size="sm">Làm bài</Button>
              </CardContent>
            </Card>

            <div className="-rotate-1 rounded-2xl border border-[#f1e8c8] bg-[#fffdf3] p-5 shadow-lift">
              <p className="font-bold">Nhắc nhẹ cả lớp 📌</p>
              <p className="mt-1 text-sm text-[#5c554a]">Nhớ ôn phần Hàm số trước buổi tới nhé.</p>
              <p className="mt-2 text-right font-hand text-xl text-warn-foreground">— Cô Lan</p>
            </div>
          </div>
        </Section>

        {/* Ô nhập */}
        <Section title="Ô nhập liệu">
          <Card>
            <CardContent className="space-y-4 pt-5">
              <div>
                <Label htmlFor="sg-email">Email</Label>
                <Input id="sg-email" type="email" placeholder="ban@email.com" />
              </div>
              <div>
                <Label htmlFor="sg-code">Mã lớp</Label>
                <Input id="sg-code" placeholder="VD: A1B2C3" />
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Thanh điều hướng nổi">
          <p className="text-sm text-muted-foreground">Xem ở đáy màn hình — dạng viên thuốc, kính mờ.</p>
          <div className="mt-4 flex items-center gap-2 text-muted-foreground">
            <Trophy className="size-5" strokeWidth={1.75} />
            <span className="text-sm">Icon lucide nét mảnh (stroke 1.75)</span>
          </div>
        </Section>
      </main>

      <BottomNav items={navItems} />
    </div>
  )
}
