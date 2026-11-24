import { LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { BottomNav, type NavItem } from '@/components/BottomNav'
import { Logo } from '@/components/Logo'
import { NenTrangTri } from '@/components/NenTrangTri'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { roleLabel, type Role } from '@/lib/types'

// Nền nhẹ theo vai trò để biết ngay mình đang ở khu vực nào.
const roleTint: Record<Role, string> = {
  teacher: 'bg-sage',
  student: 'bg-peach',
  parent: 'bg-lavender',
}

/**
 * Khung ứng dụng theo vai trò: thanh trên (máy tính) + thanh dưới (điện thoại).
 * Nội dung trang hiển thị qua <Outlet />.
 */
export function AppLayout({ role, items }: { role: Role; items: NavItem[] }) {
  const { profile, signOut } = useAuth()

  return (
    <div className={cn('relative min-h-dvh', roleTint[role])}>
      <NenTrangTri kieu="cham-bi" />

      {/* Thanh trên — máy tính */}
      <header className="sticky top-0 z-30 hidden border-b border-border bg-card/70 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <NavLink to={`/${role}`} className="flex items-center" aria-label="Góc học — trang chủ">
            <Logo />
          </NavLink>
          <nav className="flex flex-1 items-center gap-1" aria-label="Điều hướng chính">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-primary-softer text-primary-foreground'
                      : 'text-muted-foreground hover:bg-black/[0.04]',
                  )
                }
              >
                <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel[role]}</p>
            </div>
            <Button variant="outline" size="icon" onClick={() => void signOut()} aria-label="Đăng xuất">
              <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      {/* Thanh trên gọn — điện thoại */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Đăng xuất">
          <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </header>

      {/* Nội dung — chừa chỗ cho bottom nav trên điện thoại */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 pb-28 pt-5 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <div className="md:hidden">
        <BottomNav items={items} />
      </div>
    </div>
  )
}
