const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLegacyLogistics } = require('../src/parse-legacy-logistics');

test('从旧版物流页取出公司、运单号和最晚轨迹', () => {
  const html = `
    <div>
      <p>物流公司：<em>圆通速递</em></p>
      <p>运单号码：<em>YT100</em></p>
      <table>
        <tr><td>2025-11-02 09:01:00</td><td>派送中</td></tr>
        <tr><td>2025-11-02 16:21:08</td><td>已签收</td></tr>
      </table>
    </div>
  `;
  assert.deepEqual(parseLegacyLogistics(html), {
    ok: true,
    company: '圆通速递',
    trackingNo: 'YT100',
    latest: '已签收',
    packageCount: 1,
    hasTrace: true,
  });
});

test('从旧版订单详情表格取出物流公司和运单号', () => {
  const html = `
    <table>
      <tr><td>物流公司：</td><td>韵达快递</td></tr>
      <tr><td>运单号：</td><td>434673370490781</td></tr>
    </table>
  `;
  const parsed = parseLegacyLogistics(html);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.company, '韵达快递');
  assert.equal(parsed.trackingNo, '434673370490781');
});

test('详情页标签和数值分行时仍能取出运单号', () => {
  const html = `
    <tr><td>物流公司：</td></tr>
    <tr><td>韵达快递</td></tr>
    <tr><td>运单号：</td></tr>
    <tr><td>434673370490781</td></tr>
  `;
  const parsed = parseLegacyLogistics(html);
  assert.equal(parsed.company, '韵达快递');
  assert.equal(parsed.trackingNo, '434673370490781');
});

test('旧版页面没有物流时失败', () => {
  assert.deepEqual(parseLegacyLogistics('<html><body>暂无物流</body></html>'), {
    ok: false,
    reason: '旧版物流页无物流信息',
  });
});
