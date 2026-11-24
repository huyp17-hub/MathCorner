import { cn } from '@/lib/cn'

/**
 * Lớp hạt giấy (grain) phủ nền toàn trang.
 * - Chỉ phủ nền, không nằm trên thẻ chứa chữ (z thấp).
 * - Tự tắt khi prefers-reduced-motion (qua class `motion-reduce:hidden`).
 * - KHÔNG dùng trong phòng thi TSA.
 */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.18] mix-blend-overlay motion-reduce:hidden',
        className,
      )}
    >
      <filter id="grain-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain-noise)" />
    </svg>
  )
}
