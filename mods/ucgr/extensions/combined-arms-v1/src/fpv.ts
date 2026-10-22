import { DEFS, getDef, kill, newEnt } from './host';
import { allocateSourceHelperIdentity, bindSourceHelperIdentity, stepSourceMovement } from './components';
import { sourceEntityTags } from './targeting';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { Json, ModuleAction, ModuleHost, ModuleOrder, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { FpvOperatorSpec, FpvDroneSpec } from './fpvSpec';
import { record, type SensorsDef } from './sensorsSpec';
interface Goal {x:number;y:number;target:number;attack:boolean}
interface Operator {born:number;deployed:boolean;pending?:boolean;ready:number;stock:number;strategy:number;list:number[];recon:boolean;reconAt:number;attackAt:number;target:number;check:number;reconReady:number;goal?:Goal}
interface Drone {source:number;born:number;energy:number;returning:boolean;height:number;targetHeight:number;phase:number;low:boolean;target:number;goals:Goal[];timers:Record<string,number>;nextAuto:number;ready:number;impact?:number}
interface Payload {definition:string;weapon:string;owner:number;source:number;x:number;y:number;angle:number;ready:number;helper:number}
const readers=new WeakMap<Game,(e:Ent)=>boolean|undefined>();
export function sensorFpvDeployed(game:Game,e:Ent):boolean|undefined{return readers.get(game)?.(e);}
/** Original operator messages and three drone unit lifecycles. The host receives
 * actual helper entities; arbitrary RW expressions never execute. */
export function createFpv(host:ModuleHost){
 const st=host.game.st,operators=new Map<number,Operator>(),drones=new Map<number,Drone>(),payloads:Payload[]=[];
 const config=(e:Ent)=>host.config<SensorsDef>(getDef(e.defId));
 const live=(e:Ent|undefined):e is Ent=>!!e&&!e.dead&&!e.inside;
 const tags=(e:Ent)=>sourceEntityTags(host.game,e),team=(e:Ent)=>st.players[e.owner]?.team;
 const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
 function operator(e:Ent,c:FpvOperatorSpec){let s=operators.get(e.id);if(!s){s={born:st.time,deployed:false,ready:0,stock:c.stock,strategy:0,list:[],recon:false,reconAt:st.time,attackAt:st.time,target:0,check:st.time,reconReady:0};operators.set(e.id,s);}return s;}
 readers.set(host.game,e=>{const c=config(e)?.fpvOperator;return c?operator(e,c).deployed:undefined;});
 function removed(e:Ent,s:Drone,refund=false){
  const parent=st.ents.get(s.source),ps=operators.get(s.source);if(ps){if(refund){ps.stock++;ps.reconAt=st.time;}ps.list=ps.list.filter(id=>id!==e.id&&live(st.ents.get(id)));ps.target=0;if(config(e)?.fpvDrone?.role==='recon')ps.recon=false;}
  // Source deleteSelf runs destroyed messages without an explosion or wreck.
  if(refund){e.hp=0;e.dead=true;e.orders=[];}else if(!e.dead)kill(st,e);
  drones.delete(e.id);void parent;
 }
 function spawn(e:Ent,s:Operator,c:FpvOperatorSpec,index:number){const drone=newEnt(st,c.drones[index],e.owner,e.x,e.y,e.angle),dc=config(drone)!.fpvDrone!;
  drones.set(drone.id,{source:e.id,born:st.time,energy:dc.energy,returning:false,height:0,targetHeight:dc.height,phase:0,low:false,target:0,goals:[],timers:{},nextAuto:st.time,ready:0});s.stock--;s.list.push(drone.id);if(index===0){s.recon=true;s.reconAt=st.time;}else s.attackAt=st.time;
 }
 function message(e:Ent,s:Drone,target:Ent){const parent=st.ents.get(s.source),ps=operators.get(s.source),pc=parent&&config(parent)?.fpvOperator;
  if(!live(parent)||!ps||!pc||!ps.deployed||ps.strategy!==1||ps.stock<1||st.time-ps.attackAt<=pc.attackDelay||ps.list.length>2)return;
  ps.target=target.id;spawn(parent,ps,pc,tags(target).includes('装甲')?1:2);
 }
 function impact(e:Ent,s:Drone,c:FpvDroneSpec,target:Ent){
  const p:Proj={x:target.x,y:target.y,px:e.x,py:e.y,tx:target.x,ty:target.y,angle:e.angle,speed:0,homing:false,targetId:target.id,kind:'flame',dmg:0,splash:0,owner:e.owner,team:team(e)??-1,ttl:0,hitsAir:false,hitsGround:true,hitsSub:false,src:s.source,gun:e.defId+'/primary'};
  host.resolveImpact(st,host.game.hash,p,target,true);
  for(const payload of c.payloads)if(payload.chance>=1||st.rng.chance(payload.chance)){const helper=allocateSourceHelperIdentity(host.game);if(helper!==undefined)payloads.push({definition:e.defId,weapon:payload.weapon,owner:e.owner,source:s.source,x:target.x,y:target.y,angle:e.angle,ready:st.time+payload.delay,helper});}
  s.impact=st.time+.05;s.height=0;s.goals=[];e.orders=[];
 }
 function goalOf(s:Drone):Goal|undefined{while(s.goals.length){const goal=s.goals[0];if(goal.target){const e=st.ents.get(goal.target);if(!live(e)){s.goals.shift();continue;}return{...goal,x:e.x,y:e.y};}return goal;}return;}
 function step(e:Ent,dt:number):boolean{
  const c=config(e)?.fpvDrone;if(!c)return false;const s=drones.get(e.id);if(!s){e.dead=true;return true;}if(e.dead){removed(e,s);return true;}
  if(s.impact!==undefined){if(st.time>=s.impact)removed(e,s);return true;}
  const script=st.time+1e-9>=s.nextAuto;let fired=false;const automatic=(_key:string,condition:boolean,action:()=>void)=>{if(script&&condition){fired=true;action();}};
  const parent=st.ents.get(s.source),ps=operators.get(s.source),pc=parent&&config(parent)?.fpvOperator;
  if(!live(parent)||!ps?.deployed||!pc){if(script)removed(e,s);else stepSourceMovement(host.game,e,getDef(e.defId),dt,goalOf(s));return true;}
  automatic('patrol',s.goals.length===0,()=>{s.goals.push({x:e.x-Math.sin(e.angle)*60,y:e.y+Math.cos(e.angle)*60,target:0,attack:true});});
  s.energy=Math.max(0,Math.min(c.energy,s.energy+c.regen*dt));
  automatic('link',distance(e,parent)>pc.range,()=>{s.energy=Math.max(0,s.energy-c.linkDrain);});
  // Return is tested before attack-drone depletion, as in the original template.
  if(script&&(s.energy===0||s.returning)&&distance(e,parent)<=20){removed(e,s,true);return true;}
  if(script&&s.energy===0&&c.role==='attack'){removed(e,s);return true;}
  automatic('return',s.energy===0&&st.time-s.born>=5&&c.role==='recon',()=>{s.returning=true;s.goals=[{x:parent.x,y:parent.y,target:parent.id,attack:false}];});
  const danger=[...st.ents.values()].some(t=>live(t)&&((team(t)!==team(e)&&distance(e,t)<=100&&(tags(t).includes('装甲')||tags(t).includes('soldiers')))||(distance(e,t)<=80&&tags(t).includes('林区'))));
  automatic('low',!danger&&!s.low,()=>{s.low=true;s.targetHeight=10;});automatic('high',danger&&s.low,()=>{s.low=false;s.targetHeight=20;});
  // Custom AIR defaults: 2 degrees/frame bob, 1.5 source-pixel drift and
  // adaptive vertical rate, rather than a native fixed altitude fraction.
  s.phase=(s.phase+dt*120)%360;const height=s.targetHeight/.4+Math.sin(s.phase*Math.PI/180)*1.5,z=s.height/.4;
  const rate=Math.min(Math.abs(z-2)*.02+.2,Math.abs(z-height)*.015+.1)*60*dt;s.height=(z+Math.sign(height-z)*Math.min(Math.abs(height-z),rate))*.4;e.alt=1;
  if(c.role==='recon'){
   const referenced=ps.goal?.target?st.ents.get(ps.goal.target):undefined,parentGoal=ps.goal?{...ps.goal,...(live(referenced)?{x:referenced.x,y:referenced.y}:{})}:undefined;automatic('command',!!parentGoal&&!s.returning&&distance(e,parentGoal)>20,()=>{s.goals[0]={...parentGoal!};});
   if(ps.strategy!==0&&!s.returning){const def=getDef(e.defId),w=def.weapons[0],explicit=goalOf(s),candidate=explicit?.attack?st.ents.get(explicit.target):undefined;
    const allowed=(t:Ent)=>live(t)&&team(t)!==team(e)&&getDef(t.defId).domain!=='air'&&!tags(t).some(t=>t==='dest'||t==='隐蔽');
    let target=candidate&&allowed(candidate)?candidate:st.ents.get(host.acquireTarget(st,host.game.hash,e,def,1,false,allowed,undefined,undefined,w));
    if(target&&distance(e,target)<=c.range&&st.time>=s.ready){s.target=target.id;s.ready=st.time+c.reload;message(e,s,target);}
   }
  }else{
   automatic('command',!!ps.target&&st.time-(s.timers.commandAt??s.born)>1,()=>{s.timers.commandAt=st.time;const target=st.ents.get(ps.target);if(live(target))s.goals.unshift({x:target.x,y:target.y,target:target.id,attack:true});});
  }
  if(fired)s.nextAuto=st.time+1;
  const goal=goalOf(s);if(goal){const target=goal.target?st.ents.get(goal.target):undefined;
   if(c.role==='attack'&&live(target)&&distance(e,target)<=c.range){impact(e,s,c,target);return true;}
   const stop=goal.attack&&live(target)?c.range:6.4;
   if(distance(e,goal)<=stop){if(!goal.attack||!target)s.goals.shift();stepSourceMovement(host.game,e,getDef(e.defId),dt,{x:e.x,y:e.y,stopRange:0});}
   else if(!stepSourceMovement(host.game,e,getDef(e.defId),dt,{x:goal.x,y:goal.y,stopRange:stop}))throw Error('FPV source movement profile unavailable');
  }else stepSourceMovement(host.game,e,getDef(e.defId),dt,{x:e.x,y:e.y,stopRange:0});
  return true;
 }
 return {
  step,
  effectiveDef(e:Ent,d:UnitDef):UnitDef{const cfg=config(e);if(cfg?.fpvDrone)return{...d,weapons:[],altitude:drones.get(e.id)?.height??0};const c=cfg?.fpvOperator;if(c){const s=operator(e,c);if(s.deployed||s.pending!==undefined)return{...d,speed:0};}return d;},
  allowOrder(e:Ent){return !config(e)?.fpvDrone;},
  deployed(e:Ent){const c=config(e)?.fpvOperator;return c?operator(e,c).deployed:undefined;},
  beforeStep(){
   for(const e of host.participants()){const c=config(e)?.fpvOperator;if(!c||!live(e))continue;const s=operator(e,c);
    if(s.pending!==undefined&&st.time>=s.ready){s.deployed=s.pending;delete s.pending;}
    if(st.time+1e-9<s.check)continue;s.check=st.time+c.check;
    const native=e.orders[0];if(native?.kind==='move')s.goal={x:native.x,y:native.y,target:0,attack:false};
    if(s.target){const target=st.ents.get(s.target);if(!live(target)||tags(target).includes('dest')||distance(e,target)>c.range)s.target=0;}
    if(s.goal?.target){const target=st.ents.get(s.goal.target);if(!live(target)||distance(e,target)>c.range)delete s.goal;}
    if(s.deployed&&!s.recon&&s.stock!==0&&st.time-s.reconAt>c.reconDelay&&s.list.length<=3&&st.time>=s.reconReady){s.reconReady=st.time+c.cooldown;spawn(e,s,c,0);}
   }
   for(let i=payloads.length-1;i>=0;i--){const b=payloads[i];if(st.time<b.ready)continue;const p:Proj={x:b.x,y:b.y,px:b.x,py:b.y,tx:b.x,ty:b.y,angle:b.angle,speed:0,homing:false,targetId:0,kind:'flame',dmg:0,splash:0,owner:b.owner,team:st.players[b.owner]?.team??-1,ttl:0,hitsAir:false,hitsGround:true,hitsSub:false,src:b.source,gun:b.definition+'/'+b.weapon};bindSourceHelperIdentity(host.game,p,b.helper);host.resolveImpact(st,host.game.hash,p,null,true);payloads.splice(i,1);}
  },
  afterStep(){for(const [id,s]of drones){const e=st.ents.get(id);if(e?.dead)removed(e,s);else if(!e)drones.delete(id);}for(const id of operators.keys())if(!live(st.ents.get(id)))operators.delete(id);},
  actions(e:Ent):ModuleAction[]{const c=config(e)?.fpvOperator;if(c){const s=operator(e,c),labels=[['Strategy: Recon Only','策略：仅侦察','전략: 정찰만'],['Strategy: Recon & Attack','策略：侦察与攻击','전략: 정찰 및 공격']];return[{id:'fpv:deploy',label:s.deployed?['Undeploy','撤离','배치 해제']:['Deploy','部署','배치'],enabled:s.pending===undefined},...(s.deployed?[{id:'fpv:strategy',label:labels[s.strategy],enabled:true},{id:'fpv:target',label:['Attack','攻击','공격'],enabled:true,target:'enemy' as const},{id:'fpv:move',label:['Reconnaissance waypoint','侦察路径点','정찰 경유지'],enabled:true,target:'ground' as const}]:[])];}
   const d=config(e)?.fpvDrone,s=drones.get(e.id);return d?.role==='recon'&&s?[{id:'fpv:return',label:['Return to base','返回基地','기지로 복귀'],enabled:st.time-s.born>30}]:[];},
  order(e:Ent,o:ModuleOrder){const c=config(e)?.fpvOperator;if(c){const s=operator(e,c);if(o.action==='fpv:deploy'&&s.pending===undefined){s.pending=o.on??!s.deployed;s.ready=st.time+c.deployTime;return true;}if(!s.deployed)return false;
    if(o.action==='fpv:strategy'){s.strategy=1-s.strategy;return true;}if(o.action==='fpv:target'){const target=st.ents.get(o.targetId??0);if(!live(target)||team(target)===team(e)||!host.visible(target,team(e)??-1)||distance(e,target)>c.range||getDef(target.defId).domain==='air')return false;s.goal={x:target.x,y:target.y,target:target.id,attack:true};return true;}
    if(o.action==='fpv:move'&&Number.isFinite(o.x)&&Number.isFinite(o.y)){s.goal={x:o.x!,y:o.y!,target:0,attack:false};return true;}
   }const d=config(e)?.fpvDrone,s=drones.get(e.id),parent=s&&st.ents.get(s.source);if(o.action==='fpv:return'&&d?.role==='recon'&&s&&live(parent)&&st.time-s.born>30){s.returning=true;s.goals=[{x:parent.x,y:parent.y,target:parent.id,attack:false}];return true;}return false;},
  inspect(e:Ent){const c=config(e)?.fpvOperator;if(!c)return[];const s=operator(e,c);return[{id:'fpv-stock',label:['FPV Count','FPV数量','FPV 수량'],value:s.stock}];},
  render(e:Ent){const s=drones.get(e.id);return s?{flight:{altitude:s.height},hidden:s.impact!==undefined}:undefined;},
  hasState:()=>operators.size>0||drones.size>0||payloads.length>0,
  snapshot(view?:RuntimeView):Json{return{operators:[...operators].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{...s,stock:0,strategy:0,list:[],recon:false,target:0,goal:undefined,ready:0,pending:undefined}]),drones:[...drones].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{...s,source:0,energy:0,target:0,goals:[],timers:{},nextAuto:0,returning:false,ready:0}]),payloads:view?[]:payloads} as unknown as Json;},
  restore(value:unknown){operators.clear();drones.clear();payloads.length=0;if(value===undefined)return;if(!record(value)||!Array.isArray(value.operators)||!Array.isArray(value.drones)||!Array.isArray(value.payloads)||value.operators.length>st.ents.size||value.drones.length>st.ents.size||value.payloads.length>st.ents.size*4+16)throw Error('Invalid FPV state');
   const finite=(v:unknown,min=0,max=1e12):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
   const integer=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>finite(v,0,max)&&Number.isSafeInteger(v);
   const goal=(v:unknown):v is Goal=>record(v)&&finite(v.x,-1e6,1e6)&&finite(v.y,-1e6,1e6)&&integer(v.target)&&typeof v.attack==='boolean';
   for(const entry of value.operators){if(!Array.isArray(entry)||!integer(entry[0])||!record(entry[1]))throw Error('Invalid FPV operator');const e=st.ents.get(entry[0]),c=e&&config(e)?.fpvOperator,s=entry[1];if(!e||!c||operators.has(e.id)||!finite(s.born,0,st.time)||typeof s.deployed!=='boolean'||s.pending!==undefined&&typeof s.pending!=='boolean'||!integer(s.stock,c.stock)||!integer(s.strategy,1)||!Array.isArray(s.list)||s.list.length>4||!s.list.every(v=>integer(v))||typeof s.recon!=='boolean'||!integer(s.target)||![s.ready,s.reconAt,s.attackAt,s.check,s.reconReady].every(v=>finite(v,0,st.time+10))||s.goal!==undefined&&!goal(s.goal))throw Error('Invalid source FPV controller');operators.set(e.id,{...s,list:[...s.list],...(s.goal?{goal:{...s.goal}}:{})} as unknown as Operator);}
   for(const entry of value.drones){if(!Array.isArray(entry)||!integer(entry[0])||!record(entry[1]))throw Error('Invalid FPV drone');const e=st.ents.get(entry[0]),c=e&&config(e)?.fpvDrone,s=entry[1];if(!e||!c||drones.has(e.id)||!integer(s.source)||!finite(s.born,0,st.time)||!finite(s.energy,0,c.energy)||typeof s.returning!=='boolean'||!finite(s.height,0,100)||!finite(s.targetHeight,0,100)||!finite(s.phase,0,360)||typeof s.low!=='boolean'||!integer(s.target)||!Array.isArray(s.goals)||s.goals.length>512||!s.goals.every(goal)||!record(s.timers)||Object.keys(s.timers).some(k=>!['link','return','low','high','command','commandAt','patrol'].includes(k))||!Object.values(s.timers).every(v=>finite(v,0,st.time+1.1))||!finite(s.nextAuto,0,st.time+1.1)||!finite(s.ready,0,st.time+20.1)||s.impact!==undefined&&!finite(s.impact,0,st.time+.051))throw Error('Invalid source FPV drone lifecycle');drones.set(e.id,{...s,goals:s.goals.map(g=>({...g})),timers:{...s.timers}} as unknown as Drone);}
   for(const raw of value.payloads){if(!record(raw)||typeof raw.definition!=='string'||!DEFS[raw.definition]||!host.config<SensorsDef>(DEFS[raw.definition])?.fpvDrone?.payloads.some(p=>p.weapon===raw.weapon)||!integer(raw.owner,st.players.length-1)||!integer(raw.source)||!integer(raw.helper)||!finite(raw.x,-1e6,1e6)||!finite(raw.y,-1e6,1e6)||!finite(raw.angle,-Math.PI,Math.PI)||!finite(raw.ready,0,st.time+10))throw Error('Invalid source FPV helper');payloads.push({...raw} as unknown as Payload);}
  },
  dispose(){readers.delete(host.game);},
 };
}
