import { sourceEntityTags } from './targeting';
import { logisticsStock, logisticsTakeStock } from './logistics';
import { componentArtilleryReady, componentImmobilized } from './components';
import { cmdPickup, cmdEmbarkGroup, cmdDisembarkGroup } from './host';
import { TILE } from './host';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { normAngle, turnToward } from './host';
import { unitDisplayScale } from './host';
import { t } from './strings';
import { walkGridLine } from './host';
import { getDef } from './host';
import { kill, targetCat, weaponReaches, weaponCanBombard, groundAimCat, ownsAirMount, ownsSubMount } from './host';
import type { GroundAim } from '../../../../../../steel-tide/game/core/src/game/combat';
import { hasRound } from './host';
import { abilityReloadMul } from './host';
import { ruleMul } from './host';
import { canPlace, techMet } from './host';
import { setEntityDef } from './host';
import { cargoDist, cargoLoad, cargoWeight } from './host';
import { maxHp } from './host';
import { markBlocked, newEnt, footprintTiles } from './host';
import type { Ent, GameState } from '../../../../../../steel-tide/game/core/src/game/state';
import { passable, hullBeam } from './host';
import type { EngineModuleInstance, Json, ModuleHost, ModuleAction } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ArticulationDef, ArticulationWeapon, AttachmentSpec, DeploymentSpec, MountSpec, TowSpec } from './articulationSpec';
import { record } from './sensorsSpec';

/** A ring's world bearing; `base` is what it stands on (hull or parent ring) as that stood when the ring last rode it. */
interface Bearing { velocity?: number; bore: number; angle: number; previousAngle: number; base?: number; target: number; burst?: { weapon: string; left: number; cd: number; shot: number; target: number; x: number; y: number } }
interface BarrageJob { id: string; x: number; y: number; elapsed: number; left: number; first: boolean }
interface Assembly { energy?:number; barrage?: BarrageJob; cooldowns?: Record<string,number>; definition: string; members: Record<string, number>; mounts: Record<string, Bearing>; initialized: boolean; parentAngle?: number; tow?: number; job?: { id: string; from: string; elapsed: number } }
interface Pose { x: number; y: number; angle: number }
export interface ArticulationVisual {
  mounts: { id: string; sprite?: string; recoil?: number; x: number; y: number; angle: number; previousAngle: number }[];
  attachments: { slot: string; childId: number }[];
  squad: boolean;
  parentId?: number;
  selectParent?: boolean;
  towing?: number;
  deployment?: { id: string; progress: number };
}

type PointPose = { x: number; y: number; angle: number };
const pointPoses = new WeakMap<object, (e: Ent, mount: string | undefined, x: number, y: number) => PointPose | undefined>();
/** World pose of a point carried by an articulation ring (mount-frame px) or, without one, by the hull. */
export function articulationPointPose(game: object, e: Ent, mount: string | undefined, x: number, y: number): PointPose | undefined {
  return pointPoses.get(game)?.(e, mount, x, y);
}

export function createArticulationModule(host: ModuleHost): EngineModuleInstance {
  const st = host.game.st, states = new Map<number, Assembly>();
  const children = new Map<number, { parent: number; slot: string }>(), trailers = new Map<number, number>(), prior = new Map<number, Pose>(), committed = new Map<number, Pose>();
  const config = (e: Ent): ArticulationDef | undefined => host.config<ArticulationDef>(getDef(e.defId));
  const live = (e: Ent | undefined): e is Ent => !!e && !e.dead && !e.inside;
  function state(e: Ent): Assembly {
    let s = states.get(e.id); if (!s) { s = { definition: e.defId, members: Object.create(null), mounts: Object.create(null), initialized: false }; states.set(e.id, s); }
    s.definition = e.defId;
    const sourceEnergy=config(e)?.sourceEnergy;if(sourceEnergy&&s.energy===undefined)s.energy=sourceEnergy.max;
    const mounts = config(e)?.mounts ?? [];
    for (const m of mounts) s.mounts[m.id] ??= { bore: 0, angle: e.angle + m.rest, previousAngle: e.angle + m.rest, target: 0 };
    for (const m of mounts) s.mounts[m.id].base ??= m.parent ? s.mounts[m.parent].angle : getDef(e.defId).kind === 'building' ? -Math.PI / 2 : e.angle;
    return s;
  }
  function pose(e: Ent, mount: MountSpec, def = getDef(e.defId), seen = new Set<string>()): Pose {
    const cfg = config(e)!, s = state(e), parent = mount.parent && cfg.mounts.find(m => m.id === mount.parent);
    const base = parent && !seen.has(parent.id) ? (seen.add(mount.id), pose(e, parent, def, seen)) : { x: e.x, y: e.y, angle: def.kind === 'building' ? -Math.PI / 2 : e.angle };
    const a = base.angle + Math.PI / 2, scale = unitDisplayScale(def);
    return { x: base.x + (mount.x * Math.cos(a) - mount.y * Math.sin(a)) * scale,
      y: base.y + (mount.x * Math.sin(a) + mount.y * Math.cos(a)) * scale, angle: s.mounts[mount.id].angle };
  }
  pointPoses.set(host.game, (e, mountId, x, y) => {
    const def = getDef(e.defId), scale = unitDisplayScale(def);
    let base: Pose = { x: e.x, y: e.y, angle: def.kind === 'building' ? -Math.PI / 2 : e.angle };
    if (mountId) { const m = config(e)?.mounts.find(m => m.id === mountId); if (!m) return; state(e); base = pose(e, m, def); }
    const a = base.angle + Math.PI / 2;
    return { x: base.x + (x * Math.cos(a) - y * Math.sin(a)) * scale, y: base.y + (x * Math.sin(a) + y * Math.cos(a)) * scale, angle: base.angle };
  });
  function memberPose(e: Ent, slot: AttachmentSpec): Pose {
    const def = getDef(e.defId), a = def.kind === 'building' ? 0 : e.angle + Math.PI / 2, scale = unitDisplayScale(def);
    return { x: e.x + (slot.x * Math.cos(a) - slot.y * Math.sin(a)) * scale, y: e.y + (slot.x * Math.sin(a) + slot.y * Math.cos(a)) * scale, angle: e.angle + slot.rest };
  }
  function place(e: Ent, p: Pose): void { e.x = p.x; e.y = p.y; e.angle = p.angle; }
  function clearSelfGrid(e: Ent): GameState {
    if (getDef(e.defId).kind !== 'building') return st;
    const blocked = st.blocked.slice(), f = footprintTiles(e);
    for (let y = f.y0; y < f.y0 + f.h; y++) for (let x = f.x0; x < f.x0 + f.w; x++) if (blocked[y * st.map.w + x] === e.id || blocked[y * st.map.w + x] === 1) blocked[y * st.map.w + x] = 0;
    return { ...st, blocked };
  }
  function sweep(e: Ent, from: Pose, to: Pose, ignore: Set<number>, world = st, def = getDef(e.defId)): boolean {
    const radius = Math.max(1, def.radius, (def.body?.r ?? 0) + (def.body?.len ?? 0) / 2), offsets = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * .707, radius * .707], [-radius * .707, radius * .707], [radius * .707, -radius * .707], [-radius * .707, -radius * .707]];
    for (const [ox, oy] of offsets) if (!walkGridLine(from.x + ox, from.y + oy, to.x + ox, to.y + oy, (x, y, nx, ny) => {
      const test = (tx: number, ty: number): boolean => passable(world, def.domain, tx, ty, hullBeam(def));
      return test(nx, ny) && (x === nx || y === ny || (test(x, ny) && test(nx, y)));
    })) return false;
    const dx = to.x - from.x, dy = to.y - from.y, n = dx * dx + dy * dy;
    for (const other of st.ents.values()) {
      if (!live(other) || ignore.has(other.id) || getDef(other.defId).domain === 'air' || getDef(other.defId).kind === 'building') continue;
      const k = n ? Math.max(0, Math.min(1, ((other.x - from.x) * dx + (other.y - from.y) * dy) / n)) : 0;
      const otherDef = getDef(other.defId), limit = radius + Math.max(otherDef.radius, (otherDef.body?.r ?? 0) + (otherDef.body?.len ?? 0) / 2);
      // Existing overlap may separate; it must never become deeper while coupled.
      const d = Math.hypot(other.x - from.x - k * dx, other.y - from.y - k * dy);
      const old = Math.hypot(other.x - from.x, other.y - from.y);
      if (d < limit && (!n || d < old - 1e-5)) return false;
    }
    return true;
  }
  function initialize(e: Ent, s: Assembly, cfg: ArticulationDef): void {
    if (s.initialized || e.site || !live(e)) return;
    // Allocate all bodies only when every authored position is valid; retries create none.
    const positions = cfg.attachments.map(a => ({ a, p: memberPose(e, a), def: getDef(a.unit) }));
    const world = clearSelfGrid(e), ignore = new Set([e.id]);
    if (positions.some(({p, def}) => !sweep(e, p, p, ignore, world, def))) return;
    for (const { a, p } of positions) {
      const member = newEnt(st, a.unit, e.owner, p.x, p.y); member.angle = p.angle; member.prevX = p.x; member.prevY = p.y;
      s.members[a.id] = member.id; children.set(member.id, { parent: e.id, slot: a.id });
    }
    s.initialized = true; s.parentAngle = e.angle; if (positions.length) host.game.recomputePop();
  }
  function deploymentPosition(e: Ent, d: DeploymentSpec, inside = false): Pose | null {
    if(inside && e.inside && config(e)?.transportTogether && config(e)?.enteredTransport===d.id)return {x:e.x,y:e.y,angle:e.angle};
    const to = getDef(d.to), from = getDef(e.defId), world = clearSelfGrid(e);
    if (!techMet(st, e.owner, d.to) || st.players[e.owner].metal < d.metal || e.emp || e.site || e.inside || children.has(e.id) || trailers.has(e.id) || state(e).tow) return null;
    if ((e.cargo?.length ?? 0) && (d.cargo === 'empty' || cargoLoad(st, e) > (to.transportCap ?? 0))) return null;
    let destination: Pose;
    if (to.kind === 'building') {
      const w = to.fw ?? 1, h = to.fh ?? 1, tx = Math.round(e.x / TILE - w / 2), ty = Math.round(e.y / TILE - h / 2);
      const members = Object.values(state(e).members).map(id => st.ents.get(id)).filter((x): x is Ent => !!x);
      if (canPlace(world, e.owner, to.id, tx, ty, { free: true, builders: [e, ...members] })) return null;
      destination = { x: (tx + w / 2) * TILE, y: (ty + h / 2) * TILE, angle: 0 };
    } else {
    const p = { x: e.x, y: e.y, angle: e.angle };
    if (!sweep(e, p, p, new Set([e.id, ...Object.values(state(e).members)]), world, to)) return null;
    if (from.kind !== 'building' && from.domain !== to.domain) return null;
    destination = p;
    }
    const next = { ...e, ...destination, defId: to.id }, cfg = config(next), ignore = new Set([e.id, ...Object.values(state(e).members)]);
    for (const slot of cfg?.attachments ?? []) {
      const member = st.ents.get(state(e).members[slot.id]);
      if (live(member) && !sweep(member, member, memberPose(next, slot), ignore, world)) return null;
    }
    return destination;
  }
  function commit(e: Ent, d: DeploymentSpec, inside = false): boolean {
    const at = deploymentPosition(e, d, inside); if (!at) return false;
    const from = getDef(e.defId), to = getDef(d.to), hp = d.health === 'fraction' ? e.hp / maxHp(e, from) : e.hp;
    const cooldown = new Map(from.weapons.map((w, i) => [w.id, e.wcd[i] ?? 0]));
    const ammo = new Map(from.weapons.map((w, i) => [w.id, e.ammo?.[i] ?? w.ammo]));
    // Everything above is validation. The following transaction has no fallible work.
    if (from.kind === 'building') markBlocked(st, e, 0);
    st.players[e.owner].metal -= d.metal;
    setEntityDef(e, to.id); place(e, at); e.prevX = e.x; e.prevY = e.y;
    if (e.xp) e.xp *= to.hp / Math.max(1, from.hp);
    e.hp = Math.max(1, Math.min(maxHp(e, to), d.health === 'fraction' ? hp * maxHp(e, to) : hp));
    e.wcd = to.weapons.map(w => cooldown.get(w.id) ?? 0);
    e.ammo = to.weapons.some(w => w.ammo !== undefined) ? to.weapons.map(w => Math.min(w.ammo ?? Infinity, ammo.get(w.id) ?? 0)) : undefined;
    e.burstLeft = 0; e.burstCd = 0; e.path = null;
    if (d.orders !== 'retain') { e.orders = []; e.route = undefined; e.targetId = 0; e.airTargetId = undefined; }
    e.alt = undefined; e.surf = undefined; e.floating = undefined; e.ab = undefined;
    if (to.kind === 'building') markBlocked(st, e, 1);
    for (const m of Object.values(state(e).mounts)) delete m.burst;
    host.game.recomputePop(); host.game.recomputePower(); return true;
  }
  function sourceCanCarry(passenger:Ent,carrier:Ent):boolean{
    const policy=config(carrier)?.sourceTransport,d=getDef(passenger.defId),weight=config(passenger)?.sourceTransport?.weight??cargoWeight(d);
    // Native cargo weight is capped at 50. A heavier source passenger (the FPV
    // teams' 100000-slot untransportable sentinel) must not slip into a native
    // hold on its clamped weight.
    if(!policy?.capacity)return weight<=cargoWeight(d);
    if(policy.blockTransports&&(d.transportCap??0)>0)return false;
    if(policy.tags.length&&!policy.tags.some(tag=>sourceEntityTags(host.game,passenger).includes(tag)))return false;
    const occupied=(carrier.cargo??[]).reduce((total,id)=>{const e=st.ents.get(id);return total+(e&&!e.dead?(config(e)?.sourceTransport?.weight??cargoWeight(getDef(e.defId))):0);},0);
    return occupied+weight<=policy.capacity;
  }
  function recoveryTarget(e: Ent, spec: TowSpec): Ent | undefined {
    let target: Ent | undefined, distance = spec.sourceAttachment!.searchRange;
    for (const child of st.ents.values()) {
      if (!live(child) || child.owner !== e.owner || child.id === e.id || children.has(child.id) || trailers.has(child.id)
        || !spec.accepts.includes(child.defId) || !componentImmobilized(host.game, child)) continue;
      const d = Math.hypot(e.x-child.x, e.y-child.y);
      if (d <= distance) { target = child; distance = d; }
    }
    return target;
  }
  function detach(parent: Ent, s: Assembly): void { if (s.tow) trailers.delete(s.tow); delete s.tow; }
  function attachedPose(e: Ent, s: Assembly, cfg: ArticulationDef, validate: boolean): void {
    const ignore = new Set([e.id, ...Object.values(s.members)]), world = clearSelfGrid(e), old = prior.get(e.id);
    if (validate && old && cfg.attachments.some(a => {
      const child = st.ents.get(s.members[a.id]); if (!live(child)) return false;
      return !sweep(child, prior.get(child.id) ?? child, memberPose(e, a), ignore, world);
    })) place(e, old);
    const turn = normAngle(e.angle - (s.parentAngle ?? e.angle));
    for (const slot of cfg.attachments) {
      const child = st.ents.get(s.members[slot.id]);
      if (live(child)) { const p = memberPose(e, slot); if (slot.rotation === 'independent') p.angle = child.angle + turn; place(child, p); }
    }
    s.parentAngle = e.angle;
  }
  const module: EngineModuleInstance = {
    id: 'articulation-v1',
    wrapUnitStep(next) { return (e,def,dt) => {
      const cfg=config(e),s=states.get(e.id);
      // Source hiddenAction_clearway: a player's new non-attack waypoint is
      // cleared while the form is deployed (the unit cannot move anyway).
      if(cfg?.clearMoveOrders&&(e.orders[0]?.kind==='move'||e.orders[0]?.kind==='attackMove')){e.orders.shift();e.path=null;}
      const first=e.orders[0];
      const carrier=first?.kind==='board'?st.ents.get(first.targetId):undefined;
      if(cfg?.transportTogether&&s?.initialized&&carrier&&!carrier.dead){
        const carrierDef=getDef(carrier.defId),reach=carrierDef.radius+cargoDist(carrierDef,34);
        // The native arrival boundary tests the leader. Keep using native
        // locomotion until every attached body fits the atomic loading gate.
        if(Math.hypot(e.x-carrier.x,e.y-carrier.y)<=reach&&Object.values(s.members).some(id=>{
          const child=st.ents.get(id);return live(child)&&Math.hypot(child.x-carrier.x,child.y-carrier.y)>reach;
        })){
          const orders=e.orders;e.orders=[{kind:'move',x:carrier.x,y:carrier.y}];
          next(e,def,dt);if(!e.dead&&!e.inside)e.orders=orders;return;
        }
      }
      next(e,def,dt);
    }; },
    wrapShot(next) { return (world, e, def, weapon, target, aim = null, shot = 0, force) => {
      // Translate the authored hardpoint into the native emitter's bearing before
      // it creates the projectile, flash and sound. Native bore cycling remains
      // the sole owner of alternation; never move an already emitted projectile.
      const geometry = host.config<ArticulationWeapon>(weapon);
      if (!geometry || !weapon.muzzlePoints?.length || weapon.vertical) {
        next(world, e, def, weapon, target, aim, shot, force); return;
      }
      const at = target ?? aim, independent = ownsAirMount(def, weapon) || ownsSubMount(def, weapon);
      const bore = ownsAirMount(def, weapon) && def.airMount?.on === 'hull'
        ? e.angle + (e.mountAngle ?? 0)
        : independent || weapon.turret && !def.turretSprite
          ? at ? Math.atan2(at.y - e.y, at.x - e.x) : e.angle
          : weapon.turret && def.turretSprite ? e.turretAngle : e.angle;
      const delta = e.angle - bore, cos = Math.cos(delta), sin = Math.sin(delta);
      const anchor = geometry.muzzleAnchor ?? { forward: 0, lateral: 0 };
      const af = anchor.forward * cos - anchor.lateral * sin, al = anchor.forward * sin + anchor.lateral * cos;
      const muzzlePoints = weapon.muzzlePoints.map(p => geometry.muzzleFrame === 'hull'
        ? { forward: p.forward * cos - p.lateral * sin + af, lateral: p.forward * sin + p.lateral * cos + al }
        : { forward: p.forward + af, lateral: p.lateral + al });
      next(world, e, def, { ...weapon, muzzlePoints }, target, aim, shot, force);
    }; },
    wrapUnloadStep(next){return(e,def,order,dt)=>{const seconds=config(e)?.sourceTransport?.unload;return next(e,def,order,seconds?dt*.6/seconds:dt);};},
    wrapBoardPassenger(next) { return (passenger,carrier,rearming) => {
      if(!sourceCanCarry(passenger,carrier))return;
      const recovery = config(carrier)?.tow;
      if (recovery?.sourceAttachment) {
        const s = state(carrier);
        if (s.tow || passenger.owner !== carrier.owner || !recovery.accepts.includes(passenger.defId)
          || !componentImmobilized(host.game, passenger) || children.has(passenger.id) || trailers.has(passenger.id)) return;
        s.tow = passenger.id; trailers.set(passenger.id, carrier.id);
        passenger.orders = []; passenger.path = null; passenger.targetId = 0;
        return;
      }
      const cfg=config(passenger);
      if(!cfg?.transportTogether){next(passenger,carrier,rearming);return;}
      const s=state(passenger);initialize(passenger,s,cfg);
      if(!s.initialized)return;
      const members=Object.values(s.members).filter(id=>live(st.ents.get(id)));
      if(!cmdEmbarkGroup(host.game,passenger.owner,carrier.id,[passenger.id,...members]))return;
      if(cfg.enteredTransport)s.job={id:cfg.enteredTransport,from:passenger.defId,elapsed:0};
    }; },
    wrapReleasePassenger(next) { return (carrier,passenger,spot,resume) => {
      const membership=children.get(passenger.id),parent=membership&&st.ents.get(membership.parent);
      const leader=parent??passenger,cfg=config(leader),s=states.get(leader.id);
      if(!cfg?.transportTogether||!s){next(carrier,passenger,spot,resume);return;}
      const angle=Math.atan2(spot.y-carrier.y,spot.x-carrier.x), projected={...leader,x:spot.x,y:spot.y,angle};
      const placements=[{id:leader.id,x:spot.x,y:spot.y}];
      for(const slot of cfg.attachments){const child=st.ents.get(s.members[slot.id]);if(child&&!child.dead){const p=memberPose(projected,slot);placements.push({id:child.id,x:p.x,y:p.y});}}
      if(cmdDisembarkGroup(host.game,carrier.owner,carrier.id,placements)){leader.angle=angle;s.parentAngle=angle;attachedPose(leader,s,cfg,false);}
    }; },
    beforeStep(dt) {
      prior.clear(); committed.clear();
      for (const e of host.participants()) {
        const cfg = config(e); if (!cfg || e.dead) continue; const s = state(e);
        if(e.inside){if(s.job&&cfg.enteredTransport===s.job.id){const action=cfg.deployments.find(d=>d.id===s.job!.id);if(action){s.job.elapsed+=dt;if(s.job.elapsed+1e-6>=action.time){commit(e,action,true);delete s.job;}}}continue;}
        initialize(e, s, cfg);
        if(cfg.sourceEnergy)s.energy=Math.min(cfg.sourceEnergy.max,(s.energy??cfg.sourceEnergy.max)+cfg.sourceEnergy.regen*dt);
        if(s.barrage)s.barrage.elapsed+=dt;
        if (!s.job && !e.site && !e.emp) {
          const first = e.orders[0];
          const steering = !!e.helm && !!(e.helm.dx || e.helm.dy);
          const moving = Math.hypot(e.x - e.prevX, e.y - e.prevY) > .01;
          const action = cfg.deployments.find(d => d.automatic === 'idle' ? !first && !e.route && !steering && !moving : d.automatic === 'move' && (steering || !!first && first.kind !== 'attack'));
          if (action && deploymentPosition(e, action)) s.job = { id: action.id, from: e.defId, elapsed: 0 };
        }
        prior.set(e.id, { x: e.x, y: e.y, angle: e.angle });
        for (const slot of cfg.attachments) {
          const child = st.ents.get(s.members[slot.id]); if (!live(child)) continue;
          prior.set(child.id, { x: child.x, y: child.y, angle: child.angle });
          if (slot.rotation === 'independent' && !live(st.ents.get(child.targetId))) child.angle = turnToward(child.angle, e.angle + slot.rest, getDef(child.defId).turnRate * dt);
          if (slot.fire === 'parent') child.targetId = e.targetId;
          child.orders = []; child.path = null;
        }
        if (s.tow) { const child = st.ents.get(s.tow); if (!live(child) || (cfg.tow?.detachOnMove && child.orders.some(o => o.kind === 'move' || o.kind === 'attackMove'))) detach(e, s);
          else { prior.set(child.id, { x: child.x, y: child.y, angle: child.angle }); child.path = null; } }
      }
    },
    effectiveDef(e, def) {
      const owner = children.get(e.id), parent = owner && st.ents.get(owner.parent), slot = parent && config(parent)?.attachments.find(a => a.id === owner!.slot);
      if (slot) return { ...def, speed: 0, weapons: slot.fire === 'none' ? [] : def.weapons };
      if (trailers.has(e.id)) return { ...def, speed: 0, weapons: [] };
      const cfg = config(e), s = states.get(e.id);
      const job = s?.job && cfg?.deployments.find(d => d.id === s.job!.id);
      // Keep target domains during a transaction so the native order handler
      // retains attacks and advances reloads. canFire owns the firing veto.
      if (s?.barrage) return {...def,speed:0};
      if (job) return { ...def, speed: job.lockMovement===false?def.speed:0, fireOnMove: job.lockWeapons === false || def.fireOnMove };
      const weapons = cfg?.disabledWeapons?.length ? def.weapons.map(w => cfg.disabledWeapons.includes(w.id) ? { ...w, targets: [] } : w) : def.weapons;
      if (s?.tow && cfg?.tow) return { ...def, speed: def.speed * cfg.tow.speed, weapons };
      if (cfg?.squad) return { ...def, weapons: [] };
      return weapons === def.weapons ? def : { ...def, weapons };
    },
    canFire(e, _def, weapon, _point, target) {
      if (trailers.has(e.id)) return false;
      const cfg = config(e), s = states.get(e.id);
      if (cfg?.disabledWeapons?.includes(weapon.id) || s?.job && cfg?.deployments.find(d => d.id === s.job!.id)?.lockWeapons !== false) return false;
      const membership = children.get(e.id); if (!membership) return true;
      const parent = st.ents.get(membership.parent), slot = parent && config(parent)?.attachments.find(a => a.id === membership.slot);
      return live(parent) && !!slot && slot.fire !== 'none' && (slot.fire !== 'parent' || !!target && parent.targetId === target.id);
    },
    wrapDamage(next) { return (...args) => { if (config(args[1])?.squad && states.get(args[1].id)?.initialized) return; next(...args); }; },
    filterVisibility(e, team, visible) { return config(e)?.squad && states.get(e.id)?.initialized && st.players[e.owner]?.team !== team ? false : visible; },
    wrapWeapons(next) { return (world, e, def, target, dt, power, aim = null, air = null, hash) => {
      const cfg = config(e); if (!cfg?.mounts.length) { next(world, e, def, target, dt, power, aim, air, hash); return; }
      const s = state(e);
      for (let i = 0; i < def.weapons.length; i++) e.wcd[i] = (e.wcd[i] ?? 0) - dt * (def.kind === 'building' ? power : 1);
      for (let mountIndex = 0; mountIndex < cfg.mounts.length; mountIndex++) {
        const mount = cfg.mounts[mountIndex];
        const bearing = s.mounts[mount.id], at = pose(e, mount, def), parent = mount.parent && s.mounts[mount.parent];
        const base = parent ? parent.angle : def.kind === 'building' ? -Math.PI / 2 : e.angle;
        bearing.previousAngle = bearing.angle;
        // A ring is mounted on what it stands on: whatever the hull (or its
        // parent ring) turned since, it turned with it, and only then does it
        // traverse on its own, as a native turret rides the hull.
        if (bearing.base !== undefined) bearing.angle = normAngle(bearing.angle + normAngle(base - bearing.base));
        bearing.base = base;
        const guns = def.weapons.filter(w => mount.weapons.includes(w.id));
        const valid = (candidate: Ent, w: WeaponDef): boolean => live(candidate) && host.trackTarget(e, def, candidate, false, w)
          && Math.abs(normAngle(Math.atan2(candidate.y - at.y, candidate.x - at.x) - base - mount.rest)) <= mount.arc
          && weaponReaches(w, targetCat(st, candidate), getDef(candidate.defId))
          && Math.hypot(candidate.x - at.x, candidate.y - at.y) <= w.range * TILE
          && Math.hypot(candidate.x - at.x, candidate.y - at.y) >= (w.minRange ?? 0) * TILE;
        let chosen = target && guns.some(w => valid(target, w)) ? target : null;
        if (mount.targeting === 'independent' && hash) {
          chosen = null;
          for (const w of guns) { const id = host.acquireTarget(world, hash, { ...e, x: at.x, y: at.y }, def, 1, false, c => valid(c, w), undefined, undefined, w); if (id) { chosen = world.ents.get(id) ?? null; break; } }
          // A unit that never acquires (a battery launcher) still engages the
          // target it was given, as the source turret does with its waypoint.
          if (!chosen && target && guns.some(w => valid(target, w))) chosen = target;
        }
        if (bearing.burst) {
          const remembered = st.ents.get(bearing.burst.target);
          if (remembered && guns.some(w => w.id === bearing.burst!.weapon && valid(remembered, w))) chosen = remembered;
          else if (bearing.burst.target) { delete bearing.burst; chosen = null; }
        }
        const mission=s.barrage&&cfg.barrages?.find(b=>b.id===s.barrage!.id&&b.mount===mount.id);
        if(mission)chosen=null;
        const point = mission?s.barrage!:bearing.burst ? chosen ?? { x: bearing.burst.x, y: bearing.burst.y } : chosen ?? aim;
        if (point) {
          const want = Math.atan2(point.y - at.y, point.x - at.x), off = Math.max(-mount.arc, Math.min(mount.arc, normAngle(want - base - mount.rest)));
          const wanted=base+mount.rest+off,error=normAngle(wanted-bearing.angle);
          if(mount.acceleration>0){
            const deceleration=mount.deceleration||mount.acceleration;
            const velocity=Math.sign(error)*Math.min(mount.turnRate,Math.sqrt(2*deceleration*Math.abs(error)));
            const delta=velocity-(bearing.velocity??0),rate=Math.abs(velocity)<Math.abs(bearing.velocity??0)?deceleration:mount.acceleration;
            bearing.velocity=(bearing.velocity??0)+Math.max(-rate*dt,Math.min(rate*dt,delta));
            const step=bearing.velocity*dt;
            bearing.angle=normAngle(bearing.angle+(Math.sign(step)===Math.sign(error)&&Math.abs(step)>Math.abs(error)?error:step));
          }else bearing.angle=turnToward(bearing.angle,wanted,mount.turnRate*dt);
        }else if(mount.idleSpin){
          bearing.angle=normAngle(bearing.angle+mount.idleSpin*dt);
        }else{bearing.velocity=0;
        }
        bearing.target = chosen?.id ?? 0;
        if ((!mission&&e.holdFire) || !point || power <= 0) continue;
        const off = normAngle(Math.atan2(point.y - at.y, point.x - at.x) - base - mount.rest);
        const aligned=(w:WeaponDef)=>Math.abs(normAngle(Math.atan2(point.y-at.y,point.x-at.x)-bearing.angle))<=(mount.weaponTolerances?.[w.id]??mount.tolerance);
        if(Math.abs(off)>mount.arc)continue;
        const scale = unitDisplayScale(def), hull = def.kind === 'building' ? 0 : e.angle + Math.PI / 2, dx = (at.x - e.x) / scale, dy = (at.y - e.y) / scale;
        const shotDef: UnitDef = { ...def, turretSprite: mount.sprite ?? def.turretSprite ?? def.sprite, airMount: undefined,
          turretMounts: [{ x: dx * Math.cos(hull) + dy * Math.sin(hull), y: -dx * Math.sin(hull) + dy * Math.cos(hull) }] };
        const emit = (w: WeaponDef, victim: Ent | null, point: GroundAim, shot: number, forced=false): void => {
          const old = e.turretAngle, bore = e.boreI, left = e.burstLeft, wi = e.burstWi;
          e.turretAngle = bearing.angle; e.boreI = bearing.bore;
          if (shot > 0) { e.burstLeft = bearing.burst?.left ?? 0; e.burstWi = def.weapons.findIndex(a => a.id === w.id); }
          try {
            const effectsStart = world.effects.length;
            host.fireShot(world, e, { ...shotDef, weapons: [w] }, { ...w, turret: true }, victim, victim ? null : point, shot, forced);
            // The native shot sees this mount alone to place its muzzle. Keep
            // the real mount index on its visual recoil for independent guns.
            for (let i = effectsStart; i < world.effects.length; i++) {
              const recoil = world.effects[i].recoil;
              if (recoil?.src === e.id) recoil.mount = mountIndex;
            }
            bearing.bore = e.boreI ?? 0;
          }
          finally { e.turretAngle = old; e.boreI = bore; e.burstLeft = left; e.burstWi = wi; }
        };
        const canFire = (w: WeaponDef, point: GroundAim, victim: Ent | null, continuation = false): boolean => {
          if(!aligned(w))return false;
          const oldAngle = e.turretAngle, oldLeft = e.burstLeft, oldWi = e.burstWi;
          e.turretAngle = bearing.angle;
          if (continuation) { e.burstLeft = bearing.burst?.left ?? 0; e.burstWi = def.weapons.findIndex(a => a.id === w.id); }
          try { return host.canFire(e, shotDef, w, point, victim); }
          finally { e.turretAngle = oldAngle; e.burstLeft = oldLeft; e.burstWi = oldWi; }
        };
        if(mission&&s.barrage){
          const job=s.barrage,w=guns.find(w=>w.id===mission.weapon);
          if(w&&aligned(w)&&job.elapsed+1e-9>=(job.first?mission.first:mission.interval)){
            if(mission.stock&&!logisticsTakeStock(host.game,e,mission.stock,1)){delete s.barrage;continue;}
            if(mission.energyCost)s.energy=Math.max(0,(s.energy??0)-mission.energyCost);
            emit(w,null,point,0,true);
            e.wcd[def.weapons.findIndex(gun=>gun.id===w.id)]=w.reload;
            if(job.first)(s.cooldowns??={})[mission.id]=st.time+mission.cooldown;
            job.left--;job.first=false;job.elapsed=0;if(job.left<=0)delete s.barrage;
          }
          continue;
        }
        if (bearing.burst) {
          const b = bearing.burst, w = guns.find(w => w.id === b.weapon); b.cd -= dt;
          const victim = world.ents.get(b.target) ?? null;
          if (!w || (victim && !valid(victim, w))) { delete bearing.burst; continue; }
          if (b.cd <= 0 && canFire(w, point, victim, true)) { emit(w, victim, point, b.shot++); b.left--; b.cd = w.burstDelay ?? .1; if (!b.left) delete bearing.burst; }
          continue;
        }
        for (const w of guns) {
          const wi = def.weapons.findIndex(a => a.id === w.id);
          if (e.wcd[wi] > 0 || !hasRound(e, def, wi) || (chosen ? !valid(chosen, w) : !weaponCanBombard(w, groundAimCat(world, point)))) continue;
          if (!canFire(w, point, chosen)) continue;
          e.wcd[wi] = w.reload * abilityReloadMul(e, def) * (e.rs ? ruleMul(e, 'reload') : 1);
          host.spendRound(e, def, wi); emit(w, chosen, point, 0);
          if ((w.burst ?? 1) > 1) { bearing.burst = { weapon: w.id, left: w.burst! - 1, cd: w.burstDelay ?? .1, shot: 1, target: chosen?.id ?? 0, x: point.x, y: point.y }; break; }
        }
      }
    }; },
    afterEntities(dt) {
      for (const e of host.participants()) {
        const cfg = config(e), s = states.get(e.id); if (!cfg || !s || !live(e)) continue;
        attachedPose(e, s, cfg, true);
        if (s.tow && cfg.tow) {
          const child = st.ents.get(s.tow), from = prior.get(e.id), childFrom = prior.get(s.tow);
          if (live(child) && from && childFrom) {
            const dx = e.x - child.x, dy = e.y - child.y, length = Math.hypot(dx, dy), travel = Math.hypot(e.x - from.x, e.y - from.y);
            const amount = Math.min(travel, Math.max(0, length - cfg.tow.length)), a = cfg.tow.sourceAttachment;
            const p = a ? { x: e.x + a.x * Math.cos(e.angle + Math.PI/2) - a.y * Math.sin(e.angle + Math.PI/2),
              y: e.y + a.x * Math.sin(e.angle + Math.PI/2) + a.y * Math.cos(e.angle + Math.PI/2),
              angle: turnToward(child.angle, e.angle + a.rest, getDef(child.defId).turnRate * dt) }
              : { x: child.x + (length ? dx / length * amount : 0), y: child.y + (length ? dy / length * amount : 0), angle: length ? Math.atan2(dy, dx) : child.angle };
            const ignore = new Set([e.id, child.id]);
            if (!sweep(e, from, e, ignore) || !sweep(child, childFrom, p, ignore)) { place(e, from); place(child, childFrom); }
            else place(child, p);
          }
        }
        if (s.job) {
          const action = cfg.deployments.find(a => a.id === s.job!.id);
          if (!action || s.job.from !== e.defId || e.emp) { delete s.job; continue; }
          s.job.elapsed += dt;
          if (s.job.elapsed + 1e-6 >= action.time) { commit(e, action); delete s.job; attachedPose(e, s, config(e) ?? cfg, false); }
        }
        if (Object.keys(s.members).length || s.tow) for (const id of [e.id, ...Object.values(s.members), ...(s.tow ? [s.tow] : [])]) {
          const body = st.ents.get(id); if (live(body)) committed.set(id, {x:body.x,y:body.y,angle:body.angle});
        }
      }
    },
    afterStep() {
      // Rigid assemblies resist the legacy independent-body separation pass.
      // Their swept movement was already validated before impacts; external
      // bodies still separate from each real member in the ordinary pass.
      for (const [id, p] of committed) { const e = st.ents.get(id); if (live(e)) place(e, p); }
      for (const [id, s] of states) {
        const e = st.ents.get(id), cfg = e ? config(e) : host.config<ArticulationDef>(getDef(s.definition));
        if (!e || e.dead) {
          for (const [slotId, childId] of Object.entries(s.members)) {
            const child = st.ents.get(childId), slot = cfg?.attachments.find(a => a.id === slotId);
            // Transport hides a member from movement and targeting, not from
            // its source attachment's keep-alive dependency on the parent.
            if (child && !child.dead && slot?.onParentDeath === 'kill') kill(st, child);
            children.delete(childId);
          }
          if (e) detach(e, s); else if (s.tow) trailers.delete(s.tow);
          states.delete(id); continue;
        }
        // Being aboard is not death. Preserve state even if an old save or a
        // script bypassed the command policy; never regenerate its members.
        if (e.inside) continue;
        if (!cfg) continue;
        attachedPose(e, s, cfg, false);
        if (cfg.squad && s.initialized && Object.values(s.members).every(id => { const member = st.ents.get(id); return !member || member.dead; })) kill(st, e);
      }
    },
    allowOrder(e, order) {
      const tractorId = trailers.get(e.id), tractor = tractorId && st.ents.get(tractorId);
      if (tractor && config(tractor)?.tow?.detachOnMove && (order.kind === 'move' || order.kind === 'attackMove')) detach(tractor, state(tractor));
      const recoveryCarrier = order.kind === 'pickup' ? e : order.kind === 'board' ? st.ents.get(order.targetId) : undefined;
      const recoveryPassenger = order.kind === 'pickup' ? st.ents.get(order.targetId) : e;
      if(recoveryCarrier&&recoveryPassenger&&!sourceCanCarry(recoveryPassenger,recoveryCarrier))return false;
      const tow = recoveryCarrier && config(recoveryCarrier)?.tow;
      if (tow?.sourceAttachment && (!recoveryPassenger || states.get(recoveryCarrier!.id)?.tow || recoveryPassenger.owner !== recoveryCarrier!.owner
        || !tow.accepts.includes(recoveryPassenger.defId) || !componentImmobilized(host.game, recoveryPassenger))) return false;
      const passenger = order.kind === 'board' ? e : order.kind === 'pickup' ? st.ents.get(order.targetId) : undefined;
      return !passenger || !(config(passenger)?.attachments.length && !config(passenger)?.transportTogether || children.has(passenger.id) || states.get(passenger.id)?.tow || trailers.has(passenger.id));
    },
    actions(e) {
      const cfg = config(e); if (!cfg || !live(e)) return []; const s = state(e), out: ModuleAction[] = [];
      if(s.barrage)return[{id:'cancel',label:t('extension.cancelBarrage'),enabled:true}];
      if (s.job) { if (cfg.deployments.find(a => a.id === s.job!.id)?.cancelable) out.push({ id: 'cancel', label: t('extension.cancel'), enabled: true }); return out; }
      for (const d of cfg.deployments) out.push({ id: `deploy:${d.id}`, label: d.label, enabled: !!deploymentPosition(e, d) });
      for(const b of cfg.barrages??[])if(!b.disabled)out.push({id:b.id,label:b.label,target:'ground',enabled:!s.job&&!s.barrage&&st.time>=(s.cooldowns?.[b.id]??0)&&(!b.componentGate||!e.holdFire&&componentArtilleryReady(host.game,e))&&(!b.stock||(logisticsStock(host.game,e,b.stock)?.amount??0)>=(b.minimumStock??1))});
      if (cfg.tow) out.push(s.tow ? { id: 'detach', label: t('extension.detach'), enabled: true } : { id: 'tow', label: t('extension.tow'), enabled: !cfg.tow.sourceAttachment || !!recoveryTarget(e, cfg.tow), ...(cfg.tow.sourceAttachment ? {} : {target: 'own' as const}) });
      return out;
    },
    order(order) {
      let accepted = false;
      for (const id of order.ids) {
        const e = st.ents.get(id); if (!live(e) || e.owner !== order.owner || e.emp) continue; const cfg = config(e); if (!cfg) continue; const s = state(e);
        if(order.action==='cancel'&&s.barrage){delete s.barrage;accepted=true;continue;}
        if (order.action === 'cancel' && s.job && cfg.deployments.find(d => d.id === s.job!.id)?.cancelable) { delete s.job; accepted = true; continue; }
        if (s.job||s.barrage) continue;
        const barrage=cfg.barrages?.find(b=>b.id===order.action);
        if(barrage){
          if(barrage.disabled)continue;
          const w=getDef(e.defId).weapons.find(w=>w.id===barrage.weapon),x=order.x,y=order.y;
          if(!w||typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=st.map.w*TILE||y>=st.map.h*TILE||st.time<(s.cooldowns?.[barrage.id]??0))continue;
          if(barrage.componentGate&&(e.holdFire||!componentArtilleryReady(host.game,e)))continue;
          if(barrage.stock&&(logisticsStock(host.game,e,barrage.stock)?.amount??0)<(barrage.minimumStock??1))continue;
          const distance=Math.hypot(x-e.x,y-e.y);if(distance<(w.minRange??0)*TILE||distance>w.range*TILE)continue;
          s.barrage={id:barrage.id,x,y,left:barrage.shots,first:true,elapsed:0};accepted=true;continue;
        }
        const action = cfg.deployments.find(d => order.action === `deploy:${d.id}`);
        if (action && deploymentPosition(e, action)) { s.job = { id: action.id, from: e.defId, elapsed: 0 }; accepted = true; continue; }
        if (order.action === 'detach' && s.tow) { detach(e, s); accepted = true; continue; }
        if (order.action === 'tow' && cfg.tow && !s.tow && !children.has(id) && !trailers.has(id)) {
          if (cfg.tow.sourceAttachment) { const target = recoveryTarget(e, cfg.tow); if (target) { cmdPickup(host.game, [e.id], target.id); accepted ||= e.orders.some(o => o.kind === 'pickup' && o.targetId === target.id); } continue; }
          const child = st.ents.get(order.targetId ?? 0);
          if (!live(child) || child.owner !== order.owner || child.id === id || children.has(child.id) || trailers.has(child.id) || states.get(child.id)?.tow || !cfg.tow.accepts.includes(child.defId) || cargoWeight(getDef(child.defId)) > cfg.tow.maxWeight || Math.hypot(e.x - child.x, e.y - child.y) > cfg.tow.range * TILE) continue;
          const distance = Math.hypot(e.x - child.x, e.y - child.y);
          if (distance < getDef(e.defId).radius + getDef(child.defId).radius || !sweep(child, child, e, new Set([e.id, child.id]))) continue;
          s.tow = child.id; trailers.set(child.id, id); child.orders = []; child.path = null; accepted = true;
        }
      }
      return accepted;
    },
    inspect(e,privateView){const s=states.get(e.id),b=s?.barrage,energy=config(e)?.sourceEnergy;if(!privateView)return[];return [...(b?[{id:'barrage-rounds',label:['Rounds queued','待发炮弹','대기 포탄'],value:b.left}]:[]),...(energy?[{id:'artillery-reload',label:['Artillery reload','火炮装填','포 장전'],value:s?.energy??energy.max,fraction:(s?.energy??energy.max)/energy.max}]:[])];},
    render(e, privateView = false): ArticulationVisual | undefined {
      const membership = children.get(e.id), parent = membership && st.ents.get(membership.parent), slot = parent && config(parent)?.attachments.find(a => a.id === membership!.slot);
      if (slot) return { mounts: [], attachments: [], squad: false, parentId: parent!.id, selectParent: slot.select === 'parent' };
      const cfg = config(e); if (!cfg) return; const s = state(e);
      return { mounts: cfg.mounts.map(m => ({ id: m.id, sprite: m.sprite, recoil: getDef(e.defId).weapons.find(w => m.weapons.includes(w.id) && w.recoil)?.recoil, ...pose(e, m), previousAngle: s.mounts[m.id].previousAngle })), attachments: Object.entries(s.members).filter(([,id]) => live(st.ents.get(id))).map(([slot, childId]) => ({slot,childId})), squad: cfg.squad && s.initialized,
        ...(s.tow ? { towing: s.tow } : {}), ...(s.job && privateView ? { deployment: { id: s.job.id, progress: Math.min(1, s.job.elapsed / Math.max(.001, cfg.deployments.find(a => a.id === s.job!.id)?.time ?? 1)) } } : {}) };
    },
    snapshot(view) {
      return [...states].filter(([id]) => !view || view.visibleEntities.has(id)).map(([id,s]) => [id, { ...s,
        members: Object.fromEntries(Object.entries(s.members).filter(([, child]) => !view || view.visibleEntities.has(child))),
        mounts: Object.fromEntries(Object.entries(s.mounts).map(([key,m]) => [key, !view ? m : { angle: m.angle, previousAngle: m.previousAngle, ...(m.base !== undefined ? { base: m.base } : {}), target: 0 }])),
        ...(view ? { energy:view.privateEntity(id)?s.energy:undefined,barrage:view.privateEntity(id)?s.barrage:undefined,cooldowns:view.privateEntity(id)?s.cooldowns:undefined,job: view.privateEntity(id) ? s.job : undefined, tow: s.tow && view.visibleEntities.has(s.tow) ? s.tow : undefined } : {}) }]) as unknown as Json;
    },
    restore(value) {
      if (!Array.isArray(value) || value.length > st.ents.size) throw new Error('Invalid articulation state');
      const next = new Map<number, Assembly>(), memberParents = new Map<number, {parent:number;slot:string}>(), towParents = new Map<number, number>();
      const finite = (v: unknown, min = 0, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
      const integer = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v);
      for (const entry of value) {
        if (!Array.isArray(entry) || entry.length !== 2 || !integer(entry[0]) || !record(entry[1]) || next.has(entry[0])) throw new Error('Invalid articulation entity');
        const e = st.ents.get(entry[0]), raw = entry[1], cfg = e && config(e);
        if (!e || !cfg || raw.definition !== e.defId || typeof raw.initialized !== 'boolean' || !record(raw.members) || !record(raw.mounts)) throw new Error('Invalid articulation membership');
        if (e.inside && (cfg.attachments.length && !cfg.transportTogether || raw.tow !== undefined)) throw new Error('Transported assemblies are unsupported');
        const s: Assembly = {definition:e.defId,initialized:raw.initialized,members:Object.create(null),mounts:Object.create(null)};
        if (raw.parentAngle !== undefined) {
          if (!finite(raw.parentAngle,-1e6,1e6)) throw new Error('Invalid attachment parent bearing');
          s.parentAngle = raw.parentAngle;
        }
        for (const [slot,id] of Object.entries(raw.members)) {
          const def = cfg.attachments.find(a => a.id === slot), child = integer(id) ? st.ents.get(id) : undefined;
          if (!def || !integer(id) || id === e.id || memberParents.has(id) || (child && (child.owner !== e.owner || child.defId !== def.unit || (child.inside??0)!==(e.inside??0)))) throw new Error('Invalid attachment reference');
          s.members[slot] = id; if (child) memberParents.set(id, {parent:e.id,slot});
        }
        if (Object.keys(raw.mounts).length !== cfg.mounts.length) throw new Error('Invalid mount membership');
        for (const def of cfg.mounts) {
          const a = raw.mounts[def.id];
          if (!record(a) || !finite(a.angle,-1e6,1e6) || !finite(a.previousAngle,-1e6,1e6) || !integer(a.target)) throw new Error('Invalid mount bearing');
          if (a.bore !== undefined && (!integer(a.bore) || a.bore > 1024)) throw new Error('Invalid mount barrel');
          if(a.velocity!==undefined&&!finite(a.velocity,-100,100))throw new Error('Invalid mount velocity');
          if(a.base!==undefined&&!finite(a.base,-1e6,1e6))throw new Error('Invalid mount carrier bearing');
          const m: Bearing = {...(typeof a.velocity==='number'?{velocity:a.velocity}:{}),bore:typeof a.bore === 'number' ? a.bore : 0,angle:a.angle,previousAngle:a.previousAngle,...(typeof a.base==='number'?{base:a.base}:{}),target:a.target};
          if (a.burst !== undefined) {
            const b = a.burst, w = record(b) && getDef(e.defId).weapons.find(w => w.id === b.weapon);
            if (!record(b) || !w || !def.weapons.includes(w.id) || !integer(b.left) || b.left > (w.burst ?? 1) - 1 || !finite(b.cd, -1, w.burstDelay ?? .1) || !integer(b.shot) || b.shot > (w.burst ?? 1) || !integer(b.target) || !finite(b.x,0,st.map.w*TILE) || !finite(b.y,0,st.map.h*TILE)) throw new Error('Invalid mount burst');
            m.burst={weapon:w.id,left:b.left,cd:b.cd,shot:b.shot,target:b.target,x:b.x,y:b.y};
          }
          s.mounts[def.id]=m;
        }
        if (raw.tow !== undefined) {
          const child = integer(raw.tow) ? st.ents.get(raw.tow) : undefined;
          if (!child || child.inside || !cfg.tow || child.owner !== e.owner || !cfg.tow.accepts.includes(child.defId) || child.id === e.id || towParents.has(child.id)) throw new Error('Invalid tow reference');
          s.tow=child.id; towParents.set(child.id,e.id);
        }
        if (raw.job !== undefined) {
          const job = raw.job, def = record(job) && cfg.deployments.find(d => d.id === job.id);
          if (!record(job) || !def || job.from !== e.defId || !finite(job.elapsed,0,def.time)) throw new Error('Invalid deployment transaction');
          s.job={id:def.id,from:e.defId,elapsed:job.elapsed};
        }
        if(raw.energy!==undefined){if(!cfg.sourceEnergy||!finite(raw.energy,0,cfg.sourceEnergy.max))throw Error('Invalid source artillery energy');s.energy=raw.energy;}
        if(raw.barrage!==undefined){
          const b=raw.barrage,c=record(b)&&cfg.barrages?.find(c=>c.id===b.id);
          if(!c||!record(b)||!finite(b.x,0,st.map.w*TILE)||!finite(b.y,0,st.map.h*TILE)||!finite(b.elapsed,0,3600)||!integer(b.left)||b.left<1||b.left>c.shots||typeof b.first!=='boolean'||raw.job)throw Error('Invalid source artillery queue');
          s.barrage={id:c.id,x:b.x,y:b.y,elapsed:b.elapsed,left:b.left,first:b.first};
        }
        if(raw.cooldowns!==undefined){if(!record(raw.cooldowns)||Object.entries(raw.cooldowns).some(([id,time])=>!cfg.barrages?.some(b=>b.id===id)||!finite(time,0,st.time+600)))throw Error('Invalid source artillery cooldown');s.cooldowns={...raw.cooldowns} as Record<string,number>;}
        next.set(e.id,s);
      }
      for (const [child,parent] of towParents) if (memberParents.has(child) || memberParents.has(parent) || towParents.has(parent)) throw new Error('Cyclic or nested tow relation');
      states.clear(); children.clear(); trailers.clear();
      for (const [id,s] of next) states.set(id,s);
      for (const [id,p] of memberParents) children.set(id,p);
      for (const [id,p] of towParents) trailers.set(id,p);
    },
  };
  return module;
}
