import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Nhãn trạng thái dùng thống nhất toàn app.
 * Luôn kèm chữ/icon — không bao giờ phân biệt chỉ bằng màu.
 *
 * tone: ý nghĩa trạng thái (màu).
 * variant: kiểu hiển thị — soft (nền nhạt) | dot (có chấm) | outline (viền) | solid (nền đậm).
 */
export type BadgeTone = 'ok' | 'warn' | 'danger' | 'progress' | 'neutral'
export type BadgeVariant = 'soft' | 'dot' | 'outline' | 'solid'

const soft: Record<BadgeTone, string> = {
  ok: 'bg-ok text-ok-foreground',
  warn: 'bg-warn text-warn-foreground',
  danger: 'bg-danger text-danger-foreground',
  progress: 'bg-progress text-progress-foreground',
  neutral: 'bg-neutral text-neutral-foreground',
}

const solid: Record<BadgeTone, string> = {
  ok: 'bg-ok-foreground text-white',
  warn: 'bg-warn-foreground text-white',
  danger: 'bg-danger-foreground text-white',
  progress: 'bg-progress-foreground text-white',
  neutral: 'bg-neutral-foreground text-white',
}

const outline: Record<BadgeTone, string> = {
  ok: 'border border-ok-foreground/35 bg-card text-ok-foreground',
  warn: 'border border-warn-foreground/35 bg-card text-warn-foreground',
  danger: 'border border-danger-foreground/35 bg-card text-danger-foreground',
  progress: 'border border-progress-foreground/35 bg-card text-progress-foreground',
  neutral: 'border border-neutral-foreground/35 bg-card text-neutral-foreground',
}

const dotColor: Record<BadgeTone, string> = {
  ok: 'bg-ok-foreground',
  warn: 'bg-warn-foreground',
  danger: 'bg-danger-foreground',
  progress: 'bg-progress-foreground',
  neutral: 'bg-neutral-foreground',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  variant?: BadgeVariant
}

export function Badge({ className, tone = 'neutral', variant = 'dot', children, ...props }: BadgeProps) {
  const toneCls =
    variant === 'solid' ? solid[tone] : variant === 'outline' ? outline[tone] : soft[tone]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        toneCls,
        className,
      )}
      {...props}
    >
      {variant === 'dot' && <span className={cn('size-1.5 rounded-full', dotColor[tone])} aria-hidden="true" />}
      {children}
    </span>
  )
}
