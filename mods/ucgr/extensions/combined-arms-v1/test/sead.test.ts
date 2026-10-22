import { afterEach, expect, test } from 'bun:test';
import { parseDefinitionPack } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import evidence from '../../../sead-source-data.json';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createSensorsModule, sensorElectronicWarfare } from '../src/sensors';
import { readSensorsDef } from '../src/sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
const ids=['sead-plane','sead-radar',evidence.helper.id,'sead-interceptor'];
afterEach(()=>{for(const id of ids)delete DEFS[id];});
function fixture(mode:'sandbox'|'campaign'='sandbox'){
 const errors:ContentIssue[]=[];
 const sensor=(v:unknown)=>readSensorsDef(v,'sensor',errors)!;
 DEFS[ids[0]]={...getDef('drone'),id:ids[0],speed:156,hp:1200,altitude:80,weapons:[],extensions:{'sensors-v1':sensor({seadCarrier:evidence.carrier})}};
 DEFS[ids[1]]={...getDef('ltank'),id:ids[1],hp:1e6,weapons:[],extensions:{'sensors-v1':sensor({radarControl:{range:40,rangeOn:30,rangeOff:15,switchTime:.5,cooldown:10,interval:.1,weapons:[]}}),'usgr-re.targeting-v1':{tags:['高价值','雷达工作中']}}};
 DEFS[ids[2]]={...getDef('drone'),...evidence.helper,weapons:evidence.helper.weapons.map(w=>({...getDef('drone').weapons[0],...w,projectile:'missile' as const,targets:['ground' as const,'ship' as const]})),extensions:{...evidence.helper.extensions,'sensors-v1':sensor(evidence.helper.extensions['sensors-v1'])}} as typeof DEFS[string];
 DEFS[ids[3]]={...getDef('ltank'),id:ids[3],weapons:[],extensions:{'usgr-re.targeting-v1':{tags:['弹药拦截']},'sensors-v1':sensor({seadHits:[{id:'ahead',ahead:true,missile:false,energy:0}]})}};
 expect(errors).toEqual([]);
 const base=arena({mode,fog:false,dayNight:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'sensors-v1',create:createSensorsModule}]),module=runtime.module('sensors-v1')!;
 const plane=newEnt(game.st,ids[0],0,400,400),radar=newEnt(game.st,ids[1],1,1000,400);game.hash.rebuild(game.st);
 const step=module.wrapUnitStep!(()=>{}),tick=(dt=1/60,move=true)=>{game.st.time+=dt;module.beforeStep!(dt);if(move)for(const e of [...game.st.ents.values()])if(!e.dead)step(e,getDef(e.defId),dt);game.hash.rebuild(game.st);module.afterStep!();};
 const run=(time:number,move=true)=>{for(let i=0;i<Math.ceil(time*60);i++)tick(1/60,move);};
 const equip=()=>module.order!({owner:0,ids:[plane.id],action:'sead:equip'});
 const helpers=()=>[...game.st.ents.values()].filter(e=>e.defId===ids[2]);
 const first=()=>{expect(equip()).toBe(true);for(let i=0;i<120&&!helpers().length;i++)tick(1/60,false);expect(helpers().length).toBeGreaterThan(0);return helpers()[0];};
 return {game,module,plane,radar,tick,run,equip,helpers,first,step};
}
test('source sandbox loadout is explicit and ordinary matches keep the original empty magazine',()=>{
 const {module,plane,equip,run,helpers}=fixture('campaign');run(2);expect(equip()).toBe(false);expect(helpers()).toEqual([]);expect(module.actions!(plane).some(a=>a.id==='sead:equip')).toBe(false);
});
test('source priorities, queue, finite magazine and AGM88 station quirk survive a save',()=>{
 const {game,module,plane,radar,equip,run,helpers}=fixture();expect(equip()).toBe(true);expect(sensorElectronicWarfare(game,plane)).toBe(true);
 expect(helpers()).toHaveLength(0);run(.5,false);expect(helpers()).toHaveLength(0);run(.15,false);expect(helpers()).toHaveLength(1);expect(helpers()[0].y).toBeCloseTo(412);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));expect(()=>module.restore(saved)).not.toThrow();run(5,false);
 expect(helpers()).toHaveLength(4);expect(helpers().slice(1).every(e=>e.y===388)).toBe(true);expect(module.inspect!(plane,true).find(r=>r.id==='source-sead-magazine')!.value).toBe(0);
 run(5,false);expect(helpers()).toHaveLength(4);expect(radar.hp).toBe(1e6);
});
test('source missile owns movement, altitude, permanent radar loss and finite energy deletion',()=>{
 const {game,module,radar,first,tick,run}=fixture(),missile=first();const start=missile.x;
 tick(.1);expect(missile.x).toBeGreaterThan(start);expect((module.render!(missile) as any).flight.altitude).toBe(0);
 expect(module.allowOrder!(missile,{kind:'stop'} as any)).toBe(false);
 expect(module.order!({owner:1,ids:[radar.id],action:'radar:toggle',on:false})).toBe(true);run(.6);let snap=module.snapshot() as any;expect(snap.sead.missiles.find(([id]:[number])=>id===missile.id)[1].lost).toBe(true);
 // Returning emission cannot undo the source's permanent 脱锁 tag.
 const controls=snap.radarControls;controls.find(([id]:[number])=>id===radar.id)[1].active=true;module.restore(snap);
 run(1.6);expect(missile.dead).toBe(true);expect(radar.hp).toBe(1e6);expect(game.st.effects).toHaveLength(0);
});
test('source primary direct+area and delayed expanding TAM HP events remain distinct',()=>{
 const {game,module,radar,first,tick,run}=fixture(),missile=first();radar.x=missile.x+20;radar.y=missile.y;
 const near=newEnt(game.st,ids[1],1,radar.x+10,radar.y);game.hash.rebuild(game.st);tick(1/60);
 expect(radar.hp).toBeCloseTo(1e6-6-480);expect(near.hp).toBeCloseTo(1e6-480*(1.1-10/48));
 expect((module.render!(missile) as any).hidden).toBe(true);expect(module.filterVisibility!(missile,0,true)).toBe(false);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));module.restore(saved);run(.1);expect(radar.hp).toBeCloseTo(1e6-486);
 run(.4);expect(radar.hp).toBeCloseTo(1e6-486-300);expect(near.hp).toBeCloseTo(1e6-480*(1.1-10/48)-300*.6);
 run(1);expect(missile.dead).toBe(true);
});
test('HP cannot kill a source missile; original AHEAD and interceptor events drain energy instead',()=>{
 const {game,module,first,plane,radar}=fixture(),missile=first(),attacker=newEnt(game.st,ids[3],1,700,400);
 let dealt=-1;const damage=module.wrapDamage!((_s,_e,raw)=>{dealt=raw;});damage(game.st,missile,1e8,undefined,0,plane.id,plane.defId+'/ordinary');expect(dealt).toBe(0);expect(missile.dead).toBeUndefined();
 damage(game.st,missile,100,undefined,1,attacker.id,attacker.defId+'/ahead');const snap=module.snapshot() as any;expect(snap.sead.missiles.find(([id]:[number])=>id===missile.id)[1].energy).toBe(294);
 expect(module.canFire!(plane,getDef(plane.defId),getDef('ltank').weapons[0],missile,missile)).toBe(false);
 expect(module.canFire!(radar,getDef(radar.defId),getDef('ltank').weapons[0],missile,missile)).toBe(true);
 const view=module.snapshot({visibleEntities:new Set([missile.id]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any;
 expect(view.sead.controllers).toEqual([]);expect(view.sead.blasts).toEqual([]);expect(view.sead.missiles[0][1].target).toBe(0);expect(view.sead.missiles[0][1].targetHeight).toBe(view.sead.missiles[0][1].height);
});

test('source helper shape passes the native content definition parser without seeded defaults',()=>{
 const def=JSON.parse(JSON.stringify(evidence.helper));delete def.extensions;for(const w of def.weapons)delete w.extensions;
 const result=parseDefinitionPack({format:'steel-tide-mod',v:2,id:'sead-native-shape',name:'SEAD',version:'1',defs:[def]});
 if(!result.ok)throw Error(JSON.stringify(result.errors));
 expect(result.pack.defs[0].weapons).toHaveLength(2);
});
