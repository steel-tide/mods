/** Real manifest acceptance case; run from this folder with Bun. */
import { expandedManifest } from './test-utils';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { cmdContentAction } from '../../../steel-tide/game/core/src/game/orders';
import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyContent } from '../../../steel-tide/game/core/src/game/content';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { parseDefinitionPack } from '../../../steel-tide/game/core/src/game/contentDefs';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { contentFrameCodec } from '../../../steel-tide/game/core/src/net/contentFrames';
import { buildContentSnapshot, deserializeSnapshot } from '../../../steel-tide/game/core/src/game/save';
import { newEnt } from '../../../steel-tide/game/core/src/game/state';
import { canSee } from '../../../steel-tide/game/core/src/game/combat';
import { ViewCache } from '../../../steel-tide/game/core/src/net/frames';
import type { SensorsVisual } from './extensions/combined-arms-v1/src/sensors';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';
import { arena, run, stepUntil } from '../../../steel-tide/game/core/server/testkit/game';

const games: Game[] = [];
afterEach(() => { for (const game of games.splice(0)) disposeContentGame(game); applyContent([]); });

test('actual UCGR MiG-29 radio contacts respect source forward cone, sampling, privacy and saved scan phase', async () => {
  const raw=JSON.parse(readFileSync(new URL('./mod.json',import.meta.url),'utf8'));
  const evidence=JSON.parse(readFileSync(new URL('./sensors-source-data.json',import.meta.url),'utf8'));
  const unit=expandedManifest().defs.find((d:{id:string})=>d.id===evidence.unit);
  expect(raw.requiredCapabilities).toContain('sensors-v1');
  expect(unit.extensions['sensors-v1']).toEqual(evidence.candidate);
  expect(unit.weapons.find((w:{id:string})=>w.id===evidence.infrared.weapon).extensions['sensors-v1']).toEqual(evidence.infrared.implementedPolicy);
  expect(unit.weapons.filter((w:any)=>w.extensions?.['sensors-v1']?.sourceFlight).every((w:any)=>!w.extensions['sensors-v1'].sourceFlight.radar)).toBe(true);
  await prepareContentSchema(raw,true);
  const parsed=parseDefinitionPack(raw);
  if(!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]);
  expect(applyContent([parsed.pack]).rejected).toEqual([]);
  const base=arena({mode:'campaign',fog:true,dayNight:false});
  const game=createContentGame(base.st.cfg,base.st.map,true); games.push(game);
  const observer=newEnt(game.st,evidence.unit,0,400,400);
  const enemy=newEnt(game.st,'usgr-re-f-2',1,1350,440);
  newEnt(game.st,'usgr-re-f-5e',1,1200,1100); // Same signature, beyond source35° cone.
  newEnt(game.st,'fighter',1,1300,440); // No invented signature for vanilla content.
  observer.angle=0; observer.turretAngle=Math.PI;
  for(const e of game.st.ents.values()) {e.holdPos=true;e.holdFire=true;}
  game.hash.rebuild(game.st); game.updateFog();
  const runtime=contentRuntime(game)!, module=runtime.module('sensors-v1')!;
  module.beforeStep!(1/30);
  const contacts=()=> (module.render!(observer,true) as SensorsVisual).contacts;
  expect(contacts().map(c=>[c.x,c.y,c.strength])).toEqual([[1350,440,2]]);
  expect(canSee(game.st,game.hash,0,enemy)).toBe(false);
  expect(runtime.visible(enemy,0)).toBe(false);
  expect(runtime.inspect(observer,0).rows.find(row=>row.id==='air-search')?.value).toBe(1);
  expect(runtime.inspect(observer,0).rows.find(row=>row.id==='source-countermeasures')?.value).toBe(5);
  expect(runtime.inspect(observer,1).rows).toEqual([]);
  const codec=contentFrameCodec(game), cache=new ViewCache(codec.viewKey(game,0,'none'));
  const frame=codec.encodeFullFrame(game,0,'none',1,cache);
  expect(frame.ents.some(e=>e.id===enemy.id)).toBe(false);
  const signals=frame.extensions!['sensors-v1'] as {states:[number,{contacts:Record<string,{target:number;x:number;y:number}[]>}][]};
  const privateContact=signals.states.find(([id])=>id===observer.id)![1].contacts['air-search'][0];
  expect(privateContact).toMatchObject({target:0,x:1350,y:440});
  enemy.y=1200; game.st.time=.05; module.beforeStep!(1/30);
  expect(contacts()[0].y).toBe(440); // Source sampling does not expose a live position.
  const restored=deserializeSnapshot(buildContentSnapshot(game,undefined,true,undefined,undefined,true)); games.push(restored);
  const restoredModule=contentRuntime(restored)!.module('sensors-v1')!;
  expect(restoredModule.snapshot()).toEqual(module.snapshot());
  for(const time of [.12,.14]) {
    game.st.time=restored.st.time=time;
    module.beforeStep!(1/30); restoredModule.beforeStep!(1/30);
    expect(restoredModule.snapshot()).toEqual(module.snapshot());
    expect(contacts()).toHaveLength(time<8/60 ? 1:0);
  }
});


async function setupSourceSystems(mode:'campaign'|'sandbox'='campaign') {
  const raw=JSON.parse(readFileSync(new URL('./mod.json',import.meta.url),'utf8'));
  await prepareContentSchema(raw,true);const parsed=parseDefinitionPack(raw);if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));expect(parsed.warnings).toEqual([]);
  await prepareContentCapabilities([parsed.pack]);expect(applyContent([parsed.pack]).rejected).toEqual([]);
  const base=arena({mode,fog:true,dayNight:false}),game=createContentGame(base.st.cfg,base.st.map,true);games.push(game);
  return {game,module:contentRuntime(game)!.module('sensors-v1')!};
}
test('actual split HAWK battery starts off, deploys, forwards private targets and resumes after save',async()=>{
 const {game,module}=await setupSourceSystems();
 const radar=newEnt(game.st,'usgr-re-hawk-fdaa5cb6',0,400,400),launcher=newEnt(game.st,'usgr-re-hawk-d51d6cc6',0,440,400),target=newEnt(game.st,'usgr-re-f-2',1,900,400);
 for(const e of [radar,launcher,target])e.holdPos=true;target.holdFire=true;
 expect((module.render!(radar) as SensorsVisual).deployed).toBe(false);
 expect(module.canFire!(launcher,getDef(launcher.defId),getDef(launcher.defId).weapons[0],target,target)).toBe(false);
 expect(cmdContentAction(game,'sensors-v1',{owner:0,ids:[launcher.id],action:'battery:deploy'})).toBe(true);
 expect(cmdContentAction(game,'sensors-v1',{owner:0,ids:[radar.id],action:'radar:toggle'})).toBe(true);
 // Use the real pipeline, retaining the source delayed radar action and launcher warmup.
 run(game,.8);const state=module.snapshot() as any;
 expect((module.render!(radar) as SensorsVisual).deployed).toBe(true);
 expect(state.radarBattery.find(([id]:[number])=>id===launcher.id)[1].provider).toBe(radar.id);
 expect(state.radarBattery.find(([id]:[number])=>id===radar.id)[1].launchers).toEqual([launcher.id]);
 expect(launcher.orders.some(o=>o.kind==='attack'&&o.targetId===target.id)||game.st.projs.some(p=>p.src===launcher.id)).toBe(true);
 // The launcher never acquires, yet engages what its radar forwards; RW keeps at most 29 waypoints.
 const launched=stepUntil(game,()=>game.st.projs.some(p=>p.src===launcher.id),30*10);
 expect(launched).toBeGreaterThan(0);expect(launcher.orders.length).toBeLessThanOrEqual(29);
 const publicState=module.snapshot({visibleEntities:new Set([radar.id,launcher.id]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any;
 expect(publicState.radarBattery.every(([,s]:any)=>s.queue.length===0&&s.targets.length===0&&s.provider===0)).toBe(true);
 const restored=deserializeSnapshot(buildContentSnapshot(game,undefined,true,undefined,undefined,true));games.push(restored);
 expect(contentRuntime(restored)!.module('sensors-v1')!.snapshot()).toEqual(module.snapshot());
});
test('actual F-16 sandbox SEAD loadout releases source helper entity and preserves private finite magazine on save',async()=>{
 const {game,module}=await setupSourceSystems('sandbox');
 const plane=newEnt(game.st,'usgr-re-f-16c-6b611fe0',0,400,400),radar=newEnt(game.st,'usgr-re-hq17',1,1000,400);
 plane.angle=0;plane.holdPos=true;radar.holdFire=true;radar.holdPos=true;
 expect(module.inspect!(plane,true).some(r=>r.id==='source-sead-magazine')).toBe(false);
 expect(cmdContentAction(game,'sensors-v1',{owner:0,ids:[plane.id],action:'sead:equip'})).toBe(true);
 run(game,1.2);
 const missiles=[...game.st.ents.values()].filter(e=>e.defId==='usgr-re-agm88-1585e86b');expect(missiles.length).toBeGreaterThan(0);
 expect(module.inspect!(plane,true).find(r=>r.id==='source-sead-magazine')!.value).toBeLessThan(4);
 expect(module.allowOrder!(missiles[0],{kind:'stop'} as any)).toBe(false);
 const restored=deserializeSnapshot(buildContentSnapshot(game,undefined,true,undefined,undefined,true));games.push(restored);
 expect(contentRuntime(restored)!.module('sensors-v1')!.snapshot()).toEqual(module.snapshot());
});
