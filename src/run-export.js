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
