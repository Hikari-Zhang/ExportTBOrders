(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/messages.js
  var require_messages = __commonJS({
    "src/messages.js"(exports, module) {
      var messages2 = {
        start(startDate, endDate, format) {
          return `\u5F00\u59CB\u5BFC\u51FA\u3002\u8303\u56F4 ${startDate} \u81F3 ${endDate}\uFF0C\u683C\u5F0F ${format}`;
        },
        wrongPage() {
          return "\u5F53\u524D\u9875\u9762\u4E0D\u662F\u300C\u5DF2\u4E70\u5230\u7684\u5B9D\u8D1D\u300D\uFF0C\u5DF2\u505C\u6B62";
        },
        badDate(startDate, endDate) {
          return `\u5F00\u59CB\u65E5\u671F ${startDate} \u665A\u4E8E\u7ED3\u675F\u65E5\u671F ${endDate}\uFF0C\u5DF2\u505C\u6B62`;
        },
        readingPage(n) {
          return `\u6B63\u5728\u8BFB\u53D6\u7B2C ${n} \u9875`;
        },
        pageOk(n, total, inRange) {
          return `\u7B2C ${n} \u9875\u8FD4\u56DE ${total} \u7B14\u8BA2\u5355\uFF0C\u5176\u4E2D ${inRange} \u7B14\u5728\u65F6\u95F4\u8303\u56F4\u5185`;
        },
        skipNew(orderId, createTime) {
          return `\u8DF3\u8FC7\u8BA2\u5355 ${orderId}\uFF0C\u4E0B\u5355\u65F6\u95F4 ${createTime} \u665A\u4E8E\u7ED3\u675F\u65E5\u671F`;
        },
        stopOld(orderId, createTime) {
          return `\u8BA2\u5355 ${orderId} \u4E0B\u5355\u65F6\u95F4 ${createTime} \u65E9\u4E8E\u5F00\u59CB\u65E5\u671F\uFF0C\u505C\u6B62\u7FFB\u9875`;
        },
        noMore(n) {
          return `\u7B2C ${n} \u9875\u540E\u6CA1\u6709\u66F4\u591A\u8BA2\u5355`;
        },
        pageRetry(n, reason) {
          return `\u7B2C ${n} \u9875\u8BFB\u53D6\u5931\u8D25\uFF0C\u6B63\u5728\u91CD\u8BD5\u3002\u539F\u56E0\uFF1A${reason}`;
        },
        pageFail(n, reason, orderCount) {
          return `\u7B2C ${n} \u9875\u91CD\u8BD5\u540E\u4ECD\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u7FFB\u9875\u3002\u539F\u56E0\uFF1A${reason}\u3002\u5DF2\u83B7\u53D6 ${orderCount} \u7B14\u8BA2\u5355`;
        },
        notLogin() {
          return "\u672A\u767B\u5F55\u6216\u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u5DF2\u505C\u6B62";
        },
        captcha(orderCount) {
          return `\u89E6\u53D1\u9A8C\u8BC1\u7801\u6216\u98CE\u63A7\uFF0C\u5DF2\u505C\u6B62\u3002\u8BF7\u5728\u8BA2\u5355\u9875\u5B8C\u6210\u9A8C\u8BC1\u540E\u518D\u5BFC\u51FA\u3002\u5DF2\u83B7\u53D6 ${orderCount} \u7B14\u8BA2\u5355`;
        },
        unrecognized(keys) {
          return `\u8BA2\u5355\u63A5\u53E3\u8FD4\u56DE\u65E0\u6CD5\u8BC6\u522B\uFF0C\u5DF2\u505C\u6B62\u3002\u54CD\u5E94\u5B57\u6BB5\uFF1A${keys}`;
        },
        noOrders() {
          return "\u65F6\u95F4\u8303\u56F4\u5185\u6CA1\u6709\u8BA2\u5355\uFF0C\u672A\u4E0B\u8F7D\u8868\u683C";
        },
        missingField(orderId, fieldName) {
          return `\u8BA2\u5355 ${orderId} \u7F3A\u5C11${fieldName}\uFF0C\u8BE5\u5217\u7559\u7A7A`;
        },
        usedSubtotal(orderId) {
          return `\u8BA2\u5355 ${orderId} \u7F3A\u5C11\u5355\u4EF7\uFF0C\u8BE5\u5217\u4F7F\u7528\u5546\u54C1\u5C0F\u8BA1`;
        },
        skipLogistics(orderId, status) {
          return `\u8BA2\u5355 ${orderId} \u72B6\u6001\u4E3A\u300C${status}\u300D\uFF0C\u672A\u53D1\u8D27\uFF0C\u8DF3\u8FC7\u7269\u6D41\u67E5\u8BE2`;
        },
        queryingLogistics(index, total, orderId) {
          return `\u6B63\u5728\u67E5\u8BE2\u7269\u6D41 ${index}/${total}\uFF0C\u8BA2\u5355 ${orderId}`;
        },
        logisticsWithTrace(orderId, company, trackingNo, latest) {
          return `\u8BA2\u5355 ${orderId} \u7269\u6D41\uFF1A${company} ${trackingNo} ${latest}`;
        },
        logisticsNoTrace(orderId, company, trackingNo) {
          return `\u8BA2\u5355 ${orderId} \u7269\u6D41\uFF1A${company} ${trackingNo}\uFF0C\u65E0\u8F68\u8FF9`;
        },
        noLogisticsInfo(orderId) {
          return `\u8BA2\u5355 ${orderId} \u65E0\u7269\u6D41\u4FE1\u606F`;
        },
        multiPackage(orderId, packageCount) {
          return `\u8BA2\u5355 ${orderId} \u5171 ${packageCount} \u4E2A\u5305\u88F9\uFF0C\u5DF2\u5408\u5E76\u5230\u540C\u4E00\u683C`;
        },
        logisticsFail(orderId, reason) {
          return `\u8BA2\u5355 ${orderId} \u7269\u6D41\u67E5\u8BE2\u5931\u8D25\uFF0C\u7269\u6D41\u5217\u7559\u7A7A\u3002\u539F\u56E0\uFF1A${reason}`;
        },
        missingLogisticsCount(count) {
          return `\u6709 ${count} \u7B14\u8BA2\u5355\u6CA1\u67E5\u5230\u7269\u6D41`;
        },
        rowSummary(orderCount, rowCount) {
          return `\u5171 ${orderCount} \u7B14\u8BA2\u5355\uFF0C${rowCount} \u884C\u5546\u54C1`;
        },
        downloadedTable(filename) {
          return `\u5DF2\u4E0B\u8F7D\u8868\u683C ${filename}`;
        },
        downloadedLog(filename) {
          return `\u5DF2\u4E0B\u8F7D\u65E5\u5FD7 ${filename}`;
        },
        cancelled(orderCount) {
          return `\u5DF2\u53D6\u6D88\u3002\u5DF2\u83B7\u53D6 ${orderCount} \u7B14\u8BA2\u5355\uFF0C\u672A\u7EE7\u7EED\u8BF7\u6C42`;
        },
        popupClosed() {
          return "\u5F39\u7A97\u5DF2\u5173\u95ED\uFF0C\u5BFC\u51FA\u5DF2\u53D6\u6D88";
        },
        portClosed() {
          return "\u8BA2\u5355\u9875\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u5237\u65B0\u8BA2\u5355\u9875\u540E\u91CD\u8BD5\u3002\u5DF2\u505C\u6B62";
        },
        exportFailed(reason) {
          return `\u8868\u683C\u751F\u6210\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u3002\u539F\u56E0\uFF1A${reason}`;
        },
        partialExported(orderCount, rowCount, filename) {
          return `\u5DF2\u5BFC\u51FA\u5DF2\u83B7\u53D6\u7684\u90E8\u5206\u3002\u8BA2\u5355 ${orderCount} \u7B14\uFF0C\u5546\u54C1 ${rowCount} \u884C\uFF0C\u6587\u4EF6 ${filename}`;
        },
        done() {
          return "\u5BFC\u51FA\u5B8C\u6210";
        },
        progressPage(n, orderCount) {
          return `\u6B63\u5728\u8BFB\u53D6\u7B2C ${n} \u9875\uFF0C\u5DF2\u5F97\u5230 ${orderCount} \u7B14\u8BA2\u5355`;
        },
        progressLogistics(index, total) {
          return `\u6B63\u5728\u67E5\u8BE2\u7269\u6D41 ${index} / ${total}`;
        }
      };
      module.exports = { messages: messages2 };
    }
  });

  // src/logger.js
  var require_logger = __commonJS({
    "src/logger.js"(exports, module) {
      function pad(value) {
        return String(value).padStart(2, "0");
      }
      function formatLogTime(date) {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      }
      function formatLogLine(date, level, message) {
        return `${formatLogTime(date)} [${level}] ${message}`;
      }
      function createLogger2(now = () => /* @__PURE__ */ new Date()) {
        const lines = [];
        function push(level, message) {
          lines.push(formatLogLine(now(), level, message));
        }
        return {
          lines,
          info(message) {
            push("\u4FE1\u606F", message);
          },
          warn(message) {
            push("\u8B66\u544A", message);
          },
          error(message) {
            push("\u9519\u8BEF", message);
          },
          text() {
            return lines.length ? `${lines.join("\n")}
` : "";
          }
        };
      }
      module.exports = { createLogger: createLogger2, formatLogLine };
    }
  });

  // src/dates.js
  var require_dates = __commonJS({
    "src/dates.js"(exports, module) {
      function pad(value) {
        return String(value).padStart(2, "0");
      }
      function formatYmd(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      }
      function defaultRange(now = /* @__PURE__ */ new Date()) {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = new Date(end);
        start.setMonth(start.getMonth() - 3);
        return { startDate: formatYmd(start), endDate: formatYmd(end) };
      }
      function parseDateTime(text) {
        const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(String(text == null ? "" : text).trim());
        if (!match) return null;
        return new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4] || 0),
          Number(match[5] || 0),
          Number(match[6] || 0)
        );
      }
      function classifyTime(createTime, startDate, endDate) {
        const time = parseDateTime(createTime);
        if (!time) return "invalid";
        const start = parseDateTime(startDate);
        start.setHours(0, 0, 0, 0);
        const end = parseDateTime(endDate);
        end.setHours(23, 59, 59, 999);
        if (time.getTime() < start.getTime()) return "before";
        if (time.getTime() > end.getTime()) return "after";
        return "inside";
      }
      module.exports = { formatYmd, defaultRange, classifyTime };
    }
  });

  // src/parse-orders.js
  var require_parse_orders = __commonJS({
    "src/parse-orders.js"(exports, module) {
      var { messages: messages2 } = require_messages();
      var SKIP_STATUS = ["\u7B49\u5F85\u4E70\u5BB6\u4ED8\u6B3E", "\u5F85\u4ED8\u6B3E", "\u7B49\u5F85\u5356\u5BB6\u53D1\u8D27", "\u5F85\u53D1\u8D27", "\u672A\u53D1\u8D27"];
      function needsLogistics(statusText) {
        const text = statusText == null ? "" : String(statusText);
        return !SKIP_STATUS.some((word) => text.includes(word));
      }
      function textOf(value) {
        if (value == null) return "";
        return String(value);
      }
      function blank(orderId, fieldName, logs) {
        logs.push({ level: "warn", message: messages2.missingField(orderId, fieldName) });
        return "";
      }
      function buildRows(orders, logisticsById) {
        const rows = [];
        const logs = [];
        for (const order of orders) {
          const orderId = textOf(order.id);
          const createTime = order.orderInfo ? textOf(order.orderInfo.createTime) : "";
          const shopName = order.seller ? textOf(order.seller.shopName) : "";
          const actualFee = order.payInfo ? textOf(order.payInfo.actualFee) : "";
          const status = order.statusInfo ? textOf(order.statusInfo.text) : "";
          const logistics = logisticsById[orderId] || { company: "", trackingNo: "", latest: "" };
          const subOrders = Array.isArray(order.subOrders) && order.subOrders.length > 0 ? order.subOrders : [null];
          if (!createTime) blank(orderId, "\u4E0B\u5355\u65F6\u95F4", logs);
          if (!shopName) blank(orderId, "\u5E97\u94FA", logs);
          if (!actualFee) blank(orderId, "\u8BA2\u5355\u5B9E\u4ED8", logs);
          if (!status) blank(orderId, "\u8BA2\u5355\u72B6\u6001", logs);
          if (!orderId) blank(orderId, "\u8BA2\u5355\u53F7", logs);
          for (const sub of subOrders) {
            let title = "";
            let sku = "";
            let quantity = "";
            let price = "";
            if (!sub) {
              title = blank(orderId, "\u5546\u54C1\u540D\u79F0", logs);
              sku = blank(orderId, "\u89C4\u683C", logs);
              quantity = blank(orderId, "\u6570\u91CF", logs);
              price = blank(orderId, "\u5355\u4EF7", logs);
            } else {
              title = sub.itemInfo ? textOf(sub.itemInfo.title) : "";
              sku = sub.itemInfo ? textOf(sub.itemInfo.skuText) : "";
              quantity = textOf(sub.quantity);
              const priceInfo = sub.priceInfo || {};
              if (priceInfo.price != null && priceInfo.price !== "") {
                price = textOf(priceInfo.price);
              } else if (priceInfo.realTotal != null && priceInfo.realTotal !== "") {
                price = textOf(priceInfo.realTotal);
                logs.push({ level: "warn", message: messages2.usedSubtotal(orderId) });
              } else {
                price = blank(orderId, "\u5355\u4EF7", logs);
              }
              if (!title) title = blank(orderId, "\u5546\u54C1\u540D\u79F0", logs);
              if (!sku) sku = blank(orderId, "\u89C4\u683C", logs);
              if (!quantity) quantity = blank(orderId, "\u6570\u91CF", logs);
            }
            rows.push({
              \u8BA2\u5355\u53F7: orderId,
              \u4E0B\u5355\u65F6\u95F4: createTime,
              \u5E97\u94FA: shopName,
              \u5546\u54C1\u540D\u79F0: title,
              \u89C4\u683C: sku,
              \u6570\u91CF: quantity,
              \u5355\u4EF7: price,
              \u8BA2\u5355\u5B9E\u4ED8: actualFee,
              \u8BA2\u5355\u72B6\u6001: status,
              \u7269\u6D41\u516C\u53F8: textOf(logistics.company),
              \u8FD0\u5355\u53F7: textOf(logistics.trackingNo),
              \u6700\u65B0\u7269\u6D41: textOf(logistics.latest)
            });
          }
        }
        return { rows, logs };
      }
      module.exports = { needsLogistics, buildRows };
    }
  });

  // src/parse-logistics.js
  var require_parse_logistics = __commonJS({
    "src/parse-logistics.js"(exports, module) {
      function textList(value) {
        if (Array.isArray(value)) {
          return value.map((item) => item == null ? "" : String(item)).filter((item) => item !== "");
        }
        if (value == null || value === "") return [];
        return [String(value)];
      }
      function firstTraceArray(json) {
        for (const key of ["address", "traceList", "transitStepInfo"]) {
          if (Array.isArray(json[key])) return json[key];
        }
        return [];
      }
      function traceTime(item) {
        if (!item) return "";
        if (item.time != null && item.time !== "") return String(item.time);
        if (item.status_time != null && item.status_time !== "") return String(item.status_time);
        return "";
      }
      function traceDesc(item) {
        if (!item) return "";
        if (item.place != null && item.place !== "") return String(item.place);
        if (item.status_desc != null && item.status_desc !== "") return String(item.status_desc);
        if (item.desc != null && item.desc !== "") return String(item.desc);
        return "";
      }
      function latestTrace(items) {
        let best = null;
        let bestTime = "";
        for (const item of items) {
          const time = traceTime(item);
          const desc = traceDesc(item);
          if (!desc) continue;
          if (best == null || time >= bestTime) {
            best = desc;
            bestTime = time;
          }
        }
        return best || "";
      }
      function parseLogisticsBody(json) {
        if (!json || json.isSuccess !== "true") {
          const flag = json && json.isSuccess != null ? json.isSuccess : "";
          return { ok: false, reason: `isSuccess=${flag}` };
        }
        const packageList = Array.isArray(json.packages) ? json.packages : Array.isArray(json.pkgList) ? json.pkgList : null;
        let companies = textList(json.expressName);
        let numbers = textList(json.expressId);
        if (packageList && packageList.length > 0) {
          companies = packageList.map((item) => item.expressName || item.company || "");
          numbers = packageList.map((item) => item.expressId || item.mailNo || "");
        }
        const packageCount = packageList && packageList.length > 0 ? packageList.length : Math.max(companies.length, numbers.length);
        const latest = latestTrace(firstTraceArray(json));
        return {
          ok: true,
          company: companies.join("\uFF1B"),
          trackingNo: numbers.join("\uFF1B"),
          latest,
          packageCount,
          hasTrace: latest !== ""
        };
      }
      module.exports = { parseLogisticsBody };
    }
  });

  // src/classify-response.js
  var require_classify_response = __commonJS({
    "src/classify-response.js"(exports, module) {
      function classifyListResponse(text) {
        const body = text == null ? "" : String(text);
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
        if (json && Array.isArray(json.mainOrders)) {
          return { type: "orders", orders: json.mainOrders };
        }
        if (body.includes("login.taobao.com") || body.includes("passport.taobao.com")) {
          return { type: "login" };
        }
        if (body.includes("\u9A8C\u8BC1\u7801") || body.includes("_____tmd_____") || body.includes("x5secdata") || body.includes("punish") || body.includes("rgv587_flag") || body.includes("FAIL_SYS_USER_VALIDATE") || json && (json.url || json.rgv587_flag)) {
          return { type: "captcha" };
        }
        if (!json) return { type: "retryable", reason: "\u54CD\u5E94\u4E0D\u662F JSON" };
        const keys = json && typeof json === "object" && !Array.isArray(json) ? Object.keys(json).join(",") : "\u975E\u5BF9\u8C61";
        return { type: "unrecognized", keys };
      }
      module.exports = { classifyListResponse };
    }
  });

  // src/run-export.js
  var require_run_export = __commonJS({
    "src/run-export.js"(exports, module) {
      var { messages: messages2 } = require_messages();
      var { createLogger: createLogger2 } = require_logger();
      var { classifyTime } = require_dates();
      var { needsLogistics, buildRows } = require_parse_orders();
      var { parseLogisticsBody } = require_parse_logistics();
      var { classifyListResponse } = require_classify_response();
      var PAGE_SIZE = 15;
      var LOGISTICS_GAP_MS = 400;
      function push(logger, onLog, level, message) {
        logger[level](message);
        onLog(logger.lines[logger.lines.length - 1]);
      }
      function resultOf(status, rows, logger, orderCount, keptOrders, logisticsById) {
        return {
          status,
          rows,
          orderCount,
          keptOrders,
          logisticsById,
          logText: logger.text()
        };
      }
      function isLogisticsRisk(text) {
        const body = text == null ? "" : String(text);
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
        if (json && parseLogisticsBody(json).ok) return false;
        return body.includes("\u9A8C\u8BC1\u7801") || body.includes("_____tmd_____") || body.includes("x5secdata") || body.includes("punish") || body.includes("rgv587_flag") || body.includes("FAIL_SYS_USER_VALIDATE") || !!(json && (json.url || json.rgv587_flag));
      }
      async function readPage(fetchPage2, pageNum) {
        try {
          const response = await fetchPage2(pageNum);
          if (!response || response.ok === false) {
            const status = response && response.status ? response.status : 0;
            return { type: "retryable", reason: `HTTP ${status}` };
          }
          return classifyListResponse(response.text);
        } catch {
          return { type: "retryable", reason: "\u7F51\u7EDC\u9519\u8BEF" };
        }
      }
      function rememberStop(kind, kept, logger, onLog) {
        if (kind === "popup-closed") {
          push(logger, onLog, "warn", messages2.popupClosed());
        } else {
          push(logger, onLog, "warn", messages2.cancelled(kept.length));
        }
        return resultOf("cancelled", [], logger, kept.length, kept, {});
      }
      function stopWith(kind, message, kept, logger, onLog) {
        push(logger, onLog, "error", message);
        if (kept.length > 0) return resultOf("partial-ready", [], logger, kept.length, kept, {});
        return resultOf("stopped", [], logger, 0, [], {});
      }
      async function queryLogistics(kept, input, logger, onLog, onProgress) {
        const logisticsById = {};
        const targets = kept.filter((order) => needsLogistics(order.statusInfo && order.statusInfo.text));
        let index = 0;
        let failCount = 0;
        let waited = false;
        for (const order of kept) {
          const stop = input.shouldStop();
          if (stop) return { stopped: stop, logisticsById, failCount };
          const orderId = order.id == null ? "" : String(order.id);
          const status = order.statusInfo ? order.statusInfo.text : "";
          if (!needsLogistics(status)) {
            push(logger, onLog, "info", messages2.skipLogistics(orderId, status));
            continue;
          }
          index += 1;
          onProgress(messages2.progressLogistics(index, targets.length));
          push(logger, onLog, "info", messages2.queryingLogistics(index, targets.length, orderId));
          if (waited) await input.sleep(LOGISTICS_GAP_MS);
          waited = true;
          const stopAfterWait = input.shouldStop();
          if (stopAfterWait) return { stopped: stopAfterWait, logisticsById, failCount };
          let response;
          try {
            response = await input.fetchLogistics(orderId);
          } catch {
            failCount += 1;
            push(logger, onLog, "warn", messages2.logisticsFail(orderId, "\u7F51\u7EDC\u9519\u8BEF"));
            continue;
          }
          if (response && isLogisticsRisk(response.text)) {
            return { stopped: null, risk: true, logisticsById, failCount };
          }
          if (!response || response.ok === false) {
            failCount += 1;
            const statusCode = response && response.status ? response.status : 0;
            push(logger, onLog, "warn", messages2.logisticsFail(orderId, `HTTP ${statusCode}`));
            continue;
          }
          let json;
          try {
            json = JSON.parse(response.text);
          } catch {
            failCount += 1;
            push(logger, onLog, "warn", messages2.logisticsFail(orderId, "\u54CD\u5E94\u4E0D\u662F JSON"));
            continue;
          }
          const parsed = parseLogisticsBody(json);
          if (!parsed.ok) {
            failCount += 1;
            push(logger, onLog, "warn", messages2.logisticsFail(orderId, parsed.reason));
            continue;
          }
          if (parsed.packageCount > 1) {
            push(logger, onLog, "info", messages2.multiPackage(orderId, parsed.packageCount));
          }
          logisticsById[orderId] = {
            company: parsed.company,
            trackingNo: parsed.trackingNo,
            latest: parsed.latest
          };
          if (!parsed.company && !parsed.trackingNo) {
            push(logger, onLog, "info", messages2.noLogisticsInfo(orderId));
          } else if (!parsed.hasTrace) {
            push(logger, onLog, "info", messages2.logisticsNoTrace(orderId, parsed.company, parsed.trackingNo));
          } else {
            push(logger, onLog, "info", messages2.logisticsWithTrace(orderId, parsed.company, parsed.trackingNo, parsed.latest));
          }
        }
        return { stopped: null, risk: false, logisticsById, failCount };
      }
      async function runExport2(input) {
        const onLog = input.onLog || (() => {
        });
        const onProgress = input.onProgress || (() => {
        });
        const logger = createLogger2(input.now || (() => /* @__PURE__ */ new Date()));
        if (input.startDate > input.endDate) {
          push(logger, onLog, "error", messages2.badDate(input.startDate, input.endDate));
          return resultOf("stopped", [], logger, 0, [], {});
        }
        push(logger, onLog, "info", messages2.start(input.startDate, input.endDate, input.format));
        const kept = [];
        let pageNum = 1;
        let stopPaging = false;
        while (!stopPaging) {
          const stop = input.shouldStop();
          if (stop) return rememberStop(stop, kept, logger, onLog);
          onProgress(messages2.progressPage(pageNum, kept.length));
          push(logger, onLog, "info", messages2.readingPage(pageNum));
          let classified = await readPage(input.fetchPage, pageNum);
          if (classified.type === "retryable") {
            push(logger, onLog, "warn", messages2.pageRetry(pageNum, classified.reason));
            const stopBeforeRetry = input.shouldStop();
            if (stopBeforeRetry) return rememberStop(stopBeforeRetry, kept, logger, onLog);
            classified = await readPage(input.fetchPage, pageNum);
            if (classified.type === "retryable") {
              return stopWith("page", messages2.pageFail(pageNum, classified.reason, kept.length), kept, logger, onLog);
            }
          }
          if (classified.type === "login") {
            return stopWith("login", messages2.notLogin(), kept, logger, onLog);
          }
          if (classified.type === "captcha") {
            return stopWith("captcha", messages2.captcha(kept.length), kept, logger, onLog);
          }
          if (classified.type === "unrecognized") {
            return stopWith("unknown", messages2.unrecognized(classified.keys), kept, logger, onLog);
          }
          const orders = classified.orders;
          let inRange = 0;
          for (const order of orders) {
            const createTime = order.orderInfo && order.orderInfo.createTime;
            const when = classifyTime(createTime, input.startDate, input.endDate);
            const orderId = order.id == null ? "" : String(order.id);
            if (when === "after") {
              push(logger, onLog, "info", messages2.skipNew(orderId, createTime));
              continue;
            }
            if (when === "before") {
              push(logger, onLog, "info", messages2.stopOld(orderId, createTime));
              stopPaging = true;
              break;
            }
            inRange += 1;
            kept.push(order);
          }
          push(logger, onLog, "info", messages2.pageOk(pageNum, orders.length, inRange));
          if (stopPaging) break;
          if (orders.length < PAGE_SIZE) {
            push(logger, onLog, "info", messages2.noMore(pageNum));
            break;
          }
          pageNum += 1;
        }
        if (kept.length === 0) {
          push(logger, onLog, "error", messages2.noOrders());
          return resultOf("empty", [], logger, 0, [], {});
        }
        const queried = await queryLogistics(kept, input, logger, onLog, onProgress);
        if (queried.risk) {
          push(logger, onLog, "error", messages2.captcha(kept.length));
          if (kept.length > 0) {
            return resultOf("partial-ready", [], logger, kept.length, kept, queried.logisticsById);
          }
          return resultOf("stopped", [], logger, 0, [], {});
        }
        if (queried.stopped) return rememberStop(queried.stopped, kept, logger, onLog);
        const stopBeforeComplete = input.shouldStop();
        if (stopBeforeComplete) return rememberStop(stopBeforeComplete, kept, logger, onLog);
        const built = buildRows(kept, queried.logisticsById);
        for (const entry of built.logs) push(logger, onLog, entry.level, entry.message);
        if (queried.failCount > 0) {
          push(logger, onLog, "warn", messages2.missingLogisticsCount(queried.failCount));
        }
        push(logger, onLog, "info", messages2.rowSummary(kept.length, built.rows.length));
        return resultOf("complete", built.rows, logger, kept.length, kept, queried.logisticsById);
      }
      function appendDownloadLogs2(logger, onLog, entries) {
        for (const entry of entries) push(logger, onLog, entry.level, entry.message);
        return logger.text();
      }
      module.exports = { runExport: runExport2, appendDownloadLogs: appendDownloadLogs2, LOGISTICS_GAP_MS, PAGE_SIZE };
    }
  });

  // src/decode.js
  var require_decode = __commonJS({
    "src/decode.js"(exports, module) {
      function decodeBytes2(bytes, encoding) {
        return new TextDecoder(encoding).decode(bytes);
      }
      module.exports = { decodeBytes: decodeBytes2 };
    }
  });

  // src/log-file.js
  var require_log_file = __commonJS({
    "src/log-file.js"(exports, module) {
      function withBom(bytes) {
        const out = new Uint8Array(3 + bytes.length);
        out[0] = 239;
        out[1] = 187;
        out[2] = 191;
        out.set(bytes, 3);
        return out;
      }
      function encodeLogText2(text) {
        return withBom(new TextEncoder().encode(text));
      }
      module.exports = { withBom, encodeLogText: encodeLogText2 };
    }
  });

  // src/filenames.js
  var require_filenames = __commonJS({
    "src/filenames.js"(exports, module) {
      function pad(value) {
        return String(value).padStart(2, "0");
      }
      function tableFilename(startDate, endDate, format, partial) {
        const suffix = partial ? "_\u90E8\u5206" : "";
        return `\u6DD8\u5B9D\u8BA2\u5355_${startDate}_${endDate}${suffix}.${format}`;
      }
      function logFilename2(date) {
        const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
        return `\u6DD8\u5B9D\u8BA2\u5355_\u5BFC\u51FA\u65E5\u5FD7_${stamp}.txt`;
      }
      module.exports = { tableFilename, logFilename: logFilename2 };
    }
  });

  // src/content-entry.js
  var { runExport, appendDownloadLogs } = require_run_export();
  var { createLogger } = require_logger();
  var { messages } = require_messages();
  var { decodeBytes } = require_decode();
  var { encodeLogText } = require_log_file();
  var { logFilename } = require_filenames();
  var LIST_PATH = "/trade/itemlist/asyncBought.htm?action=itemlist/BoughtQueryAction&event_submit_do_query=1&_input_charset=utf8";
  var running = false;
  function tradeOrigin() {
    const host = location.hostname;
    if (host === "buyertrade.taobao.com" || host === "trade.taobao.com") return location.origin;
    return "https://buyertrade.taobao.com";
  }
  function listUrl() {
    return `${tradeOrigin()}${LIST_PATH}`;
  }
  function logisticsUrl(orderId) {
    return `${tradeOrigin()}/trade/json/transit_step.do?bizOrderId=${encodeURIComponent(orderId)}`;
  }
  function triggerDownload(filename, bytes, mime) {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function fetchPage(pageNum) {
    const body = new URLSearchParams({
      pageNum: String(pageNum),
      pageSize: "15",
      prePageNo: String(pageNum - 1)
    });
    const response = await fetch(listUrl(), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: response.ok, status: response.status, text: decodeBytes(bytes, "utf-8") };
  }
  async function fetchLogistics(orderId) {
    const response = await fetch(logisticsUrl(orderId), { credentials: "include" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: response.ok, status: response.status, text: decodeBytes(bytes, "gbk") };
  }
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "tb-order-export") return;
    let stopKind = null;
    let disconnected = false;
    port.onDisconnect.addListener(() => {
      disconnected = true;
      if (running) stopKind = "popup-closed";
    });
    port.onMessage.addListener(async (message) => {
      if (message.type === "cancel") {
        stopKind = "cancel";
        return;
      }
      if (message.type !== "start" || running) return;
      running = true;
      stopKind = null;
      function postToPopup(payload) {
        if (disconnected) return;
        try {
          port.postMessage(payload);
        } catch {
          disconnected = true;
          stopKind = "popup-closed";
        }
      }
      try {
        const result = await runExport({
          startDate: message.startDate,
          endDate: message.endDate,
          format: message.format,
          fetchPage,
          fetchLogistics,
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          shouldStop: () => stopKind,
          now: () => /* @__PURE__ */ new Date(),
          onProgress(text) {
            postToPopup({ type: "progress", text });
          },
          onLog(line) {
            postToPopup({ type: "log", line });
          }
        });
        if (disconnected) {
          const filename = logFilename(/* @__PURE__ */ new Date());
          const extra = [];
          if (!result.logText.includes(messages.popupClosed())) {
            extra.push({ level: "warn", message: messages.popupClosed() });
          }
          extra.push({ level: "info", message: messages.downloadedLog(filename) });
          const closedLogger = createLogger(() => /* @__PURE__ */ new Date());
          appendDownloadLogs(closedLogger, () => {
          }, extra);
          triggerDownload(filename, encodeLogText(`${result.logText}${closedLogger.text()}`), "text/plain;charset=utf-8");
          return;
        }
        port.postMessage({ type: "result", result });
      } finally {
        running = false;
      }
    });
  });
})();
