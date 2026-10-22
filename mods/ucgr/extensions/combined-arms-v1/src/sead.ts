import { sourceAreaVictims } from './sourceArea';
import { allocateSourceHelperIdentity, bindSourceHelperIdentity } from './components';
import { DEFS, getDef, newEnt, normAngle, targetCat } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Json, ModuleAction, ModuleHost, ModuleOrder, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { SeadCarrierSpec, SeadMissileSpec } from './seadSpec';
import type { GuidanceDef, SensorsDef } from './sensorsSpec';
import { record } from './sensorsSpec';
import { sensorRadarActive } from './radarControls';
import { TARGETING_ID, type SourceTags } from './targetingSpec';

interface Controller { enabled:boolean;rounds:number;priority:number;nextScan:number;pending?:{targets:number[];ready:number};queue:number[];expires:number;warmup:number;station:number;ready:number[];energy:number; }
interface Missile { source:number;target:number;energy:number;speed:number;cruise:number;angular:number;height:number;targetHeight:number;lost:boolean;nextScript:number;impact?:number; }
interface Blast { definition:string;source:number;owner:number;x:number;y:number;angle:number;ready:number;started:boolean;hits:number[];helperId?:number; }
const readers=new WeakMap<Game,(e:Ent)=>boolean>();
export function sensorElectronicWarfare(game:Game,e:Ent):boolean{return readers.get(game)?.(e)??false;}

/** Source units, not homing projectile substitutes. The transparent attached
 * controller keeps a private finite magazine; only released missile bodies are
 * added to the entity table. No autonomous native AI runs those bodies. */
export function createSead(host:ModuleHost,resetSpeed:(e:Ent,fraction:number)=>void){
 const st=host.game.st,controllers=new Map<number,Controller>(),missiles=new Map<number,Missile>(),blasts:Blast[]=[];
 const config=(e:Ent)=>host.config<SensorsDef>(getDef(e.defId));
 const team=(e:{owner:number})=>st.players[e.owner]?.team??-1;
 const alive=(e:Ent|undefined):e is Ent=>!!e&&!e.dead&&!e.inside&&!e.site;
 const tags=(e:Ent)=>(getDef(e.defId).extensions?.[TARGETING_ID] as SourceTags|undefined)?.tags??[];
 const radar=(e:Ent)=>sensorRadarActive(host.game,e)??tags(e).includes('雷达工作中');
 const height=(e:Ent)=>(host.effectiveDef(e).altitude??0)*(e.alt??1);
 function state(e:Ent,c:SeadCarrierSpec){let s=controllers.get(e.id);if(!s){s={enabled:false,rounds:0,priority:0,nextScan:st.time,queue:[],expires:0,warmup:0,station:0,ready:[0,0],energy:c.energy};controllers.set(e.id,s);}return s;}
 readers.set(host.game,e=>controllers.get(e.id)?.enabled===true&&!e.dead);
 const guide=(gun:string|undefined)=>{if(!gun)return;const i=gun.lastIndexOf('/'),w=DEFS[gun.slice(0,i)]?.weapons.find(w=>w.id===gun.slice(i+1));return w&&host.config<GuidanceDef>(w);};
 const hitData=(gun:string|undefined)=>{if(!gun)return;const i=gun.lastIndexOf('/'),def=DEFS[gun.slice(0,i)],id=gun.slice(i+1);return def&&host.config<SensorsDef>(def)?.seadHits?.find(h=>h.id===id);};
 function ordinary(target:Ent,damage:number,owner:number,source:number,gun:string,x:number,y:number){
  // No currentImpact: this is the source's ordinary flat-armor HP branch.
  // TAM's separate component recipient is resolved exactly once below.
  host.applyDamage(st,target,damage,undefined,owner,source,gun,{x,y});
 }
 function area(x:number,y:number,radius:number,fullRadius:number,damage:number,owner:number,source:number,gun:string,hits?:number[]){
  for(const {entity,multiplier} of sourceAreaVictims(host,{x,y,radius,fullRadius,owner,hits}))
   ordinary(entity,damage*multiplier,owner,source,gun,x,y);
 }
 function detonate(e:Ent,m:Missile,c:SeadMissileSpec,target:Ent){
  const x=target.x,y=target.y,w=getDef(e.defId).weapons.find(w=>w.id===c.primaryWeapon)!;
  ordinary(target,w.dmg,e.owner,m.source,`${e.defId}/${c.primaryWeapon}`,e.x,e.y);
  area(x,y,c.primaryRadius,c.primaryRadius,c.primaryDamage,e.owner,m.source,`${e.defId}/${c.primaryWeapon}`);
  // spawnUnit's helper begins at impact center; its independently timed TAM
  // action is retained, including the original expanding ordinary blast.
  const helperId=allocateSourceHelperIdentity(host.game);
  blasts.push({definition:e.defId,source:m.source,owner:e.owner,x,y,angle:e.angle,ready:st.time+c.payloadDelay,started:false,hits:[],...(helperId!==undefined?{helperId}:{})});
  m.energy=0;m.height=-8;m.targetHeight=-8;m.speed=0;m.impact=st.time;e.targetId=0;e.orders=[];
 }
 function launch(e:Ent,s:Controller,c:SeadCarrierSpec,target:Ent){
  const lateral=c.lateral[s.station],a=e.angle+Math.PI/2;
  const missile=newEnt(st,c.helper,e.owner,e.x+Math.cos(a)*lateral,e.y+Math.sin(a)*lateral,e.angle),mc=config(missile)!.seadMissile!;
  missiles.set(missile.id,{source:e.id,target:target.id,energy:mc.energy,speed:0,cruise:mc.speed+host.effectiveDef(e).speed*mc.inheritSpeed,angular:0,height:height(e),targetHeight:height(target),lost:false,nextScript:st.time});
  missile.targetId=target.id;s.rounds--;s.ready[s.station]=st.time+c.reload;s.station=c.alternate?1-s.station:1;s.queue.shift();s.warmup=0;s.expires=st.time+c.waypointTime;
 }
 function scan(e:Ent,s:Controller,c:SeadCarrierSpec){
  const targets:number[]=[];let n=0;
  for(const target of st.ents.values()){
   if(!alive(target)||team(target)===team(e)||!radar(target)||Math.hypot(target.x-e.x,target.y-e.y)>c.range)continue;
   if(++n>c.scanLimit)break;
   // Literal unwrapped source angle. Do not normalize the authored seam.
   if(Math.abs(e.angle-Math.atan2(target.y-e.y,target.x-e.x))>c.scanCone)continue;
   const t=tags(target);if(s.priority===2&&!t.includes('高价值')||s.priority===1&&!t.includes('中价值')&&!t.includes('高价值'))continue;
   targets.push(target.id);
  }
  if(targets.length)s.pending={targets,ready:st.time+c.queueTime};
 }
 function step(e:Ent,dt:number){
  const c=config(e)?.seadMissile;if(!c)return false;
  const m=missiles.get(e.id);if(!m){e.dead=true;return true;}
  if(m.impact!==undefined){if(st.time>m.impact+1)e.dead=true;return true;}
  if(m.energy<=0){e.dead=true;return true;}
  const target=st.ents.get(m.target);
  if(st.time+1e-9>=m.nextScript){m.nextScript=st.time+c.interval;
   if(!alive(target)||!radar(target))m.lost=true;
   if(m.lost)m.energy=Math.max(0,m.energy-c.lostDrain);
  }
  if(m.energy<=0){e.dead=true;return true;}
  if(!m.lost&&alive(target)){
   const off=normAngle(Math.atan2(target.y-e.y,target.x-e.x)-e.angle),wanted=Math.sign(off)*Math.min(c.turnRate,Math.sqrt(2*c.turnAcceleration*Math.abs(off)));
   m.angular+=Math.max(-c.turnAcceleration*dt,Math.min(c.turnAcceleration*dt,wanted-m.angular));
   const turn=m.angular*dt;e.angle=normAngle(e.angle+(Math.abs(turn)>Math.abs(off)?off:turn));
  }
  // zero source deceleration keeps momentum after waypoint loss.
  if(!m.lost)m.speed=Math.min(m.cruise,m.speed+c.acceleration*dt);
  const oldX=e.x,oldY=e.y,dx=Math.cos(e.angle)*m.speed*dt,dy=Math.sin(e.angle)*m.speed*dt;
  e.x+=dx;e.y+=dy;e.turretAngle=e.angle;
  const delta=m.targetHeight-m.height;m.height+=Math.sign(delta)*Math.min(Math.abs(delta),c.heightRate*dt);
  if(!m.lost&&alive(target)){
   const span=dx*dx+dy*dy,k=span?Math.max(0,Math.min(1,((target.x-oldX)*dx+(target.y-oldY)*dy)/span)):0;
   if(Math.hypot(target.x-oldX-k*dx,target.y-oldY-k*dy)<=c.proximity)detonate(e,m,c,target);
  }
  return true;
 }
 return {
  step,
  effectiveDef(e:Ent,d:UnitDef):UnitDef{const c=config(e)?.seadMissile;if(!c)return d;return {...d,weapons:[],speed:0,altitude:missiles.get(e.id)?.height??c.initialHeight};},
  allowedTarget(e:Ent,target:Ent|undefined|null):boolean{return !target||!config(target)?.seadMissile||radar(e);},
  allowOrder(e:Ent):boolean{return !config(e)?.seadMissile;},
  onShot(e:Ent,_w:WeaponDef,_p:Proj){/* Source AGM88 controller has no energy debit. */},
  damage(next:ModuleHost['applyDamage']):ModuleHost['applyDamage']{return (...args)=>{const e=args[1],m=missiles.get(e.id);if(!m)return next(...args);
   if(m.impact!==undefined)return;const attacker=st.ents.get(args[5]??0),data=hitData(args[6]);
   if(attacker&&tags(attacker).includes('弹药拦截'))m.energy-=1+(data?.ahead?5:0);
   m.energy-=data?.energy??0;
   const p=host.currentImpact?.projectile;if(p?.gun){const i=p.gun.lastIndexOf('/'),w=DEFS[p.gun.slice(0,i)]?.weapons.find(w=>w.id===p.gun!.slice(i+1));if(w&&host.config<GuidanceDef>(w)?.sourceFlight?.radar?.semiActive)m.energy-=1000;}
   m.energy=Math.max(0,m.energy);next(args[0],e,0,undefined,args[4],args[5],args[6]);
  };},
  beforeStep(dt:number){
   for(const e of host.participants()){const c=config(e)?.seadCarrier;if(!c||e.dead)continue;const s=state(e,c);s.energy=Math.max(0,Math.min(c.energy,s.energy+c.energyRegen*dt));if(e.hp<getDef(e.defId).hp*c.severeDamage)s.energy=0;
    if(!s.enabled||!alive(e)||!s.rounds)continue;
    if(s.pending&&st.time+1e-9>=s.pending.ready){s.queue=s.pending.targets.filter(id=>{const t=st.ents.get(id);return alive(t)&&Math.hypot(t.x-e.x,t.y-e.y)<=c.range;}).slice(0,s.rounds);s.expires=st.time+c.waypointTime;delete s.pending;}
    if(s.queue.length){const target=st.ents.get(s.queue[0]);
     if(!alive(target)||st.time>=s.expires){s.queue.shift();s.expires=st.time+c.waypointTime;s.warmup=0;}
     else if(st.time>=s.ready[s.station]&&radar(target)&&!tags(target).includes('dest')&&targetCat(st,target)!=='air'&&Math.hypot(target.x-e.x,target.y-e.y)<=c.range&&Math.abs(normAngle(Math.atan2(target.y-e.y,target.x-e.x)-e.angle))<=c.launchCone){s.warmup+=dt;if(s.warmup+1e-9>=c.warmup)launch(e,s,c,target);}else s.warmup=0;
    }
    if(!s.queue.length&&!s.pending&&s.energy>0&&st.time+1e-9>=s.nextScan){s.nextScan=st.time+c.scanInterval;scan(e,s,c);}
   }
   for(let i=blasts.length-1;i>=0;i--){const b=blasts[i],def=DEFS[b.definition],c=def&&host.config<SensorsDef>(def)?.seadMissile;if(!c){blasts.splice(i,1);continue;}if(st.time<b.ready)continue;
    if(!b.started){b.started=true;const p:Proj={x:b.x,y:b.y,px:b.x,py:b.y,tx:b.x,ty:b.y,angle:b.angle,speed:0,homing:false,targetId:0,kind:'flame',dmg:0,splash:0,owner:b.owner,team:st.players[b.owner].team,ttl:0,hitsAir:false,hitsGround:true,hitsSub:false,src:b.source,gun:`${b.definition}/${c.payloadWeapon}`};if(b.helperId!==undefined)bindSourceHelperIdentity(host.game,p,b.helperId,true);host.resolveImpact(st,host.game.hash,p,null,true);}
    const progress=Math.min(1,(st.time-b.ready)/c.payloadExpand);area(b.x,b.y,c.payloadRadius*progress,c.payloadRadius,c.payloadDamage,b.owner,b.source,`${b.definition}/${c.payloadWeapon}`,b.hits);
    if(progress>=1)blasts.splice(i,1);
   }
  },
  beforeProjectiles(){for(const [id,m]of missiles){const e=st.ents.get(id);if(!alive(e)||m.impact!==undefined||m.energy<=0)continue;const c=config(e)!.seadMissile!;
    const p=st.projs.find(p=>!p.downed&&!guide(p.gun)?.sourceFlight&&p.team!==team(e)&&hitData(p.gun)?.missile&&Math.hypot(p.x-e.x,p.y-e.y)<=c.interceptionRange);
    // The source KAZ projectile removes the target life, not an HP substitute.
    // Traveling sourceFlight records represent helper units, not tagged
    // projectiles, and are excluded above. Native projectile expiry retains
    // its ordinary impact branch after this life-zero interception.
    if(p){p.ttl=0;m.energy=0;}
   }},
  actions(e:Ent):ModuleAction[]{const c=config(e)?.seadCarrier;if(!c||!alive(e))return[];const s=state(e,c),labels=[['Strategy: SEAD','策略：防空压制','전략: 방공망 제압'],['Strategy: Escort Penetration','策略：掩护突防','전략: 돌파 엄호'],['Strategy: Radar Counter','策略：反制雷达','전략: 레이더 대응']];
   return [...(st.cfg.mode==='sandbox'?[{id:'sead:equip',label:[c.family,c.family,c.family],enabled:true}]:[]),...(s.enabled?[{id:'sead:priority',label:labels[s.priority],enabled:true}]:[])];
  },
  order(e:Ent,o:ModuleOrder):boolean{const c=config(e)?.seadCarrier;if(!c||!alive(e))return false;const s=state(e,c);
   if(o.action==='sead:equip'&&st.cfg.mode==='sandbox'){if(!DEFS[c.helper])return false;s.enabled=true;s.rounds=c.rounds;s.queue=[];delete s.pending;s.station=0;s.ready=[0,0];s.nextScan=st.time;s.warmup=0;if(c.speedReset!==undefined)resetSpeed(e,c.speedReset);return true;}
   if(o.action==='sead:priority'&&s.enabled){s.priority=(s.priority+1)%3;return true;}return false;
  },
  inspect(e:Ent){const s=controllers.get(e.id),c=config(e)?.seadCarrier;return s?.enabled&&c?[{id:'source-sead-magazine',label:[c.family,c.family,c.family],value:s.rounds}]:[];},
  render(e:Ent){const s=missiles.get(e.id);return s?{flight:{altitude:s.height},hidden:s.impact!==undefined}:undefined;},
  hidden(e:Ent){return missiles.get(e.id)?.impact!==undefined;},
  hasState:()=>!!(controllers.size||missiles.size||blasts.length),
  snapshot(view?:RuntimeView):Json{return {controllers:[...controllers].filter(([id])=>!view||view.privateEntity(id)),missiles:[...missiles].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{...s,source:0,target:0,targetHeight:s.height,energy:0,cruise:0,angular:0,lost:true,nextScript:0}]),blasts:view?[]:blasts} as unknown as Json;},
  restore(value:unknown){controllers.clear();missiles.clear();blasts.length=0;if(value===undefined)return;
   if(!record(value)||!Array.isArray(value.controllers)||!Array.isArray(value.missiles)||!Array.isArray(value.blasts)||value.controllers.length>st.ents.size||value.missiles.length>st.ents.size||value.blasts.length>32768)throw Error('Invalid source SEAD state');
   const finite=(x:unknown,min=0,max=1e12):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
   const ids=(x:unknown,max:number):x is number[]=>Array.isArray(x)&&x.length<=max&&x.every(v=>Number.isSafeInteger(v)&&v>=0);
   for(const entry of value.controllers){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source SEAD controller');const e=st.ents.get(entry[0]),c=e&&config(e)?.seadCarrier,s=entry[1];
    if(!e||!c||controllers.has(e.id)||typeof s.enabled!=='boolean'||!Number.isSafeInteger(s.rounds)||!finite(s.rounds,0,c.rounds)||!Number.isSafeInteger(s.priority)||!finite(s.priority,0,2)||!finite(s.nextScan,0,st.time+c.scanInterval+.1)||!ids(s.queue,c.rounds)||!finite(s.expires,0,st.time+c.waypointTime+.1)||!finite(s.warmup,0,c.warmup+.1)||!Number.isInteger(s.station)||!finite(s.station,0,1)||!Array.isArray(s.ready)||s.ready.length!==2||!s.ready.every(r=>finite(r,0,st.time+c.reload+.1))||!finite(s.energy,0,c.energy))throw Error('Invalid source SEAD magazine');
    const n={...s,queue:[...s.queue],ready:[...s.ready]} as unknown as Controller;
    if(s.pending!==undefined){if(!record(s.pending)||!ids(s.pending.targets,c.scanLimit)||!finite(s.pending.ready,0,st.time+c.queueTime+.1))throw Error('Invalid SEAD targeting queue');n.pending={targets:[...s.pending.targets],ready:s.pending.ready};}controllers.set(e.id,n);
   }
   for(const entry of value.missiles){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source SEAD missile');const e=st.ents.get(entry[0]),c=e&&config(e)?.seadMissile,s=entry[1];
    if(!e||!c||missiles.has(e.id)||!Number.isSafeInteger(s.source)||!finite(s.source)||!Number.isSafeInteger(s.target)||!finite(s.target)||!finite(s.energy,0,c.energy)||!finite(s.speed,0,10000)||!finite(s.cruise,0,10000)||!finite(s.angular,-c.turnRate,c.turnRate)||!finite(s.height,-100,10000)||!finite(s.targetHeight,-100,10000)||typeof s.lost!=='boolean'||!finite(s.nextScript,0,st.time+c.interval+.1)||s.impact!==undefined&&!finite(s.impact,0,st.time))throw Error('Invalid source missile lifecycle');missiles.set(e.id,{...s} as unknown as Missile);
   }
   for(const v of value.blasts){if(!record(v)||typeof v.definition!=='string'||!DEFS[v.definition]||!host.config<SensorsDef>(DEFS[v.definition])?.seadMissile||!finite(v.source)||!Number.isSafeInteger(v.source)||!Number.isSafeInteger(v.owner)||!st.players[v.owner as number]||!finite(v.x,-1e6,1e6)||!finite(v.y,-1e6,1e6)||!finite(v.angle,-Math.PI,Math.PI)||!finite(v.ready,0,st.time+10)||typeof v.started!=='boolean'||!ids(v.hits,st.ents.size)||v.helperId!==undefined&&(!Number.isSafeInteger(v.helperId)||!finite(v.helperId,1,Number.MAX_SAFE_INTEGER)))throw Error('Invalid source expanding payload');blasts.push({...v,hits:[...v.hits]} as unknown as Blast);}
  },
  afterStep(){for(const id of controllers.keys())if(!st.ents.has(id)||st.ents.get(id)!.dead)controllers.delete(id);for(const id of missiles.keys())if(!st.ents.has(id)||st.ents.get(id)!.dead)missiles.delete(id);},
  dispose(){readers.delete(host.game);},
 };
}
