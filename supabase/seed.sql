-- ============================================================================
-- seed.sql — Dữ liệu mẫu cho phát triển / chạy thử
-- 1 giáo viên, 1 lớp, 5 học sinh, 2 phụ huynh (1 người 2 con),
-- 2 bài tập, 3 buổi học + điểm danh, gói học phí và khoản đã đóng.
--
-- Cách chạy (một trong hai):
--   supabase db execute --file supabase/seed.sql            (CLI, trỏ vào project)
--   hoặc dán vào SQL Editor trên trang quản lý Supabase.
--
-- Mật khẩu mọi tài khoản: 123456 (CHỈ dùng để thử, đổi khi dùng thật).
-- Đăng nhập:
--   Giáo viên : co.lan@email.com
--   Học sinh  : hs2401 … hs2405 (tên đăng nhập, hệ thống tự thêm @hs.local)
--   Phụ huynh : bome.minh@email.com (con: An, Bình) · bome.hoa@email.com (con: Chi)
--
-- Idempotent: xoá sạch dữ liệu mẫu cũ (theo UUID cố định) rồi tạo lại.
-- ============================================================================

begin;

-- Xoá tài khoản mẫu cũ (cascade sẽ dọn profiles, class_members, attendance...).
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111', -- giáo viên
  'a0000000-0000-0000-0000-000000000001', -- hs An
  'a0000000-0000-0000-0000-000000000002', -- hs Bình
  'a0000000-0000-0000-0000-000000000003', -- hs Chi
  'a0000000-0000-0000-0000-000000000004', -- hs Dũng
  'a0000000-0000-0000-0000-000000000005', -- hs Em
  'b0000000-0000-0000-0000-000000000001', -- phụ huynh Minh
  'b0000000-0000-0000-0000-000000000002'  -- phụ huynh Hoa
);

-- ---------------------------------------------------------------------------
-- Tài khoản auth. Trigger on_auth_user_created tự tạo profiles + mã phụ huynh.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'co.lan@email.com',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"teacher","full_name":"Cô Lan","phone":"0901234567"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'hs2401@hs.local',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Nguyễn Văn An","student_code":"hs2401"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'hs2402@hs.local',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Trần Thị Bình","student_code":"hs2402"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'hs2403@hs.local',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Lê Văn Chi","student_code":"hs2403"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'hs2404@hs.local',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Phạm Thị Dung","student_code":"hs2404"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005',
   'authenticated', 'authenticated', 'hs2405@hs.local',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"student","full_name":"Đỗ Văn Em","student_code":"hs2405"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'bome.minh@email.com',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"parent","full_name":"Phụ huynh Minh","phone":"0912345678"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'bome.hoa@email.com',
   extensions.crypt('123456', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"role":"parent","full_name":"Phụ huynh Hoa","phone":"0987654321"}', now(), now());

-- QUAN TRỌNG: khi chèn auth.users thủ công, các cột token mặc định NULL khiến
-- Supabase Auth (GoTrue) báo "Database error querying schema" lúc đăng nhập.
-- Đặt chúng thành chuỗi rỗng.
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where id in (
  '11111111-1111-1111-1111-111111111111',
  'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002'
);

-- Identity email (một số luồng đăng nhập của Supabase cần bản ghi này).
insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.email, now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111',
  'a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002'
);

-- ---------------------------------------------------------------------------
-- Lớp học — tính học phí theo gói, cảnh báo khi còn ≤ 2 buổi.
-- ---------------------------------------------------------------------------
insert into public.classes (id, teacher_id, name, subject, school_year, join_code,
                            billing_mode, price_per_session, billable_statuses, low_session_warning)
values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Toán 9A', 'Toán', '2025-2026', 'TOAN9A',
        'package', 100000, array['present','late']::public.attendance_status[], 2);

-- Học sinh vào lớp
insert into public.class_members (class_id, student_id)
select 'c0000000-0000-0000-0000-000000000001', id
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid),
  ('a0000000-0000-0000-0000-000000000002'::uuid),
  ('a0000000-0000-0000-0000-000000000003'::uuid),
  ('a0000000-0000-0000-0000-000000000004'::uuid),
  ('a0000000-0000-0000-0000-000000000005'::uuid)
) as s(id);

-- ---------------------------------------------------------------------------
-- Liên kết phụ huynh ↔ con. Minh có 2 con (An, Bình); Hoa có 1 con (Chi).
-- ---------------------------------------------------------------------------
insert into public.parent_links (parent_id, student_id) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003');

-- ---------------------------------------------------------------------------
-- Buổi học + điểm danh (3 buổi trong tháng này).
-- ---------------------------------------------------------------------------
insert into public.class_sessions (id, class_id, date, period, note) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', date_trunc('month', now())::date + 2, 'Ca tối', 'Ôn tập chương 1'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', date_trunc('month', now())::date + 9, 'Ca tối', 'Kiểm tra 15 phút'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', date_trunc('month', now())::date + 16, 'Ca tối', null);

-- Buổi 1: tất cả có mặt trừ Em vắng không phép
insert into public.attendance (session_id, student_id, status) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'present'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'present'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'present'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'late'),
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'absent');
-- Buổi 2: Bình vắng có phép
insert into public.attendance (session_id, student_id, status) values
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'present'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'excused'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'present'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'present'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000005', 'present');
-- Buổi 3: đủ cả lớp
insert into public.attendance (session_id, student_id, status) values
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'present'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'present'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'present'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'present'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'present');

-- ---------------------------------------------------------------------------
-- Gói học phí: mỗi em 1 gói 12 buổi – 1.200.000đ; An đã đóng, Bình đóng một phần.
-- ---------------------------------------------------------------------------
insert into public.tuition_packages (class_id, student_id, sessions, price, start_date, note)
select 'c0000000-0000-0000-0000-000000000001', id, 12, 1200000, date_trunc('month', now())::date, 'Gói tháng này'
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid),
  ('a0000000-0000-0000-0000-000000000002'::uuid),
  ('a0000000-0000-0000-0000-000000000003'::uuid),
  ('a0000000-0000-0000-0000-000000000004'::uuid),
  ('a0000000-0000-0000-0000-000000000005'::uuid)
) as s(id);

insert into public.tuition_payments (class_id, student_id, amount, paid_on, method, note, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1200000, date_trunc('month', now())::date + 1, 'transfer', 'Đã đóng đủ gói', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 600000,  date_trunc('month', now())::date + 1, 'cash', 'Đóng trước một nửa', '11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Bài tập: 1 trắc nghiệm (sắp đến hạn) + 1 tự luận (đã quá hạn).
-- Câu hỏi sẽ được thêm ở bước 5.
-- ---------------------------------------------------------------------------
insert into public.assignments (id, class_id, title, description, type, open_at, due_at, allow_late, show_answers)
values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'Trắc nghiệm chương 1', 'Ôn tập các dạng cơ bản.', 'quiz',
   now() - interval '2 days', now() + interval '5 days', true, 'after_submit'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Bài tự luận: Giải bài toán thực tế', 'Trình bày lời giải đầy đủ, nộp ảnh hoặc PDF.', 'essay',
   now() - interval '10 days', now() - interval '1 day', false, 'never');

commit;
