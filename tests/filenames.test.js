const test = require('node:test');
const assert = require('node:assert/strict');
const { tableFilename, logFilename } = require('../src/filenames');

test('表格和日志文件名', () => {
  assert.equal(tableFilename('2026-07-09', '2026-10-09', 'xlsx', false), '淘宝订单_2026-07-09_2026-10-09.xlsx');
  assert.equal(tableFilename('2026-07-09', '2026-10-09', 'csv', true), '淘宝订单_2026-07-09_2026-10-09_部分.csv');
  assert.equal(logFilename(new Date(2026, 9, 9, 21, 5, 7)), '淘宝订单_导出日志_20261009_210507.txt');
});
