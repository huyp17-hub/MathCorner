import { useEffect, useState } from 'react'
import { ClassPicker } from '@/components/ClassPicker'
import { cn } from '@/lib/cn'
import { getClass } from '@/lib/api/classes'
import type { ClassSession } from '@/lib/types'
import { AttendanceSheet } from './attendance/AttendanceSheet'
import { SessionsView } from './attendance/SessionsView'
import { StatsView } from './attendance/StatsView'

type Tab = 'sessions' | 'stats'

export default function Attendance() {
  const [classId, setClassId] = useState<string | null>(null)
  const [className, setClassName] = useState('')
  const [tab, setTab] = useState<Tab>('sessions')
  const [active, setActive] = useState<ClassSession | null>(null)

  useEffect(() => {
    if (!classId) return
    setActive(null)
    getClass(classId)
      .then((c) => setClassName(c?.name ?? ''))
      .catch(() => setClassName(''))
  }, [classId])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Điểm danh</h1>
      <p className="mt-1 text-muted-foreground">Chọn lớp rồi điểm danh từng buổi.</p>

      <div className="mt-4">
        <ClassPicker value={classId} onChange={setClassId} />
      </div>

      {classId && !active && (
        <>
          <div
            role="tablist"
            aria-label="Chế độ xem"
            className="mt-5 flex gap-1 rounded-full border border-border bg-card p-1 sm:w-fit"
          >
            {(
              [
                { id: 'sessions', label: 'Buổi học' },
                { id: 'stats', label: 'Thống kê' },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors sm:flex-none',
                  tab === t.id
                    ? 'bg-primary-softer text-primary-foreground'
                    : 'text-muted-foreground hover:bg-black/[0.04]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === 'sessions' ? (
              <SessionsView classId={classId} onOpen={setActive} />
            ) : (
              <StatsView classId={classId} className={className} />
            )}
          </div>
        </>
      )}

      {classId && active && (
        <div className="mt-5">
          <AttendanceSheet classId={classId} session={active} onBack={() => setActive(null)} />
        </div>
      )}
    </div>
  )
}
