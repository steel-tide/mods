import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt, type Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule, type SensorsModule } from '../src/sensors';
import { readGuidanceDef, readSensorsDef } from '../src/sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
const fixtureIds=['source-ir-launcher','source-ir-target'];
afterEach(()=>{for(const id of fixtureIds)delete DEFS[id];});
function fixture(decoys=0,radar:boolean|'semi'=false){
 const errors:ContentIssue[]=[];
 const guide=readGuidanceDef({mode:'self',channel:'heat',range:50,launchArc:Math.PI/3,sourceFlight:{speed:228,acceleration:228,turnRate:5*Math.PI/3,turnAcceleration:5*Math.PI/1.8,inheritSpeed:.25,launchLeg:10,launchTime:.25,sample:8/60,lossDelay:2,fovDegrees:120,life:5,resistance:180,proximity:12,blastRadius:50,...(radar?{radar:{semiActive:radar==='semi',range:960,ecmX:24,ecmY:120,lowPenalty:25,lostChecks:radar==='semi'?2:10,canLose:true,lockDelay:.1,scriptInterval:8/60,seekerInterval:10/60,speedDrop:72,speedUp:3.6,speedDown:.6,speedFloor:171}}:{})}},'guide',errors);
 const sensor=readSensorsDef(decoys?{countermeasures:{charges:decoys,reload:.5,range:180,x:0,y:18,life:.5,speed:192,radius:80,energy:60}}:{},'sensor',errors);expect(errors).toEqual([]);
 const weapon={...getDef('ltank').weapons[0],id:'ir',dmg:100,range:50,projectile:'missile' as const,extensions:{'sensors-v1':guide}};
 DEFS[fixtureIds[0]]={...getDef('drone'),id:fixtureIds[0],speed:80,weapons:[weapon]};
 DEFS[fixtureIds[1]]={...getDef('drone'),id:fixtureIds[1],hp:1000,weapons:[],extensions:{'sensors-v1':sensor}};
 const base=arena({mode:'campaign',dayNight:false,fog:false});const {game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'sensors-v1',create:createSensorsModule}]);
 const a=newEnt(game.st,fixtureIds[0],0,400,400),b=newEnt(game.st,fixtureIds[1],1,700,400);a.angle=0;b.prevX=b.x;b.prevY=b.y;
 const p:Proj={id:game.st.nextProjId++,x:400,y:400,px:400,py:400,angle:1,speed:999,kind:'missile',homing:true,targetId:b.id,tx:b.x,ty:b.y,dmg:100,splash:0,owner:0,team:game.st.players[0].team,ttl:1,hitsSub:false,hitsAir:true,hitsGround:false,src:a.id,gun:`${a.defId}/ir`};game.st.projs.push(p);
 const module=runtime.module('sensors-v1')!;module.onShot!(a,getDef(a.defId),weapon,p);game.hash.rebuild(game.st);
 const step=(dt:number)=>{game.st.time+=dt;return module.projectileStep!(p,dt);};
 return {game,module,a,b,p,step,weapon};
}
test('source helper owns launch leg, acceleration, inherited maximum speed and launcher body arc',()=>{
 const {module,a,b,p,step,weapon}=fixture();b.x=400;b.y=700;
 expect(module.canFire!(a,getDef(a.defId),weapon,b,b)).toBe(false);
 expect(p.angle).toBe(0);expect(p.speed).toBe(0);expect(p.splash).toBe(50);
 step(.1);expect(p.speed).toBeCloseTo(22.8);expect(p.x).toBeCloseTo(402.28);expect(p.angle).toBe(0);
 for(let i=0;i<12;i++)step(.1);expect(p.speed).toBe(248);expect(p.angle).not.toBe(0);
});
test('literal five-second expiry removes a source helper without stale-point damage',()=>{
 const {game,b,p,step}=fixture();b.x=400;b.y=800;game.hash.rebuild(game.st);
 let status;for(let i=0;i<51;i++)status=step(.1);
 expect(status).toBe('remove');expect(b.hp).toBe(1000);expect(game.st.effects.length).toBe(0);
 expect(p.ttl).toBe(0);
});
test('seeker FOV loss starts after two seconds and is permanent',()=>{
 const {b,p,step,module}=fixture();b.x=900;b.y=400;
 step(1);b.x=100;b.y=400;step(1.1);const angle=p.angle;expect(p.targetId).toBe(0);
 b.x=p.x+500;b.y=p.y+100;step(.1);expect(p.targetId).toBe(0);expect(p.angle).toBe(angle);
 expect(JSON.stringify(module.snapshot())).toContain('"lost":true');
});
test('source proximity fuse runs composed impact once and preserves simulation continuation',()=>{
 const {game,module,b,p,step}=fixture();b.x=430;game.hash.rebuild(game.st);
 step(.1);const saved=JSON.parse(JSON.stringify(module.snapshot()));expect(()=>module.restore(saved)).not.toThrow();
 let status;for(let i=0;i<10;i++){status=step(.05);if(status==='remove')break;}
 expect(status).toBe('remove');expect(b.hp).toBeLessThan(1000);
 const hp=b.hp;expect(module.projectileStep!(p,.1)).toBeUndefined();expect(b.hp).toBe(hp);
});
test('automatic finite countermeasure rounds subtract energy in area, without random lock loss',()=>{
 const {game,module,b,p,step}=fixture(3);p.x=600;b.x=650;game.hash.rebuild(game.st);
 // Keep a stationary incoming helper near the dispenser to isolate finite pulses.
 for(let i=0;i<4;i++){game.st.time=i*.5;module.beforeStep!(.5);}
 const snap=module.snapshot() as any;
 expect(snap.sourceOrdnance.dispensers[0][1].remaining).toBe(0);
 expect(snap.sourceOrdnance.flights[0][1].energy).toBe(0);
 expect(step(.01)).toBe('remove');expect(b.hp).toBe(1000);
 expect(()=>module.restore({...snap,sourceOrdnance:{...snap.sourceOrdnance,dispensers:[[b.id,{remaining:4,ready:0}]]}})).toThrow();
});

test('active radar helper speed script and loss counter survive save without infrared loss substitution',()=>{
 const {game,module,b,p,step}=fixture(0,true);b.x=1100;b.prevX=1100;
 step(.1);let snap=module.snapshot() as any;expect(snap.sourceOrdnance.flights[0][1].radar.adjusted).toBe(false);
 step(.04);snap=module.snapshot() as any;expect(snap.sourceOrdnance.flights[0][1].radar.cruise).toBeCloseTo(248-72+3.6);
 for(let i=0;i<56;i++)step(1/30);b.x=0;b.y=400;b.prevX=b.x;
 // A radar helper requires ten out-of-FOV checks, whereas IR loses at once.
 step(.2);expect(p.targetId).toBe(b.id);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));expect(()=>module.restore(saved)).not.toThrow();
 for(let i=0;i<50;i++)step(1/30);expect(p.targetId).toBe(0);
 snap=module.snapshot() as any;expect(snap.sourceOrdnance.flights[0][1].radar.lossCount).toBe(10);
 expect(()=>module.restore({...snap,sourceOrdnance:{...snap.sourceOrdnance,flights:snap.sourceOrdnance.flights.map(([id,f]:any)=>[id,{...f,radar:{...f.radar,lossCount:NaN}}])}})).toThrow();
});

test('semi-active source helper retargets to its launching unit attack target only for the authored attempts',()=>{
 const {game,module,a,b,p,step}=fixture(0,'semi');
 const second=newEnt(game.st,'source-ir-target',1,1000,400);a.targetId=second.id;b.dead=true;step(.2);expect(p.targetId).toBe(second.id);
 const third=newEnt(game.st,'source-ir-target',1,1000,500);a.targetId=third.id;second.dead=true;step(.2);expect(p.targetId).toBe(third.id);
 const fourth=newEnt(game.st,'source-ir-target',1,1000,600);a.targetId=fourth.id;third.dead=true;step(.2);expect(p.targetId).toBe(0);
 const snap=module.snapshot() as any;expect(snap.sourceOrdnance.flights[0][1].radar.lossCount).toBe(2);
});

test('source helper height uses source launch/lock policy and exposes only visible height across frames',()=>{
 const {game,module,a,b,p,step,weapon}=fixture(0,true),sensors=module as SensorsModule;
 DEFS[a.defId].altitude=80;DEFS[b.defId].altitude=40;(weapon.extensions['sensors-v1']!.sourceFlight!).heightRate=60;
 module.onShot!(a,getDef(a.defId),weapon,p);expect(sensors.projectileVisual(p)).toEqual({altitude:80});step(.1);expect(sensors.projectileVisual(p)).toEqual({altitude:74});
 const exact=JSON.parse(JSON.stringify(module.snapshot())),view=module.snapshot({visibleEntities:new Set<number>(),visibleProjectiles:new Set([p.id!]),privateEntity:()=>false}) as any;
 expect(view.sourceOrdnance.flights).toEqual([]);expect(view.sourceOrdnance.heights).toEqual([[p.id,74]]);expect(JSON.stringify(view)).not.toContain('targetHeight');module.restore(view);expect(sensors.projectileVisual(p)).toEqual({altitude:74});
 module.restore(exact);step(.1);expect(sensors.projectileVisual(p)).toEqual({altitude:68});
 const hidden=module.snapshot({visibleEntities:new Set<number>(),visibleProjectiles:new Set<number>(),privateEntity:()=>false}) as any;expect(hidden.sourceOrdnance.heights).toEqual([]);
});
