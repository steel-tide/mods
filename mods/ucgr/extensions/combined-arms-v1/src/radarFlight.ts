import { sensorElectronicWarfare } from './sead';
import { getDef } from './host';
import { sensorAltitude } from './flightControls';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { ModuleHost } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { SensorsDef, SourceFlightSpec } from './sensorsSpec';
export interface RadarFlightSpec {
  semiActive:boolean;
  range:number; ecmX:number; ecmY:number; lowPenalty:number; lostChecks:number; canLose:boolean;
  lockDelay:number; scriptInterval:number; seekerInterval:number; speedDrop:number; speedUp:number; speedDown:number; speedFloor:number;
}
export interface RadarFlightState { nextScript:number; nextLead:number; lossCount:number; adjusted:boolean; lock:boolean; cruise:number; sourceSpeed:number; nextLink:number; }
export interface RadarFlightBody {source:number;target:number;aimUntil?:number;age:number;spec:SourceFlightSpec;lost:boolean;x:number;y:number;radar?:RadarFlightState;}
export function stepRadarFlight(host:ModuleHost,f:RadarFlightBody,p:{x:number;y:number;angle:number},dt:number,contacts:readonly number[]):void {
  const spec=f.spec.radar;if(!spec)return;
  const st=host.game.st,s=f.radar??={nextScript:spec.scriptInterval,nextLead:spec.lockDelay+.2,lossCount:0,adjusted:false,lock:false,cruise:f.spec.speed,sourceSpeed:f.spec.speed,nextLink:0};
  const cfg=(e:Ent|undefined)=>e?host.config<SensorsDef>(getDef(e.defId)):undefined;
  const alive=(e:Ent|undefined):e is Ent=>!!e&&!e.dead&&!e.inside;
  const source=st.ents.get(f.source);let target=st.ents.get(f.target);
  const timer=f.age-spec.lockDelay;
  if(timer<0)return;
  s.lock=true;
  const error=(e:Ent)=>Math.abs((p.angle-Math.atan2(e.y-p.y,e.x-p.x))*180/Math.PI);
  while(f.age+1e-9>=s.nextScript){
    s.nextScript+=spec.scriptInterval;
    if(!s.adjusted){s.cruise-=spec.speedDrop;s.adjusted=true;}
    if(timer<3)s.cruise+=spec.speedUp;
    else if(timer>3&&s.cruise>spec.speedFloor)s.cruise-=spec.speedDown;
    f.spec.speed=s.cruise;
    if(!spec.semiActive&&alive(target)&&timer>2&&error(target)>f.spec.fovDegrees&&!f.lost)s.lossCount++;
    if((!spec.semiActive&&spec.canLose&&s.lossCount>=spec.lostChecks)||target?.dead){f.lost=true;f.target=0;target=undefined;}
    if(f.lost&&spec.semiActive&&spec.canLose&&s.lossCount<spec.lostChecks&&alive(source)){const replacement=st.ents.get(source.targetId);if(alive(replacement)){target=replacement;f.target=replacement.id;f.lost=false;s.lossCount++;f.aimUntil=f.age+.5;}}
    if(f.lost&&!spec.semiActive&&alive(source)&&cfg(source)?.airSuperiority){
      const reacquired=contacts.map(id=>st.ents.get(id)).find(e=>alive(e)&&cfg(e)?.fixedWing&&error(e)<f.spec.fovDegrees);
      if(reacquired){target=reacquired;f.target=reacquired.id;f.lost=false;s.lossCount=0;f.aimUntil=f.age+.5;}
    }
  }
  if(f.lost||!alive(target)||timer<=.2)return;
  let guidance=false, divisor=100;
  if(f.age+1e-9>=s.nextLead&&Math.hypot(target.x-p.x,target.y-p.y)<=spec.range&&error(target)<=f.spec.fovDegrees){
    while(s.nextLead<=f.age+1e-9)s.nextLead+=spec.seekerInterval;
    guidance=true;
  }
  // The parent's data link forwards sampled radar contacts. Its explicit
  // high/low-altitude clauses improve both offsets; ordinary altitude does not.
  const altitude=source?sensorAltitude(host.game,source)??cfg(source)?.altitude:undefined;
  if(!spec.semiActive&&f.age>=s.nextLink&&alive(source)&&cfg(source)?.airSuperiority&&contacts.includes(target.id)&&Math.floor(f.age*100)%33<5&&(altitude==='high'||altitude==='low')){
    guidance=true;divisor=altitude==='high'?300:200;s.nextLink=f.age+8/60;
  }
  if(!guidance){if(spec.semiActive){f.x=target.x;f.y=target.y;f.aimUntil=f.age+.5;}return;}
  f.aimUntil=f.age+(spec.semiActive?.24:.325);
  if(spec.semiActive&&cfg(target)?.helicopter){f.x=target.x;f.y=target.y;return;}
  const tc=cfg(target),ecm=(tc?.ecm??0)+((sensorAltitude(host.game,target)??tc?.altitude)==='low'?spec.lowPenalty:0)
    +(host.participants().some(e=>alive(e)&&st.players[e.owner]?.team!==st.players[source?.owner??-1]?.team&&(cfg(e)?.electronicWarfare||sensorElectronicWarfare(host.game,e)))?10:0);
  const lateral=st.rng.range(-spec.ecmX,spec.ecmX)*ecm/divisor;
  const velocity=Math.hypot(target.x-target.prevX,target.y-target.prevY)/Math.max(dt,1e-6);
  const duration=Math.hypot(target.x-p.x,target.y-p.y)/Math.max(1,s.cruise)+ecm/divisor*st.rng.range(-spec.ecmY,spec.ecmY)/60;
  const forward=velocity*duration;
  f.x=target.x+Math.cos(target.angle)*forward-Math.sin(target.angle)*lateral;
  f.y=target.y+Math.sin(target.angle)*forward+Math.cos(target.angle)*lateral;
}
