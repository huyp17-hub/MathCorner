import { Loader2 } from 'lucide-react'

/** Màn tải toàn trang, dùng khi đang xác định phiên đăng nhập / vai trò. */
export function FullScreenLoader({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-5">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">{label}</p>
      </div>
    </div>
  )
}
