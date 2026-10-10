function withBom(bytes) {
  const out = new Uint8Array(3 + bytes.length);
  out[0] = 0xEF;
  out[1] = 0xBB;
  out[2] = 0xBF;
  out.set(bytes, 3);
  return out;
}

function encodeLogText(text) {
  return withBom(new TextEncoder().encode(text));
}

module.exports = { withBom, encodeLogText };
