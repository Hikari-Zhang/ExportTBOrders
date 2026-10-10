const { messages } = require('./messages');
const { createLogger } = require('./logger');
const { classifyTime } = require('./dates');
const { matchesStatus, statusLabel } = require('./order-status');
const { needsLogistics, buildRows } = require('./parse-orders');
const { parseLogisticsBody } = require('./parse-logistics');
const { parseLegacyLogistics } = require('./parse-legacy-logistics');
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

function looksLikeLogisticsPage(body) {
  return body.includes('物流公司')
    || body.includes('运单号')
    || body.includes('运单号码')
    || body.includes('快递单号')
    || body.includes('expressName');
}

function isLogisticsRisk(text) {
  const body = text == null ? '' : String(text);
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  if (json && parseLogisticsBody(json).ok) return false;
  if (!json && looksLikeLogisticsPage(body)) return false;
  if (json) {
    return body.includes('rgv587_flag')
      || body.includes('FAIL_SYS_USER_VALIDATE')
      || !!(json.url || json.rgv587_flag);
  }
  return body.includes('_____tmd_____')
    || body.includes('x5secdata')
    || body.includes('rgv587_flag')
    || body.includes('FAIL_SYS_USER_VALIDATE');
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

function usableLogistics(parsed) {
  return !!(parsed && parsed.ok && (parsed.company || parsed.trackingNo));
}

function readLogisticsResponse(response, networkReason) {
  if (!response) return { risk: false, parsed: null, reason: networkReason };
  if (isLogisticsRisk(response.text)) return { risk: true, parsed: null, reason: '' };
  if (response.ok === false) {
    const statusCode = response.status ? response.status : 0;
    return { risk: false, parsed: null, reason: `HTTP ${statusCode}` };
  }
  let json;
  try {
    json = JSON.parse(response.text);
  } catch {
    return { risk: false, parsed: null, reason: '响应不是 JSON' };
  }
  const parsed = parseLogisticsBody(json);
  if (parsed.ok && !parsed.company && !parsed.trackingNo) {
    return { risk: false, parsed: null, empty: true, reason: '无物流信息' };
  }
  if (!parsed.ok) return { risk: false, parsed: null, reason: parsed.reason };
  return { risk: false, parsed, reason: '' };
}

function recordLogistics(orderId, parsed, logisticsById, logger, onLog) {
  if (parsed.packageCount > 1) {
    push(logger, onLog, 'info', messages.multiPackage(orderId, parsed.packageCount));
  }
  logisticsById[orderId] = {
    company: parsed.company,
    trackingNo: parsed.trackingNo,
    latest: parsed.latest,
  };
  if (!parsed.hasTrace) {
    push(logger, onLog, 'info', messages.logisticsNoTrace(orderId, parsed.company, parsed.trackingNo));
  } else {
    push(logger, onLog, 'info', messages.logisticsWithTrace(orderId, parsed.company, parsed.trackingNo, parsed.latest));
  }
}

async function readLegacyLogistics(orderId, input, logger, onLog) {
  push(logger, onLog, 'info', messages.legacyLogistics(orderId));
  await input.sleep(LOGISTICS_GAP_MS);
  const stop = input.shouldStop();
  if (stop) return { stopped: stop };
  let response;
  try {
    response = await input.fetchLegacyLogistics(orderId);
  } catch {
    return { reason: '旧版物流页网络错误' };
  }
  if (response && isLogisticsRisk(response.text)) return { risk: true };
  if (!response || response.ok === false) {
    const statusCode = response && response.status ? response.status : 0;
    return { reason: `旧版物流页 HTTP ${statusCode}` };
  }
  const parsed = parseLegacyLogistics(response.text);
  if (!usableLogistics(parsed)) return { reason: parsed.reason || '旧版物流页无物流信息' };
  return { parsed };
}

async function queryLogistics(kept, input, logger, onLog, onProgress) {
  const logisticsById = {};
  const targets = kept.filter((order) => needsLogistics(order.statusInfo && order.statusInfo.text));
  let index = 0;
    let failCount = 0;
    let waited = false;
  for (const order of kept) {
    const stop = input.shouldStop();
    if (stop) return { stopped: stop, logisticsById, failCount };
    const orderId = order.id == null ? '' : String(order.id);
    const status = order.statusInfo ? order.statusInfo.text : '';
    if (!needsLogistics(status)) {
      push(logger, onLog, 'info', messages.skipLogistics(orderId, status));
      continue;
    }
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
      response = null;
    }
    const current = readLogisticsResponse(response, '网络错误');
    if (current.risk) return { stopped: null, risk: true, logisticsById, failCount };
    let parsed = usableLogistics(current.parsed) ? current.parsed : null;
    if (!parsed && typeof input.fetchLegacyLogistics === 'function') {
      const legacy = await readLegacyLogistics(orderId, input, logger, onLog);
      if (legacy.stopped) return { stopped: legacy.stopped, logisticsById, failCount };
      if (legacy.risk) {
        push(logger, onLog, 'warn', messages.legacyBlocked(orderId));
        current.reason = '旧版订单详情触发验证';
      } else if (usableLogistics(legacy.parsed)) {
        parsed = legacy.parsed;
      } else {
        current.reason = legacy.reason || current.reason;
      }
    }
    if (!parsed) {
      if (current.empty && typeof input.fetchLegacyLogistics !== 'function') {
        push(logger, onLog, 'info', messages.noLogisticsInfo(orderId));
        continue;
      }
      failCount += 1;
      push(logger, onLog, 'warn', messages.logisticsFail(orderId, current.reason || '无物流信息'));
      continue;
    }
    recordLogistics(orderId, parsed, logisticsById, logger, onLog);
  }
  return { stopped: null, risk: false, logisticsById, failCount };
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
  if (Array.isArray(input.statuses) && !input.statuses.includes('all')) {
    const labels = input.statuses.map(statusLabel).join('、');
    push(logger, onLog, 'info', messages.statusFilter(labels));
  }
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
      const stopBeforeRetry = input.shouldStop();
      if (stopBeforeRetry) return rememberStop(stopBeforeRetry, kept, logger, onLog);
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
      const status = order.statusInfo ? order.statusInfo.text : '';
      if (!matchesStatus(status, input.statuses)) {
        push(logger, onLog, 'info', messages.skipStatus(orderId, status));
        continue;
      }
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
  if (queried.risk) {
    push(logger, onLog, 'error', messages.captcha(kept.length));
    if (kept.length > 0) {
      return resultOf('partial-ready', [], logger, kept.length, kept, queried.logisticsById);
    }
    return resultOf('stopped', [], logger, 0, [], {});
  }
  if (queried.stopped) return rememberStop(queried.stopped, kept, logger, onLog);
  const stopBeforeComplete = input.shouldStop();
  if (stopBeforeComplete) return rememberStop(stopBeforeComplete, kept, logger, onLog);
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
