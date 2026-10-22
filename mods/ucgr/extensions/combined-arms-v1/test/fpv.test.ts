import { afterEach,expect,test } from 'bun:test';
import evidence from '../../../fpv-source-data.json';
import { DEFS,getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { parseDefinitionPack } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule } from '../src/sensors';
import { createComponentsModule } from '../src/components';
import { readSensorsDef } from '../src/sensorsSpec';
import { readComponentsDef,readComponentsWeapon } from '../src/componentsSpec';
const ids=['fpv-operator','fpv-target',...evidence.drones.map(d=>d.id)];
afterEach(()=>ids.forEach(id=>delete DEFS[id]));
function fixture(){
 const errors:any[]=[],sensor=(v:unknown)=>readSensorsDef(v,'sensor',errors)!;
 DEFS[ids[0]]={...getDef('buggy'),id:ids[0],weapons:[],extensions:{'sensors-v1':sensor({fpvOperator:evidence.operator})}};
 DEFS[ids[1]]={...getDef('buggy'),id:ids[1],hp:1e6,weapons:[],extensions:{'usgr-re.targeting-v1':{tags:['装甲']}}};
 for(const raw of evidence.drones){const d=structuredClone(raw),native={...d};delete (native as any).extensions;for(const w of native.weapons){delete (w as any).extensions;delete (w as any)._source;}
  const parsed=parseDefinitionPack({format:'steel-tide-mod',v:2,id:'source-fpv-test',name:'FPV',version:'1',defs:[native]});if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const def=parsed.pack.defs[0];def.extensions={'sensors-v1':sensor(raw.extensions['sensors-v1']),'components-v1':readComponentsDef(raw.extensions['components-v1'],'component',errors)!,...{'usgr-re.targeting-v1':raw.extensions['usgr-re.targeting-v1']}};
  for(let i=0;i<def.weapons.length;i++)def.weapons[i].extensions={'components-v1':readComponentsWeapon(raw.weapons[i].extensions['components-v1'],'weapon',errors)!};DEFS[d.id]=def;
 }
 expect(errors).toEqual([]);const base=arena({mode:'campaign',fog:false,dayNight:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'components-v1',create:createComponentsModule},{id:'sensors-v1',create:createSensorsModule}]);const module=runtime.module('sensors-v1')!,components=runtime.module('components-v1')!;
 const operator=newEnt(game.st,ids[0],0,400,400),target=newEnt(game.st,ids[1],1,700,400);game.hash.rebuild(game.st);
 const step=module.wrapUnitStep!(()=>{}),tick=(dt=1/60)=>{game.st.time+=dt;components.beforeStep?.(dt);module.beforeStep!(dt);for(const e of [...game.st.ents.values()])if(!e.dead)step(e,getDef(e.defId),dt);game.hash.rebuild(game.st);module.afterStep!(dt);components.afterStep?.(dt);};
 const run=(seconds:number)=>{for(let i=0;i<Math.ceil(seconds*60);i++)tick();};
 const order=(action:string,more:any={})=>module.order!({owner:0,ids:[operator.id],action,...more});const drones=()=>[...game.st.ents.values()].filter(e=>e.defId.startsWith('usgr-re-fpv')&&!e.dead);
 return {game,module,components,operator,target,tick,run,order,drones};
}
test('frontline FPV deploys after two seconds and spends one of ten carried recon bodies after source delay',()=>{
 const f=fixture();expect(f.module.render!(f.operator)).toMatchObject({deployed:false});expect(f.order('fpv:deploy')).toBe(true);f.run(1.9);expect(f.drones()).toHaveLength(0);expect(f.module.render!(f.operator)).toMatchObject({deployed:false});f.run(3.4);expect(f.drones()).toHaveLength(1);expect(f.drones()[0].defId).toBe('usgr-re-fpv');expect(f.module.inspect!(f.operator,true).find(r=>r.id==='fpv-stock')!.value).toBe(9);expect(f.module.allowOrder!(f.drones()[0],{kind:'stop'} as any)).toBe(false);
});
test('recon designation launches finite HEAT drone and its distinct primary plus helper phases damage target',()=>{
 const f=fixture();f.order('fpv:deploy');f.run(2.1);expect(f.order('fpv:strategy')).toBe(true);expect(f.order('fpv:target',{targetId:f.target.id})).toBe(true);
 f.run(14);expect(f.module.inspect!(f.operator,true).find(r=>r.id==='fpv-stock')!.value).toBeLessThanOrEqual(8);expect(f.target.hp).toBeLessThan(1e6);expect(f.drones().filter(e=>e.defId!=='usgr-re-fpv')).toHaveLength(0);
 const snapshot=JSON.parse(JSON.stringify(f.module.snapshot())),movement=JSON.parse(JSON.stringify(f.components.snapshot()));f.module.restore(snapshot);f.components.restore(movement);expect(f.module.snapshot()).toEqual(snapshot);
});
test('return consumes time, refunds one actual body and undeploy destroys orphaned drones without refund',()=>{
 const f=fixture();f.order('fpv:deploy');f.run(6);const drone=f.drones()[0];expect(f.module.order!({owner:0,ids:[drone.id],action:'fpv:return'})).toBe(false);
 const snap=f.module.snapshot() as any,ds=snap.fpv.drones.find(([id]:[number])=>id===drone.id)[1];ds.energy=0;ds.nextAuto=f.game.st.time;drone.x=f.operator.x;drone.y=f.operator.y;f.module.restore(snap);f.tick();expect(drone.dead).toBe(true);expect(f.module.inspect!(f.operator,true).find(r=>r.id==='fpv-stock')!.value).toBe(10);
 f.run(5.3);expect(f.drones()).toHaveLength(1);expect(f.order('fpv:deploy')).toBe(true);f.run(3.2);expect(f.drones()).toHaveLength(0);expect(f.module.inspect!(f.operator,true).find(r=>r.id==='fpv-stock')!.value).toBe(9);
});
test('private targets, link, fuel and pending helper payloads are absent from enemy views',()=>{
 const f=fixture();f.order('fpv:deploy');f.run(6);const drone=f.drones()[0],view=f.module.snapshot({visibleEntities:new Set([f.operator.id,drone.id]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any;
 expect(view.fpv.operators[0][1].list).toEqual([]);expect(view.fpv.operators[0][1].goal).toBeUndefined();expect(view.fpv.drones[0][1].source).toBe(0);expect(view.fpv.drones[0][1].energy).toBe(0);expect(view.fpv.payloads).toEqual([]);
 const invalid=f.module.snapshot() as any;invalid.fpv.drones[0][1].energy=1e6;expect(()=>f.module.restore(invalid)).toThrow('Invalid source FPV drone lifecycle');
});
