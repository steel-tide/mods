import { normAngle, ownsAirMount, ownsSubMount, unitDisplayScale, getDef } from './host';
import type { UnitDef, WeaponDef, TurretMount } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { GroundAim } from '../../../../../../steel-tide/game/core/src/game/combat';
import type { EngineModuleInstance, Json, ModuleHost, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ComponentPayload } from './componentsSpec';

interface Clock { form:string; guns:Record<string,number> }
interface Tick { entity:Ent; dt:number; active:boolean; checked:Map<string,boolean> }
/** Source reset-mode warmup: reload completes first, aiming warms the barrel,
 * and crossing the threshold fires on the following update. All source turrets
 * use the default decay4; their shared idle decision is preserved per hull. */
export function createSourceWarmup(host:ModuleHost) {
  const clocks=new Map<number,Clock>();let tick:Tick|undefined,query=0,bypass=false;
  const config=(w:WeaponDef)=>host.config<ComponentPayload>(w)?.warmup;
  function clock(e:Ent):Clock {
    let c=clocks.get(e.id);if(!c){c={form:e.defId,guns:{}};clocks.set(e.id,c);}
    if(c.form!==e.defId){c.form=e.defId;const allowed=new Set(getDef(e.defId).weapons.filter(w=>config(w)).map(w=>w.id));for(const id of Object.keys(c.guns))if(!allowed.has(id))delete c.guns[id];}
    return c;
  }
  function at(e:Ent,d:UnitDef,m?:TurretMount):GroundAim {
    if(!m)return e;const scale=unitDisplayScale(d),a=d.kind==='building'?0:e.angle+Math.PI/2;
    return {x:e.x+(m.x*Math.cos(a)-m.y*Math.sin(a))*scale,y:e.y+(m.x*Math.sin(a)+m.y*Math.cos(a))*scale};
  }
  function aligned(e:Ent,d:UnitDef,w:WeaponDef,point:GroundAim):boolean {
    const own=ownsAirMount(d,w),sub=ownsSubMount(d,w);
    if(own&&d.airMount?.on==='hull'){const o=at(e,d,d.airMount);return Math.abs(normAngle(e.angle+(e.mountAngle??0)-Math.atan2(point.y-o.y,point.x-o.x)))<=.35;}
    if(own||sub)return true;
    const o=at(e,d,d.turretMounts?.length===1?d.turretMounts[0]:undefined),a=Math.atan2(point.y-o.y,point.x-o.x);
    if(w.turret&&d.turretSprite)return Math.abs(normAngle(e.turretAngle-a))<=.35;
    return w.turret||!!d.kamikaze||!!w.vertical||Math.abs(normAngle(e.angle-a))<=(d.domain==='air'?.6:.3);
  }
  return {
    wrapWeapons(next:Parameters<NonNullable<EngineModuleInstance['wrapWeapons']>>[0]):ReturnType<NonNullable<EngineModuleInstance['wrapWeapons']>> {
      return (...args)=>{
        const e=args[1],def=args[2];if(!def.weapons.some(w=>config(w))){next(...args);return;}
        const previous=tick,c=clock(e),local:Tick={entity:e,dt:args[4],active:false,checked:new Map()};tick=local;
        try{next(...args);}finally{
          if(!local.active)for(const w of def.weapons){const cfg=config(w);if(cfg&&c.guns[w.id])c.guns[w.id]=Math.max(0,c.guns[w.id]-cfg.decay*local.dt);}
          tick=previous;
        }
      };
    },
    wrapTargetAcquisition(next:Parameters<NonNullable<EngineModuleInstance['wrapTargetAcquisition']>>[0]):ReturnType<NonNullable<EngineModuleInstance['wrapTargetAcquisition']>> {
      return (...args)=>{query++;try{return next(...args);}finally{query--;}};
    },
    canFire(e:Ent,d:UnitDef,w:WeaponDef,point:GroundAim,target:Ent|null):boolean {
      // Planner probes and forced/scripted shots never spend aiming time.
      if(bypass||query||!tick||tick.entity!==e)return true;
      const previous=tick.checked.get(w.id);if(previous!==undefined)return previous;
      const wi=getDef(e.defId).weapons.findIndex(a=>a.id===w.id);
      if(wi<0||(e.wcd[wi]??0)>0||e.holdFire||!aligned(e,d,w,point))return true;
      let allowed:boolean;bypass=true;try{allowed=host.canFire(e,d,w,point,target);}finally{bypass=false;}
      if(!allowed)return false;
      tick.active=true;const cfg=config(w);if(!cfg)return true;
      const c=clock(e),progress=c.guns[w.id]??0,ready=progress+1e-10>=cfg.seconds;
      if(!ready)c.guns[w.id]=progress+tick.dt;
      tick.checked.set(w.id,ready);return ready;
    },
    shot(e:Ent,w:WeaponDef):void {if(tick?.entity===e&&tick.checked.get(w.id)===true&&config(w))clock(e).guns[w.id]=0;},
    snapshot(view?:RuntimeView):Json {
      const out:Record<string,Json>={};for(const [id,c] of clocks){const e=host.game.st.ents.get(id);if(!e||e.dead){clocks.delete(id);continue;}if(view&&(!view.visibleEntities.has(id)||!view.privateEntity(id)))continue;const guns=Object.fromEntries(Object.entries(clock(e).guns).filter(([,v])=>v>0));if(Object.keys(guns).length)out[id]={form:c.form,guns};}return out;
    },
    restore(value:unknown):void {
      if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid source warmup');const next=new Map<number,Clock>();
      for(const [key,raw] of Object.entries(value)){const id=Number(key),e=host.game.st.ents.get(id),c=raw as Clock;
        if(!Number.isSafeInteger(id)||String(id)!==key||!e||!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>k!=='form'&&k!=='guns')||c.form!==e.defId||!c.guns||typeof c.guns!=='object'||Array.isArray(c.guns))throw new Error('Invalid source warmup entity');
        for(const [gun,n] of Object.entries(c.guns)){const w=getDef(e.defId).weapons.find(w=>w.id===gun),cfg=w&&config(w);if(!cfg||typeof n!=='number'||!Number.isFinite(n)||n<0||n>cfg.seconds+3600)throw new Error('Invalid source warmup clock');}
        next.set(id,{form:c.form,guns:{...c.guns}});
      }clocks.clear();for(const [id,c] of next)clocks.set(id,c);
    },
  };
}
