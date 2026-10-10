const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { COLUMNS } = require('../src/columns');
const { exportTable, encodeLogText } = require('../src/export-table');

const rows = [
  {
    订单号: '100',
    下单时间: '2026-10-01 10:00:00',
    店铺: '示例店',
    商品名称: '杯子, "大号"',
    规格: '白色',
    数量: '1',
    单价: '10.00',
    订单实付: '10.00',
    订单状态: '交易成功',
    物流公司: '中通',
    运单号: 'ZT1',
    最新物流: '已签收\n本人',
  },
];

test('CSV 带 BOM，并按 RFC 4180 转义', () => {
  const file = exportTable(rows, 'csv');
  assert.equal(file.mime, 'text/csv;charset=utf-8');
  assert.equal(file.bytes[0], 0xEF);
  assert.equal(file.bytes[1], 0xBB);
  assert.equal(file.bytes[2], 0xBF);
  const text = new TextDecoder('utf-8').decode(file.bytes.slice(3));
  const lines = text.split('\r\n');
  assert.equal(lines[0], COLUMNS.join(','));
  assert.equal(lines[1].startsWith('100,2026-10-01 10:00:00,示例店,"杯子, ""大号""",白色,1,10.00,10.00,交易成功,中通,ZT1,"已签收\n本人"'), true);
  assert.equal(lines[2], '');
});

test('Excel 工作表名叫订单，列顺序正确', () => {
  const file = exportTable(rows, 'xlsx');
  const book = XLSX.read(file.bytes, { type: 'array' });
  assert.deepEqual(book.SheetNames, ['订单']);
  const aoa = XLSX.utils.sheet_to_json(book.Sheets['订单'], { header: 1 });
  assert.deepEqual(aoa[0], COLUMNS);
  assert.equal(aoa[1][0], '100');
  assert.equal(aoa[1][3], '杯子, "大号"');
  assert.equal(aoa[1][11], '已签收\n本人');
});

test('日志文本带 UTF-8 BOM', () => {
  const bytes = encodeLogText('21:05:07 [信息] 导出完成\n');
  assert.equal(bytes[0], 0xEF);
  assert.equal(new TextDecoder('utf-8').decode(bytes.slice(3)), '21:05:07 [信息] 导出完成\n');
});
