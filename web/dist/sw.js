// sw.js — Monster Arena asset-retry service worker.
// Intercepts GET requests for /assets/ and retries them on transient network
// failures (ERR_CONNECTION_RESET, ERR_HTTP2_PING_FAILED, etc.) so sprites load
// reliably on flaky/filtered networks. Nothing is cached here — we only add
// retry + backoff at the network layer and pass responses straight through.
const ASSET_PREFIX = self.location.origin + '/assets/';
const MAX_ATTEMPTS = 4;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

function isRetryable(res) {
  if (!res) return true; // network error (thrown)
  const s = res.status;
  return s === 0 || s === 408 || s === 425 || s === 429 || s === 500 || s === 502 || s === 503 || s === 504;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(ASSET_PREFIX)) return;

  event.respondWith((async () => {
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(req, { cache: 'no-store', credentials: 'same-origin' });
        if (res.ok || res.status === 304 || !isRetryable(res)) return res;
        lastErr = res;
      } catch (err) {
        lastErr = err;
      }
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }
    // Final fallback: one last try, or a 504 so the caller knows it failed.
    try { return await fetch(req, { cache: 'no-store', credentials: 'same-origin' }); }
    catch (e) { return new Response('', { status: 504, statusText: 'Gateway Timeout' }); }
  })());
});
