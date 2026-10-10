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
      const bytes = new Uint8Array(await response.arrayBuffer());
      sendResponse({
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        bytes: Array.from(bytes),
      });
    })
    .catch((error) => {
      sendResponse({ ok: false, status: 0, error: String(error), bytes: [] });
    });
  return true;
});
