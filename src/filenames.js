function pad(value) {
  return String(value).padStart(2, '0');
}

function tableFilename(startDate, endDate, format, partial) {
  const suffix = partial ? '_部分' : '';
  return `淘宝订单_${startDate}_${endDate}${suffix}.${format}`;
}

function logFilename(date) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `淘宝订单_导出日志_${stamp}.txt`;
}

module.exports = { tableFilename, logFilename };
