-- 0004_fix_member_insert.sql — giáo viên thêm học sinh vào lớp (hồ sơ học sinh chưa hiện với GV khi chưa vào lớp)
create or replace function private.is_student(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = p_id and role = 'student') $$;

drop policy "members: giáo viên thêm" on public.class_members;
create policy "members: giáo viên thêm" on public.class_members
  for insert to authenticated
  with check (private.is_class_teacher(class_id) and private.is_student(student_id));
