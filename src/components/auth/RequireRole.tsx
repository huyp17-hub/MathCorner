import { Navigate, useLocation } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { roleHome, type Role } from '@/lib/types'

/**
 * Bảo vệ route theo vai trò.
 * - Chưa đăng nhập → về /login (nhớ đường dẫn muốn tới).
 * - Sai vai trò → chuyển về trang chủ của vai trò hiện tại.
 */
export function RequireRole({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { loading, session, profile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Có phiên nhưng không đọc được hồ sơ (hiếm) — mời đăng nhập lại.
  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-5">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="font-bold">Không tải được hồ sơ của bạn</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Bạn hãy đăng nhập lại giúp mình nhé.
            </p>
            <Button className="mt-5 w-full" onClick={() => void signOut()}>
              Đăng nhập lại
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={roleHome[profile.role]} replace />
  }

  return <>{children}</>
}
