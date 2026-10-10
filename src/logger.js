function pad(value) {
  return String(value).padStart(2, '0');
}

function formatLogTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatLogLine(date, level, message) {
  return `${formatLogTime(date)} [${level}] ${message}`;
}

function createLogger(now = () => new Date()) {
  const lines = [];
  function push(level, message) {
    lines.push(formatLogLine(now(), level, message));
  }
  return {
    lines,
    info(message) { push('信息', message); },
    warn(message) { push('警告', message); },
    error(message) { push('错误', message); },
    text() {
      return lines.length ? `${lines.join('\n')}\n` : '';
    },
  };
}

module.exports = { createLogger, formatLogLine };
