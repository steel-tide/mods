#!/usr/bin/env bun
/** Optional-module load study, not the vanilla regression gate. Run with Bun. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)), args=process.argv.slice(2);
const option=(name:string,fallback:string)=>{const at=args.indexOf(name);return at<0?fallback:args[at+1]};
const engine=resolve(option('--engine',resolve(here,'../../steel-tide')));
const out=resolve(option('--out',resolve(here,'../docs/engine-compatibility/2026-10-16-m0-m4/feature-enabled-benchmark.json')));
const fixtureRoot=resolve(here,'../docs/engine-compatibility/fixtures');
const spec=JSON.parse(readFileSync(resolve(fixtureRoot,'engine-capability-benchmark.json'),'utf8'));
const load=(file:string)=>import(pathToFileURL(resolve(engine,'game/core',file)).href);
const [{prepareContentSchema},{parseDefinitionPack},{prepareContentCapabilities},{applyContent},{createContentGame,contentRuntime,disposeContentGame},{newEnt},{arena},{getDef}]=await Promise.all([
 load('src/game/contentSchema.ts'),load('src/game/contentDefs.ts'),load('src/game/contentCapabilities.ts'),load('src/game/content.ts'),load('src/game/contentGame.ts'),load('src/game/state.ts'),load('server/testkit/game.ts'),load('src/game/defs.ts')]);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const git=(...a:string[])=>execFileSync('git',a,{cwd:engine,encoding:'utf8'}).trim();
const quantile=(v:number[],q:number)=>v[Math.min(v.length-1,Math.floor(v.length*q))];
const results=[];
for(const study of spec.studies) for(const count of spec.counts) {
 const source=readFileSync(resolve(fixtureRoot,study.file),'utf8'), raw=JSON.parse(source);
 raw.requiredCapabilities=study.capabilities;
 raw.defs=raw.defs.filter((d:any)=>study.definitions.includes(d.id));
 // These explicit benchmark-only durability changes sustain activity through the timed window.
 for(const d of raw.defs) {
  d.hp=spec.durability;
  const c=d.extensions?.['components-v1'];
  if(c) for(const p of c.parts??[]) p.hp=spec.durability;
 }
 raw.defs.push({id:'capability-benchmark-target',extends:'ltank',name:['Target','靶标','표적'],hp:spec.durability,weapons:[]});
 await prepareContentSchema(raw);const parsed=parseDefinitionPack(raw);
 if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
 await prepareContentCapabilities([parsed.pack]);const applied=applyContent([parsed.pack]);
 if(applied.rejected.length)throw Error(JSON.stringify(applied.rejected));
 const base=arena({mode:'campaign',seed:spec.seed,w:96,h:96,fog:false,dayNight:false,record:false,popCap:5000});
 const game=createContentGame(base.st.cfg,base.st.map,true), hosts:any[]=[],targets:any[]=[],providers:any[]=[];
 for(let i=0;i<count;i++){
  const x=320+(i%16)*140,y=320+Math.floor(i/16)*160;
  const host=newEnt(game.st,study.host,0,x,y,0);host.holdPos=true;hosts.push(host);
  for(const side of study.targetSides){
   const target=newEnt(game.st,study.target,1,x+side*90,y,Math.PI);target.holdPos=true;target.holdFire=true;targets.push(target);
   if(side===1)host.targetId=target.id;
  }
  if(study.provider&&i%8===0){const p=newEnt(game.st,study.provider,0,x,y+60);p.holdFire=true;providers.push(p);}
 }
 game.hash.rebuild(game.st);game.updateFog();
 const runtime=contentRuntime(game);
 if(!runtime)throw Error('Expected an enabled content runtime');
 const healthStart=[...game.st.ents.values()].reduce((a:number,e:any)=>a+e.hp,0);
 let peakProjectiles=0;
 for(let tick=0;tick<spec.warmupTicks;tick++)game.step();
 const warm=runtime.snapshot(), heapBefore=process.memoryUsage().heapUsed, timing:number[]=[];
 const start=performance.now();
 for(let tick=0;tick<spec.measuredTicks;tick++){
  const t=performance.now();game.step();timing.push(performance.now()-t);
  peakProjectiles=Math.max(peakProjectiles,game.st.projs.length);
 }
 const elapsed=performance.now()-start, heapAfter=process.memoryUsage().heapUsed, final=runtime.snapshot();
 timing.sort((a,b)=>a-b);
 const alive=[...game.st.ents.values()].filter((e:any)=>!e.dead);
 const metrics={study:study.id,hosts:hosts.length,targets:targets.length,providers:providers.length,entitiesAlive:alive.length,
  modules:runtime.modules.map((m:any)=>m.id),participants:Object.fromEntries(runtime.modules.map((m:any)=>[m.id,alive.filter((e:any)=>{const d=getDef(e.defId);return d.extensions?.[m.id]||d.weapons.some((w:any)=>w.extensions?.[m.id])}).length])),
  warmupTicks:spec.warmupTicks,measuredTicks:spec.measuredTicks,totalMs:elapsed,meanStepMs:timing.reduce((a,b)=>a+b,0)/timing.length,
  p50StepMs:quantile(timing,.5),p95StepMs:quantile(timing,.95),p99StepMs:quantile(timing,.99),maxStepMs:timing.at(-1),
  peakProjectiles,finalProjectiles:game.st.projs.length,hullDamage:healthStart-alive.reduce((a:number,e:any)=>a+e.hp,0),
  optionalStateBytes:{afterWarmup:Buffer.byteLength(JSON.stringify(warm)),afterMeasurement:Buffer.byteLength(JSON.stringify(final))},
  heapUsedBefore:heapBefore,heapUsedAfter:heapAfter,fixtureSha256:hash(source),workloadSha256:hash(JSON.stringify(raw))};
 results.push(metrics);console.log(`${study.id}: ${count} hosts, ${alive.length} alive, ${metrics.meanStepMs.toFixed(3)} ms/tick, p95 ${metrics.p95StepMs.toFixed(3)}, peak ${peakProjectiles} projectiles`);
 disposeContentGame(game);applyContent([]);
}
const report={createdAt:new Date().toISOString(),purpose:'Exploratory enabled-module scalability; NOT a vanilla regression comparison or shipping hardware guarantee.',
 limitations:['Recorded while other build/typecheck work may contend for CPU.','One process and one sample per workload; warmup precedes each sample.','Headless simulation only; rendering, network encoding and startup excluded.','Heap values are snapshots without forced GC, not retained-memory measurements.','Fixtures have benchmark-only hull/component durability overrides to avoid exhaustion.','Tick timings include every enabled module and ordinary simulation; no isolated attribution to one module.'],
 environment:{engine,head:git('rev-parse','HEAD'),workingTreeIncluded:true,platform:process.platform,arch:process.arch,os:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,bun:Bun.version,node:process.version,totalMemoryBytes:os.totalmem()},
 workload:spec,results};
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(out);
