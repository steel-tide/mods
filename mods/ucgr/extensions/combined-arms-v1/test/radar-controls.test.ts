import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule, sensorRadarActive } from '../src/sensors';
import { readSensorsDef } from '../src/sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
const id='source-ground-radar';afterEach(()=>{delete DEFS[id];});
function fixture(ground=false){const errors:ContentIssue[]=[],config=readSensorsDef({radarControl:{range:30,rangeOn:20,rangeOff:ground?10:0,switchTime:.5,cooldown:10,interval:.1,weapons:ground?[{id:'gun',mode:'target'}]:[],...(ground?{groundRange:5,groundTime:.05}:{})}},'sensor',errors);expect(errors).toEqual([]);
 const weapon={...getDef('ltank').weapons[0],id:'gun',range:20,targets:['ground','air'] as ('ground'|'air')[]};DEFS[id]={...getDef('ltank'),id,weapons:[weapon],extensions:{'sensors-v1':config}};
 const base=arena({mode:'campaign',dayNight:false,fog:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'sensors-v1',create:createSensorsModule}]),module=runtime.module('sensors-v1')!;
 const e=newEnt(game.st,id,0,400,400),enemy=newEnt(game.st,'ltank',1,500,400);module.beforeStep!(.01);
 return {game,module,e,enemy,weapon,def:()=>module.effectiveDef!(e,getDef(id)),toggle:()=>module.order!({owner:0,ids:[e.id],action:'radar:toggle'})};
}
test('source radar switch atomically changes emission and engagement range after queue, with shared cooldown',()=>{
 const {game,module,e,enemy,weapon,def,toggle}=fixture();expect(sensorRadarActive(game,e)).toBe(true);expect(toggle()).toBe(true);expect(toggle()).toBe(false);
 game.st.time=.49;module.beforeStep!(.01);expect(def().weapons[0].range).toBe(20);game.st.time=.5;module.beforeStep!(.01);expect(sensorRadarActive(game,e)).toBe(false);expect(def().weapons[0].range).toBe(0);expect(module.canFire!(e,def(),weapon,enemy,enemy)).toBe(false);expect(toggle()).toBe(false);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));module.restore(saved);expect(sensorRadarActive(game,e)).toBe(false);
 game.st.time=10.5;expect(toggle()).toBe(true);game.st.time=11;module.beforeStep!(.01);expect(sensorRadarActive(game,e)).toBe(true);expect(def().weapons[0].range).toBe(20);
});
test('source radar-off optical range remains available and current ground target drives automatic mode',()=>{
 const {game,module,e,enemy,weapon,def,toggle}=fixture(true);e.targetId=enemy.id;game.st.time=.1;module.beforeStep!(.1);expect(module.canFire!(e,def(),weapon,enemy,enemy)).toBe(false);
 game.st.time=.15;module.beforeStep!(.05);expect(def().weapons[0].range).toBe(5);expect(module.canFire!(e,def(),weapon,enemy,enemy)).toBe(true);
 expect(toggle()).toBe(true);game.st.time=.65;module.beforeStep!(.5);expect(sensorRadarActive(game,e)).toBe(false);expect(def().weapons[0].range).toBe(5);
 enemy.x=700;game.st.time=.8;module.beforeStep!(.15);expect(def().weapons[0].range).toBe(5); // Source ground mode persists while its target retreats.
 e.targetId=0;game.st.time=.9;module.beforeStep!(.1);game.st.time=.95;module.beforeStep!(.05);expect(def().weapons[0].range).toBe(10);
 const visible=module.snapshot({visibleEntities:new Set([e.id]),privateEntity:()=>false} as any) as any;expect(visible.radarControls[0][1]).toEqual({active:false,ground:false,ready:0,nextScan:0});expect(visible.states).toEqual([]);expect(()=>module.restore(visible)).not.toThrow();
});
