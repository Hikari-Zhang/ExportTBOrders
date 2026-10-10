const test = require('node:test');
const assert = require('node:assert/strict');
const { popupView } = require('../src/popup-state');

const orderUrl = 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm';

test('不在订单页时只能打开订单页', () => {
  const view = popupView({
    url: 'https://www.taobao.com/',
    running: false,
    startDate: '2026-07-09',
    endDate: '2026-10-09',
    result: null,
  });
  assert.equal(view.showOpenPage, true);
  assert.equal(view.exportDisabled, true);
  assert.equal(view.pageMessage, '当前页面不是「已买到的宝贝」，已停止');
});

test('日期颠倒时按钮不可用', () => {
  const view = popupView({
    url: orderUrl,
    running: false,
    startDate: '2026-10-10',
    endDate: '2026-10-09',
    result: null,
  });
  assert.equal(view.dateError, true);
  assert.equal(view.exportDisabled, true);
  assert.equal(view.exportLabel, '开始导出');
});

test('导出中按钮变成取消，结束后可导出已获取的部分', () => {
  const running = popupView({
    url: orderUrl,
    running: true,
    startDate: '2026-07-09',
    endDate: '2026-10-09',
    result: null,
  });
  assert.equal(running.exportLabel, '取消');
  assert.equal(running.exportDisabled, false);
  const partial = popupView({
    url: orderUrl,
    running: false,
    startDate: '2026-07-09',
    endDate: '2026-10-09',
    result: { status: 'partial-ready' },
  });
  assert.equal(partial.showPartial, true);
});
