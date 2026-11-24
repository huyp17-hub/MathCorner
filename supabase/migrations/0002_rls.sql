-- 0002_rls.sql — bật Row Level Security và phân quyền theo vai trò

create or replace function private.is_student_in_class(p_class_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.class_members where class_id = p_class_id and student_id = p_student_id) $$;

alter table public.profiles enable row level security;
alter table public.student_parent_codes enable row level security;
alter table public.parent_links enable row level security;
alter table public.parent_link_attempts enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public.submission_files enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;

-- Không cho khách (anon) đụng vào bảng nào
revoke all on all tables in schema public from anon;

-- ===== profiles =====
create policy "profiles: xem người liên quan" on public.profiles
  for select to authenticated using (private.can_view_profile(id));
create policy "profiles: sửa bản thân hoặc học sinh của mình" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or private.is_teacher_of_student(id))
  with check (id = (select auth.uid()) or private.is_teacher_of_student(id));
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, student_code, phone) on public.profiles to authenticated;

-- ===== student_parent_codes: chỉ học sinh đó và giáo viên của em xem được =====
create policy "parent codes: học sinh và giáo viên" on public.student_parent_codes
  for select to authenticated
  using (student_id = (select auth.uid()) or private.is_teacher_of_student(student_id));
revoke insert, update, delete on public.student_parent_codes from authenticated;

-- ===== parent_links: tạo qua RPC link_parent =====
create policy "parent links: xem" on public.parent_links
  for select to authenticated
  using (parent_id = (select auth.uid()) or student_id = (select auth.uid())
         or private.is_teacher_of_student(student_id));
create policy "parent links: gỡ" on public.parent_links
  for delete to authenticated
  using (parent_id = (select auth.uid()) or private.is_teacher_of_student(student_id));
revoke insert, update on public.parent_links from authenticated;

-- ===== parent_link_attempts: chỉ dùng nội bộ =====
revoke all on public.parent_link_attempts from authenticated;

-- ===== classes =====
create policy "classes: xem" on public.classes
  for select to authenticated
  using (teacher_id = (select auth.uid()) or private.is_class_member(id) or private.is_parent_in_class(id));
create policy "classes: giáo viên tạo" on public.classes
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and private.my_role() = 'teacher');
create policy "classes: giáo viên sửa" on public.classes
  for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "classes: giáo viên xoá" on public.classes
  for delete to authenticated using (teacher_id = (select auth.uid()));

-- ===== class_members =====
create policy "members: xem" on public.class_members
  for select to authenticated
  using (private.is_class_teacher(class_id) or student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy "members: giáo viên thêm" on public.class_members
  for insert to authenticated
  with check (
    private.is_class_teacher(class_id)
    and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student')
  );
create policy "members: giáo viên xoá" on public.class_members
  for delete to authenticated using (private.is_class_teacher(class_id));
revoke update on public.class_members from authenticated;

-- ===== assignments: học sinh/phụ huynh chỉ thấy bài đã mở =====
create policy "assignments: xem" on public.assignments
  for select to authenticated
  using (
    private.is_class_teacher(class_id)
    or ((private.is_class_member(class_id) or private.is_parent_in_class(class_id)) and open_at <= now())
  );
create policy "assignments: giáo viên thêm" on public.assignments
  for insert to authenticated with check (private.is_class_teacher(class_id));
create policy "assignments: giáo viên sửa" on public.assignments
  for update to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));
create policy "assignments: giáo viên xoá" on public.assignments
  for delete to authenticated using (private.is_class_teacher(class_id));

-- ===== questions: giáo viên; học sinh trong lớp khi bài đã mở (phụ huynh không xem) =====
create policy "questions: xem" on public.questions
  for select to authenticated
  using (
    private.is_class_teacher(private.assignment_class(assignment_id))
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id and a.open_at <= now() and private.is_class_member(a.class_id)
    )
  );
create policy "questions: giáo viên ghi" on public.questions
  for all to authenticated
  using (private.is_class_teacher(private.assignment_class(assignment_id)))
  with check (private.is_class_teacher(private.assignment_class(assignment_id)));

-- ===== choices: chỉ giáo viên đọc trực tiếp (có is_correct). Học sinh dùng RPC get_quiz =====
create policy "choices: giáo viên" on public.choices
  for all to authenticated
  using (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))))
  with check (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))));

-- ===== submissions: tạo/nộp qua RPC; giáo viên chấm bằng UPDATE =====
create policy "submissions: xem" on public.submissions
  for select to authenticated
  using (student_id = (select auth.uid()) or private.is_class_teacher(private.assignment_class(assignment_id)));
create policy "submissions: giáo viên chấm" on public.submissions
  for update to authenticated
  using (private.is_class_teacher(private.assignment_class(assignment_id)))
  with check (private.is_class_teacher(private.assignment_class(assignment_id)));
revoke insert, update, delete on public.submissions from authenticated;
grant update (score, teacher_comment, status, graded_at) on public.submissions to authenticated;

-- ===== answers: học sinh lưu khi bài còn đang làm =====
create policy "answers: xem" on public.answers
  for select to authenticated using (private.can_view_submission(submission_id));
create policy "answers: học sinh thêm" on public.answers
  for insert to authenticated
  with check (
    private.is_my_open_submission(submission_id)
    and exists (select 1 from public.submissions s
                join public.questions q on q.assignment_id = s.assignment_id
                where s.id = submission_id and q.id = question_id)
  );
create policy "answers: học sinh sửa" on public.answers
  for update to authenticated
  using (private.is_my_open_submission(submission_id))
  with check (private.is_my_open_submission(submission_id));
revoke delete on public.answers from authenticated;

-- ===== submission_files =====
create policy "files: xem" on public.submission_files
  for select to authenticated using (private.can_view_submission(submission_id));
create policy "files: học sinh thêm" on public.submission_files
  for insert to authenticated
  with check (
    private.is_my_open_submission(submission_id)
    and exists (select 1 from public.submissions s
                where s.id = submission_id
                  and storage_path like s.assignment_id::text || '/' || s.student_id::text || '/' || s.id::text || '/%')
  );
create policy "files: học sinh xoá" on public.submission_files
  for delete to authenticated using (private.is_my_open_submission(submission_id));
revoke update on public.submission_files from authenticated;

-- ===== class_sessions =====
create policy "sessions: xem" on public.class_sessions
  for select to authenticated
  using (private.is_class_teacher(class_id) or private.is_class_member(class_id) or private.is_parent_in_class(class_id));
create policy "sessions: giáo viên ghi" on public.class_sessions
  for all to authenticated
  using (private.is_class_teacher(class_id)) with check (private.is_class_teacher(class_id));

-- ===== attendance =====
create policy "attendance: xem" on public.attendance
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.is_parent_of(student_id)
    or private.is_class_teacher(private.session_class(session_id))
  );
create policy "attendance: giáo viên thêm" on public.attendance
  for insert to authenticated
  with check (
    private.is_class_teacher(private.session_class(session_id))
    and private.is_student_in_class(private.session_class(session_id), student_id)
  );
create policy "attendance: giáo viên sửa" on public.attendance
  for update to authenticated
  using (private.is_class_teacher(private.session_class(session_id)))
  with check (
    private.is_class_teacher(private.session_class(session_id))
    and private.is_student_in_class(private.session_class(session_id), student_id)
  );
create policy "attendance: giáo viên xoá" on public.attendance
  for delete to authenticated using (private.is_class_teacher(private.session_class(session_id)));
