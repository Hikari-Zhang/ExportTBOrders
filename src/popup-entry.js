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
let starting = false;
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
  if (starting) return;
  if (running) {
    if (port) port.postMessage({ type: 'cancel' });
    return;
  }
  starting = true;
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
    starting = false;
    addLog('error', messages.wrongPage());
    downloadLog();
    return;
  }
  if (view.dateError) {
    starting = false;
    addLog('error', messages.badDate(startInput.value, endInput.value));
    downloadLog();
    return;
  }
  logger.lines.length = 0;
  lastResult = null;
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
  starting = false;
  running = true;
  render();
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
