import ExcelJS from 'exceljs';

/**
 * Build a real .xlsx Buffer in memory for tests that exercise import/parse
 * paths. Avoids mocking ExcelJS (intricate API surface) in favour of real
 * round-trip parsing — same fidelity the production code sees at runtime.
 */
export async function makeXlsxBuffer(
  rows: Record<string, unknown>[],
  sheetName = 'Sheet1',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  if (rows.length > 0) {
    ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k }));
    ws.addRows(rows);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Build an .xlsx buffer from raw 2D array — useful when tests need columns
 * without a header row (matches the header:1 + sheet_to_json shape that the
 * older xlsx-based parsers used).
 */
export async function makeXlsxBufferRaw(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
