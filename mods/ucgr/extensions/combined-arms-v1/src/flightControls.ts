import { getDef } from './host';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Json, ModuleAction, ModuleHost, ModuleOrder, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { SensorsDef } from './sensorsSpec';
import { record } from './sensorsSpec';

export type SourceAltitude = 'normal'|'low'|'high';
export interface FlightControlSpec {
  initial: SourceAltitude; initialHeight:number; lowHeight:number; highHeight:number; heightSpread:number; heightRate:number;
  altitudeTime:number; altitudeCooldown:number; thrust:number; thrustDuration:number; thrustCooldown:number;
  brake:number; brakeTurn:number; damageThresholds:number[]; damageSpeed:number;
  highRangeBonus?:number; rangeWeapons?:string[];
  heightWeapons?:{id:string;below?:number;above?:number}[];
}
interface FlightControlState { altitude:SourceAltitude; height:number; targetHeight:number; altitudeReady:number; pending?:{altitude:'low'|'high';ready:number}; thrustUntil:number; thrustReady:number; brake:boolean; damage:number; speedOffset?:number; }
const readers=new WeakMap<Game,(e:Ent)=>SourceAltitude|undefined>();
/** Source tag consumers read this match-local classification, not native alt's landing fraction. */
export function sensorAltitude(game:Game,e:Ent):SourceAltitude|undefined{return readers.get(game)?.(e);}

export function createFlightControls(host:ModuleHost){
  const st=host.game.st,states=new Map<number,FlightControlState>();
  const config=(e:Ent)=>host.config<SensorsDef>(getDef(e.defId))?.flightControls;
  const alive=(e:Ent)=>!e.dead&&!e.inside&&!e.site;
  const randomHeight=(cfg:FlightControlSpec,altitude:'low'|'high')=>(altitude==='low'?cfg.lowHeight:cfg.highHeight)+st.rng.range(-cfg.heightSpread,cfg.heightSpread);
  function state(e:Ent,cfg:FlightControlSpec):FlightControlState{
    let s=states.get(e.id);if(s)return s;
    // Source created triggers call the high/low action immediately. Player
    // actions are queued; a normal-height aircraft has no initial action.
    s={altitude:cfg.initial,height:cfg.initialHeight,targetHeight:cfg.initialHeight,altitudeReady:0,thrustUntil:0,thrustReady:0,brake:false,damage:0};
    if(cfg.initial!=='normal'){s.targetHeight=randomHeight(cfg,cfg.initial);s.height=s.targetHeight;s.altitudeReady=st.time+cfg.altitudeCooldown;}
    states.set(e.id,s);return s;
  }
  readers.set(host.game,e=>{const cfg=config(e);return cfg?states.get(e.id)?.altitude??cfg.initial:undefined;});
  const action=(id:string,label:string[],enabled:boolean):ModuleAction=>({id:`flight:${id}`,label,enabled});
  const additive=(s:FlightControlState,cfg:FlightControlSpec)=>(s.thrustUntil>st.time?cfg.thrust:0)-(s.brake?cfg.brake:0)-cfg.damageThresholds.reduce((n,_,i)=>n+((s.damage&(1<<i))?cfg.damageSpeed:0),0);
  return {
    resetSpeed(e:Ent,fraction:number){const cfg=config(e);if(!cfg)return;const s=state(e,cfg);s.speedOffset=fraction-additive(s,cfg);},
    beforeStep(dt:number){for(const e of host.participants()){
      const cfg=config(e);if(!cfg||e.dead)continue;const s=state(e,cfg);
      if(s.pending&&st.time+1e-9>=s.pending.ready){s.altitude=s.pending.altitude;s.targetHeight=randomHeight(cfg,s.pending.altitude);s.altitudeReady=st.time+cfg.altitudeCooldown;delete s.pending;}
      const distance=s.targetHeight-s.height;s.height+=Math.sign(distance)*Math.min(Math.abs(distance),cfg.heightRate*dt);
      // Original loss is permanent and additive, once per crossed damage flag,
      // and only while moving. Repair does not clear any of those flags.
      if(Math.hypot(e.x-e.prevX,e.y-e.prevY)>.001){for(let i=0;i<cfg.damageThresholds.length;i++)if(!(s.damage&(1<<i))&&e.hp<=getDef(e.defId).hp*cfg.damageThresholds[i])s.damage|=1<<i;}
    }},
    effectiveDef(e:Ent,def:UnitDef):UnitDef{const cfg=config(e);if(!cfg)return def;const s=state(e,cfg),base=getDef(e.defId);
      const factor=additive(s,cfg)+(s.speedOffset??0);
      const weapons=cfg.highRangeBonus&&s.altitude==='high'?def.weapons.map(w=>cfg.rangeWeapons?.includes(w.id)?{...w,range:w.range+cfg.highRangeBonus!}:w):def.weapons;
      return {...def,weapons,speed:Math.max(0,def.speed+base.speed*factor),turnRate:def.turnRate+(s.brake?cfg.brakeTurn:0),altitude:s.height};
    },
    canFire(e:Ent,w:WeaponDef):boolean{const cfg=config(e),gate=cfg?.heightWeapons?.find(a=>a.id===w.id);if(!cfg||!gate)return true;const h=state(e,cfg).height;return (gate.below===undefined||h<gate.below)&&(gate.above===undefined||h>gate.above);},
    actions(e:Ent):ModuleAction[]{const cfg=config(e);if(!cfg||!alive(e))return[];const s=state(e,cfg),ready=!s.pending&&st.time>=s.altitudeReady;
      return [...(s.altitude==='low'?[action('high',['Increase Cruise Altitude','提升巡航高度','순항 고도 상승'],ready)]:s.altitude==='high'?[action('low',['Decrease Cruise Altitude','降低巡航高度','순항 고도 하강'],ready)]:[]),
        action('thrust',['Full Speed Ahead','全速前进','최대 속도'],st.time>=s.thrustReady),
        action('brake',s.brake?['Retract Speed Brakes','关闭减速板','에어 브레이크 접기']:['Deploy Speed Brakes','开启减速板','에어 브레이크 전개'],true)];
    },
    order(e:Ent,order:ModuleOrder):boolean{const cfg=config(e);if(!cfg||!alive(e))return false;const s=state(e,cfg);
      if(order.action==='flight:high'||order.action==='flight:low'){const altitude=order.action==='flight:high'?'high':'low';if(s.altitude==='normal'||s.altitude===altitude||s.pending||st.time<s.altitudeReady)return false;s.pending={altitude,ready:st.time+cfg.altitudeTime};return true;}
      if(order.action==='flight:thrust'){if(st.time<s.thrustReady)return false;s.thrustUntil=st.time+cfg.thrustDuration;s.thrustReady=st.time+cfg.thrustCooldown;return true;}
      if(order.action==='flight:brake'){s.brake=order.on??!s.brake;return true;}return false;
    },
    render(e:Ent){const cfg=config(e);if(!cfg)return;return {altitude:states.get(e.id)?.height??cfg.initialHeight};},
    hasState:()=>states.size>0,
    snapshot(view?:RuntimeView):Json{return [...states].filter(([id])=>!view||view.visibleEntities.has(id)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{altitude:s.altitude,height:s.height,targetHeight:s.height,altitudeReady:0,thrustUntil:0,thrustReady:0,brake:false,damage:0}]) as unknown as Json;},
    restore(value:unknown){states.clear();if(value===undefined)return;if(!Array.isArray(value)||value.length>st.ents.size)throw Error('Invalid source flight controls');
      const finite=(v:unknown,min=0,max=1e12):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
      for(const entry of value){if(!Array.isArray(entry)||!Number.isSafeInteger(entry[0])||!record(entry[1]))throw Error('Invalid source aircraft');const e=st.ents.get(entry[0]),cfg=e&&config(e),s=entry[1];
        if(!e||!cfg||states.has(e.id)||!['normal','low','high'].includes(s.altitude as string)||!finite(s.height,0,10000)||!finite(s.targetHeight,0,10000)||!finite(s.altitudeReady,0,st.time+cfg.altitudeCooldown+.2)||!finite(s.thrustUntil,0,st.time+cfg.thrustDuration+.1)||!finite(s.thrustReady,0,st.time+cfg.thrustCooldown+.1)||typeof s.brake!=='boolean'||!Number.isSafeInteger(s.damage)||!finite(s.damage,0,(1<<cfg.damageThresholds.length)-1))throw Error('Invalid source flight control state');
        const next:FlightControlState={altitude:s.altitude as SourceAltitude,height:s.height,targetHeight:s.targetHeight,altitudeReady:s.altitudeReady,thrustUntil:s.thrustUntil,thrustReady:s.thrustReady,brake:s.brake,damage:s.damage};
        if(s.speedOffset!==undefined){if(!finite(s.speedOffset,-5,5))throw Error('Invalid source loadout speed');next.speedOffset=s.speedOffset;}
        if(s.pending!==undefined){if(!record(s.pending)||!['low','high'].includes(s.pending.altitude as string)||!finite(s.pending.ready,0,st.time+cfg.altitudeTime+.1))throw Error('Invalid queued altitude action');next.pending={altitude:s.pending.altitude as 'low'|'high',ready:s.pending.ready};}states.set(e.id,next);
      }
    },
    afterStep(){for(const id of states.keys())if(!st.ents.has(id))states.delete(id);},
    dispose(){readers.delete(host.game);},
  };
}
