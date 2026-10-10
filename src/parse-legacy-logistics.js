const { parseLogisticsBody } = require('./parse-logistics');

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function valueOnLine(line, label) {
  const at = line.indexOf(label);
  if (at < 0) return '';
  return line.slice(at + label.length).replace(/^[：:\s]+/, '').split(/\s/)[0] || '';
}

function textAfterLabel(html, labels) {
  const lines = plainText(html).split('\n').map((line) => line.trim()).filter(Boolean);
  for (const label of labels) {
    for (let index = 0; index < lines.length; index += 1) {
      if (!lines[index].includes(label)) continue;
      const inline = valueOnLine(lines[index], label);
      if (inline) return inline;
      const next = lines[index + 1];
      if (next && !/公司|运单|单号|地址|方式|留言/.test(next)) return next;
    }
  }
  return '';
}

function plainText(html) {
  return decodeEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n'));
}

function collectTraces(html) {
  const lines = plainText(html).split(/\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(20\d{2}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(?:\s+(.*))?$/);
    if (!match) continue;
    let desc = (match[2] || '').trim();
    const next = lines[index + 1];
    if (!desc && next && !/^20\d{2}-\d{2}-\d{2}/.test(next)) desc = next;
    if (desc && !['宝贝', '状态', '单价', '数量', '优惠', '运费'].includes(desc)) {
      items.push({ time: match[1].replace('T', ' '), desc });
    }
  }
  return items;
}

function parseLegacyLogistics(text) {
  const body = text == null ? '' : String(text).trim();
  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      return parseLogisticsBody(JSON.parse(body));
    } catch {
      return { ok: false, reason: '旧版物流页不是有效数据' };
    }
  }
  const company = textAfterLabel(body, ['物流公司', '承运公司', '快递公司']);
  const trackingNo = textAfterLabel(body, ['运单号码', '运单号', '快递单号']);
  const traces = collectTraces(body);
  let latest = '';
  let bestTime = '';
  for (const item of traces) {
    if (!latest || item.time >= bestTime) {
      latest = item.desc;
      bestTime = item.time;
    }
  }
  const cleanCompany = company === '—' || company === '-' ? '' : company;
  const cleanTracking = trackingNo === '—' || trackingNo === '-' ? '' : trackingNo;
  if (!cleanCompany && !cleanTracking) {
    return { ok: false, reason: '旧版物流页无物流信息' };
  }
  return {
    ok: true,
    company: cleanCompany,
    trackingNo: cleanTracking,
    latest,
    packageCount: 1,
    hasTrace: latest !== '',
  };
}

module.exports = { parseLegacyLogistics };
