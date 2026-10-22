import {beforeAll,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {prepareContentSchema} from '../../../steel-tide-game/game/core/src/game/contentSchema';
import {parseDefinitionPack} from '../../../steel-tide-game/game/core/src/game/contentDefs';
import {applyContent} from '../../../steel-tide-game/game/core/src/game/content';
import {prepareContentCapabilities} from '../../../steel-tide-game/game/core/src/game/contentCapabilities';
import {contentRuntime,createContentGame} from '../../../steel-tide-game/game/core/src/game/contentGame';
import {getDef} from '../../../steel-tide-game/game/core/src/game/defs';
import {newEnt} from '../../../steel-tide-game/game/core/src/game/state';
import {cmdContentAction} from '../../../steel-tide-game/game/core/src/game/orders';
import {applyDamage,canEngage} from '../../../steel-tide-game/game/core/src/game/combat';
import {serializeGame,deserializeGame} from '../../../steel-tide-game/game/core/src/game/save';
import {arena,arenaMap} from '../../../steel-tide-game/game/core/server/testkit/game';

const ID='fg-rusted-league.source-v1',MINE='fg-rusted-league-widow-mine',LAYER='fg-rusted-league-minelayer';
beforeAll(async()=>{
 const packs=[];
 for(const file of ['mod.json','../adolence/mod.json']){
  const raw=JSON.parse(readFileSync(import.meta.dir+'/'+file,'utf8'));
  await prepareContentSchema(raw,true);const p=parseDefinitionPack(raw);
  if(!p.ok)throw Error(JSON.stringify(p.errors));packs.push(p.pack);
 }
 const applied=applyContent(packs);if(applied.rejected.length)throw Error(JSON.stringify(applied.rejected));
 await prepareContentCapabilities(packs);
});
function scene(){
 const base=arena({mode:'campaign',fog:false,dayNight:false,metal:10000,popCap:500});
 const g=createContentGame(base.st.cfg,arenaMap({w:128,h:128}),true);
 const layer=newEnt(g.st,LAYER,0,700,700);layer.holdFire=true;layer.holdPos=true;
 return {g,layer,module:contentRuntime(g)!.module(ID)!};
}
function ticks(g:any,n:number){for(let i=0;i<n;i++)g.step();}
function deploy(g:any,e:any,owner=0){return cmdContentAction(g,ID,{owner,ids:[e.id],action:'lay-mine'});}
function mines(g:any){return [...g.st.ents.values()].filter((e:any)=>e.defId===MINE&&!e.dead) as any[];}
function enemy(g:any,x=746,y=700,id='mbt',owner=1){const e=newEnt(g.st,id,owner,x,y);e.holdFire=true;e.holdPos=true;return e;}
function shots(g:any){return g.st.projs.filter((p:any)=>p.gun===MINE+'/seeker');}

test('paid deployment is owner-only, local, passable, and removes the automatic placement gun',()=>{
 const {g,layer,module}=scene();const metal=g.st.players[0].metal,blocked=[...g.st.blocked];
 expect(getDef(LAYER).weapons.map(w=>w.id)).toEqual(['w1']);
 expect(deploy(g,layer,1)).toBe(false);expect(mines(g)).toHaveLength(0);
 expect(deploy(g,layer)).toBe(true);const mine=mines(g)[0];
 expect([mine.x,mine.y,mine.owner]).toEqual([700,700,0]);
 expect([...g.st.blocked]).toEqual(blocked);expect(getDef(MINE).pop).toBe(0);
 expect(g.st.players[0].metal).toBe(metal-80);expect(g.st.players[0].stats.metalSpent).toBe(80);
 expect((module.snapshot() as any).entities[layer.id].energy).toBe(2);
 expect(module.allowOrder!(mine,{kind:'move',x:800,y:700})).toBe(false);
 const attacker=enemy(g);expect(canEngage(g.st,attacker,getDef(attacker.defId),mine)).toBe(false);
});

test('three charges, insufficient funds, duplicate IDs and full recharge gate deployment',()=>{
 const {g,layer,module}=scene();
 g.st.players[0].metal=79;expect(deploy(g,layer)).toBe(false);expect(mines(g)).toHaveLength(0);
 g.st.players[0].metal=10000;
 expect(cmdContentAction(g,ID,{owner:0,ids:[layer.id,layer.id],action:'lay-mine'})).toBe(false);
 for(let i=0;i<3;i++)expect(deploy(g,layer)).toBe(true);
 expect(deploy(g,layer)).toBe(false);expect(mines(g)).toHaveLength(3);
 expect(module.actions!(layer)[0].enabled).toBe(false);
 ticks(g,2999);expect(deploy(g,layer)).toBe(false);
 ticks(g,2);expect(module.actions!(layer)[0].enabled).toBe(true);expect(deploy(g,layer)).toBe(true);
});

test('cargo, unfinished, EMP-disabled and destroyed minelayers cannot deploy',()=>{
 for(const field of ['inside','site','emp','dead'] as const){
  const {g,layer}=scene();(layer as any)[field]=field==='site'?{progress:0}:true;
  expect(deploy(g,layer)).toBe(false);expect(mines(g)).toHaveLength(0);
 }
});

test('mines wait for enemies, ignore aircraft and allies, and survive their minelayer',()=>{
 const {g,layer}=scene();deploy(g,layer);const mine=mines(g)[0];
 enemy(g,730,700,'mbt',0);enemy(g,725,700,'gunship');
 applyDamage(g.st,layer,100000,undefined,1,0,'test');ticks(g,120);
 expect(mine.dead).not.toBe(true);expect(shots(g)).toHaveLength(0);
 const target=enemy(g,730,700);ticks(g,1);
 expect(mine.dead).toBe(true);expect(shots(g)).toHaveLength(1);
 expect(shots(g)[0].targetId).toBe(target.id);
});

test('a single seeker follows its target and detonates with direct plus splash damage',()=>{
 const {g,layer}=scene();deploy(g,layer);
 const target=enemy(g),other=enemy(g,780,730),ally=enemy(g,790,700,'mbt',0),air=enemy(g,770,710,'gunship');
 const before=[target.hp,other.hp,ally.hp,air.hp];ticks(g,1);
 expect(shots(g)).toHaveLength(1);expect(target.hp).toBe(before[0]);
 target.x=target.prevX=760;target.y=target.prevY=740;
 ticks(g,1);expect(shots(g)[0].ty).toBe(740);
 for(let i=0;i<150&&shots(g).length;i++)g.step();
 expect(shots(g)).toHaveLength(0);expect(mines(g)).toHaveLength(0);
 expect(g.st.effects.some(e=>e.key==='fx.expl.l')).toBe(true);
 expect(target.hp).toBeLessThan(before[0]);expect(other.hp).toBeLessThan(before[1]);
 expect(ally.hp).toBe(before[2]);expect(air.hp).toBe(before[3]);
 const hp=target.hp;ticks(g,90);expect(target.hp).toBe(hp);
});

test('a seeker retargets a nearby enemy when its first target dies',()=>{
 const {g,layer}=scene();deploy(g,layer);const first=enemy(g),next=enemy(g,755,730);
 ticks(g,1);expect(shots(g)[0].targetId).toBe(first.id);
 applyDamage(g.st,first,100000,undefined,0,layer.id,'test');ticks(g,1);
 expect(shots(g)[0].targetId).toBe(next.id);const hp=next.hp;
 ticks(g,90);expect(next.hp).toBeLessThan(hp);expect(shots(g)).toHaveLength(0);
});

for(const id of ['destroyer','sub'])test('mine targets '+id+' through ordinary visibility rules',()=>{
 const {g,layer}=scene();deploy(g,layer);
 const target=enemy(g,700+getDef(id).radius+45,700,id);
 if(id==='sub'){
  ticks(g,1);expect(mines(g)).toHaveLength(1);expect(shots(g)).toHaveLength(0);
  enemy(g,700,600,'destroyer',0); // allied sonar supplies the contact
 }
 ticks(g,1);expect(shots(g)).toHaveLength(1);expect(shots(g)[0].targetId).toBe(target.id);
});

test('clearing an idle mine with splash does not launch its payload',()=>{
 const {g,layer}=scene();deploy(g,layer);const mine=mines(g)[0];
 g.st.projs.push({x:mine.x,y:mine.y,px:mine.x,py:mine.y,tx:mine.x,ty:mine.y,angle:0,speed:0,
  kind:'shell',homing:false,targetId:0,dmg:100,splash:40,owner:1,src:0,gun:LAYER+'/w1',team:1,
  force:false,ttl:1,hitsGround:true,hitsAir:false,hitsSub:false});ticks(g,2);
 expect(mines(g)).toHaveLength(0);expect(shots(g)).toHaveLength(0);
});

test('placement creates no blast, flash, sound, scorch or damage before the mine triggers',()=>{
 const {g,layer}=scene();const target=enemy(g,720,700),ally=enemy(g,700,725,'mbt',0);
 ticks(g,1);const hp=target.hp,own=ally.hp,vehicle=layer.hp;
 const effects=[...g.st.effects],events=[...g.st.events],decals=[...g.st.decals],projectiles=[...g.st.projs];
 expect(deploy(g,layer)).toBe(true);expect(target.hp).toBe(hp);
 expect(ally.hp).toBe(own);expect(layer.hp).toBe(vehicle);expect(mines(g)).toHaveLength(1);
 expect(g.st.effects).toEqual(effects);expect(g.st.events).toEqual(events);
 expect(g.st.decals).toEqual(decals);expect(g.st.projs).toEqual(projectiles);
});

test('idle mines, travelling seekers and recharge survive deterministic save restoration',()=>{
 const {g,layer,module}=scene();deploy(g,layer);
 let restored=deserializeGame(serializeGame(g));expect(mines(restored)).toHaveLength(1);
 enemy(g);ticks(g,3);expect(shots(g)).toHaveLength(1);
 deploy(g,layer);deploy(g,layer);expect((module.snapshot() as any).entities[layer.id].recharging).toBe(true);
 restored=deserializeGame(serializeGame(g));
 for(let i=0;i<150;i++){g.step();restored.step();}
 expect(serializeGame(restored)).toBe(serializeGame(g));
 expect(module.inspect!(layer,false)).toEqual([]);
 const before=module.snapshot(),bad:any=structuredClone(before);bad.entities[layer.id].energy=NaN;
 expect(()=>module.restore(bad)).toThrow();expect(module.snapshot()).toEqual(before);
});
