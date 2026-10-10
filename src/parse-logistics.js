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
