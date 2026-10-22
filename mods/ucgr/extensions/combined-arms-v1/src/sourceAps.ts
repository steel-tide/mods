import { DEFS, getDef, turnToward } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Json, ModuleHost, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ApsDef, ComponentPayload, ComponentsDef, IncomingDef } from './componentsSpec';
interface Launcher { count:number; loaded:boolean; elapsed:number; cooldown:number }
interface Interceptor { target:number; source:number; definition:string; config:ApsDef }
/** Source APS.ini uses projectile interception, not an impact shield. Its two
 * attachments have independent loaded rounds, reserves and strict reload timers. */
export function createSourceAps(host:ModuleHost) {
  const st=host.game.st, launchers=new Map<number,Launcher[]>(), interceptors=new Map<number,Interceptor>(), children=new Set<number>(),ended=new Set<number>();
  const cfg=(e:Ent):ApsDef|undefined=>host.config<ComponentsDef>(getDef(e.defId))?.aps;
  const weapon=(p:Proj)=>{const n=p.gun?.lastIndexOf('/')??-1;return n<0?undefined:DEFS[p.gun!.slice(0,n)]?.weapons.find(w=>w.id===p.gun!.slice(n+1));};
  const incoming=(p:Proj):IncomingDef|undefined=>{const w=weapon(p),d=w&&host.config<ComponentPayload>(w)?.incoming;if(!d)return;return p.id!==undefined&&children.has(p.id)?{tags:d.child?.tags??[],end:d.end}:d;};
  function state(e:Ent,d:ApsDef):Launcher[]{let s=launchers.get(e.id);if(!s){s=d.launchers.map(l=>({count:l.capacity,loaded:true,elapsed:0,cooldown:0}));launchers.set(e.id,s);}return s;}
  return {
    incomingTags(p:Proj):readonly string[]{return incoming(p)?.tags??[];},
    claimed():ReadonlySet<number>{return new Set([...interceptors.values()].map(i=>i.target));},
    needsRefill(e:Ent):boolean{const d=cfg(e);return !!d&&state(e,d).some((l,i)=>l.count<d.launchers[i].capacity);},
    replenish(e:Ent):void{const d=cfg(e);if(d)launchers.set(e.id,d.launchers.map((l,i)=>({count:l.capacity,loaded:true,elapsed:0,cooldown:launchers.get(e.id)?.[i]?.cooldown??0})));},
    counts(e:Ent):number[]|undefined{const d=cfg(e);return d?state(e,d).map(l=>l.count):undefined;},
    beforeProjectiles(dt:number):void{
      const live=new Set(st.projs.map(p=>p.id));for(const id of children)if(!live.has(id))children.delete(id);for(const id of ended)if(!live.has(id))ended.delete(id);for(const id of interceptors.keys())if(!live.has(id))interceptors.delete(id);
      const claimed=new Set([...interceptors.values()].map(p=>p.target));
      for(const e of host.participants()){
        const d=cfg(e);if(!d||e.dead||e.inside||e.site)continue;
        const s=state(e,d),angle=e.angle+Math.PI/2;
        for(let i=0;i<s.length;i++){
          const l=s[i],mount=d.launchers[i];l.elapsed+=dt;l.cooldown=Math.max(0,l.cooldown-dt);
          if(!l.loaded&&l.count>=1&&l.elapsed>mount.reload){l.loaded=true;l.elapsed=0;}
          if(!l.loaded||l.cooldown>0)continue;
          const x=e.x+mount.x*Math.cos(angle)-mount.y*Math.sin(angle),y=e.y+mount.x*Math.sin(angle)+mount.y*Math.cos(angle);
          // RW scans creation order and retains the LAST eligible projectile.
          // It excludes a quarry already claimed by another interceptor.
          let target:Proj|undefined;
          for(const p of st.projs){const spec=incoming(p);if(!spec||!spec.tags.some(t=>t==='ATGM'||t==='ATGM2')||p.downed||p.ttl<=0||p.team===st.players[e.owner].team||Math.hypot(p.x-x,p.y-y)>=d.range)continue;p.id??=st.nextProjId++;if(!claimed.has(p.id))target=p;}
          if(!target)continue;
          l.loaded=false;l.count--;l.elapsed=0;l.cooldown=d.cadence;claimed.add(target.id!);
          const a=Math.atan2(target.y-y,target.x-x),p:Proj={id:st.nextProjId++,x,y,px:x,py:y,angle:a,speed:d.speed+st.rng.range(-d.spread,d.spread),kind:'bullet',homing:false,targetId:0,tx:target.x,ty:target.y,dmg:0,splash:0,owner:e.owner,team:st.players[e.owner].team,src:e.id,ttl:d.life,hitsSub:false,hitsAir:false,hitsGround:true};
          interceptors.set(p.id!,{target:target.id!,source:e.id,definition:e.defId,config:d});st.projs.push(p);
        }
      }
    },
    projectileStep(p:Proj,dt:number):'keep'|'remove'|undefined{
      const state=p.id===undefined?undefined:interceptors.get(p.id);if(!state)return;
      const d=state.config,q=st.projs.find(q=>q.id===state.target);
      p.px=p.x;p.py=p.y;p.ttl=Math.max(0,p.ttl-dt);
      if(q){p.tx=q.x;p.ty=q.y;}
      const distance=Math.hypot(p.tx-p.x,p.ty-p.y),step=p.speed*dt;
      p.angle=turnToward(p.angle,Math.atan2(p.ty-p.y,p.tx-p.x),d.turn*dt);
      const travel=Math.min(step,distance);p.x+=Math.cos(p.angle)*travel;p.y+=Math.sin(p.angle)*travel;
      p.speed+=Math.sign(d.targetSpeed-p.speed)*Math.min(Math.abs(d.targetSpeed-p.speed),d.acceleration*dt);
      // Source checks its pre-move distance, or zero after clamping travel to
      // the target. Expiry ALSO triggers removeTargetLifeOnly if quarry exists.
      if(distance<d.contact||distance<step||p.ttl===0){
        if(q&&!q.downed)q.ttl=0;
        const fullRadius=4,currentRadius=fullRadius*Math.min(1,dt/1.25);
        for(const e of st.ents.values()){
          if(e.dead||e.inside||st.players[e.owner]?.team===p.team||getDef(e.defId).domain==='air')continue;
          const distance=Math.hypot(e.x-p.x,e.y-p.y);if(distance>currentRadius)continue;
          const raw=.6*Math.min(1,1.1-distance/fullRadius),armor=host.config<ComponentsDef>(getDef(e.defId))?.sourceArmor;
          const amount=armor?Math.max(Math.min(armor.minimum,raw),raw-armor.armor):raw;
          host.applyDamage(st,e,amount,undefined,p.owner,p.src);
        }
        interceptors.delete(p.id!);return 'remove';
      }
      return 'keep';
    },
    afterImpact(p:Proj):void{
      const d=incoming(p);if(!d||p.ttl>0)return;p.id??=st.nextProjId++;if(ended.has(p.id))return;ended.add(p.id);if(!d.child||!st.rng.chance(d.child.chance))return;
      const c=d.child,angle=p.angle+st.rng.range(-c.angle,c.angle);
      const child:Proj={...p,id:st.nextProjId++,px:p.x,py:p.y,angle,speed:c.speed,ttl:c.life,downed:undefined};
      children.add(child.id!);st.projs.push(child);
    },
    snapshot(view?:RuntimeView):Json{
      const entities:Record<string,Json>={};for(const e of host.participants()){const d=cfg(e);if(d&&!e.dead&&(!view||view.privateEntity(e.id)&&view.visibleEntities.has(e.id)))entities[e.id]=state(e,d).map(l=>({...l}));}
      return {entities,interceptors:view?[]:[...interceptors].filter(([id])=>st.projs.some(p=>p.id===id)).map(([id,s])=>({id,target:s.target,source:s.source,definition:s.definition})),children:view?[]:[...children].filter(id=>st.projs.some(p=>p.id===id)),ended:view?[]:[...ended].filter(id=>st.projs.some(p=>p.id===id))};
    },
    restore(raw:unknown):void{
      const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
      const keys=(v:object,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
      const value=raw as {entities?:Record<string,Launcher[]>;interceptors?:{id:number;target:number;source:number;definition:string}[];children?:number[];ended?:number[]};
      if(!plain(value)||!keys(value,['entities','interceptors','children','ended'])||!plain(value.entities)||!Array.isArray(value.interceptors)||!Array.isArray(value.children)||value.ended!==undefined&&!Array.isArray(value.ended))throw new Error('Invalid source APS state');
      if(Object.keys(value.entities).length>st.ents.size||value.interceptors.length>st.projs.length||value.children.length>st.projs.length)throw new Error('Oversized APS state');
      const next=new Map<number,Launcher[]>(),rounds=new Map<number,Interceptor>(),childIds=new Set<number>();
      for(const [id,ls]of Object.entries(value.entities)){const e=st.ents.get(Number(id)),d=e&&cfg(e);if(!e||!d||!Array.isArray(ls)||ls.length!==d.launchers.length)throw new Error('Invalid APS owner');
        if(ls.some((l,i)=>!plain(l)||!keys(l,['count','loaded','elapsed','cooldown'])||!Number.isInteger(l.count)||l.count< -1||l.count>d.launchers[i].capacity||typeof l.loaded!=='boolean'||!Number.isFinite(l.elapsed)||l.elapsed<0||!Number.isFinite(l.cooldown)||l.cooldown<0||l.cooldown>d.cadence))throw new Error('Invalid APS launcher');next.set(e.id,ls.map(l=>({...l})));}
      for(const r of value.interceptors){const def=DEFS[r.definition],d=def&&host.config<ComponentsDef>(def)?.aps;if(!plain(r)||!keys(r,['id','target','source','definition'])||!d||!Number.isSafeInteger(r.target)||r.target<1||!st.projs.some(p=>p.id===r.id)||rounds.has(r.id))throw new Error('Invalid APS interceptor');rounds.set(r.id,{target:r.target,source:r.source,definition:r.definition,config:d});}
      for(const id of value.children){const p=st.projs.find(p=>p.id===id);if(!p||!weapon(p)||!host.config<ComponentPayload>(weapon(p)!)?.incoming?.child||childIds.has(id))throw new Error('Invalid APS continuation');childIds.add(id);}
      launchers.clear();for(const [id,s]of next)launchers.set(id,s);interceptors.clear();for(const [id,s]of rounds)interceptors.set(id,s);children.clear();for(const id of childIds)children.add(id);ended.clear();for(const id of value.ended??[]){if(!Number.isSafeInteger(id)||!st.projs.some(p=>p.id===id))throw new Error('Invalid expired source projectile');ended.add(id);}
    },
  };
}
