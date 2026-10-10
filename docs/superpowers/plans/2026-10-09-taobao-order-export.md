# 淘宝订单导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个 Manifest V3 Chrome 插件，在已登录的淘宝「已买到的宝贝」页面上，按日期把订单导出成一行一件商品的 Excel 或 CSV，并带上物流公司和运单号、最新物流，同时写出完整日志。

**Architecture:** 纯函数放在 `src/`，用 Node 内置测试跑解析、日志、导出和翻页流程。订单页脚本和弹窗只负责发请求、展示和下载，由 esbuild 打成两个 IIFE。列表用 `asyncBought.htm`，物流用 `transit_step.do`。部分导出只使用已经拿到的数据，不再发新请求。

**Tech Stack:** Chrome Extension Manifest V3、CommonJS、Node.js 内置 `node:test`、esbuild、SheetJS（`xlsx`）。

**Spec:** `docs/superpowers/specs/2026-10-09-taobao-order-export-design.md`

## Global Constraints

- Manifest V3，用「加载已解压的扩展程序」安装。
- 不读页面卡片，不自己拼一套 mtop 签名客户端。
- 一行一件商品。同一订单的订单级字段在每一行重复。`subOrders` 为空时仍输出一行，商品四列留空。不因为缺字段丢掉整行。
- 弹窗自选开始日期和结束日期，默认最近 3 个月。结束日含当天 23:59:59。日期使用本地时区。`yyyy-mm-dd` 字符串可以直接比较先后。
- 下单时间无法解析时仍保留该订单，不把它当成停止翻页的信号。
- 格式只有 `xlsx` 和 `csv` 两种。
- 权限只有 `https://buyertrade.taobao.com/*` 和 `https://trade.taobao.com/*`。不申请 `downloads` 权限，用 `<a download>` 下载。
- 订单页：`https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm`。`trade.taobao.com` 的 `/trade/itemlist/` 同样注入。
- 列表：`POST https://buyertrade.taobao.com/trade/itemlist/asyncBought.htm?action=itemlist/BoughtQueryAction&event_submit_do_query=1&_input_charset=utf8`，表单 `pageNum`、`pageSize=15`、`prePageNo=pageNum-1`，`credentials: 'include'`。
- 物流：`GET https://buyertrade.taobao.com/trade/json/transit_step.do?bizOrderId={订单号}`，响应按 GBK 解码。两次物流请求间隔 400 毫秒。物流查询不自动重试。
- 状态文案包含「等待买家付款」「待付款」「等待卖家发货」「待发货」「未发货」之一时不查物流。
- 列表某一页失败时重试 1 次。未登录、验证码、无法识别的 JSON 立刻停止，不重试。
- 验证码或风控：响应正文包含 `验证码`、`_____tmd_____`、`x5secdata`、`punish`、`rgv587_flag`，或 JSON 没有 `mainOrders` 但有 `url`，或 `ret` 中含 `FAIL_SYS_USER_VALIDATE`。不绕过验证码。
- 未登录：正文包含 `login.taobao.com` 或 `passport.taobao.com`。
- 12 列顺序固定：订单号、下单时间、店铺、商品名称、规格、数量、单价、订单实付、订单状态、物流公司、运单号、最新物流。
- 单价用 `priceInfo.price`。没有时用 `priceInfo.realTotal`，并记警告「该列使用商品小计」。
- 轨迹数组依次查找 `address`、`traceList`、`transitStepInfo`。时间字段依次 `time`、`status_time`。说明字段依次 `place`、`status_desc`、`desc`。最新物流取时间最晚的一条。多个包裹用「；」拼接。
- Excel 一个工作表，表名「订单」。CSV 为 UTF-8 BOM，逗号分隔，按 RFC 4180 加引号，行分隔 `\r\n`。
- 日志一行：`HH:mm:ss [信息|警告|错误] 消息`。日志文件也加 UTF-8 BOM。不写入 Cookie、token、签名、手机号、完整收货地址、接口原始正文。
- 文件名：`淘宝订单_{开始}_{结束}.xlsx`、`淘宝订单_{开始}_{结束}_部分.xlsx`（csv 同理）、`淘宝订单_导出日志_{yyyyMMdd_HHmmss}.txt`。
- 点取消或关掉弹窗后，下一次请求前停止。关掉弹窗由内容脚本自己下载日志。部分导出不再发新请求。
- 进度摘要：`正在读取第 n 页，已得到 x 笔订单`，然后 `正在查询物流 i / m`（斜杠两侧有空格）。这不代替逐条日志。

## File Structure

| 文件 | 职责 |
| --- | --- |
| `src/messages.js` | 每条日志和两条进度文案的原文 |
| `src/logger.js` | 按本地时间把级别和消息收成行 |
| `src/dates.js` | 默认近 3 个月、时间比较 |
| `src/urls.js` | 是不是订单列表页 |
| `src/columns.js` | 12 列表头 |
| `src/parse-orders.js` | 是否查物流、把订单收成表格行、缺字段警告 |
| `src/parse-logistics.js` | 物流 JSON 收成公司、运单号、最新物流 |
| `src/classify-response.js` | 列表响应分成订单、未登录、验证码、无法识别、可重试 |
| `src/export-table.js` | 行变成 CSV 或 xlsx 字节 |
| `src/filenames.js` | 表格和日志文件名 |
| `src/decode.js` | GBK / UTF-8 解码 |
| `src/run-export.js` | 翻页、筛选、查物流、取消、汇总日志 |
| `src/popup-state.js` | 弹窗按钮和报错的纯状态 |
| `src/content-entry.js` | 内容脚本：端口、fetch、取消、关弹窗后下载日志 |
| `src/popup-entry.js` | 弹窗：日期、格式、进度、日志、下载 |
| `extension/manifest.json` | 插件清单 |
| `extension/popup/popup.html` | 弹窗页面 |
| `extension/popup/popup.css` | 弹窗样式 |
| `extension/popup/popup.js` | esbuild 产物 |
| `extension/content.js` | esbuild 产物 |
| `tests/*.test.js` | Node 测试 |
| `package.json` | 测试脚本和依赖 |
| `README.md` | 安装和人工核对步骤 |

---

### Task 1: 日志文案和日志行

**Files:**
- Create: `package.json`
- Create: `src/messages.js`
- Create: `src/logger.js`
- Test: `tests/messages.test.js`
- Test: `tests/logger.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `messages.start(startDate, endDate, format) -> string`，以及本任务代码里列出的全部 `messages.*`
  - `messages.progressPage(n, orderCount) -> string`
  - `messages.progressLogistics(i, total) -> string`
  - `createLogger(now = () => new Date()) -> { info(message), warn(message), error(message), lines, text() }`
  - `formatLogLine(date, level, message) -> string`

- [ ] **Step 1: 写失败测试**

`package.json`：

```json
{
  "name": "export-tb-orders",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

`tests/messages.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { messages } = require('../src/messages');

test('每条日志文案与设计说明一致', () => {
  assert.equal(messages.start('2026-07-09', '2026-10-09', 'xlsx'), '开始导出。范围 2026-07-09 至 2026-10-09，格式 xlsx');
  assert.equal(messages.wrongPage(), '当前页面不是「已买到的宝贝」，已停止');
  assert.equal(messages.badDate('2026-10-10', '2026-10-09'), '开始日期 2026-10-10 晚于结束日期 2026-10-09，已停止');
  assert.equal(messages.readingPage(2), '正在读取第 2 页');
  assert.equal(messages.pageOk(2, 15, 4), '第 2 页返回 15 笔订单，其中 4 笔在时间范围内');
  assert.equal(messages.skipNew('100', '2026-10-10 00:00:01'), '跳过订单 100，下单时间 2026-10-10 00:00:01 晚于结束日期');
  assert.equal(messages.stopOld('99', '2026-07-08 23:59:59'), '订单 99 下单时间 2026-07-08 23:59:59 早于开始日期，停止翻页');
  assert.equal(messages.noMore(3), '第 3 页后没有更多订单');
  assert.equal(messages.pageRetry(3, 'HTTP 500'), '第 3 页读取失败，正在重试。原因：HTTP 500');
  assert.equal(messages.pageFail(3, 'HTTP 500', 15), '第 3 页重试后仍失败，已停止翻页。原因：HTTP 500。已获取 15 笔订单');
  assert.equal(messages.notLogin(), '未登录或登录已失效，已停止');
  assert.equal(messages.captcha(15), '触发验证码或风控，已停止。请在订单页完成验证后再导出。已获取 15 笔订单');
  assert.equal(messages.unrecognized('url,token'), '订单接口返回无法识别，已停止。响应字段：url,token');
  assert.equal(messages.noOrders(), '时间范围内没有订单，未下载表格');
  assert.equal(messages.missingField('100', '店铺'), '订单 100 缺少店铺，该列留空');
  assert.equal(messages.usedSubtotal('100'), '订单 100 缺少单价，该列使用商品小计');
  assert.equal(messages.skipLogistics('100', '待发货'), '订单 100 状态为「待发货」，未发货，跳过物流查询');
  assert.equal(messages.queryingLogistics(1, 4, '100'), '正在查询物流 1/4，订单 100');
  assert.equal(messages.logisticsWithTrace('100', '中通', 'ZT1', '已签收'), '订单 100 物流：中通 ZT1 已签收');
  assert.equal(messages.logisticsNoTrace('100', '中通', 'ZT1'), '订单 100 物流：中通 ZT1，无轨迹');
  assert.equal(messages.noLogisticsInfo('100'), '订单 100 无物流信息');
  assert.equal(messages.multiPackage('100', 2), '订单 100 共 2 个包裹，已合并到同一格');
  assert.equal(messages.logisticsFail('100', '网络错误'), '订单 100 物流查询失败，物流列留空。原因：网络错误');
  assert.equal(messages.missingLogisticsCount(2), '有 2 笔订单没查到物流');
  assert.equal(messages.rowSummary(2, 3), '共 2 笔订单，3 行商品');
  assert.equal(messages.downloadedTable('淘宝订单_2026-07-09_2026-10-09.xlsx'), '已下载表格 淘宝订单_2026-07-09_2026-10-09.xlsx');
  assert.equal(messages.downloadedLog('淘宝订单_导出日志_20261009_210507.txt'), '已下载日志 淘宝订单_导出日志_20261009_210507.txt');
  assert.equal(messages.cancelled(2), '已取消。已获取 2 笔订单，未继续请求');
  assert.equal(messages.popupClosed(), '弹窗已关闭，导出已取消');
  assert.equal(messages.partialExported(2, 3, '淘宝订单_2026-07-09_2026-10-09_部分.xlsx'), '已导出已获取的部分。订单 2 笔，商品 3 行，文件 淘宝订单_2026-07-09_2026-10-09_部分.xlsx');
  assert.equal(messages.done(), '导出完成');
  assert.equal(messages.progressPage(2, 15), '正在读取第 2 页，已得到 15 笔订单');
  assert.equal(messages.progressLogistics(1, 4), '正在查询物流 1 / 4');
});
```

`tests/logger.test.js`：

```javascript
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
  assert.deepEqual(logger.lines, [
    '21:05:07 [信息] 导出完成',
    '21:05:07 [警告] 有 1 笔订单没查到物流',
  ]);
  assert.equal(logger.text(), '21:05:07 [信息] 导出完成\n21:05:07 [警告] 有 1 笔订单没查到物流\n');
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/messages.test.js tests/logger.test.js`

Expected: FAIL，`Cannot find module '../src/messages'`

- [ ] **Step 3: 写实现**

`src/messages.js`：

```javascript
const messages = {
  start(startDate, endDate, format) {
    return `开始导出。范围 ${startDate} 至 ${endDate}，格式 ${format}`;
  },
  wrongPage() {
    return '当前页面不是「已买到的宝贝」，已停止';
  },
  badDate(startDate, endDate) {
    return `开始日期 ${startDate} 晚于结束日期 ${endDate}，已停止`;
  },
  readingPage(n) {
    return `正在读取第 ${n} 页`;
  },
  pageOk(n, total, inRange) {
    return `第 ${n} 页返回 ${total} 笔订单，其中 ${inRange} 笔在时间范围内`;
  },
  skipNew(orderId, createTime) {
    return `跳过订单 ${orderId}，下单时间 ${createTime} 晚于结束日期`;
  },
  stopOld(orderId, createTime) {
    return `订单 ${orderId} 下单时间 ${createTime} 早于开始日期，停止翻页`;
  },
  noMore(n) {
    return `第 ${n} 页后没有更多订单`;
  },
  pageRetry(n, reason) {
    return `第 ${n} 页读取失败，正在重试。原因：${reason}`;
  },
  pageFail(n, reason, orderCount) {
    return `第 ${n} 页重试后仍失败，已停止翻页。原因：${reason}。已获取 ${orderCount} 笔订单`;
  },
  notLogin() {
    return '未登录或登录已失效，已停止';
  },
  captcha(orderCount) {
    return `触发验证码或风控，已停止。请在订单页完成验证后再导出。已获取 ${orderCount} 笔订单`;
  },
  unrecognized(keys) {
    return `订单接口返回无法识别，已停止。响应字段：${keys}`;
  },
  noOrders() {
    return '时间范围内没有订单，未下载表格';
  },
  missingField(orderId, fieldName) {
    return `订单 ${orderId} 缺少${fieldName}，该列留空`;
  },
  usedSubtotal(orderId) {
    return `订单 ${orderId} 缺少单价，该列使用商品小计`;
  },
  skipLogistics(orderId, status) {
    return `订单 ${orderId} 状态为「${status}」，未发货，跳过物流查询`;
  },
  queryingLogistics(index, total, orderId) {
    return `正在查询物流 ${index}/${total}，订单 ${orderId}`;
  },
  logisticsWithTrace(orderId, company, trackingNo, latest) {
    return `订单 ${orderId} 物流：${company} ${trackingNo} ${latest}`;
  },
  logisticsNoTrace(orderId, company, trackingNo) {
    return `订单 ${orderId} 物流：${company} ${trackingNo}，无轨迹`;
  },
  noLogisticsInfo(orderId) {
    return `订单 ${orderId} 无物流信息`;
  },
  multiPackage(orderId, packageCount) {
    return `订单 ${orderId} 共 ${packageCount} 个包裹，已合并到同一格`;
  },
  logisticsFail(orderId, reason) {
    return `订单 ${orderId} 物流查询失败，物流列留空。原因：${reason}`;
  },
  missingLogisticsCount(count) {
    return `有 ${count} 笔订单没查到物流`;
  },
  rowSummary(orderCount, rowCount) {
    return `共 ${orderCount} 笔订单，${rowCount} 行商品`;
  },
  downloadedTable(filename) {
    return `已下载表格 ${filename}`;
  },
  downloadedLog(filename) {
    return `已下载日志 ${filename}`;
  },
  cancelled(orderCount) {
    return `已取消。已获取 ${orderCount} 笔订单，未继续请求`;
  },
  popupClosed() {
    return '弹窗已关闭，导出已取消';
  },
  partialExported(orderCount, rowCount, filename) {
    return `已导出已获取的部分。订单 ${orderCount} 笔，商品 ${rowCount} 行，文件 ${filename}`;
  },
  done() {
    return '导出完成';
  },
  progressPage(n, orderCount) {
    return `正在读取第 ${n} 页，已得到 ${orderCount} 笔订单`;
  },
  progressLogistics(index, total) {
    return `正在查询物流 ${index} / ${total}`;
  },
};

module.exports = { messages };
```

`src/logger.js`：

```javascript
function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLogTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatLogLine(date, level, message) {
  return `${formatLogTime(date)} [${level}] ${message}`;
}

function createLogger(now = () => new Date()) {
  const lines = [];
  function push(level, message) {
    lines.push(formatLogLine(now(), level, message));
  }
  return {
    lines,
    info(message) { push('信息', message); },
    warn(message) { push('警告', message); },
    error(message) { push('错误', message); },
    text() {
      return lines.length ? `${lines.join('\n')}\n` : '';
    },
  };
}

module.exports = { createLogger, formatLogLine };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/messages.test.js tests/logger.test.js`

Expected: PASS，2 个测试文件全部通过

- [ ] **Step 5: 提交**

```powershell
git init
git add package.json src/messages.js src/logger.js tests/messages.test.js tests/logger.test.js
git commit -m "feat: add export log messages"
```

如果仓库已经存在，跳过 `git init`。如果提交失败是因为没有 git 用户名，停下来问用户，不要改 git config。

---

### Task 2: 日期范围和订单页地址

**Files:**
- Create: `src/dates.js`
- Create: `src/urls.js`
- Test: `tests/dates.test.js`
- Test: `tests/urls.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `formatYmd(date) -> string`
  - `defaultRange(now = new Date()) -> { startDate, endDate }`，结束日是今天，开始日是今天往前 3 个日历月
  - `classifyTime(createTime, startDate, endDate) -> 'before' | 'inside' | 'after' | 'invalid'`
  - `isOrderListUrl(url) -> boolean`

- [ ] **Step 1: 写失败测试**

`tests/dates.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultRange, classifyTime, formatYmd } = require('../src/dates');

test('默认范围是最近 3 个日历月', () => {
  const range = defaultRange(new Date(2026, 9, 9, 21, 0, 0));
  assert.deepEqual(range, { startDate: '2026-07-09', endDate: '2026-10-09' });
  assert.equal(formatYmd(new Date(2026, 0, 5)), '2026-01-05');
});

test('时间边界按本地日历日判断', () => {
  assert.equal(classifyTime('2026-07-09 00:00:00', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('2026-07-08 23:59:59', '2026-07-09', '2026-10-09'), 'before');
  assert.equal(classifyTime('2026-10-09 23:59:59', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('2026-10-10 00:00:00', '2026-07-09', '2026-10-09'), 'after');
  assert.equal(classifyTime('2026-10-09', '2026-07-09', '2026-10-09'), 'inside');
  assert.equal(classifyTime('', '2026-07-09', '2026-10-09'), 'invalid');
  assert.equal(classifyTime('昨天', '2026-07-09', '2026-10-09'), 'invalid');
});
```

`tests/urls.test.js`：

```javascript
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/dates.test.js tests/urls.test.js`

Expected: FAIL，`Cannot find module '../src/dates'`

- [ ] **Step 3: 写实现**

`src/dates.js`：

```javascript
function pad(value) {
  return String(value).padStart(2, '0');
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultRange(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return { startDate: formatYmd(start), endDate: formatYmd(end) };
}

function parseDateTime(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(String(text == null ? '' : text).trim());
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
}

function classifyTime(createTime, startDate, endDate) {
  const time = parseDateTime(createTime);
  if (!time) return 'invalid';
  const start = parseDateTime(startDate);
  start.setHours(0, 0, 0, 0);
  const end = parseDateTime(endDate);
  end.setHours(23, 59, 59, 999);
  if (time.getTime() < start.getTime()) return 'before';
  if (time.getTime() > end.getTime()) return 'after';
  return 'inside';
}

module.exports = { formatYmd, defaultRange, classifyTime };
```

`src/urls.js`：

```javascript
function isOrderListUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hostOk = parsed.hostname === 'buyertrade.taobao.com' || parsed.hostname === 'trade.taobao.com';
  return hostOk && parsed.pathname.startsWith('/trade/itemlist/');
}

module.exports = { isOrderListUrl };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/dates.test.js tests/urls.test.js`

Expected: PASS

- [ ] **Step 5: 提交**

```powershell
git add src/dates.js src/urls.js tests/dates.test.js tests/urls.test.js
git commit -m "feat: add order date range and page url check"
```

---

### Task 3: 订单解析成表格行

**Files:**
- Create: `src/columns.js`
- Create: `src/parse-orders.js`
- Test: `tests/parse-orders.test.js`

**Interfaces:**
- Consumes: `messages.missingField`、`messages.usedSubtotal`、`messages.skipLogistics`（本任务的 `needsLogistics` 不写日志，跳过日志由 Task 6 写）
- Produces:
  - `COLUMNS: string[]`，长度 12，顺序与 Global Constraints 一致
  - `needsLogistics(statusText) -> boolean`
  - `buildRows(orders, logisticsById) -> { rows, logs }`
  - `logs` 元素为 `{ level: 'info' | 'warn' | 'error', message: string }`
  - `rows` 元素是以中文列名为键的对象
  - `logisticsById` 的值是 `{ company, trackingNo, latest }`，缺省时三列为空字符串

- [ ] **Step 1: 写失败测试**

`tests/parse-orders.test.js`：

```javascript
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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/parse-orders.test.js`

Expected: FAIL，`Cannot find module '../src/columns'`

- [ ] **Step 3: 写实现**

`src/columns.js`：

```javascript
const COLUMNS = [
  '订单号',
  '下单时间',
  '店铺',
  '商品名称',
  '规格',
  '数量',
  '单价',
  '订单实付',
  '订单状态',
  '物流公司',
  '运单号',
  '最新物流',
];

module.exports = { COLUMNS };
```

`src/parse-orders.js`：

```javascript
const { messages } = require('./messages');

const SKIP_STATUS = ['等待买家付款', '待付款', '等待卖家发货', '待发货', '未发货'];

function needsLogistics(statusText) {
  const text = statusText == null ? '' : String(statusText);
  return !SKIP_STATUS.some((word) => text.includes(word));
}

function textOf(value) {
  if (value == null) return '';
  return String(value);
}

function blank(orderId, fieldName, logs) {
  logs.push({ level: 'warn', message: messages.missingField(orderId, fieldName) });
  return '';
}

function buildRows(orders, logisticsById) {
  const rows = [];
  const logs = [];
  for (const order of orders) {
    const orderId = textOf(order.id);
    const createTime = order.orderInfo ? textOf(order.orderInfo.createTime) : '';
    const shopName = order.seller ? textOf(order.seller.shopName) : '';
    const actualFee = order.payInfo ? textOf(order.payInfo.actualFee) : '';
    const status = order.statusInfo ? textOf(order.statusInfo.text) : '';
    const logistics = logisticsById[orderId] || { company: '', trackingNo: '', latest: '' };
    const subOrders = Array.isArray(order.subOrders) && order.subOrders.length > 0
      ? order.subOrders
      : [null];

    if (!createTime) blank(orderId, '下单时间', logs);
    if (!shopName) blank(orderId, '店铺', logs);
    if (!actualFee) blank(orderId, '订单实付', logs);
    if (!status) blank(orderId, '订单状态', logs);
    if (!orderId) blank(orderId, '订单号', logs);

    for (const sub of subOrders) {
      let title = '';
      let sku = '';
      let quantity = '';
      let price = '';
      if (!sub) {
        title = blank(orderId, '商品名称', logs);
        sku = blank(orderId, '规格', logs);
        quantity = blank(orderId, '数量', logs);
        price = blank(orderId, '单价', logs);
      } else {
        title = sub.itemInfo ? textOf(sub.itemInfo.title) : '';
        sku = sub.itemInfo ? textOf(sub.itemInfo.skuText) : '';
        quantity = textOf(sub.quantity);
        const priceInfo = sub.priceInfo || {};
        if (priceInfo.price != null && priceInfo.price !== '') {
          price = textOf(priceInfo.price);
        } else if (priceInfo.realTotal != null && priceInfo.realTotal !== '') {
          price = textOf(priceInfo.realTotal);
          logs.push({ level: 'warn', message: messages.usedSubtotal(orderId) });
        } else {
          price = blank(orderId, '单价', logs);
        }
        if (!title) title = blank(orderId, '商品名称', logs);
        if (!sku) sku = blank(orderId, '规格', logs);
        if (!quantity) quantity = blank(orderId, '数量', logs);
      }

      rows.push({
        订单号: orderId,
        下单时间: createTime,
        店铺: shopName,
        商品名称: title,
        规格: sku,
        数量: quantity,
        单价: price,
        订单实付: actualFee,
        订单状态: status,
        物流公司: textOf(logistics.company),
        运单号: textOf(logistics.trackingNo),
        最新物流: textOf(logistics.latest),
      });
    }
  }
  return { rows, logs };
}

module.exports = { needsLogistics, buildRows };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/parse-orders.test.js`

Expected: PASS

- [ ] **Step 5: 提交**

```powershell
git add src/columns.js src/parse-orders.js tests/parse-orders.test.js
git commit -m "feat: parse bought orders into item rows"
```

---

### Task 4: 物流解析和列表响应分类

**Files:**
- Create: `src/parse-logistics.js`
- Create: `src/classify-response.js`
- Create: `src/decode.js`
- Test: `tests/parse-logistics.test.js`
- Test: `tests/classify-response.test.js`
- Test: `tests/decode.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `parseLogisticsBody(json) -> { ok: true, company, trackingNo, latest, packageCount, hasTrace } | { ok: false, reason }`
  - `classifyListResponse(text) -> { type: 'orders', orders } | { type: 'login' } | { type: 'captcha' } | { type: 'unrecognized', keys } | { type: 'retryable', reason }`
  - `decodeBytes(bytes, encoding) -> string`

- [ ] **Step 1: 写失败测试**

`tests/parse-logistics.test.js`：

```javascript
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
```

`tests/classify-response.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyListResponse } = require('../src/classify-response');

test('含 mainOrders 时是订单页', () => {
  const result = classifyListResponse(JSON.stringify({ mainOrders: [{ id: '1' }] }));
  assert.equal(result.type, 'orders');
  assert.equal(result.orders.length, 1);
});

test('空列表仍是订单页', () => {
  const result = classifyListResponse(JSON.stringify({ mainOrders: [] }));
  assert.deepEqual(result, { type: 'orders', orders: [] });
});

test('登录地址判定为未登录', () => {
  assert.equal(classifyListResponse('<a href="https://login.taobao.com/member/login.jhtml">login</a>').type, 'login');
  assert.equal(classifyListResponse('https://passport.taobao.com/ac/login.htm').type, 'login');
});

test('验证码和风控立刻识别', () => {
  assert.equal(classifyListResponse('请输入验证码').type, 'captcha');
  assert.equal(classifyListResponse('_____tmd_____').type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ url: 'https://buyertrade.taobao.com/trade/security.htm' })).type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ rgv587_flag: 'sm' })).type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ ret: ['FAIL_SYS_USER_VALIDATE'] })).type, 'captcha');
});

test('没有 mainOrders 的 JSON 无法识别', () => {
  const result = classifyListResponse(JSON.stringify({ foo: 1, bar: 2 }));
  assert.deepEqual(result, { type: 'unrecognized', keys: 'foo,bar' });
});

test('不是 JSON 且看不出登录或验证码时可以重试', () => {
  assert.deepEqual(classifyListResponse('<html>bad gateway</html>'), { type: 'retryable', reason: '响应不是 JSON' });
});

test('商品标题里的验证码不当成风控', () => {
  const result = classifyListResponse(JSON.stringify({
    mainOrders: [{ id: '1', subOrders: [{ itemInfo: { title: '验证码识别教程' } }] }],
  }));
  assert.equal(result.type, 'orders');
  assert.equal(result.orders.length, 1);
});
```

`tests/decode.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeBytes } = require('../src/decode');

test('按 GBK 解码中文', () => {
  const bytes = Buffer.from('中通', 'utf8');
  assert.equal(decodeBytes(bytes, 'utf-8'), '中通');
  const gbk = new TextEncoder();
  const encoded = new Uint8Array([0xD6, 0xD0, 0xCD, 0xA8]);
  assert.equal(decodeBytes(encoded, 'gbk'), '中通');
  assert.equal(gbk.encode('unused').length > 0, true);
});
```

`0xD6 0xD0 0xCD 0xA8` 是「中通」的 GBK 字节。如果本机 Node 的 `TextDecoder('gbk')` 不可用，测试会失败；实现必须使用 `new TextDecoder(encoding)`，不要换成别的编码。

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/parse-logistics.test.js tests/classify-response.test.js tests/decode.test.js`

Expected: FAIL，找不到模块

- [ ] **Step 3: 写实现**

`src/parse-logistics.js`：

```javascript
function textList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (item == null ? '' : String(item))).filter((item) => item !== '');
  }
  if (value == null || value === '') return [];
  return [String(value)];
}

function firstTraceArray(json) {
  for (const key of ['address', 'traceList', 'transitStepInfo']) {
    if (Array.isArray(json[key])) return json[key];
  }
  return [];
}

function traceTime(item) {
  if (!item) return '';
  if (item.time != null && item.time !== '') return String(item.time);
  if (item.status_time != null && item.status_time !== '') return String(item.status_time);
  return '';
}

function traceDesc(item) {
  if (!item) return '';
  if (item.place != null && item.place !== '') return String(item.place);
  if (item.status_desc != null && item.status_desc !== '') return String(item.status_desc);
  if (item.desc != null && item.desc !== '') return String(item.desc);
  return '';
}

function latestTrace(items) {
  let best = null;
  let bestTime = '';
  for (const item of items) {
    const time = traceTime(item);
    const desc = traceDesc(item);
    if (!desc) continue;
    if (best == null || time >= bestTime) {
      best = desc;
      bestTime = time;
    }
  }
  return best || '';
}

function parseLogisticsBody(json) {
  if (!json || json.isSuccess !== 'true') {
    const flag = json && json.isSuccess != null ? json.isSuccess : '';
    return { ok: false, reason: `isSuccess=${flag}` };
  }
  const packageList = Array.isArray(json.packages)
    ? json.packages
    : (Array.isArray(json.pkgList) ? json.pkgList : null);
  let companies = textList(json.expressName);
  let numbers = textList(json.expressId);
  if (packageList && packageList.length > 0) {
    companies = packageList.map((item) => item.expressName || item.company || '').filter(Boolean);
    numbers = packageList.map((item) => item.expressId || item.mailNo || '').filter(Boolean);
  }
  const packageCount = packageList && packageList.length > 0
    ? packageList.length
    : Math.max(companies.length, numbers.length);
  const latest = latestTrace(firstTraceArray(json));
  return {
    ok: true,
    company: companies.join('；'),
    trackingNo: numbers.join('；'),
    latest,
    packageCount,
    hasTrace: latest !== '',
  };
}

module.exports = { parseLogisticsBody };
```

`src/classify-response.js`：

```javascript
function classifyListResponse(text) {
  const body = text == null ? '' : String(text);
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  if (json && Array.isArray(json.mainOrders)) {
    return { type: 'orders', orders: json.mainOrders };
  }
  if (
    body.includes('验证码')
    || body.includes('_____tmd_____')
    || body.includes('x5secdata')
    || body.includes('punish')
    || body.includes('rgv587_flag')
    || body.includes('FAIL_SYS_USER_VALIDATE')
    || (json && (json.url || json.rgv587_flag))
  ) {
    return { type: 'captcha' };
  }
  if (body.includes('login.taobao.com') || body.includes('passport.taobao.com')) {
    return { type: 'login' };
  }
  if (!json) return { type: 'retryable', reason: '响应不是 JSON' };
  const keys = json && typeof json === 'object' && !Array.isArray(json)
    ? Object.keys(json).join(',')
    : '非对象';
  return { type: 'unrecognized', keys };
}

module.exports = { classifyListResponse };
```

`src/decode.js`：

```javascript
function decodeBytes(bytes, encoding) {
  return new TextDecoder(encoding).decode(bytes);
}

module.exports = { decodeBytes };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/parse-logistics.test.js tests/classify-response.test.js tests/decode.test.js`

Expected: PASS

- [ ] **Step 5: 提交**

```powershell
git add src/parse-logistics.js src/classify-response.js src/decode.js tests/parse-logistics.test.js tests/classify-response.test.js tests/decode.test.js
git commit -m "feat: parse logistics and classify order list responses"
```

---

### Task 5: 导出 CSV、Excel 和文件名

**Files:**
- Create: `src/export-table.js`
- Create: `src/filenames.js`
- Modify: `package.json`
- Test: `tests/export-table.test.js`
- Test: `tests/filenames.test.js`

**Interfaces:**
- Consumes: `COLUMNS`、npm 包 `xlsx`
- Produces:
  - `exportTable(rows, format) -> { mime, bytes: Uint8Array }`
  - `tableFilename(startDate, endDate, format, partial) -> string`
  - `logFilename(date) -> string`
  - `encodeLogText(text) -> Uint8Array`，UTF-8 BOM + 文本

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm install xlsx`

`tests/filenames.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { tableFilename, logFilename } = require('../src/filenames');

test('表格和日志文件名', () => {
  assert.equal(tableFilename('2026-07-09', '2026-10-09', 'xlsx', false), '淘宝订单_2026-07-09_2026-10-09.xlsx');
  assert.equal(tableFilename('2026-07-09', '2026-10-09', 'csv', true), '淘宝订单_2026-07-09_2026-10-09_部分.csv');
  assert.equal(logFilename(new Date(2026, 9, 9, 21, 5, 7)), '淘宝订单_导出日志_20261009_210507.txt');
});
```

`tests/export-table.test.js`：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { COLUMNS } = require('../src/columns');
const { exportTable, encodeLogText } = require('../src/export-table');

const rows = [
  {
    订单号: '100',
    下单时间: '2026-10-01 10:00:00',
    店铺: '示例店',
    商品名称: '杯子, "大号"',
    规格: '白色',
    数量: '1',
    单价: '10.00',
    订单实付: '10.00',
    订单状态: '交易成功',
    物流公司: '中通',
    运单号: 'ZT1',
    最新物流: '已签收\n本人',
  },
];

test('CSV 带 BOM，并按 RFC 4180 转义', () => {
  const file = exportTable(rows, 'csv');
  assert.equal(file.mime, 'text/csv;charset=utf-8');
  assert.equal(file.bytes[0], 0xEF);
  assert.equal(file.bytes[1], 0xBB);
  assert.equal(file.bytes[2], 0xBF);
  const text = new TextDecoder('utf-8').decode(file.bytes.slice(3));
  const lines = text.split('\r\n');
  assert.equal(lines[0], COLUMNS.join(','));
  assert.equal(lines[1].startsWith('100,2026-10-01 10:00:00,示例店,"杯子, ""大号""",白色,1,10.00,10.00,交易成功,中通,ZT1,"已签收\n本人"'), true);
  assert.equal(lines[2], '');
});

test('Excel 工作表名叫订单，列顺序正确', () => {
  const file = exportTable(rows, 'xlsx');
  const book = XLSX.read(file.bytes, { type: 'array' });
  assert.deepEqual(book.SheetNames, ['订单']);
  const aoa = XLSX.utils.sheet_to_json(book.Sheets['订单'], { header: 1 });
  assert.deepEqual(aoa[0], COLUMNS);
  assert.equal(aoa[1][0], '100');
  assert.equal(aoa[1][3], '杯子, "大号"');
  assert.equal(aoa[1][11], '已签收\n本人');
});

test('日志文本带 UTF-8 BOM', () => {
  const bytes = encodeLogText('21:05:07 [信息] 导出完成\n');
  assert.equal(bytes[0], 0xEF);
  assert.equal(new TextDecoder('utf-8').decode(bytes.slice(3)), '21:05:07 [信息] 导出完成\n');
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/export-table.test.js tests/filenames.test.js`

Expected: FAIL，找不到模块

- [ ] **Step 3: 写实现**

`src/filenames.js`：

```javascript
function pad(value) {
  return String(value).padStart(2, '0');
}

function tableFilename(startDate, endDate, format, partial) {
  const suffix = partial ? '_部分' : '';
  return `淘宝订单_${startDate}_${endDate}${suffix}.${format}`;
}

function logFilename(date) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `淘宝订单_导出日志_${stamp}.txt`;
}

module.exports = { tableFilename, logFilename };
```

`src/export-table.js`：

```javascript
const XLSX = require('xlsx');
const { COLUMNS } = require('./columns');

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function withBom(bytes) {
  const out = new Uint8Array(3 + bytes.length);
  out[0] = 0xEF;
  out[1] = 0xBB;
  out[2] = 0xBF;
  out.set(bytes, 3);
  return out;
}

function rowValues(row) {
  return COLUMNS.map((column) => (row[column] == null ? '' : String(row[column])));
}

function exportTable(rows, format) {
  if (format === 'csv') {
    const lines = [COLUMNS, ...rows.map(rowValues)].map((line) => line.map(escapeCell).join(','));
    const bytes = new TextEncoder().encode(`${lines.join('\r\n')}\r\n`);
    return { mime: 'text/csv;charset=utf-8', bytes: withBom(bytes) };
  }
  const sheet = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows.map(rowValues)]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, '订单');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  return {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes: new Uint8Array(buffer),
  };
}

function encodeLogText(text) {
  return withBom(new TextEncoder().encode(text));
}

module.exports = { exportTable, encodeLogText };
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/export-table.test.js tests/filenames.test.js`

Expected: PASS

- [ ] **Step 5: 提交**

```powershell
git add package.json package-lock.json src/export-table.js src/filenames.js tests/export-table.test.js tests/filenames.test.js
git commit -m "feat: export order rows to csv and xlsx"
```

---

### Task 6: 翻页、物流和取消流程

**Files:**
- Create: `src/run-export.js`
- Create: `src/popup-state.js`
- Test: `tests/run-export.test.js`
- Test: `tests/popup-state.test.js`

**Interfaces:**
- Consumes: `messages`、`createLogger`、`classifyTime`、`needsLogistics`、`buildRows`、`parseLogisticsBody`、`classifyListResponse`、`isOrderListUrl`
- Produces:
  - `runExport(input) -> Promise<Result>`
  - `input`: `{ startDate, endDate, format, fetchPage(pageNum), fetchLogistics(orderId), sleep(ms), shouldStop(), now(), onProgress(text), onLog(line) }`
  - `fetchPage` / `fetchLogistics` 返回 `{ ok, status, text }`，或抛错
  - `shouldStop()` 返回 `null`、`'cancel'` 或 `'popup-closed'`
  - `Result`: `{ status, rows, orderCount, keptOrders, logText }`
  - `status` 为 `complete`、`empty`、`partial-ready`、`stopped`、`cancelled`
  - `appendDownloadLogs(logger, onLog, entries)`：`entries` 是 `{ level, message }` 数组，供弹窗在下载前后补日志
  - `popupView({ url, running, startDate, endDate, result }) -> { showOpenPage, exportDisabled, exportLabel, showPartial, dateError, pageMessage }`

物流日志由 `runExport` 写入，规则如下：

- 未发货：`messages.skipLogistics`，级别信息，不请求。
- 请求失败、HTTP 非 2xx、不是 JSON、`parseLogisticsBody.ok === false`：`messages.logisticsFail`，级别警告。失败原因分别是 `网络错误`、`HTTP {status}`、`响应不是 JSON`、解析器返回的 `reason`。
- `packageCount > 1`：先写 `messages.multiPackage`。
- 公司和运单号都空：`messages.noLogisticsInfo`。
- 有公司或运单号但没有轨迹：`messages.logisticsNoTrace`。
- 有轨迹：`messages.logisticsWithTrace`。
- 失败笔数大于 0：在行汇总前写 `messages.missingLogisticsCount`。
- 完整成功时写 `messages.rowSummary`，不写 `messages.done`。`done`、下载文件名由弹窗补。
- 部分导出不在 `runExport` 里发物流请求。调用方用已有的 `keptOrders` 和已查到的 `logisticsById` 调 `buildRows`。`runExport` 在 `partial-ready` 时把 `logisticsById` 放进结果。

`Result.logisticsById` 始终存在。未查询或失败的订单不要放成功对象；失败只记在计数里，表格物流列留空。

- [ ] **Step 1: 写失败测试**

`tests/popup-state.test.js`：

```javascript
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
```

`tests/run-export.test.js`：

```javascript
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
  assert.ok(messagesOf(captcha.logs)[1].includes('触发验证码或风控'));

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
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --test tests/run-export.test.js tests/popup-state.test.js`

Expected: FAIL，找不到模块

- [ ] **Step 3: 写实现**

`src/popup-state.js`：

```javascript
const { isOrderListUrl } = require('./urls');
const { messages } = require('./messages');

const ORDER_PAGE = 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm';

function popupView(state) {
  const onOrderPage = isOrderListUrl(state.url);
  const dateError = state.startDate > state.endDate;
  return {
    showOpenPage: !onOrderPage,
    exportDisabled: state.running ? false : (!onOrderPage || dateError),
    exportLabel: state.running ? '取消' : '开始导出',
    showPartial: !state.running && !!(state.result && state.result.status === 'partial-ready'),
    dateError,
    pageMessage: onOrderPage ? '' : messages.wrongPage(),
    orderPageUrl: ORDER_PAGE,
  };
}

module.exports = { popupView, ORDER_PAGE };
```

`src/run-export.js`：

```javascript
const { messages } = require('./messages');
const { createLogger } = require('./logger');
const { classifyTime } = require('./dates');
const { needsLogistics, buildRows } = require('./parse-orders');
const { parseLogisticsBody } = require('./parse-logistics');
const { classifyListResponse } = require('./classify-response');

const PAGE_SIZE = 15;
const LOGISTICS_GAP_MS = 400;

function push(logger, onLog, level, message) {
  logger[level](message);
  onLog(logger.lines[logger.lines.length - 1]);
}

function resultOf(status, rows, logger, orderCount, keptOrders, logisticsById) {
  return {
    status,
    rows,
    orderCount,
    keptOrders,
    logisticsById,
    logText: logger.text(),
  };
}

async function readPage(fetchPage, pageNum) {
  try {
    const response = await fetchPage(pageNum);
    if (!response || response.ok === false) {
      const status = response && response.status ? response.status : 0;
      return { type: 'retryable', reason: `HTTP ${status}` };
    }
    return classifyListResponse(response.text);
  } catch {
    return { type: 'retryable', reason: '网络错误' };
  }
}

function rememberStop(kind, kept, logger, onLog) {
  if (kind === 'popup-closed') {
    push(logger, onLog, 'warn', messages.popupClosed());
  } else {
    push(logger, onLog, 'warn', messages.cancelled(kept.length));
  }
  return resultOf('cancelled', [], logger, kept.length, kept, {});
}

function stopWith(kind, message, kept, logger, onLog) {
  push(logger, onLog, 'error', message);
  if (kept.length > 0) return resultOf('partial-ready', [], logger, kept.length, kept, {});
  return resultOf('stopped', [], logger, 0, [], {});
}

async function queryLogistics(kept, input, logger, onLog, onProgress) {
  const logisticsById = {};
  const targets = kept.filter((order) => needsLogistics(order.statusInfo && order.statusInfo.text));
  let index = 0;
  let failCount = 0;
  let waited = false;
  for (const order of kept) {
    const orderId = order.id == null ? '' : String(order.id);
    const status = order.statusInfo ? order.statusInfo.text : '';
    if (!needsLogistics(status)) {
      push(logger, onLog, 'info', messages.skipLogistics(orderId, status));
      continue;
    }
    const stop = input.shouldStop();
    if (stop) return { stopped: stop, logisticsById, failCount };
    index += 1;
    onProgress(messages.progressLogistics(index, targets.length));
    push(logger, onLog, 'info', messages.queryingLogistics(index, targets.length, orderId));
    if (waited) await input.sleep(LOGISTICS_GAP_MS);
    waited = true;
    const stopAfterWait = input.shouldStop();
    if (stopAfterWait) return { stopped: stopAfterWait, logisticsById, failCount };
    let response;
    try {
      response = await input.fetchLogistics(orderId);
    } catch {
      failCount += 1;
      push(logger, onLog, 'warn', messages.logisticsFail(orderId, '网络错误'));
      continue;
    }
    if (!response || response.ok === false) {
      failCount += 1;
      const statusCode = response && response.status ? response.status : 0;
      push(logger, onLog, 'warn', messages.logisticsFail(orderId, `HTTP ${statusCode}`));
      continue;
    }
    let json;
    try {
      json = JSON.parse(response.text);
    } catch {
      failCount += 1;
      push(logger, onLog, 'warn', messages.logisticsFail(orderId, '响应不是 JSON'));
      continue;
    }
    const parsed = parseLogisticsBody(json);
    if (!parsed.ok) {
      failCount += 1;
      push(logger, onLog, 'warn', messages.logisticsFail(orderId, parsed.reason));
      continue;
    }
    if (parsed.packageCount > 1) {
      push(logger, onLog, 'info', messages.multiPackage(orderId, parsed.packageCount));
    }
    logisticsById[orderId] = {
      company: parsed.company,
      trackingNo: parsed.trackingNo,
      latest: parsed.latest,
    };
    if (!parsed.company && !parsed.trackingNo) {
      push(logger, onLog, 'info', messages.noLogisticsInfo(orderId));
    } else if (!parsed.hasTrace) {
      push(logger, onLog, 'info', messages.logisticsNoTrace(orderId, parsed.company, parsed.trackingNo));
    } else {
      push(logger, onLog, 'info', messages.logisticsWithTrace(orderId, parsed.company, parsed.trackingNo, parsed.latest));
    }
  }
  return { stopped: null, logisticsById, failCount };
}

async function runExport(input) {
  const onLog = input.onLog || (() => {});
  const onProgress = input.onProgress || (() => {});
  const logger = createLogger(input.now || (() => new Date()));
  if (input.startDate > input.endDate) {
    push(logger, onLog, 'error', messages.badDate(input.startDate, input.endDate));
    return resultOf('stopped', [], logger, 0, [], {});
  }
  push(logger, onLog, 'info', messages.start(input.startDate, input.endDate, input.format));
  const kept = [];
  let pageNum = 1;
  let stopPaging = false;

  while (!stopPaging) {
    const stop = input.shouldStop();
    if (stop) return rememberStop(stop, kept, logger, onLog);
    onProgress(messages.progressPage(pageNum, kept.length));
    push(logger, onLog, 'info', messages.readingPage(pageNum));
    let classified = await readPage(input.fetchPage, pageNum);
    if (classified.type === 'retryable') {
      push(logger, onLog, 'warn', messages.pageRetry(pageNum, classified.reason));
      classified = await readPage(input.fetchPage, pageNum);
      if (classified.type === 'retryable') {
        return stopWith('page', messages.pageFail(pageNum, classified.reason, kept.length), kept, logger, onLog);
      }
    }
    if (classified.type === 'login') {
      return stopWith('login', messages.notLogin(), kept, logger, onLog);
    }
    if (classified.type === 'captcha') {
      return stopWith('captcha', messages.captcha(kept.length), kept, logger, onLog);
    }
    if (classified.type === 'unrecognized') {
      return stopWith('unknown', messages.unrecognized(classified.keys), kept, logger, onLog);
    }
    const orders = classified.orders;
    let inRange = 0;
    for (const order of orders) {
      const createTime = order.orderInfo && order.orderInfo.createTime;
      const when = classifyTime(createTime, input.startDate, input.endDate);
      const orderId = order.id == null ? '' : String(order.id);
      if (when === 'after') {
        push(logger, onLog, 'info', messages.skipNew(orderId, createTime));
        continue;
      }
      if (when === 'before') {
        push(logger, onLog, 'info', messages.stopOld(orderId, createTime));
        stopPaging = true;
        break;
      }
      inRange += 1;
      kept.push(order);
    }
    push(logger, onLog, 'info', messages.pageOk(pageNum, orders.length, inRange));
    if (stopPaging) break;
    if (orders.length < PAGE_SIZE) {
      push(logger, onLog, 'info', messages.noMore(pageNum));
      break;
    }
    pageNum += 1;
  }

  if (kept.length === 0) {
    push(logger, onLog, 'error', messages.noOrders());
    return resultOf('empty', [], logger, 0, [], {});
  }

  const queried = await queryLogistics(kept, input, logger, onLog, onProgress);
  if (queried.stopped) return rememberStop(queried.stopped, kept, logger, onLog);
  const built = buildRows(kept, queried.logisticsById);
  for (const entry of built.logs) push(logger, onLog, entry.level, entry.message);
  if (queried.failCount > 0) {
    push(logger, onLog, 'warn', messages.missingLogisticsCount(queried.failCount));
  }
  push(logger, onLog, 'info', messages.rowSummary(kept.length, built.rows.length));
  return resultOf('complete', built.rows, logger, kept.length, kept, queried.logisticsById);
}

function appendDownloadLogs(logger, onLog, entries) {
  for (const entry of entries) push(logger, onLog, entry.level, entry.message);
  return logger.text();
}

module.exports = { runExport, appendDownloadLogs, LOGISTICS_GAP_MS, PAGE_SIZE };
```

取消测试里，第 1 页返回 15 条后循环会再进入第 2 页，这时 `shouldStop` 已经是 `cancel`，所以不会调用第二次 `fetchPage`。这和「下一次请求前停止」一致。

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --test tests/run-export.test.js tests/popup-state.test.js`

Expected: PASS

再跑全部测试：

Run: `node --test`

Expected: PASS

- [ ] **Step 5: 提交**

```powershell
git add src/run-export.js src/popup-state.js tests/run-export.test.js tests/popup-state.test.js
git commit -m "feat: page through orders and collect logistics"
```

---

### Task 7: 插件弹窗、内容脚本和安装说明

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/popup/popup.html`
- Create: `extension/popup/popup.css`
- Create: `src/content-entry.js`
- Create: `src/popup-entry.js`
- Create: `README.md`
- Modify: `package.json`（增加 `build` 脚本和 `esbuild` 开发依赖）
- Create: `extension/content.js`（构建产物）
- Create: `extension/popup/popup.js`（构建产物）

**Interfaces:**
- Consumes: `runExport`、`appendDownloadLogs`、`createLogger`、`popupView`、`ORDER_PAGE`、`defaultRange`、`exportTable`、`encodeLogText`、`tableFilename`、`logFilename`、`buildRows`、`messages`、`decodeBytes`
- Produces: 可在 `chrome://extensions` 加载的 `extension/` 目录

内容脚本端口名是 `tb-order-export`。

弹窗发给内容脚本：

- `{ type: 'start', startDate, endDate, format }`
- `{ type: 'cancel' }`

内容脚本发给弹窗：

- `{ type: 'log', line }`
- `{ type: 'progress', text }`
- `{ type: 'result', result }`，`result` 是 `runExport` 的返回值，去掉函数。`keptOrders` 要能被结构化克隆。

弹窗收到 `complete` 后：下载表格，补「已下载表格」「已下载日志」「导出完成」，再下载日志。收到 `empty`、`stopped`、`cancelled` 时只下载日志，并补「已下载日志」。收到 `partial-ready` 时先下载当前日志（补「已下载日志」），显示「导出已获取的部分」。点击该按钮时不再发请求：用 `result.keptOrders` 和 `result.logisticsById` 调用 `buildRows`，下载 `_部分` 表格，再按顺序补这些日志后重新下载日志：缺字段警告、`partialExported`、`downloadedTable`、`downloadedLog`。

内容脚本若在 `runExport` 结束前发现端口断开，把停止原因设为 `popup-closed`。`runExport` 返回后，由内容脚本用页面里的 `<a download>` 下载日志，下载前补上「已下载日志」。

`fetchPage` 使用 Global Constraints 里的列表 URL 和表单。响应用 `decodeBytes(new Uint8Array(await response.arrayBuffer()), 'utf-8')`。`fetchLogistics` 用物流 URL，编码用 `gbk`。

进行中再次收到 `start` 直接忽略。

- [ ] **Step 1: 写安装说明里要被人工核对的行为，不写新的 Node 测试**

这一任务的自动覆盖已经在 Task 6。本任务只把那些函数接进 Chrome。不要再请求淘宝。

- [ ] **Step 2: 安装 esbuild**

Run: `npm install --save-dev esbuild`

在 `package.json` 的 `scripts` 里加入：

```json
"build": "esbuild src/content-entry.js --bundle --outfile=extension/content.js --format=iife && esbuild src/popup-entry.js --bundle --outfile=extension/popup/popup.js --format=iife"
```

- [ ] **Step 3: 写插件文件**

`extension/manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "淘宝订单导出",
  "version": "1.0.0",
  "description": "把已买到的宝贝导出为表格，包含商品和物流信息。数据只留在本机。",
  "action": {
    "default_title": "淘宝订单导出",
    "default_popup": "popup/popup.html"
  },
  "host_permissions": [
    "https://buyertrade.taobao.com/*",
    "https://trade.taobao.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://buyertrade.taobao.com/trade/itemlist/*",
        "https://trade.taobao.com/trade/itemlist/*"
      ],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

`extension/popup/popup.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>淘宝订单导出</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <h1>淘宝订单导出</h1>
  <p id="page-message"></p>
  <button id="open-page" type="button" hidden>打开订单页</button>
  <label>开始日期 <input id="start-date" type="date"></label>
  <label>结束日期 <input id="end-date" type="date"></label>
  <p id="date-error" hidden>开始日期不能晚于结束日期</p>
  <fieldset>
    <legend>格式</legend>
    <label><input name="format" type="radio" value="xlsx" checked> Excel</label>
    <label><input name="format" type="radio" value="csv"> CSV</label>
  </fieldset>
  <button id="export" type="button">开始导出</button>
  <button id="partial" type="button" hidden>导出已获取的部分</button>
  <p id="progress"></p>
  <pre id="log"></pre>
  <script src="popup.js"></script>
</body>
</html>
```

`extension/popup/popup.css`：

```css
body { width: 360px; margin: 12px; font: 13px/1.4 "Segoe UI", sans-serif; color: #222; }
h1 { font-size: 16px; margin: 0 0 8px; }
label, fieldset { display: block; margin: 8px 0; }
button { margin-right: 8px; }
#date-error, #page-message { color: #a40000; }
#log { height: 180px; overflow: auto; background: #f6f6f6; padding: 8px; white-space: pre-wrap; }
```

`src/content-entry.js`：

```javascript
const { runExport, appendDownloadLogs } = require('./run-export');
const { createLogger } = require('./logger');
const { messages } = require('./messages');
const { decodeBytes } = require('./decode');
const { encodeLogText } = require('./export-table');
const { logFilename } = require('./filenames');

const LIST_URL = 'https://buyertrade.taobao.com/trade/itemlist/asyncBought.htm?action=itemlist/BoughtQueryAction&event_submit_do_query=1&_input_charset=utf8';

function triggerDownload(filename, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchPage(pageNum) {
  const body = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: '15',
    prePageNo: String(pageNum - 1),
  });
  const response = await fetch(LIST_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, text: decodeBytes(bytes, 'utf-8') };
}

async function fetchLogistics(orderId) {
  const response = await fetch(
    `https://buyertrade.taobao.com/trade/json/transit_step.do?bizOrderId=${encodeURIComponent(orderId)}`,
    { credentials: 'include' }
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, text: decodeBytes(bytes, 'gbk') };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tb-order-export') return;
  let running = false;
  let stopKind = null;
  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
    if (running) stopKind = 'popup-closed';
  });
  port.onMessage.addListener(async (message) => {
    if (message.type === 'cancel') {
      stopKind = 'cancel';
      return;
    }
    if (message.type !== 'start' || running) return;
    running = true;
    stopKind = null;
    const result = await runExport({
      startDate: message.startDate,
      endDate: message.endDate,
      format: message.format,
      fetchPage,
      fetchLogistics,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      shouldStop: () => stopKind,
      now: () => new Date(),
      onProgress(text) {
        if (!disconnected) port.postMessage({ type: 'progress', text });
      },
      onLog(line) {
        if (!disconnected) port.postMessage({ type: 'log', line });
      },
    });
    running = false;
    if (disconnected) {
      const filename = logFilename(new Date());
      const extra = [];
      if (!result.logText.includes(messages.popupClosed())) {
        extra.push({ level: 'warn', message: messages.popupClosed() });
      }
      extra.push({ level: 'info', message: messages.downloadedLog(filename) });
      const closedLogger = createLogger(() => new Date());
      appendDownloadLogs(closedLogger, () => {}, extra);
      triggerDownload(filename, encodeLogText(`${result.logText}${closedLogger.text()}`), 'text/plain;charset=utf-8');
      return;
    }
    port.postMessage({ type: 'result', result });
  });
});
```

`src/popup-entry.js`：

```javascript
const { defaultRange } = require('./dates');
const { popupView } = require('./popup-state');
const { createLogger } = require('./logger');
const { messages } = require('./messages');
const { exportTable, encodeLogText } = require('./export-table');
const { tableFilename, logFilename } = require('./filenames');
const { buildRows } = require('./parse-orders');

const pageMessage = document.getElementById('page-message');
const openPage = document.getElementById('open-page');
const startInput = document.getElementById('start-date');
const endInput = document.getElementById('end-date');
const dateError = document.getElementById('date-error');
const exportButton = document.getElementById('export');
const partialButton = document.getElementById('partial');
const progress = document.getElementById('progress');
const logNode = document.getElementById('log');

const range = defaultRange(new Date());
startInput.value = range.startDate;
endInput.value = range.endDate;

let port = null;
let running = false;
let lastResult = null;
let tabUrl = '';
const logger = createLogger(() => new Date());

function selectedFormat() {
  const picked = document.querySelector('input[name="format"]:checked');
  return picked ? picked.value : 'xlsx';
}

function render() {
  const view = popupView({
    url: tabUrl,
    running,
    startDate: startInput.value,
    endDate: endInput.value,
    result: lastResult,
  });
  pageMessage.textContent = view.pageMessage;
  openPage.hidden = !view.showOpenPage;
  dateError.hidden = !view.dateError;
  exportButton.disabled = view.exportDisabled;
  exportButton.textContent = view.exportLabel;
  partialButton.hidden = !view.showPartial;
  logNode.textContent = logger.text();
  logNode.scrollTop = logNode.scrollHeight;
}

function download(filename, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function addLog(level, message) {
  logger[level](message);
  render();
}

function downloadLog() {
  const filename = logFilename(new Date());
  addLog('info', messages.downloadedLog(filename));
  download(filename, encodeLogText(logger.text()), 'text/plain;charset=utf-8');
}

openPage.addEventListener('click', () => {
  chrome.tabs.create({ url: popupView({ url: '', running: false, startDate: startInput.value, endDate: endInput.value, result: null }).orderPageUrl });
});

startInput.addEventListener('change', render);
endInput.addEventListener('change', render);

exportButton.addEventListener('click', async () => {
  if (running) {
    if (port) port.postMessage({ type: 'cancel' });
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = tab && tab.url ? tab.url : '';
  render();
  const view = popupView({
    url: tabUrl,
    running: false,
    startDate: startInput.value,
    endDate: endInput.value,
    result: lastResult,
  });
  if (view.showOpenPage) {
    addLog('error', messages.wrongPage());
    downloadLog();
    return;
  }
  if (view.dateError) {
    addLog('error', messages.badDate(startInput.value, endInput.value));
    downloadLog();
    return;
  }
  logger.lines.length = 0;
  lastResult = null;
  running = true;
  render();
  port = chrome.tabs.connect(tab.id, { name: 'tb-order-export' });
  port.onMessage.addListener((message) => {
    if (message.type === 'log') {
      logger.lines.push(message.line);
      render();
    } else if (message.type === 'progress') {
      progress.textContent = message.text;
    } else if (message.type === 'result') {
      running = false;
      lastResult = message.result;
      progress.textContent = '';
      if (message.result.status === 'complete') {
        const filename = tableFilename(startInput.value, endInput.value, selectedFormat(), false);
        const file = exportTable(message.result.rows, selectedFormat());
        download(filename, file.bytes, file.mime);
        const logName = logFilename(new Date());
        addLog('info', messages.downloadedTable(filename));
        addLog('info', messages.downloadedLog(logName));
        addLog('info', messages.done());
        download(logName, encodeLogText(logger.text()), 'text/plain;charset=utf-8');
      } else {
        downloadLog();
        render();
      }
    }
  });
  port.onDisconnect.addListener(() => {
    port = null;
  });
  port.postMessage({
    type: 'start',
    startDate: startInput.value,
    endDate: endInput.value,
    format: selectedFormat(),
  });
});

partialButton.addEventListener('click', () => {
  if (!lastResult || lastResult.status !== 'partial-ready') return;
  const built = buildRows(lastResult.keptOrders, lastResult.logisticsById || {});
  for (const entry of built.logs) addLog(entry.level, entry.message);
  const filename = tableFilename(startInput.value, endInput.value, selectedFormat(), true);
  const file = exportTable(built.rows, selectedFormat());
  download(filename, file.bytes, file.mime);
  addLog('info', messages.partialExported(lastResult.orderCount, built.rows.length, filename));
  addLog('info', messages.downloadedTable(filename));
  downloadLog();
  lastResult = null;
  render();
});

chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  tabUrl = tabs[0] && tabs[0].url ? tabs[0].url : '';
  render();
  if (pageMessage.textContent) addLog('error', messages.wrongPage());
});
```

`downloadLog` 会先把「已下载日志」写进 `logger` 再编码，所以文件里包含这一行。

`README.md`：

```markdown
# 淘宝订单导出

把你自己已登录的淘宝「已买到的宝贝」导出成 Excel 或 CSV。一行一件商品，包含物流公司、运单号和最新一条物流。订单和日志只下载到本机。

## 安装

1. `npm install`
2. `npm test`
3. `npm run build`
4. 打开 `chrome://extensions`，打开「开发者模式」，选择「加载已解压的扩展程序」，选这个项目里的 `extension` 目录。

## 使用

1. 打开 https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm 并登录。
2. 点击扩展图标。默认日期是最近 3 个月。
3. 选择 Excel 或 CSV，点「开始导出」。
4. 表格和 `淘宝订单_导出日志_时间.txt` 会下载到浏览器的下载目录。

验证码出现时导出会停止。已经拿到订单时，可以点「导出已获取的部分」。这一步不会再向淘宝发请求。

## 人工核对

导出最近 7 天。对照订单页看商品行数，打开表格抽一笔已发货订单核对运单号。日志里要有「开始导出」、翻页记录、该订单的物流记录和「导出完成」。
```

- [ ] **Step 4: 构建并跑全部测试**

Run: `npm test`

Expected: PASS

Run: `npm run build`

Expected: 生成 `extension/content.js` 和 `extension/popup/popup.js`，退出码 0

- [ ] **Step 5: 提交**

```powershell
git add package.json package-lock.json extension/manifest.json extension/popup/popup.html extension/popup/popup.css extension/popup/popup.js extension/content.js src/content-entry.js src/popup-entry.js README.md
git commit -m "feat: add taobao order export extension"
```

构建产物随源码提交，这样不跑构建也能加载插件。

---

## Self-Review

规格覆盖：

- 弹窗、日期、两种格式、打开订单页：Task 7，状态规则在 Task 6。
- 列表接口、翻页、日期停止、未发货跳过物流、400 毫秒间隔：Task 6 和 Task 7。
- 一行一件商品、12 列、缺字段、单价回退：Task 3。
- 物流公司、运单号、最新轨迹、多包裹、GBK：Task 4 和 Task 7。
- CSV BOM、Excel 表名、文件名：Task 5。
- 未登录、验证码、重试一次、部分导出不再请求、取消、关弹窗：Task 6 和 Task 7。
- 设计说明里的每条日志文案：Task 1 锁原文，Task 6 和 Task 7 在对应分支调用。

已核对的调用名：`messages.noLogisticsInfo`、`messages.queryingLogistics`、`messages.progressLogistics`、`createLogger`、`buildRows`、`parseLogisticsBody`、`classifyListResponse`、`decodeBytes`、`exportTable`、`encodeLogText`、`tableFilename`、`logFilename`、`runExport`、`popupView`、`needsLogistics`、`classifyTime`、`defaultRange`、`isOrderListUrl`。后一任务没有改前一任务的函数名。

计划澄清：部分导出不再发新请求；下单时间无法解析时仍保留订单；关弹窗后的日志由内容脚本下载。
