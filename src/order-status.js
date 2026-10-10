const STATUS_FILTERS = [
  { id: 'wait-pay', label: '待付款', keywords: ['等待买家付款', '待付款'] },
  { id: 'wait-send', label: '待发货', keywords: ['等待卖家发货', '待发货', '买家已付款'] },
  { id: 'wait-receive', label: '待收货', keywords: ['卖家已发货', '待收货', '已发货', '部分发货'] },
  { id: 'success', label: '交易成功', keywords: ['交易成功'] },
  { id: 'closed', label: '交易关闭', keywords: ['交易关闭'] },
  { id: 'refund', label: '退款', keywords: ['退款'] },
];

function statusLabel(id) {
  const found = STATUS_FILTERS.find((item) => item.id === id);
  return found ? found.label : id;
}

function matchesStatus(statusText, selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.includes('all')) return true;
  const text = statusText == null ? '' : String(statusText);
  return STATUS_FILTERS.some((item) => (
    selectedIds.includes(item.id) && item.keywords.some((word) => text.includes(word))
  ));
}

module.exports = { STATUS_FILTERS, matchesStatus, statusLabel };
