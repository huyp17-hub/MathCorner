import { User } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { BottomNav, type NavItem } from '@/components/BottomNav'
import { Logo } from '@/components/Logo'
import { NenTrangTri } from '@/components/NenTrangTri'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { roleLabel, type Role } from '@/lib/types'

const roleTint: Record<Role, string> = {
  teacher: 'bg-sage',
  student: 'bg-peach',
  parent: 'bg-lavender',
}

function AvatarButton() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.full_name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <button
      onClick={() => navigate('/profile')}
      className="size-10 shrink-0 overflow-hidden rounded-full border-2 border-primary-softer transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label="Trang cá nhân"
    >
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.full_name}
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center bg-primary-softer text-sm font-bold text-primary-foreground">
          {initials || <User className="size-4" strokeWidth={2} />}
        </span>
      )}
    </button>
  )
}

export function AppLayout({ role, items }: { role: Role; items: NavItem[] }) {
  const { profile } = useAuth()

  return (
    <div className={cn('relative min-h-dvh', roleTint[role])}>
      <NenTrangTri kieu="cham-bi" />

      {/* Thanh trên — máy tính */}
      <header className="sticky top-0 z-30 hidden border-b border-border bg-card/70 backdrop-blur-xl md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <NavLink to={`/${role}`} className="flex items-center" aria-label="Little Math Corner — trang chủ">
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
            <AvatarButton />
          </div>
        </div>
      </header>

      {/* Thanh trên gọn — điện thoại */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Logo />
        <AvatarButton />
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
