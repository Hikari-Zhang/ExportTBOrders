const { runExport, appendDownloadLogs } = require('./run-export');
const { createLogger } = require('./logger');
const { messages } = require('./messages');
const { decodeBytes } = require('./decode');
const { encodeLogText } = require('./log-file');
const { logFilename } = require('./filenames');

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
  return { ok: response.ok, status: response.status, text: decodeBytes(bytes, 'utf-8') };
}

async function fetchLogistics(orderId) {
  const response = await fetch(logisticsUrl(orderId), { credentials: 'include' });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { ok: response.ok, status: response.status, text: decodeBytes(bytes, 'gbk') };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tb-order-export') return;
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
    function postToPopup(payload) {
      if (disconnected) return;
      try {
        port.postMessage(payload);
      } catch {
        disconnected = true;
        stopKind = 'popup-closed';
      }
    }
    try {
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
          postToPopup({ type: 'progress', text });
        },
        onLog(line) {
          postToPopup({ type: 'log', line });
        },
      });
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
    } finally {
      running = false;
    }
  });
});
