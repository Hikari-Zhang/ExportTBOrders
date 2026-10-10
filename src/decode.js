function decodeBytes(bytes, encoding) {
  return new TextDecoder(encoding).decode(bytes);
}

module.exports = { decodeBytes };
