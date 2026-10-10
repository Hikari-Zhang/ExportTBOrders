const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyListResponse } = require('../src/classify-response');

test('含 mainOrders 时是订单页', () => {
  const result = classifyListResponse(JSON.stringify({ mainOrders: [{ id: '1' }] }));
  assert.equal(result.type, 'orders');
  assert.equal(result.orders.length, 1);
});

test('空列表仍是订单页', () => {
  const result = classifyListResponse(JSON.stringify({ mainOrders: [] }));
  assert.deepEqual(result, { type: 'orders', orders: [] });
});

test('登录地址判定为未登录', () => {
  assert.equal(classifyListResponse('<a href="https://login.taobao.com/member/login.jhtml">login</a>').type, 'login');
  assert.equal(classifyListResponse('https://passport.taobao.com/ac/login.htm').type, 'login');
});

test('验证码和风控立刻识别', () => {
  assert.equal(classifyListResponse('请输入验证码').type, 'captcha');
  assert.equal(classifyListResponse('_____tmd_____').type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ url: 'https://buyertrade.taobao.com/trade/security.htm' })).type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ rgv587_flag: 'sm' })).type, 'captcha');
  assert.equal(classifyListResponse(JSON.stringify({ ret: ['FAIL_SYS_USER_VALIDATE'] })).type, 'captcha');
});

test('没有 mainOrders 的 JSON 无法识别', () => {
  const result = classifyListResponse(JSON.stringify({ foo: 1, bar: 2 }));
  assert.deepEqual(result, { type: 'unrecognized', keys: 'foo,bar' });
});

test('不是 JSON 且看不出登录或验证码时可以重试', () => {
  assert.deepEqual(classifyListResponse('<html>bad gateway</html>'), { type: 'retryable', reason: '响应不是 JSON' });
});

test('商品标题里的验证码不当成风控', () => {
  const result = classifyListResponse(JSON.stringify({
    mainOrders: [{ id: '1', subOrders: [{ itemInfo: { title: '验证码识别教程' } }] }],
  }));
  assert.equal(result.type, 'orders');
  assert.equal(result.orders.length, 1);
});
