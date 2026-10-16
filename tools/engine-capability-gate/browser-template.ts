__CODEC_IMPORT__
import { arena, conquest } from '__ROOT__/game/core/server/testkit/game.ts';
import { newEnt } from '__ROOT__/game/core/src/game/state.ts';
import { cmdHold, cmdMove } from '__ROOT__/game/core/src/game/orders.ts';
import { serializeGame, deserializeGame, collectNewEffects } from '__ROOT__/game/core/src/game/save.ts';
import { buildTeamView, encodeFullFrame, encodeFrame, RecMemo, rememberSent, stringifyFrame, ViewCache, viewKey } from '__ROOT__/game/core/src/net/frames.ts';
const digest=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)};
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const stats=(xs:number[])=>{const a=[...xs].sort((x,y)=>x-y);return{mean:xs.reduce((x,y)=>x+y,0)/xs.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],p99:a[Math.floor(a.length*.99)]}};
function scenario(workload:string){
 const game=workload==='battle'?conquest('random-l',{seed:42,fog:true,multiplayer:true,popCap:5000,metal:5000,players:Array.from({length:4},(_,team)=>({isHuman:false,team,difficulty:'veteran'}))}):arena({mode:'campaign',w:270,h:270,dayNight:false,fog:true,multiplayer:true,metal:0,popCap:5000,seed:42});
 const lists:number[][]=game.st.players.map(()=>[]);
 if(workload==='battle')for(let owner=0;owner<4;owner++){
  const spawn=game.st.map.spawns[owner];
  for(let i=0;i<198;i++)lists[owner].push(newEnt(game.st,['buggy','ltank','flak','arty'][i%4],owner,(spawn.x+(i%18-9)*.55)*32,(spawn.y+(Math.floor(i/18)-5)*.55)*32).id);
  cmdMove(game,lists[owner],game.st.map.w*16,game.st.map.h*16,false,true);
 }else{
  const pairs=workload==='idle'?128:500;
  for(let i=0;i<pairs;i++)for(let owner=0;owner<2;owner++){
   const e=newEnt(game.st,workload==='projectiles'?(i%2?'arty':'flak'):'ltank',owner,(5+i%25*10+owner*(workload==='idle'?7:3.5))*32,(5+Math.floor(i/25)*10)*32,owner?Math.PI:0);
   e.hp=1e8;lists[owner].push(e.id);
  }
  for(const ids of lists)cmdHold(game,ids);
 }
 return game;
}
function phase(game:ReturnType<typeof arena>,ticks:number){
 __CODEC_BIND__
 const clients=game.st.players.map((_,viewer)=>({viewer,cache:new ViewCache(viewKey(game,viewer,'none')),seq:0}));
 for(const client of clients)encodeFullFrame(game,client.viewer,'none',++client.seq,client.cache);
 const sent=new WeakMap(),seen=new WeakSet(),born:any[]=[],simulation:number[]=[],replication:number[]=[];
 let wireHash=2166136261,wireBytes=0,peakProjectiles=0;
 for(let tick=0;tick<ticks;tick++){
  const start=performance.now();game.step();simulation.push(performance.now()-start);
  peakProjectiles=Math.max(peakProjectiles,game.st.projs.length);collectNewEffects(game.st,seen,born);
  if(tick%3===0){
   const at=performance.now(),memo=new RecMemo(),texts:string[]=[];
   for(const client of clients){const view=buildTeamView(game,client.viewer,'none',born,sent,memo);const frame=encodeFrame(view,client.cache,++client.seq,game.st.tick,game.st.time);texts.push(stringifyFrame(frame,memo))}
   rememberSent(game.st,sent);born.length=0;replication.push(performance.now()-at);
   for(const text of texts){wireBytes+=bytes(text);for(let i=0;i<text.length;i++){wireHash^=text.charCodeAt(i);wireHash=Math.imul(wireHash,16777619)}}
  }
 }
 return{sim:stats(simulation),replication:stats(replication),wireDigest:(wireHash>>>0).toString(16),wireBytes,peakProjectiles};
}
(globalThis as any).runBenchmark=(workload='battle',warmup=900,measured=900,freezeTicks=300)=>{
 const initial=scenario(workload);for(let i=0;i<freezeTicks;i++)initial.step();const frozen=serializeGame(initial);
 const warm=deserializeGame(frozen);const warmed=phase(warm,warmup);
 const game=deserializeGame(frozen);const start=serializeGame(game),measuredStartTick=game.st.tick;
 const result=phase(game,measured),end=serializeGame(game);
 return{workload,warmup,measured,freezeTicks,measuredStartTick,entities:game.st.ents.size,runtime:navigator.userAgent,
 frozenDigest:digest(frozen),measuredStartDigest:digest(start),digest:digest(end),snapshotBytes:bytes(end),warmed,
 ...result,hashAlgorithm:'FNV-1a32',resourcePaths:performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname)};
};
