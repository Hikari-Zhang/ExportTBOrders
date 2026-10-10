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
  assert.ok(texts.includes('订单 old 下单时间 2026-07-08 23:59:59 早于开始日期，已跳过'));
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
  let logisticsCalls = 0;
  const h = harness({}, {});
  h.input.fetchPage = async () => {
    h.setStop(() => 'popup-closed');
    return {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [order('only', '2026-10-01 10:00:00', '待发货', '商品')],
      }),
    };
  };
  h.input.fetchLogistics = async () => {
    logisticsCalls += 1;
    return { ok: true, status: 200, text: '{}' };
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.equal(logisticsCalls, 0);
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
  let logisticsCalls = 0;
  const h = harness({}, {});
  h.input.fetchPage = async () => {
    h.setStop(() => 'cancel');
    return {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [order('only', '2026-10-01 10:00:00', '待发货', '商品')],
      }),
    };
  };
  h.input.fetchLogistics = async () => {
    logisticsCalls += 1;
    return { ok: true, status: 200, text: '{}' };
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'cancelled');
  assert.equal(logisticsCalls, 0);
  assert.ok(messagesOf(h.logs).some((line) => line.includes('已取消')));
});

test('物流风控立刻停止，不再请求后续订单', async () => {
  const calls = [];
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('shipped-1', '2026-10-01 10:00:00', '交易成功', '甲'),
          order('shipped-2', '2026-10-01 11:00:00', '交易成功', '乙'),
        ],
      }),
    },
  };
  const h = harness(pages, {});
  h.input.fetchLogistics = async (orderId) => {
    calls.push(orderId);
    if (orderId === 'shipped-1') {
      return { ok: true, status: 200, text: JSON.stringify({ rgv587_flag: 'sm' }) };
    }
    throw new Error('should not request later order');
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'partial-ready');
  assert.deepEqual(calls, ['shipped-1']);
  assert.equal(result.orderCount, 2);
  assert.deepEqual(result.logisticsById, {});
  assert.equal(result.keptOrders.length, 2);
  assert.ok(messagesOf(h.logs).some((line) => line.includes('触发验证码或风控')));
});

test('物流风控停止时保留已查到的物流', async () => {
  const calls = [];
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('ok-1', '2026-10-01 10:00:00', '交易成功', '甲'),
          order('risk-2', '2026-10-01 11:00:00', '交易成功', '乙'),
          order('later-3', '2026-10-01 12:00:00', '交易成功', '丙'),
        ],
      }),
    },
  };
  const h = harness(pages, {});
  h.input.fetchLogistics = async (orderId) => {
    calls.push(orderId);
    if (orderId === 'ok-1') {
      return {
        ok: true,
        status: 200,
        text: JSON.stringify({
          isSuccess: 'true',
          expressName: '中通',
          expressId: 'ZT1',
          address: [{ time: '2026-10-02 00:00:00', place: '已签收' }],
        }),
      };
    }
    if (orderId === 'risk-2') {
      return { ok: true, status: 200, text: JSON.stringify({ rgv587_flag: 'sm' }) };
    }
    throw new Error('should not request later order');
  };
  const result = await runExport(h.input);
  assert.equal(result.status, 'partial-ready');
  assert.deepEqual(calls, ['ok-1', 'risk-2']);
  assert.deepEqual(result.logisticsById, {
    'ok-1': { company: '中通', trackingNo: 'ZT1', latest: '已签收' },
  });
});

test('新接口没有物流时改查旧版物流页', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [{
          ...order('old-1', '2025-06-01 10:00:00', '交易成功', '旧订单'),
          seller: { shopName: '示例店', id: '9001' },
        }],
      }),
    },
  };
  const legacyCalls = [];
  const h = harness(pages, {
    'old-1': { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'false' }) },
  }, { startDate: '2025-01-01', endDate: '2025-12-31' });
  h.input.fetchLegacyLogistics = async (orderId) => {
    legacyCalls.push(orderId);
    return {
      ok: true,
      status: 200,
      text: '<p>物流公司：<em>圆通速递</em></p><p>运单号码：<em>YT100</em></p><p>2025-06-02 16:21:08 已签收</p>',
    };
  };
  const result = await runExport(h.input);
  assert.deepEqual(legacyCalls, ['old-1']);
  assert.equal(result.rows[0]['物流公司'], '圆通速递');
  assert.equal(result.rows[0]['运单号'], 'YT100');
  assert.equal(result.rows[0]['最新物流'], '已签收');
  assert.ok(messagesOf(h.logs).includes('订单 old-1 新接口无物流，改查旧版订单详情'));
  assert.ok(messagesOf(h.logs).includes('订单 old-1 物流：圆通速递 YT100 已签收'));
});

test('旧版页面含风控脚本字样时仍解析物流并继续后面的订单', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          { ...order('old-1', '2025-06-01 10:00:00', '交易成功', '旧'), seller: { shopName: '示例店', id: '9001' } },
          order('new-2', '2025-06-02 10:00:00', '交易成功', '新'),
        ],
      }),
    },
  };
  const h = harness(pages, {
    'old-1': { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'false' }) },
    'new-2': { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'true', expressName: '顺丰速运', expressId: 'SF1' }) },
  }, { startDate: '2025-01-01', endDate: '2025-12-31' });
  h.input.fetchLegacyLogistics = async () => ({
    ok: true,
    status: 200,
    text: '<script>var punish = true; 验证码</script><p>物流公司：<em>圆通速递</em></p><p>运单号码：<em>YT100</em></p><p>2025-06-02 16:21:08 已签收</p>',
  });
  const result = await runExport(h.input);
  assert.equal(result.status, 'complete');
  assert.equal(result.rows[0]['运单号'], 'YT100');
  assert.equal(result.rows[1]['运单号'], 'SF1');
  assert.equal(messagesOf(h.logs).some((line) => line.includes('触发验证码或风控')), false);
});

test('某一单旧版详情被拦截时，后面的订单仍查旧版详情', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('old-1', '2025-06-01 10:00:00', '交易成功', '旧'),
          order('old-2', '2025-06-02 10:00:00', '交易成功', '旧2'),
        ],
      }),
    },
  };
  let legacyCalls = 0;
  const h = harness(pages, {
    'old-1': { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'false' }) },
    'old-2': { ok: true, status: 200, text: JSON.stringify({ isSuccess: 'false' }) },
  }, { startDate: '2025-01-01', endDate: '2025-12-31' });
  h.input.fetchLegacyLogistics = async (orderId) => {
    legacyCalls += 1;
    if (orderId === 'old-1') return { ok: true, status: 200, text: '<html>_____tmd_____ x5secdata</html>' };
    return {
      ok: true,
      status: 200,
      text: '<p>物流公司：韵达快递</p><p>运单号：434673370490781</p>',
    };
  };
  const result = await runExport(h.input);
  assert.equal(legacyCalls, 2);
  assert.equal(result.status, 'complete');
  assert.equal(result.rows[1]['物流公司'], '韵达快递');
  assert.equal(result.rows[1]['运单号'], '434673370490781');
  assert.equal(messagesOf(h.logs).some((line) => line.includes('触发验证码或风控，已停止')), false);
});

test('只导出选中的订单状态', async () => {
  const pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          order('paid', '2026-10-01 10:00:00', '交易成功', '已完成'),
          order('unpaid', '2026-10-01 11:00:00', '等待买家付款', '未付款'),
        ],
      }),
    },
  };
  const h = harness(pages, {
    paid: {
      ok: true,
      status: 200,
      text: JSON.stringify({ isSuccess: 'true', expressName: '中通', expressId: 'ZT1' }),
    },
  });
  h.input.statuses = ['success'];
  const result = await runExport(h.input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]['订单号'], 'paid');
  assert.ok(messagesOf(h.logs).includes('导出所选状态：交易成功'));
  assert.ok(messagesOf(h.logs).includes('按订单状态搜索：交易成功（TRADE_FINISHED）'));
  assert.ok(messagesOf(h.logs).includes('订单 unpaid 状态为「等待买家付款」，不在所选状态中，已跳过'));
});

test('开始日期早于三个月时继续翻过插队的老订单，并读取三个月前列表', async () => {
  const calls = [];
  const h = harness({
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          ...Array.from({ length: 14 }, (_, index) => order(`recent-${index}`, '2026-04-23 00:33:16', '交易成功', '近期')),
          order('outlier', '2019-02-20 12:21:38', '交易成功', '插队'),
        ],
      }),
    },
    2: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [order('target', '2025-01-15 10:00:00', '交易成功', '目标')],
      }),
    },
  }, {});
  h.input.startDate = '2025-01-01';
  h.input.endDate = '2025-02-01';
  h.input.now = () => new Date(2026, 9, 10);
  h.input.fetchPage = async (pageNum, context = {}) => {
    calls.push({ pageNum, archive: !!context.archive, dateBegin: context.dateBegin, dateEnd: context.dateEnd });
    const page = h.pages[pageNum];
    if (!page) return { ok: true, status: 200, text: JSON.stringify({ mainOrders: [] }) };
    return page;
  };
  h.pages = {
    1: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [
          ...Array.from({ length: 14 }, (_, index) => order(`recent-${index}`, '2026-04-23 00:33:16', '交易成功', '近期')),
          order('outlier', '2019-02-20 12:21:38', '交易成功', '插队'),
        ],
      }),
    },
    2: {
      ok: true,
      status: 200,
      text: JSON.stringify({
        mainOrders: [order('target', '2025-01-15 10:00:00', '交易成功', '目标')],
      }),
    },
  };
  const result = await runExport(h.input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]['订单号'], 'target');
  assert.ok(calls.some((call) => call.pageNum === 2 && call.archive === false));
  assert.ok(calls.some((call) => call.archive === true));
  assert.equal(calls[0].dateBegin, '2025-01-01 00:00:00');
  assert.equal(calls[0].dateEnd, '2025-02-01 23:59:59');
  assert.ok(messagesOf(h.logs).includes('近期列表已翻完，开始读取三个月前的订单'));
  assert.ok(messagesOf(h.logs).includes('按成交时间搜索：2025-01-01 00:00:00 至 2025-02-01 23:59:59'));
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
