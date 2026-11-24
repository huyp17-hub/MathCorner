import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-transform duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        // Hành động chính — nền san hô, chữ foreground (không trắng)
        primary: 'bg-primary text-primary-foreground shadow-soft hover:scale-[1.03] active:scale-[0.97]',
        // Nhấn nhẹ
        soft: 'bg-primary-softer text-primary-foreground hover:scale-[1.03] active:scale-[0.97]',
        // Viền
        outline: 'border border-border bg-card text-foreground hover:bg-background active:scale-[0.98]',
        // Trong suốt
        ghost: 'text-foreground hover:bg-black/[0.05] active:scale-[0.98]',
        // Nguy hiểm
        danger: 'bg-danger text-danger-foreground hover:scale-[1.03] active:scale-[0.97]',
      },
      size: {
        default: 'min-h-11 px-5 py-2.5 text-sm',
        sm: 'min-h-9 px-4 text-sm',
        lg: 'min-h-13 px-7 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
