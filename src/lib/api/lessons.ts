import { supabase } from '@/lib/supabase'

export interface Lesson {
  id: string
  class_id: string
  topic: string | null
  title: string
  description: string | null
  position: number
  published: boolean
  created_at: string
  updated_at: string
}

export interface LessonFile {
  id: string
  lesson_id: string
  kind: string
  storage_path: string | null
  url: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  position: number
  created_at: string
}

export interface LessonWithFiles extends Lesson {
  files: (LessonFile & { signed_url: string | null })[]
}

export interface LessonInput {
  title: string
  description: string | null
  topic: string | null
  published: boolean
}

export async function listLessons(classId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('class_id', classId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getLessonWithFiles(lessonId: string): Promise<LessonWithFiles> {
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single()
  if (error) throw error

  const { data: files, error: fErr } = await supabase
    .from('lesson_files')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: true })
  if (fErr) throw fErr

  const withUrls = await Promise.all(
    (files ?? []).map(async (f) => ({
      ...f,
      signed_url: f.storage_path ? await signedLessonUrl(f.storage_path) : f.url,
    })),
  )

  return { ...lesson, files: withUrls }
}

export async function createLesson(classId: string, input: LessonInput): Promise<Lesson> {
  const { data: maxPos } = await supabase
    .from('lessons')
    .select('position')
    .eq('class_id', classId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      class_id: classId,
      title: input.title,
      description: input.description,
      topic: input.topic,
      published: input.published,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLesson(id: string, input: Partial<LessonInput>): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLesson(id: string): Promise<void> {
  const { data: files } = await supabase
    .from('lesson_files')
    .select('storage_path')
    .eq('lesson_id', id)

  if (files && files.length > 0) {
    const paths = files.map((f) => f.storage_path).filter(Boolean) as string[]
    if (paths.length > 0) {
      await supabase.storage.from('lesson-files').remove(paths)
    }
  }

  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

const MAX_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'mp4', 'mp3']

export function validateLessonFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) return 'Định dạng không hỗ trợ.'
  if (file.size > MAX_FILE_BYTES) return 'File quá lớn (tối đa 20 MB).'
  return null
}

function fileKind(mime: string): string {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf') return 'document'
  return 'document'
}

export async function uploadLessonFile(
  classId: string,
  lessonId: string,
  file: File,
): Promise<LessonFile> {
  const ts = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${classId}/${lessonId}/${ts}-${safeName}`

  const { error: upErr } = await supabase.storage
    .from('lesson-files')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upErr) throw upErr

  const { data: maxPos } = await supabase
    .from('lesson_files')
    .select('position')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('lesson_files')
    .insert({
      lesson_id: lessonId,
      kind: fileKind(file.type),
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addLessonLink(
  lessonId: string,
  url: string,
  fileName: string,
): Promise<LessonFile> {
  const { data: maxPos } = await supabase
    .from('lesson_files')
    .select('position')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabase
    .from('lesson_files')
    .insert({
      lesson_id: lessonId,
      kind: 'link',
      url,
      file_name: fileName,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteLessonFile(file: LessonFile): Promise<void> {
  if (file.storage_path) {
    await supabase.storage.from('lesson-files').remove([file.storage_path])
  }
  const { error } = await supabase.from('lesson_files').delete().eq('id', file.id)
  if (error) throw error
}

async function signedLessonUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('lesson-files')
    .createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
