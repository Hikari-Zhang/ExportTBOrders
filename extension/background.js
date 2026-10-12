chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'fetch-legacy-logistics') return;
  const origin = new URL(message.url).origin;
  fetch(message.url, {
    credentials: 'include',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Referer: `${origin}/`,
    },
  })
    .then(async (response) => {
      const finalUrl = response.url || '';
      const punish = finalUrl.includes('_____tmd_____') || finalUrl.includes('x5secdata');
      const bytes = new Uint8Array(await response.arrayBuffer());
      sendResponse({
        ok: response.ok && !punish,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        finalUrl,
        punish,
        bytes: Array.from(bytes),
      });
    })
    .catch((error) => {
      sendResponse({ ok: false, status: 0, error: String(error), bytes: [] });
    });
  return true;
});
