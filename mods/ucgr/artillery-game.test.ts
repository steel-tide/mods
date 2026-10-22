import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide/game/core/src/game/state';
import { cmdContentAction, cmdMove } from '../../../steel-tide/game/core/src/game/orders';
import { arenaMap, run } from '../../../steel-tide/game/core/server/testkit/game';
import { serializeGame, deserializeGame } from '../../../steel-tide/game/core/src/game/save';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';
const raw=readFileSync(new URL('mod.json',import.meta.url),'utf8');
await prepareContentSchema(raw,true);const parsed=parseMod(raw);
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
await prepareContentCapabilities([parsed.mod]);let games:Game[]=[];
beforeEach(()=>{expect(applyMods([parsed.mod]).rejected).toEqual([]);});
afterEach(()=>{for(const g of games)disposeContentGame(g);games=[];applyMods([]);});
function arena(){const g=createContentGame({mode:'sandbox',mapKey:'arena',seed:51,fog:false,popCap:100,startMetal:1000,players:[{isHuman:true,team:0},{isHuman:true,team:1}]},arenaMap(),true);games.push(g);return g;}
const state=(g:Game)=>contentRuntime(g)!.module('articulation-v1')!.snapshot() as any[];
function countShots(g:Game,id:number,weapon:string){const module=contentRuntime(g)!.module('components-v1')!,base=module.onShot!.bind(module),times:number[]=[];
  module.onShot=(e,d,w,p)=>{base(e,d,w,p);if(e.id===id&&w.id===weapon)times.push(g.st.time);};return times;}

test('2S23 forced mortar action retains five-shot timing, movement lock and save continuation',()=>{
  const g=arena(),e=newEnt(g.st,'usgr-re-2s23',0,400,400);e.holdFire=true;e.angle=0;
  const c=getDef(e.defId).extensions!['articulation-v1'] as any,b=c.barrages[0];
  const shots=countShots(g,e.id,b.weapon),x=400+getDef(e.defId).weapons.find(w=>w.id===b.weapon)!.range*32*.7;
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[e.id],action:'barrage',x,y:400})).toBe(true);
  cmdMove(g,[e.id],450,400);run(g,1.9);expect(shots).toHaveLength(0);expect(e.x).toBeCloseTo(400);
  run(g,6);expect(shots.length).toBeGreaterThan(0);
  const saved=deserializeGame(serializeGame(g));games.push(saved);const continued=countShots(saved,e.id,b.weapon),already=shots.length;
  run(g,28);run(saved,28);
  expect(shots).toHaveLength(5);expect(continued).toHaveLength(5-already);
  for(let i=1;i<shots.length;i++)expect(shots[i]-shots[i-1]).toBeCloseTo(6,1);
  expect(state(saved)).toEqual(state(g));
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[e.id],action:'barrage',x,y:400})).toBe(false);
});

test('2S35 deployment keeps identity and source manual stock is paid once per shell',()=>{
  const g=arena(),e=newEnt(g.st,'usgr-re-2s35-f612c8e7',0,400,400),id=e.id;
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'deploy:spades'})).toBe(true);
  run(g,7.9);expect(e.defId).toBe('usgr-re-2s35-f612c8e7');run(g,.2);expect(e.defId).toBe('usgr-re-2s35-343a4d32');expect(e.id).toBe(id);
  const b=(getDef(e.defId).extensions!['articulation-v1'] as any).barrages[0],shots=countShots(g,id,b.weapon);
  const stocks=()=>((contentRuntime(g)!.module('logistics-v1')!.snapshot() as any)[id]?.stocks??{});
  const before=stocks()[b.stock];expect(before).toBeGreaterThan(5);
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:900,y:400})).toBe(true);
  run(g,30);expect(shots).toHaveLength(6);expect(stocks()[b.stock]).toBe(before-6);
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'deploy:spades'})).toBe(true);run(g,2.1);expect(e.defId).toBe('usgr-re-2s35-f612c8e7');
  const saved=deserializeGame(serializeGame(g));games.push(saved);expect(state(saved)).toEqual(state(g));
  expect(cmdContentAction(saved,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:900,y:400})).toBe(false);
});

test('TOS-1A deploys by tag, fires the six-rocket barrage only when deployed and locks below six rockets',()=>{
  const g=arena(),e=newEnt(g.st,'usgr-re-tos1a',0,400,400),id=e.id;e.angle=0;
  const mobile=e.defId,deployedId=mobile+'-deployed';
  const b=(getDef(deployedId).extensions!['articulation-v1'] as any).barrages[0],shots=countShots(g,id,b.weapon);
  const stocks=()=>((contentRuntime(g)!.module('logistics-v1')!.snapshot() as any)[id]?.stocks??{});
  // Travelling: no barrage; the barrel never fires on its own.
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:700,y:400})).toBe(false);
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'deploy:deploy'})).toBe(true);
  run(g,.9);expect(e.defId).toBe(mobile);run(g,.2);expect(e.defId).toBe(deployedId);expect(e.id).toBe(id);
  // Deployed: immobile, and a player's move is discarded (source clearway).
  const x0=e.x;cmdMove(g,[id],600,400);run(g,1/30);expect(e.orders.some(o=>o.kind==='move')).toBe(false);run(g,1);expect(e.x).toBeCloseTo(x0);
  expect(stocks()[b.stock]).toBe(24);
  const foe=newEnt(g.st,'engineer',1,700,400);foe.holdFire=true;foe.holdPos=true;const hp=foe.hp;
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:700,y:400})).toBe(true);
  run(g,.4);expect(shots).toHaveLength(0);run(g,3);expect(shots).toHaveLength(6);
  run(g,4);expect(foe.dead||foe.hp<hp).toBe(true);
  for(let i=1;i<shots.length;i++)expect(shots[i]-shots[i-1]).toBeCloseTo(.5,1);
  expect(stocks()[b.stock]).toBe(18);
  // 20-second cooldown from the first rocket.
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:700,y:400})).toBe(false);
  run(g,13.2);expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:700,y:400})).toBe(true);
  run(g,3.5);expect(stocks()[b.stock]).toBe(12);
  // Locked below six rockets.
  const logistics=contentRuntime(g)!.module('logistics-v1')!,snap:any=structuredClone(logistics.snapshot());snap[id].stocks[b.stock]=5;logistics.restore!(snap);
  run(g,20);expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'barrage',x:700,y:400})).toBe(false);
  const saved=deserializeGame(serializeGame(g));games.push(saved);expect(state(saved)).toEqual(state(g));
  expect(cmdContentAction(g,'articulation-v1',{owner:0,ids:[id],action:'deploy:pack-up'})).toBe(true);
  run(g,1.1);expect(e.defId).toBe(mobile);cmdMove(g,[id],600,400);run(g,2);expect(e.x).toBeGreaterThan(x0+5);
});
