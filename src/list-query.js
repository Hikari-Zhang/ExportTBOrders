const BEGIN_NAMES = ['dateBegin', 'startTime'];
const END_NAMES = ['dateEnd', 'endTime'];

function pickNames(detected, candidates) {
  if (!detected || detected.length === 0) return candidates;
  const found = candidates.filter((name) => detected.includes(name));
  return found.length > 0 ? found : candidates;
}

function buildListQuery(options) {
  const pageNum = Number(options.pageNum) || 1;
  const detected = options.dateFields || [];
  const query = {
    pageNum: String(pageNum),
    pageSize: '15',
    prePageNo: String(Math.max(pageNum - 1, 0)),
    queryOrder: 'desc',
    queryMore: 'true',
  };
  for (const name of pickNames(detected, BEGIN_NAMES)) query[name] = options.startDate;
  for (const name of pickNames(detected, END_NAMES)) query[name] = options.endDate;
  if (options.orderStatus) query.orderStatus = options.orderStatus;
  if (options.archive) {
    query.tabCode = 'before3Months';
    if (options.lastStartRow) query.lastStartRow = options.lastStartRow;
  }
  return query;
}

function describeListQuery(query) {
  const keys = ['dateBegin', 'dateEnd', 'startTime', 'endTime', 'orderStatus', 'queryMore', 'tabCode'];
  return keys.filter((key) => query[key]).map((key) => `${key}=${query[key]}`).join('，');
}

function newestOrderTime(text) {
  try {
    const json = JSON.parse(text);
    const order = json && Array.isArray(json.mainOrders) ? json.mainOrders[0] : null;
    const time = order && order.orderInfo && order.orderInfo.createTime;
    return time == null ? '' : String(time);
  } catch {
    return '';
  }
}

function listFilterIgnored(text, endDate) {
  const time = newestOrderTime(text);
  if (!time || !endDate) return false;
  return time.slice(0, 10) > endDate;
}

function attachToken(query, token) {
  const next = { ...query };
  if (token) next._tb_token_ = token;
  return next;
}

function classicDatedQuery(options) {
  const pageNum = Number(options.pageNum) || 1;
  const query = {
    pageNum: String(pageNum),
    pageSize: '15',
    prePageNo: String(Math.max(pageNum - 1, 0)),
    queryOrder: 'desc',
    queryMore: 'true',
    dateBegin: `${options.startDate} 00:00:00`,
    dateEnd: `${options.endDate} 23:59:59`,
  };
  if (options.orderStatus) query.orderStatus = options.orderStatus;
  if (options.archive) {
    query.tabCode = 'before3Months';
    if (options.lastStartRow) query.lastStartRow = options.lastStartRow;
  }
  return query;
}

function applyPageNumber(query, pageNum) {
  const next = {
    ...query,
    pageNum: String(pageNum),
    prePageNo: String(Math.max(Number(pageNum) - 1, 0)),
  };
  if (Object.prototype.hasOwnProperty.call(query, 'page')) next.page = String(pageNum);
  return next;
}

function parseCapturedBody(body) {
  if (body == null) return null;
  const text = String(body).trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const json = JSON.parse(text);
      return json && typeof json === 'object' && !Array.isArray(json) ? json : null;
    } catch {
      return null;
    }
  }
  const params = new URLSearchParams(text);
  const query = {};
  for (const [key, value] of params) query[key] = value;
  return Object.keys(query).length > 0 ? query : null;
}

module.exports = {
  buildListQuery,
  describeListQuery,
  newestOrderTime,
  listFilterIgnored,
  attachToken,
  classicDatedQuery,
  applyPageNumber,
  parseCapturedBody,
};
