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
import { cmdAttack, cmdAttackGround, cmdContentAction, cmdFire, cmdHelm, cmdProduce, cmdWorldRemove } from '../../../steel-tide-game/game/core/src/game/orders';
import { serializeGame, deserializeGame, buildContentSnapshot } from '../../../steel-tide-game/game/core/src/game/save';
import { arena, arenaMap, columns } from '../../../steel-tide-game/game/core/server/testkit/game';
import { Terrain } from '../../../steel-tide-game/game/core/src/core/types';
import { buildGameMap } from '../../../steel-tide-game/game/core/src/game/mapdefs';
import { parseCustomMap, customMapToGameMap } from '../../../steel-tide-game/game/core/src/game/customMap';
import { mapUnitPose, mapUnitRect } from '../../../steel-tide-game/game/core/src/game/map';
import { passable } from '../../../steel-tide-game/game/core/src/game/path';


const ID='ek-definitive-edition.systems-v1';
const here=import.meta.dir;
const manifest=JSON.parse(readFileSync(resolve(here,'mod.json'),'utf8'));
const inventory=JSON.parse(readFileSync(resolve(here,'source-inventory.json'),'utf8'));
const id=(name:string)=>inventory.find((e:any)=>e.rwName===name)?.id??name;
beforeAll(async()=>{
  await prepareContentSchema(manifest,true);
  const parsed=parseDefinitionPack(manifest);
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const applied=applyContent([parsed.pack]);
  if(applied.rejected.length)throw Error(JSON.stringify(applied.rejected));
  await prepareContentCapabilities([parsed.pack]);
});
function scene(water=false){
  const base=arena({mode:'campaign',fog:false,dayNight:false,metal:10000000,popCap:500});
  const g=createContentGame(base.st.cfg,arenaMap({w:128,h:128,fill:water?Terrain.Water:Terrain.Grass}),true);
  for(const p of g.st.players)p.isHuman=true;
  return {g,module:contentRuntime(g)!.module(ID)!};
}
function ticks(g:any,n:number){for(let i=0;i<n;i++)g.step();}

function showcase(players=[{isHuman:true,team:0,spawn:0},{isHuman:false,team:1,spawn:1}],changed=false){
  const parsed=parseCustomMap(readFileSync(resolve(here,manifest.maps[0]),'utf8'));
  if(!parsed.ok)throw Error(parsed.error);
  if(changed)parsed.data.units![0].x++;
  const cfg={...arena().st.cfg,players,mapKey:'custom',customMap:parsed.data,fog:false,dayNight:false};
  return createContentGame(cfg,customMapToGameMap(parsed.data));
}

test('showcase map parses without dropping placements and starts every EK specimen on valid terrain',()=>{
  const index=JSON.parse(readFileSync(resolve(here,'maps/showcase-index.json'),'utf8'));
  const g=showcase(),raw=g.st.cfg.customMap!;
  expect(raw.units).toHaveLength(400);
  expect(index).toHaveLength(573);
  expect(new Set(index.map((u:any)=>u.id))).toEqual(new Set(manifest.defs.map((d:any)=>d.id)));
  expect(raw.translations!.zh!.name).toBe('EK 全单位展示测试场');
  expect(raw.translations!.ko!.name).toBe('EK 전체 유닛 시험장');
  const occupied=new Set<number>();
  for(const u of [...index,...raw.units!.filter(u=>!u.id.startsWith('ek-'))]){
    const r=mapUnitRect(u);
    expect(r.x>=0&&r.y>=0&&r.x+r.fw<=raw.w&&r.y+r.fh<=raw.h).toBe(true);
    for(let y=r.y;y<r.y+r.fh;y++)for(let x=r.x;x<r.x+r.fw;x++){
      expect(occupied.has(y*raw.w+x)).toBe(false);occupied.add(y*raw.w+x);
    }
  }
  ticks(g,1);
  for(const u of index){
    const d=getDef(u.id),pose=mapUnitPose(u,g.st.map),found=[...g.st.ents.values()].filter(e=>e.defId===u.id);
    expect(found).toHaveLength(1);
    expect(found[0].owner).toBe(0);
    expect(found[0].x).toBe(pose.x);expect(found[0].y).toBe(pose.y);
    expect(found[0].holdFire).toBe(true);
    if(d.kind==='unit')expect(passable(g.st,d.domain,Math.floor(pose.x/32),Math.floor(pose.y/32))).toBe(true);
    else expect(g.st.map.terrain[Math.floor(pose.y/32)*raw.w+Math.floor(pose.x/32)]).toBe(d.offshore?Terrain.Water:Terrain.Grass);
  }
  expect(g.st.players[0].metal).toBeGreaterThanOrEqual(1000000);
  expect((contentRuntime(g)!.module(ID)!.snapshot() as any).balances[0].experimental).toBe(100000);
},30000);

test('showcase survives save/load without duplicating specimens or granting resources twice',()=>{
  const g=showcase();ticks(g,1);
  const saved=serializeGame(g),loaded=deserializeGame(saved);
  expect(serializeGame(loaded)).toBe(saved);
  // Native save slots round positions/angles. Exact keyframes retain the full
  // simulation state and are the appropriate deterministic continuation check.
  const exact=JSON.stringify(buildContentSnapshot(g,undefined,true,undefined,undefined,true));
  const restored=deserializeGame(exact);
  ticks(g,90);ticks(restored,90);ticks(loaded,90);
  expect(serializeGame(restored)).toBe(serializeGame(g));
  expect(loaded.st.players[0].metal).toBeLessThan(1100000);
  expect((contentRuntime(loaded)!.module(ID)!.snapshot() as any).showcase.ready).toBe(true);
  expect(g.st.players[0].metal).toBeLessThan(1100000);
},30000);

test('idle showcase stays intact for one minute without spawning ordnance or detonating helpers',()=>{
  const g=showcase();ticks(g,1);const initial=[...g.st.ents.values()].filter(e=>e.defId.startsWith('ek-')).map(e=>({id:e.id,def:e.defId,x:e.x,y:e.y,hp:e.hp}));
  ticks(g,1800);
  expect([...g.st.ents.values()].filter(e=>e.defId.startsWith('ek-')).map(e=>({id:e.id,def:e.defId,x:e.x,y:e.y,hp:e.hp}))).toEqual(initial);
  expect(g.st.projs).toHaveLength(0);expect(g.st.effects).toHaveLength(0);expect(g.st.decals).toHaveLength(0);
  const module=contentRuntime(g)!.module(ID)!;
  expect((module.snapshot() as any).showcase.paused).toHaveLength(573);
  const restored=deserializeGame(serializeGame(g));ticks(restored,30);
  expect((contentRuntime(restored)!.module(ID)!.snapshot() as any).showcase.paused).toHaveLength(573);
  // A save immediately after removing a paused specimen must not retain its id.
  cmdWorldRemove(restored,[initial[0].id],'removed');
  const afterRemoval=deserializeGame(serializeGame(restored));
  expect((contentRuntime(afterRemoval)!.module(ID)!.snapshot() as any).showcase.paused).toHaveLength(572);
},30000);

test('showcase activation is owned, explicit, saved and also follows player actions',()=>{
  const g=showcase();ticks(g,1);const module=contentRuntime(g)!.module(ID)!;
  const bird=[...g.st.ents.values()].find(e=>e.defId===id('EkArsenalBird'))!;
  expect(module.actions!(bird).some(a=>a.id==='showcase-start')).toBe(true);
  expect(cmdContentAction(g,ID,{owner:1,ids:[bird.id],action:'showcase-start'})).toBe(false);
  expect(cmdContentAction(g,ID,{owner:0,ids:[bird.id],action:'showcase-start'})).toBe(true);ticks(g,2);
  expect(Object.keys((module.snapshot() as any).entities[bird.id].children)).toHaveLength(3);
  expect((module.snapshot() as any).showcase.paused).not.toContain(bird.id);
  const barracks=[...g.st.ents.values()].find(e=>e.defId===id('EkInfantryFactoryT1'))!;
  expect(cmdContentAction(g,ID,{owner:0,ids:[barracks.id],action:'action_1'})).toBe(true);
  expect((module.snapshot() as any).showcase.paused).not.toContain(barracks.id);
  const drake=[...g.st.ents.values()].find(e=>e.defId===id('Ek_heavyTankDrake'))!;
  drake.orders=[{kind:'move',x:drake.x+50,y:drake.y}];ticks(g,1);
  expect((module.snapshot() as any).showcase.paused).not.toContain(drake.id);
  const restored=deserializeGame(serializeGame(g));
  expect((contentRuntime(restored)!.module(ID)!.snapshot() as any).showcase).toEqual((module.snapshot() as any).showcase);
  const normal=scene(),normalBird=newEnt(normal.g.st,id('EkArsenalBird'),0,900,900);ticks(normal.g,2);
  expect(normal.module.actions!(normalBird).some(a=>a.id==='showcase-start')).toBe(false);
  expect(Object.keys((normal.module.snapshot() as any).entities[normalBird.id].children)).toHaveLength(3);
},30000);

test('showcase respects selected spawn slots, closed seats and unrelated maps',()=>{
  const reversed=showcase([{isHuman:false,team:1,spawn:1},{isHuman:true,team:0,spawn:0}]);ticks(reversed,1);
  expect([...reversed.st.ents.values()].filter(e=>e.defId.startsWith('ek-')&&e.owner===1)).toHaveLength(573);
  expect(reversed.st.players[0].metal).toBeLessThan(1000000);
  const closed=showcase([{isHuman:true,team:0,spawn:1}]);ticks(closed,1);
  expect([...closed.st.ents.values()].filter(e=>e.defId.startsWith('ek-'))).toHaveLength(0);
  const changed=showcase(undefined,true);ticks(changed,1);
  expect((contentRuntime(changed)!.module(ID)!.snapshot() as any).showcase).toBeUndefined();
  expect(changed.st.players[0].metal).toBeLessThan(1000000);
},30000);

test('every named source definition is present, including inherited dont_load modules',()=>{
  expect(manifest.defs.length).toBe(573);
  expect(getDef(id('Ek_modular_bunker_AA_A')).extensions![ID]).toBeDefined();
  for(const entry of inventory)expect(getDef(entry.id).id).toBe(entry.id);
});
test('all definitions initialize, step and serialize without missing references',()=>{
  for(const entry of inventory){
    const d=getDef(entry.id),{g,module}=scene(d.domain==='ship'||d.offshore);
    const e=newEnt(g.st,entry.id,0,1024,1024);e.holdFire=true;
    try {ticks(g,30);JSON.stringify(module.snapshot());}
    catch(error){throw Error(entry.source+': '+error);}
  }
},30000);
test('barracks upgrade pays original price, retains identity and completes on its source clock',()=>{
  const {g}=scene(),e=newEnt(g.st,id('EkInfantryFactoryT1'),0,900,900);ticks(g,1);
  const before=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_1'})).toBe(true);
  expect(g.st.players[0].metal).toBeCloseTo(before-60);
  ticks(g,299);expect(e.defId).toBe(id('EkInfantryFactoryT1'));
  ticks(g,2);expect(e.defId).toBe(id('EkInfantryFactoryT2'));
});

test('native factories enforce research resources, refund cancellation and finish recruitment after a save',()=>{
  const {g,module}=scene(),factory=newEnt(g.st,'airbase2',0,900,900),unit=id('Ek_protos_Smode');ticks(g,1);
  const action='recruit-'+unit;
  expect(getDef('airbase2').produces).not.toContain(unit);
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action})).toBe(false);
  const state:any=module.snapshot();state.balances[0]={experimental:500};module.restore(state);
  const before=g.st.players[0].metal;
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action})).toBe(true);
  expect((module.snapshot() as any).balances[0].experimental).toBe(0);
  expect(g.st.players[0].metal).toBeCloseTo(before-1200);
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action:'cancel'})).toBe(true);
  expect((module.snapshot() as any).balances[0].experimental).toBe(500);
  expect(cmdContentAction(g,ID,{owner:0,ids:[factory.id],action})).toBe(true);ticks(g,10);
  const restored=deserializeGame(serializeGame(g));ticks(g,610);ticks(restored,610);
  expect([...g.st.ents.values()].some(e=>e.defId===unit)).toBe(true);
  expect(serializeGame(restored)).toBe(serializeGame(g));
});

test('research-priced construction waits for resources and charges once across multiple builders',()=>{
  const {g,module}=scene(),site=newEnt(g.st,id('EkLargeArtillery'),0,1000,1000),a=newEnt(g.st,'engineer',0,900,1000),b=newEnt(g.st,'engineer',0,900,1010);
  site.site=true;site.hp=10;a.orders=[{kind:'buildSite',siteId:site.id}];b.orders=[{kind:'buildSite',siteId:site.id}];ticks(g,30);expect(site.hp).toBe(10);
  const state:any=module.snapshot();state.balances[0]={experimental:3000};module.restore(state);ticks(g,60);
  expect(site.hp).toBeGreaterThan(10);expect((module.snapshot() as any).balances[0].experimental).toBe(0);
});

test('Arsenal Bird selects exactly one mode and creates its original attached hangars',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('EkArsenalBird'),0,900,900);e.holdFire=true;ticks(g,2);
  expect(Object.keys((module.snapshot() as any).entities[e.id].children)).toHaveLength(3);
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_press2'})).toBe(true);ticks(g,1);
  const flags=(module.snapshot() as any).entities[e.id].flags;
  expect(flags['11']).toBe(true);expect(flags['10']).toBeUndefined();expect(flags['12']).toBeUndefined();
});

test('medical transport heals allied units and leaves enemies unchanged',()=>{
  const {g}=scene(),medic=newEnt(g.st,id('EkMedicalTransport'),0,900,900),ally=newEnt(g.st,id('EkInfantryGrunt'),0,940,900),enemy=newEnt(g.st,id('EkInfantryGrunt'),1,960,900);
  for(const e of [medic,ally,enemy]){e.holdFire=true;e.holdPos=true;}ally.hp=enemy.hp=10;ticks(g,60);
  expect(ally.hp).toBeGreaterThan(10);expect(enemy.hp).toBe(10);
});

test('suicide action emits its source death weapon and damages nearby enemies',()=>{
  const {g}=scene(),truck=newEnt(g.st,id('EkKamikazeTruck'),0,900,900),target=newEnt(g.st,id('Ek_heavyTankDrake'),1,930,900);
  truck.holdFire=target.holdFire=true;truck.holdPos=target.holdPos=true;ticks(g,2);const before=target.hp;
  expect(cmdContentAction(g,ID,{owner:0,ids:[truck.id],action:'action_explode'})).toBe(true);ticks(g,30);
  expect(truck.dead||!g.st.ents.has(truck.id)).toBe(true);expect(target.hp).toBeLessThan(before);
});

test('projectile cascades remain active and deterministic across a mid-flight save',()=>{
  const {g,module}=scene(),a=newEnt(g.st,id('Ek_Cordelia_drone'),0,900,900),b=newEnt(g.st,id('Ek_heavyTankDrake'),1,1080,900);
  a.holdPos=true;b.holdFire=true;b.holdPos=true;a.angle=a.turretAngle=0;
  ticks(g,1);const loaded:any=module.snapshot();loaded.entities[a.id].stocks.ammo=110;module.restore(loaded);
  for(let i=0;i<300&&!g.st.projs.some(p=>p.src===a.id);i++)ticks(g,1);
  expect(g.st.projs.some(p=>p.src===a.id)).toBe(true);
  const restored=deserializeGame(serializeGame(g));let cascade=false;
  for(let i=0;i<90;i++){ticks(g,1);ticks(restored,1);cascade ||=g.st.projs.some(p=>p.gun?.includes('/cascade@'));}
  expect(cascade).toBe(true);expect(serializeGame(restored)).toBe(serializeGame(g));
});

test('private balances and action queues are excluded from another player view',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('EkInfantryFactoryT1'),0,900,900);ticks(g,1);
  cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_1'});
  const snapshot:any=module.snapshot({player:1,privateEntity:()=>false,visibleEntities:new Set([e.id]),visibleProjectiles:new Set()});
  expect(snapshot.entities).toEqual({});expect(snapshot.balances).toEqual({});expect(snapshot.visuals[e.id]).toBeDefined();
});

test('queued bomber salvos stop when their source ammunition guard becomes false',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('Ek_BlackBear'),0,900,900);e.holdFire=true;ticks(g,1);
  const saved:any=module.snapshot(),s=saved.entities[e.id];s.stocks.ammo=2;s.stocks.energy=0;
  s.job={action:'hiddenAction_dropBombs',origin:e.defId,remaining:0,total:.2};module.restore(saved);ticks(g,90);
  const result=(module.snapshot() as any).entities[e.id];
  expect(result.stocks.ammo).toBe(0);expect(result.job).toBeUndefined();expect(result.queue).toHaveLength(0);
});

test('EMP suppresses movement orders and expires on the source trigger clock',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('Ek_heavyTankDrake'),0,900,900);e.holdFire=true;ticks(g,1);
  const saved:any=module.snapshot();saved.entities[e.id].stocks.emp=5;module.restore(saved);
  e.orders=[{kind:'move',x:1500,y:900}];ticks(g,60);
  expect((module.snapshot() as any).entities[e.id].empActive).toBe(true);expect(e.orders).toHaveLength(0);
  ticks(g,90);expect((module.snapshot() as any).entities[e.id].empActive).toBe(false);
});
test('foreign ownership and insufficient funds cannot queue an action; cancellation refunds once',()=>{
  const {g}=scene(),e=newEnt(g.st,id('EkInfantryFactoryT1'),0,900,900);ticks(g,1);
  expect(cmdContentAction(g,ID,{owner:1,ids:[e.id],action:'action_1'})).toBe(false);
  g.st.players[0].metal=59;expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_1'})).toBe(false);
  g.st.players[0].metal=100;expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_1'})).toBe(true);
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'cancel'})).toBe(true);
  expect(g.st.players[0].metal).toBe(100);
  expect(cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'cancel'})).toBe(false);
});
test('a save during an action resumes deterministically',()=>{
  const {g}=scene(),e=newEnt(g.st,id('EkInfantryFactoryT1'),0,900,900);ticks(g,1);
  cmdContentAction(g,ID,{owner:0,ids:[e.id],action:'action_1'});ticks(g,100);
  const restored=deserializeGame(serializeGame(g));
  ticks(g,220);ticks(restored,220);
  expect(serializeGame(restored)).toBe(serializeGame(g));
});
test('source production links train infantry from the original barracks',()=>{
  const {g}=scene(),e=newEnt(g.st,id('EkInfantryFactoryT1'),0,900,900);
  expect(getDef(e.defId).produces).toContain(id('EkInfantryGrunt'));
  expect(cmdProduce(g,e.id,id('EkInfantryGrunt'))).toBe(true);
  ticks(g,Math.ceil(getDef(id('EkInfantryGrunt')).buildTime*30)+10);
  expect([...g.st.ents.values()].some(e=>e.defId===id('EkInfantryGrunt'))).toBe(true);
});
test('independent source weapons fire and damage an enemy',()=>{
  const {g}=scene(),a=newEnt(g.st,id('Ek_heavyTankDrake'),0,900,900),b=newEnt(g.st,id('Ek_heavyTankDrake'),1,1060,900);
  a.holdPos=true;a.angle=a.turretAngle=0;b.holdFire=true;b.holdPos=true;
  const hp=b.hp;let shot=false;
  for(let i=0;i<240;i++){g.step();shot ||=g.st.projs.some(p=>p.src===a.id);if(b.dead||b.hp<hp)break;}
  expect(shot).toBe(true);expect(b.dead||b.hp<hp).toBe(true);
});

// Armed definitions that do not fire in a plain duel off a deep-water coast, as in RW: drones armed
// only by their carrier's ammunition, strike helpers that expire, launchers
// the AI fires and players work by action, rounds made by an action first,
// a form that must land or deploy, and mines-only sweepers.
const DUEL_EXEMPT:Record<string,string>={
  'Ek_B1E-B':'carrier ammunition','Ek_B1E-B-UP':'carrier ammunition','Ek_B1E-F':'carrier ammunition','Ek_B1E-F-UP':'carrier ammunition',
  'Ek_B1E-S':'carrier ammunition','Ek_B1E-S-UP':'carrier ammunition','Ek_Cordelia_drone':'carrier ammunition','Ek_Ophelia_drone':'carrier ammunition',
  'Ek_NMC_DRONES':'carrier ammunition','Ek_NMC_RZ_DRONES':'carrier ammunition','Ek_TWH_DRONES':'carrier ammunition',
  EkTCAIDbombdown:'expiring strike helper',EkTCAIDbombup:'expiring strike helper',EkTCAIDairtoair:'expiring strike helper',EkTCAIDbuster:'expiring strike helper',
  EkTCAIDcarpet:'expiring strike helper',EkTCAIDcarpet2:'expiring strike helper',EkTCAIDnapalm:'expiring strike helper',
  EkExperimentalWormTorpedo:'expiring helper',EkMultiLaserChain:'expiring helper',EkHunterDrone:'kamikaze helper',
  EkWedgetail_new:'AI-only guns',EkCommsTruck:'AI-only guns',EkLaunchpad:'AI-only guns',EkCruiseMissileSilo:'AI-only guns',EkLargeNukeLauncher:'AI-only guns',
  EkStranglerDeploy:'missiles built by action',experimentalDropship:'fires on land only',EkMinesweeper:'mines only',
};
const DUEL_TARGET:Record<string,string>={ground:'mbt',air:'heli',ship:'destroyer',sub:'sub'};
function duel(defId:string,cat:string,ordered:boolean,seconds:number){
  const base=arena({mode:'campaign',fog:false,dayNight:false,metal:10000000,popCap:500});
  const g=createContentGame(base.st.cfg,arenaMap({w:128,h:128,fill:Terrain.Grass,paint:columns(64,128,Terrain.DeepWater)}),true);
  for(const p of g.st.players)p.isHuman=true;
  const d=getDef(defId),hurts=(x:any)=>!x.manual&&(x.direct>0||x.area>0||x.spawn||x.cascade);
  const guns=d.extensions![ID].guns.filter((x:any)=>hurts(x)&&x.weapon.targets.includes(cat)&&x.range>=.5);
  const near=guns.reduce((a:any,b:any)=>b.range<a.range?b:a),half=d.kind==='building'?Math.max(d.fw!,d.fh!)/2:0;
  // a hull, a swimmer or an aircraft hunting a submarine works from the water
  const water=d.kind==='building'?!!d.offshore:d.domain==='ship'||cat==='sub'&&(d.domain==='amphibious'||d.domain==='air');
  const sx=(water?64.5+half:63.5-half)*32,sy=2048,D=Math.max((near.minRange??0)+.6,Math.min(near.range*.6,near.range-.5))*32;
  const wet=cat==='ship'||cat==='sub';let tx=sx,ty=sy+D;
  if(cat!=='air'&&wet!==water){tx=(wet?64.5:63.5)*32;ty=sy+Math.sqrt(Math.max(0,D*D-(tx-sx)**2));}
  const e=newEnt(g.st,defId,0,sx,sy,d.kind==='building'?0:-Math.PI/2),t=newEnt(g.st,DUEL_TARGET[cat],1,tx,ty);
  if(d.kind==='unit')e.holdPos=!ordered;t.holdFire=true;t.holdPos=true;
  const hp=t.hp;
  for(let i=0;i<seconds*30;i++){
    if(ordered&&i===30)cmdAttack(g,[e.id],t.id);
    g.step();
    if(t.dead||t.hp<hp)return true;
    if(e.dead||!g.st.ents.has(e.id))return false;
  }
  return false;
}
test('every armed definition damages each kind of target its guns name',()=>{
  const failed:string[]=[];
  for(const entry of inventory){
    const d=getDef(entry.id),guns=(d.extensions?.[ID]?.guns??[]).filter((x:any)=>!x.manual&&(x.direct>0||x.area>0||x.spawn||x.cascade)&&x.range>=.5);
    if(!guns.length||DUEL_EXEMPT[entry.rwName])continue;
    for(const cat of new Set<string>(guns.flatMap((x:any)=>x.weapon.targets)))
      if(!duel(entry.id,cat,false,12)&&!(d.kind==='unit'&&duel(entry.id,cat,true,25)))failed.push(entry.rwName+' vs '+cat);
  }
  expect(failed).toEqual([]);
},300000);

test('RW bombers fly as fixed wings; every other aircraft hovers; only blades RW spins are rotors',()=>{
  expect(getDef(id('EkHammer')).hovers).toBeUndefined();
  expect(getDef(id('EkInterceptor')).hovers).toBeUndefined();
  expect(getDef(id('EkBuzzard')).hovers).toBe(true);
  // an airship hovers on no rotor; the Condor's two blades counter-rotate in its own art; a dish stays an arm
  expect(getDef(id('Ek_Zeppelin')).rotors).toEqual([]);
  expect(getDef(id('EkKestrel')).rotors).toEqual([]);
  const condor=getDef(id('EkCondor')).rotors!;
  expect(condor).toHaveLength(2);expect(Math.sign(condor[0].spin!)).toBe(-Math.sign(condor[1].spin!));
  expect(condor.every(r=>r.sprite?.startsWith('dec.'))).toBe(true);
  expect(getDef(id('EkCarrierLarge')).rotors).toHaveLength(4);
  expect(getDef(id('EkCarrierLarge')).extensions![ID].mounts.filter((m:any)=>m.id.startsWith('arm_')).length).toBe(3);
});
test('a building stands facing up: its turrets keep the source layout and train from it',()=>{
  const {g,module}=scene(),e=newEnt(g.st,id('EkLargeArtillery'),0,1024,1024);ticks(g,2);
  const barrels=(module.render!(e) as any).mounts.filter((m:any)=>m.sprite);
  // the cannons stand forward of the base, above it on the screen, and rest pointing up
  expect(barrels.some((m:any)=>m.y<e.y-10)).toBe(true);
  for(const m of barrels)expect(Math.abs(m.angle+Math.PI/2)).toBeLessThan(.01);
});
test('turret art takes the turret scale, not the hull image scale',()=>{
  const c=getDef(id('EkUnicornSmall')).extensions![ID],sheet=manifest.sprites.find((s:any)=>s.key===c.mounts.find((m:any)=>m.id==='2').sprite);
  // unicorn_cocpit.png is 19 px wide; the hull's imageScale is 1.2 and the turrets have none
  expect(sheet.fw).toBe(Math.round(19*.75/1.5625));
});
test('walls fill the footprint RW gives them',()=>{
  for(const name of ['EkBrickwall1X','EkBrickwall2Y']){
    const d=getDef(id(name)),sheet=manifest.sprites.find((s:any)=>s.key===d.sprite);
    expect(sheet.fitFootprint).toBe(false);
    expect(Math.max(sheet.fw/(d.fw!*32),sheet.fh/(d.fh!*32))).toBeLessThan(1.3);
  }
});
test('RW pure-green faction paint becomes the game\'s team colour',()=>{
  const body=(name:string)=>manifest.sprites.find((s:any)=>s.key===getDef(id(name)).sprite);
  expect(body('Ek_heavyTankDrake').teams).toBe(true);
  expect(body('EkBrickwall1X').teams).toBe(true);
});

test('the player aims the guns: force fire on a spot, the trigger under the helm, an attack on an ally',()=>{
  // shots from the tank that land near the point it was told to shell
  const shells=(g:any,e:any,x:number,y:number)=>g.st.projs.filter((p:any)=>p.src===e.id&&Math.hypot(p.tx-x,p.ty-y)<40).length;
  {
    const {g}=scene(),e=newEnt(g.st,id('Ek_heavyTankDrake'),0,900,900,-Math.PI/2);
    cmdAttackGround(g,[e.id],1000,900);let seen=0;
    for(let i=0;i<240&&!seen;i++){g.step();seen=shells(g,e,1000,900);}
    expect(seen).toBeGreaterThan(0);
  }
  {
    const {g}=scene(),e=newEnt(g.st,id('Ek_heavyTankDrake'),0,900,900,-Math.PI/2);
    cmdHelm(g,[e.id],{dx:0,dy:0});cmdFire(g,[e.id],{x:900,y:1000});let seen=0;
    for(let i=0;i<240&&!seen;i++){g.step();seen=shells(g,e,900,1000);}
    expect(seen).toBeGreaterThan(0);
  }
  {
    const {g}=scene(),e=newEnt(g.st,id('Ek_heavyTankDrake'),0,900,900,-Math.PI/2),ally=newEnt(g.st,'mbt',0,1000,900);
    ally.holdFire=true;ally.holdPos=true;const hp=ally.hp;
    ticks(g,60);expect(ally.hp).toBe(hp); // never on its own
    cmdAttack(g,[e.id],ally.id);
    for(let i=0;i<300&&ally.hp===hp;i++)g.step();
    expect(ally.hp).toBeLessThan(hp);
  }
});
