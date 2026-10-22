import { getDef, turnToward } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Json, ModuleHost, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ProjectileMotion } from './componentsSpec';
interface MotionState { height:number;vz:number;delay:number;targetHeight:number;started:boolean }
/** RW's non-ballistic projectile path. `gravity` subtracts height per frame;
 * `trueGravity` changes vertical velocity. Both coexist with steering in z. */
export function createSourceBallistics(host:ModuleHost,config:(p:Proj)=>ProjectileMotion|undefined,onStart?:(p:Proj)=>void){
 const st=host.game.st,states=new Map<number,MotionState>();
 const altitude=(e:Ent|undefined)=>e?(host.effectiveDef(e).altitude??0):0;
 const quantized=(extent:number,quantum:number)=>extent?st.rng.int(Math.ceil(-extent/quantum),Math.floor(extent/quantum))*quantum:0;
 return {
  launch(e:Ent|undefined,p:Proj,heightOverride?:number):void{
   const d=config(p);if(!d)return;p.id??=st.nextProjId++;
   const target=st.ents.get(p.targetId),z=(heightOverride??altitude(e))+d.height;
   p.ttl=d.life;p.speed=d.speed+quantized(d.speedSpread,.24);p.arc=undefined;
   if(d.ground||!target){if(d.noLead&&target){p.tx=target.x;p.ty=target.y;}p.tx+=quantized(d.spread,.004);p.ty+=quantized(d.spread,.004);}
   p.homing=false;
   states.set(p.id,{height:z,vz:d.vz,delay:d.delay,started:false,targetHeight:d.targetHeight+(d.ground&&d.includeHeight?altitude(target):0)});
  },
  step(p:Proj,dt:number):'keep'|'remove'|undefined{
   const s=p.id===undefined?undefined:states.get(p.id),d=config(p);if(!s||!d)return;
   if(p.downed){states.delete(p.id!);return 'remove';}
   if(s.delay>0){s.delay=Math.max(0,s.delay-dt);if(s.delay>0)return 'keep';}
   if(!s.started){s.started=true;onStart?.(p);}
   p.px=p.x;p.py=p.y;p.ttl=Math.max(0,p.ttl-dt);
   const target=d.ground?undefined:st.ents.get(p.targetId);
   if(target){p.tx=target.x;p.ty=target.y;}
   const targetHeight=target?altitude(target):s.targetHeight;
   let distance2=(p.tx-p.x)**2+(p.ty-p.y)**2;
   const turn=distance2<36?d.nearTurn:d.turn,want=Math.atan2(p.ty-p.y,p.tx-p.x);
   p.angle=turn<0?want:turnToward(p.angle,want,turn*dt);
   p.x+=d.vx*dt;p.y+=d.vy*dt;s.height+=s.vz*dt;
   if(s.height>0){s.height-=d.gravity*dt;s.vz-=d.trueGravity*dt;}
   let travel=p.speed*dt;
   if(distance2<travel*travel){travel=Math.sqrt(distance2);distance2=0;}
   p.x+=Math.cos(p.angle)*travel;p.y+=Math.sin(p.angle)*travel;
   const dz=targetHeight-s.height;
   let heightTravel=p.speed*dt;
   if(distance2>.016)heightTravel=Math.min(Math.abs(dz)/Math.sqrt(distance2)*p.speed*dt,p.speed*dt);
   s.height+=Math.sign(dz)*Math.min(Math.abs(dz),heightTravel);
   if(d.targetSpeed>0)p.speed+=Math.sign(d.targetSpeed-p.speed)*Math.min(Math.abs(d.targetSpeed-p.speed),d.acceleration*dt);
   const radius=target&&getDef(target.defId).kind==='building'?Math.max(2.4,getDef(target.defId).radius*.8):2.4;
   const vertical=1.2+Math.abs(s.vz*dt)+Math.abs(d.gravity*dt);
   if(distance2<radius*radius&&Math.abs(targetHeight-s.height)<vertical||p.ttl<=0&&d.end){
    host.resolveImpact(st,host.game.hash,p,target??null);states.delete(p.id!);return 'remove';
   }
   if(p.ttl<=0){states.delete(p.id!);return 'remove';}
   return 'keep';
  },
  visual(p:Proj):{altitude:number}|undefined{const s=p.id===undefined?undefined:states.get(p.id);return s?{altitude:s.height}:undefined;},
  snapshot(view?:RuntimeView):Json{return [...states].filter(([id])=>st.projs.some(p=>p.id===id)&&(!view||view.visibleProjectiles.has(id))).map(([id,s])=>[id,{...s}]) as Json;},
  restore(value:unknown):void{
   if(!Array.isArray(value)||value.length>st.projs.length)throw Error('Invalid source projectile motion');
   const next=new Map<number,MotionState>();
   for(const raw of value){
    if(!Array.isArray(raw)||raw.length!==2||!Number.isSafeInteger(raw[0])||next.has(raw[0])||!raw[1]||typeof raw[1]!=='object'||Array.isArray(raw[1])||Object.getPrototypeOf(raw[1])!==Object.prototype)throw Error('Invalid source projectile motion entry');
    const p=st.projs.find(p=>p.id===raw[0]),d=p&&config(p),s=raw[1] as MotionState;
    if(!d||typeof s.started!=='boolean'||Object.keys(s).some(k=>!['height','vz','delay','targetHeight','started'].includes(k))||!Number.isFinite(s.height)||Math.abs(s.height)>1e7||!Number.isFinite(s.vz)||Math.abs(s.vz)>1e7||!Number.isFinite(s.targetHeight)||Math.abs(s.targetHeight)>1e5||!Number.isFinite(s.delay)||s.delay<0||s.delay>d.delay)throw Error('Invalid source projectile trajectory');
    next.set(raw[0],{...s});
   }
   states.clear();for(const [id,s]of next)states.set(id,s);
  },
  prune():void{const live=new Set(st.projs.map(p=>p.id));for(const id of states.keys())if(!live.has(id))states.delete(id);},
 };
}
