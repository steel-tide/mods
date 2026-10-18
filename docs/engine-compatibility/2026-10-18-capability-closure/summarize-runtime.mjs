#!/usr/bin/env node
/** Summarize fresh-browser observations; never turn a percentage allowance into a pass. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const input=resolve(process.argv[2]??resolve(here,'runtime.json'));
const output=resolve(process.argv[3]??input.replace(/\.json$/,'-summary.json'));
const report=JSON.parse(readFileSync(input,'utf8'));
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2};
const stats=xs=>({n:xs.length,min:Math.min(...xs),median:median(xs),max:Math.max(...xs)});
const summary={input,options:report.options,behaviorMismatches:report.behaviorMismatches,measurements:[],note:'Per-browser summaries, same-build A/A controls, and separate balanced rounds. No percentage threshold or universal zero-cost inference.'};
for(const workload of report.options.workloads){
 const rows=report.rows.filter(r=>r.workload===workload);
 for(const metric of ['sim','replication'])for(const percentile of ['mean','p50','p95','p99']){
  const get=r=>r[metric][percentile];
  const ab=Object.fromEntries(['base','candidate'].map(v=>[v,stats(rows.filter(r=>r.group==='comparison'&&r.variant===v).map(get))]));
  const aa=Object.fromEntries(['A','B'].map(v=>[v,stats(rows.filter(r=>r.group==='AA'&&r.label===v).map(get))]));
  const rounds=[...new Set(rows.filter(r=>r.group==='comparison').map(r=>r.round))].map(round=>{
   const set=rows.filter(r=>r.group==='comparison'&&r.round===round);
   const a=median(set.filter(r=>r.variant==='base').map(get)),b=median(set.filter(r=>r.variant==='candidate').map(get));
   return {round,base:a,candidate:b,delta:b-a};
  });
  summary.measurements.push({workload,metric,percentile,comparison:ab,aa,delta:ab.candidate.median-ab.base.median,deltaPercent:100*(ab.candidate.median/ab.base.median-1),rounds});
 }
}
writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log(output);
