-- 0006b_tsa_schema.sql — luyện đề TSA: phần thi có giờ riêng, đoạn văn dùng chung, kéo thả,
-- lời giải, đánh dấu câu, thời gian từng câu, tạm dừng, chế độ chấm TSA

create type public.exam_format as enum ('standard', 'tsa');

alter table public.assignments
  add column exam_format public.exam_format not null default 'standard',
  add column allow_pause boolean not null default false;

alter table public.submissions
  add column paused_at timestamptz,
  add column paused_seconds int not null default 0;

-- Phần thi (VD: Tư duy Toán học 60', Đọc hiểu 30', Khoa học 60'), làm lần lượt theo order_index
create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  order_index int not null default 0,
  title text not null,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  created_at timestamptz not null default now()
);
create index on public.exam_sections (assignment_id, order_index);

-- Đoạn văn / dữ kiện dùng chung cho nhiều câu (hiện bên trái, câu hỏi bên phải)
create table public.question_groups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  section_id uuid references public.exam_sections (id) on delete cascade,
  order_index int not null default 0,
  title text,
  content text not null
);
create index on public.question_groups (assignment_id);
create index on public.question_groups (section_id);

alter table public.questions
  add column section_id uuid references public.exam_sections (id) on delete cascade,
  add column group_id uuid references public.question_groups (id) on delete set null;
create index on public.questions (section_id);
create index on public.questions (group_id);

-- Lời giải: chỉ trả về khi xem lại bài
create table public.question_solutions (
  question_id uuid primary key references public.questions (id) on delete cascade,
  explanation text not null
);

-- Kéo thả: choices là kho phương án; blank_no = ô trống mà phương án này đúng (null = phương án nhiễu)
alter table public.choices add column blank_no int check (blank_no is null or blank_no > 0);

alter table public.answers
  add column blank_answers jsonb,                         -- { "1": "<choice_id>", "2": "<choice_id>" }
  add column flagged boolean not null default false,      -- đánh dấu xem lại
  add column time_spent_seconds int not null default 0 check (time_spent_seconds >= 0);

-- Tiến độ từng phần của một lượt làm
create table public.submission_sections (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  section_id uuid not null references public.exam_sections (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  paused_seconds int not null default 0,
  primary key (submission_id, section_id)
);
create index on public.submission_sections (section_id);

-- ===== Quyền cột trên answers =====
revoke insert, update on public.answers from authenticated;
grant insert (submission_id, question_id, selected_choice_ids, tf_answers, text_answer, blank_answers, flagged, time_spent_seconds)
  on public.answers to authenticated;
grant update (selected_choice_ids, tf_answers, text_answer, blank_answers, flagged, time_spent_seconds)
  on public.answers to authenticated;

-- ===== Hàm kiểm tra =====
-- Học sinh chỉ thấy câu hỏi của phần đã bắt đầu (không xem trước phần sau)
create or replace function private.section_visible(p_section_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_section_id is null or exists (
    select 1 from public.submission_sections ss
    join public.submissions s on s.id = ss.submission_id
    where ss.section_id = p_section_id and s.student_id = auth.uid()
  )
$$;

-- Bài đang làm của mình: chưa nộp, không tạm dừng, chưa hết giờ tổng
create or replace function private.is_my_open_submission(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission_id
      and s.student_id = auth.uid()
      and s.status = 'in_progress'
      and s.paused_at is null
      and (a.time_limit_minutes is null
           or now() <= s.started_at + make_interval(mins => a.time_limit_minutes + 1, secs => s.paused_seconds))
  )
$$;

-- Được trả lời câu này không: bài đang mở + (câu không thuộc phần nào, hoặc phần đó đang làm và còn giờ)
create or replace function private.can_answer(p_submission_id uuid, p_question_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_my_open_submission(p_submission_id) and exists (
    select 1 from public.questions q
    join public.submissions s on s.assignment_id = q.assignment_id
    where q.id = p_question_id and s.id = p_submission_id
      and (q.section_id is null or exists (
        select 1 from public.submission_sections ss
        join public.exam_sections es on es.id = ss.section_id
        where ss.submission_id = s.id and ss.section_id = q.section_id and ss.finished_at is null
          and (es.time_limit_minutes is null
               or now() <= ss.started_at + make_interval(mins => es.time_limit_minutes + 1, secs => ss.paused_seconds))
      ))
  )
$$;

-- ===== RLS =====
alter table public.exam_sections enable row level security;
alter table public.question_groups enable row level security;
alter table public.question_solutions enable row level security;
alter table public.submission_sections enable row level security;
revoke all on public.exam_sections, public.question_groups, public.question_solutions, public.submission_sections from anon;

create policy "sections: xem" on public.exam_sections
  for select to authenticated
  using (
    private.is_class_teacher(private.assignment_class(assignment_id))
    or exists (select 1 from public.assignments a
               where a.id = assignment_id and a.open_at <= now() and private.is_class_member(a.class_id))
  );
create policy "sections: giáo viên ghi" on public.exam_sections
  for all to authenticated
  using (private.is_class_teacher(private.assignment_class(assignment_id)))
  with check (private.is_class_teacher(private.assignment_class(assignment_id)));

create policy "groups: xem" on public.question_groups
  for select to authenticated
  using (
    private.is_class_teacher(private.assignment_class(assignment_id))
    or (exists (select 1 from public.assignments a
                where a.id = assignment_id and a.open_at <= now() and private.is_class_member(a.class_id))
        and private.section_visible(section_id))
  );
create policy "groups: giáo viên ghi" on public.question_groups
  for all to authenticated
  using (private.is_class_teacher(private.assignment_class(assignment_id)))
  with check (private.is_class_teacher(private.assignment_class(assignment_id)));

create policy "solutions: giáo viên" on public.question_solutions
  for all to authenticated
  using (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))))
  with check (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))));

create policy "submission sections: xem" on public.submission_sections
  for select to authenticated using (private.can_view_submission(submission_id));
revoke insert, update, delete on public.submission_sections from authenticated;

-- Câu hỏi: học sinh chỉ thấy câu của phần đã bắt đầu
drop policy "questions: xem" on public.questions;
create policy "questions: xem" on public.questions
  for select to authenticated
  using (
    private.is_class_teacher(private.assignment_class(assignment_id))
    or (exists (select 1 from public.assignments a
                where a.id = assignment_id and a.open_at <= now() and private.is_class_member(a.class_id))
        and private.section_visible(section_id))
  );

-- Trả lời: kiểm tra cả giờ của phần
drop policy "answers: học sinh thêm" on public.answers;
drop policy "answers: học sinh sửa" on public.answers;
create policy "answers: học sinh thêm" on public.answers
  for insert to authenticated with check (private.can_answer(submission_id, question_id));
create policy "answers: học sinh sửa" on public.answers
  for update to authenticated
  using (private.can_answer(submission_id, question_id))
  with check (private.can_answer(submission_id, question_id));

-- ===== Storage: ảnh, hình vẽ cho đề (đọc công khai qua link, chỉ giáo viên tải lên) =====
-- Đường dẫn: {teacher_id}/{tên file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-media', 'question-media', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "question-media: giáo viên tải lên" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-media' and private.my_role() = 'teacher'
              and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "question-media: giáo viên sửa" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-media' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "question-media: giáo viên xoá" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-media' and split_part(name, '/', 1) = (select auth.uid())::text);
