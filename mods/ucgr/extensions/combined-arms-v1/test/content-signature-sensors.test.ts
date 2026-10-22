import extensionPackage from '../extension.json';
import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { canSee } from '../../../../../../steel-tide/game/core/src/game/combat';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule, type SensorsVisual } from '../src/sensors';
import { readSensorsDef } from '../src/sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';

const added: string[] = [];
const label = ['Search contacts', '搜索接触', '수색 접촉'];
afterEach(() => { for (const id of added.splice(0)) delete DEFS[id]; });
function config(value: unknown) {
  const errors: ContentIssue[] = [], result = readSensorsDef(value, 'test', errors);
  expect(errors).toEqual([]); return result!;
}
function define(id: string, signals: unknown): UnitDef {
  const value = { ...getDef('fighter'), id, vision:1, weapons:[], extensions:{'sensors-v1':config(signals)} };
  DEFS[id] = value; added.push(id); return value;
}
function match() {
  const base = arena({mode:'campaign',fog:true,dayNight:false});
  return createRuntimeGame(base.st.cfg, base.st.map, true, [{id:'sensors-v1',create:createSensorsModule}]);
}

test('signature receiver uses authored body origin, threshold and sample clock without revealing an entity', () => {
  define('signal-receiver', {sensors:[{id:'search',label,channel:'cross-section',mode:'signature',minimumSignature:1,
    basis:'body',x:40,range:20,cone:Math.PI / 6,interval:.2,scanLimit:100,maxTracks:100}]});
  define('signal-visible', {signatures:[{channel:'cross-section',strength:2}]});
  define('signal-small', {signatures:[{channel:'cross-section',strength:.5}]});
  define('signal-other', {signatures:[{channel:'another-band',strength:3}]});
  const {game,runtime}=match(), module=runtime.module('sensors-v1')!;
  const observer=newEnt(game.st,'signal-receiver',0,400,400), target=newEnt(game.st,'signal-visible',1,800,440);
  observer.angle=0; observer.turretAngle=Math.PI;
  newEnt(game.st,'signal-small',1,700,440); newEnt(game.st,'signal-other',1,680,440);
  newEnt(game.st,'fighter',1,750,440); newEnt(game.st,'signal-visible',1,200,440);
  game.hash.rebuild(game.st); game.updateFog(); module.beforeStep!(1/30);
  const view=()=>module.render!(observer,true) as SensorsVisual;
  expect(view().contacts.map(c=>[c.x,c.y,c.strength])).toEqual([[800,440,2]]);
  expect(canSee(game.st,game.hash,0,target)).toBe(false);
  expect(runtime.visible(target,0)).toBe(false);
  expect(module.inspect!(observer,false)).toEqual([]); expect(module.render!(observer)).toBeUndefined();
  expect(module.inspect!(observer,true).map(r=>r.value)).toEqual([1,'(25.0, 13.8)']);
  const network=module.snapshot({player:0,visibleEntities:new Set([observer.id]),visibleProjectiles:new Set(),privateEntity:id=>id===observer.id}) as {states:[number,{contacts:Record<string,{target:number;x:number}[]>}][]};
  expect(network.states[0][1].contacts.search[0].target).toBe(0);
  expect(network.states[0][1].contacts.search[0].x).toBe(800);
  target.x=200; game.st.time=.19; module.beforeStep!(1/30);
  expect(view().contacts).toHaveLength(1); // Until a scan, only the measured position is retained.
  game.st.time=.2; module.beforeStep!(1/30); expect(view().contacts).toEqual([]);
});

test('bounded candidates precede the cone filter and saved scan phase survives continuation', () => {
  define('signal-sample', {sensors:[{id:'search',label,channel:'band',mode:'signature',basis:'body',range:20,cone:.3,interval:1,scanLimit:1}]});
  define('signal-profile', {signatures:[{channel:'band',strength:2}]});
  const {game,runtime}=match(), module=runtime.module('sensors-v1')!;
  const observer=newEnt(game.st,'signal-sample',0,400,400);
  observer.angle=0;
  const behind=newEnt(game.st,'signal-profile',1,200,400), ahead=newEnt(game.st,'signal-profile',1,800,400);
  module.beforeStep!(1/30);
  expect((module.render!(observer,true) as SensorsVisual).contacts).toEqual([]);
  behind.dead=true; game.st.time=.4; module.beforeStep!(1/30);
  const saved=JSON.parse(JSON.stringify(module.snapshot()));
  module.restore(saved); expect(module.snapshot()).toEqual(saved);
  game.st.time=.99; module.beforeStep!(1/30);
  expect((module.render!(observer,true) as SensorsVisual).contacts).toEqual([]);
  game.st.time=1; module.beforeStep!(1/30);
  expect((module.render!(observer,true) as SensorsVisual).contacts.map(c=>c.x)).toEqual([ahead.x]);
  const invalid=JSON.parse(JSON.stringify(module.snapshot()));
  invalid.states.find((e:unknown[])=>e[0]===observer.id)[1].scans.search=5;
  expect(()=>module.restore(invalid)).toThrow('Invalid sensor scan clock');
});

test('schema rejects unknown and unbounded signal data and unsafe receiver identifiers', () => {
  for (const value of [
    {signatures:[{channel:'x',strength:NaN}]}, {signatures:[{channel:'x',strength:-1}]},
    {signatures:[{channel:'x',strength:1},{channel:'x',strength:2}]},
    {sensors:[{id:'x',channel:'x',minimumSignature:1}]},
    {sensors:[{id:'x',channel:'x',mode:'signature',interval:-1}]},
    {sensors:[{id:'x',channel:'x',mode:'signature',interval:61}]},
    {sensors:[{id:'x',channel:'x',mode:'signature',scanLimit:0}]},
    {sensors:[{id:'x',channel:'x',mode:'signature',x:257}]},
    {sensors:[{id:'constructor',channel:'x',mode:'signature'}]},
    {signatures:[{channel:'x',strength:1,execute:'anything'}]},
  ]) {
    const errors: ContentIssue[]=[]; readSensorsDef(value,'signals',errors); expect(errors.length).toBeGreaterThan(0);
  }
  expect(config({}).sensors).toEqual([]);
  expect(config({sensors:[{id:'x',channel:'x'}]}).sensors[0].scanLimit).toBe(0); // Omission preserves unbounded candidate scanning.
});
