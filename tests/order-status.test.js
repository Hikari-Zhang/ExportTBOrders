const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesStatus, statusLabel, officialOrderStatuses } = require('../src/order-status');

test('未传状态时保留全部订单', () => {
  assert.equal(matchesStatus('交易成功', undefined), true);
  assert.equal(matchesStatus('待发货', ['all']), true);
});

test('按所选状态匹配淘宝文案', () => {
  assert.equal(matchesStatus('等待买家付款', ['wait-pay']), true);
  assert.equal(matchesStatus('等待卖家发货', ['wait-send']), true);
  assert.equal(matchesStatus('卖家已发货', ['wait-receive']), true);
  assert.equal(matchesStatus('卖家已发货', ['wait-send']), false);
  assert.equal(matchesStatus('交易成功', ['success', 'closed']), true);
  assert.equal(matchesStatus('交易关闭', ['success']), false);
  assert.equal(matchesStatus('退款成功', ['refund']), true);
  assert.equal(matchesStatus('退款成功', ['success']), false);
  assert.equal(statusLabel('success'), '交易成功');
  assert.deepEqual(officialOrderStatuses(['success']), ['TRADE_FINISHED']);
  assert.deepEqual(officialOrderStatuses(['wait-pay', 'closed']), ['WAIT_BUYER_PAY', 'TRADE_CLOSED']);
  assert.deepEqual(officialOrderStatuses(undefined), ['']);
});
