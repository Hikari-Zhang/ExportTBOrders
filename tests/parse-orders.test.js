const test = require('node:test');
const assert = require('node:assert/strict');
const { COLUMNS } = require('../src/columns');
const { needsLogistics, buildRows } = require('../src/parse-orders');

function order(overrides) {
  return {
    id: '100',
    orderInfo: { createTime: '2026-10-01 10:00:00' },
    seller: { shopName: '示例店' },
    payInfo: { actualFee: '20.00' },
    statusInfo: { text: '交易成功' },
    subOrders: [
      {
        quantity: 1,
        itemInfo: { title: '杯子', skuText: '白色' },
        priceInfo: { price: '10.00' },
      },
    ],
    ...overrides,
  };
}

test('12 列顺序固定', () => {
  assert.deepEqual(COLUMNS, [
    '订单号', '下单时间', '店铺', '商品名称', '规格', '数量',
    '单价', '订单实付', '订单状态', '物流公司', '运单号', '最新物流',
  ]);
});

test('未发货状态不查物流', () => {
  assert.equal(needsLogistics('等待买家付款'), false);
  assert.equal(needsLogistics('待付款'), false);
  assert.equal(needsLogistics('等待卖家发货'), false);
  assert.equal(needsLogistics('待发货'), false);
  assert.equal(needsLogistics('交易关闭，未发货'), false);
  assert.equal(needsLogistics('卖家已发货'), true);
  assert.equal(needsLogistics('交易成功'), true);
  assert.equal(needsLogistics(''), true);
});

test('一笔订单两件商品得到两行，订单级字段重复', () => {
  const source = order({
    subOrders: [
      { quantity: 1, itemInfo: { title: '杯子', skuText: '白色' }, priceInfo: { price: '10.00' } },
      { quantity: 2, itemInfo: { title: '碟子', skuText: '大号' }, priceInfo: { price: '5.00' } },
    ],
  });
  const { rows, logs } = buildRows([source], {
    100: { company: '中通', trackingNo: 'ZT1', latest: '已签收' },
  });
  assert.equal(rows.length, 2);
  assert.equal(logs.length, 0);
  assert.equal(rows[0]['订单号'], '100');
  assert.equal(rows[1]['订单号'], '100');
  assert.equal(rows[0]['店铺'], '示例店');
  assert.equal(rows[1]['店铺'], '示例店');
  assert.equal(rows[0]['订单实付'], '20.00');
  assert.equal(rows[1]['订单实付'], '20.00');
  assert.equal(rows[0]['订单状态'], '交易成功');
  assert.equal(rows[1]['商品名称'], '碟子');
  assert.equal(rows[1]['规格'], '大号');
  assert.equal(rows[1]['数量'], '2');
  assert.equal(rows[0]['物流公司'], '中通');
  assert.equal(rows[1]['最新物流'], '已签收');
});

test('没有 subOrders 时仍输出一行，并警告缺字段', () => {
  const source = order({ subOrders: [] });
  const { rows, logs } = buildRows([source], {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['商品名称'], '');
  assert.equal(rows[0]['规格'], '');
  assert.equal(rows[0]['数量'], '');
  assert.equal(rows[0]['单价'], '');
  assert.equal(rows[0]['物流公司'], '');
  const messages = logs.map((entry) => entry.message);
  assert.ok(messages.includes('订单 100 缺少商品名称，该列留空'));
  assert.ok(messages.includes('订单 100 缺少规格，该列留空'));
  assert.ok(messages.includes('订单 100 缺少数量，该列留空'));
  assert.ok(messages.includes('订单 100 缺少单价，该列留空'));
  assert.ok(logs.every((entry) => entry.level === 'warn'));
});

test('没有单价时使用商品小计', () => {
  const source = order({
    subOrders: [
      { quantity: 1, itemInfo: { title: '杯子', skuText: '白色' }, priceInfo: { realTotal: '9.90' } },
    ],
  });
  const { rows, logs } = buildRows([source], {});
  assert.equal(rows[0]['单价'], '9.90');
  assert.deepEqual(logs, [{ level: 'warn', message: '订单 100 缺少单价，该列使用商品小计' }]);
});

test('缺少店铺时留空并警告，订单仍保留', () => {
  const source = order({ seller: {} });
  const { rows, logs } = buildRows([source], {});
  assert.equal(rows[0]['店铺'], '');
  assert.ok(logs.some((entry) => entry.message === '订单 100 缺少店铺，该列留空'));
});
