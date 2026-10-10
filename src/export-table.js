const XLSX = require('xlsx');
const { COLUMNS } = require('./columns');
const { withBom } = require('./log-file');

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowValues(row) {
  return COLUMNS.map((column) => (row[column] == null ? '' : String(row[column])));
}

function exportTable(rows, format) {
  if (format === 'csv') {
    const lines = [COLUMNS, ...rows.map(rowValues)].map((line) => line.map(escapeCell).join(','));
    const bytes = new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
    return { mime: 'text/csv;charset=utf-8', bytes: withBom(bytes) };
  }
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows.map(rowValues)]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '订单');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  return {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes: new Uint8Array(buffer),
  };
}

module.exports = { exportTable };
