import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'min-h-11 w-full rounded-2xl border border-border bg-card px-4 text-base text-foreground',
        'placeholder:text-muted-foreground',
        'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('mb-1.5 block text-sm font-semibold text-foreground', className)} {...props} />
  ),
)
Label.displayName = 'Label'
