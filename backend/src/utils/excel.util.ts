import XLSX from 'xlsx';

interface ColumnDef {
  key: string;
  header: string;
  format?: (val: any) => string;
}

/**
 * Generate an Excel file buffer from data array
 */
export async function generateExcelReport(
  sheetName: string,
  data: any[],
  columns: ColumnDef[]
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();

  // Build rows with headers
  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const keys = col.key.split('.');
      let val: any = item;
      for (const k of keys) val = val?.[k];
      if (col.format) return col.format(val);
      if (val instanceof Date) return val.toLocaleDateString('en-IN');
      return val ?? '';
    })
  );

  const wsData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Style header row
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = XLSX.utils.encode_cell({ r: 0, c });
    if (!worksheet[cell]) continue;
    worksheet[cell].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '1a1a2e' } },
      alignment: { horizontal: 'center' },
    };
  }

  // Auto-fit column widths
  const colWidths = columns.map((col, i) => {
    const maxLen = Math.max(
      col.header.length,
      ...rows.map((r) => String(r[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  worksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Parse Excel/CSV file buffer into JSON rows
 */
export function parseExcelFile(buffer: Buffer, sheetIndex = 0): Record<string, any>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[sheetIndex];
  if (!sheetName) throw new Error('No sheets found in the file');
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}

/**
 * Parse CSV string into JSON rows
 */
export function parseCSVString(csvText: string): Record<string, any>[] {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
}
