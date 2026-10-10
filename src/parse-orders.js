const { messages } = require('./messages');

const SKIP_STATUS = ['等待买家付款', '待付款', '等待卖家发货', '待发货', '未发货'];

function needsLogistics(statusText) {
  const text = statusText == null ? '' : String(statusText);
  return !SKIP_STATUS.some((word) => text.includes(word));
}

function textOf(value) {
  if (value == null) return '';
  return String(value);
}

function formatSku(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(formatSku).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const name = value.name || value.propName || value.text;
    const content = value.value || value.content || value.desc;
    if (name != null && content != null && typeof content !== 'object') {
      return `${formatSku(name)}: ${formatSku(content)}`;
    }
    if (content != null && typeof content !== 'object') return formatSku(content);
    return Object.values(value).map(formatSku).filter(Boolean).join(' ');
  }
  return '';
}

function blank(orderId, fieldName, logs) {
  logs.push({ level: 'warn', message: messages.missingField(orderId, fieldName) });
  return '';
}

function buildRows(orders, logisticsById) {
  const rows = [];
  const logs = [];
  for (const order of orders) {
    const orderId = textOf(order.id);
    const createTime = order.orderInfo ? textOf(order.orderInfo.createTime) : '';
    const shopName = order.seller ? textOf(order.seller.shopName) : '';
    const actualFee = order.payInfo ? textOf(order.payInfo.actualFee) : '';
    const status = order.statusInfo ? textOf(order.statusInfo.text) : '';
    const logistics = logisticsById[orderId] || { company: '', trackingNo: '', latest: '' };
    const subOrders = Array.isArray(order.subOrders) && order.subOrders.length > 0
      ? order.subOrders
      : [null];

    if (!createTime) blank(orderId, '下单时间', logs);
    if (!shopName) blank(orderId, '店铺', logs);
    if (!actualFee) blank(orderId, '订单实付', logs);
    if (!status) blank(orderId, '订单状态', logs);
    if (!orderId) blank(orderId, '订单号', logs);

    for (const sub of subOrders) {
      let title = '';
      let sku = '';
      let quantity = '';
      let price = '';
      if (!sub) {
        title = blank(orderId, '商品名称', logs);
        sku = blank(orderId, '规格', logs);
        quantity = blank(orderId, '数量', logs);
        price = blank(orderId, '单价', logs);
      } else {
        title = sub.itemInfo ? textOf(sub.itemInfo.title) : '';
        sku = sub.itemInfo ? formatSku(sub.itemInfo.skuText) : '';
        quantity = textOf(sub.quantity);
        const priceInfo = sub.priceInfo || {};
        if (priceInfo.price != null && priceInfo.price !== '') {
          price = textOf(priceInfo.price);
        } else if (priceInfo.realTotal != null && priceInfo.realTotal !== '') {
          price = textOf(priceInfo.realTotal);
          logs.push({ level: 'warn', message: messages.usedSubtotal(orderId) });
        } else {
          price = blank(orderId, '单价', logs);
        }
        if (!title) title = blank(orderId, '商品名称', logs);
        if (!sku) sku = blank(orderId, '规格', logs);
        if (!quantity) quantity = blank(orderId, '数量', logs);
      }

      rows.push({
        订单号: orderId,
        下单时间: createTime,
        店铺: shopName,
        商品名称: title,
        规格: sku,
        数量: quantity,
        单价: price,
        订单实付: actualFee,
        订单状态: status,
        物流公司: textOf(logistics.company),
        运单号: textOf(logistics.trackingNo),
        最新物流: textOf(logistics.latest),
      });
    }
  }
  return { rows, logs };
}

module.exports = { needsLogistics, buildRows };
