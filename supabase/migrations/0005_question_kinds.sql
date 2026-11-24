-- 0005_question_kinds.sql — thêm câu Đúng/Sai và Trả lời ngắn
--
-- questions.kind:
--   multiple_choice : như cũ, đáp án trong choices (is_correct), multiple_correct = chọn nhiều
--   true_false      : các ý a, b, c, d… lưu trong choices (content = mệnh đề, is_correct = mệnh đề đúng)
--   short_answer    : đáp án chấp nhận lưu trong question_answer_keys (chỉ giáo viên đọc)
--
-- Chấm điểm:
--   true_false có đúng 4 ý: thang THPT — đúng 1 ý 10%, 2 ý 25%, 3 ý 50%, 4 ý 100% điểm câu
--   true_false số ý khác 4: mỗi ý đúng được (điểm câu / số ý)
--   short_answer: so khớp sau khi chuẩn hoá (bỏ khoảng trắng thừa, không phân biệt hoa thường,
--                 số thì 0,5 = 0.5 = .50)

create type public.question_kind as enum ('multiple_choice', 'true_false', 'short_answer');

alter table public.questions
  add column kind public.question_kind not null default 'multiple_choice';

alter table public.answers
  add column tf_answers jsonb,          -- { "<choice_id>": true|false, ... }
  add column text_answer text,
  add column points_awarded numeric;

create table public.question_answer_keys (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  answer text not null
);
create index on public.question_answer_keys (question_id);

alter table public.question_answer_keys enable row level security;
revoke all on public.question_answer_keys from anon;
create policy "answer keys: giáo viên" on public.question_answer_keys
  for all to authenticated
  using (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))))
  with check (exists (select 1 from public.questions q
                 where q.id = question_id and private.is_class_teacher(private.assignment_class(q.assignment_id))));

-- Chuẩn hoá câu trả lời ngắn
create or replace function private.norm_answer(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := lower(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')));
begin
  if t ~ '^[-+]?(\d+([.,]\d*)?|[.,]\d+)$' then
    return trim_scale(replace(t, ',', '.')::numeric)::text;
  end if;
  return t;
end;
$$;

-- Chấm lại toàn bộ bài (thay bản cũ)
create or replace function private.grade_quiz(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment uuid;
  v_due timestamptz;
  q record;
  an public.answers;
  v_pts numeric;
  v_n int;
  v_k int;
  v_score numeric := 0;
  v_max numeric := 0;
begin
  select s.assignment_id, a.due_at into v_assignment, v_due
  from public.submissions s join public.assignments a on a.id = s.assignment_id
  where s.id = p_submission_id;

  for q in select * from public.questions where assignment_id = v_assignment loop
    v_max := v_max + q.points;
    select * into an from public.answers where submission_id = p_submission_id and question_id = q.id;
    v_pts := 0;

    if an.id is not null then
      if q.kind = 'multiple_choice' then
        if (select array_agg(c.id order by c.id) from public.choices c where c.question_id = q.id and c.is_correct)
           = (select array_agg(x order by x) from (select distinct unnest(an.selected_choice_ids) as x) t)
        then
          v_pts := q.points;
        end if;

      elsif q.kind = 'true_false' then
        select count(*),
               count(*) filter (where an.tf_answers ? c.id::text
                                  and (an.tf_answers ->> c.id::text)::boolean = c.is_correct)
        into v_n, v_k
        from public.choices c where c.question_id = q.id;
        if v_n = 4 then
          v_pts := q.points * case v_k when 4 then 1 when 3 then 0.5 when 2 then 0.25 when 1 then 0.1 else 0 end;
        elsif v_n > 0 then
          v_pts := round(q.points * v_k / v_n, 4);
        end if;

      elsif q.kind = 'short_answer' then
        if nullif(btrim(coalesce(an.text_answer, '')), '') is not null and exists (
          select 1 from public.question_answer_keys k
          where k.question_id = q.id and private.norm_answer(k.answer) = private.norm_answer(an.text_answer)
        ) then
          v_pts := q.points;
        end if;
      end if;

      update public.answers set points_awarded = v_pts where id = an.id;
    end if;

    v_score := v_score + v_pts;
  end loop;

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

-- Đề cho học sinh: có kind, không có đáp án; trả kèm câu trả lời đã lưu
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
        'kind', q.kind,
        'content', q.content,
        'points', q.points,
        'multiple_correct', q.multiple_correct,
        'selected_choice_ids', coalesce(to_jsonb(an.selected_choice_ids), '[]'::jsonb),
        'tf_answers', coalesce(an.tf_answers, '{}'::jsonb),
        'text_answer', an.text_answer,
        'choices', case when q.kind = 'short_answer' then '[]'::jsonb else coalesce((
            select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content) order by c.order_index)
            from public.choices c where c.question_id = q.id), '[]'::jsonb) end
      ) order by q.order_index)
      from public.questions q
      left join public.answers an on an.submission_id = v_sub.id and an.question_id = q.id
      where q.assignment_id = a.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Xem lại: thêm đáp án đúng/sai, đáp án trả lời ngắn và điểm từng câu
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
        'kind', q.kind,
        'content', q.content,
        'points', q.points,
        'points_awarded', an.points_awarded,
        'selected_choice_ids', coalesce(to_jsonb(an.selected_choice_ids), '[]'::jsonb),
        'tf_answers', coalesce(an.tf_answers, '{}'::jsonb),
        'text_answer', an.text_answer,
        'accepted_answers', case when q.kind = 'short_answer' then coalesce((
            select jsonb_agg(k.answer) from public.question_answer_keys k where k.question_id = q.id), '[]'::jsonb)
          else null end,
        'choices', coalesce((
            select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content, 'is_correct', c.is_correct)
                             order by c.order_index)
            from public.choices c where c.question_id = q.id), '[]'::jsonb)
      ) order by q.order_index)
      from public.questions q
      left join public.answers an on an.submission_id = v_sub.id and an.question_id = q.id
      where q.assignment_id = a.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Học sinh không được tự ghi điểm từng câu
revoke insert, update on public.answers from authenticated;
grant insert (submission_id, question_id, selected_choice_ids, tf_answers, text_answer) on public.answers to authenticated;
grant update (selected_choice_ids, tf_answers, text_answer) on public.answers to authenticated;
