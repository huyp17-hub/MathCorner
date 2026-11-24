-- 0001_schema.sql — bảng, kiểu dữ liệu, hàm trợ giúp, trigger tạo profile

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ===== Kiểu dữ liệu =====
create type public.user_role as enum ('teacher', 'student', 'parent');
create type public.assignment_type as enum ('quiz', 'essay');
create type public.show_answers_mode as enum ('after_submit', 'after_due', 'never');
create type public.submission_status as enum ('in_progress', 'submitted', 'graded');
create type public.attendance_status as enum ('present', 'excused', 'absent', 'late');

-- ===== Sinh mã ngẫu nhiên (bỏ các ký tự dễ nhầm 0/O, 1/I/L) =====
create or replace function private.gen_code(len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
  i int;
begin
  for i in 0 .. len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- ===== Bảng =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null,
  student_code text,
  phone text,
  created_at timestamptz not null default now()
);

-- Mã phụ huynh để riêng một bảng để kiểm soát ai được đọc
create table public.student_parent_codes (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique default private.gen_code(8),
  updated_at timestamptz not null default now()
);

create table public.parent_links (
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index on public.parent_links (student_id);

create table public.parent_link_attempts (
  id bigint generated always as identity primary key,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index on public.parent_link_attempts (parent_id, attempted_at);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  subject text,
  school_year text,
  join_code text not null unique default private.gen_code(6),
  created_at timestamptz not null default now()
);
create index on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index on public.class_members (student_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  description text,
  type public.assignment_type not null,
  open_at timestamptz not null default now(),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  time_limit_minutes int check (time_limit_minutes is null or time_limit_minutes > 0),
  max_attempts int not null default 1 check (max_attempts > 0),
  shuffle boolean not null default false,
  show_answers public.show_answers_mode not null default 'after_due',
  created_at timestamptz not null default now(),
  check (due_at > open_at)
);
create index on public.assignments (class_id, due_at);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  order_index int not null default 0,
  content text not null,
  points numeric not null default 1 check (points >= 0),
  multiple_correct boolean not null default false
);
create index on public.questions (assignment_id, order_index);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  order_index int not null default 0,
  content text not null,
  is_correct boolean not null default false
);
create index on public.choices (question_id, order_index);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  attempt_no int not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status public.submission_status not null default 'in_progress',
  is_late boolean not null default false,
  score numeric,
  max_score numeric,
  teacher_comment text,
  essay_text text,
  graded_at timestamptz,
  unique (assignment_id, student_id, attempt_no)
);
create index on public.submissions (student_id);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  selected_choice_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);
create index on public.answers (question_id);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  size bigint not null check (size >= 0 and size <= 10485760),
  created_at timestamptz not null default now()
);
create index on public.submission_files (submission_id);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  date date not null,
  period text,
  note text,
  created_at timestamptz not null default now()
);
create index on public.class_sessions (class_id, date);

create table public.attendance (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  updated_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
create index on public.attendance (student_id);

-- ===== Hàm kiểm tra quyền (security definer để tránh RLS đệ quy) =====
create or replace function private.my_role()
returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function private.is_class_teacher(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.classes where id = p_class_id and teacher_id = auth.uid()) $$;

create or replace function private.is_class_member(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.class_members where class_id = p_class_id and student_id = auth.uid()) $$;

create or replace function private.is_parent_of(p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.parent_links where parent_id = auth.uid() and student_id = p_student_id) $$;

create or replace function private.is_parent_in_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.parent_links pl
    join public.class_members cm on cm.student_id = pl.student_id
    where pl.parent_id = auth.uid() and cm.class_id = p_class_id
  )
$$;

create or replace function private.is_teacher_of_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    where cm.student_id = p_student_id and c.teacher_id = auth.uid()
  )
$$;

create or replace function private.assignment_class(p_assignment_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select class_id from public.assignments where id = p_assignment_id $$;

create or replace function private.session_class(p_session_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$ select class_id from public.class_sessions where id = p_session_id $$;

-- Học sinh/giáo viên có được xem hồ sơ người này không
create or replace function private.can_view_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_id = auth.uid()
    or private.is_teacher_of_student(p_id)
    or private.is_parent_of(p_id)
    -- giáo viên xem phụ huynh của học sinh mình
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = p_id and private.is_teacher_of_student(pl.student_id)
    )
    -- học sinh / phụ huynh xem giáo viên của lớp liên quan
    or exists (
      select 1 from public.classes c
      where c.teacher_id = p_id
        and (private.is_class_member(c.id) or private.is_parent_in_class(c.id))
    )
$$;

-- Bài làm có thuộc về học sinh hiện tại và còn đang làm (chưa hết giờ) không
create or replace function private.is_my_open_submission(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission_id
      and s.student_id = auth.uid()
      and s.status = 'in_progress'
      and (a.time_limit_minutes is null
           or now() <= s.started_at + make_interval(mins => a.time_limit_minutes + 1))
  )
$$;

create or replace function private.can_view_submission(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    join public.assignments a on a.id = s.assignment_id
    where s.id = p_submission_id
      and (s.student_id = auth.uid() or private.is_class_teacher(a.class_id))
  )
$$;

-- ===== Trigger tạo profile khi đăng ký =====
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := case new.raw_user_meta_data ->> 'role'
              when 'teacher' then 'teacher'::public.user_role
              when 'parent' then 'parent'::public.user_role
              else 'student'::public.user_role
            end;

  insert into public.profiles (id, full_name, role, student_code, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    v_role,
    nullif(new.raw_user_meta_data ->> 'student_code', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );

  if v_role = 'student' then
    insert into public.student_parent_codes (student_id) values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Tự cập nhật updated_at
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger answers_touch before update on public.answers
  for each row execute function private.touch_updated_at();
create trigger attendance_touch before update on public.attendance
  for each row execute function private.touch_updated_at();
