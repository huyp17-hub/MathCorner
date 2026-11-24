-- 0007_tsa_rpc.sql — làm bài theo từng phần, tạm dừng, chấm TSA (đúng hết mới có điểm), kéo thả

-- ===== Chấm điểm =====
create or replace function private.grade_quiz(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment uuid;
  v_due timestamptz;
  v_fmt public.exam_format;
  q record;
  an public.answers;
  v_pts numeric;
  v_n int;
  v_k int;
  v_score numeric := 0;
  v_max numeric := 0;
begin
  select s.assignment_id, a.due_at, a.exam_format into v_assignment, v_due, v_fmt
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
        if v_fmt = 'tsa' then
          if v_n > 0 and v_k = v_n then v_pts := q.points; end if;          -- TSA: đúng hết mới có điểm
        elsif v_n = 4 then
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

      elsif q.kind = 'drag_drop' then
        select count(*),
               count(*) filter (where an.blank_answers ->> c.blank_no::text = c.id::text)
        into v_n, v_k
        from public.choices c where c.question_id = q.id and c.blank_no is not null;
        if v_n > 0 and v_k = v_n then v_pts := q.points; end if;
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
      graded_at = now(),
      paused_at = null
  where id = p_submission_id;

  update public.submission_sections
  set finished_at = coalesce(finished_at, now())
  where submission_id = p_submission_id;
end;
$$;

-- Đóng các phần đã hết giờ; nếu mọi phần đều xong thì chấm bài
create or replace function private.close_expired_sections(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_total int;
  v_done int;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if v_sub.id is null or v_sub.status <> 'in_progress' or v_sub.paused_at is not null then
    return;
  end if;

  update public.submission_sections ss
  set finished_at = ss.started_at + make_interval(mins => es.time_limit_minutes, secs => ss.paused_seconds)
  from public.exam_sections es
  where es.id = ss.section_id and ss.submission_id = p_submission_id and ss.finished_at is null
    and es.time_limit_minutes is not null
    and now() > ss.started_at + make_interval(mins => es.time_limit_minutes + 1, secs => ss.paused_seconds);

  select count(*) into v_total from public.exam_sections where assignment_id = v_sub.assignment_id;
  select count(*) into v_done from public.submission_sections
  where submission_id = p_submission_id and finished_at is not null;
  if v_total > 0 and v_done >= v_total then
    perform private.grade_quiz(p_submission_id);
  end if;
end;
$$;

-- ===== Bắt đầu / tiếp tục lượt làm =====
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

  select * into v_sub from public.submissions
  where assignment_id = a.id and student_id = auth.uid() and status = 'in_progress'
  order by attempt_no desc limit 1;

  if v_sub.id is not null then
    perform private.close_expired_sections(v_sub.id);
    select * into v_sub from public.submissions where id = v_sub.id;

    if v_sub.status = 'in_progress' then
      if a.time_limit_minutes is not null and v_sub.paused_at is null
         and now() > v_sub.started_at + make_interval(mins => a.time_limit_minutes + 1, secs => v_sub.paused_seconds) then
        if a.type = 'quiz' then
          perform private.grade_quiz(v_sub.id);
        else
          update public.submissions
          set status = 'submitted',
              submitted_at = v_sub.started_at + make_interval(mins => a.time_limit_minutes, secs => v_sub.paused_seconds),
              is_late = v_sub.started_at + make_interval(mins => a.time_limit_minutes, secs => v_sub.paused_seconds) > a.due_at
          where id = v_sub.id;
        end if;
      else
        return v_sub;
      end if;
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

-- ===== Đề cho học sinh =====
-- Đề có phần thi: chỉ trả câu hỏi + đoạn văn của phần đang làm. Không bao giờ trả đáp án.
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
  v_has_sections boolean;
  v_active uuid;
  v_sections jsonb := '[]'::jsonb;
  v_questions jsonb;
  v_groups jsonb;
begin
  select * into v_sub from public.submissions where id = p_submission_id and student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  select * into a from public.assignments where id = v_sub.assignment_id;

  v_has_sections := exists (select 1 from public.exam_sections where assignment_id = a.id);

  if v_has_sections then
    select ss.section_id into v_active
    from public.submission_sections ss
    where ss.submission_id = v_sub.id and ss.finished_at is null
    limit 1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', es.id,
      'title', es.title,
      'order_index', es.order_index,
      'time_limit_minutes', es.time_limit_minutes,
      'question_count', (select count(*) from public.questions q where q.section_id = es.id),
      'status', case when ss.section_id is null then 'not_started'
                     when ss.finished_at is null then 'active' else 'finished' end,
      'started_at', ss.started_at,
      'deadline', case when ss.section_id is not null and es.time_limit_minutes is not null
                       then ss.started_at + make_interval(mins => es.time_limit_minutes, secs => ss.paused_seconds) end
    ) order by es.order_index), '[]'::jsonb)
    into v_sections
    from public.exam_sections es
    left join public.submission_sections ss on ss.section_id = es.id and ss.submission_id = v_sub.id
    where es.assignment_id = a.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id,
      'kind', q.kind,
      'content', q.content,
      'points', q.points,
      'multiple_correct', q.multiple_correct,
      'section_id', q.section_id,
      'group_id', q.group_id,
      'selected_choice_ids', coalesce(to_jsonb(an.selected_choice_ids), '[]'::jsonb),
      'tf_answers', coalesce(an.tf_answers, '{}'::jsonb),
      'text_answer', an.text_answer,
      'blank_answers', coalesce(an.blank_answers, '{}'::jsonb),
      'flagged', coalesce(an.flagged, false),
      'time_spent_seconds', coalesce(an.time_spent_seconds, 0),
      'choices', case when q.kind = 'short_answer' then '[]'::jsonb else coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content) order by c.order_index)
          from public.choices c where c.question_id = q.id), '[]'::jsonb) end
    ) order by q.order_index), '[]'::jsonb)
  into v_questions
  from public.questions q
  left join public.answers an on an.submission_id = v_sub.id and an.question_id = q.id
  where q.assignment_id = a.id
    and (not v_has_sections or q.section_id = v_active);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'title', g.title, 'content', g.content, 'order_index', g.order_index
    ) order by g.order_index), '[]'::jsonb)
  into v_groups
  from public.question_groups g
  where g.id in (
    select q.group_id from public.questions q
    where q.assignment_id = a.id and q.group_id is not null
      and (not v_has_sections or q.section_id = v_active)
  );

  return jsonb_build_object(
    'submission_id', v_sub.id,
    'assignment_id', a.id,
    'title', a.title,
    'description', a.description,
    'exam_format', a.exam_format,
    'shuffle', a.shuffle,
    'allow_pause', a.allow_pause,
    'paused', v_sub.paused_at is not null,
    'server_now', now(),
    'time_limit_minutes', a.time_limit_minutes,
    'started_at', v_sub.started_at,
    'deadline', case when a.time_limit_minutes is null then null
                     else v_sub.started_at + make_interval(mins => a.time_limit_minutes, secs => v_sub.paused_seconds) end,
    'status', v_sub.status,
    'score', case when v_sub.status = 'graded' then v_sub.score end,
    'max_score', case when v_sub.status = 'graded' then v_sub.max_score end,
    'sections', v_sections,
    'active_section_id', v_active,
    'groups', v_groups,
    'questions', v_questions
  );
end;
$$;

-- ===== Phần thi =====
create or replace function public.start_section(p_submission_id uuid, p_section_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_sec public.exam_sections;
  v_row public.submission_sections;
begin
  select * into v_sub from public.submissions where id = p_submission_id and student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;

  perform private.close_expired_sections(v_sub.id);
  select * into v_sub from public.submissions where id = p_submission_id;
  if v_sub.status <> 'in_progress' then
    return public.get_quiz(v_sub.id);
  end if;
  if v_sub.paused_at is not null then
    raise exception 'Bài đang tạm dừng.';
  end if;

  select * into v_sec from public.exam_sections where id = p_section_id and assignment_id = v_sub.assignment_id;
  if v_sec.id is null then
    raise exception 'Không tìm thấy phần thi.';
  end if;

  select * into v_row from public.submission_sections
  where submission_id = v_sub.id and section_id = v_sec.id;
  if v_row.section_id is not null then
    if v_row.finished_at is not null then
      raise exception 'Phần thi này đã kết thúc.';
    end if;
    return public.get_quiz(v_sub.id);
  end if;

  if exists (select 1 from public.submission_sections where submission_id = v_sub.id and finished_at is null) then
    raise exception 'Hãy nộp phần đang làm trước khi sang phần khác.';
  end if;

  if exists (
    select 1 from public.exam_sections es
    where es.assignment_id = v_sub.assignment_id and es.order_index < v_sec.order_index
      and not exists (select 1 from public.submission_sections ss
                      where ss.submission_id = v_sub.id and ss.section_id = es.id and ss.finished_at is not null)
  ) then
    raise exception 'Hãy làm lần lượt từng phần thi.';
  end if;

  insert into public.submission_sections (submission_id, section_id) values (v_sub.id, v_sec.id);
  return public.get_quiz(v_sub.id);
end;
$$;

create or replace function public.finish_section(p_submission_id uuid, p_section_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
begin
  select * into v_sub from public.submissions where id = p_submission_id and student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  if v_sub.status <> 'in_progress' then
    return public.get_quiz(v_sub.id);
  end if;
  if v_sub.paused_at is not null then
    raise exception 'Bài đang tạm dừng.';
  end if;
  if not exists (select 1 from public.submission_sections
                 where submission_id = v_sub.id and section_id = p_section_id) then
    raise exception 'Phần thi này chưa bắt đầu.';
  end if;

  update public.submission_sections set finished_at = now()
  where submission_id = v_sub.id and section_id = p_section_id and finished_at is null;

  perform private.close_expired_sections(v_sub.id);   -- chấm bài nếu đã xong mọi phần
  return public.get_quiz(v_sub.id);
end;
$$;

-- ===== Tạm dừng (chỉ khi giáo viên bật allow_pause) =====
create or replace function public.pause_attempt(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_allow boolean;
begin
  select s.* into v_sub from public.submissions s where s.id = p_submission_id and s.student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  select allow_pause into v_allow from public.assignments where id = v_sub.assignment_id;
  if not v_allow then
    raise exception 'Bài này không cho phép tạm dừng.';
  end if;
  if v_sub.status <> 'in_progress' then
    raise exception 'Bài đã nộp.';
  end if;
  perform private.close_expired_sections(v_sub.id);
  update public.submissions set paused_at = now()
  where id = v_sub.id and paused_at is null and status = 'in_progress';
  return public.get_quiz(v_sub.id);
end;
$$;

create or replace function public.resume_attempt(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_secs int;
begin
  select * into v_sub from public.submissions where id = p_submission_id and student_id = auth.uid();
  if v_sub.id is null then
    raise exception 'Không tìm thấy bài làm.';
  end if;
  if v_sub.paused_at is not null then
    v_secs := greatest(0, extract(epoch from now() - v_sub.paused_at))::int;
    update public.submissions
    set paused_seconds = paused_seconds + v_secs, paused_at = null
    where id = v_sub.id;
    update public.submission_sections
    set paused_seconds = paused_seconds + v_secs
    where submission_id = v_sub.id and finished_at is null;
  end if;
  return public.get_quiz(v_sub.id);
end;
$$;

-- ===== Xem lại: đáp án, lời giải, điểm từng câu và từng phần =====
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
    'title', a.title,
    'exam_format', a.exam_format,
    'score', v_sub.score,
    'max_score', v_sub.max_score,
    'started_at', v_sub.started_at,
    'submitted_at', v_sub.submitted_at,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', es.id,
        'title', es.title,
        'order_index', es.order_index,
        'max_score', (select coalesce(sum(q.points), 0) from public.questions q where q.section_id = es.id),
        'score', (select coalesce(sum(an.points_awarded), 0) from public.answers an
                  join public.questions q on q.id = an.question_id
                  where an.submission_id = v_sub.id and q.section_id = es.id),
        'started_at', ss.started_at,
        'finished_at', ss.finished_at
      ) order by es.order_index)
      from public.exam_sections es
      left join public.submission_sections ss on ss.section_id = es.id and ss.submission_id = v_sub.id
      where es.assignment_id = a.id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'content', g.content,
                                          'section_id', g.section_id, 'order_index', g.order_index)
                       order by g.order_index)
      from public.question_groups g where g.assignment_id = a.id
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'kind', q.kind,
        'content', q.content,
        'points', q.points,
        'section_id', q.section_id,
        'group_id', q.group_id,
        'points_awarded', an.points_awarded,
        'flagged', coalesce(an.flagged, false),
        'time_spent_seconds', coalesce(an.time_spent_seconds, 0),
        'selected_choice_ids', coalesce(to_jsonb(an.selected_choice_ids), '[]'::jsonb),
        'tf_answers', coalesce(an.tf_answers, '{}'::jsonb),
        'text_answer', an.text_answer,
        'blank_answers', coalesce(an.blank_answers, '{}'::jsonb),
        'accepted_answers', case when q.kind = 'short_answer' then coalesce((
            select jsonb_agg(k.answer) from public.question_answer_keys k where k.question_id = q.id), '[]'::jsonb)
          else null end,
        'explanation', (select sol.explanation from public.question_solutions sol where sol.question_id = q.id),
        'choices', coalesce((
            select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content,
                                                'is_correct', c.is_correct, 'blank_no', c.blank_no)
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

revoke execute on function public.start_section(uuid, uuid) from public, anon;
revoke execute on function public.finish_section(uuid, uuid) from public, anon;
revoke execute on function public.pause_attempt(uuid) from public, anon;
revoke execute on function public.resume_attempt(uuid) from public, anon;
grant execute on function public.start_section(uuid, uuid) to authenticated;
grant execute on function public.finish_section(uuid, uuid) to authenticated;
grant execute on function public.pause_attempt(uuid) to authenticated;
grant execute on function public.resume_attempt(uuid) to authenticated;
