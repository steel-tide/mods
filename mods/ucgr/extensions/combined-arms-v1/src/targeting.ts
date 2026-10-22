import { TILE, getDef, hasRound, ownsAirMount, targetCat, weaponReaches } from './host';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { ModuleHost, EngineModuleInstance, Json } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { TARGETING_ID, type SourceTags, type TargetRestrictions, type DetectionRange } from './targetingSpec';
import { squadEntrenched } from './squads';
import { sensorAltitude, sensorRadarActive, sensorDeployed, sensorFpvDeployed } from './sensors';

const sourceReaders=new WeakMap<Game,(e:Ent)=>readonly string[]>();
export function sourceEntityTags(game:Game,e:Ent):readonly string[]{return sourceReaders.get(game)?.(e)??(getDef(e.defId).extensions?.[TARGETING_ID] as SourceTags|undefined)?.tags??[];}

interface ConcealmentState { hidden: boolean; scan: number; enterReady: number; leaveReady: number; x: number; y: number; moving: boolean; trenchEnterReady:number; trenchLeaveReady:number; energy:number }

export function sourceTargetAllowed(rules: TargetRestrictions | undefined, tags: readonly string[]): boolean {
  return !rules || ((!rules.withTags.length || rules.withTags.some(tag => tags.includes(tag)))
    && !rules.withoutTags.some(tag => tags.includes(tag)));
}
export function createTargetingModule(host: ModuleHost): EngineModuleInstance {
  const states = new Map<number, ConcealmentState>(), sight = new Map<number,number>(), st = host.game.st;
  const config = (e: Ent) => host.config<SourceTags>(getDef(e.defId));
  const sourceTags = (e: Ent): string[] => {
    let tags = config(e)?.tags ?? [];
    const altitude = sensorAltitude(host.game, e);
    if (altitude) tags = [...tags.filter(tag => tag !== '高空' && tag !== '低空'), ...(altitude === 'high' ? ['高空'] : altitude === 'low' ? ['低空'] : [])];
    const deployment = sensorDeployed(host.game,e)??sensorFpvDeployed(host.game,e);
    if(deployment!==undefined)tags=[...tags.filter(tag=>tag!=='部署'),...(deployment?['部署']:[])];
    if(sensorFpvDeployed(host.game,e)!==undefined)tags=[...tags.filter(tag=>tag!=='soldiers'),...(deployment?['soldiers']:[])];
    const radar = sensorRadarActive(host.game, e);
    if (radar !== undefined) tags = [...tags.filter(tag => tag !== '雷达工作中' && tag !== 'OFF'), radar ? '雷达工作中' : 'OFF'];
    return states.get(e.id)?.hidden ? [...tags, '隐蔽'] : tags;
  };
  sourceReaders.set(host.game,sourceTags);
  function ensure(e:Ent,cfg:NonNullable<SourceTags['concealment']>){let s=states.get(e.id);if(!s){s={hidden:false,scan:st.time,enterReady:0,leaveReady:0,trenchEnterReady:0,trenchLeaveReady:0,energy:cfg.energy?.max??0,x:e.x,y:e.y,moving:false};states.set(e.id,s);}return s;}
  const allowed = (entity: Ent, weapon: WeaponDef, target: Ent | null) => {
    const rules = host.config<TargetRestrictions>(weapon);
    const cfg=config(entity)?.concealment,cost=cfg?.energy?.costs.find(c=>c.id===weapon.id)?.amount??0;
    return (!cfg||ensure(entity,cfg).energy+1e-9>=cost)&&(!rules?.selfWithTags.length || rules.selfWithTags.some(tag => sourceTags(entity).includes(tag)))
      && (!target || sourceTargetAllowed(rules, sourceTags(target)));
  };
  function detected(e: Ent, ranges: DetectionRange[]): boolean {
    for (const target of host.participants()) {
      if (target.dead || target.inside || target.owner < 0 || st.players[e.owner]?.team === st.players[target.owner]?.team) continue;
      const tags = sourceTags(target), distance = Math.hypot(e.x - target.x, e.y - target.y);
      if (ranges.some(r => distance <= r.range && tags.includes(r.tag))) return true;
    }
    return false;
  }
  function eligible(entity: Ent, def: UnitDef, target: Ent, air: boolean, weapon?: WeaponDef): boolean {
    const category = targetCat(host.game.st, target), targetDef = getDef(target.defId);
    return def.weapons.some((w, i) => (!weapon || w.id === weapon.id) && ownsAirMount(def, w) === air
      && hasRound(entity, def, i) && weaponReaches(w, category, targetDef) && allowed(entity, w, target));
  }
  return {
    id: TARGETING_ID,
    // Native cached rays use integer tile coordinates. Keep the original
    // incoming source radius here, then clip the integer native footprint.
    // This module is registered last among definition-changing policies.
    effectiveDef(e,def){if(!config(e))return def;sight.set(e.id,def.vision);return Number.isInteger(def.vision)?def:{...def,vision:Math.ceil(def.vision)};},
    filterVisionTiles(e,tiles){const radius=sight.get(e.id);if(radius===undefined||Number.isInteger(radius))return tiles;const x=Math.floor(e.x/TILE),y=Math.floor(e.y/TILE),limit=radius*radius+radius;return tiles.filter(index=>{const dx=index%st.map.w-x,dy=Math.floor(index/st.map.w)-y;return dx*dx+dy*dy<=limit;});},
    beforeStep(dt) {
      for (const e of host.participants()) {
        const cfg = config(e)?.concealment;
        if (!cfg || e.dead || e.inside) continue;
        const s=ensure(e,cfg);if(cfg.energy)s.energy=Math.min(cfg.energy.max,s.energy+cfg.energy.regen*dt);
        s.moving ||= Math.hypot(e.x-s.x, e.y-s.y) > 1e-6; s.x = e.x; s.y = e.y;
        if (st.time + 1e-9 < s.scan) continue;
        s.scan += cfg.interval;
        const trench=squadEntrenched(host.game,e),policy=trench?cfg.trench:cfg;
        if(!policy){s.moving=false;continue;}
        const enterReady=trench?'trenchEnterReady':'enterReady',leaveReady=trench?'trenchLeaveReady':'leaveReady';
        const full=!cfg.energy||s.energy+1e-9>=cfg.energy.max;
        // These are target tags. Movement prevents entering concealment but
        // does not by itself reveal a soldier who was already concealed.
        if (!s.hidden && !s.moving && full && st.time >= s[enterReady] && !detected(e, policy.enter)) {
          s.hidden = true; s[enterReady] = st.time + cfg.cooldown;
        } else if (s.hidden && st.time >= s[leaveReady] && (!full||detected(e, policy.leave))) {
          s.hidden = false; s[leaveReady] = st.time + cfg.cooldown;
        }
        s.moving = false;
      }
      for (const id of states.keys()) if (!st.ents.has(id) || st.ents.get(id)!.dead) states.delete(id);
    },
    onShot(e,_def,weapon){const cfg=config(e)?.concealment;if(cfg?.energy){const s=ensure(e,cfg);s.energy=Math.max(0,s.energy-(cfg.energy.costs.find(c=>c.id===weapon.id)?.amount??0));}},
    canFire(e, _def, weapon, _point, target) { return allowed(e, weapon, target); },
    wrapFirePolicy(next) { return (e, def, weapon, point, target) => allowed(e, weapon, target) && next(e, def, weapon, point, target); },
    wrapTargetTracking(next) { return (st, hash, e, def, target, throughFog, air = false, weapon) =>
      eligible(e, def, target, air, weapon) && next(st, hash, e, def, target, throughFog, air, weapon); },
    wrapTargetAcquisition(next) { return (st, hash, e, def, range = 1, air = false, accepts, priority, candidates, weapon) =>
      next(st, hash, e, def, range, air, target => eligible(e, def, target, air, weapon) && (!accepts || accepts(target)), priority, candidates, weapon); },
    snapshot(view) {
      const out: Record<string, Json> = {};
      for (const [id, s] of states) if (!view || view.privateEntity(id)) out[id] = { ...s };
      return out;
    },
    restore(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source targeting state');
      states.clear();
      for (const [key, raw] of Object.entries(value)) {
        const id = Number(key), e = st.ents.get(id), s = raw as ConcealmentState;
        if (!Number.isSafeInteger(id) || id <= 0 || !e || !config(e)?.concealment || !s || typeof s !== 'object' || Array.isArray(s)
          || Object.keys(s).sort().join() !== 'energy,enterReady,hidden,leaveReady,moving,scan,trenchEnterReady,trenchLeaveReady,x,y'
          || typeof s.hidden !== 'boolean' || typeof s.moving !== 'boolean'
          || ![s.scan,s.enterReady,s.leaveReady,s.trenchEnterReady,s.trenchLeaveReady,s.energy,s.x,s.y].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)
          || s.energy>(config(e)?.concealment?.energy?.max??0)||Math.max(s.enterReady,s.leaveReady,s.trenchEnterReady,s.trenchLeaveReady) > st.time + 60 || s.scan > st.time + 10) throw new Error('Invalid source concealment state');
        states.set(id, { ...s });
      }
    },
    dispose() { states.clear();sight.clear();sourceReaders.delete(host.game); },
  };
}
