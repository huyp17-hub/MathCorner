import { cn } from '@/lib/cn'

/**
 * Blob mờ trang trí (chỉ trang giới thiệu, đăng nhập, trang chủ, màn chúc mừng).
 * Blur lớn, opacity 0.6, nằm sau nội dung.
 */
export function DecorBlobs({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none fixed inset-0 z-0 overflow-hidden', className)}>
      <div className="absolute -right-20 -top-24 size-72 rounded-full bg-primary-softer opacity-60 blur-3xl" />
      <div className="absolute -left-24 top-1/3 size-64 rounded-full bg-lavender opacity-60 blur-3xl" />
      <div className="absolute -right-20 bottom-24 size-60 rounded-full bg-sage opacity-60 blur-3xl" />
    </div>
  )
}
