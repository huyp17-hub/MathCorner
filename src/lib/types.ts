// Alias tiện dùng + helper nhãn tiếng Việt, dựa trên types sinh từ DB thật.
// Sinh lại types: npx supabase gen types typescript --project-id pkeyefjemrioatzkshoo > src/lib/database.types.ts
import type { BadgeTone } from '@/components/ui/badge'
import type { Enums, Tables } from '@/lib/database.types'

export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'

// ---- Enum alias ----
export type Role = Enums<'user_role'>
export type AttendanceStatus = Enums<'attendance_status'>
export type SubmissionStatus = Enums<'submission_status'>
export type AssignmentType = Enums<'assignment_type'>
export type ExamFormat = Enums<'exam_format'>
export type QuestionKind = Enums<'question_kind'>
export type BillingMode = Enums<'billing_mode'>
export type PaymentMethod = Enums<'payment_method'>
export type ShowAnswersMode = Enums<'show_answers_mode'>

// ---- Row alias ----
export type Profile = Tables<'profiles'>
export type Class = Tables<'classes'>
export type ClassSession = Tables<'class_sessions'>
export type Attendance = Tables<'attendance'>
export type Assignment = Tables<'assignments'>
export type Submission = Tables<'submissions'>
export type TuitionPackage = Tables<'tuition_packages'>
export type TuitionPayment = Tables<'tuition_payments'>

// ---- Nhãn vai trò ----
export const roleLabel: Record<Role, string> = {
  teacher: 'Giáo viên',
  student: 'Học sinh',
  parent: 'Phụ huynh',
}

// Trang gốc theo vai trò (dùng cho điều hướng sau đăng nhập + bảo vệ route).
export const roleHome: Record<Role, string> = {
  teacher: '/teacher',
  student: '/student',
  parent: '/parent',
}

// ---- Điểm danh ----
export const attendanceLabel: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  late: 'Đi muộn',
  absent: 'Vắng không phép',
  excused: 'Vắng có phép',
}

export const attendanceTone: Record<AttendanceStatus, BadgeTone> = {
  present: 'ok',
  late: 'warn',
  absent: 'danger',
  excused: 'neutral',
}

// ---- Trạng thái bài nộp ----
// "Nộp muộn" không phải trạng thái riêng mà là cờ is_late; dùng submissionLabel() để gộp.
export function submissionLabel(
  status: SubmissionStatus | null | undefined,
  isLate = false,
): string {
  if (!status) return 'Chưa làm'
  if (status === 'in_progress') return 'Đang làm'
  if (status === 'graded') return 'Đã chấm'
  // submitted
  return isLate ? 'Nộp muộn' : 'Đã nộp'
}

export function submissionTone(
  status: SubmissionStatus | null | undefined,
  isLate = false,
): BadgeTone {
  if (!status) return 'neutral'
  if (status === 'graded') return 'ok'
  if (status === 'in_progress') return 'progress'
  return isLate ? 'warn' : 'progress'
}

// ---- Loại bài tập ----
export const assignmentTypeLabel: Record<AssignmentType, string> = {
  quiz: 'Trắc nghiệm',
  essay: 'Tự luận',
}

// ---- Hình thức đóng tiền ----
export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Tiền mặt',
  transfer: 'Chuyển khoản',
  other: 'Khác',
}

export const billingModeLabel: Record<BillingMode, string> = {
  package: 'Theo gói buổi',
  per_session: 'Theo buổi',
}
