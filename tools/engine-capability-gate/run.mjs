#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
const here=dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2),arg=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1]};
const engine=resolve(arg('--engine',resolve(here,'../../../steel-tide'))),buildRoot=resolve(arg('--build',resolve(here,'../../dist/engine-capability-gate')));
const out=resolve(arg('--out',resolve(here,'../../docs/engine-compatibility/2026-10-16-m0-m4/vite-diagnostic-runs.json')));
const options={warmup:Number(arg('--warmup','900')),measured:Number(arg('--measured','900')),freezeTicks:Number(arg('--freeze-ticks','300')),rounds:Number(arg('--rounds','2')),workloads:arg('--workloads','battle').split(','),aa:!args.includes('--skip-aa')};
const {launchChrome,Page}=await import(pathToFileURL(resolve(engine,'game/core/scripts/lib/chrome.mjs')).href);
const server=createServer((req,res)=>{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path.includes('..')||!/^\/(base|candidate)\/[a-zA-Z0-9_./-]+$/.test(path)){res.writeHead(404);res.end();return}try{res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':'text/html');res.end(readFileSync(resolve(buildRoot,path.slice(1))))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const rows=[],build=JSON.parse(readFileSync(resolve(buildRoot,'build.json'),'utf8'));
const report={createdAt:new Date().toISOString(),scope:'Fresh-browser Vite/Rollup headless vanilla simulation and replication diagnostic, frozen scenario restored after warming both paths; not full-app rendering or a completed performance gate',options,build,rows};
mkdirSync(dirname(out),{recursive:true});
try{
 for(const workload of options.workloads){
  const schedule=[];
  if(options.aa)for(const label of ['A','B','B','A'])schedule.push({group:'AA',label,variant:'base'});
  for(let round=0;round<options.rounds;round++)for(const variant of (round%2?['candidate','base','base','candidate']:['base','candidate','candidate','base']))schedule.push({group:'comparison',label:variant,variant,round});
  for(const item of schedule){
   const profile=mkdtempSync(resolve(tmpdir(),'steel-vite-gate-'));let chrome,page;
   try{
    chrome=await launchChrome(9367,profile);page=await Page.open(9367);
    await page.goto(`http://127.0.0.1:${port}/${item.variant}/index.html`);await page.waitFor('typeof runBenchmark === "function"');
    const value=await page.eval(`runBenchmark(${JSON.stringify(workload)},${options.warmup},${options.measured},${options.freezeTicks})`);
    rows.push({...item,...value});writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(`${workload} ${item.group}/${item.label}: sim ${value.sim.mean.toFixed(4)} ms; replication ${value.replication.mean.toFixed(4)} ms`);
   }finally{await page?.close();if(chrome){const ended=once(chrome,'exit');chrome.kill();await ended}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200})}
  }
 }
 const keys=['frozenDigest','measuredStartDigest','digest','wireDigest','wireBytes','snapshotBytes'];
 report.behaviorMismatches=options.workloads.flatMap(workload=>{const sample=rows.filter(r=>r.workload===workload);return keys.flatMap(key=>new Set(sample.map(r=>r[key])).size===1?[]:[{workload,key,values:sample.map(r=>r[key])}])});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n');if(report.behaviorMismatches.length)process.exitCode=1;
 console.log(out);
}finally{server.close()}
