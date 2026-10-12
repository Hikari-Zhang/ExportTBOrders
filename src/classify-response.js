function hasSliderPrompt(body) {
  const text = body == null ? '' : String(body);
  const lower = text.toLowerCase();
  return text.includes('请拖动滑块')
    || text.includes('滑动验证')
    || text.includes('请完成验证')
    || text.includes('安全验证')
    || lower.includes('please drag the slider')
    || lower.includes('please slide to verify');
}

function classifyListResponse(text) {
  const body = text == null ? '' : String(text);
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  if (json && Array.isArray(json.mainOrders)) {
    return { type: 'orders', orders: json.mainOrders };
  }
  if (body.includes('login.taobao.com') || body.includes('passport.taobao.com')) {
    return { type: 'login' };
  }
  if (
    hasSliderPrompt(body)
    || body.includes('验证码')
    || body.includes('_____tmd_____')
    || body.includes('x5secdata')
    || body.includes('punish')
    || body.includes('rgv587_flag')
    || body.includes('FAIL_SYS_USER_VALIDATE')
    || (json && (json.url || json.rgv587_flag))
  ) {
    return { type: 'captcha' };
  }
  if (!json) return { type: 'retryable', reason: '响应不是 JSON' };
  const keys = json && typeof json === 'object' && !Array.isArray(json)
    ? Object.keys(json).join(',')
    : '非对象';
  return { type: 'unrecognized', keys };
}

module.exports = { classifyListResponse, hasSliderPrompt };
