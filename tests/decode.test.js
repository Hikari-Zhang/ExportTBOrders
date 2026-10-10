const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeBytes } = require('../src/decode');

test('按 GBK 解码中文', () => {
  const bytes = Buffer.from('中通', 'utf8');
  assert.equal(decodeBytes(bytes, 'utf-8'), '中通');
  const encoded = new Uint8Array([0xD6, 0xD0, 0xCD, 0xA8]);
  assert.equal(decodeBytes(encoded, 'gbk'), '中通');
});
