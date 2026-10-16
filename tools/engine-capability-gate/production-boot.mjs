import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const engine = process.env.STEEL_CANDIDATE ?? resolve(fileURLToPath(new URL('./', import.meta.url)), '../../../steel-tide');
const out = process.env.STEEL_GATE_OUT ?? resolve(engine, '.steel-tide-data/engine-capability-gate');
const { launchChrome, Page } = await import(pathToFileURL(resolve(engine, 'game/core/scripts/lib/chrome.mjs')).href);
const graph = JSON.parse(readFileSync(resolve(out, 'web-candidate-graph.json'), 'utf8'));
const optional = graph.filter(o => o.type === 'chunk' && o.modules.some(id => /\/src\/(?:game\/extensions\/(?!contracts\.)|render\/(?:contentRenderer|contentInput|generatedContentRenderer)\.|ui\/contentHud\.)/.test('/' + id))).map(o => '/' + o.file);
const requests = [], missing = [];
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ico': 'image/x-icon' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  requests.push(url);
  const name = url === '/' ? 'index.html' : decodeURIComponent(url).replace(/^\//, '');
  for (const root of [resolve(out, 'web-candidate'), resolve(engine, 'game/core/public')]) {
    const path = resolve(root, name);
    if (!path.startsWith(root + '/') || !existsSync(path) || !statSync(path).isFile()) continue;
    res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
    res.end(readFileSync(path)); return;
  }
  missing.push(url); res.writeHead(404); res.end();
});
await new Promise(resolve => server.listen(5349, '127.0.0.1', resolve));
const profile = mkdtempSync(resolve(tmpdir(), 'steel-content-boot-'));
let chrome, page;
try {
  chrome = await launchChrome(9349, profile); page = await Page.open(9349);
  await page.onNewDocument(`window.bootErrors=[]; addEventListener('error', e=>{if(e.message)bootErrors.push(e.message)}); addEventListener('unhandledrejection', e=>bootErrors.push(String(e.reason)));`);
  await page.goto('http://127.0.0.1:5349/');
  await page.waitFor('document.querySelector("#boot-loading-status.continue")');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.waitFor('!document.getElementById("boot")');
  const result = await page.eval(`({errors:bootErrors, resources:performance.getEntriesByType('resource').map(r=>({url:r.name,transferSize:r.transferSize,duration:r.duration})), serviceWorkers:'serviceWorker' in navigator})`);
  // Allow service-worker installation/precache to complete before checking requests.
  await page.eval(`'serviceWorker' in navigator ? Promise.race([navigator.serviceWorker.ready.then(()=>new Promise(r=>setTimeout(r,1500))),new Promise(r=>setTimeout(r,4000))]) : null`);
  result.requests = requests; result.missing = missing;
  result.optionalChunks = optional; result.optionalRequests = requests.filter(url => optional.includes(url));
  result.note = 'Fresh production boot and its service-worker precache only; this is a lazy-loading witness, not a comparative startup timing or retained-memory measurement.';
  writeFileSync(resolve(out, 'production-boot.json'), JSON.stringify(result, null, 2) + '\n');
  if (result.errors.length || result.optionalRequests.length) throw new Error(JSON.stringify({ errors: result.errors, optionalRequests: result.optionalRequests }));
  console.log(JSON.stringify({ booted: true, optionalChunks: optional.length, optionalRequests: result.optionalRequests, errors: result.errors, missing }));
} finally {
  await page?.close();
  if (chrome) { const ended = once(chrome, 'exit'); chrome.kill(); await ended; }
  server.close(); rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
