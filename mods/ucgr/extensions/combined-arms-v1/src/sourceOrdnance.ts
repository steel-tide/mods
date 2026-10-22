import { stepRadarFlight, type RadarFlightState } from './radarFlight';
import { DEFS, getDef, normAngle, targetCat } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Json, ModuleHost, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { GuidanceDef, SensorsDef, SourceFlightSpec, CountermeasureSpec } from './sensorsSpec';
import { record } from './sensorsSpec';

interface Flight { height:number; targetHeight:number; aimUntil?: number; radar?: RadarFlightState; source: number; target: number; age: number; speed: number; angular: number; nextSample: number; x: number; y: number; leg: number; lost: boolean; energy: number; spec: SourceFlightSpec }
interface Dispenser { remaining: number; ready: number }
interface Pulse { owner: number; target: number; x: number; y: number; ttl: number; speed: number; radius: number; energy: number }
/** UCGR's missiles are moving helper units. Own their full lifecycle, rather than
 * letting the native missile expire at its last target and invent an explosion. */
export function createSourceOrdnance(host: ModuleHost, contacts: (source:number)=>readonly number[] = ()=>[]) {
  const st = host.game.st, flights = new Map<number, Flight>(), dispensers = new Map<number, Dispenser>(), pulses: Pulse[] = [], heights=new Map<number,number>();
  const entityHeight=(e:Ent|undefined):number=>e?(host.effectiveDef(e).altitude??0)*(e.alt??1):0;
  const live = (e: Ent | undefined): e is Ent => !!e && !e.dead && !e.inside;
  const specification = (p: Proj): SourceFlightSpec | undefined => {
    if (!p.gun) return;
    const i = p.gun.lastIndexOf('/'), w = DEFS[p.gun.slice(0,i)]?.weapons.find(w => w.id === p.gun!.slice(i+1));
    return w && host.config<GuidanceDef>(w)?.sourceFlight;
  };
  function dispense(e: Ent, spec: CountermeasureSpec): Dispenser {
    let s = dispensers.get(e.id);
    if (!s) { s = { remaining: spec.charges, ready: st.time + spec.reload }; dispensers.set(e.id,s); }
    return s;
  }
  function pulse(p: Pulse): void {
    for (const projectile of st.projs) {
      const f = projectile.id === undefined ? undefined : flights.get(projectile.id);
      if (f && Math.hypot(projectile.x-p.x, projectile.y-p.y) <= p.radius) f.energy -= p.energy;
    }
  }
  return {
    onShot(e: Ent, guide: GuidanceDef, p: Proj): boolean {
      const spec = guide.sourceFlight; if (!spec || !p.targetId) return false;
      p.id ??= st.nextProjId++;
      const target = st.ents.get(p.targetId);
      flights.set(p.id, {source:e.id, target:p.targetId, age:0, speed:0, angular:0, nextSample:0,
        height:entityHeight(spec.radar?e:target),targetHeight:entityHeight(spec.radar?e:target),
        x:target?.x ?? p.tx, y:target?.y ?? p.ty, leg:0, lost:false, energy:spec.resistance, ...(spec.radar?{aimUntil:spec.radar.semiActive?1e9:.3}:{}),
        spec:{...spec, speed:spec.speed + host.effectiveDef(e).speed * spec.inheritSpeed}});
      // Attached helper initially has its parent's body bearing, independently
      // of the native emitter's current aiming solution.
      p.angle = e.angle; p.speed = 0; p.ttl = spec.life; p.homing = false;
      p.splash = spec.blastRadius;
      return true;
    },
    beforeStep(dt: number): void {
      for (const e of host.participants()) {
        const spec = host.config<SensorsDef>(getDef(e.defId))?.countermeasures;
        if (!spec || !live(e)) continue;
        const s = dispense(e,spec);
        if (!s.remaining || st.time + 1e-9 < s.ready) continue;
        const threats = st.projs.filter(p => p.id !== undefined && flights.has(p.id) && p.team !== st.players[e.owner]?.team
          && Math.hypot(e.x-p.x,e.y-p.y) <= spec.range);
        const target = threats.sort((a,b) => Math.hypot(e.x-a.x,e.y-a.y)-Math.hypot(e.x-b.x,e.y-b.y) || a.id!-b.id!)[0];
        if (!target) continue;
        s.remaining--; s.ready = st.time + spec.reload;
        const angle=e.angle+Math.PI/2;
        pulses.push({owner:e.owner,target:target.id!,x:e.x+spec.x*Math.cos(angle)-spec.y*Math.sin(angle),
          y:e.y+spec.x*Math.sin(angle)+spec.y*Math.cos(angle),ttl:spec.life,speed:spec.speed,radius:spec.radius,energy:spec.energy});
      }
      for (let i=pulses.length-1;i>=0;i--) {
        const p=pulses[i], target=st.projs.find(a=>a.id===p.target), distance=target?Math.hypot(target.x-p.x,target.y-p.y):Infinity;
        const step=Math.min(dt,p.ttl); p.ttl-=dt;
        if (target && distance>0) { const amount=Math.min(distance,p.speed*step);p.x+=(target.x-p.x)/distance*amount;p.y+=(target.y-p.y)/distance*amount; }
        if (p.ttl<=0 || distance<=p.speed*step) { pulse(p);pulses.splice(i,1); }
      }
    },
    projectileStep(p: Proj, dt: number): 'keep'|'remove'|undefined {
      const f=p.id===undefined?undefined:flights.get(p.id); if (!f) return;
      p.px=p.x;p.py=p.y; f.age+=dt; p.ttl=Math.max(0,f.spec.life-f.age);
      if (p.downed || f.energy<=0 || f.age>f.spec.life) { flights.delete(p.id!);return 'remove'; }
      let target=st.ents.get(f.target);
      if(f.spec.radar){const locked=f.radar?.lock,oldTarget=f.target,lead=f.radar?.nextLead;stepRadarFlight(host,f,p,dt,contacts(f.source));target=st.ents.get(f.target);
        if(target&&((!locked&&f.radar?.lock)||oldTarget!==f.target||(f.spec.radar.semiActive&&lead!==f.radar?.nextLead)))f.targetHeight=entityHeight(target);
      }
      const heightDelta=f.targetHeight-f.height;f.height+=Math.sign(heightDelta)*Math.min(Math.abs(heightDelta),(f.spec.heightRate??1800)*dt);
      // The original checks a literal unwrapped heading difference. Keep that
      // quirk: changing it to a shortest-angle test changes edge-of-cone losses.
      if (!f.spec.radar && f.age>f.spec.lossDelay && (!live(target) || Math.abs((p.angle-Math.atan2(target.y-p.y,target.x-p.x))*180/Math.PI)>f.spec.fovDegrees)) f.lost=true;
      const launchLeg=f.leg<f.spec.launchLeg && f.age<f.spec.launchTime;
      if (!f.spec.radar && !f.lost && !launchLeg && live(target) && f.age+1e-9>=f.nextSample) {
        while(f.nextSample<=f.age+1e-9) f.nextSample+=f.spec.sample;
        const duration=Math.hypot(target.x-p.x,target.y-p.y)/Math.max(1,f.spec.speed);
        // RW maxMoveSpeed*speed is the target's current forward velocity.
        const velocity=Math.hypot(target.x-target.prevX,target.y-target.prevY)/Math.max(dt,1e-6);
        f.x=target.x+Math.cos(target.angle)*velocity*duration;
        f.y=target.y+Math.sin(target.angle)*velocity*duration;
      }
      if (!f.lost && !launchLeg && (!f.spec.radar || f.age<=(f.aimUntil??0))) {
        const off=normAngle(Math.atan2(f.y-p.y,f.x-p.x)-p.angle), wanted=Math.sign(off)*Math.min(f.spec.turnRate,Math.sqrt(2*f.spec.turnAcceleration*Math.abs(off)));
        f.angular += Math.max(-f.spec.turnAcceleration*dt,Math.min(f.spec.turnAcceleration*dt,wanted-f.angular));
        const turn=f.angular*dt;
        p.angle=normAngle(p.angle+(Math.abs(turn)>Math.abs(off)?off:turn));
      }
      f.speed=Math.min(f.spec.speed,f.speed+f.spec.acceleration*dt);p.speed=f.speed;
      const dx=Math.cos(p.angle)*p.speed*dt,dy=Math.sin(p.angle)*p.speed*dt;p.x+=dx;p.y+=dy;f.leg+=Math.hypot(dx,dy);
      p.tx=f.x;p.ty=f.y;p.targetId=f.lost?0:f.target;
      // Source melee helper can hit any eligible enemy aircraft in its fuse
      // radius; it does not detonate merely for reaching a stale aim point.
      let victim: Ent|undefined, nearest=Infinity;
      for (const e of st.ents.values()) {
        if (!live(e) || st.players[e.owner]?.team===p.team || targetCat(st,e)!=='air' || (f.spec.radar ? f.lost||e.id!==f.target : host.config<SensorsDef>(getDef(e.defId))?.unmanned)) continue;
        if(host.config<SensorsDef>(getDef(e.defId))?.seadMissile&&!f.spec.radar?.semiActive)continue;
        const span=dx*dx+dy*dy,k=span?Math.max(0,Math.min(1,((e.x-p.px)*dx+(e.y-p.py)*dy)/span)):0;
        const distance=Math.hypot(e.x-p.px-k*dx,e.y-p.py-k*dy);
        if (distance<=f.spec.proximity && distance<nearest) { nearest=distance;victim=e; }
      }
      if (victim) {
        // Semi-active MISSLE2 is a separate zero-HP energy-interception event
        // for anti-radiation targets; it must not emit the ordinary AA blast.
        if(f.spec.radar?.semiActive&&host.config<SensorsDef>(getDef(victim.defId))?.seadMissile){p.dmg=0;p.splash=f.spec.proximity;}
        host.resolveImpact(st,host.game.hash,p,victim);flights.delete(p.id!);return 'remove';
      }
      return 'keep';
    },
    inspect(e: Ent) { const s=dispensers.get(e.id);return s?[{id:'source-countermeasures',label:['Countermeasures','干扰物','기만체'],value:s.remaining}]:[]; },
    afterStep() { const ids=new Set(st.projs.map(p=>p.id));for(const id of flights.keys())if(!ids.has(id))flights.delete(id);for(const id of heights.keys())if(!ids.has(id))heights.delete(id);for(const id of dispensers.keys())if(!st.ents.has(id))dispensers.delete(id); },
    hasState() { return !!(flights.size || heights.size || dispensers.size || pulses.length); },
    visual(p:Proj):{altitude:number}|undefined{const height=p.id===undefined?undefined:flights.get(p.id)?.height??heights.get(p.id);return height===undefined?undefined:{altitude:height};},
    snapshot(view?: RuntimeView): Json {
      return {flights:view?[]:[...flights],heights:view?[...flights].filter(([id])=>view.visibleProjectiles.has(id)).map(([id,f])=>[id,f.height]):[...heights],dispensers:[...dispensers].filter(([id])=>!view||view.visibleEntities.has(id)&&view.privateEntity(id)),pulses:view?[]:pulses} as unknown as Json;
    },
    restore(raw: unknown): void {
      if(raw===undefined){flights.clear();dispensers.clear();pulses.length=0;heights.clear();return;}
      const finite=(v:unknown,min=-1e7,max=1e7):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
      if(!record(raw)||!Array.isArray(raw.flights)||raw.flights.length>st.projs.length||!Array.isArray(raw.dispensers)||raw.dispensers.length>st.ents.size||!Array.isArray(raw.pulses)||raw.pulses.length>st.ents.size*2)throw Error('Invalid source ordnance state');
      const next=new Map<number,Flight>();
      for(const entry of raw.flights){
        if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1])||next.has(entry[0]))throw Error('Invalid source flight');
        const p=st.projs.find(p=>p.id===entry[0]),s=p&&specification(p),a=entry[1];
        if(!p||!s||!Number.isSafeInteger(a.source)||!Number.isSafeInteger(a.target)||typeof a.lost!=='boolean'||!['age','speed','angular','nextSample','x','y','leg','energy','height','targetHeight'].every(k=>finite(a[k])))throw Error('Invalid source flight fields');
        if(!record(a.spec)||!finite(a.spec.speed,0,s.speed+4000)||!finite(a.age,0,s.life+1)||!finite(a.speed,0,s.speed+4000)||!finite(a.energy,-10000,s.resistance)||!finite(a.nextSample,0,s.life+s.sample+1)||!finite(a.leg,0,(s.life+1)*(s.speed+4000)))throw Error('Invalid source flight specification');
        if(a.aimUntil!==undefined&&!finite(a.aimUntil,0,1e9))throw Error('Invalid source waypoint lifetime');
        if(s.radar&&a.radar!==undefined&&(!record(a.radar)||!['nextScript','nextLead','lossCount','cruise','sourceSpeed','nextLink'].every(k=>finite((a.radar as Record<string,unknown>)[k]))||typeof a.radar.lock!=='boolean'||typeof a.radar.adjusted!=='boolean'))throw Error('Invalid radar flight state');
        next.set(entry[0],{...a,spec:{...s,speed:a.spec.speed}} as unknown as Flight);
      }
      const nextDispensers=new Map<number,Dispenser>();
      for(const entry of raw.dispensers){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source dispenser');const e=st.ents.get(entry[0]),s=e&&host.config<SensorsDef>(getDef(e.defId))?.countermeasures,a=entry[1];if(!s||!Number.isInteger(a.remaining)||!finite(a.remaining,0,s.charges)||!finite(a.ready,0,st.time+s.reload+1))throw Error('Invalid source dispenser state');nextDispensers.set(entry[0],{remaining:a.remaining,ready:a.ready});}
      const nextPulses=raw.pulses.map(a=>{if(!record(a)||!Number.isInteger(a.owner)||!st.players[a.owner as number]||!Number.isSafeInteger(a.target)||!['x','y','ttl','speed','radius','energy'].every(k=>finite(a[k])))throw Error('Invalid source countermeasure pulse');return {...a} as unknown as Pulse;});
      const nextHeights=new Map<number,number>();if(raw.heights!==undefined){if(!Array.isArray(raw.heights)||raw.heights.length>st.projs.length)throw Error('Invalid source missile heights');for(const entry of raw.heights){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!st.projs.some(p=>p.id===entry[0]&&specification(p))||!finite(entry[1],-1000,10000)||nextHeights.has(entry[0]))throw Error('Invalid source missile height');nextHeights.set(entry[0],entry[1]);}}
      flights.clear();for(const [id,f]of next)flights.set(id,f);dispensers.clear();for(const[id,d]of nextDispensers)dispensers.set(id,d);pulses.splice(0,pulses.length,...nextPulses);
      heights.clear();for(const[id,h]of nextHeights)heights.set(id,h);
    },
  };
}
