import { ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Ô chọn — dùng <select> gốc cho dễ bấm trên điện thoại, bọc mũi tên. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'min-h-11 w-full appearance-none rounded-2xl border border-border bg-card px-4 pr-10 text-base text-foreground',
          'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </div>
  ),
)
Select.displayName = 'Select'
