import { beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareContentSchema } from '../../../steel-tide-game/game/core/src/game/contentSchema';
import { parseDefinitionPack } from '../../../steel-tide-game/game/core/src/game/contentDefs';
import { applyContent } from '../../../steel-tide-game/game/core/src/game/content';
import { prepareContentCapabilities } from '../../../steel-tide-game/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame } from '../../../steel-tide-game/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide-game/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide-game/game/core/src/game/state';
import { cmdContentAction, cmdProduce } from '../../../steel-tide-game/game/core/src/game/orders';
import { cmdRuleButton } from '../../../steel-tide-game/game/core/src/game/modRules';
import { serializeGame, deserializeGame } from '../../../steel-tide-game/game/core/src/game/save';
import { arena, arenaMap } from '../../../steel-tide-game/game/core/server/testkit/game';
import { Terrain } from '../../../steel-tide-game/game/core/src/core/types';
import { buildGameMap } from '../../../steel-tide-game/game/core/src/game/mapdefs';

const ID='naval-warfare.systems-v1';
const here=import.meta.dir;
const manifest=JSON.parse(readFileSync(resolve(here,'mod.json'),'utf8'));
const ledger=JSON.parse(readFileSync(resolve(here,'conversion-report.json'),'utf8'));
const id=(name:string)=>ledger.entries.find((e:any)=>e.rwName===name).id;
beforeAll(async()=>{
  await prepareContentSchema(manifest,true);
  const parsed=parseDefinitionPack(manifest);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const applied=applyContent([parsed.pack]);
  if(applied.rejected.length)throw Error(JSON.stringify(applied.rejected));
  await prepareContentCapabilities([parsed.pack]);
});
function scene(water=false){
  const base=arena({mode:'campaign',fog:false,dayNight:false,metal:100000,popCap:500});
  const g=createContentGame(base.st.cfg,arenaMap({w:128,h:128,fill:water?Terrain.Water:Terrain.Grass}),true);
  return {g,module:contentRuntime(g)!.module(ID)!};
}
function ticks(g:any,count:number){for(let i=0;i<count;i++)g.step();}

test('all five factions keep an HQ/builder reconstruction loop and closed rosters',()=>{
  expect(manifest.factions.length).toBe(5);
  for(const f of manifest.factions){expect(getDef(f.headquarters).isHQ).toBe(true);expect(getDef(f.headquarters).produces).toContain(f.builder);expect(getDef(f.builder).builds).toContain(f.headquarters);}
});
test('each selectable faction actually starts with its HQ and can train another own builder',()=>{
  for(const f of manifest.factions){
    const config:any={mode:'sandbox',mapKey:'greenfield',seed:11,fog:false,popCap:100,startMetal:1500,players:[{isHuman:true,team:0,faction:f.id},{isHuman:true,team:1}]};
    const g=createContentGame(config,buildGameMap(config));
    const own=[...g.st.ents.values()].filter(e=>e.owner===0);
    expect(own.map(e=>e.defId)).toEqual([f.headquarters,f.builder,f.builder]);
    expect(cmdProduce(g,own[0].id,f.builder)).toBe(true);ticks(g,400);
    expect([...g.st.ents.values()].filter(e=>e.owner===0&&e.defId===f.builder).length).toBe(3);
    expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
  }
});
test('AI establishes the source crane construction chain and fields recruited ground units',()=>{
  const config:any={mode:'sandbox',mapKey:'greenfield',seed:19,fog:false,popCap:100,startMetal:10000,players:[{isHuman:false,team:0,faction:'naval-warfare-us'},{isHuman:true,team:1}]};
  const g=createContentGame(config,buildGameMap(config));ticks(g,30*360);
  const own=[...g.st.ents.values()].filter(e=>e.owner===0&&!e.dead);
  expect(own.some(e=>e.defId===id('Crane Us')&&!e.site)).toBe(true);
  expect(own.some(e=>e.defId===id('USF')&&!e.site)).toBe(true);
  expect(own.some(e=>getDef(e.defId).kind==='unit'&&!getDef(e.defId).buildRate&&getDef(e.defId).weapons.length>0)).toBe(true);
},20000);
test('Iowa retains every firing barrel beyond the eight HUD entries',()=>{
  const {g,module}=scene(true),e=newEnt(g.st,id('SimpleIowa'),0,1200,1200);
  const c=getDef(e.defId).extensions![ID] as any;
  expect(c.guns.length).toBeGreaterThan(8);
  ticks(g,1);
  expect(Object.keys((module.snapshot() as any).entities[e.id].guns).length).toBe(c.guns.length);
});
test('a real main gun emits from its source mount and damages a target',()=>{
  const {g,module}=scene();const a=newEnt(g.st,id('MBT1'),0,700,700),b=newEnt(g.st,id('T-72'),1,860,700);
  a.angle=a.turretAngle=0;b.holdFire=true;a.holdPos=true;
  const hp=b.hp;let launched=false;
  for(let i=0;i<120;i++){g.step();if(g.st.projs.some(p=>p.src===a.id))launched=true;if(b.dead||b.hp<hp)break;}
  expect(launched).toBe(true);expect(b.dead||b.hp<hp).toBe(true);
  expect((module.render!(a) as any).mounts.length).toBeGreaterThan(0);
});
test('a factory batch uses its source action price/time and exits onto passable ground',()=>{
  const {g}=scene(),factory=newEnt(g.st,id('USF'),0,900,900);
  ticks(g,1);const before=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action:'action_buildB'})).toBe(true);
  expect(g.st.players[0].metal).toBeCloseTo(before-300);
  ticks(g,149);expect([...g.st.ents.values()].filter(e=>e.defId===id('MBT1')).length).toBe(0);
  ticks(g,3);const tank=[...g.st.ents.values()].find(e=>e.defId===id('MBT1'))!;
  expect(tank).toBeDefined();expect(tank.inside).toBeUndefined();expect(tank.owner).toBe(0);
});
test('an original stationary crane constructs through native placement checks and survives saving mid-build',()=>{
  const {g,module}=scene();newEnt(g.st,id('USHQ'),0,900,900);const crane=newEnt(g.st,id('Crane Us'),0,1000,900);ticks(g,1);
  const action='construct/'+id('USF'),before=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[crane.id],action,x:1088,y:960})).toBe(true);
  expect(g.st.players[0].metal).toBeCloseTo(before-getDef(id('USF')).cost);
  const site=[...g.st.ents.values()].find(e=>e.defId===id('USF'))!;expect(site.site).toBe(true);
  ticks(g,5);const restored=deserializeGame(serializeGame(g));const count=Math.ceil(getDef(id('USF')).buildTime*30)+2;
  for(let i=0;i<count;i++){g.step();restored.step();}
  expect(site.site).toBeUndefined();expect(serializeGame(restored)).toBe(serializeGame(g));
  expect((module.snapshot() as any).entities[crane.id].job).toBeUndefined();
});
test('ownership, insufficient funds and invalid strike coordinates leave state unchanged',()=>{
  const {g,module}=scene(),factory=newEnt(g.st,id('USF'),0,900,900);ticks(g,1);
  const before=JSON.stringify(module.snapshot());
  expect(cmdContentAction(g,ID,{owner:1,ids:[factory.id],action:'action_buildB'})).toBe(false);
  g.st.players[0].metal=0;
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action:'action_buildB'})).toBe(false);
  expect(JSON.stringify(module.snapshot())).toBe(before);
});
test('enlarged bases reserve their full footprint during crane construction',()=>{
  const {g}=scene();newEnt(g.st,id('USHQ'),0,900,900);
  const crane=newEnt(g.st,id('Crane Us'),0,1000,800);ticks(g,1);
  const action='construct/'+id('USF'),before=g.st.players[0].metal;
  // Two tiles between centers used to fit the one-tile bases, but overlaps 3×3 bases.
  expect(cmdContentAction(g,ID,{owner:0,ids:[crane.id],action,x:960,y:960})).toBe(false);
  expect(g.st.players[0].metal).toBe(before);
  expect([...g.st.ents.values()].some(e=>e.defId===id('USF'))).toBe(false);
  expect(cmdContentAction(g,ID,{owner:0,ids:[crane.id],action,x:1088,y:960})).toBe(true);
});
test('carrier starts with the source mixed aircraft, and launch/recovery retain ownership',()=>{
  const {g,module}=scene(true),carrier=newEnt(g.st,id('Admiral Kuznetsov Aircraft Carrier'),0,1700,1700);
  ticks(g,1);expect(carrier.cargo?.length).toBe(8);
  const ids=[...carrier.cargo!];expect(ids.map(x=>g.st.ents.get(x)!.defId).filter(x=>x===id('Mig29K')).length).toBe(6);
  expect(cmdContentAction(g,ID,{owner:0,ids:[carrier.id],action:'launch'})).toBe(true);
  expect(carrier.cargo?.length).toBe(0);expect(ids.every(x=>!g.st.ents.get(x)!.inside)).toBe(true);
  const plane=g.st.ents.get(ids[0])!;plane.x=carrier.x;plane.y=carrier.y;
  expect(cmdContentAction(g,ID,{owner:0,ids:[carrier.id],action:'recover',targetId:plane.id})).toBe(true);
  ticks(g,1);expect(plane.inside).toBe(carrier.id);expect(carrier.cargo).toContain(plane.id);
  expect(module.inspect!(carrier,false)).toEqual([]);
});
test('deployment morph keeps identity, health share and source energy',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('s400'),0,900,900);ticks(g,1);e.hp=getDef(e.defId).hp*.6;
  const uid=e.id;expect(cmdRuleButton(g,[e.id],e.defId,0)).not.toBe(false);
  ticks(g,62);expect(e.defId).toBe(id('s400dep'));expect(e.id).toBe(uid);expect(e.hp/getDef(e.defId).hp).toBeCloseTo(.6,1);
  expect((module.snapshot() as any).entities[e.id].stocks.energy).toBeGreaterThan(0);
});
test('in-flight shots and an unfinished paid action survive save/restore deterministically',()=>{
  const {g}=scene(),factory=newEnt(g.st,id('USF'),0,1200,1200),a=newEnt(g.st,id('MBT1'),0,700,700),b=newEnt(g.st,id('T-72'),1,1000,700);
  a.angle=a.turretAngle=0;a.holdPos=true;b.holdFire=true;ticks(g,1);
  cmdContentAction(g,ID,{owner:0,ids:[factory.id],action:'action_buildB'});ticks(g,3);
  expect(g.st.projs.length).toBeGreaterThan(0);
  const saved=serializeGame(g),restored=deserializeGame(saved);
  for(let i=0;i<70;i++){g.step();restored.step();}
  expect(serializeGame(restored)).toBe(serializeGame(g));
});
test('a slave barrel follows its parent turret when the enemy is off the bow',()=>{
  const {g,module}=scene(),a=newEnt(g.st,id('MBT1'),0,700,700),b=newEnt(g.st,id('T-72'),1,700,500);
  a.angle=a.turretAngle=0;a.holdPos=true;b.holdFire=true;const hp=b.hp;
  ticks(g,150);expect(b.dead||b.hp<hp).toBe(true);
  const s=(module.snapshot() as any).entities[a.id];expect(s.mounts['2'].angle).toBeCloseTo(s.mounts['1'].angle,2);
});
test('invalid manual nuclear aim leaves energy and money untouched',()=>{
  const {g,module}=scene(true),e=newEnt(g.st,id('Type-094'),0,900,900);e.holdFire=true;ticks(g,1);
  const before=module.snapshot(),metal=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_fire_JL-2',x:NaN,y:0})).toBe(false);
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_fire_JL-2',x:-10,y:0})).toBe(false);
  expect(module.snapshot()).toEqual(before);expect(g.st.players[0].metal).toBe(metal);
});
test('reactor temperature transitions and cooling survive an immediate save',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('Nuclear_factory'),0,900,900);ticks(g,1);
  let state=module.snapshot() as any;state.entities[e.id].stocks.energy=.74;module.restore(state);ticks(g,1);
  expect(e.defId).toBe(id('Nuclear_factory1'));
  expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
  state=module.snapshot() as any;state.entities[e.id].stocks.energy=.79;module.restore(state);
  const action=(getDef(e.defId).extensions![ID] as any).actions.find((a:any)=>a.coolReactor).id;
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action})).toBe(true);expect(e.defId).toBe(id('Nuclear_factoryC1'));
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'cancel'})).toBe(false);
  ticks(g,302);expect(e.defId).toBe(id('Nuclear_factory'));
});
test('a source meltdown triggers the immediate death blast without orphaned saved state',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('Nuclear_factory3'),0,900,900),t=newEnt(g.st,'mbt',1,1000,900);
  t.holdFire=true;ticks(g,1);const state=module.snapshot() as any;state.entities[e.id].stocks.energy=0;module.restore(state);
  ticks(g,1);expect(e.dead).toBe(true);expect(t.dead).toBe(true);expect(()=>deserializeGame(serializeGame(g))).not.toThrow();
});
test('carrier purchases preserve two queued batches and their source costs',()=>{
  const {g,module}=scene(true),e=newEnt(g.st,id('CVN-74'),0,1500,1500);e.holdFire=true;ticks(g,1);
  const before=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_build'})).toBe(true);
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_build'})).toBe(true);
  expect(g.st.players[0].metal).toBeCloseTo(before-1040);
  expect((module.snapshot() as any).entities[e.id].queue.length).toBe(1);
  ticks(g,304);expect(e.cargo?.length).toBe(7);
});
test('public frames expose visible mount poses without ammunition or action orders',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('MBT1'),1,700,700);ticks(g,1);
  const snap=module.snapshot({player:0,privateEntity:()=>false,visibleEntities:new Set([e.id]),visibleProjectiles:new Set()}) as any;
  expect(snap.entities).toEqual({});expect(snap.visuals[e.id].mounts.length).toBeGreaterThan(0);expect(JSON.stringify(snap.visuals)).not.toContain('stocks');
  const hidden=module.snapshot({player:0,privateEntity:()=>false,visibleEntities:new Set(),visibleProjectiles:new Set()}) as any;
  expect(hidden.visuals).toEqual({});
});
test('corrupt restored clocks are rejected transactionally',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('MBT1'),0,700,700);ticks(g,1);
  const before=module.snapshot() as any,invalid=structuredClone(before);invalid.entities[e.id].guns['2'].cd=NaN;
  expect(()=>module.restore(invalid)).toThrow();expect(module.snapshot()).toEqual(before);
});
