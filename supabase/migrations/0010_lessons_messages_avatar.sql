-- Migration 0010: Bài giảng, nhắn tin lớp, ảnh đại diện
-- Các bảng này ĐÃ được tạo trên DB thật trước khi có file này.
-- File để tham khảo và tái tạo khi cần.

-- ============================================================
-- 1. Thêm cột avatar_url vào profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============================================================
-- 2. Bảng lessons (bài giảng / tài liệu của lớp)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lessons (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  topic      text,
  title      text NOT NULL,
  description text,
  position   int NOT NULL DEFAULT 0,
  published  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Giáo viên CRUD bài giảng lớp mình"
  ON public.lessons FOR ALL
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()));

CREATE POLICY "Học sinh xem bài giảng lớp mình (đã publish)"
  ON public.lessons FOR SELECT
  USING (
    published = true
    AND class_id IN (
      SELECT class_id FROM public.class_members WHERE student_id = auth.uid()
    )
  );

-- ============================================================
-- 3. Bảng lesson_files (file đính kèm bài giảng)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id    uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'document',
  storage_path text,
  url          text,
  file_name    text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  position     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Giáo viên CRUD file bài giảng"
  ON public.lesson_files FOR ALL
  USING (lesson_id IN (
    SELECT l.id FROM public.lessons l
    JOIN public.classes c ON c.id = l.class_id
    WHERE c.teacher_id = auth.uid()
  ))
  WITH CHECK (lesson_id IN (
    SELECT l.id FROM public.lessons l
    JOIN public.classes c ON c.id = l.class_id
    WHERE c.teacher_id = auth.uid()
  ));

CREATE POLICY "Học sinh xem file bài giảng"
  ON public.lesson_files FOR SELECT
  USING (lesson_id IN (
    SELECT l.id FROM public.lessons l
    JOIN public.class_members cm ON cm.class_id = l.class_id
    WHERE cm.student_id = auth.uid() AND l.published = true
  ));

-- ============================================================
-- 4. Bảng class_messages (nhắn tin trong lớp)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.class_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  sender_id  uuid NOT NULL,
  content    text NOT NULL,
  reply_to   uuid REFERENCES public.class_messages(id) ON DELETE SET NULL,
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Giáo viên đọc/gửi/xoá tin nhắn lớp mình"
  ON public.class_messages FOR ALL
  USING (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()))
  WITH CHECK (class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid()));

CREATE POLICY "Học sinh đọc tin nhắn lớp mình"
  ON public.class_messages FOR SELECT
  USING (class_id IN (
    SELECT class_id FROM public.class_members WHERE student_id = auth.uid()
  ));

CREATE POLICY "Học sinh gửi tin nhắn lớp mình"
  ON public.class_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND class_id IN (
      SELECT class_id FROM public.class_members WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Học sinh xoá tin nhắn của mình"
  ON public.class_messages FOR DELETE
  USING (sender_id = auth.uid());

-- Bật realtime cho class_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;

-- ============================================================
-- 5. Storage buckets
-- ============================================================
-- avatars: public (ảnh đại diện)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Người dùng upload avatar của mình"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Người dùng update avatar của mình"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Ai cũng xem được avatar"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- lesson-files: private (signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-files', 'lesson-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Giáo viên upload file bài giảng"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Giáo viên xoá file bài giảng"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'lesson-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Thành viên lớp đọc file bài giảng"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'lesson-files'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.classes WHERE teacher_id = auth.uid()
      )
      OR (storage.foldername(name))[1] IN (
        SELECT class_id::text FROM public.class_members WHERE student_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 6. Grants
-- ============================================================
GRANT ALL ON public.lessons TO authenticated;
GRANT ALL ON public.lesson_files TO authenticated;
GRANT ALL ON public.class_messages TO authenticated;
