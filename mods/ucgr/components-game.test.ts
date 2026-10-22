/** Real source manifest acceptance: no synthetic reserve seat or hull payload. */
import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyContent } from '../../../steel-tide/game/core/src/game/content';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { parseDefinitionPack } from '../../../steel-tide/game/core/src/game/contentDefs';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { buildContentSnapshot, deserializeSnapshot } from '../../../steel-tide/game/core/src/game/save';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { cmdContentAction } from '../../../steel-tide/game/core/src/game/orders';
import { newEnt, type Ent, type Proj } from '../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';
import { ComponentsModule } from './extensions/combined-arms-v1/src/components';
import { LogisticsModule } from './extensions/combined-arms-v1/src/logistics';
import { arena } from '../../../steel-tide/game/core/server/testkit/game';

const games: Game[] = [];
afterEach(() => { for (const g of games.splice(0)) disposeContentGame(g); applyContent([]); });
async function setup(seed=3) {
  const raw=JSON.parse(readFileSync(new URL('./mod.json',import.meta.url),'utf8'));
  await prepareContentSchema(raw,true); const parsed=parseDefinitionPack(raw);
  if(!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]); expect(applyContent([parsed.pack]).rejected).toEqual([]);
  const base=arena({mode:'campaign',fog:false,dayNight:false}); base.st.cfg.seed=seed;
  const game=createContentGame(base.st.cfg,base.st.map,true); games.push(game);
  const c=contentRuntime(game)!.module('components-v1') as ComponentsModule;
  const l=contentRuntime(game)!.module('logistics-v1') as LogisticsModule;
  const tank=newEnt(game.st,'usgr-re-t90m',1,500,500), shooter=newEnt(game.st,'usgr-re-t90m',0,650,500);
  for(const e of [tank,shooter]) { e.holdFire=true; e.holdPos=true; e.angle=0; }
  return {game,c,l,tank,shooter};
}
const state=(c:ComponentsModule,e:Ent)=>(c.snapshot() as any).entities[e.id];
function hit(game:Game,c:ComponentsModule,source:Ent,target:Ent,weaponId='w1',angle=Math.PI) {
  const def=getDef(source.defId),w=def.weapons.find(w=>w.id===weaponId)!;
  const p:Proj={x:target.x-Math.cos(angle)*5,y:target.y-Math.sin(angle)*5,px:source.x,py:source.y,angle,speed:600,kind:w.proj,homing:false,targetId:target.id,tx:target.x,ty:target.y,dmg:w.dmg,splash:w.splash,owner:source.owner,team:game.st.players[source.owner].team,src:source.id,gun:`${source.defId}/${w.id}`,ttl:1,hitsSub:false,hitsAir:false,hitsGround:true};
  c.onShot(source,def,w,p); game.st.projs.push(p); game.hash.rebuild(game.st); game.step(1/30);
}
function setState(c:ComponentsModule,e:Ent,change:(s:any)=>void) { const save=c.snapshot() as any; change(save.entities[e.id]); c.restore(save); }

test('actual T90M AP wears source front ERA, then penetrates into several parts without hull HP',async()=>{
  const {game,c,tank,shooter}=await setup(); const hp=tank.hp;
  const p=getDef(shooter.defId).weapons[0].extensions!['components-v1'] as any;
  expect(p.strength).toBe(85); expect(p.diameter).toBe(.696); expect(p.hullDamage).toBe(0);
  hit(game,c,shooter,tank); expect(tank.hp).toBe(hp);
  expect(state(c,tank).layers.kinetic.front).toBeCloseTo(201.4,5);
  expect(Object.values(state(c,tank).parts).every((p:any)=>p.damage===0)).toBe(true);
  for(let i=0;i<8&&!state(c,tank).terminal;i++) hit(game,c,shooter,tank);
  const s=state(c,tank); expect(Object.values(s.parts).some((p:any)=>p.damage>0)).toBe(true);
  expect(s.reserve.count).toBe(0);
  expect(s.terminal).toBeDefined(); expect(tank.dead).toBeFalsy();
  // Final failure is delayed and still completes when EMP or cargo would pause repairs.
  tank.emp=5; c.beforeStep(3.5); expect(tank.dead).toBe(true); expect(shooter.kills).toBe(1);
});

test('actual 3OF26 blast harms track through side armor, preserves hull, and manual service repairs it',async()=>{
  const {game,c,tank,shooter}=await setup(); const hp=tank.hp;
  hit(game,c,shooter,tank,'w4',Math.PI/2);
  const s=state(c,tank); expect(s.parts.track.damage).toBeGreaterThanOrEqual(25); expect(s.parts.track.damage).toBeLessThanOrEqual(75);
  expect(s.parts.driver.damage).toBe(0); expect(tank.hp).toBe(hp);
  // Accumulate real HE strikes until the source auto-recovery threshold is crossed.
  for(let i=0;i<8&&state(c,tank).parts.track.damage<=100;i++) hit(game,c,shooter,tank,'w4',Math.PI/2);
  expect(c.effectiveDef(tank,getDef(tank.defId)).speed).toBe(0);
  for(let i=0;i<240;i++) c.beforeStep(1/30);
  expect(state(c,tank).parts.track.damage).toBeCloseTo(65,5);
  const provider=newEnt(game.st,'usgr-re-supply-depot',1,550,500); provider.holdFire=true;
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:1,choice:'group'})).toBe(true);
  for(let i=0;i<312;i++) c.beforeStep(1/30);
  expect(state(c,tank).parts.track.damage).toBe(0);
});

test('real pool is finite, shared repair and reserve timers survive save and hostile terminal attribution stays private',async()=>{
  const {game,c,tank,shooter}=await setup();
  setState(c,tank,s=>{s.parts.gunner={damage:120,failed:true};s.parts.track={damage:120,failed:true};});
  c.beforeStep(2); expect(state(c,tank).reserve.count).toBe(1); expect(state(c,tank).group.progress).toBeCloseTo(2);
  const restored=deserializeSnapshot(buildContentSnapshot(game,undefined,true,undefined,undefined,true));games.push(restored);
  const rc=contentRuntime(restored)!.module('components-v1') as ComponentsModule, rt=restored.st.ents.get(tank.id)!;
  c.beforeStep(3);rc.beforeStep(3); expect(rc.snapshot()).toEqual(c.snapshot());
  expect(state(c,tank).parts.gunner.damage).toBe(0); expect(state(c,tank).reserve.count).toBe(0);
  expect(c.canFire(tank,getDef(tank.defId),getDef(tank.defId).weapons[2])).toBe(false);
  c.beforeStep(3);rc.beforeStep(3);expect(state(rc,rt).parts.track.damage).toBe(65);
  setState(c,tank,s=>{s.terminal={remaining:3.5,owner:shooter.owner,sourceId:shooter.id,gun:`${shooter.defId}/w1`};});
  const wire=c.snapshot({visibleEntities:new Set([tank.id]),visibleProjectiles:new Set(),privateEntity:()=>true}) as any;
  expect(wire.entities[tank.id].terminal.sourceId).toBe(0);expect(wire.entities[tank.id].terminal.gun).toBe('');
});

test('real source stock allowance changes the rack threshold and refill rebases signed damage before inventory restore',async()=>{
  const {game,c,l,tank}=await setup(); const def=getDef(tank.defId);
  for(let i=0;i<10;i++) l.spendRound(tank,def,0);
  setState(c,tank,s=>{s.parts.rack.damage=180;});
  expect(state(c,tank).parts.rack.failed).toBe(false);
  expect(c.inspect(tank,true).find(r=>r.id==='rack')!.value).toBeCloseTo(175+175/48*10-180);
  c.refillStocks(tank,['shell-ap','shell-he','missile-atgm']);
  expect(state(c,tank).parts.rack.damage).toBeCloseTo(180-175/48*10);
  setState(c,tank,s=>{s.parts.rack.damage=0;});c.refillStocks(tank,['shell-ap']);
  expect(state(c,tank).parts.rack.damage).toBeCloseTo(-175/48*10);
  expect(()=>c.restore(c.snapshot())).not.toThrow();
});

test('shared repair rejects direct-task bypass and completion restores residual damage plus all source layers',async()=>{
  const {game,c,tank}=await setup();
  const depot=newEnt(game.st,'usgr-re-supply-depot',1,550,500);
  setState(c,tank,s=>{s.parts.track.damage=70;s.parts.engine.damage=20;s.layers.kinetic.front=50;s.layers.chemical.front=100;});
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:1,choice:'track/1'})).toBe(false);
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:0,choice:'group'})).toBe(false);
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:1,choice:'group'})).toBe(true);
  c.beforeStep(10.4);
  expect(state(c,tank).parts.engine.damage).toBe(0);expect(state(c,tank).parts.track.damage).toBe(0);
  expect(state(c,tank).layers.kinetic.front).toBe(300);expect(state(c,tank).layers.chemical.front).toBe(700);
  expect(state(c,tank).group.manual).toBe(false);
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:1,choice:'group'})).toBe(false);
  const invalid=c.snapshot() as any;invalid.entities[tank.id].repair={part:'track',policy:1,progress:0,paid:0};
  expect(()=>c.restore(invalid)).toThrow('Shared repair');
  expect(depot.dead).toBeFalsy();
});

test('manual swaps require empty reserve; repair queues eligible crew refill and preserves its paused replacement clock',async()=>{
  const {game,c,l,tank}=await setup();
  newEnt(game.st,'usgr-re-supply-depot',1,550,500);
  expect(cmdContentAction(game,'logistics-v1',{action:'supply',ids:[tank.id],owner:1,targetId:[...game.st.ents.values()].find(e=>e.defId==='usgr-re-supply-depot')!.id,choice:'tank-crew'})).toBe(false);
  setState(c,tank,s=>{s.parts.gunner={damage:120,failed:true};s.parts.track.damage=70;});
  expect(cmdContentAction(game,'components-v1',{action:'reassign',ids:[tank.id],owner:1,choice:'driver/gunner'})).toBe(false);
  c.beforeStep(2);
  expect(cmdContentAction(game,'components-v1',{action:'repair',ids:[tank.id],owner:1,choice:'group'})).toBe(true);
  expect((l.snapshot() as any)[tank.id].service.service).toBe('tank-crew');
  c.beforeStep(3);expect(state(c,tank).reserve.progress).toBe(2);expect(state(c,tank).parts.gunner.occupant).toBeUndefined();
  l.beforeStep(18);
  expect(state(c,tank).parts.gunner.damage).toBe(0);expect(state(c,tank).reserve.count).toBe(1);
});

test('restored rack failure validates against restored rather than initial inventory',async()=>{
  const {game,c,l,tank}=await setup();
  for(let i=0;i<10;i++)l.spendRound(tank,getDef(tank.defId),0);
  setState(c,tank,s=>{s.parts.rack.damage=180;});
  const saved=buildContentSnapshot(game,undefined,true,undefined,undefined,true);
  const restored=deserializeSnapshot(saved);games.push(restored);
  const rc=contentRuntime(restored)!.module('components-v1') as ComponentsModule;
  expect(state(rc,restored.st.ents.get(tank.id)!).parts.rack.failed).toBe(false);
  setState(rc,restored.st.ents.get(tank.id)!,s=>{s.parts.rack.damage=500;s.parts.rack.failed=false;});
  expect(()=>rc.validateRestoredState()).toThrow('restored inventory');
});
