const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildListQuery,
  describeListQuery,
  listFilterIgnored,
  attachToken,
  classicDatedQuery,
  applyPageNumber,
  parseCapturedBody,
} = require('../src/list-query');
test('第 1 页最新订单晚于结束日期时，说明服务端没按时间筛选', () => {
  const text = JSON.stringify({
    mainOrders: [{ id: '1', orderInfo: { createTime: '2026-10-10 08:30:18' } }],
  });
  assert.equal(listFilterIgnored(text, '2025-10-10'), true);
  assert.equal(listFilterIgnored(text, '2026-10-10'), false);
});

test('旧版时间筛选使用带时分秒的 dateBegin，并带上令牌', () => {
  const query = attachToken(classicDatedQuery({
    pageNum: 1,
    startDate: '2025-07-10',
    endDate: '2025-10-10',
    orderStatus: 'TRADE_FINISHED',
  }), 'token-1');
  assert.equal(query.dateBegin, '2025-07-10 00:00:00');
  assert.equal(query.dateEnd, '2025-10-10 23:59:59');
  assert.equal(query.startTime, undefined);
  assert.equal(query._tb_token_, 'token-1');
  assert.equal(applyPageNumber(query, 3).pageNum, '3');
  assert.equal(applyPageNumber(query, 3).prePageNo, '2');
});

test('能解析页面搜索提交的表单', () => {
  const query = parseCapturedBody('pageNum=1&dateBegin=2025-07-10&dateEnd=2025-10-10');
  assert.equal(query.dateBegin, '2025-07-10');
  assert.equal(query.dateEnd, '2025-10-10');
});

test('页面没有时间字段时，新旧两套日期都按纯日期提交', () => {
  const query = buildListQuery({
    pageNum: 1,
    startDate: '2025-07-10',
    endDate: '2025-10-10',
    orderStatus: 'TRADE_FINISHED',
  });
  assert.equal(query.dateBegin, '2025-07-10');
  assert.equal(query.dateEnd, '2025-10-10');
  assert.equal(query.startTime, '2025-07-10');
  assert.equal(query.endTime, '2025-10-10');
  assert.equal(query.queryMore, 'true');
  assert.equal(query.orderStatus, 'TRADE_FINISHED');
  assert.equal(query.tabCode, undefined);
  assert.equal(query.pageSize, '15');
});

test('旧版页面只有 dateBegin 时不附带新版时间字段', () => {
  const query = buildListQuery({
    pageNum: 2,
    startDate: '2025-07-10',
    endDate: '2025-10-10',
    dateFields: ['dateBegin', 'dateEnd'],
    archive: true,
    lastStartRow: 'row-9',
  });
  assert.equal(query.dateBegin, '2025-07-10');
  assert.equal(query.startTime, undefined);
  assert.equal(query.tabCode, 'before3Months');
  assert.equal(query.lastStartRow, 'row-9');
  assert.equal(query.prePageNo, '1');
  assert.match(describeListQuery(query), /dateBegin=2025-07-10/);
  assert.match(describeListQuery(query), /tabCode=before3Months/);
});

test('新版页面使用 startTime 时不附带旧版 dateBegin', () => {
  const query = buildListQuery({
    pageNum: 1,
    startDate: '2025-07-10',
    endDate: '2025-10-10',
    dateFields: ['startTime', 'endTime'],
  });
  assert.equal(query.startTime, '2025-07-10');
  assert.equal(query.endTime, '2025-10-10');
  assert.equal(query.dateBegin, undefined);
  assert.equal(query.queryMore, 'true');
});
