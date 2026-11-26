import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import {
  MessageCircle,
  Pin,
  Reply,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import {
  deleteMessage,
  listMessages,
  sendMessage,
  subscribeMessages,
  togglePin,
  type ClassMessage,
} from '@/lib/api/messages'

dayjs.extend(relativeTime)
dayjs.locale('vi')

interface ChatPanelProps {
  classId: string
  userId: string
  userRole: 'teacher' | 'student'
}

export function ChatPanel({ classId, userId, userRole }: ChatPanelProps) {
  const [messages, setMessages] = useState<ClassMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<ClassMessage | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    let cancelled = false
    listMessages(classId)
      .then((data) => {
        if (cancelled) return
        setMessages(data.reverse())
        setLoading(false)
        setTimeout(scrollToBottom, 100)
      })
      .catch(() => {
        if (cancelled) return
        setError('Không tải được tin nhắn.')
        setLoading(false)
      })

    const unsub = subscribeMessages(
      classId,
      (msg) => {
        setMessages((prev) => [...prev, msg])
        setTimeout(scrollToBottom, 100)
      },
      (id) => {
        setMessages((prev) => prev.filter((m) => m.id !== id))
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [classId, scrollToBottom])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await sendMessage(classId, userId, trimmed, replyTo?.id)
      setText('')
      setReplyTo(null)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      setError('Không gửi được. Thử lại nhé.')
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(msgId: string) {
    try {
      await deleteMessage(msgId)
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
    } catch {
      setError('Không xoá được tin nhắn.')
    }
  }

  async function handleTogglePin(msg: ClassMessage) {
    try {
      await togglePin(msg.id, !msg.pinned)
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, pinned: !m.pinned } : m)),
      )
    } catch {
      setError('Không ghim được.')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function shareToZalo(msg: ClassMessage) {
    const sender = msg.sender?.full_name ?? 'Giáo viên'
    const time = dayjs(msg.created_at).format('DD/MM HH:mm')
    const body = `[Thông báo lớp học]\n${sender} (${time}):\n${msg.content}`
    const encoded = encodeURIComponent(body)
    window.open(
      `https://zalo.me/share?text=${encoded}`,
      '_blank',
      'noopener',
    )
  }

  const pinnedMessages = messages.filter((m) => m.pinned)

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-black/[0.04]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {error && (
        <p className="mb-3 rounded-2xl bg-danger px-4 py-2.5 text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}

      {/* Pinned messages */}
      {pinnedMessages.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {pinnedMessages.map((m) => (
            <div
              key={m.id}
              className="flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2"
            >
              <Pin className="mt-0.5 size-4 shrink-0 text-yellow-600" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-yellow-700">
                  {m.sender?.full_name ?? 'Ẩn danh'}
                </p>
                <p className="text-sm text-yellow-900 line-clamp-2">{m.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages area */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <div className="max-h-[28rem] min-h-[16rem] overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageCircle
                  className="size-10 text-muted-foreground/40"
                  strokeWidth={1.5}
                />
                <p className="mt-2 font-semibold">Chưa có tin nhắn nào.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hãy gửi thông báo đầu tiên!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === userId
                  const isTeacher = msg.sender?.role === 'teacher'
                  const repliedMsg = msg.reply_to
                    ? messages.find((m) => m.id === msg.reply_to)
                    : null

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'group flex gap-2',
                        isMine ? 'flex-row-reverse' : 'flex-row',
                      )}
                    >
                      {/* Avatar */}
                      {msg.sender?.avatar_url ? (
                        <img
                          src={msg.sender.avatar_url}
                          alt={msg.sender.full_name}
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={cn(
                            'grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold',
                            isTeacher
                              ? 'bg-sage text-foreground'
                              : 'bg-peach text-foreground',
                          )}
                        >
                          {(msg.sender?.full_name ?? '?')[0].toUpperCase()}
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3.5 py-2',
                          isMine
                            ? 'bg-primary-softer text-foreground'
                            : 'bg-black/[0.04] text-foreground',
                          msg.pinned && 'ring-2 ring-yellow-300',
                        )}
                      >
                        {/* Sender name */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">
                            {msg.sender?.full_name ?? 'Ẩn danh'}
                          </span>
                          {isTeacher && (
                            <span className="rounded-full bg-sage px-1.5 py-0.5 text-[10px] font-bold leading-none text-foreground">
                              GV
                            </span>
                          )}
                          {msg.pinned && (
                            <Pin className="size-3 text-yellow-600" strokeWidth={2} />
                          )}
                        </div>

                        {/* Reply ref */}
                        {repliedMsg && (
                          <div className="mt-1 rounded-lg border-l-2 border-muted-foreground/30 bg-black/[0.04] px-2 py-1 text-xs text-muted-foreground">
                            <span className="font-semibold">
                              {repliedMsg.sender?.full_name}:
                            </span>{' '}
                            <span className="line-clamp-1">{repliedMsg.content}</span>
                          </div>
                        )}

                        {/* Content */}
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                          {msg.content}
                        </p>

                        {/* Time */}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {dayjs(msg.created_at).fromNow()}
                        </p>
                      </div>

                      {/* Actions — always visible on mobile, hover on desktop */}
                      <div className="flex shrink-0 flex-col gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="rounded-lg p-1 hover:bg-black/[0.06]"
                          title="Trả lời"
                        >
                          <Reply className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => shareToZalo(msg)}
                          className="rounded-lg p-1 hover:bg-black/[0.06]"
                          title="Chia sẻ qua Zalo"
                        >
                          <Share2 className="size-3.5 text-blue-500" strokeWidth={1.75} />
                        </button>
                        {userRole === 'teacher' && (
                          <button
                            onClick={() => handleTogglePin(msg)}
                            className="rounded-lg p-1 hover:bg-black/[0.06]"
                            title={msg.pinned ? 'Bỏ ghim' : 'Ghim'}
                          >
                            <Pin
                              className={cn(
                                'size-3.5',
                                msg.pinned
                                  ? 'text-yellow-600'
                                  : 'text-muted-foreground',
                              )}
                              strokeWidth={1.75}
                            />
                          </button>
                        )}
                        {(isMine || userRole === 'teacher') && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="rounded-lg p-1 hover:bg-danger/50"
                            title="Xoá"
                          >
                            <Trash2
                              className="size-3.5 text-muted-foreground"
                              strokeWidth={1.75}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reply bar */}
      {replyTo && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Reply className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="min-w-0 flex-1 text-xs text-muted-foreground">
            Trả lời{' '}
            <span className="font-bold">{replyTo.sender?.full_name}</span>:{' '}
            <span className="line-clamp-1">{replyTo.content}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0">
            <X className="size-4 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="mt-2 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            autoResize(e.target)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn…"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          loading={sending}
          className="shrink-0 rounded-full px-3"
        >
          <Send className="size-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  )
}
