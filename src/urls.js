function isOrderListUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hostOk = parsed.hostname === 'buyertrade.taobao.com' || parsed.hostname === 'trade.taobao.com';
  return hostOk && parsed.pathname.startsWith('/trade/itemlist/');
}

module.exports = { isOrderListUrl };
