import { supabase } from '@/lib/supabase'

export interface ClassMessage {
  id: string
  class_id: string
  sender_id: string
  content: string
  reply_to: string | null
  pinned: boolean
  created_at: string
  sender?: { full_name: string; role: string }
}

async function enrichWithProfiles(
  rows: { id: string; class_id: string; sender_id: string; content: string; reply_to: string | null; pinned: boolean; created_at: string }[],
): Promise<ClassMessage[]> {
  if (rows.length === 0) return []
  const ids = [...new Set(rows.map((r) => r.sender_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('id', ids)
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, role: p.role }]),
  )
  return rows.map((r) => ({
    ...r,
    sender: profileMap.get(r.sender_id),
  }))
}

export async function listMessages(
  classId: string,
  limit = 50,
  before?: string,
): Promise<ClassMessage[]> {
  let q = supabase
    .from('class_messages')
    .select('*')
    .eq('class_id', classId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) throw error

  return enrichWithProfiles(data ?? [])
}

export async function sendMessage(
  classId: string,
  senderId: string,
  content: string,
  replyTo?: string,
): Promise<ClassMessage> {
  const { data, error } = await supabase
    .from('class_messages')
    .insert({
      class_id: classId,
      sender_id: senderId,
      content: content.trim(),
      reply_to: replyTo ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  const enriched = await enrichWithProfiles([data])
  return enriched[0]
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from('class_messages')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function togglePin(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('class_messages')
    .update({ pinned })
    .eq('id', id)
  if (error) throw error
}

export function subscribeMessages(
  classId: string,
  onInsert: (msg: ClassMessage) => void,
  onDelete: (id: string) => void,
) {
  const channel = supabase
    .channel(`class-messages-${classId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'class_messages',
        filter: `class_id=eq.${classId}`,
      },
      async (payload) => {
        const row = payload.new as Record<string, unknown>
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', row.sender_id as string)
          .single()
        onInsert({
          id: row.id as string,
          class_id: row.class_id as string,
          sender_id: row.sender_id as string,
          content: row.content as string,
          reply_to: (row.reply_to as string) ?? null,
          pinned: (row.pinned as boolean) ?? false,
          created_at: row.created_at as string,
          sender: profile ?? { full_name: 'Ẩn danh', role: 'student' },
        })
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'class_messages',
        filter: `class_id=eq.${classId}`,
      },
      (payload) => {
        onDelete((payload.old as Record<string, unknown>).id as string)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
