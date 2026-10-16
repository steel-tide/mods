#!/usr/bin/env node
/** Paired real-app cold startup and retained JS heap witnesses, never a universal zero-cost claim. */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const args=process.argv.slice(2), arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const engine=resolve(arg('--engine',process.env.STEEL_CANDIDATE??resolve(dirname(fileURLToPath(import.meta.url)),'../../../steel-tide')));
const builds=resolve(arg('--build',resolve(engine,'.steel-tide-data/capability-isolation')));
const out=resolve(arg('--out',resolve(dirname(fileURLToPath(import.meta.url)),'../../docs/engine-compatibility/2026-10-16-isolation')));
const playwrightPath=arg('--playwright',process.env.PLAYWRIGHT_MODULE);
if(!playwrightPath)throw Error('Pass --playwright /absolute/path/to/playwright/index.mjs; dependencies are not installed by this script.');
const {chromium,webkit}=await import(pathToFileURL(playwrightPath).href);
const kinds=arg('--engines','chromium,webkit').split(','), rounds=Number(arg('--rounds','1'));
const sampleLimit=Number(arg('--samples','0'));
if(!kinds.every(x=>['chromium','webkit'].includes(x))||!Number.isInteger(rounds)||rounds<1)throw Error('Invalid engines/rounds');
const optionalPattern=/\/src\/(?:game\/(?:extensions\/(?!contracts\.)|contentCapabilityLoader\.)|render\/(?:contentRenderer|contentInput|generatedContentRenderer)\.|ui\/(?:contentHud|contentPresentationLoader)\.)/;
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.ico':'image/x-icon'};
const graphs=Object.fromEntries(['base','candidate'].map(v=>[v,JSON.parse(readFileSync(resolve(builds,`web-${v}-graph.json`),'utf8'))]));
const optional=new Set(graphs.candidate.filter(o=>o.type==='chunk'&&o.modules.some(m=>optionalPattern.test('/'+m))).map(o=>'/'+o.file));
const cache=new Map();
for(const v of ['base','candidate']) {
 const root=resolve(builds,`web-${v}`);
 const visit=dir=>{for(const f of readdirSync(dir)){const p=resolve(dir,f);if(statSync(p).isDirectory())visit(p);else{const data=readFileSync(p);cache.set(p,{data,gzip:/\.(js|css|html|json)$/.test(p)?gzipSync(data):null});}}};visit(root);
}
let serving='base',requestLog=[];
const publicRoot=resolve(engine,'game/core/public');
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;requestLog.push(url);
 const name=url==='/'?'index.html':decodeURIComponent(url).replace(/^\/+/, '');
 for(const root of [resolve(builds,`web-${serving}`),publicRoot]) {
  const path=resolve(root,name);if(!path.startsWith(root+'/')||!existsSync(path)||!statSync(path).isFile())continue;
  const asset=cache.get(path)??{data:readFileSync(path),gzip:null};
  const compressed=asset.gzip&&String(req.headers['accept-encoding']).includes('gzip');
  res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');
  if(compressed)res.setHeader('Content-Encoding','gzip');
  res.setHeader('Cache-Control','public, max-age=3600');res.end(compressed?asset.gzip:asset.data);return;
 }
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(5357,'127.0.0.1',r));
mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const initial={};
for(const v of ['base','candidate']) {
 const graph=graphs[v],seen=new Set();
 const visit=file=>{if(seen.has(file))return;const entry=graph.find(o=>o.file===file);if(!entry||entry.type!=='chunk')return;seen.add(file);for(const dep of entry.imports)visit(dep);};
 for(const entry of graph.filter(o=>o.entry))visit(entry.file);
 const files=[...seen].map(file=>{const data=readFileSync(resolve(builds,`web-${v}`,file));return {file,bytes:data.length,gzip:gzipSync(data).length,sha256:hash(data)};});
 initial[v]={bytes:files.reduce((s,x)=>s+x.bytes,0),gzip:files.reduce((s,x)=>s+x.gzip,0),files};
}
const evidence={date:new Date().toISOString(),engineHead:execFileSync('git',['rev-parse','HEAD'],{cwd:engine,encoding:'utf8'}).trim(),workingTreeIncluded:true,initial,initialDelta:{bytes:initial.candidate.bytes-initial.base.bytes,gzip:initial.candidate.gzip-initial.base.gzip},runs:[],limitations:[
 'Local compressed HTTP, shared production media, fresh browser process/profile for every sample; OS file caches are warm after initial samples.',
 'Real built app with service worker enabled. Boot-ready time excludes human input; post-entry time starts immediately before sending Enter.',
 'Chromium retained JavaScript heap is sampled after explicit DevTools garbage collection at boot and after one second on the first screen. It excludes native decoded images/GPU memory.',
 'Desktop WebKit is a separate engine witness, not an iOS device measurement; this API exposes no comparable retained JavaScript heap counter.',
 'Repeated desktop timings are noisy estimates. Neither a nonsignificant result nor structural identity proves literal zero overhead across hardware.',
 'This fresh no-mod lifecycle does not show that previously loaded ES modules can be unloaded after disabling a mod; browser module caches retain code until page reload.'
]};
const initialization=`window.__gate={errors:[],ready:0,entered:0};addEventListener('error',e=>{if(e.message)__gate.errors.push(e.message)});addEventListener('unhandledrejection',e=>__gate.errors.push(String(e.reason)));const watch=new MutationObserver(()=>{if(!__gate.ready&&document.querySelector('#boot-loading-status.continue'))__gate.ready=performance.now();if(__gate.ready&&!__gate.entered&&!document.getElementById('boot'))__gate.entered=performance.now()});watch.observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});`;
const save=()=>writeFileSync(resolve(out,'production-startup.json'),JSON.stringify(evidence,null,2)+'\n');
try {
 for(const kind of kinds) {
  const sequence=[...Array.from({length:4},(_,i)=>({phase:'aa',label:i===0||i===3?'A':'B',variant:'base'}))];
  for(let r=0;r<rounds;r++)for(const variant of r%2?['candidate','base','base','candidate']:['base','candidate','candidate','base'])sequence.push({phase:'ab',round:r+1,label:variant,variant});
  for(const [index,choice] of sequence.slice(0,sampleLimit||undefined).entries()) {
   serving=choice.variant;requestLog=[];let browser;
   try {
    browser=await (kind==='chromium'?chromium.launch({headless:true,executablePath:arg('--chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),args:['--force-color-profile=srgb','--mute-audio']}):webkit.launch({headless:true}));
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,locale:'en-US',serviceWorkers:'allow'});
    await context.addInitScript(initialization);
    const page=await context.newPage(),cdp=kind==='chromium'?await context.newCDPSession(page):null;
    if(cdp)await cdp.send('Performance.enable');
    await page.goto('http://127.0.0.1:5357/',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>window.__gate.ready>0,undefined,{timeout:120000});
    const boot=await page.evaluate(()=>({ms:__gate.ready,navigation:performance.getEntriesByType('navigation').map(n=>({domContentLoaded:n.domContentLoadedEventEnd,responseEnd:n.responseEnd,load:n.loadEventEnd}))[0]}));
    let bootMetrics,retained;
    if(cdp){await cdp.send('HeapProfiler.collectGarbage');bootMetrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));}
    await page.evaluate(()=>{__gate.enterRequested=performance.now()});await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.__gate.entered>0,undefined,{timeout:120000});
    await page.waitForTimeout(1000);
    if(cdp){await cdp.send('HeapProfiler.collectGarbage');retained=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));}
    const loaded=await page.evaluate(()=>({readyMs:__gate.ready,entryMs:__gate.entered-__gate.enterRequested,errors:__gate.errors,resources:performance.getEntriesByType('resource').filter(r=>/\.js(?:\?|$)/.test(r.name)).map(r=>({url:new URL(r.name).pathname,bytes:r.encodedBodySize,decoded:r.decodedBodySize}))}));
    await page.evaluate(()=> 'serviceWorker' in navigator?Promise.race([navigator.serviceWorker.ready.then(()=>new Promise(r=>setTimeout(r,500))),new Promise(r=>setTimeout(r,1500))]):null);
    const sample={engine:kind,browserVersion:browser.version(),index,...choice,boot,bootMetrics,retained,...loaded,requests:[...new Set(requestLog)],optionalRequests:requestLog.filter(u=>optional.has(u))};
    evidence.runs.push(sample);save();
    console.log(JSON.stringify({engine:kind,index,...choice,readyMs:loaded.readyMs,entryMs:loaded.entryMs,heap:retained?.JSHeapUsedSize,optionalRequests:sample.optionalRequests,errors:loaded.errors}));
    if(loaded.errors.length||sample.optionalRequests.length)throw Error('Boot errors or inactive optional chunks were requested; see evidence');
   } finally {await browser?.close();}
  }
 }
} finally {server.close();save();}
const median=values=>{const a=[...values].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const stats=values=>values.length?{n:values.length,min:Math.min(...values),median:median(values),max:Math.max(...values)}:null;
const summary={initialDelta:evidence.initialDelta,results:[],gate:'measurement only: compare paired runtime results with A/A variation; byte growth is reported separately, with no automatic percentage tolerance or universal zero-cost assertion'};
for(const kind of kinds)for(const phase of ['aa','ab']){
 const runs=evidence.runs.filter(s=>s.engine===kind&&s.phase===phase),labels=phase==='aa'?['A','B']:['base','candidate'];
 const report={engine:kind,phase};for(const metric of ['readyMs','entryMs','heap','scriptSeconds']){
  const get=s=>metric==='heap'?s.retained?.JSHeapUsedSize:metric==='scriptSeconds'?s.bootMetrics?.ScriptDuration:s[metric];
  report[metric]=Object.fromEntries(labels.map(label=>[label,stats(runs.filter(s=>s.label===label).map(get).filter(Number.isFinite))]));
 }summary.results.push(report);
}
writeFileSync(resolve(out,'production-startup-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
