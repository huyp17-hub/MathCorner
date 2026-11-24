-- 0008_tuition.sql — đếm buổi học để tính học phí
--
-- Mỗi lớp chọn một cách tính:
--   package     : học sinh mua gói N buổi; mỗi buổi điểm danh có tính phí trừ 1; báo khi còn ≤ low_session_warning buổi
--   per_session : cuối tháng tính (số buổi có tính phí × đơn giá/buổi)
-- Buổi nào "có tính phí" do giáo viên chọn: mặc định Có mặt + Đi muộn (vắng không tính).

create type public.billing_mode as enum ('package', 'per_session');
create type public.payment_method as enum ('cash', 'transfer', 'other');

alter table public.classes
  add column billing_mode public.billing_mode not null default 'package',
  add column price_per_session numeric(12, 0) check (price_per_session is null or price_per_session >= 0),
  add column billable_statuses public.attendance_status[] not null default '{present,late}',
  add column low_session_warning int not null default 2 check (low_session_warning >= 0);

-- Gói buổi học đã mua
create table public.tuition_packages (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  sessions int not null check (sessions > 0),
  price numeric(12, 0) check (price is null or price >= 0),
  start_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create index on public.tuition_packages (class_id, student_id);
create index on public.tuition_packages (student_id);

-- Các lần thu tiền (giáo viên tự ghi lại, web không xử lý thanh toán)
create table public.tuition_payments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 0) not null check (amount > 0),
  paid_on date not null default current_date,
  method public.payment_method not null default 'cash',
  package_id uuid references public.tuition_packages (id) on delete set null,
  note text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index on public.tuition_payments (class_id, student_id, paid_on);
create index on public.tuition_payments (student_id);
create index on public.tuition_payments (package_id);
create index on public.tuition_payments (created_by);

alter table public.tuition_packages enable row level security;
alter table public.tuition_payments enable row level security;
revoke all on public.tuition_packages, public.tuition_payments from anon;

create policy "packages: xem" on public.tuition_packages
  for select to authenticated
  using (private.is_class_teacher(class_id) or student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy "packages: giáo viên ghi" on public.tuition_packages
  for all to authenticated
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id) and private.is_student_in_class(class_id, student_id));

create policy "payments: xem" on public.tuition_payments
  for select to authenticated
  using (private.is_class_teacher(class_id) or student_id = (select auth.uid()) or private.is_parent_of(student_id));
create policy "payments: giáo viên thêm" on public.tuition_payments
  for insert to authenticated
  with check (private.is_class_teacher(class_id) and private.is_student_in_class(class_id, student_id)
              and created_by = (select auth.uid()));
create policy "payments: giáo viên sửa" on public.tuition_payments
  for update to authenticated
  using (private.is_class_teacher(class_id))
  with check (private.is_class_teacher(class_id) and private.is_student_in_class(class_id, student_id));
create policy "payments: giáo viên xoá" on public.tuition_payments
  for delete to authenticated using (private.is_class_teacher(class_id));

-- Tổng hợp học phí theo lớp và tháng.
-- Giáo viên thấy cả lớp; học sinh thấy dòng của mình; phụ huynh thấy dòng của con.
create or replace function public.tuition_summary(p_class_id uuid, p_month date default current_date)
returns table (
  student_id uuid,
  full_name text,
  student_code text,
  billing_mode public.billing_mode,
  sessions_in_month int,        -- số buổi có tính phí trong tháng
  absent_in_month int,          -- số buổi vắng (không phép) trong tháng
  sessions_used_total int,      -- tổng buổi có tính phí (gói: tính từ ngày bắt đầu gói đầu tiên)
  sessions_purchased int,       -- tổng buổi đã mua (gói)
  sessions_remaining int,       -- còn lại (gói); âm = học vượt gói
  amount_due_month numeric,     -- theo buổi: số buổi tháng × đơn giá
  amount_total numeric,         -- tổng phải đóng từ trước tới nay (gói: tổng giá gói; theo buổi: tổng buổi × đơn giá)
  paid_month numeric,
  paid_total numeric,
  balance numeric,              -- còn nợ = amount_total − paid_total (âm = đóng dư)
  low_sessions boolean          -- gói sắp hết
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_class public.classes;
  v_from date := date_trunc('month', p_month)::date;
  v_to date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  select * into v_class from public.classes where id = p_class_id;
  if v_class.id is null then
    raise exception 'Không tìm thấy lớp.';
  end if;

  return query
  with members as (
    select cm.student_id as sid, p.full_name as fname, p.student_code as scode
    from public.class_members cm
    join public.profiles p on p.id = cm.student_id
    where cm.class_id = p_class_id
      and (private.is_class_teacher(p_class_id) or cm.student_id = auth.uid() or private.is_parent_of(cm.student_id))
  ),
  pk as (
    select tp.student_id as sid, sum(tp.sessions)::int as bought, sum(coalesce(tp.price, 0)) as bought_amount,
           min(tp.start_date) as first_start
    from public.tuition_packages tp
    where tp.class_id = p_class_id
    group by tp.student_id
  ),
  att as (
    select a.student_id as sid, s.date as d, a.status as st
    from public.attendance a
    join public.class_sessions s on s.id = a.session_id
    where s.class_id = p_class_id
  ),
  pay as (
    select py.student_id as sid,
           sum(py.amount) as total,
           sum(py.amount) filter (where py.paid_on >= v_from and py.paid_on < v_to) as month
    from public.tuition_payments py
    where py.class_id = p_class_id
    group by py.student_id
  ),
  calc as (
    select m.sid, m.fname, m.scode,
      (select count(*) from att where att.sid = m.sid and att.d >= v_from and att.d < v_to
         and att.st = any (v_class.billable_statuses))::int as in_month,
      (select count(*) from att where att.sid = m.sid and att.d >= v_from and att.d < v_to
         and att.st = 'absent')::int as absent_month,
      (select count(*) from att where att.sid = m.sid and att.st = any (v_class.billable_statuses)
         and (v_class.billing_mode = 'per_session' or pk.first_start is null or att.d >= pk.first_start))::int as used_total,
      coalesce(pk.bought, 0) as bought,
      coalesce(pk.bought_amount, 0) as bought_amount,
      coalesce(pay.total, 0) as paid_total,
      coalesce(pay.month, 0) as paid_month
    from members m
    left join pk on pk.sid = m.sid
    left join pay on pay.sid = m.sid
  )
  select c.sid, c.fname, c.scode, v_class.billing_mode,
    c.in_month,
    c.absent_month,
    c.used_total,
    case when v_class.billing_mode = 'package' then c.bought end,
    case when v_class.billing_mode = 'package' then c.bought - c.used_total end,
    case when v_class.billing_mode = 'per_session' then c.in_month * coalesce(v_class.price_per_session, 0) end,
    case when v_class.billing_mode = 'package' then c.bought_amount
         else c.used_total * coalesce(v_class.price_per_session, 0) end,
    c.paid_month,
    c.paid_total,
    (case when v_class.billing_mode = 'package' then c.bought_amount
          else c.used_total * coalesce(v_class.price_per_session, 0) end) - c.paid_total,
    v_class.billing_mode = 'package' and (c.bought - c.used_total) <= v_class.low_session_warning
  from calc c
  order by c.fname;
end;
$$;

revoke execute on function public.tuition_summary(uuid, date) from public, anon;
grant execute on function public.tuition_summary(uuid, date) to authenticated;
