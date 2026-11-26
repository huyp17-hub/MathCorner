import type { EditorChoice, EditorQuestion } from './api/assignments'
import type { QuestionKind } from './types'

const CHOICE_COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

type TypeCode = 'TN' | 'DS' | 'TLN' | 'KT'

const TYPE_MAP: Record<TypeCode, QuestionKind> = {
  TN: 'multiple_choice',
  DS: 'true_false',
  TLN: 'short_answer',
  KT: 'drag_drop',
}

const KIND_TO_CODE: Record<QuestionKind, TypeCode> = {
  multiple_choice: 'TN',
  true_false: 'DS',
  short_answer: 'TLN',
  drag_drop: 'KT',
}

const HEADERS = ['Phần', 'Đoạn văn', 'Loại', 'Câu hỏi', ...CHOICE_COLS, 'Đáp án', 'Lời giải', 'Điểm']

const COL_WIDTHS = [
  { wch: 18 }, { wch: 12 }, { wch: 6 }, { wch: 50 },
  { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
  { wch: 15 }, { wch: 40 }, { wch: 8 },
]

function defaultPts(kind: QuestionKind, isTsa: boolean): number {
  if (isTsa) return 1
  if (kind === 'true_false') return 1
  if (kind === 'short_answer') return 0.5
  return 0.25
}

export interface ImportError {
  row: number
  message: string
}

export interface ImportResult {
  questions: EditorQuestion[]
  errors: ImportError[]
}

let seq = 0
function key() {
  return `imp-${Date.now()}-${seq++}`
}

export async function parseQuestionsFromExcel(
  file: File,
  isTsa: boolean,
): Promise<ImportResult> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })

  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { questions: [], errors: [{ row: 0, message: 'File rỗng hoặc không đọc được.' }] }

  const rows = XLSX.utils.sheet_to_json<Record<string, string | number | undefined>>(ws, { defval: '' })
  if (rows.length === 0) return { questions: [], errors: [{ row: 0, message: 'Không có dữ liệu.' }] }

  const questions: EditorQuestion[] = []
  const errors: ImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const exRow = i + 2

    const typeStr = String(r['Loại'] ?? '').trim().toUpperCase()
    const content = String(r['Câu hỏi'] ?? '').trim()
    const ansStr = String(r['Đáp án'] ?? '').trim()
    const explanation = String(r['Lời giải'] ?? '').trim()
    const ptsRaw = r['Điểm']

    if (!typeStr) {
      errors.push({ row: exRow, message: 'Thiếu loại câu (cột "Loại").' })
      continue
    }
    const kind = TYPE_MAP[typeStr as TypeCode]
    if (!kind) {
      errors.push({ row: exRow, message: `Loại "${typeStr}" không hợp lệ. Dùng: TN, DS, TLN hoặc KT.` })
      continue
    }
    if (!content) {
      errors.push({ row: exRow, message: 'Thiếu nội dung câu hỏi.' })
      continue
    }
    if (kind === 'drag_drop') {
      errors.push({ row: exRow, message: 'Loại kéo thả (KT) chưa hỗ trợ nhập từ Excel.' })
      continue
    }

    const pts =
      ptsRaw !== undefined && String(ptsRaw).trim() !== ''
        ? Number(String(ptsRaw).replace(',', '.'))
        : defaultPts(kind, isTsa)
    if (isNaN(pts) || pts <= 0) {
      errors.push({ row: exRow, message: 'Điểm phải là số dương.' })
      continue
    }

    const vals = CHOICE_COLS.map((c) => String(r[c] ?? '').trim())
    const filled = vals.filter(Boolean)

    if (kind === 'multiple_choice') {
      if (filled.length < 2) {
        errors.push({ row: exRow, message: 'Trắc nghiệm cần ít nhất 2 phương án (cột A–F).' })
        continue
      }
      if (!ansStr) {
        errors.push({ row: exRow, message: 'Thiếu đáp án.' })
        continue
      }
      const letters = ansStr
        .split(/[,;\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
      let bad = false
      for (const l of letters) {
        const idx = CHOICE_COLS.indexOf(l as (typeof CHOICE_COLS)[number])
        if (idx < 0 || !vals[idx]) {
          errors.push({ row: exRow, message: `Đáp án "${l}" không hợp lệ hoặc trỏ vào ô trống.` })
          bad = true
          break
        }
      }
      if (bad) continue

      const correctSet = new Set(letters)
      const choices: EditorChoice[] = []
      for (let ci = 0; ci < vals.length; ci++) {
        if (vals[ci]) choices.push({ content: vals[ci], is_correct: correctSet.has(CHOICE_COLS[ci]) })
      }
      questions.push({
        key: key(),
        kind: 'multiple_choice',
        content,
        points: pts,
        multiple_correct: letters.length > 1,
        choices,
        answer_keys: [''],
        explanation,
        section_id: null,
        group_id: null,
      })
    } else if (kind === 'true_false') {
      if (filled.length < 1) {
        errors.push({ row: exRow, message: 'Đúng/Sai cần ít nhất 1 ý (cột A–F).' })
        continue
      }
      if (!ansStr) {
        errors.push({ row: exRow, message: 'Thiếu đáp án Đ/S.' })
        continue
      }
      const bools: boolean[] = []
      for (const ch of ansStr.toUpperCase()) {
        if (ch === 'Đ' || ch === 'D' || ch === 'T') bools.push(true)
        else if (ch === 'S' || ch === 'F') bools.push(false)
      }
      if (bools.length !== filled.length) {
        errors.push({
          row: exRow,
          message: `Số ký tự Đ/S (${bools.length}) khác số ý (${filled.length}).`,
        })
        continue
      }
      const choices: EditorChoice[] = filled.map((v, ci) => ({
        content: v,
        is_correct: bools[ci],
      }))
      questions.push({
        key: key(),
        kind: 'true_false',
        content,
        points: pts,
        multiple_correct: false,
        choices,
        answer_keys: [''],
        explanation,
        section_id: null,
        group_id: null,
      })
    } else if (kind === 'short_answer') {
      if (!ansStr) {
        errors.push({ row: exRow, message: 'Thiếu đáp án.' })
        continue
      }
      const keys = ansStr
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
      if (keys.length === 0) {
        errors.push({ row: exRow, message: 'Thiếu đáp án.' })
        continue
      }
      questions.push({
        key: key(),
        kind: 'short_answer',
        content,
        points: pts,
        multiple_correct: false,
        choices: [],
        answer_keys: keys,
        explanation,
        section_id: null,
        group_id: null,
      })
    }
  }

  return { questions, errors }
}

export async function exportQuestionsToExcel(
  questions: EditorQuestion[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx')

  const data = questions.map((q) => {
    const row: Record<string, string | number> = { Phần: '', 'Đoạn văn': '' }
    row['Loại'] = KIND_TO_CODE[q.kind] ?? ''
    row['Câu hỏi'] = q.content
    for (const c of CHOICE_COLS) row[c] = ''

    if (q.kind === 'multiple_choice' || q.kind === 'true_false') {
      q.choices.forEach((c, i) => {
        if (i < CHOICE_COLS.length) row[CHOICE_COLS[i]] = c.content
      })
    }

    if (q.kind === 'multiple_choice') {
      row['Đáp án'] = q.choices
        .map((c, i) => (c.is_correct ? CHOICE_COLS[i] : null))
        .filter(Boolean)
        .join(',')
    } else if (q.kind === 'true_false') {
      row['Đáp án'] = q.choices.map((c) => (c.is_correct ? 'Đ' : 'S')).join('')
    } else if (q.kind === 'short_answer') {
      row['Đáp án'] = q.answer_keys.filter(Boolean).join('|')
    }

    row['Lời giải'] = q.explanation
    row['Điểm'] = q.points
    return row
  })

  const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS })
  ws['!cols'] = COL_WIDTHS
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CauHoi')
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

export async function downloadQuestionTemplate(): Promise<void> {
  const XLSX = await import('xlsx')

  const samples = [
    {
      Phần: '', 'Đoạn văn': '', 'Loại': 'TN',
      'Câu hỏi': 'Nghiệm của phương trình $2x+1=5$ là:',
      A: '$x=1$', B: '$x=2$', C: '$x=3$', D: '$x=4$', E: '', F: '',
      'Đáp án': 'B', 'Lời giải': '$2x=4 \\Rightarrow x=2$', 'Điểm': '',
    },
    {
      Phần: '', 'Đoạn văn': '', 'Loại': 'TN',
      'Câu hỏi': 'Số nào là số nguyên tố?',
      A: '4', B: '7', C: '9', D: '11', E: '', F: '',
      'Đáp án': 'B,D', 'Lời giải': '7 và 11 là số nguyên tố.', 'Điểm': '',
    },
    {
      Phần: '', 'Đoạn văn': '', 'Loại': 'DS',
      'Câu hỏi': 'Cho hàm số $f(x)=x^2$. Xét các mệnh đề:',
      A: '$f(0)=0$', B: '$f(-1)=-1$', C: '$f(2)=4$', D: 'Hàm số luôn dương', E: '', F: '',
      'Đáp án': 'ĐSĐS', 'Lời giải': '', 'Điểm': '',
    },
    {
      Phần: '', 'Đoạn văn': '', 'Loại': 'TLN',
      'Câu hỏi': 'Tính $\\sqrt{25}$ = ?',
      A: '', B: '', C: '', D: '', E: '', F: '',
      'Đáp án': '5|5.0|5,0', 'Lời giải': '$\\sqrt{25}=5$', 'Điểm': '',
    },
  ]

  const ws = XLSX.utils.json_to_sheet(samples, { header: HEADERS })
  ws['!cols'] = COL_WIDTHS

  const dv = [
    { Mã: 'DV1', 'Tiêu đề': 'Đoạn văn mẫu', 'Nội dung': 'Nội dung đoạn văn dùng chung cho nhiều câu hỏi...' },
  ]
  const ws2 = XLSX.utils.json_to_sheet(dv, { header: ['Mã', 'Tiêu đề', 'Nội dung'] })
  ws2['!cols'] = [{ wch: 10 }, { wch: 25 }, { wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CauHoi')
  XLSX.utils.book_append_sheet(wb, ws2, 'DoanVan')
  XLSX.writeFile(wb, 'mau-cau-hoi.xlsx')
}
