# Little Math Corner

Web app quản lý lớp học dành cho giáo viên, học sinh và phụ huynh.

**Chức năng chính:**

- Giáo viên: quản lý lớp, tạo bài tập trắc nghiệm/tự luận, điểm danh, theo dõi học phí, bảng điểm, xuất Excel.
- Học sinh: vào lớp bằng mã, làm bài thi có đếm giờ và tự chấm, xem điểm, xem điểm danh, xem học phí.
- Phụ huynh: liên kết con bằng mã phụ huynh, theo dõi bài tập/điểm/điểm danh/học phí (chỉ xem).

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui (restyle) + Lucide icons |
| Routing | React Router v7 |
| Backend | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Xuất file | xlsx |
| Công thức Toán | react-markdown + remark-math + rehype-katex |
| Deploy | Vercel (frontend) + Supabase Cloud (backend) |

## Cài đặt local

### 1. Tạo project Supabase

Vào [supabase.com](https://supabase.com), tạo project mới (hoặc dùng project có sẵn).

### 2. Chạy migration

Chạy từng file SQL trong `supabase/migrations/` theo thứ tự trên Supabase SQL Editor:

```
0001_schema.sql
0002_rls.sql
0003_rpc_storage.sql
0004_fix_member_insert.sql
0005_question_kinds.sql
0006a_drag_drop_kind.sql
0006b_tsa_schema.sql
0007_tsa_rpc.sql
0008_tuition.sql
```

### 3. Cấu hình Supabase Auth

Trong Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `http://localhost:5173` (đổi thành URL Vercel khi deploy)
- **Redirect URLs:** thêm `http://localhost:5173/**`
- Tắt **Confirm email** khi đang phát triển (bật lại khi dùng thật + cấu hình Custom SMTP)

### 4. Tạo Storage bucket

Trong Supabase Dashboard → Storage:

- Tạo bucket **`submissions`** (private) — để học sinh nộp file bài tự luận
- Tạo bucket **`question-media`** (public) — để giáo viên upload ảnh câu hỏi

### 5. Deploy Edge Function (tạo tài khoản học sinh hàng loạt)

```bash
supabase functions deploy create-students --project-ref <project-id>
```

Hoặc tạo thủ công trong Supabase Dashboard → Edge Functions.

### 6. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env.local` và điền giá trị:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable anon key>
```

Lấy giá trị từ Supabase Dashboard → Settings → API.

**Quan trọng:** chỉ dùng **anon/publishable key** ở frontend. Không bao giờ đưa `service_role key` vào code frontend.

### 7. Chạy ứng dụng

```bash
npm install
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173).

### 8. (Tuỳ chọn) Chạy dữ liệu mẫu

Chạy `supabase/seed.sql` trên SQL Editor để tạo dữ liệu mẫu: 1 giáo viên, 5 học sinh, 2 phụ huynh, 1 lớp, bài tập và buổi điểm danh.

Mật khẩu mặc định của tất cả tài khoản mẫu: `123456`.

## Deploy lên Vercel

### 1. Push code lên GitHub/GitLab

### 2. Tạo project trên Vercel

- Import repository
- Framework: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

### 3. Thêm biến môi trường trên Vercel

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable anon key>
```

### 4. Cập nhật Supabase Auth URLs

Trong Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** thêm `https://<your-app>.vercel.app/**`

### 5. Deploy

Vercel tự deploy khi push code. Mở URL Vercel cung cấp.

## Tài khoản và vai trò

| Vai trò | Đăng nhập bằng | Ghi chú |
|---|---|---|
| Giáo viên | Email + mật khẩu | Tự đăng ký |
| Học sinh | Tên đăng nhập (VD `hs2401`) hoặc email + mật khẩu | Giáo viên tạo hàng loạt hoặc tự đăng ký + nhập mã lớp |
| Phụ huynh | Email + mật khẩu | Tự đăng ký + nhập mã phụ huynh |

## Cấu trúc thư mục

```
src/
  lib/           # Supabase client, types, API functions, utilities
  hooks/         # useAuth
  components/    # UI components (shadcn/ui restyle)
  pages/
    auth/        # Login, Register
    teacher/     # Dashboard, Classes, Assignments, Attendance, Tuition, Gradebook
    student/     # Dashboard, Classes, Assignments, TakeQuiz, Attendance, Tuition
    parent/      # Dashboard, LinkChild, Assignments, Attendance, Tuition
supabase/
  migrations/    # SQL migrations (0001–0008)
  seed.sql       # Sample data
```

## Scripts

```bash
npm run dev      # Dev server (port 5173)
npm run build    # Type-check + build
npm run lint     # ESLint
npm run preview  # Preview build
```
