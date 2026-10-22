import { getDef } from './host';
import { f,sourceApproach,sourceAngleDelta,sourceCos,sourceSin,sourceDirection } from './sourceMath';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Json,ModuleHost,RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ComponentsDef,SourceMovement } from './componentsSpec';
export interface SourceWaypoint {x:number;y:number;stopRange?:number}
interface Motion {form:string;vx:number;vy:number;angular:number;bearing:number;desired:number}
/** Direct-waypoint AIR/sliding/ignore-body source family; no native path, fixed-
 * wing floor, terrain drag, collision or invented reverse policy is involved. */
export function createSourceMovement(host:ModuleHost){
 const states=new Map<number,Motion>();
 const config=(e:Ent):SourceMovement|undefined=>host.config<ComponentsDef>(getDef(e.defId))?.sourceMovement;
 return {
  step(e:Ent,def:UnitDef,dt:number,desired?:SourceWaypoint):boolean {
   const cfg=config(e);if(!cfg)return false;if(e.dead||e.inside)return true;
   let s=states.get(e.id);if(!s){s={form:e.defId,vx:0,vy:0,angular:0,bearing:f(e.angle*180/Math.PI),desired:f(e.angle*180/Math.PI)};states.set(e.id,s);}s.form=e.defId;
   // External rotations remain authoritative, but ordinary continuation keeps
   // the original float bearing rather than repeatedly converting it.
   if(Math.abs(sourceAngleDelta(s.bearing,e.angle*180/Math.PI))>1e-4)s.bearing=f(e.angle*180/Math.PI);
   const frames=f(dt*60),speed=f(def.speed/24),acceleration=f(cfg.acceleration),deceleration=f(cfg.deceleration);
   const x=f(e.x/.4),y=f(e.y/.4),dx=desired?f(f(desired.x/.4)-x):0,dy=desired?f(f(desired.y/.4)-y):0;
   const distance=f(f(dx*dx)+f(dy*dy)),stop=desired?.stopRange===undefined?4:desired.stopRange/.4;
   const throttle=desired&&distance>0&&distance>=stop*stop?1:0;
   if(desired){
    s.desired=sourceDirection(f(dy/f(cfg.yScale)),dx);
    const error=sourceAngleDelta(s.bearing,s.desired),turn=f(def.turnRate*180/Math.PI/60),rate=f(cfg.turnAcceleration);
    if(Math.abs(error)>=.01){let step:number;
     if(rate<=0)step=f(Math.sign(error)*f(turn*frames));
     else{const target=f(Math.sign(error)*(Math.abs(error)<f(Math.abs(s.angular)/rate)?rate:turn));s.angular=sourceApproach(s.angular,target,f(rate*frames));step=f(s.angular*frames);}
     if(Math.abs(step)>Math.abs(error)){s.angular=0;step=error;}
     s.bearing=f(s.bearing+step);if(s.bearing>180)s.bearing=f(s.bearing-360);if(s.bearing< -180)s.bearing=f(s.bearing+360);
    }
   }
   if(throttle||s.vx!==0||s.vy!==0){
    const rate=f(f(throttle?acceleration:deceleration)*f(1.41)),tx=throttle?f(sourceCos(s.desired)*speed):0,ty=throttle?f(sourceSin(s.desired)*speed):0;
    const vx=f(s.vx-tx),vy=f(s.vy-ty),delta=f(f(vx*vx)+f(vy*vy));
    if(delta>f(speed*speed)){s.vx=f(s.vx-s.vx*.05*frames);s.vy=f(s.vy-s.vy*.05*frames);}
    const step=f(rate*frames);
    if(delta<f(step*step)){s.vx=tx;s.vy=ty;}
    else{const angle=sourceDirection(f(ty-s.vy),f(tx-s.vx));s.vx=f(s.vx+f(sourceCos(angle)*step));s.vy=f(s.vy+f(sourceSin(angle)*step));}
    e.x=f(x+f(s.vx*frames))*.4;e.y=f(y+f(f(s.vy*frames)*f(cfg.yScale)))*.4;
   }
   const change=sourceAngleDelta(f(e.angle*180/Math.PI),s.bearing)*Math.PI/180;e.angle=s.bearing*Math.PI/180;e.turretAngle+=change;
   return true;
  },
  snapshot(view?:RuntimeView):Json {const out:Record<string,Json>={};for(const[id,s]of states){const e=host.game.st.ents.get(id);if(!e||e.dead){states.delete(id);continue;}if(view&&(!view.visibleEntities.has(id)||!view.privateEntity(id)))continue;out[id]={...s,form:e.defId};}return out;},
  restore(value:unknown):void{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid source movement');const next=new Map<number,Motion>();for(const[key,raw]of Object.entries(value)){const id=Number(key),e=host.game.st.ents.get(id),s=raw as Motion;if(!Number.isSafeInteger(id)||String(id)!==key||!e||!config(e)||!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).sort().join(',')!=='angular,bearing,desired,form,vx,vy'||s.form!==e.defId||['vx','vy','angular','bearing','desired'].some(k=>!Number.isFinite(s[k as keyof Motion])||Math.abs(s[k as keyof Motion] as number)>1e6))throw Error('Invalid source movement entity');next.set(id,{...s});}states.clear();for(const[id,s]of next)states.set(id,s);},
 };
}
