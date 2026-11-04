// Minimal Chrome DevTools Protocol driver using Node's built-in WebSocket.
// Usage: node cdp.js <file.js> [routePrefix]
// Connects to the phone tab showing localhost:5173, evaluates the file's
// contents as an async expression, and prints the returned value.
const fs = require('fs');
const http = require('http');

const [, , jsFile, prefix] = process.argv;
if (!jsFile) { console.log('usage: node cdp.js <file.js> [jsPrefix]'); process.exit(1); }
const body = (prefix || '') + fs.readFileSync(jsFile, 'utf8');

const get = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej);
});

(async () => {
  const list = JSON.parse(await get('http://127.0.0.1:9333/json/list'));
  const pages = list.filter((t) => t.type === 'page');
  const tab = pages.find((t) => t.url.includes('5173')) || pages.find((t) => t.url.includes('about:blank'));
  if (!tab) { console.log('NO TAB: ' + pages.map((p) => p.url.slice(0, 60)).join(' | ')); process.exit(2); }
  console.log('tab: ' + tab.url.slice(0, 70));

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const timeoutMs = Number(process.env.CDP_TIMEOUT_MS || 120000);
  const timer = setTimeout(() => { console.log('TIMEOUT (no reply in ' + Math.round(timeoutMs / 1000) + 's)'); process.exit(3); }, timeoutMs);

  ws.addEventListener('open', () => {
    if (process.env.CDP_BRING === '1') {
      ws.send(JSON.stringify({ id: 0, method: 'Page.bringToFront' }));
    }
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: body, awaitPromise: true, returnByValue: true, userGesture: true },
    }));
  });
  ws.addEventListener('error', (e) => { clearTimeout(timer); console.log('WS ERROR: ' + (e.message || e)); process.exit(4); });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== 1) return;
    clearTimeout(timer);
    const r = msg.result || {};
    if (r.exceptionDetails) {
      console.log('JS EXCEPTION: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    } else {
      console.log(r.result?.value ?? JSON.stringify(r.result));
    }
    process.exit(0);
  });
})();
