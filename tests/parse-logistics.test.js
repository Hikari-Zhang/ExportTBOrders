const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLogisticsBody } = require('../src/parse-logistics');

test('取时间最晚的一条轨迹', () => {
  const parsed = parseLogisticsBody({
    isSuccess: 'true',
    expressName: '中通',
    expressId: 'ZT1',
    address: [
      { time: '2026-10-01 08:00:00', place: '已揽收' },
      { time: '2026-10-02 09:00:00', place: '已签收' },
    ],
  });
  assert.deepEqual(parsed, {
    ok: true,
    company: '中通',
    trackingNo: 'ZT1',
    latest: '已签收',
    packageCount: 1,
    hasTrace: true,
  });
});

test('没有轨迹时 latest 为空', () => {
  const parsed = parseLogisticsBody({
    isSuccess: 'true',
    expressName: '中通',
    expressId: 'ZT1',
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.latest, '');
  assert.equal(parsed.hasTrace, false);
});

test('多个包裹用分号拼接，最新物流仍取最晚一条', () => {
  const parsed = parseLogisticsBody({
    isSuccess: 'true',
    expressName: ['中通', '韵达'],
    expressId: ['ZT1', 'YD2'],
    traceList: [
      { status_time: '2026-10-01 08:00:00', status_desc: '运输中' },
      { status_time: '2026-10-03 08:00:00', status_desc: '已签收' },
    ],
  });
  assert.equal(parsed.company, '中通；韵达');
  assert.equal(parsed.trackingNo, 'ZT1；YD2');
  assert.equal(parsed.latest, '已签收');
  assert.equal(parsed.packageCount, 2);
});

test('packages 数组也算多个包裹', () => {
  const parsed = parseLogisticsBody({
    isSuccess: 'true',
    packages: [
      { expressName: '中通', expressId: 'ZT1' },
      { company: '韵达', mailNo: 'YD2' },
    ],
    transitStepInfo: [{ time: '2026-10-02 01:00:00', desc: '派送中' }],
  });
  assert.equal(parsed.company, '中通；韵达');
  assert.equal(parsed.trackingNo, 'ZT1；YD2');
  assert.equal(parsed.packageCount, 2);
  assert.equal(parsed.latest, '派送中');
});

test('包裹空槽保留位置，公司和运单号仍然对齐', () => {
  const parsed = parseLogisticsBody({
    isSuccess: 'true',
    packages: [
      { expressName: '中通', expressId: '' },
      { expressName: '', mailNo: 'YD2' },
    ],
  });
  assert.equal(parsed.company, '中通；');
  assert.equal(parsed.trackingNo, '；YD2');
  assert.equal(parsed.packageCount, 2);
});

test('接口成功但没有公司和运单号', () => {
  const parsed = parseLogisticsBody({ isSuccess: 'true' });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.company, '');
  assert.equal(parsed.trackingNo, '');
  assert.equal(parsed.packageCount, 0);
});

test('isSuccess 不是 true 时失败', () => {
  const parsed = parseLogisticsBody({ isSuccess: 'false' });
  assert.deepEqual(parsed, { ok: false, reason: 'isSuccess=false' });
});
