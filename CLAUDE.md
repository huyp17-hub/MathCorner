# CLAUDE.md — Web Bài tập & Điểm danh cho học sinh ("Góc học", tên tạm)

> **Tóm tắt nhanh cho Claude Code**
> - Database Supabase **đã có sẵn và đã kiểm thử** (migration 0001–0008) — không tạo lại, chỉ thêm migration mới khi cần.
> - **Bản đầu** = đăng nhập + lớp + **điểm danh** + **học phí theo buổi** + **bài tập về nhà** + phụ huynh (bước 1–8). Luyện đề TSA, trang giới thiệu, AI chấm bài làm sau.
> - **Chức năng trước, trang trí sau** (xem mục "Nguyên tắc ưu tiên"). Ý tưởng trang trí nảy ra giữa chừng → ghi vào mục "Để sau".
> - Phong cách "Góc học ấm": nền kem, màu san hô, font Be Vietnam Pro, icon nét mảnh. Mẫu giao diện ở `design/` và mục "Mẫu giao diện tham khảo".
> - Làm từng bước trong "Thứ tự triển khai"; xong mỗi bước chạy `npm run build` + `npm run lint` và dừng lại cho người dùng duyệt.

## Mục tiêu dự án
Xây dựng một web app cho giáo viên quản lý lớp học:
- **Giao bài tập** có hạn nộp: trắc nghiệm tự chấm và tự luận / nộp file.
- **Điểm danh** theo từng buổi học (giáo viên tick danh sách, ưu tiên điện thoại).
- **Học phí theo số buổi**: theo gói N buổi hoặc theo đơn giá/buổi; giáo viên tự ghi nhận đã đóng tiền (web không thu tiền).
- Học sinh đăng nhập bằng link + tài khoản, làm bài, xem điểm của mình.
- **Phụ huynh** đăng nhập để theo dõi bài tập, điểm và điểm danh của con mình (chỉ xem).
- **Luyện đề TSA** (Đánh giá tư duy ĐH Bách khoa Hà Nội): phòng thi mô phỏng thi thật trên máy tính, nhiều phần thi có giờ riêng.
- Ứng dụng được deploy công khai (ai có link đều truy cập được), dữ liệu lưu trên Supabase.

Giao diện và toàn bộ nội dung hiển thị bằng **tiếng Việt**. Code, tên biến, tên bảng bằng tiếng Anh.

## Công nghệ
- **Frontend:** React + Vite + TypeScript
- **UI:** Tailwind CSS + **shadcn/ui** (bắt buộc cho component nền) + icon `lucide-react`
- **Hiệu ứng:** `motion` (`motion/react`) + component của **Animate UI** khi cần (xem mục "Thư viện hiệu ứng")
- **Routing:** React Router
- **Backend / DB / Auth / Storage:** Supabase (PostgreSQL, Supabase Auth, Supabase Storage, Row Level Security)
- **Form & validate:** react-hook-form + zod
- **Ngày giờ:** dayjs (múi giờ `Asia/Ho_Chi_Minh`)
- **Nội dung câu hỏi:** `react-markdown` + `remark-math` + `rehype-katex` (KaTeX) cho công thức Toán
- **Kéo thả:** `@dnd-kit/core`
- **Xuất file:** xuất CSV/Excel bảng điểm và điểm danh (thư viện `xlsx`)
- **Deploy:** Vercel (frontend), Supabase cloud (backend)

Không tự viết server riêng; mọi logic phân quyền dựa vào **RLS của Supabase**. Không bao giờ đưa `service_role key` vào code frontend.

## Vai trò người dùng
| Vai trò | Quyền |
|---|---|
| `teacher` | Tạo lớp, thêm học sinh, tạo bài tập, chấm bài, điểm danh, ghi nhận học phí, xem thống kê, xuất file |
| `student` | Xem lớp mình, làm/nộp bài, xem điểm, lịch sử điểm danh và số buổi học phí còn lại của chính mình |
| `parent` | Chỉ xem: bài tập, trạng thái nộp, điểm, nhận xét, điểm danh và học phí của (các) con đã liên kết |

- Giáo viên đăng ký bằng email/mật khẩu.
- Học sinh: giáo viên tạo tài khoản hàng loạt (nhập danh sách hoặc dán từ Excel), hoặc học sinh tự đăng ký rồi vào lớp bằng **mã lớp** (6 ký tự).
- Phụ huynh: tự đăng ký bằng email/mật khẩu, sau đó nhập **mã phụ huynh** của con để liên kết (xem mục Phụ huynh).
- Chi tiết đăng nhập: xem mục "Đăng nhập & tài khoản".

## Đăng nhập & tài khoản
| Vai trò | Đăng nhập bằng | Tài khoản do ai tạo |
|---|---|---|
| Giáo viên | Email + mật khẩu | Tự đăng ký |
| Phụ huynh | Email + mật khẩu | Tự đăng ký, rồi nhập mã phụ huynh |
| Học sinh | **Tên đăng nhập** (VD mã học sinh `hs2401`) + mật khẩu, hoặc email nếu có | Giáo viên tạo hàng loạt (Edge Function `create-students`), hoặc tự đăng ký rồi nhập mã lớp |

- Trang đăng nhập có **một ô "Email hoặc tên đăng nhập"** dùng chung cho 3 vai trò. Supabase bắt buộc email, nên tên đăng nhập được đổi thành email ẩn:
  ```ts
  const toEmail = (login: string) =>
    login.includes('@') ? login : `${login.trim().toLowerCase()}@hs.local`;
  await supabase.auth.signInWithPassword({ email: toEmail(login), password });
  ```
- Trang đăng ký: chọn "Tôi là giáo viên / phụ huynh / học sinh" → họ tên, email, mật khẩu → `signUp` với `options.data.role`.
- Sau khi đăng nhập: đọc `profiles.role` rồi chuyển tới `/teacher`, `/student` hoặc `/parent`; route của vai trò khác tự chuyển về đúng trang.
- **Quên mật khẩu:** người có email thật → `resetPasswordForEmail` (trang đặt mật khẩu mới `/reset-password`);
  học sinh dùng tên đăng nhập → giáo viên bấm "Đặt lại mật khẩu" trong danh sách lớp (qua Edge Function, tạo mật khẩu tạm).
- **Người dùng tự cấu hình trên trang quản lý Supabase** (Claude Code không tự làm được, chỉ nhắc trong README):
  Authentication → URL Configuration: *Site URL* = địa chỉ Vercel, thêm `http://localhost:5173/**` vào *Redirect URLs*;
  tắt *Confirm email* khi đang phát triển, bật lại khi dùng thật cùng **Custom SMTP** (Resend/Brevo) vì email có sẵn của Supabase giới hạn rất ít thư mỗi giờ.
- (Tuỳ chọn, nếu người dùng yêu cầu) mã mời giáo viên khi đăng ký để không phải ai cũng tự đăng ký làm giáo viên.

## Chức năng chi tiết

### 1. Quản lý lớp (giáo viên)
- Tạo / sửa / xoá lớp (tên lớp, môn, năm học).
- Mỗi lớp có mã tham gia ngẫu nhiên, có thể tạo lại mã.
- Danh sách học sinh: thêm, xoá, sửa họ tên, mã học sinh; nhập hàng loạt từ CSV.

### 2. Bài tập
Giáo viên tạo bài tập gồm: tiêu đề, mô tả, lớp, thời gian mở, **hạn nộp**, có cho nộp muộn không, loại bài:
- **Trắc nghiệm (quiz)**, theo cấu trúc đề THPT mới. Một đề có thể trộn cả 3 loại câu, giáo viên đặt điểm từng câu:
  - **Nhiều lựa chọn** (`multiple_choice`): 1 hoặc nhiều đáp án đúng; chọn đúng hết mới được điểm.
  - **Đúng/Sai** (`true_false`): một câu dẫn + các ý a, b, c, d; học sinh chọn Đúng hoặc Sai cho từng ý.
    Câu có 4 ý chấm theo thang THPT: đúng 1 ý = 10%, 2 ý = 25%, 3 ý = 50%, 4 ý = 100% điểm câu.
    Câu có số ý khác 4: mỗi ý đúng được (điểm câu / số ý).
  - **Trả lời ngắn** (`short_answer`): học sinh gõ đáp án (thường là một số). Giáo viên nhập một hoặc nhiều đáp án chấp nhận.
    So khớp không phân biệt hoa thường, bỏ khoảng trắng thừa; với số thì `0,5` = `0.5` = `0.50`.
  - Màn soạn đề có 3 nút thêm câu theo loại, kéo thả để đổi thứ tự, xem trước như học sinh thấy.
  - **Nhập đề từ Excel** (xem mục "Nhập câu hỏi từ Excel"), có bản xem trước và báo lỗi từng dòng trước khi lưu.
  - Tuỳ chọn: xáo trộn câu hỏi/đáp án, giới hạn thời gian làm bài (phút), số lần làm tối đa, hiện đáp án sau khi nộp hay sau hạn.
  - **Tự chấm điểm ngay** khi học sinh nộp. Việc chấm phải chạy phía server (Postgres function / Edge Function) để học sinh không xem được đáp án trong dữ liệu tải về.
- **Tự luận (essay):**
  - Học sinh gõ câu trả lời và/hoặc tải file lên (PDF, ảnh, DOCX; tối đa 10 MB/file) vào Supabase Storage.
  - Giáo viên chấm tay: nhập điểm + nhận xét.
- Trạng thái mỗi bài của học sinh: `Chưa làm` / `Đã nộp` / `Nộp muộn` / `Đã chấm`.
- Trang tổng quan bài tập cho giáo viên: danh sách bài bên trái (tiến độ nộp x/20), chi tiết bên phải: đã nộp / chưa nộp / nộp muộn / điểm TB,
  danh sách "Chờ chấm" có nút **Chấm**, biểu đồ phân bố điểm (xem mẫu "Bài tập về nhà (giáo viên)").

#### Trang Bài tập của học sinh (lấy ý tưởng bố cục từ một app học tập tham khảo, **không** lấy phong cách/nhân vật/logo của họ)
- **Dải chuỗi 7 ngày** ở đầu trang: mỗi ô một ngày (Hôm nay nổi bật); ngày có buổi học hiện trạng thái điểm danh, ngày có bài hiện đã nộp/chưa;
  ngày vắng ghi nhẹ "Vắng", không trách phạt; kèm số ngày liên tiếp (icon lửa).
- **Tab có số lượng:** "Cần làm (3) · Đã nộp (12) · Đã chấm (10)".
- **Khuôn thẻ bài cố định:** nhãn loại bài (icon + màu: Trắc nghiệm / Tự luận / Luyện TSA) · hạn nộp (chữ đỏ khi còn < 24 giờ) · tên bài ·
  thanh tiến độ · **một con số dễ hiểu duy nhất** ("6/10 câu") · trạng thái. Thẻ **sắp xếp theo hạn nộp gần nhất**.
- Không dùng hình chìm sau chữ; chữ trạng thái nhỏ phải đạt tương phản AA (không dùng cam nhạt trên nền trắng).
- Nút "Hỏi cô" trên thẻ bài: bản đầu chỉ mở cách liên hệ giáo viên (số điện thoại/Zalo do giáo viên nhập trong hồ sơ) — nhắn tin trong web để sau.

### 2b. Luyện đề TSA
Một bài tập trắc nghiệm có `exam_format = 'tsa'` và chia thành **phần thi** (`exam_sections`). Cấu trúc chuẩn (giáo viên tạo bằng nút "Tạo khung đề TSA"):

| Phần | Số câu | Thời gian | Điểm |
|---|---|---|---|
| Tư duy Toán học | 40 | 60 phút | 40 |
| Tư duy Đọc hiểu | 20 | 30 phút | 20 |
| Tư duy Khoa học/Giải quyết vấn đề | 40 | 60 phút | 40 |

- Mỗi câu 1 điểm, tổng 100. **Chấm kiểu TSA: chỉ có điểm khi đúng hết** (chọn đủ mọi phương án đúng, đúng mọi ý đúng/sai, điền đúng mọi ô kéo thả).
  Kết quả là điểm thô trên thang 100; ghi chú cho học sinh rằng điểm TSA chính thức được quy đổi bằng phương pháp khác (IRT) nên có thể chênh lệch.
- 4 dạng câu: nhiều lựa chọn (một hoặc nhiều đáp án), đúng/sai (một hoặc nhiều mệnh đề), trả lời ngắn (điền số/chữ), **kéo thả** (kéo phương án từ kho vào các ô trống `[[1]]`, `[[2]]` trong nội dung; có thể có phương án nhiễu).
- **Đoạn văn/dữ kiện dùng chung** (`question_groups`): nhiều câu cùng một đoạn văn (phần Đọc hiểu, Khoa học), có thể kèm hình ảnh.
- Làm **lần lượt từng phần**; mỗi phần có đồng hồ riêng, hết giờ tự khoá. Đã nộp phần nào thì không quay lại được. Không xem trước được câu của phần sau.
- **Đánh dấu câu** để xem lại, ghi **thời gian làm từng câu**.
- **Tạm dừng** chỉ khi giáo viên bật `allow_pause` (chế độ luyện tập); chế độ thi thử thì tắt.
- **Lời giải** từng câu (`question_solutions`), hiện khi xem lại bài.
- **Trang kết quả:** tổng điểm /100, điểm từng phần, danh sách câu đúng/sai/bỏ trống, lời giải, thời gian từng câu (câu nào tốn nhiều thời gian nhất), so sánh các lần làm trước.
- **Giáo viên:** thống kê theo câu (tỉ lệ đúng, thời gian trung bình), bảng xếp hạng lớp, phổ điểm.

#### Giao diện phòng thi (bám theo ảnh mẫu trong `design/tsa/`)
- Toàn màn hình, tối giản để tập trung; màu theo mục "Thiết kế giao diện → Phòng thi TSA" (mặc định nền kem, có nút chuyển nền tối). Đầu trang: tên học sinh, tên đề (màu san hô nổi bật), tên phần thi + thời lượng.
- **Câu đơn lẻ** (phần Toán): khung câu hỏi bên trái, bên phải là bảng điều khiển gồm:
  đồng hồ "Thời gian còn lại" (đổi màu đỏ khi < 5 phút), nút **Tạm dừng** (nếu được phép) và **Nộp bài**,
  chỉ thị màu (số câu chưa làm / đã làm / đã đánh dấu), **lưới số câu** 1…N bấm để nhảy câu,
  dòng "Bạn đã hoàn thành x/N" + thanh tiến độ.
- **Câu có đoạn văn** (Đọc hiểu, Khoa học): chia đôi màn hình — đoạn văn bên trái, các câu hỏi của đoạn bên phải, hai cột cuộn độc lập;
  nút "Mở Menu/Nộp bài" ở góc dưới mở lại lưới câu hỏi + nút nộp.
- Thanh dưới: "« Câu trước", "Câu tiếp »", "Thời gian làm câu hiện tại: mm:ss".
- Mỗi câu có nút **đánh dấu** (bookmark) ở góc phải.
- Nhiều lựa chọn có nhiều đáp án đúng dùng **ô vuông**; một đáp án dùng **ô tròn**; đúng/sai là 2 nút tròn "Đúng" "Sai" cho mỗi mệnh đề;
  trả lời ngắn là ô nhập; kéo thả dùng `@dnd-kit` (trên điện thoại cho phép bấm phương án rồi bấm ô trống thay cho kéo).
- Màu trên lưới câu hỏi: chưa làm = xám, đã làm = xanh dương, đã đánh dấu = viền vàng.
- Trước khi nộp phần/nộp bài: hộp xác nhận liệt kê số câu chưa làm và số câu đã đánh dấu.
- Đồng hồ tính theo `deadline` server trả về (đồng bộ bằng `server_now`), không tin đồng hồ máy. Hết giờ thì tự gọi `finish_section`.
- Mất mạng: giữ câu trả lời trong hàng đợi, gửi lại khi có mạng, hiện cảnh báo "Đang mất kết nối".

### Nội dung câu hỏi: Markdown + công thức Toán
Mọi trường nội dung (`questions.content`, `choices.content`, `question_groups.content`, lời giải) là **Markdown có LaTeX**:
`$...$` cho công thức trong dòng, `$$...$$` cho công thức riêng dòng. Hiển thị bằng `react-markdown` + `remark-math` + `rehype-katex` (KaTeX).
Hình ảnh: giáo viên tải lên bucket công khai `question-media` (đường dẫn `{teacher_id}/{tên file}`) rồi chèn bằng cú pháp Markdown `![](url)`.
Màn soạn câu hỏi có ô xem trước công thức ngay khi gõ.

### 3. Điểm danh
- Giáo viên tạo **buổi học** (ngày, tiết/giờ, ghi chú) cho một lớp.
- Màn hình điểm danh: danh sách học sinh, mỗi em chọn `Có mặt` / `Vắng có phép` / `Vắng không phép` / `Đi muộn`, mặc định `Có mặt`, có nút "Đánh dấu tất cả có mặt".
- Sửa lại điểm danh của buổi cũ.
- Thống kê: số buổi vắng của từng học sinh, tỉ lệ chuyên cần, lọc theo khoảng thời gian.
- Học sinh xem được lịch sử điểm danh của chính mình.
- **Điểm danh phải nhanh trên điện thoại** (giáo viên điểm danh ngay trong lớp): mở lớp → nút lớn "Điểm danh hôm nay" tự tạo buổi theo ngày,
  mỗi học sinh một dòng có 3 nút lớn Có mặt / Muộn / Vắng (giữ lâu hoặc menu phụ để chọn "Vắng có phép" và ghi chú), mặc định tất cả Có mặt,
  đếm "Có mặt 18/20" luôn hiện, nút "Lưu điểm danh" cố định ở đáy màn hình; lưu xong hiện thông báo kèm số buổi còn lại của học sinh sắp hết gói.

### 3b. Học phí theo số buổi
Giáo viên tự ghi lại học phí; **web không thu tiền, không kết nối ngân hàng hay ví điện tử**.
- **Cài đặt lớp:** chọn cách tính
  - **Theo gói** (`billing_mode = 'package'`): học sinh mua gói N buổi (VD 12 buổi – 1.200.000đ). Mỗi buổi điểm danh có tính phí trừ 1 buổi. Báo khi còn ≤ `low_session_warning` buổi (mặc định 2). Học vượt gói thì số buổi còn lại âm.
  - **Theo buổi** (`'per_session'`): cuối tháng tính số buổi có tính phí × đơn giá/buổi.
  - **Trạng thái nào bị tính phí** (`billable_statuses`): mặc định Có mặt + Đi muộn; giáo viên có thể thêm "Vắng không phép".
- **Trang Học phí (giáo viên, chọn lớp + tháng):** bảng mỗi học sinh một dòng — số buổi trong tháng, số buổi vắng, (gói) đã mua / đã dùng / còn lại, số tiền phải đóng, đã đóng, còn nợ;
  lọc "Sắp hết gói", "Còn nợ"; nút "Thêm gói" và "Ghi nhận đã đóng tiền" (số tiền, ngày, tiền mặt/chuyển khoản, ghi chú) ngay trên dòng;
  xuất Excel bảng học phí tháng. Mọi số liệu lấy từ `rpc('tuition_summary', { p_class_id, p_month })`, không tự tính ở client.
- **Học sinh và phụ huynh:** xem số buổi còn lại, lịch sử điểm danh có đánh dấu buổi nào bị tính phí, các gói đã mua và các lần đã đóng tiền; không sửa được gì.
- Định dạng tiền kiểu Việt Nam: `1.200.000 đ` (`Intl.NumberFormat('vi-VN')`).

### 4. Phụ huynh
- Mỗi học sinh có một **mã phụ huynh** riêng (8 ký tự, ngẫu nhiên), khác mã lớp. Giáo viên xem, in danh sách mã, và tạo lại mã khi cần (mã cũ hết hiệu lực).
- Phụ huynh nhập mã để liên kết với con. Một phụ huynh có thể liên kết nhiều con; một học sinh có thể có nhiều phụ huynh (bố, mẹ…).
- Giáo viên xem được danh sách phụ huynh đã liên kết của từng học sinh (họ tên, email, số điện thoại) và gỡ liên kết khi cần.
- Phụ huynh **chỉ xem, không sửa** bất kỳ dữ liệu nào. Nếu có nhiều con thì có ô chọn con ở đầu trang. Phụ huynh xem được:
  - bài tập của con: hạn nộp, trạng thái (`Chưa làm` / `Đã nộp` / `Nộp muộn` / `Đã chấm`), điểm và nhận xét của giáo viên;
  - lịch sử điểm danh, số buổi vắng, tỉ lệ chuyên cần;
  - học phí: số buổi còn lại của gói (hoặc số buổi và số tiền tháng này), các lần đã đóng tiền;
  - điểm trung bình theo lớp.
- Phụ huynh **không** xem được nội dung đề trắc nghiệm, đáp án, bài làm hay file nộp của con, và không xem được dữ liệu của học sinh khác.

### 5. Bảng điểm & xuất file
- Bảng điểm theo lớp: hàng là học sinh, cột là bài tập.
- Xuất Excel/CSV bảng điểm và bảng điểm danh.

### 6. Dashboard
- **Giáo viên:** buổi học hôm nay (nút "Điểm danh" lớn), bài chờ chấm, bài sắp đến hạn, học sinh vắng nhiều, học sinh sắp hết gói / còn nợ học phí.
- **Học sinh:** lời chào theo giờ, dải chuỗi 7 ngày, bài cần làm (sắp xếp theo hạn), số buổi còn lại trong gói, điểm gần đây, lời nhắn của giáo viên.
- **Phụ huynh:** với mỗi con: bài sắp đến hạn chưa nộp, bài quá hạn chưa nộp (làm nổi bật), điểm gần đây, các buổi vắng gần đây.

## Database Supabase — ĐÃ TẠO SẴN, KHÔNG TẠO LẠI
Project Supabase: `pkeyefjemrioatzkshoo` (URL `https://pkeyefjemrioatzkshoo.supabase.co`).
Toàn bộ bảng, RLS, hàm RPC và Storage đã được áp dụng. File SQL gốc nằm trong `supabase/migrations/0001…0008` để tham khảo.
**Không sửa/tạo lại schema** trừ khi được yêu cầu; nếu cần thay đổi thì tạo migration mới (`0009_...sql`).

### Bảng
```
profiles             (id = auth.users.id, full_name, role 'teacher'|'student'|'parent', student_code, phone, created_at)
student_parent_codes (student_id PK, code 8 ký tự unique, updated_at)       -- mã phụ huynh của từng học sinh
parent_links         (parent_id, student_id, created_at)                     -- phụ huynh ↔ con
parent_link_attempts (nội bộ, chống dò mã — frontend không dùng)
classes              (id, teacher_id, name, subject, school_year, join_code 6 ký tự, created_at)
class_members        (class_id, student_id, joined_at)
assignments          (id, class_id, title, description, type 'quiz'|'essay', open_at, due_at, allow_late,
                      time_limit_minutes, max_attempts, shuffle, show_answers 'after_submit'|'after_due'|'never',
                      exam_format 'standard'|'tsa', allow_pause)
exam_sections        (id, assignment_id, order_index, title, time_limit_minutes)   -- phần thi, làm lần lượt
question_groups      (id, assignment_id, section_id, order_index, title, content)  -- đoạn văn/dữ kiện dùng chung
questions            (id, assignment_id, section_id, group_id, order_index,
                      kind 'multiple_choice'|'true_false'|'short_answer'|'drag_drop', content, points, multiple_correct)
question_solutions   (question_id, explanation)                                    -- lời giải, chỉ giáo viên đọc trực tiếp
choices              (id, question_id, order_index, content, is_correct)    -- chỉ giáo viên đọc trực tiếp
                      -- với true_false: mỗi dòng là một ý a/b/c/d, is_correct = ý đó Đúng
                      -- với drag_drop: kho phương án; blank_no = số ô trống mà phương án này đúng (null = nhiễu)
question_answer_keys (id, question_id, answer)                              -- đáp án chấp nhận của câu trả lời ngắn, chỉ giáo viên đọc
submissions          (id, assignment_id, student_id, attempt_no, started_at, submitted_at,
                      status 'in_progress'|'submitted'|'graded', is_late, score, max_score,
                      teacher_comment, essay_text, graded_at, paused_at, paused_seconds)
submission_sections  (submission_id, section_id, started_at, finished_at, paused_seconds)  -- tiến độ từng phần
answers              (id, submission_id, question_id, selected_choice_ids uuid[],  -- nhiều lựa chọn
                      tf_answers jsonb { "<choice_id>": true|false },              -- đúng/sai
                      text_answer,                                                 -- trả lời ngắn
                      blank_answers jsonb { "1": "<choice_id>" },                  -- kéo thả
                      flagged, time_spent_seconds,                                 -- đánh dấu, thời gian làm câu
                      points_awarded (server tự ghi khi chấm), updated_at)
submission_files     (id, submission_id, storage_path, file_name, size)
class_sessions       (id, class_id, date, period, note)                       -- buổi học
-- học phí
classes (thêm cột)   billing_mode 'package'|'per_session', price_per_session, billable_statuses attendance_status[], low_session_warning
tuition_packages     (id, class_id, student_id, sessions, price, start_date, note)        -- gói buổi đã mua
tuition_payments     (id, class_id, student_id, amount, paid_on, method 'cash'|'transfer'|'other', package_id, note, created_by)
attendance           (session_id, student_id, status 'present'|'excused'|'absent'|'late', note)
```
Trạng thái hiển thị: `Chưa làm` = không có submission; `Đang làm` = in_progress; `Đã nộp` = submitted;
`Đã chấm` = graded; thêm nhãn `Nộp muộn` khi `is_late = true`.

### Đăng ký tài khoản
Gọi `supabase.auth.signUp({ email, password, options: { data: { role, full_name, student_code?, phone? } } })`.
Trigger tự tạo `profiles` (role lấy từ `data.role`, mặc định `student`) và tự tạo mã phụ huynh cho học sinh.
Người dùng không tự đổi được `role`.

### Ai làm gì bằng cách nào
| Việc | Cách gọi |
|---|---|
| Giáo viên CRUD lớp, bài tập, câu hỏi, đáp án, buổi học, điểm danh | Ghi bảng trực tiếp (RLS kiểm tra quyền) |
| Giáo viên thêm học sinh có sẵn vào lớp | `insert class_members` (cần `student_id`) |
| Học sinh vào lớp | `rpc('join_class', { p_code })` |
| Tạo lại mã lớp / mã phụ huynh | `rpc('regenerate_join_code', { p_class_id })`, `rpc('regenerate_parent_code', { p_student_id })` |
| Giáo viên xem mã phụ huynh | `select` từ `student_parent_codes` |
| Học sinh bắt đầu / tiếp tục làm bài | `rpc('start_attempt', { p_assignment_id })` → submission (kiểm tra hạn, số lần, hết giờ thì tự nộp lượt cũ) |
| Học sinh lấy đề trắc nghiệm (không có đáp án) | `rpc('get_quiz', { p_submission_id })` → JSON gồm `deadline`, `questions[]` có `kind`, `choices` (rỗng với trả lời ngắn) và câu trả lời đã lưu (`selected_choice_ids`, `tf_answers`, `text_answer`); tự xáo trộn ở client nếu `shuffle` (không xáo thứ tự ý a–d của câu đúng/sai) |
| Học sinh trả lời | `upsert answers` theo `(submission_id, question_id)`, chỉ ghi cột của loại câu đó; lưu tự động mỗi lần chọn/gõ (debounce ~1s). Bị chặn khi đã nộp/hết giờ |
| Nộp trắc nghiệm (chấm ngay ở server) | `rpc('submit_quiz', { p_submission_id })` |
| Tự luận: lưu nháp / nộp | `rpc('save_essay', {...})`, `rpc('submit_essay', { p_submission_id, p_essay_text })` |
| Nộp file | Upload vào bucket `submissions`, đường dẫn **`{assignment_id}/{student_id}/{submission_id}/{tên file}`**, rồi `insert submission_files`. Tối đa 10 MB; PDF, ảnh, Word |
| Giáo viên chấm tự luận | `update submissions set score, teacher_comment, status='graded', graded_at=now()` |
| Làm đề có phần thi | `start_attempt` → `rpc('start_section', { p_submission_id, p_section_id })` (phải theo thứ tự) → trả lời → `rpc('finish_section', {...})`; nộp phần cuối thì tự chấm. Cả hai trả về JSON giống `get_quiz`, trong đó `sections[]` có `status` (`not_started`/`active`/`finished`) và `deadline`, `questions`/`groups` chỉ của phần đang làm |
| Tạm dừng / tiếp tục | `rpc('pause_attempt', { p_submission_id })`, `rpc('resume_attempt', {...})` — đồng hồ được cộng bù thời gian tạm dừng |
| Đánh dấu / ghi thời gian câu | `upsert answers` với `flagged`, `time_spent_seconds` (gửi định kỳ ~15s và khi rời câu) |
| Giáo viên soạn câu kéo thả | `content` chứa `[[1]]`, `[[2]]`…; mỗi phương án là một dòng `choices` với `blank_no` = ô đúng (null = nhiễu) |
| Giáo viên soạn câu trả lời ngắn | `insert questions (kind='short_answer')` + `insert question_answer_keys` (mỗi đáp án chấp nhận một dòng) |
| Xem lại đáp án | `rpc('get_quiz_review', { p_submission_id })` → `sections[]` có điểm từng phần, `groups`, từng câu có `points_awarded`, `explanation`, `accepted_answers`, `choices[].is_correct/blank_no`, `time_spent_seconds` (học sinh theo `show_answers`, giáo viên luôn xem được) |
| Phụ huynh liên kết con | `rpc('link_parent', { p_code })` → `{ ok, message, student_id }` (sai 5 lần/15 phút thì bị khoá) |
| Phụ huynh xem danh sách con | `rpc('parent_children')` |
| Phụ huynh xem bài tập/điểm của con | `rpc('parent_child_assignments', { p_student_id })` (có `status`, `is_late`, `is_overdue`, `score`, `teacher_comment`) |
| Phụ huynh xem điểm danh | `select` trực tiếp `attendance` + `class_sessions` (RLS chỉ trả dữ liệu của con) |
| Bảng học phí (giáo viên: cả lớp; học sinh/phụ huynh: dòng của mình/của con) | `rpc('tuition_summary', { p_class_id, p_month })` → `sessions_in_month`, `absent_in_month`, `sessions_used_total`, `sessions_purchased`, `sessions_remaining`, `amount_due_month`, `amount_total`, `paid_month`, `paid_total`, `balance`, `low_sessions` |
| Thêm gói / ghi nhận đóng tiền | `insert tuition_packages`, `insert tuition_payments` (chỉ giáo viên của lớp; học sinh phải thuộc lớp) |

### Đã kiểm thử RLS
Học sinh không đọc được đáp án, không sửa được điểm hay sửa bài sau khi nộp, không xem dữ liệu học sinh khác.
Phụ huynh chỉ xem được con mình, không xem đề/bài làm/file. Giáo viên chỉ thấy lớp của mình.

### Còn thiếu: tạo tài khoản học sinh hàng loạt
Cần một Edge Function `create-students` (dùng service role key có sẵn trong môi trường Edge Function, **không** đưa vào frontend):
kiểm tra người gọi là giáo viên của lớp → tạo tài khoản bằng `auth.admin.createUser` (email thật, hoặc dạng `{mã HS}@hs.local` nếu học sinh không có email,
`email_confirm: true`, `user_metadata.role = 'student'`) → thêm vào `class_members` → trả về danh sách tài khoản + mật khẩu tạm để giáo viên phát.

## Nhập câu hỏi từ Excel
Có nút "Tải file mẫu" (`public/mau-cau-hoi.xlsx`) và "Nhập từ Excel" trong màn soạn đề. Đọc bằng thư viện `xlsx`, chuyển thành JSON rồi lưu. Một sheet, mỗi dòng một câu hỏi:

| Cột | Ý nghĩa |
|---|---|
| `Phần` | (tuỳ chọn) tên phần thi, VD `Tư duy Toán học`. Phần chưa có thì tạo mới theo thứ tự xuất hiện |
| `Đoạn văn` | (tuỳ chọn) mã đoạn văn, VD `DV1`. Nội dung đoạn văn đặt ở sheet thứ hai `DoanVan` (cột `Mã`, `Tiêu đề`, `Nội dung`) |
| `Loại` | `TN` (nhiều lựa chọn), `DS` (đúng/sai), `TLN` (trả lời ngắn), `KT` (kéo thả) |
| `Câu hỏi` | Nội dung câu hỏi / câu dẫn |
| `A` `B` `C` `D` (thêm `E` `F` nếu cần) | TN: các phương án. DS: các ý a, b, c, d. TLN: để trống |
| `Đáp án` | TN: `B` hoặc `A,C` (nhiều đáp án đúng). DS: chuỗi Đ/S theo thứ tự ý, ví dụ `ĐSĐS` (chấp nhận cả `DSDS`, `TFTF`). TLN: đáp án, nhiều đáp án chấp nhận cách nhau bằng `|`, ví dụ `0,5|1/2`. KT: phương án cho từng ô theo thứ tự, ví dụ `B,A` = ô 1 là B, ô 2 là A; phương án không dùng là nhiễu |
| `Lời giải` | (tuỳ chọn) Markdown + LaTeX |
| `Điểm` | Để trống thì mặc định: đề TSA mọi câu 1 điểm; đề thường TN 0,25 · DS 1 · TLN 0,5 (theo thang THPT) |

Kiểm tra trước khi lưu và đánh dấu đỏ từng dòng lỗi: thiếu loại/câu hỏi; TN có ít hơn 2 phương án hoặc đáp án trỏ vào ô trống; DS số ký tự Đ/S khác số ý; TLN thiếu đáp án. File CSV phải là UTF-8.
Cũng hỗ trợ xuất đề ra Excel cùng định dạng (để sao lưu hoặc chép sang lớp khác).

## Thiết kế giao diện — phong cách "Góc học ấm" (Softly cho học sinh)
Phỏng theo bản tham khảo `design/softly-reference.json` (phong cách "Softly": tối giản, ấm áp, chất liệu giấy, pastel dịu),
nhưng **chỉnh cho học sinh**: màu tươi hơn một chút, chữ to rõ, chuyển động nhanh hơn trong app, và bắt buộc hiển thị đúng tiếng Việt.
Cảm giác cần đạt: *một góc học tập ấm áp, gọn gàng* — thân thiện nhưng không trẻ con, không rối mắt.

### Bảng màu (khai báo trong `src/index.css` thành CSS variables của shadcn + `tailwind.config`; không hard-code màu trong component)
| Token | Mã màu | Dùng cho |
|---|---|---|
| `--background` | `#FDFCF8` (kem giấy) | Nền toàn app |
| `--card` | `#FFFFFF` | Thẻ, khung nội dung |
| `--foreground` | `#292524` (đen đá mềm) | Chữ chính (tương phản 14.8:1) |
| `--muted-foreground` | `#6B625C` | Chữ phụ (5.8:1 — **không** dùng `#78716C` cho chữ nhỏ) |
| `--primary` | `#FF8F85` (san hô) | Nút chính, điểm nhấn. **Chữ trên nền san hô luôn là `#292524`** (6.9:1); không dùng chữ trắng |
| `--primary-soft` | `#FFB7B2` / `#FFE4E1` | Nền nhấn nhẹ, blob trang trí, badge |
| `--sage` | `#E8EFE8` | Nền khu vực **giáo viên** |
| `--lavender` | `#EFEDF4` | Nền khu vực **phụ huynh** |
| `--peach` | `#FFF1EC` | Nền khu vực **học sinh** |
| `--info` | `#2F6FA8` (chữ trắng) | Link, trạng thái "đã làm" trên lưới câu hỏi |
| `--border` | `#E7E5E4` | Viền mảnh |

Màu trạng thái (nền nhạt + chữ đậm, đều ≥ 5:1), dùng thống nhất cho Badge, điểm danh, bài tập:
| Trạng thái | Nền | Chữ |
|---|---|---|
| Có mặt · Đã chấm · Đúng | `#E3F4EA` | `#1F6F4A` |
| Đi muộn · Nộp muộn · Đã đánh dấu | `#FFF3D6` | `#8A5A00` |
| Vắng · Quá hạn · Sai | `#FDE7E4` | `#B3261E` |
| Đã nộp · Đang làm | `#E3F0FA` | `#1E5A8C` |
| Chưa làm · Vắng có phép | `#F1F0EC` | `#57534E` |
Không bao giờ dùng **chỉ màu** để phân biệt trạng thái — luôn kèm chữ hoặc icon.

### Chữ — bắt buộc hỗ trợ tiếng Việt
Bản tham khảo dùng `Outfit` và `Reenie Beanie`; theo mình biết hai font này **không có bộ dấu tiếng Việt**, nên thay bằng:
- **Font chính:** `Be Vietnam Pro` (dáng tròn, hiện đại, đủ dấu). Tiêu đề `tracking-tight`, chỉ viết hoa chữ đầu câu.
- **Font viết tay (điểm nhấn):** `Patrick Hand`. Chỉ dùng cho 1–3 chữ trang trí: lời chào ("Chào Huy!"), chữ nhấn trong tiêu đề trang giới thiệu, lời khen khi đạt điểm cao, chữ ký giáo viên trên ghi chú.
  **Không** dùng cho nội dung câu hỏi, đáp án, bảng, form.
- Trước khi dùng, kiểm tra font có subset `vietnamese` trên Google Fonts và nạp kèm `&subset=vietnamese` (hoặc `@fontsource/...` có file vietnamese). Gõ thử chuỗi "Ữ Ặ ỗ ự Đ" để kiểm tra; nếu thiếu dấu thì đổi font khác có tiếng Việt.
- Cỡ chữ: nội dung 16px (điện thoại) / 17–18px (đề thi); tiêu đề trang 28–36px trong app; hero trang giới thiệu 44px (điện thoại) → 72px (máy tính).

### Hình khối, chất liệu, bóng
- Bo góc: thẻ lớn `rounded-[2rem]`, thẻ nhỏ/ô nhập `rounded-2xl`, nút và thanh điều hướng `rounded-full`. Bảng dữ liệu dùng `rounded-2xl` cho khung ngoài, ô bên trong vuông.
- Bóng mềm: `0 4px 20px -2px rgba(0,0,0,0.05)`; khi hover tăng nhẹ. Không dùng bóng đậm.
- **Lớp hạt giấy (grain):** SVG `feTurbulence` (baseFrequency 0.65), `pointer-events: none`, `mix-blend-mode: overlay`.
  Giảm độ mờ xuống **0.15–0.2** (bản gốc 0.35 làm chữ nhỏ bị nhoè), chỉ phủ **nền**, không phủ lên thẻ chứa chữ;
  **tắt trong phòng thi TSA** và khi `prefers-reduced-motion`/thiết bị yếu.
- Blob mờ trang trí (`#FFE4E1`, `#E6E6FA`, `#E8EFE8`, blur lớn, opacity 0.6) chỉ ở trang giới thiệu, đăng nhập, trang chủ học sinh và màn chúc mừng.

### Nền trang trí có hoạ tiết toán học (để nền đỡ trống)
Mẫu xem trên bảng thiết kế, khung "Nền có hoạ tiết toán học". File SVG gốc trong `design/backgrounds/` — chép vào `public/backgrounds/`.
Làm thành một component `<NenTrangTri kieu="cham-bi" | "ke-dong" | "dau-trang" | "do-thi" | "dau-trang-do-thi" | "vo-o" | "cong-thuc" | "hinh-hoc" | "tron" />` đặt ở lớp dưới cùng của layout
(`position: fixed; inset: 0; z-index: 0; pointer-events: none; aria-hidden`), nội dung trang nằm trên (`position: relative; z-index: 1`).
1. **`vo-o` – Vở kẻ ô:** nền `#FDFCF8` + lưới 22px bằng CSS
   `background-image: linear-gradient(#EFE9E0 1px, transparent 1px), linear-gradient(90deg, #EFE9E0 1px, transparent 1px); background-size: 22px 22px`,
   một đường lề đỏ dọc (`#FF8F85`, opacity 0.35) cách trái ~44px, và 2–3 nét vẽ tay (parabol, căn, tam giác) ở góc với opacity ~0.55.
2. **`cong-thuc` – Công thức rải rác:** `background: url(/backgrounds/doodle-toan.svg) repeat` (ô 360px, nét đã sẵn độ mờ),
   phủ thêm `mask-image: radial-gradient(ellipse 60% 45% at 50% 40%, transparent 35%, #000 85%)` để **vùng giữa trống, hoạ tiết dày dần ra mép**.
3. **`hinh-hoc` – Hình học lớn ở góc:** `/backgrounds/goc-hinh-hoc.svg` (không lặp) đặt tràn ra góc trên-phải (~420px), một bản xoay 180° đổi màu ở góc dưới-trái;
   trôi rất chậm (±10px, 7s, alternate). Trên điện thoại thu còn ~260px và chỉ giữ góc trên.
**Các kiểu nhẹ (ưu tiên dùng, đỡ rối mắt)** — mẫu trong khung "Nền nhẹ, đỡ rối mắt":
4. **`cham-bi` – Chấm bi giấy:** `background-image: radial-gradient(#DDD5C9 1.3px, transparent 1.6px); background-size: 22px 22px` trên nền `#FDFCF8`.
5. **`ke-dong` – Giấy kẻ dòng:** `background-image: repeating-linear-gradient(to bottom, transparent 0 35px, #EEE7DC 35px 36px)`.
6. **`dau-trang` – Hoạ tiết chỉ ở đầu trang:** dải cao ~240px ở đầu trang: gradient `#FFF1EC → trong suốt` + `doodle-toan.svg` với
   `mask-image: linear-gradient(to bottom, #000 30%, transparent)`; phần dưới trơn. Dải cuộn theo trang (không `fixed`).
7. **`do-thi` – Một đường đồ thị:** một SVG nhỏ: một đường sin mảnh `#FF8F85` opacity ~0.35 + một đường chấm `#8FB89A`, vài điểm đánh dấu, đặt ngang khoảng 60% chiều cao màn hình.
8. **`dau-trang-do-thi` – Kết hợp 6 + 7** (mẫu khung "Nền kết hợp 6 + 7"): dải hoạ tiết đầu trang như kiểu 6, cộng đường đồ thị của kiểu 7
   đặt thấp hơn (~65–75% chiều cao màn hình đầu tiên, nằm dưới các thẻ chính). Đường sin chính **tự vẽ dần một lần** khi vào trang
   (`stroke-dasharray`/`stroke-dashoffset`, ~2.4s), đường chấm và các điểm đứng yên. Đang thử cho trang chủ học sinh.
- **Bộ ký hiệu** cho các kiểu có hoạ tiết (`dau-trang`, `dau-trang-do-thi`, `cong-thuc`): prop `boKyHieu` =
  `co-ban` (`doodle-toan.svg`: π, √, ∞, tam giác, parabol) | `giai-tich` (`ky-hieu-giai-tich.svg`: ∫, Δ, θ, ≠, ≤, ∈, ma trận, dãy số) |
  `hinh-hoc` (`ky-hieu-hinh-hoc.svg`: lập phương, vectơ, góc, ⊥, ∥, compa, thước đo góc, hình nón) |
  `xac-suat` (`ky-hieu-xac-suat.svg`: xúc xắc, Venn, biểu đồ tròn/cột, trục số, %). Mẫu so sánh trong khung "Các bộ ký hiệu toán học".
  Giáo viên chọn bộ ký hiệu cho từng lớp trong cài đặt lớp (cột `classes.decor_symbols`, thêm bằng migration khi làm tới; mặc định `co-ban`).
- **Dùng ở đâu (áp dụng từ bước 8; bước 1–7 dùng `cham-bi` hoặc `tron`):** trang chủ học sinh → `dau-trang-do-thi`; các trang danh sách của học sinh và phụ huynh → `cham-bi`;
  trang của giáo viên (bảng số liệu) → `cham-bi` hoặc `tron`; trang giới thiệu + đăng nhập → `hinh-hoc` hoặc `do-thi`;
  **phòng thi TSA và màn làm bài → `tron`**; trang in/xuất PDF → không có nền. Kiểu `cong-thuc` và `vo-o` chỉ dùng cho khu vực nhỏ (empty state, màn chúc mừng), không phủ cả trang.
- Quy tắc: hoạ tiết **không bao giờ nằm sau chữ dài** (thẻ nội dung luôn có nền trắng/đặc); độ tương phản chữ vẫn phải đạt WCAG AA;
  tắt chuyển động khi `prefers-reduced-motion`; hoạ tiết là SVG tĩnh nhẹ (< 5 KB), không dùng ảnh bitmap.

### Chuyển động
- **Trong app:** nhanh và nhẹ, 150–250ms (`ease-out`). Học sinh bấm nhiều — không bắt chờ.
- **Trang giới thiệu:** "hiện dần khi cuộn" (translateY 30px → 0, opacity 0 → 1, 0.6–0.8s), blob trôi nhẹ (±10px, vòng 6s).
- Luôn tôn trọng `prefers-reduced-motion` (tắt hết hiệu ứng trôi/hiện dần).
- Phòng thi TSA: **không** có hiệu ứng trang trí.
- **Danh mục hiệu ứng cụ thể** (xem bản mẫu trên bảng thiết kế "Mẫu giao diện học sinh – Góc học ấm"; viết bằng CSS keyframes/transition, dùng `framer-motion` chỉ khi cần hiệu ứng rời trang/xếp lại danh sách):
  - Vào trang: các khối hiện dần lần lượt (opacity + dịch lên 20–24px, 0.6–0.7s, mỗi khối trễ thêm ~80ms).
  - Thanh tiến độ chạy từ 0 đến giá trị thật (scaleX, ~1.1s); điểm số đếm từ 0 lên (~1.2s, chậm dần cuối).
  - Thẻ: hover nhấc lên 3px + bóng đậm hơn; ghi chú dán hover thì thẳng lại (xoay 0°) và nhấc lên.
  - Nút: hover phóng 1.04, bấm thu 0.97. Ô số câu trên lưới: hover phóng 1.12, đổi màu mượt khi đổi trạng thái.
  - Icon lửa chuỗi ngày học lắc nhẹ liên tục; chữ viết tay "Minh!" vẫy nhẹ một lần khi vào trang; ô điểm danh bật ra lần lượt.
  - Phòng thi: chọn đáp án đổi nền/viền mượt (0.2s); nút đánh dấu nảy khi bật; thanh tiến độ trượt khi số câu đã làm thay đổi;
    tạm dừng thì phủ một lớp mờ che câu hỏi (fade 0.25s); đồng hồ chuyển đỏ khi < 5 phút và nhấp nháy nhẹ khi < 1 phút.
  - Tất cả tắt khi `prefers-reduced-motion: reduce`.

### Thư viện hiệu ứng: Animate UI (https://animate-ui.com/docs/primitives)
Bản có hiệu ứng của các primitive Radix UI (cùng API với shadcn/ui), dùng `motion`, cài theo kiểu copy vào dự án qua shadcn CLI.
Cài **từng component khi cần**, theo đúng lệnh trên trang tài liệu của component đó; sau khi cài thì **restyle theo token màu ở trên** (không giữ màu mặc định).
Dùng `motion` (`motion/react`) cho mọi hiệu ứng viết tay khác, không thêm thư viện hiệu ứng thứ hai.

| Chỗ dùng trong app | Component Animate UI |
|---|---|
| Thanh điều hướng dưới trên điện thoại (nền san hô trượt sang mục được chọn) | Bottom Navigation |
| Menu bên trái trên máy tính, chọn trạng thái điểm danh Có mặt / Muộn / Vắng | Highlight (effect), Toggle Group |
| Tab "Chưa làm · Đã nộp · Đã chấm", tab các phần thi trong trang kết quả | Tabs |
| Đáp án trong phòng thi | Checkbox, Radio Group (chỉ hiệu ứng dấu tích, không thêm gì khác) |
| Điểm số, số liệu "Tuần này", điểm TSA | Counting Number (đếm lên một lần khi hiện) |
| Thanh tiến độ bài làm, tiến độ phần thi | Progress |
| Xác nhận nộp bài / nộp phần, xác nhận xoá | Alert Dialog |
| Bảng danh sách câu hỏi trên điện thoại, bộ lọc | Drawer / Sheet |
| "Đã lưu câu trả lời", "Đã điểm danh xong" | Toast |
| Câu hỏi thường gặp (trang giới thiệu), lời giải từng câu (trang kết quả) | Accordion |
| Nhập **mã lớp** (6 ký tự) và **mã phụ huynh** (8 ký tự) | Input OTP |
| Gợi ý icon, giải thích nút | Tooltip |
| Đoạn văn dài phần Đọc hiểu | Scroll Progress |
| Khối nội dung hiện dần khi cuộn (trang giới thiệu, trang chủ) | Fade / Slide (effects) |
| Chuyển trang trong app | Page Transition (nhẹ, ≤ 250ms) |
| Chữ nhấn ở hero trang giới thiệu | Rotating Text hoặc Typing Text (chỉ ở trang giới thiệu) |
| Chúc mừng khi đạt điểm cao | Particles (tắt được, chỉ ở màn kết quả) |

**Không dùng** (lệch phong cách "Góc học ấm" hoặc gây phân tâm): Gradient Text, Shimmering Text, Liquid Button, Cursor, Magnetic, Tilt, Motion Grid, GitHub Stars.
**Phòng thi TSA** chỉ được dùng: Checkbox, Radio Group, Progress, Alert Dialog, Drawer, Toast, Tooltip, Scroll Progress — không hiệu ứng trang trí.
Mọi component vẫn phải tôn trọng `prefers-reduced-motion` (dùng `useReducedMotion` của `motion` nếu component chưa tự xử lý).

### Logo
Mẫu 6 hướng logo ở khung "Ý tưởng logo" trên bảng thiết kế. **Chưa chốt** — trong lúc làm chức năng dùng tạm hướng **A (góc giấy gập)**:
một hình vuông bo góc màu san hô `#FF8F85`, góc trên-phải gập (tam giác `#FFD9D4`), chấm tròn trắng ở góc dưới-trái; chữ "Góc học" Be Vietnam Pro đậm 800.
Làm thành component `<Logo />` (SVG nội tuyến, prop `size`, `withText`) + `public/favicon.svg` để sau này thay logo chỉ sửa một chỗ.
File SVG sẵn: `design/logo-tam.svg` (biểu tượng) — chép thành `public/favicon.svg`.

### Chi tiết thân thiện với học sinh
- Lời chào theo giờ ("Chào buổi sáng, Huy ☀️") bằng font viết tay trên trang chủ học sinh.
- **Thẻ "ghi chú dán"** (nền trắng/vàng nhạt, xoay ±1°, chữ ký viết tay): dùng cho thông báo của giáo viên và nhận xét bài làm.
- Màn kết quả: điểm cao có hiệu ứng confetti nhẹ (tắt được); điểm thấp hiện lời động viên + nút "Xem lời giải", không dùng màu đỏ toàn màn.
- Empty state có minh hoạ đơn giản (SVG tự vẽ, phong cách nét mảnh) + một câu hướng dẫn: "Chưa có bài tập nào — nghỉ ngơi chút nhé!".
- Chuỗi ngày học liên tiếp, huy hiệu nhỏ (làm đủ bài tuần, đúng giờ 10 buổi…) ở trang chủ học sinh — bố cục gọn, không game hoá quá đà.
- Ngôn ngữ: xưng "bạn", câu ngắn, tích cực. Thông báo lỗi nói cách sửa, không đổ lỗi.

### Bố cục app
- **Thanh điều hướng nổi dạng viên thuốc:** nền trắng 70% + `backdrop-blur` 20px, rộng 100% − 32px trên điện thoại.
  Máy tính: thanh trên cùng (hoặc sidebar thu gọn cho giáo viên vì nhiều mục). Điện thoại: **thanh điều hướng dưới** dạng viên thuốc nổi.
- Khu vực theo vai trò có màu nền nhẹ riêng (giáo viên sage, học sinh peach, phụ huynh lavender) để biết ngay mình đang ở đâu.
- Khoảng cách theo thang 4/8px, nhiều khoảng trắng; mỗi màn một hành động chính nổi bật (nút san hô).
- **Màn quan trọng phải đặc biệt dễ dùng:** điểm danh (bấm nhanh từng em, nút "Tất cả có mặt"), làm bài (một câu/màn trên điện thoại, đồng hồ luôn hiện, xác nhận trước khi nộp).
- **Trạng thái:** mỗi trang có skeleton khi tải, empty state, thông báo lỗi tiếng Việt.
- **Khả năng truy cập:** focus ring san hô đậm (`#E8655A`, 2px), nhãn cho mọi ô nhập, WCAG AA, vùng bấm ≥ 44px.
- **Thư viện:** shadcn/ui (restyle theo token ở trên), icon `lucide-react` nét mảnh (stroke 1.75). Không tự viết lại component đã có.

### Phòng thi TSA
Giữ bố cục theo ảnh mẫu `design/tsa/` (mục 2b) nhưng dùng bảng màu này:
- Mặc định **nền sáng kem** (đỡ mỏi mắt khi làm lâu, in được); có nút chuyển **nền tối** (`#1C1917`, chữ `#E7E5E4`, tên đề `#FF9F94`) cho ai thích giống thi thật.
- Lưới câu hỏi: chưa làm = xám, đã làm = `--info`, đánh dấu = viền vàng `#8A5A00` + icon bookmark.
- Không grain, không blob, không animation; chỉ đồng hồ đổi màu khi còn < 5 phút.

## Trang giới thiệu (landing page, trang `/`)
Một cột, ưu tiên điện thoại, theo cấu trúc của bản tham khảo, nội dung đổi sang web học tập:
1. **Thanh điều hướng nổi** (component `<Logo />`; link: Tính năng · Luyện TSA · Câu hỏi thường gặp; nút đen "Đăng nhập").
2. **Hero:** tiêu đề kiểu "Học đều mỗi ngày, *tự tin* đi thi" (chữ *tự tin* bằng font viết tay), câu phụ ≤ 500px,
   2 nút: "Bắt đầu học" (san hô) và "Tôi là giáo viên" (trắng viền). Hai blob mờ phía sau.
3. **Cuộn ngang "Một ngày học":** các thẻ 288×160px (giờ ở góc trên, câu ở dưới), ví dụ
   "7:00 — Điểm danh chỉ một chạm", "15:30 — Nộp bài, có điểm ngay", "20:00 — Luyện một phần TSA 30 phút", "21:00 — Bố mẹ xem tiến độ".
4. **Xem trước ứng dụng:** 3 khung điện thoại xếp bậc (giữa 300×620 rõ nét; hai bên 280×580, mờ 80%, lệch xuống 48/96px):
   giữa là màn làm bài TSA, trái là trang chủ học sinh (nền peach), phải là màn điểm danh của giáo viên (nền sage). Dựng bằng HTML/CSS thật, không dùng ảnh.
5. **Ghi chú cảm nhận** (thẻ ghi chú dán xoay ±1°, chữ ký viết tay): **chỉ dùng cảm nhận thật** của học sinh/giáo viên đã cho phép.
   Khi chưa có thì thay bằng các thẻ "Ghi chú tính năng" (VD "Chấm trắc nghiệm ngay khi nộp — Nhóm phát triển"), **không bịa lời nhận xét** của người không có thật.
6. **Câu hỏi thường gặp** (accordion: nền trắng, bo 16px, icon dấu cộng xoay 45°, mở/đóng 300–500ms).
7. **Kêu gọi cuối trang:** khung trung tâm có icon vuông bo đen với chấm san hô, ô nhập **mã lớp** (bo tròn, nền `stone-50`) + nút đen "Vào lớp" (phóng to nhẹ khi hover) — dẫn tới đăng ký/đăng nhập rồi tự gọi `join_class`.
8. Chân trang gọn: tên dự án, liên hệ, chính sách dữ liệu (nói rõ bài làm có thể được AI hỗ trợ chấm nếu bật).

### Skill hỗ trợ
- **web-design-guidelines** (Vercel): sau mỗi bước có giao diện mới, rà soát `src/pages` và `src/components`, sửa hết lỗi trước khi sang bước sau.
- **taste-skill** (`design-taste-frontend`): dùng cho **trang giới thiệu** ở trên. **Không** áp quy tắc landing page của skill (mỗi section một màn hình, WebGL…) cho các trang trong app.

## Mẫu giao diện tham khảo
Người dùng có một bảng thiết kế trên claude.ai ("Mẫu giao diện học sinh – Góc học ấm"); Claude Code **không mở được link đó**.
Người dùng sẽ xuất từng màn thành ảnh PNG vào `design/mau/` khi cần. Khi được đưa ảnh (`@design/mau/...png`), làm **đúng bố cục**, còn màu/font theo file này.
Các màn có trên bảng thiết kế: trang chủ học sinh (điện thoại + máy tính), phòng thi TSA (điện thoại, câu đơn, đoạn văn), kết quả bài thi,
điểm danh nhanh (giáo viên, điện thoại), học phí theo buổi, bài tập về nhà (giáo viên), ý tưởng logo, các kiểu nền và bộ ký hiệu toán học.

## Nguyên tắc ưu tiên: chức năng trước, trang trí sau
- **Chốt ngay ở bước 1** (sửa về sau rất tốn công): token màu, font tiếng Việt, cỡ chữ, bo góc, khoảng cách, bố cục điều hướng,
  component shadcn đã restyle, khả năng truy cập (tương phản, vùng bấm ≥ 44px, nhãn ô nhập).
- **Để tới bước 8** (lớp trang trí, thêm lúc nào cũng được): nền hoạ tiết `dau-trang-do-thi` và bộ ký hiệu, các component Animate UI,
  hiệu ứng vào trang / đếm số / confetti, chốt logo, trang giới thiệu.
- Ở bước 1–7: nền `cham-bi` hoặc `tron`, logo tạm, chỉ hiệu ứng tối thiểu (hover, bấm, đổi màu trạng thái).

## Để sau
Danh sách ý tưởng trang trí/tính năng phụ — **chỉ ghi vào đây, không làm giữa chừng**; làm một lượt ở bước 8 (hoặc khi người dùng yêu cầu).
- (trống — thêm dòng mới khi có ý tưởng)

## AI hỗ trợ chấm tự luận (bước 11 — làm sau bản đầu)
- **AI chỉ gợi ý, giáo viên duyệt điểm cuối cùng.** Học sinh/phụ huynh chỉ thấy điểm sau khi giáo viên duyệt.
- Giáo viên soạn **tiêu chí chấm** cho bài tự luận: đáp án mẫu, thang điểm từng ý, lỗi hay gặp, 2–3 bài mẫu đã chấm.
- Database (migration mới): `rubrics` (assignment_id, nội dung tiêu chí, điểm từng ý, bài mẫu) và `ai_gradings`
  (submission_id, nhà cung cấp, model, điểm gợi ý từng ý, nhận xét, mức chắc chắn, trạng thái `pending|done|error|approved`,
  **điểm cuối của giáo viên**, thời gian) — lưu lại cặp "gợi ý AI ↔ điểm giáo viên" để sau này làm dữ liệu huấn luyện.
- Edge Function `ai-grade`: chạy khi học sinh nộp và khi giáo viên bấm "Chấm lại"; gửi đề + tiêu chí + bài làm (ảnh viết tay thì đọc chữ trước),
  **không gửi họ tên, số điện thoại**. Nhà cung cấp đổi bằng biến cấu hình (`AI_PROVIDER`): mặc định **Groq** (gói miễn phí, không dùng dữ liệu để huấn luyện);
  **không** dùng gói miễn phí của dịch vụ có ghi rõ dùng dữ liệu để cải thiện sản phẩm cho bài làm thật của học sinh.
  API key lưu trong secret của Edge Function (người dùng tự nhập trên trang quản lý Supabase), không bao giờ ở frontend.
- Trang chấm: bài làm một bên, gợi ý AI một bên, nút "Duyệt" / sửa điểm / sửa nhận xét. Ghi rõ trong chính sách dữ liệu rằng bài làm có thể được AI hỗ trợ chấm.

## Vận hành & giới hạn Supabase
- **Gói Free tự tạm dừng project sau 1 tuần không hoạt động** và không có sao lưu tự động → khi dùng thật nên lên gói Pro.
  Nếu vẫn dùng Free: tạo GitHub Actions chạy mỗi đêm `supabase db dump` (sao lưu) và gửi một truy vấn nhẹ vài ngày một lần.
- **Dung lượng file (Free 1 GB):** nén ảnh ở client trước khi tải lên (dài nhất ~1600px, ~300–500 KB); khuyến nghị giới hạn file 3–5 MB ở giao diện; dọn file năm học cũ.
- **Tải khi cả lớp làm bài cùng lúc:** gom thay đổi câu trả lời 1–2 giây mới gửi một lần; thời gian làm câu gửi ~15 giây/lần; thi thử cả lớp trước khi thi thật.
- **Email:** cấu hình Custom SMTP trước khi cho người dùng thật đăng ký.
- **Bảo mật:** mỗi migration mới phải bật RLS cho bảng mới và chạy lại Security Advisor của Supabase; không bao giờ đưa `service_role` vào frontend hay commit.

## Cấu trúc thư mục đề xuất
```
src/
  lib/supabase.ts          # client Supabase
  lib/types.ts             # npx supabase gen types typescript --project-id pkeyefjemrioatzkshoo > src/lib/types.ts
  hooks/                   # useAuth, useClasses, ...
  components/              # UI dùng chung
  pages/
    auth/                  # Login, Register
    teacher/               # Dashboard, Classes, ClassDetail, AssignmentEditor, Grading, Attendance, Tuition, Gradebook
    student/               # Dashboard, AssignmentList, TakeQuiz, SubmitEssay, MyAttendance, MyTuition
    parent/                # Dashboard, LinkChild, ChildAssignments, ChildAttendance, ChildTuition
  routes.tsx               # route bảo vệ theo role
  components/Logo.tsx      # logo tạm (hướng A), đổi một chỗ là đổi toàn web
  components/NenTrangTri.tsx
supabase/
  migrations/              # 0001–0008 đã áp dụng lên project
  functions/create-students/
  functions/ai-grade/      # bước 11
  seed.sql                 # dữ liệu mẫu: 1 giáo viên, 1 lớp, 5 học sinh, 2 phụ huynh (1 người có 2 con), 2 bài tập, 3 buổi học, gói học phí, khoản đã đóng
public/
  backgrounds/             # chép từ design/backgrounds/
  favicon.svg
design/
  softly-reference.json    # bản tham khảo phong cách gốc (đã được chỉnh lại trong mục "Thiết kế giao diện")
  tsa/                     # ảnh mẫu giao diện phòng thi TSA
  backgrounds/             # SVG hoạ tiết nền: doodle-toan, goc-hinh-hoc, ky-hieu-giai-tich/hinh-hoc/xac-suat
  mau/                     # ảnh PNG các màn mẫu do người dùng xuất từ bảng thiết kế
```

## Biến môi trường
`.env.local` (không commit, có `.env.example`):
```
VITE_SUPABASE_URL=https://pkeyefjemrioatzkshoo.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key: sb_publishable_...>
```
Chỉ dùng publishable/anon key ở frontend. Không bao giờ đưa `service_role` / secret key vào code hoặc commit.

## Thứ tự triển khai (làm từng bước, chạy thử xong mới sang bước sau)
**Ưu tiên bản đầu: điểm danh + học phí theo buổi + bài tập về nhà.** Luyện đề TSA làm sau, khi phần này đã chạy ổn với lớp thật.
1. Khởi tạo Vite + React + TS + Tailwind + Router + shadcn/ui; dựng **hệ thống thiết kế** (token màu, font tiếng Việt, thanh điều hướng nổi, `<Logo />` tạm, `<NenTrangTri kieu="cham-bi" />`) và trang `/styleguide` để duyệt — **chốt và dừng phần thiết kế ở đây**; trang đăng nhập/đăng ký theo mục "Đăng nhập & tài khoản".
2. Database đã có sẵn: sinh types, kết nối Supabase Auth (đăng ký có chọn vai trò), phân quyền route theo role, viết `seed.sql` dữ liệu mẫu (có buổi học, gói học phí, khoản đã đóng).
3. Quản lý lớp, mã tham gia, thêm học sinh; Edge Function `create-students` để tạo tài khoản hàng loạt từ CSV; cài đặt học phí của lớp.
4. **Điểm danh** (ưu tiên điện thoại) + **học phí theo số buổi**: trang Học phí theo tháng, thêm gói, ghi nhận đóng tiền, xuất Excel; học sinh xem số buổi còn lại.
5. **Bài tập về nhà**: trang Bài tập của học sinh (dải 7 ngày, tab có số lượng, khuôn thẻ cố định); giao bài có hạn nộp; trắc nghiệm 3 loại câu (nhiều lựa chọn, đúng/sai, trả lời ngắn) chấm tự động; tự luận nộp text/ảnh/file, giáo viên chấm và nhận xét; nhập/xuất Excel câu hỏi; theo dõi ai đã nộp / chưa nộp.
6. Bảng điểm, xuất Excel/CSV, dashboard giáo viên và học sinh.
7. Phụ huynh: trang in mã phụ huynh cho giáo viên, trang liên kết con, các trang chỉ xem (điểm danh, học phí, bài tập), dashboard phụ huynh.
8. Hoàn thiện bản đầu: responsive, trạng thái loading/lỗi; **lớp trang trí** (nền `dau-trang-do-thi` + bộ ký hiệu, Animate UI, hiệu ứng, chốt logo, làm hết mục "Để sau"); sao lưu tự động; hướng dẫn deploy — **đưa vào dùng thử với một lớp**.
9. Trang giới thiệu (landing page).
10. Luyện đề TSA: tạo khung đề 3 phần, soạn câu có đoạn văn/kéo thả/LaTeX/ảnh, phòng thi theo ảnh mẫu, trang kết quả và thống kê.
11. AI hỗ trợ chấm tự luận (mục "AI hỗ trợ chấm tự luận").

## Quy ước khi làm việc
- Sau mỗi bước: chạy `npm run build` và `npm run lint`, sửa hết lỗi, rồi **dừng lại tóm tắt cho người dùng duyệt** trước khi sang bước sau.
- Mọi thời gian lưu dạng `timestamptz`, hiển thị theo giờ Việt Nam, định dạng `dd/MM/yyyy HH:mm`.
- Thông báo lỗi thân thiện bằng tiếng Việt, không hiện lỗi kỹ thuật thô cho người dùng.
- Giao diện ưu tiên dùng tốt trên điện thoại (học sinh hay làm bài bằng điện thoại).
- Không xoá cứng dữ liệu bài nộp; khi xoá lớp/bài tập phải hỏi xác nhận.
- Viết `README.md` hướng dẫn: tạo project Supabase, chạy migration, cấu hình `.env`, cấu hình Authentication (URL, SMTP), chạy local, deploy lên Vercel, sao lưu.

## Ngoài phạm vi (chưa làm ở bản đầu)
- Thu tiền trực tuyến (cổng thanh toán, QR ngân hàng tự đối soát), đăng nhập Google, thông báo email/Zalo (kể cả báo phụ huynh khi con vắng hoặc chưa nộp bài), chống gian lận nâng cao, nhiều giáo viên dùng chung một lớp, nhắn tin trong web giữa học sinh/phụ huynh và giáo viên, điểm thưởng/xu đổi quà.
