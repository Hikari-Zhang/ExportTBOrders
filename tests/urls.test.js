const test = require('node:test');
const assert = require('node:assert/strict');
const { isOrderListUrl } = require('../src/urls');

test('只接受两个域名的已买到列表', () => {
  assert.equal(isOrderListUrl('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm'), true);
  assert.equal(isOrderListUrl('https://trade.taobao.com/trade/itemlist/list_bought_items.htm?spm=1'), true);
  assert.equal(isOrderListUrl('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm#tab'), true);
  assert.equal(isOrderListUrl('https://www.taobao.com/'), false);
  assert.equal(isOrderListUrl('https://buyertrade.taobao.com/trade/detail/trade_item_detail.htm'), false);
  assert.equal(isOrderListUrl('not a url'), false);
});
