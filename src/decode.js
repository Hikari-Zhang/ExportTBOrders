function decodeBytes(bytes, encoding) {
  return new TextDecoder(encoding).decode(bytes);
}

function charsetFrom(contentType) {
  if (!contentType) return '';
  const match = /charset\s*=\s*["']?([^;"'\s]+)/i.exec(contentType);
  return match ? match[1].toLowerCase() : '';
}

function isGbkFamily(charset) {
  return charset === 'gbk' || charset === 'gb2312' || charset === 'gb18030' || charset === 'x-gbk';
}

function decodeResponseBytes(bytes, contentType) {
  const charset = charsetFrom(contentType);
  if (isGbkFamily(charset)) return decodeBytes(bytes, 'gbk');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return decodeBytes(bytes, 'gbk');
  }
}

module.exports = { decodeBytes, decodeResponseBytes };
