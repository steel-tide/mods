import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule, sensorAltitude } from '../src/sensors';
import { readSensorsDef } from '../src/sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
const id='source-flight-controls';
afterEach(()=>{delete DEFS[id];});
function fixture(){
 const errors:ContentIssue[]=[],config=readSensorsDef({fixedWing:true,altitude:'high',flightControls:{initial:'high',initialHeight:80,highHeight:80,lowHeight:40,heightSpread:8,heightRate:2376,altitudeTime:.1,altitudeCooldown:5,thrust:.2,thrustDuration:15,thrustCooldown:20,brake:.2,brakeTurn:Math.PI*2/15,damageThresholds:[.75,.5,.25],damageSpeed:.05}},'sensors',errors);expect(errors).toEqual([]);
 DEFS[id]={...getDef('drone'),id,hp:1000,speed:100,turnRate:1,weapons:[],extensions:{'sensors-v1':config}};
 const base=arena({mode:'campaign',dayNight:false,fog:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'sensors-v1',create:createSensorsModule}]);
 const e=newEnt(game.st,id,0,400,400),module=runtime.module('sensors-v1')!;module.beforeStep!(.01);
 const order=(action:string,on?:boolean)=>module.order!({owner:0,ids:[e.id],action:`flight:${action}`,on});
 return {game,module,e,order,def:()=>module.effectiveDef!(e,getDef(id))};
}
test('source high/low action queue changes height and classification with shared cooldown',()=>{
 const {game,module,e,order,def}=fixture();expect(sensorAltitude(game,e)).toBe('high');expect(def().altitude).toBeGreaterThanOrEqual(72);expect(def().altitude).toBeLessThanOrEqual(88);
 expect(order('low')).toBe(false);game.st.time=5;expect(order('low')).toBe(true);expect(order('low')).toBe(false);
 game.st.time=5.09;module.beforeStep!(.09);expect(sensorAltitude(game,e)).toBe('high');game.st.time=5.1;module.beforeStep!(.01);expect(sensorAltitude(game,e)).toBe('low');
 module.beforeStep!(.1);expect(def().altitude).toBeGreaterThanOrEqual(32);expect(def().altitude).toBeLessThanOrEqual(48);expect(order('high')).toBe(false);
 expect((module.render!(e) as any).flight.altitude).toBe(def().altitude);expect(e.alt).not.toBe(def().altitude);
 const view={visibleEntities:new Set([e.id]),privateEntity:()=>false} as any,publicState=module.snapshot(view) as any;expect(publicState.states).toEqual([]);expect(publicState.flightControls[0][1].pending).toBeUndefined();
 expect(()=>module.restore(publicState)).not.toThrow();expect(sensorAltitude(game,e)).toBe('low');
});
test('source afterburner and speed brake add against base speed, preserve cooldown and restore',()=>{
 const {game,module,e,order,def}=fixture();expect(order('thrust')).toBe(true);expect(def().speed).toBe(120);expect(order('brake')).toBe(true);expect(def().speed).toBe(100);expect(def().turnRate).toBeCloseTo(1+Math.PI*2/15);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));expect(()=>module.restore(saved)).not.toThrow();expect(def().speed).toBe(100);expect(order('thrust')).toBe(false);
 game.st.time=15.1;module.beforeStep!(.1);expect(def().speed).toBe(80);expect(order('brake',false)).toBe(true);expect(def().speed).toBe(100);expect(def().turnRate).toBe(1);
 game.st.time=20;expect(order('thrust')).toBe(true);e.inside=999;expect(module.actions!(e)).toEqual([]);expect(order('brake')).toBe(false);
 const bad=JSON.parse(JSON.stringify(module.snapshot()));bad.flightControls[0][1].damage=99;expect(()=>module.restore(bad)).toThrow('Invalid source flight control state');
});
test('source fixed-wing damage flags reduce moving speed once and survive repairs',()=>{
 const {module,e,def}=fixture();e.hp=200;e.prevX=e.x;module.beforeStep!(.1);expect(def().speed).toBe(100);
 e.prevX=e.x-1;module.beforeStep!(.1);expect(def().speed).toBe(85);module.beforeStep!(.1);expect(def().speed).toBe(85);e.hp=1000;module.beforeStep!(.1);expect(def().speed).toBe(85);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));module.restore(saved);expect(def().speed).toBe(85);
});
