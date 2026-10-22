import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { newEnt, type Ent } from '../../../steel-tide/game/core/src/game/state';
import { cmdBoard, cmdContentAction, cmdMove } from '../../../steel-tide/game/core/src/game/orders';
import { kill } from '../../../steel-tide/game/core/src/game/combat';
import { arenaMap, run, stepUntil } from '../../../steel-tide/game/core/server/testkit/game';
import { serializeGame, deserializeGame } from '../../../steel-tide/game/core/src/game/save';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';

const raw = readFileSync(new URL('mod.json', import.meta.url), 'utf8');
await prepareContentSchema(raw, true);
const parsed = parseMod(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
await prepareContentCapabilities([parsed.mod]);
const ID = 'usgr-re.squads-v1';
let games: Game[] = [];
beforeEach(() => { expect(applyMods([parsed.mod]).rejected).toEqual([]); });
afterEach(() => { for (const g of games) disposeContentGame(g); games = []; applyMods([]); });
function arena() {
  const g = createContentGame({ mode:'sandbox', mapKey:'arena', seed:36, fog:false, popCap:100, startMetal:1000,
    players:[{isHuman:true,team:0},{isHuman:true,team:1}] }, arenaMap(), true);
  games.push(g); return g;
}
function module(g:Game) { return contentRuntime(g)!.module(ID)!; }
function state(g:Game):any { return module(g).snapshot(); }
function parent(g:Game,e:Ent):Ent { return g.st.ents.get(state(g).soldiers.find(([id]:number[])=>id===e.id)[1].parent)!; }
function action(g:Game,e:Ent,name:string) { return cmdContentAction(g,ID,{owner:e.owner,ids:[e.id],action:name}); }
function squad(g:Game,count=5,def='usgr-re-plainf',x=400) {
  const members=Array.from({length:count},(_,i)=>newEnt(g.st,def,0,x+i*2,400));
  run(g,1/30); return {members,p:parent(g,members[0])};
}

test('original five/three-person groups retain actual soldier IDs, damage and saved memberships',()=>{
  const g=arena(),five=squad(g),three=squad(g,3,'usgr-re-russso',700);
  expect(state(g).groups.map(([,s]:any[])=>s.members.length).sort()).toEqual([3,5]);
  expect(g.st.ents.size).toBe(10);
  const wounded=five.members[0];wounded.hp-=5;
  const saved=deserializeGame(serializeGame(g));games.push(saved);
  expect(state(saved)).toEqual(state(g));
  expect(saved.st.ents.get(wounded.id)!.hp).toBe(wounded.hp);
  const x=five.p.x;cmdMove(g,[five.p.id],500,400);cmdMove(saved,[five.p.id],500,400);
  run(g,3);run(saved,3);
  expect(five.p.x).toBeGreaterThan(x+20);
  expect(state(saved)).toEqual(state(g));
  for(const e of five.members)expect(Math.hypot(e.x-five.p.x,e.y-five.p.y)).toBeLessThan(12);
  expect(three.p.id).not.toBe(five.p.id);
});

test('digging and exiting preserve members with original twenty/one second transitions',()=>{
  const g=arena(),{members,p}=squad(g),mobile=p.defId;
  expect(action(g,p,'trench')).toBe(true);run(g,19.8);expect(p.defId).toBe(mobile);
  const saved=deserializeGame(serializeGame(g));games.push(saved);run(g,.3);run(saved,.3);
  expect(p.defId).not.toBe(mobile);expect(getDef(p.defId).transportCap).toBe(5);
  expect(state(saved)).toEqual(state(g));
  expect(action(g,p,'trench')).toBe(true);run(g,.8);expect(p.defId).not.toBe(mobile);
  run(g,.3);expect(p.defId).toBe(mobile);
  expect(state(g).groups[0][1].members).toEqual(members.map(e=>e.id));
});

test('enter-trench walks real detached soldiers to the existing trench before attaching',()=>{
  const g=arena(),a=squad(g,3),b=squad(g,2,'usgr-re-plainf',470);
  // Prevent the source incomplete-group merge while the second group digs.
  expect(action(g,b.p,'trench')).toBe(true);run(g,20.1);
  const trench=b.p,traveler=a.members[0],start={x:traveler.x,y:traveler.y};
  expect(action(g,a.p,'enter-trench')).toBe(true);
  expect(traveler.orders[0]?.kind).toBe('board');
  expect(traveler.x).toBe(start.x);expect(traveler.y).toBe(start.y);
  expect(state(g).soldiers.find(([id]:number[])=>id===traveler.id)[1].parent).toBe(0);
  expect(stepUntil(g,()=>state(g).soldiers.find(([id]:number[])=>id===traveler.id)?.[1].parent===trench.id,30*12)).toBeGreaterThan(0);
  expect(traveler.inside).toBeFalsy();expect(traveler.dead).toBeFalsy();
});

test('casualties remove membership and boarding detaches without manufacturing replacement infantry',()=>{
  const g=arena(),{members,p}=squad(g),carrier=newEnt(g.st,'usgr-re-m2a3',0,440,400);
  kill(g.st,members[0]);run(g,1/30);expect(state(g).groups[0][1].members).toHaveLength(4);
  cmdBoard(g,[members[1].id],carrier.id);
  expect(stepUntil(g,()=>members[1].inside===carrier.id,30*15)).toBeGreaterThan(0);
  expect(state(g).groups.find(([id]:number[])=>id===p.id)[1].members).not.toContain(members[1].id);
  expect([...g.st.ents.values()].filter(e=>e.defId==='usgr-re-plainf'&&!e.dead)).toHaveLength(4);
});

test('public squad frames reveal attachment relationships but keep morale and settings private',()=>{
  const g=arena(),{members,p}=squad(g);
  const publicState=module(g).snapshot({player:1,visibleEntities:new Set([p.id,...members.map(e=>e.id)]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any;
  expect(publicState.groups).toEqual([]);expect(publicState.disabled).toEqual([]);
  expect(publicState.soldiers).toHaveLength(5);
  for(const [,s] of publicState.soldiers)expect(Object.keys(s)).toEqual(['parent']);
});
