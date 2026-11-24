/**
 * Xuất mảng object ra file Excel (.xlsx) và tải về.
 * rows: mỗi phần tử một hàng; khoá của object là tiêu đề cột.
 * Nạp thư viện `xlsx` động để không làm nặng bundle khi chưa cần xuất file.
 */
export async function exportToXlsx(
  rows: Record<string, string | number | null>[],
  fileName: string,
  sheetName = 'Sheet1',
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}
