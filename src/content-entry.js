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
