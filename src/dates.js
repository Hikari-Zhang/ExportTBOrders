function pad(value) {
  return String(value).padStart(2, '0');
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function defaultRange(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  return { startDate: formatYmd(start), endDate: formatYmd(end) };
}

function parseDateTime(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(String(text == null ? '' : text).trim());
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  );
}

function classifyTime(createTime, startDate, endDate) {
  const time = parseDateTime(createTime);
  if (!time) return 'invalid';
  const start = parseDateTime(startDate);
  start.setHours(0, 0, 0, 0);
  const end = parseDateTime(endDate);
  end.setHours(23, 59, 59, 999);
  if (time.getTime() < start.getTime()) return 'before';
  if (time.getTime() > end.getTime()) return 'after';
  return 'inside';
}

function isBeforeThreeMonths(startDate, now = new Date()) {
  const boundary = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
  boundary.setHours(0, 0, 0, 0);
  const start = parseDateTime(startDate);
  if (!start) return false;
  start.setHours(0, 0, 0, 0);
  return start.getTime() < boundary.getTime();
}

module.exports = { formatYmd, defaultRange, classifyTime, isBeforeThreeMonths };
