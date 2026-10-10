const { runExport, appendDownloadLogs } = require('./run-export');
const { createLogger } = require('./logger');
const { messages } = require('./messages');
const { decodeResponseBytes } = require('./decode');
const { parseLegacyLogistics } = require('./parse-legacy-logistics');
const { encodeLogText } = require('./log-file');
const { exportTable } = require('./export-table');
const { tableFilename, logFilename } = require('./filenames');
const { buildRows } = require('./parse-orders');

const LIST_PATH = '/trade/itemlist/asyncBought.htm?action=itemlist/BoughtQueryAction&event_submit_do_query=1&_input_charset=utf8';

let running = false;

function tradeOrigin() {
  const host = location.hostname;
  if (host === 'buyertrade.taobao.com' || host === 'trade.taobao.com') return location.origin;
  return 'https://buyertrade.taobao.com';
}

function listUrl() {
  return `${tradeOrigin()}${LIST_PATH}`;
}

function logisticsUrl(orderId) {
  return `${tradeOrigin()}/trade/json/transit_step.do?bizOrderId=${encodeURIComponent(orderId)}`;
}

function triggerDownload(filename, bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchPage(pageNum) {
  const body = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: '15',
    prePageNo: String(pageNum - 1),
  });
  const response = await fetch(listUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body,
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    text: decodeResponseBytes(bytes, response.headers.get('content-type')),
  };
}

function detailPageUrls(orderId) {
  const id = encodeURIComponent(orderId);
  return [
    `https://trade.taobao.com/trade/detail/trade_order_detail.htm?biz_order_id=${id}`,
    `https://buyertrade.taobao.com/trade/detail/trade_order_detail.htm?biz_order_id=${id}`,
    `https://tradearchive.taobao.com/trade/detail/trade_item_detail.htm?biz_order_id=${id}`,
    `https://tradearchive.taobao.com/trade/detail/trade_order_detail.htm?biz_order_id=${id}`,
  ];
}

async function requestLegacyPage(url) {
  const response = await chrome.runtime.sendMessage({
    type: 'fetch-legacy-logistics',
    url,
  });
  if (!response) return { ok: false, status: 0, text: '' };
  const bytes = new Uint8Array(response.bytes || []);
  return {
    ok: response.ok,
    status: response.status,
    text: decodeResponseBytes(bytes, response.contentType),
  };
}

function pageHasWaybill(text) {
  const parsed = parseLegacyLogistics(text);
  return !!(parsed.ok && (parsed.company || parsed.trackingNo));
}

async function fetchLegacyLogistics(orderId) {
  const urls = detailPageUrls(orderId);
  let last = { ok: false, status: 0, text: '' };
  for (const url of urls) {
    const page = await requestLegacyPage(url);
    last = page;
    const text = page.text || '';
    const blocked = text.includes('_____tmd_____') || text.includes('x5secdata') || text.includes('rgv587_flag');
    if (blocked && !text.includes('物流公司') && !text.includes('运单号')) continue;
    if (page.ok && pageHasWaybill(text)) return page;
  }
  return last;
}

async function fetchLogistics(orderId) {
  const response = await fetch(logisticsUrl(orderId), { credentials: 'include' });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    text: decodeResponseBytes(bytes, response.headers.get('content-type')),
  };
}

function withExtraLogs(logText, entries) {
  const logger = createLogger(() => new Date());
  appendDownloadLogs(logger, () => {}, entries);
  return `${logText}${logger.text()}`;
}

function downloadLogFile(logText, before, after) {
  const filename = logFilename(new Date());
  const lines = before.concat(
    [{ level: 'info', message: messages.downloadedLog(filename) }],
    after
  );
  setTimeout(() => {
    triggerDownload(filename, encodeLogText(withExtraLogs(logText, lines)), 'text/plain;charset=utf-8');
  }, 500);
}

function deliverFiles(result, request) {
  const before = [];
  try {
    if (result.status === 'complete') {
      const filename = tableFilename(request.startDate, request.endDate, request.format, false);
      const file = exportTable(result.rows, request.format);
      triggerDownload(filename, file.bytes, file.mime);
      before.push({ level: 'info', message: messages.downloadedTable(filename) });
      downloadLogFile(result.logText, before, [{ level: 'info', message: messages.done() }]);
      return;
    }
    if (result.status === 'partial-ready') {
      const built = buildRows(result.keptOrders || [], result.logisticsById || {});
      if (built.rows.length > 0) {
        const filename = tableFilename(request.startDate, request.endDate, request.format, true);
        const file = exportTable(built.rows, request.format);
        triggerDownload(filename, file.bytes, file.mime);
        before.push({
          level: 'info',
          message: messages.partialExported(result.orderCount, built.rows.length, filename),
        });
        before.push({ level: 'info', message: messages.downloadedTable(filename) });
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    before.push({ level: 'error', message: messages.exportFailed(reason) });
  }
  downloadLogFile(result.logText, before, []);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tb-order-export') return;
  let stopKind = null;
  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
  });
  port.onMessage.addListener(async (message) => {
    if (message.type === 'cancel') {
      stopKind = 'cancel';
      return;
    }
    if (message.type !== 'start' || running) return;
    running = true;
    stopKind = null;
    function postToPopup(payload) {
      if (disconnected) return;
      try {
        port.postMessage(payload);
      } catch {
        disconnected = true;
      }
    }
    try {
      const result = await runExport({
        startDate: message.startDate,
        endDate: message.endDate,
        format: message.format,
        statuses: message.statuses,
        fetchPage,
        fetchLogistics,
        fetchLegacyLogistics,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        shouldStop: () => stopKind,
        now: () => new Date(),
        onProgress(text) {
          postToPopup({ type: 'progress', text });
        },
        onLog(line) {
          postToPopup({ type: 'log', line });
        },
      });
      if (disconnected) {
        deliverFiles(result, message);
        return;
      }
      try {
        port.postMessage({ type: 'result', result });
      } catch {
        deliverFiles(result, message);
      }
    } finally {
      running = false;
    }
  });
});
