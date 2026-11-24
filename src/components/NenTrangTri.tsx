import { cn } from '@/lib/cn'

export type NenKieu = 'cham-bi' | 'ke-dong' | 'tron'

/**
 * Nền trang trí nhẹ cho khu vực trong app (Bước 1–7 dùng `cham-bi` hoặc `tron`).
 * Đặt ở lớp dưới cùng (z-0, pointer-events-none); nội dung trang phải nằm trên (z-10).
 * Các kiểu hoạ tiết đậm hơn (dau-trang-do-thi, ký hiệu toán) sẽ bổ sung ở Bước 8.
 */
export function NenTrangTri({ kieu = 'cham-bi', className }: { kieu?: NenKieu; className?: string }) {
  if (kieu === 'tron') return null

  const style =
    kieu === 'cham-bi'
      ? {
          backgroundImage: 'radial-gradient(#DDD5C9 1.3px, transparent 1.6px)',
          backgroundSize: '22px 22px',
        }
      : {
          // ke-dong: giấy kẻ dòng
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 35px, #EEE7DC 35px 36px)',
        }

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 z-0 opacity-70', className)}
      style={style}
    />
  )
}
