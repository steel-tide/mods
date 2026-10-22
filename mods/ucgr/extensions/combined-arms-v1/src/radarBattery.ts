import { cmdAttack, getDef, kill, normAngle } from './host';
import { logisticsStock } from './logistics';
import { sensorAltitude } from './flightControls';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Json, ModuleAction, ModuleHost, ModuleOrder, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { record, type SensorsDef } from './sensorsSpec';
export type RadarBatterySpec = {interval:number;linkRange:number} & ({role:'provider';range:number;acceptRange:number;scanInterval:number;scanLimit:number;lateral:number;indexDistance:boolean;listCap:number;hpTransfer:number;spin:number}|{role:'launcher';stock:string;high:number;low:number;helicopter:number;waypointTime:number});
interface State { deployed:boolean;provider:number;launchers:number[];targets:number[];queue:number[];positions:number[];issued:number;expires:number;next:number;scan:number;counter:number;phase:number;previousPhase:number; }
const readers=new WeakMap<Game,(e:Ent)=>boolean|undefined>();
export const sensorDeployed=(game:Game,e:Ent)=>readers.get(game)?.(e);
/** A private data link, independent of native sight. The source's collection
 * action takes HP and defaults to one candidate, including a candidate that
 * later fails the binding condition. This preserves that authored behavior. */
export function createRadarBattery(host:ModuleHost,active:(e:Ent)=>boolean|undefined){
 const st=host.game.st,states=new Map<number,State>(),references=new Map<number,Ent['orders']>();
 const config=(e:Ent)=>host.config<SensorsDef>(getDef(e.defId))?.radarBattery;
 const team=(e:Ent)=>st.players[e.owner]?.team;
 const alive=(e:Ent|undefined):e is Ent=>!!e&&!e.dead&&!e.inside;
 function state(e:Ent){let s=states.get(e.id);if(!s){s={deployed:false,provider:0,launchers:[],targets:[],queue:[],positions:[],issued:0,expires:0,next:st.time,scan:st.time,counter:0,phase:0,previousPhase:0};states.set(e.id,s);}return s;}
 const deployed=(e:Ent)=>{const c=config(e);return c?c.role==='provider'?active(e)===true:state(e).deployed:undefined;};
 readers.set(host.game,deployed);
 const ready=(e:Ent)=>{const c=config(e);return c?.role==='launcher'&&alive(e)&&deployed(e)&&!e.holdFire&&(logisticsStock(host.game,e,c.stock)?.amount??0)>0;};
 const distance=(a:Ent,b:Ent)=>Math.hypot(a.x-b.x,a.y-b.y);
 function drop(e:Ent,s:State){const current=e.orders[0];if(current?.kind==='attack'){e.orders.shift();e.targetId=0;e.manualTargetId=undefined;const refs=references.get(e.id)??[],at=refs.indexOf(current);if(at>=0){refs.splice(at,1);s.queue.splice(at,1);}}s.issued=0;s.expires=0;}
 // RW OrderableUnit.ap keeps at most 29 waypoints and silently discards later appends.
 const WAYPOINT_LIMIT=29;
 function append(e:Ent,s:State,target:Ent){if(e.orders.length>=WAYPOINT_LIMIT)return;const before=e.orders.length;cmdAttack(host.game,[e.id],target.id,true);const order=e.orders.at(-1);if(e.orders.length<=before||order?.kind!=='attack')return;let refs=references.get(e.id);if(!refs){refs=[];references.set(e.id,refs);}refs.push(order);s.queue.push(target.id);}
 function forward(e:Ent,s:State,c:Extract<RadarBatterySpec,{role:'provider'}>){
  for(let i=0;i<s.targets.length;i++){
   const target=st.ents.get(s.targets[i]),launcher=st.ents.get(s.launchers[i%s.launchers.length]);
   if(!alive(target)||!alive(launcher)||c.indexDistance&&i>=s.launchers.length)continue;
   const lc=config(launcher);if(lc?.role!=='launcher')continue;
   const sensor=host.config<SensorsDef>(getDef(target.defId));
   const range=sensor?.fixedWing?(sensorAltitude(host.game,target)==='high'?lc.high:lc.low):lc.helicopter;
   if(distance(target,launcher)>range)continue;
   // The second BUK/SLM recipient is index%size+1 without wrapping; with
   // source collection's default one candidate it is null and receives none.
   const ls=state(launcher);append(launcher,ls,target);
  }
 }
 return {
  deployed,
  visual(e:Ent){const c=config(e);return c?.role==='provider'?{radarHeading:normAngle(e.angle+state(e).phase),radarPreviousHeading:normAngle((e.prevAngle??e.angle)+state(e).previousPhase)}:{};},
  effectiveDef(e:Ent,d:UnitDef):UnitDef{return deployed(e)?{...d,speed:0}:d;},
  canFire(e:Ent):boolean{const c=config(e);return !c||c.role==='launcher'&&deployed(e)===true;},
  canAcquire(e:Ent):boolean{return config(e)?.role!=='launcher';},
  canTrack(e:Ent,target:Ent):boolean{const s=states.get(e.id);return !!s&&s.issued===target.id&&alive(target)&&st.time<s.expires;},
  onShot(e:Ent){if(config(e)?.role==='launcher')drop(e,state(e));},
  beforeStep(dt:number){
   for(const e of host.participants()){
    const c=config(e);if(!c||!alive(e))continue;const s=state(e);if(c.role==='provider'){s.previousPhase=s.phase;s.phase=normAngle(s.phase+c.spin*dt);}
    if(deployed(e)&&e.orders[0]&&['move','guard'].includes(e.orders[0].kind)){e.orders=[];e.targetId=0;s.queue=[];s.issued=0;}
    if(c.role==='launcher'){
     const provider=st.ents.get(s.provider);if(!alive(provider)||distance(provider,e)>c.linkRange)s.provider=0;
     const refs=references.get(e.id)??[];
     for(let i=refs.length-1;i>=0;i--)if(!e.orders.includes(refs[i])){refs.splice(i,1);s.queue.splice(i,1);}
     const at=refs.indexOf(e.orders[0]),issued=at>=0?s.queue[at]:0;
     if(issued!==s.issued){s.issued=issued;s.expires=issued?st.time+c.waypointTime:0;}
     const order=e.orders[0],target=order?.kind==='attack'?st.ents.get(order.targetId):undefined;
     if(order?.kind==='attack'&&(!alive(target)||s.issued&&st.time>=s.expires||deployed(e)&&distance(e,target)>c.high||(logisticsStock(host.game,e,c.stock)?.amount??0)===0))drop(e,s);
     continue;
    }
    if(st.time+1e-9>=s.next){s.next=st.time+c.interval;s.launchers=[];
     for(const launcher of st.ents.values()){
      if(!ready(launcher)||team(launcher)!==team(e)||distance(e,launcher)>c.linkRange||launcher.hp<c.hpTransfer)continue;
      launcher.hp-=c.hpTransfer;e.hp=Math.min(getDef(e.defId).hp,e.hp+c.hpTransfer);if(launcher.hp<=0)kill(st,launcher);
      const ls=state(launcher);if(!ls.provider||ls.provider===e.id){ls.provider=e.id;s.launchers.push(launcher.id);}
      break;
     }
     if(s.targets.length){s.counter++;forward(e,s,c);if(s.counter>1){s.targets=[];s.counter=0;}}
    }
    if(active(e)!==true||st.time+1e-9<s.scan)continue;
    s.scan=st.time+c.scanInterval;let n=0;const a=e.angle+Math.PI/2,x=e.x+Math.cos(a)*c.lateral,y=e.y+Math.sin(a)*c.lateral;
    for(const target of st.ents.values()){
     if(!alive(target)||team(target)===team(e)||Math.hypot(x-target.x,y-target.y)>c.range)continue;
     const signature=host.config<SensorsDef>(getDef(target.defId))?.signatures.find(s=>s.channel==='usgr-re-radar')?.strength??0;
     if(signature<1)continue;if(n>=c.scanLimit)break;
     const index=n++;if(distance(e,target)<c.acceptRange){while(s.targets.length<=index)s.targets.push(0);s.targets[index]=target.id;}
    }
   }
  },
  actions(e:Ent):ModuleAction[]{return config(e)?.role==='launcher'&&alive(e)?[{id:'battery:deploy',label:deployed(e)?['Undeploy','取消部署','배치 해제']:['Deploy','部署','배치'],enabled:true}]:[];},
  order(e:Ent,o:ModuleOrder):boolean{if(o.action!=='battery:deploy'||config(e)?.role!=='launcher'||!alive(e))return false;const s=state(e);s.deployed=o.on??!s.deployed;return true;},
  hasState:()=>states.size>0,
  snapshot(view?:RuntimeView):Json{for(const [id,s] of states){const e=st.ents.get(id);s.positions=(references.get(id)??[]).map(ref=>e?.orders.indexOf(ref)??-1);}return [...states].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{...s,provider:0,launchers:[],targets:[],queue:[],positions:[],issued:0,expires:0,next:0,scan:0,counter:0}]) as unknown as Json;},
  restore(value:unknown){states.clear();references.clear();if(value===undefined)return;if(!Array.isArray(value)||value.length>st.ents.size)throw Error('Invalid source battery state');const ids=(x:unknown):x is number[]=>Array.isArray(x)&&x.length<=32768&&x.every(v=>Number.isSafeInteger(v)&&v>=0);
   for(const entry of value){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source battery entry');const e=st.ents.get(entry[0]),s=entry[1],c=e&&config(e);
    if(!e||!c||states.has(e.id)||typeof s.deployed!=='boolean'||!Number.isSafeInteger(s.provider)||!Number.isSafeInteger(s.issued)||!ids(s.launchers)||s.launchers.length>1||!ids(s.targets)||s.targets.length>100||!ids(s.queue)||!Array.isArray(s.positions)||s.positions.length!==s.queue.length||s.positions.some(v=>!Number.isInteger(v)||Number(v)<-1||Number(v)>=e.orders.length)||![s.phase,s.previousPhase].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=Math.PI)||![s.expires,s.next,s.scan,s.counter].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)||Number(s.expires)>st.time+5.1||Number(s.next)>st.time+c.interval+.1||Number(s.scan)>st.time+1||Number(s.counter)>1)throw Error('Invalid source radar battery');
    const indices=s.positions as number[],queue=s.queue as number[];for(let i=0;i<indices.length;i++)if(indices[i]>=0){const order=e.orders[indices[i]];if(order.kind!=='attack'||order.targetId!==queue[i])throw Error('Invalid radar waypoint reference');}
    const valid=indices.map((index,i)=>({index,target:queue[i]})).filter(v=>v.index>=0);states.set(e.id,{...s,launchers:[...s.launchers],targets:[...s.targets],queue:valid.map(v=>v.target),positions:valid.map(v=>v.index)} as unknown as State);references.set(e.id,valid.map(v=>e.orders[v.index]));
   }
  },
  afterStep(){for(const id of states.keys())if(!alive(st.ents.get(id))){states.delete(id);references.delete(id);}},
  dispose(){readers.delete(host.game);},
 };
}
