const { defaultRange } = require('./dates');
const { popupView } = require('./popup-state');

const STATUS_OPTIONS = [
  ['wait-pay', '待付款'],
  ['wait-send', '待发货'],
  ['wait-receive', '待收货'],
  ['success', '交易成功'],
  ['closed', '交易关闭'],
  ['refund', '退款'],
];

function mountPagePanel(actions) {
  if (document.getElementById('tb-export-panel')) return null;
  const host = document.createElement('div');
  host.id = 'tb-export-panel';
  host.style.cssText = 'all:initial;position:fixed;display:block;top:72px;right:16px;z-index:2147483646;width:380px;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = [
    ':host { all: initial; }',
    '.panel { width: 100%; font: 13px/1.4 "Segoe UI", sans-serif; color: #222; background: #fff; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.18); overflow: hidden; }',
    '.bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #ff5000; color: #fff; cursor: move; user-select: none; }',
    '.bar strong { flex: 1; font-size: 14px; }',
    '.bar button { background: transparent; color: #fff; border: 0; cursor: pointer; font-size: 16px; }',
    '.body { max-height: 70vh; overflow: auto; padding: 10px 12px 12px; }',
    'label, fieldset { display: block; margin: 8px 0; }',
    'fieldset label { display: inline-block; margin: 2px 10px 2px 0; }',
    'button.action { margin: 0 8px 8px 0; }',
    '.error { color: #a40000; }',
    '#log { height: 160px; overflow: auto; background: #f6f6f6; padding: 8px; white-space: pre-wrap; margin: 0; }',
  ].join('\n');
  const panel = document.createElement('div');
  panel.className = 'panel';
  const bar = document.createElement('div');
  bar.className = 'bar';
  const title = document.createElement('strong');
  title.textContent = '淘宝订单导出';
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.textContent = '—';
  bar.append(title, fold);
  const body = document.createElement('div');
  body.className = 'body';
  const range = defaultRange(new Date());
  body.innerHTML = [
    '<label>开始日期 <input id="start-date" type="date"></label>',
    '<label>结束日期 <input id="end-date" type="date"></label>',
    '<p id="date-error" class="error" hidden>开始日期不能晚于结束日期</p>',
    '<fieldset><legend>订单状态</legend>',
    STATUS_OPTIONS.map(([value, label]) => `<label><input name="status" type="checkbox" value="${value}" checked> ${label}</label>`).join(''),
    '</fieldset>',
    '<p id="status-error" class="error" hidden>请至少选择一种订单状态</p>',
    '<fieldset><legend>格式</legend>',
    '<label><input name="format" type="radio" value="xlsx" checked> Excel</label>',
    '<label><input name="format" type="radio" value="csv"> CSV</label>',
    '</fieldset>',
    '<button id="export" class="action" type="button">开始导出</button>',
    '<button id="resume" class="action" type="button" hidden>我已完成验证，继续</button>',
    '<p id="progress"></p>',
    '<pre id="log"></pre>',
  ].join('');
  panel.append(bar, body);
  shadow.append(style, panel);
  document.documentElement.appendChild(host);

  const startInput = shadow.getElementById('start-date');
  const endInput = shadow.getElementById('end-date');
  const dateError = shadow.getElementById('date-error');
  const statusError = shadow.getElementById('status-error');
  const exportButton = shadow.getElementById('export');
  const resumeButton = shadow.getElementById('resume');
  const progress = shadow.getElementById('progress');
  const logNode = shadow.getElementById('log');
  startInput.value = range.startDate;
  endInput.value = range.endDate;

  let running = false;
  let dragging = null;

  function selectedStatuses() {
    return Array.from(shadow.querySelectorAll('input[name="status"]:checked')).map((item) => item.value);
  }

  function selectedFormat() {
    const picked = shadow.querySelector('input[name="format"]:checked');
    return picked ? picked.value : 'xlsx';
  }

  function render() {
    const view = popupView({
      url: location.href,
      running,
      startDate: startInput.value,
      endDate: endInput.value,
      statuses: selectedStatuses(),
      result: null,
    });
    dateError.hidden = !view.dateError;
    statusError.hidden = !view.statusError;
    exportButton.disabled = view.exportDisabled;
    exportButton.textContent = view.exportLabel;
  }

  function addLog(line) {
    logNode.textContent = `${logNode.textContent}${line}\n`;
    logNode.scrollTop = logNode.scrollHeight;
  }

  startInput.addEventListener('change', render);
  endInput.addEventListener('change', render);
  shadow.querySelectorAll('input[name="status"]').forEach((item) => {
    item.addEventListener('change', render);
  });
  exportButton.addEventListener('click', () => {
    if (running) {
      actions.onCancel();
      return;
    }
    actions.onStart({
      startDate: startInput.value,
      endDate: endInput.value,
      format: selectedFormat(),
      statuses: selectedStatuses(),
    });
  });
  resumeButton.addEventListener('click', () => {
    resumeButton.hidden = true;
    actions.onResume();
  });
  fold.addEventListener('click', () => {
    body.hidden = !body.hidden;
    fold.textContent = body.hidden ? '+' : '—';
  });
  bar.addEventListener('mousedown', (event) => {
    if (event.target === fold) return;
    const rect = host.getBoundingClientRect();
    dragging = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    host.style.left = `${Math.max(0, event.clientX - dragging.dx)}px`;
    host.style.top = `${Math.max(0, event.clientY - dragging.dy)}px`;
    host.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => {
    dragging = null;
  });
  render();

  return {
    notify(payload) {
      if (!payload) return;
      if (payload.type === 'log') addLog(payload.line);
      if (payload.type === 'progress') progress.textContent = payload.text;
      if (payload.type === 'verify') {
        progress.textContent = '遇到验证。完成后点「我已完成验证，继续」';
        resumeButton.hidden = false;
      }
    },
    setRunning(value) {
      running = value;
      if (!value) resumeButton.hidden = true;
      render();
    },
  };
}

module.exports = { mountPagePanel };
