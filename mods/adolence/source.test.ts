import {beforeAll,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {prepareContentSchema} from '../../../steel-tide-game/game/core/src/game/contentSchema';
import {parseDefinitionPack} from '../../../steel-tide-game/game/core/src/game/contentDefs';
import {applyContent} from '../../../steel-tide-game/game/core/src/game/content';
import {prepareContentCapabilities} from '../../../steel-tide-game/game/core/src/game/contentCapabilities';
import {contentRuntime,createContentGame} from '../../../steel-tide-game/game/core/src/game/contentGame';
import {getDef} from '../../../steel-tide-game/game/core/src/game/defs';
import {newEnt} from '../../../steel-tide-game/game/core/src/game/state';
import {cmdContentAction,cmdProduce} from '../../../steel-tide-game/game/core/src/game/orders';
import {cmdRuleButton} from '../../../steel-tide-game/game/core/src/game/modRules';
import {serializeGame,deserializeGame} from '../../../steel-tide-game/game/core/src/game/save';
import {arena,arenaMap} from '../../../steel-tide-game/game/core/server/testkit/game';
import {buildGameMap} from '../../../steel-tide-game/game/core/src/game/mapdefs';
const ID='adolence.source-v1';
const manifest=JSON.parse(readFileSync(import.meta.dir+'/mod.json','utf8'));
const fg=JSON.parse(readFileSync(import.meta.dir+'/../fg-rusted-league/mod.json','utf8'));
beforeAll(async()=>{
 const packs=[];
 for(const m of [manifest,fg]){await prepareContentSchema(m,true);const p=parseDefinitionPack(m);if(!p.ok)throw Error(JSON.stringify(p.errors));packs.push(p.pack);}
 const applied=applyContent(packs);if(applied.rejected.length)throw Error(JSON.stringify(applied.rejected));
 await prepareContentCapabilities(packs);
});
function scene(){const base=arena({mode:'campaign',fog:false,dayNight:false,metal:100000,popCap:500});const g=createContentGame(base.st.cfg,arenaMap({w:128,h:128}),true);return {g,module:contentRuntime(g)!.module(ID)!};}
function ticks(g:any,n:number){for(let i=0;i<n;i++)g.step();}
test('both packages coexist and every faction starts and reproduces its builder',()=>{
 for(const m of [manifest,fg])for(const f of m.factions){
  const cfg:any={mode:'sandbox',mapKey:'greenfield',seed:11,fog:false,popCap:100,startMetal:20000,players:[{isHuman:true,team:0,faction:f.id},{isHuman:true,team:1}]};
  const g=createContentGame(cfg,buildGameMap(cfg));const own=[...g.st.ents.values()].filter(e=>e.owner===0);
  expect(own.map(e=>e.defId)).toEqual([f.headquarters,f.builder,f.builder]);
  expect(cmdProduce(g,own[0].id,f.builder)).toBe(true);ticks(g,700);
  expect([...g.st.ents.values()].filter(e=>e.owner===0&&e.defId===f.builder).length).toBe(3);
  expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
 }
});
test('source magazine depletes on an actual shot and prevents firing while reloading',()=>{
 const {g,module}=scene();const a=newEnt(g.st,'adolence-officer-rifle',0,700,700),b=newEnt(g.st,'mbt',1,780,700);
 a.angle=a.turretAngle=0;a.holdPos=true;b.holdFire=true;ticks(g,1);
 const state:any=module.snapshot();state.entities[a.id].energy=.5;module.restore(state);
 for(let i=0;i<90&&!(module.snapshot() as any).entities[a.id].recharging;i++)g.step();
 const s=(module.snapshot() as any).entities[a.id];expect(s.recharging).toBe(true);expect(s.energy).toBe(0);
 expect(module.canFire!(a,getDef(a.defId),getDef(a.defId).weapons[0],b,b)).toBe(false);
});
test('manual reload validates ownership, keeps its timer in saves and completes deterministically',()=>{
 const {g,module}=scene(),e=newEnt(g.st,'adolence-officer-rifle',0,700,700);e.holdFire=true;ticks(g,1);
 const s:any=module.snapshot();s.entities[e.id].energy=1;module.restore(s);
 expect(cmdContentAction(g,ID,{owner:1,ids:[e.id],action:'reload'})).toBe(false);
 expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'reload'})).toBe(true);
 expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'reload'})).toBe(false);
 ticks(g,17);const restored=deserializeGame(serializeGame(g));
 for(let i=0;i<160;i++){g.step();restored.step();}
 expect(serializeGame(restored)).toBe(serializeGame(g));
 expect((module.snapshot() as any).entities[e.id].energy).toBe(30);
 expect((module.snapshot() as any).entities[e.id].recharging).toBe(false);
});
test('enemy views hide magazines and malformed restore is rejected transactionally',()=>{
 const {g,module}=scene(),e=newEnt(g.st,'adolence-officer-rifle',0,700,700);ticks(g,1);
 const before=module.snapshot();expect(module.inspect!(e,false)).toEqual([]);
 expect(module.snapshot({player:1,visibleEntities:new Set([e.id]),visibleProjectiles:new Set(),privateEntity:()=>false})).toEqual({entities:{}});
 const bad:any=structuredClone(before);bad.entities[e.id].energy=NaN;
 expect(()=>module.restore(bad)).toThrow();expect(module.snapshot()).toEqual(before);
});
test('new combat roster is trainable and transformed forms point at real definitions',()=>{
 for(const suffix of ['hazmat-red','zhongzhou-special-at','armed-drone','utility-a','command-car-0','navigator']){
  const d=manifest.defs.find((d:any)=>d.id==='adolence-'+suffix);expect(d.producedBy.length).toBeGreaterThan(0);
  for(const home of d.producedBy)expect(getDef(home).produces).toContain(d.id);
 }
 const {g}=scene(),drone=newEnt(g.st,'adolence-armed-drone',0,700,700);
 newEnt(g.st,'adolence-precinct',0,100,100);ticks(g,1);
 expect(cmdRuleButton(g,[drone.id],drone.defId,0)).toBe(true);ticks(g,180);expect(drone.defId).toBe('adolence-attack-drone');
});
test('FG energy bursts recharge and a moving Mirage stays disguised until it fires',()=>{
 const {g}=scene(),module=contentRuntime(g)!.module('fg-rusted-league.source-v1')!;
 const e=newEnt(g.st,'fg-rusted-league-v3-launcher',0,700,700);e.holdFire=true;ticks(g,1);
 const state:any=module.snapshot();state.entities[e.id].energy=0;state.entities[e.id].recharging=true;module.restore(state);
 ticks(g,510);expect((module.snapshot() as any).entities[e.id].energy).toBeCloseTo(3);
 expect((module.snapshot() as any).entities[e.id].recharging).toBe(false);
 const mirage=getDef('fg-rusted-league-mirage-disguised');expect(mirage.rules!.some((r:any)=>r.when?.moving)).toBe(false);
 expect(mirage.rules!.some((r:any)=>r.on==='fired')).toBe(true);
});
test('FG carrier launches real aircraft instead of duplicate proxy weapons',()=>{
 const {g}=scene();const carrier=newEnt(g.st,'fg-rusted-league-aircraft-carrier',0,700,700),enemy=newEnt(g.st,'mbt',1,850,700);
 enemy.holdFire=true;ticks(g,90);
 expect(getDef(carrier.defId).weapons.length).toBe(0);
 expect([...g.st.ents.values()].some(e=>e.defId==='fg-rusted-league-carrier-interceptor'&&e.owner===0)).toBe(true);
 const hp=enemy.hp;for(let i=0;i<360&&enemy.hp>=hp;i++)g.step();expect(enemy.hp).toBeLessThan(hp);
 expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
});

test('destroyed magazines do not leave invalid state in an immediate save',()=>{
 const {g,module}=scene(),e=newEnt(g.st,'adolence-officer-rifle',0,700,700);ticks(g,1);
 e.dead=true;ticks(g,1);expect((module.snapshot() as any).entities[e.id]).toBeUndefined();
 expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
});

test('guard-post squads require a garage, cost metal and arrive as the source composition',()=>{
 const {g}=scene();newEnt(g.st,'adolence-precinct',0,100,100);
 const post=newEnt(g.st,'adolence-guard-post',0,700,700);ticks(g,1);
 expect(cmdRuleButton(g,[post.id],post.defId,0)).toBe(false);
 newEnt(g.st,'adolence-garage',0,300,300);ticks(g,1);
 expect(cmdRuleButton(g,[post.id],post.defId,0)).toBe(true);ticks(g,950);
 const count=(id:string)=>[...g.st.ents.values()].filter(e=>!e.dead&&e.owner===0&&e.defId===id).length;
 expect(count('adolence-guard-rifleman')).toBe(4);expect(count('adolence-guard-armored')).toBe(4);expect(count('adolence-guard-gunner')).toBe(2);
 expect(g.st.players[0].stats.metalSpent).toBeGreaterThanOrEqual(219.9);
});

test('the ASW plane refills its finite source energy on the carrier deck',()=>{
 const {g}=scene(),module=contentRuntime(g)!.module('fg-rusted-league.source-v1')!;
 const carrier=newEnt(g.st,'fg-rusted-league-littoral-ship',0,700,700);carrier.holdFire=true;ticks(g,2);
 const plane=[...g.st.ents.values()].find(e=>e.wingOf===carrier.id)!;expect(plane.inside).toBe(carrier.id);
 const state:any=module.snapshot();state.entities[plane.id].energy=0;state.entities[plane.id].recharging=true;module.restore(state);ticks(g,1);
 expect((module.snapshot() as any).entities[plane.id].energy).toBe(30);expect((module.snapshot() as any).entities[plane.id].recharging).toBe(false);
 expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
});
