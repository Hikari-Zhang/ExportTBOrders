const test = require('node:test');
const assert = require('node:assert/strict');
const { runExport } = require('../src/run-export');

function order(id, createTime, status, title) {
  return {
    id,
    orderInfo: { createTime },
    seller: { shopName: '示例店' },
    payInfo: { actualFee: '10.00' },
    statusInfo: { text: status },
    subOrders: [
      { quantity: 1, itemInfo: { title, skuText: '默认' }, priceInfo: { price: '10.00' } },
    ],
  };
}

function harness(pages, logistics, options = {}) {
  const logs = [];
  const progress = [];
  let stops = options.stops || (() => null);
  return {
    logs,
    progress,
    input: {
      startDate: options.startDate || '2026-07-09',
      endDate: options.endDate || '2026-10-09',
      format: 'xlsx',
      async fetchPage(pageNum) {
        const page = pages[pageNum];
        if (page instanceof Error) throw page;
        if (!page) return { ok: true, status: 200, text: JSON.stringify({ mainOrders: [] }) };
        return page;
      },
      async fetchLogistics(orderId) {
        const item = logistics[orderId];
        if (item instanceof Error) throw item;
        return item;
      },
      async sleep() {},
      shouldStop: () => stops(),
      now: () => new Date(2026, 9, 9, 21, 5, 7),
      onProgress(text) { progress.push(text); },
      onLog(line) { logs.push(line); },
    },
    setStop(fn) { stops = fn; },
  };
}

function messagesOf(logs) {
  return logs.map((line) => line.slice(line.indexOf(']') + 2));
}

test('范围内订单一行一件，未发货不查物流，查到轨迹', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('1', '2026-10-08 09:00:00', '交易成功', '杯子'),
          order('2', '2026-10-08 10:00:00', '待发货', '碟子'),
        ],
      }),
    },
  };
  const h = harness(pages, {
    1: { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'true', expressName: '中通', expressId: 'ZT1', address: [{ time: '2026-10-08 12:00:00', place: '已签收' }] }) },
  });
  const result = await runExport(h.input);
  assert.equal(result.status, 'complete');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]['运单号'], 'ZT1');
  assert.equal(result.rows[0]['最新物流'], '已签收');
  assert.equal(result.rows[1]['物流公司'], '');
  const texts = messagesOf(h.logs);
  assert.ok(texts.includes('开始导出。范围 2026-07-09 至 2026-10-09，格式 xlsx'));
  assert.ok(texts.includes('正在读取第 1 页'));
  assert.ok(texts.includes('第 1 页返回 2 笔订单，其中 2 笔在时间范围内'));
  assert.ok(texts.includes('第 1 页后没有更多订单'));
  assert.ok(texts.includes('订单 2 状态为「待发货」，未发货，跳过物流查询'));
  assert.ok(texts.includes('正在查询物流 1/1，订单 1'));
  assert.ok(texts.includes('订单 1 物流：中通 ZT1 已签收'));
  assert.ok(texts.includes('共 2 笔订单，2 行商品'));
  assert.equal(h.progress[0], '正在读取第 1 页，已得到 0 笔订单');
  assert.ok(h.progress.includes('正在查询物流 1 / 1'));
});

test('晚于结束日期继续翻，早于开始日期停止', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('new', '2026-10-10 00:00:01', '交易成功', '新'),
          order('old', '2026-07-08 23:59:59', '交易成功', '旧'),
        ],
      }),
    },
  };
  const h = harness(pages, {});
  const result = await runExport(h.input);
  assert.equal(result.status, 'empty');
  const texts = messagesOf(h.logs);
  assert.ok(texts.includes('跳过订单 new，下单时间 2026-10-10 00:00:01 晚于结束日期'));
  assert.ok(texts.includes('订单 old 下单时间 2026-07-08 23:59:59 早于开始日期，停止翻页'));
  assert.ok(texts.includes('时间范围内没有订单，未下载表格'));
  assert.equal(pages[2], undefined);
});

test('结束日 23:59:59 保留', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({ mainOrders: [order('edge', '2026-10-09 23:59:59', '待付款', '边缘')] }),
    },
  };
  const h = harness(pages, {});
  const result = await runExport(h.input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]['订单号'], 'edge');
});

test('第一页失败后重试成功', async () => {
  let calls = 0;
  const h = harness({}, {});
  h.input.fetchPage = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 500, text: 'no' };
    return { ok: true, status: 200, text: JSON.stringify({ mainOrders: [] }) };
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'empty');
  assert.equal(calls, 2);
  assert.ok(messagesOf(h.logs).includes('第 1 页读取失败，正在重试。原因：HTTP 500'));
});

test('重试仍失败时可以部分导出已拿到的订单', async () => {
  const full = JSON.stringify({
    mainOrders: Array.from({ length: 15 }, (_, index) => order(String(index + 1), '2026-10-01 10:00:00', '待发货', '商品')),
  });
  const h = harness({
    1: { ok: true, status: 200, text: full },
    2: { ok: false, status: 500, text: 'no' },
  }, {});
  const result = await runExport(h.input);
  assert.equal(result.status, 'partial-ready');
  assert.equal(result.orderCount, 15);
  assert.equal(result.keptOrders.length, 15);
  assert.ok(messagesOf(h.logs).some((line) => line.includes('第 2 页重试后仍失败')));
});

test('未登录、验证码、无法识别都停止', async () => {
  const login = harness({ 1: { ok: true, status: 200, text: 'https://login.taobao.com/member/login.jhtml' } }, {});
  assert.equal((await runExport(login.input)).status, 'stopped');
  assert.ok(messagesOf(login.logs).includes('未登录或登录已失效，已停止'));

  const captcha = harness({ 1: { ok: true, status: 200, text: JSON.stringify({ url: 'https://sec.taobao.com' }) } }, {});
  assert.equal((await runExport(captcha.input)).status, 'stopped');
  const captchaTexts = messagesOf(captcha.logs);
  const readingIdx = captchaTexts.findIndex((line) => line.includes('正在读取第 1 页'));
  const captchaIdx = captchaTexts.findIndex((line) => line.includes('触发验证码或风控'));
  assert.ok(readingIdx >= 0);
  assert.ok(captchaIdx >= 0);
  assert.ok(readingIdx < captchaIdx);

  const unknown = harness({ 1: { ok: true, status: 200, text: JSON.stringify({ foo: 1 }) } }, {});
  const unknownResult = await runExport(unknown.input);
  assert.equal(unknownResult.status, 'stopped');
  assert.ok(messagesOf(unknown.logs).includes('订单接口返回无法识别，已停止。响应字段：foo'));
});

test('物流失败留空并继续，多个包裹和无轨迹都有日志', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('a', '2026-10-01 10:00:00', '交易成功', '甲'),
          order('b', '2026-10-01 11:00:00', '交易成功', '乙'),
          order('c', '2026-10-01 12:00:00', '交易成功', '丙'),
          order('d', '2026-10-01 13:00:00', '交易成功', '丁'),
        ],
      }),
    },
  };
  const h = harness(pages, {
    a: new Error('offline'),
    b: { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'true', expressName: '中通', expressId: 'ZT1' }) },
    c: { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'true' }) },
    d: { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'true', expressName: ['中通', '韵达'], expressId: ['ZT1', 'YD2'], address: [{ time: '2026-10-02 00:00:00', place: '已签收' }] }) },
  });
  const result = await runExport(h.input);
  assert.equal(result.rows[0]['物流公司'], '');
  assert.equal(result.rows[1]['最新物流'], '');
  assert.equal(result.rows[2]['物流公司'], '');
  assert.equal(result.rows[3]['物流公司'], '中通；韵达');
  const texts = messagesOf(h.logs);
  assert.ok(texts.includes('订单 a 物流查询失败，物流列留空。原因：网络错误'));
  assert.ok(texts.includes('订单 b 物流：中通 ZT1，无轨迹'));
  assert.ok(texts.includes('订单 c 无物流信息'));
  assert.ok(texts.includes('订单 d 共 2 个包裹，已合并到同一格'));
  assert.ok(texts.includes('订单 d 物流：中通；韵达 ZT1；YD2 已签收'));
  assert.ok(texts.includes('有 1 笔订单没查到物流'));
});

test('取消时停止且不继续请求', async () => {
  let pageCalls = 0;
  const h = harness({}, {});
  h.input.fetchPage = async (pageNum) => {
    pageCalls += 1;
    if (pageNum === 1) {
      h.setStop(() => 'cancel');
      return {
        ok: true,
        status: 200,
        text: JSON.stringify({
          mainOrders: Array.from({ length: 15 }, (_, index) => order(String(index + 1), '2026-10-01 10:00:00', '待发货', '商品')),
        }),
      };
    }
    throw new Error('should not fetch next page');
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.equal(pageCalls, 1);
  assert.ok(messagesOf(h.logs).includes('已取消。已获取 15 笔订单，未继续请求'));
});

test('弹窗关闭使用单独文案', async () => {
  const h = harness({}, {});
  h.input.shouldStop = () => 'popup-closed';
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.ok(messagesOf(h.logs).includes('弹窗已关闭，导出已取消'));
});

test('第一页失败重试前已取消则不再请求', async () => {
  let pageCalls = 0;
  const h = harness({}, {});
  h.input.fetchPage = async () => {
    pageCalls += 1;
    h.setStop(() => 'cancel');
    return { ok: false, status: 500, text: 'no' };
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.equal(pageCalls, 1);
  assert.ok(messagesOf(h.logs).some((line) => line.includes('已取消')));
});

test('物流阶段开始前取消则不为 complete', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [order('only', '2026-10-01 10:00:00', '待发货', '商品')],
      }),
    },
  };
  const h = harness(pages, {});
  h.setStop(() => 'cancel');
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.notEqual(result.status, 'complete');
  assert.ok(messagesOf(h.logs).some((line) => line.includes('已取消')));
});

test('开始日期晚于结束日期时不发请求', async () => {
  let called = false;
  const h = harness({}, {});
  h.input.startDate = '2026-10-10';
  h.input.endDate = '2026-10-09';
  h.input.fetchPage = async () => { called = true; return { ok: true, status: 200, text: '{}' }; };
  const result = await runExport(h.input);
  assert.equal(result.status, 'stopped');
  assert.equal(called, false);
  assert.ok(messagesOf(h.logs).includes('开始日期 2026-10-10 晚于结束日期 2026-10-09，已停止'));
});
