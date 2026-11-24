import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('vi')

export const TIMEZONE = 'Asia/Ho_Chi_Minh'

/** Đổi tên đăng nhập của học sinh thành email ẩn mà Supabase Auth chấp nhận. */
export function toEmail(login: string): string {
  const v = login.trim()
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@hs.local`
}

/** dd/MM/yyyy HH:mm theo giờ Việt Nam. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).tz(TIMEZONE).format('DD/MM/YYYY HH:mm')
}

/** dd/MM/yyyy theo giờ Việt Nam. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return dayjs(value).tz(TIMEZONE).format('DD/MM/YYYY')
}

/** Tiền kiểu Việt Nam, ví dụ 1.200.000 đ. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`
}

/** ISO → giá trị cho <input type="datetime-local"> (giờ Việt Nam). */
export function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  return dayjs(value).tz(TIMEZONE).format('YYYY-MM-DDTHH:mm')
}

/** Giá trị <input type="datetime-local"> (hiểu theo giờ Việt Nam) → ISO. */
export function fromLocalInput(local: string): string {
  return dayjs.tz(local, TIMEZONE).toISOString()
}

/** Mô tả hạn nộp thân thiện + cờ gấp (còn < 24 giờ) / quá hạn. */
export function describeDue(dueIso: string): {
  text: string
  overdue: boolean
  urgent: boolean
} {
  const due = dayjs(dueIso).tz(TIMEZONE)
  const now = dayjs().tz(TIMEZONE)
  const overdue = due.isBefore(now)
  const diffH = due.diff(now, 'hour')
  const urgent = !overdue && diffH < 24
  let text: string
  if (overdue) text = `Quá hạn ${formatDateTime(dueIso)}`
  else if (diffH < 1) text = `Còn ${Math.max(1, due.diff(now, 'minute'))} phút`
  else if (diffH < 24) text = `Còn ${diffH} giờ`
  else text = `Hạn ${formatDateTime(dueIso)}`
  return { text, overdue, urgent }
}
