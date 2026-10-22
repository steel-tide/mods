import { getDef, targetCat, TILE } from './host';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Json, ModuleAction, ModuleHost, ModuleOrder, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { SensorsDef } from './sensorsSpec';
import { record } from './sensorsSpec';

export interface RadarControlSpec { initial?:boolean; range:number; rangeOn:number; rangeOff:number; switchTime:number; cooldown:number; groundRange?:number; groundTime?:number; interval:number; weapons:{id:string;mode:'air'|'ground'|'target'}[]; }
interface RadarControlState { active:boolean; ready:number; pending?:{active:boolean;ready:number}; ground:boolean; modePending?:{ground:boolean;ready:number}; nextScan:number; }
const readers=new WeakMap<Game,(e:Ent)=>boolean|undefined>();
export const sensorRadarActive=(game:Game,e:Ent):boolean|undefined=>readers.get(game)?.(e);
/** The source radar action changes its emitted tag and the global engagement
 * envelope together; powering down does not automatically forbid optical guns. */
export function createRadarControls(host:ModuleHost){
 const st=host.game.st,states=new Map<number,RadarControlState>();
 const config=(e:Ent)=>host.config<SensorsDef>(getDef(e.defId))?.radarControl;
 function state(e:Ent){let s=states.get(e.id);if(!s){s={active:config(e)?.initial??true,ready:0,ground:false,nextScan:st.time};states.set(e.id,s);}return s;}
 const active=(e:Ent)=>config(e)?states.get(e.id)?.active??config(e)?.initial??true:undefined;
 readers.set(host.game,active);
 return {
  active,
  emitting(e:Ent,from:{x:number;y:number}):boolean{const c=config(e);return !!c&&active(e)===true&&Math.hypot(e.x-from.x,e.y-from.y)<=c.range*TILE;},
  beforeStep(){for(const e of host.participants()){const c=config(e);if(!c||e.dead)continue;const s=state(e);
   if(s.pending&&st.time+1e-9>=s.pending.ready){s.active=s.pending.active;s.ready=st.time+c.cooldown;delete s.pending;}
   if(s.modePending&&st.time+1e-9>=s.modePending.ready){s.ground=s.modePending.ground;delete s.modePending;}
   if(c.groundRange===undefined||e.inside||s.modePending||st.time+1e-9<s.nextScan)continue;
   s.nextScan=st.time+c.interval;
   const target=st.ents.get(e.targetId),ground=!!target&&!target.dead&&targetCat(st,target)!=='air'&&Math.hypot(e.x-target.x,e.y-target.y)<c.groundRange*TILE;
   // Source AA→ground checks proximity; ground→AA only checks missing/air
   // target, deliberately keeping the ground state if that target retreats.
   const desired=s.ground?(!!target&&!target.dead&&targetCat(st,target)!=='air'):ground;
   if(desired!==s.ground){if(c.groundTime)s.modePending={ground:desired,ready:st.time+c.groundTime};else s.ground=desired;}
  }},
  effectiveDef(e:Ent,def:UnitDef):UnitDef{const c=config(e);if(!c)return def;const s=state(e),range=s.ground&&c.groundRange!==undefined?c.groundRange:s.active?c.rangeOn:c.rangeOff;
   return {...def,weapons:def.weapons.map(w=>({...w,range:Math.min(w.range,range)}))};
  },
  canFire(e:Ent,w:WeaponDef,point:{x:number;y:number},target:Ent|null):boolean{const c=config(e);if(!c)return true;const s=state(e),mode=c.weapons.find(a=>a.id===w.id)?.mode;
   const range=s.ground&&c.groundRange!==undefined?c.groundRange:s.active?c.rangeOn:c.rangeOff;
   return range>0&&Math.hypot(point.x-e.x,point.y-e.y)<=range*TILE&&(!mode||s.ground===(mode==='target'?(!target||targetCat(st,target)!=='air'):mode==='ground'));
  },
  actions(e:Ent):ModuleAction[]{if(!config(e)||e.dead||e.inside||e.site)return[];const s=state(e);return [{id:'radar:toggle',label:s.active?['Radar On — turn off','雷达已开启 — 关闭','레이더 켜짐 — 끄기']:['Radar Off — turn on','雷达已关闭 — 开启','레이더 꺼짐 — 켜기'],enabled:!s.pending&&st.time>=s.ready}];},
  order(e:Ent,o:ModuleOrder):boolean{const c=config(e);if(!c||o.action!=='radar:toggle'||e.dead||e.inside||e.site)return false;const s=state(e);if(s.pending||st.time<s.ready)return false;const value=o.on??!s.active;if(value===s.active)return false;s.pending={active:value,ready:st.time+c.switchTime};return true;},
  hasState:()=>states.size>0,
  snapshot(view?:RuntimeView):Json{return [...states].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{active:s.active,ground:s.ground,ready:0,nextScan:0}]) as unknown as Json;},
  restore(value:unknown){states.clear();if(value===undefined)return;if(!Array.isArray(value)||value.length>st.ents.size)throw Error('Invalid source radar controls');const finite=(v:unknown,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
   for(const entry of value){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source radar');const e=st.ents.get(entry[0]),c=e&&config(e),s=entry[1];if(!e||!c||states.has(e.id)||typeof s.active!=='boolean'||typeof s.ground!=='boolean'||s.ground&&c.groundRange===undefined||!finite(s.ready,st.time+c.cooldown+.1)||!finite(s.nextScan,st.time+c.interval+.1))throw Error('Invalid source radar state');const n:RadarControlState={active:s.active,ground:s.ground,ready:s.ready,nextScan:s.nextScan};
    if(s.pending!==undefined){if(!record(s.pending)||typeof s.pending.active!=='boolean'||!finite(s.pending.ready,st.time+c.switchTime+.1))throw Error('Invalid radar action');n.pending={active:s.pending.active,ready:s.pending.ready};}
    if(s.modePending!==undefined){if(!record(s.modePending)||typeof s.modePending.ground!=='boolean'||c.groundRange===undefined||!finite(s.modePending.ready,st.time+(c.groundTime??0)+.1))throw Error('Invalid radar ground mode');n.modePending={ground:s.modePending.ground,ready:s.modePending.ready};}states.set(e.id,n);
   }
  },
  afterStep(){for(const id of states.keys())if(!st.ents.has(id))states.delete(id);},
  dispose(){readers.delete(host.game);},
 };
}
