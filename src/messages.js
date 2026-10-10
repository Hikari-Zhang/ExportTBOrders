const messages = {
  start(startDate, endDate, format) {
    return `开始导出。范围 ${startDate} 至 ${endDate}，格式 ${format}`;
  },
  wrongPage() {
    return '当前页面不是「已买到的宝贝」，已停止';
  },
  badDate(startDate, endDate) {
    return `开始日期 ${startDate} 晚于结束日期 ${endDate}，已停止`;
  },
  readingPage(n) {
    return `正在读取第 ${n} 页`;
  },
  pageOk(n, total, inRange) {
    return `第 ${n} 页返回 ${total} 笔订单，其中 ${inRange} 笔在时间范围内`;
  },
  skipNew(orderId, createTime) {
    return `跳过订单 ${orderId}，下单时间 ${createTime} 晚于结束日期`;
  },
  stopOld(orderId, createTime) {
    return `订单 ${orderId} 下单时间 ${createTime} 早于开始日期，停止翻页`;
  },
  noMore(n) {
    return `第 ${n} 页后没有更多订单`;
  },
  pageRetry(n, reason) {
    return `第 ${n} 页读取失败，正在重试。原因：${reason}`;
  },
  pageFail(n, reason, orderCount) {
    return `第 ${n} 页重试后仍失败，已停止翻页。原因：${reason}。已获取 ${orderCount} 笔订单`;
  },
  notLogin() {
    return '未登录或登录已失效，已停止';
  },
  captcha(orderCount) {
    return `触发验证码或风控，已停止。请在订单页完成验证后再导出。已获取 ${orderCount} 笔订单`;
  },
  unrecognized(keys) {
    return `订单接口返回无法识别，已停止。响应字段：${keys}`;
  },
  noOrders() {
    return '时间范围内没有订单，未下载表格';
  },
  missingField(orderId, fieldName) {
    return `订单 ${orderId} 缺少${fieldName}，该列留空`;
  },
  usedSubtotal(orderId) {
    return `订单 ${orderId} 缺少单价，该列使用商品小计`;
  },
  skipLogistics(orderId, status) {
    return `订单 ${orderId} 状态为「${status}」，未发货，跳过物流查询`;
  },
  queryingLogistics(index, total, orderId) {
    return `正在查询物流 ${index}/${total}，订单 ${orderId}`;
  },
  legacyLogistics(orderId) {
    return `订单 ${orderId} 新接口无物流，改查旧版订单详情`;
  },
  legacyBlocked(orderId) {
    return `订单 ${orderId} 旧版订单详情触发验证，本单物流留空`;
  },
  skipStatus(orderId, status) {
    return `订单 ${orderId} 状态为「${status}」，不在所选状态中，已跳过`;
  },
  statusFilter(labels) {
    return `导出所选状态：${labels}`;
  },
  logisticsWithTrace(orderId, company, trackingNo, latest) {
    return `订单 ${orderId} 物流：${company} ${trackingNo} ${latest}`;
  },
  logisticsNoTrace(orderId, company, trackingNo) {
    return `订单 ${orderId} 物流：${company} ${trackingNo}，无轨迹`;
  },
  noLogisticsInfo(orderId) {
    return `订单 ${orderId} 无物流信息`;
  },
  multiPackage(orderId, packageCount) {
    return `订单 ${orderId} 共 ${packageCount} 个包裹，已合并到同一格`;
  },
  logisticsFail(orderId, reason) {
    return `订单 ${orderId} 物流查询失败，物流列留空。原因：${reason}`;
  },
  missingLogisticsCount(count) {
    return `有 ${count} 笔订单没查到物流`;
  },
  rowSummary(orderCount, rowCount) {
    return `共 ${orderCount} 笔订单，${rowCount} 行商品`;
  },
  downloadedTable(filename) {
    return `已下载表格 ${filename}`;
  },
  downloadedLog(filename) {
    return `已下载日志 ${filename}`;
  },
  cancelled(orderCount) {
    return `已取消。已获取 ${orderCount} 笔订单，未继续请求`;
  },
  popupClosed() {
    return '弹窗已关闭，导出已取消';
  },
  portClosed() {
    return '订单页连接已断开，请刷新订单页后重试。已停止';
  },
  exportFailed(reason) {
    return `表格生成失败，已停止。原因：${reason}`;
  },
  partialExported(orderCount, rowCount, filename) {
    return `已导出已获取的部分。订单 ${orderCount} 笔，商品 ${rowCount} 行，文件 ${filename}`;
  },
  done() {
    return '导出完成';
  },
  progressPage(n, orderCount) {
    return `正在读取第 ${n} 页，已得到 ${orderCount} 笔订单`;
  },
  progressLogistics(index, total) {
    return `正在查询物流 ${index} / ${total}`;
  },
};

module.exports = { messages };
