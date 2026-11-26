import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Clock,
  GraduationCap,
  MessageSquare,
  Moon,
  PenLine,
  Plus,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DecorBlobs } from '@/components/DecorBlobs'
import { GrainOverlay } from '@/components/GrainOverlay'
import { Logo } from '@/components/Logo'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

/* ================================================================
   Dữ liệu tĩnh
   ================================================================ */

const DAY_CARDS = [
  { time: '7:00', text: 'Điểm danh chỉ một chạm', icon: CalendarCheck, color: 'bg-sage' },
  { time: '8:30', text: 'Giáo viên giao bài mới', icon: PenLine, color: 'bg-primary-softer' },
  { time: '15:30', text: 'Nộp bài, có điểm ngay', icon: Sparkles, color: 'bg-peach' },
  { time: '20:00', text: 'Luyện một phần TSA 30 phút', icon: Clock, color: 'bg-lavender' },
  { time: '21:00', text: 'Bố mẹ xem tiến độ', icon: Users, color: 'bg-primary-softer' },
]

const FEATURES = [
  {
    title: 'Chấm trắc nghiệm ngay khi nộp',
    desc: 'Nhiều lựa chọn, Đúng/Sai, trả lời ngắn — điểm trả về liền.',
    rotate: '-1.2deg',
  },
  {
    title: 'Điểm danh nhanh trên điện thoại',
    desc: 'Mở lớp → một chạm → xong, ngay trong tiết học.',
    rotate: '0.8deg',
  },
  {
    title: 'Học phí tự theo dõi',
    desc: 'Gói buổi, đơn giá/buổi — giáo viên ghi, hệ thống tính.',
    rotate: '-0.6deg',
  },
  {
    title: 'Phụ huynh xem mọi lúc',
    desc: 'Nhập mã phụ huynh, theo dõi bài tập, điểm danh, học phí.',
    rotate: '1.1deg',
  },
]

const FAQ = [
  {
    q: 'Ứng dụng có miễn phí không?',
    a: 'Hoàn toàn miễn phí cho giáo viên và học sinh. Dữ liệu được lưu trên Supabase, giáo viên tự quản lý.',
  },
  {
    q: 'Học sinh đăng nhập bằng gì?',
    a: 'Giáo viên tạo tài khoản hàng loạt với mã học sinh (vd: hs2401) và mật khẩu. Học sinh đăng nhập bằng mã này, không cần email.',
  },
  {
    q: 'Phụ huynh xem được những gì?',
    a: 'Bài tập (hạn, trạng thái, điểm, nhận xét), lịch sử điểm danh, học phí. Không xem được nội dung đề hay bài làm của con.',
  },
  {
    q: 'Luyện đề TSA là gì?',
    a: 'TSA — Đánh giá tư duy ĐH Bách khoa Hà Nội. Phòng thi mô phỏng: 3 phần thi có giờ riêng, nhiều dạng câu, kết quả chi tiết ngay sau khi nộp.',
  },
  {
    q: 'Dữ liệu có an toàn không?',
    a: 'Dữ liệu lưu trên Supabase (PostgreSQL) với phân quyền Row Level Security. Học sinh chỉ thấy dữ liệu của mình, giáo viên chỉ thấy lớp mình dạy.',
  },
]

/* ================================================================
   Phụ trợ
   ================================================================ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold text-foreground transition-colors hover:text-primary"
      >
        <span>{q}</span>
        <Plus
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-300',
            open && 'rotate-45',
          )}
          strokeWidth={1.75}
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-muted-foreground leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  )
}

function PhoneFrame({
  bg,
  label,
  children,
  className,
}: {
  bg: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('rounded-[2rem] border-2 border-border/60 shadow-lift overflow-hidden', className)}
      aria-label={label}
    >
      {/* Status bar */}
      <div className={cn('flex items-center justify-between px-5 pt-3 pb-1 text-[11px] font-semibold', bg)}>
        <span>9:41</span>
        <div className="flex gap-1">
          <div className="h-2.5 w-5 rounded-sm bg-foreground/30" />
          <div className="h-2.5 w-5 rounded-sm bg-foreground/20" />
        </div>
      </div>
      <div className={cn('px-4 pb-5', bg)}>{children}</div>
    </div>
  )
}

/* ================================================================
   Landing
   ================================================================ */

export default function Landing() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const featuresRef = useRef<HTMLDivElement>(null)
  const faqRef = useRef<HTMLDivElement>(null)

  const handleJoinClass = () => {
    const code = joinCode.trim()
    if (code.length >= 4) {
      navigate(`/register?join=${encodeURIComponent(code)}`)
    }
  }

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenu(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <GrainOverlay />
      <DecorBlobs />

      {/* ============================================================
         NAVBAR
         ============================================================ */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <nav className="flex w-full max-w-3xl items-center justify-between rounded-full border border-border/60 bg-card/70 px-5 py-2.5 shadow-soft backdrop-blur-xl">
          <Logo size={28} />

          {/* Desktop links */}
          <div className="hidden items-center gap-6 sm:flex">
            <button
              onClick={() => scrollTo(featuresRef)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Tính năng
            </button>
            <button
              onClick={() => scrollTo(faqRef)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Câu hỏi thường gặp
            </button>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-full bg-foreground text-card hover:bg-foreground/90">
                Đăng nhập
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenu(!mobileMenu)}
            className="sm:hidden p-1 text-muted-foreground"
            aria-label="Menu"
          >
            {mobileMenu ? <X className="size-5" /> : (
              <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile dropdown */}
        {mobileMenu && (
          <div className="absolute left-4 right-4 top-[4.5rem] rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lift backdrop-blur-xl sm:hidden">
            <button
              onClick={() => scrollTo(featuresRef)}
              className="block w-full py-2 text-left text-sm font-medium text-foreground"
            >
              Tính năng
            </button>
            <button
              onClick={() => scrollTo(faqRef)}
              className="block w-full py-2 text-left text-sm font-medium text-foreground"
            >
              Câu hỏi thường gặp
            </button>
            <Link to="/login" className="mt-2 block">
              <Button variant="ghost" size="sm" className="w-full rounded-full bg-foreground text-card">
                Đăng nhập
              </Button>
            </Link>
          </div>
        )}
      </header>

      {/* ============================================================
         HERO
         ============================================================ */}
      <section className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-32 pb-16 text-center sm:pt-40 sm:pb-24">
        <Reveal>
          <h1 className="text-[2.5rem] font-extrabold leading-[1.15] tracking-tight sm:text-[4rem] sm:leading-[1.1]">
            Học đều mỗi ngày,{' '}
            <span className="font-hand text-primary">tự tin</span>{' '}
            đi thi
          </h1>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-5 max-w-md text-lg text-muted-foreground leading-relaxed">
            Điểm danh, bài tập, học phí — gọn trong một ứng dụng.
            Giáo viên quản lý, học sinh tập trung, phụ huynh yên tâm.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register">
              <Button size="lg">
                Bắt đầu học
                <ChevronRight className="size-4" />
              </Button>
            </Link>
            <Link to="/register?role=teacher">
              <Button variant="outline" size="lg">
                Tôi là giáo viên
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ============================================================
         MỘT NGÀY HỌC — cuộn ngang
         ============================================================ */}
      <section className="relative z-10 pb-16 sm:pb-24">
        <Reveal>
          <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Một ngày học
          </h2>
        </Reveal>
        <div className="flex gap-4 overflow-x-auto px-6 pb-4 snap-x snap-mandatory scrollbar-none">
          <div className="shrink-0 w-4 sm:w-[calc(50%-10rem)]" />
          {DAY_CARDS.map(({ time, text, icon: Icon, color }, i) => (
            <Reveal key={time} delay={i * 80}>
              <div
                className={cn(
                  'snap-center shrink-0 w-72 rounded-[2rem] p-6 shadow-soft transition-transform hover:-translate-y-1',
                  color,
                )}
              >
                <span className="text-xs font-bold text-muted-foreground">{time}</span>
                <Icon className="mt-3 size-7 text-foreground" strokeWidth={1.75} />
                <p className="mt-3 text-base font-semibold leading-snug">{text}</p>
              </div>
            </Reveal>
          ))}
          <div className="shrink-0 w-4 sm:w-[calc(50%-10rem)]" />
        </div>
      </section>

      {/* ============================================================
         XEM TRƯỚC ỨNG DỤNG — 3 khung điện thoại xếp bậc
         ============================================================ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 sm:pb-28">
        <Reveal>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Giao diện thân thiện, dễ dùng
          </h2>
        </Reveal>
        <div className="relative mx-auto flex h-[420px] max-w-xl items-end justify-center sm:h-[520px]">
          {/* Trái — trang chủ HS */}
          <Reveal delay={80}>
            <PhoneFrame
              bg="bg-peach"
              label="Trang chủ học sinh"
              className="absolute left-0 bottom-0 w-[220px] opacity-80 blur-[0.5px] sm:left-4 sm:w-[260px]"
            >
              <p className="font-hand text-lg text-primary">Chào Huy!</p>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <div
                    key={d}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold',
                      d === 4 ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
                    )}
                  >
                    {d + 20}
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-2xl bg-card p-3 shadow-sm">
                <div className="text-[10px] font-semibold text-info">Trắc nghiệm</div>
                <p className="text-xs font-semibold mt-0.5">Toán chương 3 — Hàm số</p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                  <div className="h-1.5 w-3/5 rounded-full bg-primary" />
                </div>
              </div>
            </PhoneFrame>
          </Reveal>

          {/* Giữa — phòng thi TSA */}
          <Reveal delay={0}>
            <PhoneFrame
              bg="bg-background"
              label="Phòng thi TSA"
              className="relative z-10 w-[260px] sm:w-[300px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Tư duy Toán học</span>
                <span className="text-[10px] font-semibold text-muted-foreground">45:12</span>
              </div>
              <div className="mt-3 rounded-2xl bg-card p-3 shadow-sm text-xs leading-relaxed">
                <p className="font-medium">Cho hàm số $y = x^3 - 3x + 2$. Tìm giá trị cực đại...</p>
              </div>
              <div className="mt-2 space-y-1.5">
                {['A. y = 4', 'B. y = 2', 'C. y = 0', 'D. y = -2'].map((opt, i) => (
                  <div
                    key={opt}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-[11px] font-medium',
                      i === 0 ? 'border-info bg-progress text-info' : 'border-border',
                    )}
                  >
                    {opt}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between">
                <span className="text-[10px] text-muted-foreground">Câu 12/40</span>
                <span className="text-[10px] text-ok-foreground font-semibold">Đã làm: 11</span>
              </div>
            </PhoneFrame>
          </Reveal>

          {/* Phải — điểm danh GV */}
          <Reveal delay={160}>
            <PhoneFrame
              bg="bg-sage"
              label="Điểm danh giáo viên"
              className="absolute right-0 bottom-12 w-[220px] opacity-80 blur-[0.5px] sm:right-4 sm:w-[260px]"
            >
              <p className="text-sm font-bold">Toán 9A — Điểm danh</p>
              <p className="text-[10px] text-muted-foreground">Hôm nay, 26/11</p>
              <div className="mt-2 space-y-1.5">
                {['Nguyễn Văn A', 'Trần Thị B', 'Lê Minh C'].map((name, i) => (
                  <div key={name} className="flex items-center justify-between rounded-xl bg-card p-2">
                    <span className="text-[11px] font-medium">{name}</span>
                    <div className="flex gap-1">
                      {['Có', 'Muộn', 'Vắng'].map((s, j) => (
                        <div
                          key={s}
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[9px] font-bold',
                            j === 0 && i < 2 ? 'bg-ok text-ok-foreground' : 'bg-neutral text-neutral-foreground',
                            j === 2 && i === 2 ? 'bg-danger text-danger-foreground' : '',
                          )}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PhoneFrame>
          </Reveal>
        </div>
      </section>

      {/* ============================================================
         TÍNH NĂNG — thẻ ghi chú dán
         ============================================================ */}
      <section ref={featuresRef} className="relative z-10 mx-auto max-w-3xl px-6 pb-20 sm:pb-28">
        <Reveal>
          <h2 className="mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Tính năng nổi bật
          </h2>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map(({ title, desc, rotate }, i) => (
            <Reveal key={title} delay={i * 80}>
              <div
                className="rounded-[2rem] bg-card p-6 shadow-soft transition-transform hover:rotate-0 hover:-translate-y-1"
                style={{ transform: `rotate(${rotate})` }}
              >
                <h3 className="text-base font-bold leading-snug">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
                <p className="mt-3 font-hand text-sm text-primary">— Nhóm phát triển</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Icons row */}
        <Reveal delay={320}>
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-muted-foreground">
            {[
              { icon: CalendarCheck, label: 'Điểm danh' },
              { icon: BookOpen, label: 'Bài tập' },
              { icon: Wallet, label: 'Học phí' },
              { icon: GraduationCap, label: 'Luyện TSA' },
              { icon: Users, label: 'Phụ huynh' },
              { icon: MessageSquare, label: 'Nhận xét' },
              { icon: Moon, label: 'Chế độ tối' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-softer">
                  <Icon className="size-5 text-foreground" strokeWidth={1.75} />
                </div>
                <span className="text-[11px] font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============================================================
         FAQ
         ============================================================ */}
      <section ref={faqRef} className="relative z-10 mx-auto max-w-2xl px-6 pb-20 sm:pb-28">
        <Reveal>
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Câu hỏi thường gặp
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <div className="rounded-[2rem] bg-card p-6 shadow-soft sm:p-8">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============================================================
         CTA — VÀO LỚP BẰNG MÃ
         ============================================================ */}
      <section className="relative z-10 mx-auto max-w-xl px-6 pb-24 sm:pb-32 text-center">
        <Reveal>
          <div className="rounded-[2rem] bg-card p-8 shadow-lift sm:p-10">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-foreground">
              <div className="size-3.5 rounded-full bg-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Có mã lớp? Vào ngay!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nhập mã lớp giáo viên đã phát để bắt đầu.
            </p>
            <div className="mt-6 flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã lớp"
                maxLength={8}
                className="flex-1 rounded-full bg-neutral text-center font-mono text-lg tracking-widest uppercase"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinClass()}
              />
              <Button
                onClick={handleJoinClass}
                className="rounded-full bg-foreground text-card hover:bg-foreground/90"
              >
                Vào lớp
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============================================================
         FOOTER
         ============================================================ */}
      <footer className="relative z-10 border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-3xl px-6">
          <Logo size={24} />
          <p className="mt-3">
            Dự án mã nguồn mở, phát triển bởi nhóm giáo viên và học sinh.
          </p>
          <p className="mt-1 text-xs">
            Dữ liệu bài làm có thể được AI hỗ trợ chấm nếu giáo viên bật tính năng này.
          </p>
        </div>
      </footer>
    </div>
  )
}
