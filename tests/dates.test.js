const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultRange, classifyTime, formatYmd } = require('../src/dates');

test('默认范围是最近 3 个日历月', () => {
  const range = defaultRange(new Date(2026, 9, 9, 21, 0, 0));
  assert.deepEqual(range, { startDate: '2026-07-09', endDate: '2026-10-09' });
  assert.equal(formatYmd(new Date(2026, 0, 5)), '2026-01-05');
});

test('时间边界按本地日历日判断', () => {
  assert.equal(classifyTime('2026-07-09 00:00:00', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('2026-07-08 23:59:59', '2026-07-09', '2026-10-09'), 'before');
  assert.equal(classifyTime('2026-10-09 23:59:59', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('2026-10-10 00:00:00', '2026-07-09', '2026-10-09'), 'after');
  assert.equal(classifyTime('2026-10-09', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('', '2026-07-09', '2026-10-09'), 'invalid');
  assert.equal(classifyTime('昨天', '2026-07-09', '2026-10-09'), 'invalid');
});
