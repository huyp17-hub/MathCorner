import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Hộp thoại đơn giản, có thể truy cập: nền mờ, đóng bằng Escape hoặc bấm nền,
 * khoá cuộn nền khi mở. Dùng cho form tạo/sửa và xác nhận.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-t-[2rem] border border-border bg-card shadow-lift sm:rounded-[2rem]',
          'max-h-[90dvh] overflow-y-auto',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-black/[0.05]"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
