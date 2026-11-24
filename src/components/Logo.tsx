import { cn } from '@/lib/cn'

/**
 * Logo tạm — hướng A "góc giấy gập".
 * Chưa chốt; đổi một chỗ ở đây là đổi toàn web (và public/favicon.svg).
 */
export function Logo({
  size = 32,
  withText = true,
  className,
}: {
  size?: number
  withText?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Thân vuông bo góc màu san hô, chừa góc trên-phải để gập */}
        <path
          d="M10 4h22l10 10v20a10 10 0 0 1-10 10H14A10 10 0 0 1 4 34V10A6 6 0 0 1 10 4Z"
          fill="#FF8F85"
        />
        {/* Góc giấy gập */}
        <path d="M32 4l10 10H34a2 2 0 0 1-2-2V4Z" fill="#FFD9D4" />
        {/* Chấm tròn trắng góc dưới-trái */}
        <circle cx="15" cy="33" r="4" fill="#FFFFFF" />
      </svg>
      {withText && (
        <span className="text-lg font-extrabold tracking-tight text-foreground">Góc học</span>
      )}
    </span>
  )
}
