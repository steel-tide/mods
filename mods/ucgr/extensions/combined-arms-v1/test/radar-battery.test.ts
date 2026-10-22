import { afterEach, expect, test } from 'bun:test';
import { DEFS,getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule,sensorDeployed,sensorRadarActive } from '../src/sensors';
import { createLogisticsModule } from '../src/logistics';
import { readSensorsDef } from '../src/sensorsSpec';
const ids=['battery-radar','battery-launcher','battery-air'];afterEach(()=>ids.forEach(id=>delete DEFS[id]));
function fixture(indexDistance=false){
 const errors:any[]=[];const sensor=(v:any)=>readSensorsDef(v,'sensor',errors)!;
 const provider={role:'provider',interval:8/60,linkRange:200,range:1600,acceptRange:1280,scanInterval:.2,scanLimit:100,lateral:40,indexDistance,listCap:3,hpTransfer:.6,spin:8*Math.PI/3};
 DEFS[ids[0]]={...getDef('ltank'),id:ids[0],weapons:[],extensions:{'sensors-v1':sensor({radarControl:{initial:false,range:50,rangeOn:50,rangeOff:0,switchTime:.5,cooldown:10,weapons:[]},radarBattery:provider})}};
 DEFS[ids[1]]={...getDef('ltank'),id:ids[1],weapons:[{...getDef('ltank').weapons[0],id:'sam',range:30,targets:['air']}],extensions:{'sensors-v1':sensor({radarBattery:{role:'launcher',interval:8/60,linkRange:200,stock:'sam',high:1000,low:600,helicopter:480,waypointTime:5}}),'logistics-v1':{stocks:[{id:'sam',label:['SAM','SAM','SAM'],capacity:3,initial:3}],feeds:[],services:[]}}};
 DEFS[ids[2]]={...getDef('drone'),id:ids[2],weapons:[],extensions:{'sensors-v1':sensor({fixedWing:true,signatures:[{channel:'usgr-re-radar',strength:2}]})}};
 expect(errors).toEqual([]);const base=arena({mode:'campaign',fog:true,dayNight:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'logistics-v1',create:createLogisticsModule},{id:'sensors-v1',create:createSensorsModule}]),module=runtime.module('sensors-v1')!;
 const radar=newEnt(game.st,ids[0],0,400,400),launcher=newEnt(game.st,ids[1],0,440,400),second=newEnt(game.st,ids[1],0,460,400),air=newEnt(game.st,ids[2],1,900,400);
 const tick=(dt=1/60)=>{game.st.time+=dt;module.beforeStep!(dt);game.hash.rebuild(game.st);};
 const run=(seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)tick();};
 const order=(id:number,action:string,on?:boolean)=>module.order!({owner:0,ids:[id],action,on});
 const deploy=()=>{expect(order(launcher.id,'battery:deploy')).toBe(true);expect(order(second.id,'battery:deploy')).toBe(true);expect(order(radar.id,'radar:toggle')).toBe(true);run(.6);};
 return {game,module,radar,launcher,second,air,tick,run,order,deploy};
}
test('split radar begins off and launchers must deploy before firing',()=>{
 const {game,module,radar,launcher,air,deploy}=fixture();expect(sensorRadarActive(game,radar)).toBe(false);expect(sensorDeployed(game,launcher)).toBe(false);expect(module.canFire!(launcher,getDef(launcher.defId),getDef(launcher.defId).weapons[0],air,air)).toBe(false);
 deploy();expect(sensorRadarActive(game,radar)).toBe(true);expect(sensorDeployed(game,launcher)).toBe(true);expect(module.effectiveDef!(launcher,getDef(launcher.defId)).speed).toBe(0);
});
test('literal one-recipient collection transfers HP and does not bind a second ready launcher',()=>{
 const {module,radar,launcher,second,deploy,run}=fixture();const h1=launcher.hp,h2=second.hp;deploy();run(.5);const saved=module.snapshot() as any;
 expect(launcher.hp).toBeLessThan(h1);expect(second.hp).toBe(h2);expect(saved.radarBattery.find(([id]:[number])=>id===radar.id)[1].launchers).toEqual([launcher.id]);
 expect(saved.radarBattery.find(([id]:[number])=>id===second.id)[1].provider).toBe(0);expect(()=>module.restore(JSON.parse(JSON.stringify(saved)))).not.toThrow();
});
test('received contacts create bounded-time attack orders without passive acquisition or fog disclosure',()=>{
 const {module,game,launcher,air,radar,deploy,run}=fixture();deploy();run(.5);expect(launcher.orders[0]).toMatchObject({kind:'attack',targetId:air.id});expect(module.canTrack!(launcher,air,getDef(launcher.defId).weapons[0])).toBe(true);
 const snap=module.snapshot({visibleEntities:new Set([launcher.id]),privateEntity:()=>false} as any) as any;expect(snap.radarBattery[0][1].queue).toEqual([]);expect(snap.radarBattery[0][1].provider).toBe(0);expect(snap.states).toEqual([]);
 let candidate=true;const acquire=module.wrapTargetAcquisition!((...args:any[])=>{candidate=args[6]?.(air);return null;});acquire(game.st,game.hash,launcher,getDef(launcher.defId),1,true);expect(candidate).toBe(false);
 radar.dead=true;run(6);const after=module.snapshot() as any;expect(after.radarBattery.find(([id]:[number])=>id===launcher.id)[1].provider).toBe(0);
});
test('BUK and SLM preserve unmodded target-index distance quirk while HAWK forwards all in-range contacts',()=>{
 for(const indexDistance of [false,true]){const {module,game,radar,launcher,air,deploy,run}=fixture(indexDistance);const other=newEnt(game.st,ids[2],1,910,420);deploy();run(.5);const saved=module.snapshot() as any,ls=saved.radarBattery.find(([id]:[number])=>id===launcher.id)[1];expect(ls.queue.includes(air.id)).toBe(true);expect(ls.queue.includes(other.id)).toBe(!indexDistance);radar.dead=true;}
});

test('source radar heading advances while its active image is hidden and preserves interpolation across save',()=>{
 const {module,radar,run}=fixture();radar.angle=.3;radar.prevAngle=.2;run(.25);
 const visual=module.render!(radar) as any;expect(visual.deployed).toBe(false);expect(visual.radarHeading).toBeCloseTo(.3+2*Math.PI/3,8);expect(visual.radarPreviousHeading).toBeCloseTo(.2+2*Math.PI/3-8*Math.PI/180,8);
 const snap=JSON.parse(JSON.stringify(module.snapshot()));module.restore(snap);expect(module.render!(radar)).toEqual(visual);
});
test('literal HP collection reaches zero through normal entity death',()=>{
 const {launcher,deploy}=fixture();launcher.hp=.6;deploy();expect(launcher.dead).toBe(true);
});
