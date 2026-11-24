import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Khối hiện dần khi cuộn tới (opacity + dịch lên).
 * Tự tắt hiệu ứng khi prefers-reduced-motion (chỉ hiện ngay).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true)
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.2, rootMargin: '0px 0px -5% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-out',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
