-- 0003_rpc_storage.sql — hàm RPC cho học sinh/phụ huynh/giáo viên và Storage nộp file

-- ===== Chấm trắc nghiệm (nội bộ) =====
-- Một câu được điểm khi tập đáp án chọn trùng khớp hoàn toàn với tập đáp án đúng.
create or replace function private.grade_quiz(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment uuid;
  v_due timestamptz;
  v_score numeric;
  v_max numeric;
begin
  select s.assignment_id, a.due_at into v_assignment, v_due
  from public.submissions s join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;

  with q as (
    select id, points from public.questions where assignment_id = v_assignment
  ), correct as (
    select c.question_id, array_agg(c.id order by c.id) as ids
    from public.choices c
    where c.is_correct and c.question_id in (select id from q)
    group by c.question_id
  ), given as (
    select a.question_id,
           (select array_agg(x order by x) from (select distinct unnest(a.selected_choice_ids) as x) t) as ids
    from public.answers a
    where a.submission_id = p_submission_id
  )
  select coalesce(sum(case when g.ids = c.ids then q.points else 0 end), 0),
         coalesce(sum(q.points), 0)
  into v_score, v_max
  from q
  left join correct c on c.question_id = q.id
  left join given g on g.question_id = q.id;

  update public.submissions
  set status = 'graded',
      submitted_at = coalesce(submitted_at, now()),
      is_late = coalesce(submitted_at, now()) > v_due,
      score = v_score,
      max_score = v_max,
      graded_at = now()
  where id = p_submission_id;
end;
$$;

-- ===== Lớp học =====
create or replace function public.join_class(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
begin
  if private.my_role() is distinct from 'student' then
    raise exception 'Chỉ học sinh mới tham gia lớp bằng mã.';
  end if;
  select id into v_class from public.classes where join_code = upper(trim(p_code));
  if v_class is null then
    raise exception 'Mã lớp không đúng.';
  end if;
  insert into public.class_members (class_id, student_id)
  values (v_class, auth.uid())
  on conflict do nothing;
  return v_class;
end;
$$;

create or replace function public.regenerate_join_code(p_class_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_class_teacher(p_class_id) then
    raise exception 'Bạn không phải giáo viên của lớp này.';
  end if;
  loop
    v_code := private.gen_code(6);
    exit when not exists (select 1 from public.classes where join_code = v_code);
  end loop;
  update public.classes set join_code = v_code where id = p_class_id;
  return v_code;
end;
$$;

-- ===== Phụ huynh =====
create or replace function public.regenerate_parent_code(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_teacher_of_student(p_student_id) then
    raise exception 'Bạn không phải giáo viên của học sinh này.';
  end if;
  loop
    v_code := private.gen_code(8);
    exit when not exists (select 1 from public.student_parent_codes where code = v_code);
  end loop;
  insert into public.student_parent_codes (student_id, code, updated_at)
  values (p_student_id, v_code, now())
  on conflict (student_id) do update set code = excluded.code, updated_at = now();
  return v_code;
end;
$$;

-- Trả về jsonb thay vì raise để lần nhập sai vẫn được ghi lại (chống dò mã).
create or replace function public.link_parent(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
  v_name text;
  v_fails int;
begin
  if private.my_role() is distinct from 'parent' then
    return jsonb_build_object('ok', false, 'message', 'Chỉ tài khoản phụ huynh mới liên kết được.');
  end if;

  select count(*) into v_fails
  from public.parent_link_attempts
  where parent_id = auth.uid() and not success and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'message', 'Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
  end if;

  select spc.student_id, p.full_name into v_student, v_name
  from public.student_parent_codes spc
  join public.profiles p on p.id = spc.student_id
  where spc.code = upper(trim(p_code));

  insert into public.parent_link_attempts (parent_id, success) values (auth.uid(), v_student is not null);

  if v_student is null then
    return jsonb_build_object('ok', false, 'message', 'Mã phụ huynh không đúng.');
  end if;

  insert into public.parent_links (parent_id, student_id)
  values (auth.uid(), v_student)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'student_id', v_student, 'full_name', v_name,
                            'message', 'Đã liên kết với ' || v_name || '.');
end;
$$;

create or replace function public.parent_children()
returns table (student_id uuid, full_name text, student_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.student_code
  from public.parent_links pl
  join public.profiles p on p.id = pl.student_id
  where pl.parent_id = auth.uid()
  order by p.full_name
$$;

-- Tổng hợp bài tập của con cho phụ huynh (không có đề, đáp án, bài làm, file)
create or replace function public.parent_child_assignments(p_student_id uuid)
returns table (
  assignment_id uuid,
  class_id uuid,
  class_name text,
  title text,
  type public.assignment_type,
  due_at timestamptz,
  status text,          -- not_started | in_progress | submitted | graded
  is_late boolean,
  is_overdue boolean,   -- quá hạn mà chưa nộp
  score numeric,
  max_score numeric,
  teacher_comment text,
  submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_parent_of(p_student_id) then
    raise exception 'Bạn chưa liên kết với học sinh này.';
  end if;

  return query
  select a.id, c.id, c.name, a.title, a.type, a.due_at,
         coalesce(s.status::text, 'not_started'),
         coalesce(s.is_late, false),
         (s.id is null or s.status = 'in_progress') and now() > a.due_at,
         s.score, s.max_score, s.teacher_comment, s.submitted_at
  from public.class_members cm
  join public.classes c on c.id = cm.class_id
  join public.assignments a on a.class_id = c.id and a.open_at <= now()
  left join lateral (
    select * from public.submissions s2
    where s2.assignment_id = a.id and s2.student_id = p_student_id
    order by (s2.status <> 'in_progress') desc, s2.score desc nulls last, s2.attempt_no desc
    limit 1
  ) s on true
  where cm.student_id = p_student_id
  order by a.due_at desc;
end;
$$;

-- ===== Làm bài =====
-- Bắt đầu (hoặc tiếp tục) một lượt làm bài
create or replace function public.start_attempt(p_assignment_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.assignments;
  v_sub public.submissions;
  v_used int;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if a.id is null or not private.is_class_member(a.class_id) then
    raise exception 'Không tìm thấy bài tập.';
  end if;
  if now() < a.open_at then
    raise exception 'Bài tập chưa mở.';
  end if;

  -- Lượt đang làm dở: còn giờ thì tiếp tục, hết giờ thì tự nộp
  select * into v_sub from public.submissions
  where assignment_id = a.id and student_id = auth.uid() and status = 'in_progress'
  order by attempt_no desc limit 1;
  if v_sub.id is not null then
    if a.time_limit_minutes is not null
       and now() > v_sub.started_at + make_interval(mins => a.time_limit_minutes + 1) then
      if a.type = 'quiz' then
        perform private.grade_quiz(v_sub.id);
      else
        update public.submissions
        set status = 'submitted',
            submitted_at = v_sub.started_at + make_interval(mins => a.time_limit_minutes),
            is_late = v_sub.started_at + make_interval(mins => a.time_limit_minutes) > a.due_at
        where id = v_sub.id;
      end if;
    else
      return v_sub;
    end if;
  end if;

  if now() > a.due_at and not a.allow_late then
    raise exception 'Đã hết hạn nộp bài.';
  end if;

  select count(*) into v_used from public.submissions
  where assignment_id = a.id and student_id = auth.uid();
  if v_used >= a.max_attempts then
    raise exception 'Bạn đã dùng hết số lần làm bài.';
  end if;

  insert into public.submissions (assignment_id, student_id, attempt_no)
  values (a.id, auth.uid(), v_used + 1)
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Lấy đề trắc nghiệm cho học sinh (không có đáp án đúng) + câu đã chọn
create or replace function public.get_quiz(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  a public.assignments;
begin
  select * into v_sub from public.submissions where id = p_submission_id and student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  select * into a from public.assignments where id = v_sub.assignment_id;

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'assignment_id', a.id,
    'title', a.title,
    'description', a.description,
    'shuffle', a.shuffle,
    'time_limit_minutes', a.time_limit_minutes,
    'started_at', v_sub.started_at,
    'deadline', case when a.time_limit_minutes is null then null
                     else v_sub.started_at + make_interval(mins => a.time_limit_minutes) end,
    'status', v_sub.status,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'content', q.content,
        'points', q.points,
        'multiple_correct', q.multiple_correct,
        'selected_choice_ids', coalesce((select to_jsonb(an.selected_choice_ids) from public.answers an
                                         where an.submission_id = v_sub.id and an.question_id = q.id), '[]'::jsonb),
        'choices', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content)
                                              order by c.order_index)
                             from public.choices c where c.question_id = q.id), '[]'::jsonb)
      ) order by q.order_index)
      from public.questions q where q.assignment_id = a.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.submit_quiz(p_submission_id uuid)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
begin
  select s.* into v_sub from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id and s.student_id = auth.uid() and a.type = 'quiz';
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  if v_sub.status <> 'in_progress' then
    raise exception 'Bài này đã nộp rồi.';
  end if;
  perform private.grade_quiz(v_sub.id);
  select * into v_sub from public.submissions where id = p_submission_id;
  return v_sub;
end;
$$;

-- Lưu nháp bài tự luận
create or replace function public.save_essay(p_submission_id uuid, p_essay_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_my_open_submission(p_submission_id) then
    raise exception 'Bài làm không còn chỉnh sửa được.';
  end if;
  update public.submissions set essay_text = p_essay_text where id = p_submission_id;
end;
$$;

create or replace function public.submit_essay(p_submission_id uuid, p_essay_text text default null)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_due timestamptz;
begin
  select s.* into v_sub
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id and s.student_id = auth.uid() and a.type = 'essay';
  select due_at into v_due from public.assignments where id = v_sub.assignment_id;
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  if v_sub.status <> 'in_progress' then
    raise exception 'Bài này đã nộp rồi.';
  end if;

  update public.submissions
  set essay_text = coalesce(p_essay_text, essay_text),
      status = 'submitted',
      submitted_at = now(),
      is_late = now() > v_due
  where id = p_submission_id
  returning * into v_sub;
  return v_sub;
end;
$$;

-- Xem lại đáp án: giáo viên luôn xem được; học sinh theo cài đặt show_answers
create or replace function public.get_quiz_review(p_submission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  a public.assignments;
  v_allowed boolean;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  select * into a from public.assignments where id = v_sub.assignment_id;

  v_allowed := private.is_class_teacher(a.class_id)
    or (v_sub.student_id = auth.uid()
        and v_sub.status <> 'in_progress'
        and (a.show_answers = 'after_submit'
             or (a.show_answers = 'after_due' and now() > a.due_at)));
  if not v_allowed then
    raise exception 'Chưa đến lúc xem đáp án.';
  end if;

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'score', v_sub.score,
    'max_score', v_sub.max_score,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'content', q.content,
        'points', q.points,
        'selected_choice_ids', coalesce((select to_jsonb(an.selected_choice_ids) from public.answers an
                                         where an.submission_id = v_sub.id and an.question_id = q.id), '[]'::jsonb),
        'choices', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content, 'is_correct', c.is_correct)
                                              order by c.order_index)
                             from public.choices c where c.question_id = q.id), '[]'::jsonb)
      ) order by q.order_index)
      from public.questions q where q.assignment_id = a.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Chỉ người đã đăng nhập gọi được các RPC
revoke execute on function public.join_class(text) from public, anon;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;
revoke execute on function public.regenerate_parent_code(uuid) from public, anon;
revoke execute on function public.link_parent(text) from public, anon;
revoke execute on function public.parent_children() from public, anon;
revoke execute on function public.parent_child_assignments(uuid) from public, anon;
revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.get_quiz(uuid) from public, anon;
revoke execute on function public.submit_quiz(uuid) from public, anon;
revoke execute on function public.save_essay(uuid, text) from public, anon;
revoke execute on function public.submit_essay(uuid, text) from public, anon;
revoke execute on function public.get_quiz_review(uuid) from public, anon;

grant execute on function public.join_class(text) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.regenerate_parent_code(uuid) to authenticated;
grant execute on function public.link_parent(text) to authenticated;
grant execute on function public.parent_children() to authenticated;
grant execute on function public.parent_child_assignments(uuid) to authenticated;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.get_quiz(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid) to authenticated;
grant execute on function public.save_essay(uuid, text) to authenticated;
grant execute on function public.submit_essay(uuid, text) to authenticated;
grant execute on function public.get_quiz_review(uuid) to authenticated;

-- ===== Storage: bucket riêng tư cho file nộp bài =====
-- Đường dẫn: {assignment_id}/{student_id}/{submission_id}/{tên file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 10485760,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create or replace function private.submission_id_from_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 3)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.path_matches_submission(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    where s.id = private.submission_id_from_path(p_name)
      and split_part(p_name, '/', 1) = s.assignment_id::text
      and split_part(p_name, '/', 2) = s.student_id::text
  )
$$;

create policy "submissions bucket: học sinh tải lên" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and private.path_matches_submission(name)
    and private.is_my_open_submission(private.submission_id_from_path(name))
  );

create policy "submissions bucket: xem" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and private.can_view_submission(private.submission_id_from_path(name))
  );

create policy "submissions bucket: học sinh xoá khi chưa nộp" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and private.is_my_open_submission(private.submission_id_from_path(name))
  );
