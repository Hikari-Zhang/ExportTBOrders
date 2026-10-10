const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger, formatLogLine } = require('../src/logger');

test('日志行使用本地时间和级别', () => {
  const date = new Date(2026, 9, 9, 21, 5, 7);
  assert.equal(formatLogLine(date, '信息', '导出完成'), '21:05:07 [信息] 导出完成');
  assert.equal(formatLogLine(date, '警告', '有 1 笔订单没查到物流'), '21:05:07 [警告] 有 1 笔订单没查到物流');
  assert.equal(formatLogLine(date, '错误', '未登录或登录已失效，已停止'), '21:05:07 [错误] 未登录或登录已失效，已停止');
});

test('logger 按调用顺序保留全文', () => {
  const date = new Date(2026, 9, 9, 21, 5, 7);
  const logger = createLogger(() => date);
  logger.info('导出完成');
  logger.warn('有 1 笔订单没查到物流');
  logger.error('未登录或登录已失效，已停止');
  assert.deepEqual(logger.lines, [
    '21:05:07 [信息] 导出完成',
    '21:05:07 [警告] 有 1 笔订单没查到物流',
    '21:05:07 [错误] 未登录或登录已失效，已停止',
  ]);
  assert.equal(logger.text(), '21:05:07 [信息] 导出完成\n21:05:07 [警告] 有 1 笔订单没查到物流\n21:05:07 [错误] 未登录或登录已失效，已停止\n');
});
