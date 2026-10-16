import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const toolHome=fileURLToPath(new URL('./',import.meta.url));
const candidate=process.env.STEEL_CANDIDATE??resolve(toolHome,'../../../steel-tide');
const { launchChrome, Page }=await import(pathToFileURL(resolve(candidate,'game/core/scripts/lib/chrome.mjs')).href);
const home=process.env.STEEL_GATE_OUT??resolve(candidate,'.steel-tide-data/engine-capability-gate');
const server = createServer((req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  const file = req.url.split('?')[0].replace(/^\//,'');
  if (!/^[a-zA-Z0-9_.-]+\.(js|html)$/.test(file)) {res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type', file.endsWith('js')?'text/javascript':'text/html');
  res.end(readFileSync(`${home}/browser/${file}`));
});
await new Promise(resolve => server.listen(5347,'127.0.0.1',resolve));
const profile = mkdtempSync(`${tmpdir()}/steel-capability-m0-`);
let chrome, page;
const rows=[];
try {
  chrome = await launchChrome(9347,profile);
  for(const workload of ['idle','duels','projectiles','battle']) for(const variant of ['candidate','base','base','candidate','candidate','base','base','candidate']) {
    page = await Page.open(9347);
    await page.goto(`http://127.0.0.1:5347/${variant}.html`);
    await page.waitFor('typeof runBenchmark === "function"');
    const row=await page.eval(`runBenchmark(${JSON.stringify(workload)})`);
    rows.push({...row,variant});
    writeFileSync(`${home}/browser-runs.json`,JSON.stringify(rows,null,2)+'\n');
    console.log(`${workload} ${variant} sim=${row.sim.mean.toFixed(3)}ms replication=${row.replication.mean.toFixed(3)}ms`);
    await page.close();page=null;
  }
} finally { await page?.close();if(chrome){const ended=once(chrome,'exit');chrome.kill();await ended;}server.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}); }
