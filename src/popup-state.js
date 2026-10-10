const { isOrderListUrl } = require('./urls');
const { messages } = require('./messages');

const ORDER_PAGE = 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm';

function popupView(state) {
  const onOrderPage = isOrderListUrl(state.url);
  const dateError = state.startDate > state.endDate;
  return {
    showOpenPage: !onOrderPage,
    exportDisabled: state.running ? false : (!onOrderPage || dateError),
    exportLabel: state.running ? '取消' : '开始导出',
    showPartial: !state.running && !!(state.result && state.result.status === 'partial-ready'),
    dateError,
    pageMessage: onOrderPage ? '' : messages.wrongPage(),
    orderPageUrl: ORDER_PAGE,
  };
}

module.exports = { popupView, ORDER_PAGE };
