import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { getAssignment } from '@/lib/api/assignments'
import { getLatestSubmission } from '@/lib/api/quiz'
import type { Assignment } from '@/lib/types'
import QuizResult from './QuizResult'
import SubmitEssay from './SubmitEssay'
import TakeQuiz from './TakeQuiz'

type QuizView =
  | { kind: 'take'; nonce: number }
  | { kind: 'review'; submissionId: string; summary?: { score: number | null; max_score: number | null } }

export default function AssignmentRunner() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quizView, setQuizView] = useState<QuizView | null>(null)
  const [lastAttemptNo, setLastAttemptNo] = useState(0)

  const back = () => navigate('/student/assignments')

  useEffect(() => {
    if (!assignmentId || !user) return
    let active = true
    async function init() {
      try {
        const a = await getAssignment(assignmentId!)
        if (!a) throw new Error('Không tìm thấy bài tập.')
        const latest = await getLatestSubmission(assignmentId!, user!.id)
        if (!active) return
        setAssignment(a)
        if (a.type === 'essay') return // SubmitEssay tự xử lý
        if (latest) setLastAttemptNo(latest.attempt_no)
        if (latest && latest.status !== 'in_progress') {
          setQuizView({
            kind: 'review',
            submissionId: latest.id,
            summary: {
              score: latest.score != null ? Number(latest.score) : null,
              max_score: latest.max_score != null ? Number(latest.max_score) : null,
            },
          })
        } else {
          setQuizView({ kind: 'take', nonce: 0 })
        }
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Không tải được bài tập.')
      }
    }
    void init()
    return () => {
      active = false
    }
  }, [assignmentId, user])

  if (loadError) {
    return (
      <div>
        <BackLink onClick={back} />
        <Card className="mt-3">
          <CardContent className="py-10 text-center">
            <p className="font-semibold">{loadError}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!assignment || !assignmentId || !user) {
    return <div className="h-72 animate-pulse rounded-[2rem] bg-black/[0.04]" />
  }

  if (assignment.type === 'essay') {
    return (
      <div>
        <BackLink onClick={back} />
        <div className="mt-2">
          <SubmitEssay
            assignmentId={assignmentId}
            studentId={user.id}
            title={assignment.title}
            onExit={back}
          />
        </div>
      </div>
    )
  }

  // quiz
  const canRetake = lastAttemptNo > 0 && lastAttemptNo < assignment.max_attempts

  return (
    <div>
      {quizView?.kind !== 'take' && <BackLink onClick={back} />}
      <div className={quizView?.kind !== 'take' ? 'mt-2' : ''}>
        {quizView?.kind === 'take' && (
          <TakeQuiz
            key={quizView.nonce}
            assignmentId={assignmentId}
            onExit={back}
            onSubmitted={async (sid) => {
              const sub = await getLatestSubmission(assignmentId, user.id).catch(() => null)
              setLastAttemptNo(sub?.attempt_no ?? lastAttemptNo)
              setQuizView({
                kind: 'review',
                submissionId: sid,
                summary: {
                  score: sub?.score != null ? Number(sub.score) : null,
                  max_score: sub?.max_score != null ? Number(sub.max_score) : null,
                },
              })
            }}
          />
        )}
        {quizView?.kind === 'review' && (
          <QuizResult
            submissionId={quizView.submissionId}
            summary={quizView.summary}
            canRetake={canRetake}
            onRetake={() => setQuizView({ kind: 'take', nonce: Date.now() })}
            onExit={back}
          />
        )}
      </div>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
      Danh sách bài tập
    </button>
  )
}
