const { runExport, appendDownloadLogs, isCaptchaChallenge } = require('./run-export');
const { createLogger } = require('./logger');
const { messages } = require('./messages');
const { decodeResponseBytes } = require('./decode');
const { parseLegacyLogistics } = require('./parse-legacy-logistics');
const { encodeLogText } = require('./log-file');
const { exportTable } = require('./export-table');
const { tableFilename, logFilename } = require('./filenames');
const { buildRows } = require('./parse-orders');
const { mountPagePanel } = require('./page-panel');
const {
  attachToken,
  applyPageNumber,
  classicDatedQuery,
  listFilterIgnored,
  newestOrderTime,
  parseCapturedBody,
} = require('./list-query');

function detectDateFields() {
  const names = [];
  for (const node of document.querySelectorAll('input[name], select[name]')) {
    if (/date|time/i.test(node.name) && !names.includes(node.name)) names.push(node.name);
  }
  return names;
}

function readTbToken() {
  const input = document.querySelector('input[name="_tb_token_"]');
  if (input && input.value) return input.value;
  const meta = document.querySelector('meta[name="_tb_token_"], meta[name="csrf-token"]');
  if (meta && meta.content) return meta.content;
  const cookie = document.cookie.match(/(?:^|;\s*)_tb_token_=([^;]+)/);
  if (cookie) return decodeURIComponent(cookie[1]);
  const fromHtml = document.documentElement.innerHTML.match(/_tb_token_["'\s:=]+([A-Za-z0-9]{6,})/);
  if (fromHtml) return fromHtml[1];
  const node = document.createElement('meta');
  node.id = 'tb-export-token';
  document.documentElement.appendChild(node);
  const script = document.createElement('script');
  script.textContent = `(function(){
    var token = '';
    try {
      if (window.g_config && window.g_config.token) token = window.g_config.token;
      else if (window.token) token = window.token;
    } catch (e) {}
    var node = document.getElementById('tb-export-token');
    if (node) node.setAttribute('content', token || '');
  })();`;
  document.documentElement.appendChild(script);
  script.remove();
  const token = node.getAttribute('content') || '';
  node.remove();
  return token;
}

function installListCapture() {
  if (document.getElementById('tb-export-capture')) return;
  const box = document.createElement('textarea');
  box.id = 'tb-export-capture';
  box.hidden = true;
  document.documentElement.appendChild(box);
  const script = document.createElement('script');
  script.textContent = `(function(){
    if (window.__tbExportHook) return;
    window.__tbExportHook = true;
    function publish(url, body) {
      if (!window.__tbExportWatch) return;
      if (!/asyncBought|BoughtQuery|querybought|order\\.list/i.test(String(url || ''))) return;
      var box = document.getElementById('tb-export-capture');
      if (!box) return;
      var text = typeof body === 'string' ? body : (body && body.toString ? body.toString() : '');
      box.value = JSON.stringify({ url: String(url || ''), body: text });
      box.dispatchEvent(new Event('change'));
    }
    var orig = window.fetch;
    if (typeof orig === 'function') {
      window.fetch = function(input, init) {
        try {
          var url = typeof input === 'string' ? input : (input && input.url) || '';
          publish(url, init && init.body);
        } catch (e) {}
        return orig.apply(this, arguments);
      };
    }
    var xhrOpen = XMLHttpRequest.prototype.open;
    var xhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
      this.__tbUrl = url;
      return xhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function(body) {
      try { publish(this.__tbUrl || '', body); } catch (e) {}
      return xhrSend.apply(this, arguments);
    };
  })();`;
  document.documentElement.appendChild(script);
  script.remove();
}

function setCaptureWatch(on) {
  const script = document.createElement('script');
  script.textContent = `window.__tbExportWatch = ${on ? 'true' : 'false'};`;
  document.documentElement.appendChild(script);
  script.remove();
}

function setInputValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')
    || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (setter && setter.set) setter.set.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findRangeInputs() {
  const inputs = [...document.querySelectorAll('input')].filter((input) => {
    const rect = input.getBoundingClientRect();
    return rect.width > 20 && rect.height > 10 && input.type !== 'hidden' && input.type !== 'checkbox' && input.type !== 'radio';
  });
  const start = inputs.find((input) => /开始|起始/.test(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
  const end = inputs.find((input) => /结束|截止/.test(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
  if (start && end) return [start, end];
  return null;
}

function clickSearch() {
  const nodes = [...document.querySelectorAll('button, a, span')];
  const target = nodes.find((node) => {
    const text = (node.innerText || '').trim();
    if (text !== '搜索' && text !== '筛选' && text !== '确定') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.width < 240;
  });
  if (!target) return false;
  target.click();
  return true;
}

function waitForCapture(ms) {
  const box = document.getElementById('tb-export-capture');
  if (!box) return Promise.resolve('');
  if (box.value) return Promise.resolve(box.value);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      box.removeEventListener('change', onChange);
      resolve(box.value || '');
    }, ms);
    function onChange() {
      clearTimeout(timer);
      box.removeEventListener('change', onChange);
      resolve(box.value || '');
    }
    box.addEventListener('change', onChange);
  });
}

function openVerifyPage(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (parsed.protocol !== 'https:') return;
    if (!host.endsWith('taobao.com') && !host.endsWith('tmall.com')) return;
    window.open(parsed.href, '_blank', 'noopener');
  } catch {
    return;
  }
}

function showVerifyBanner(onContinue, verifyUrl) {
  const previous = document.getElementById('tb-export-verify');
  if (previous) previous.remove();
  const box = document.createElement('div');
  box.id = 'tb-export-verify';
  box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;left:16px;right:16px;background:#fff8e8;border:2px solid #e6a100;padding:14px 16px;font:14px/1.5 "Segoe UI",sans-serif;color:#222;box-shadow:0 6px 20px rgba(0,0,0,.18)';
  const text = document.createElement('div');
  text.textContent = '遇到验证，导出已暂停。请先在本页或验证页完成验证，再点「继续导出」。不要关闭这个订单页。';
  const actions = document.createElement('div');
  actions.style.marginTop = '10px';
  if (verifyUrl) {
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = '打开验证页';
    open.style.marginRight = '8px';
    open.addEventListener('click', () => openVerifyPage(verifyUrl));
    actions.appendChild(open);
  }
  const go = document.createElement('button');
  go.type = 'button';
  go.textContent = '继续导出';
  go.addEventListener('click', onContinue);
  actions.appendChild(go);
  box.appendChild(text);
  box.appendChild(actions);
  document.documentElement.appendChild(box);
}

function removeVerifyBanner() {
  const box = document.getElementById('tb-export-verify');
  if (box) box.remove();
}

function listUrlWith(query, datesInUrl) {
  const url = new URL(listUrl());
  if (query._tb_token_) url.searchParams.set('_tb_token_', query._tb_token_);
  if (datesInUrl) {
    for (const key of ['dateBegin', 'dateEnd', 'orderStatus', 'queryMore', 'tabCode']) {
      if (query[key]) url.searchParams.set(key, query[key]);
    }
  }
  return url.toString();
}

async function postList(query, datesInUrl) {
  const response = await fetch(listUrlWith(query, datesInUrl), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/javascript, */*; q=0.01',
    },
    body: new URLSearchParams(query),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    text: decodeResponseBytes(bytes, response.headers.get('content-type')),
  };
}

async function captureOfficialSearch(startDate, endDate) {
  const inputs = findRangeInputs();
  if (!inputs) return null;
  installListCapture();
  const box = document.getElementById('tb-export-capture');
  if (box) box.value = '';
  setCaptureWatch(true);
  setInputValue(inputs[0], startDate);
  setInputValue(inputs[1], endDate);
  if (!clickSearch()) {
    setCaptureWatch(false);
    return null;
  }
  const raw = await waitForCapture(2500);
  setCaptureWatch(false);
  if (!raw) return null;
  let captured;
  try {
    captured = JSON.parse(raw);
  } catch {
    return null;
  }
  const query = parseCapturedBody(captured.body);
  if (!query) return null;
  return postList(query, false).then((response) => ({ query, response }));
}

async function learnListRequest(context) {
  const token = readTbToken();
  const notes = [token ? messages.tokenAttached() : messages.tokenMissing()];
  const endDate = context.endDate || '';
  const startDate = context.startDate || '';
  const firstQuery = attachToken({ ...(context.query || {}) }, token);
  const first = await postList(firstQuery, false);
  if (!listFilterIgnored(first.text, endDate)) {
    return { archive: !!context.archive, query: firstQuery, datesInUrl: false, notes, response: first };
  }
  notes.push(messages.filterIgnored(newestOrderTime(first.text)));
  const dated = attachToken(classicDatedQuery({
    pageNum: context.query && context.query.pageNum,
    startDate,
    endDate,
    orderStatus: context.orderStatus,
    archive: context.archive,
    lastStartRow: context.lastStartRow,
  }), token);
  const second = await postList(dated, true);
  if (!listFilterIgnored(second.text, endDate)) {
    notes.push(messages.filterDatetime());
    return { archive: !!context.archive, query: dated, datesInUrl: true, notes, response: second };
  }
  const captured = await captureOfficialSearch(startDate, endDate);
  if (captured && !listFilterIgnored(captured.response.text, endDate)) {
    notes.push(messages.filterFromPage());
    return {
      archive: !!context.archive,
      query: captured.query,
      datesInUrl: false,
      notes,
      response: captured.response,
    };
  }
  notes.push(messages.filterLocal());
  return { archive: !!context.archive, query: firstQuery, datesInUrl: false, notes, response: first };
}

const LIST_PATH = '/trade/itemlist/asyncBought.htm?action=itemlist/BoughtQueryAction&event_submit_do_query=1&_input_charset=utf8';

let running = false;
let learnedList = null;
let stopKind = null;
let resumeVerification = () => {};
let pagePanel = null;
let activePort = null;
let portDisconnected = true;

function publish(payload) {
  if (pagePanel) pagePanel.notify(payload);
  if (!activePort || portDisconnected) return;
  try {
    activePort.postMessage(payload);
  } catch {
    portDisconnected = true;
  }
}

async function startExport(message, fromPopup) {
  if (running) return;
  running = true;
  learnedList = null;
  stopKind = null;
  if (pagePanel) pagePanel.setRunning(true);
  function waitForVerification(verifyUrl) {
    publish({ type: 'verify' });
    return new Promise((resolve) => {
      let settled = false;
      const timer = setInterval(() => {
        if (stopKind === 'cancel') finish('cancel');
      }, 400);
      function finish(value) {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        removeVerifyBanner();
        resumeVerification = () => {};
        resolve(value);
      }
      resumeVerification = () => finish(null);
      showVerifyBanner(() => finish(null), verifyUrl);
    });
  }
  try {
    const result = await runExport({
      startDate: message.startDate,
      endDate: message.endDate,
      format: message.format,
      statuses: message.statuses,
      dateFields: detectDateFields(),
      fetchPage,
      fetchLogistics,
      fetchLegacyLogistics,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      shouldStop: () => stopKind,
      waitForVerification,
      now: () => new Date(),
      onProgress(text) {
        publish({ type: 'progress', text });
      },
      onLog(line) {
        publish({ type: 'log', line });
      },
    });
    const popupOpen = fromPopup && activePort && !portDisconnected;
    if (popupOpen) {
      try {
        activePort.postMessage({ type: 'result', result });
      } catch {
        deliverFiles(result, message);
      }
    } else {
      deliverFiles(result, message);
    }
  } finally {
    removeVerifyBanner();
    running = false;
    if (pagePanel) pagePanel.setRunning(false);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tb-order-export') return;
  activePort = port;
  portDisconnected = false;
  port.onDisconnect.addListener(() => {
    if (activePort === port) portDisconnected = true;
  });
  port.onMessage.addListener((message) => {
    if (message.type === 'cancel') {
      stopKind = 'cancel';
      return;
    }
    if (message.type === 'continue') {
      resumeVerification();
      return;
    }
    if (message.type !== 'start') return;
    startExport(message, true);
  });
});

pagePanel = mountPagePanel({
  onStart(options) {
    startExport(options, false);
  },
  onCancel() {
    stopKind = 'cancel';
  },
  onResume() {
    resumeVerification();
  },
});

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

async function fetchPage(pageNum, context = {}) {
  if (!learnedList || learnedList.archive !== !!context.archive) {
    learnedList = await learnListRequest(context);
    if (Number(pageNum) === 1 && learnedList.response) {
      return { ...learnedList.response, notes: learnedList.notes };
    }
  }
  const query = applyPageNumber(learnedList.query, pageNum);
  return postList(query, learnedList.datesInUrl);
}

function detailPageUrls(orderId) {
  const id = encodeURIComponent(orderId);
  return [
    `https://trade.taobao.com/trade/detail/trade_order_detail.htm?biz_order_id=${id}`,
    `https://trade.tmall.com/detail/orderDetail.htm?biz_order_id=${id}`,
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
  if (!response) return { ok: false, status: 0, text: '', error: '无响应' };
  const bytes = new Uint8Array(response.bytes || []);
  return {
    ok: response.ok,
    status: response.status,
    error: response.error || '',
    text: decodeResponseBytes(bytes, response.contentType),
  };
}

function pageHasWaybill(text) {
  const parsed = parseLegacyLogistics(text);
  return !!(parsed.ok && (parsed.company || parsed.trackingNo));
}

async function fetchLegacyLogistics(orderId) {
  const urls = detailPageUrls(orderId);
  let last = { ok: false, status: 0, text: '', error: '' };
  let sawCaptcha = false;
  for (const url of urls) {
    const page = await requestLegacyPage(url);
    last = page;
    const text = page.text || '';
    if (page.ok && pageHasWaybill(text)) return page;
    if (isCaptchaChallenge(text)) sawCaptcha = true;
  }
  if (sawCaptcha) return { ...last, blocked: true };
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
