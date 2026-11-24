import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthContextValue {
  /** Đang tải phiên đăng nhập hoặc hồ sơ lần đầu. */
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  /** Tải lại hồ sơ từ DB (sau khi cập nhật họ tên, SĐT...). */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.warn('Không đọc được hồ sơ người dùng:', error.message)
    return null
  }
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Tránh race khi nhiều sự kiện auth bắn liên tiếp.
  const currentUserId = useRef<string | null>(null)

  const loadProfile = useCallback(async (userId: string | null) => {
    currentUserId.current = userId
    if (!userId) {
      setProfile(null)
      return
    }
    const p = await fetchProfile(userId)
    // Chỉ nhận kết quả nếu vẫn là người dùng hiện tại.
    if (currentUserId.current === userId) setProfile(p)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user.id ?? null)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      void loadProfile(nextSession?.user.id ?? null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id ?? null)
  }, [loadProfile, session])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signOut,
    }),
    [loading, session, profile, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
