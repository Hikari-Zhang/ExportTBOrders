const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeBytes, decodeResponseBytes } = require('../src/decode');

const zhongtongGbk = new Uint8Array([0xD6, 0xD0, 0xCD, 0xA8]);

test('按 GBK 解码中文', () => {
  const bytes = Buffer.from('中通', 'utf8');
  assert.equal(decodeBytes(bytes, 'utf-8'), '中通');
  assert.equal(decodeBytes(zhongtongGbk, 'gbk'), '中通');
});

test('响应没有标明编码时，UTF-8 和 GBK 都能解出中文', () => {
  assert.equal(decodeResponseBytes(Buffer.from('{"title":"杯子"}', 'utf8'), ''), '{"title":"杯子"}');
  const body = new Uint8Array([
    ...Buffer.from('{"shopName":"', 'utf8'),
    ...zhongtongGbk,
    ...Buffer.from('"}', 'utf8'),
  ]);
  assert.equal(decodeResponseBytes(body, ''), '{"shopName":"中通"}');
});

test('响应头写了 GBK 时按 GBK 解码', () => {
  assert.equal(
    decodeResponseBytes(zhongtongGbk, 'application/json;charset=GBK'),
    '中通'
  );
});

test('响应头写 UTF-8 但正文是 GBK 时仍解出中文', () => {
  const body = new Uint8Array([
    ...Buffer.from('{"title":"', 'utf8'),
    ...zhongtongGbk,
    ...Buffer.from('"}', 'utf8'),
  ]);
  assert.equal(decodeResponseBytes(body, 'text/html; charset=utf-8'), '{"title":"中通"}');
});
