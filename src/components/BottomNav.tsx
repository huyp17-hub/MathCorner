import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/**
 * Thanh điều hướng nổi dạng viên thuốc (điện thoại).
 * Nền trắng 72% + backdrop-blur, bo tròn hoàn toàn; mục chọn có nền san hô nhạt.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg justify-around rounded-full border border-border bg-card/70 p-2 shadow-lift backdrop-blur-xl"
      aria-label="Điều hướng chính"
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-semibold transition-colors',
              isActive ? 'bg-primary-softer text-primary-foreground' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
