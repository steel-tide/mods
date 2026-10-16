import { TILE } from './host';
import type { UnitDef, WeaponDef } from '../../../../steel-tide/game/core/src/core/types';
import { normAngle, turnToward } from './host';
import { unitDisplayScale } from './host';
import { t } from './strings';
import { walkGridLine } from './host';
import { getDef } from './host';
import { kill, targetCat, weaponReaches, weaponCanBombard, groundAimCat } from './host';
import type { GroundAim } from '../../../../steel-tide/game/core/src/game/combat';
import { hasRound } from './host';
import { abilityReloadMul } from './host';
import { ruleMul } from './host';
import { canPlace, techMet } from './host';
import { setEntityDef } from './host';
import { cargoLoad, cargoWeight } from './host';
import { maxHp } from './host';
import { markBlocked, newEnt, footprintTiles } from './host';
import type { Ent, GameState } from '../../../../steel-tide/game/core/src/game/state';
import { passable, hullBeam } from './host';
import type { EngineModuleInstance, Json, ModuleHost, ModuleAction } from '../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ArticulationDef, AttachmentSpec, DeploymentSpec, MountSpec } from './articulationSpec';
import { record } from './sensorsSpec';

interface Bearing { bore: number; angle: number; previousAngle: number; target: number; burst?: { weapon: string; left: number; cd: number; shot: number; target: number; x: number; y: number } }
interface Assembly { definition: string; members: Record<string, number>; mounts: Record<string, Bearing>; initialized: boolean; parentAngle?: number; tow?: number; job?: { id: string; from: string; elapsed: number } }
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

export function createArticulationModule(host: ModuleHost): EngineModuleInstance {
  const st = host.game.st, states = new Map<number, Assembly>();
  const children = new Map<number, { parent: number; slot: string }>(), trailers = new Map<number, number>(), prior = new Map<number, Pose>(), committed = new Map<number, Pose>();
  const config = (e: Ent): ArticulationDef | undefined => host.config<ArticulationDef>(getDef(e.defId));
  const live = (e: Ent | undefined): e is Ent => !!e && !e.dead && !e.inside;
  function state(e: Ent): Assembly {
    let s = states.get(e.id); if (!s) { s = { definition: e.defId, members: Object.create(null), mounts: Object.create(null), initialized: false }; states.set(e.id, s); }
    s.definition = e.defId;
    for (const m of config(e)?.mounts ?? []) s.mounts[m.id] ??= { bore: 0, angle: e.angle + m.rest, previousAngle: e.angle + m.rest, target: 0 };
    return s;
  }
  function pose(e: Ent, mount: MountSpec, def = getDef(e.defId), seen = new Set<string>()): Pose {
    const cfg = config(e)!, s = state(e), parent = mount.parent && cfg.mounts.find(m => m.id === mount.parent);
    const base = parent && !seen.has(parent.id) ? (seen.add(mount.id), pose(e, parent, def, seen)) : { x: e.x, y: e.y, angle: def.kind === 'building' ? -Math.PI / 2 : e.angle };
    const a = base.angle + Math.PI / 2, scale = unitDisplayScale(def);
    return { x: base.x + (mount.x * Math.cos(a) - mount.y * Math.sin(a)) * scale,
      y: base.y + (mount.x * Math.sin(a) + mount.y * Math.cos(a)) * scale, angle: s.mounts[mount.id].angle };
  }
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
  function deploymentPosition(e: Ent, d: DeploymentSpec): Pose | null {
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
  function commit(e: Ent, d: DeploymentSpec): boolean {
    const at = deploymentPosition(e, d); if (!at) return false;
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
    beforeStep(dt) {
      prior.clear(); committed.clear();
      for (const e of host.participants()) {
        const cfg = config(e); if (!cfg || !live(e)) continue; const s = state(e); initialize(e, s, cfg);
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
      if (job) return { ...def, speed: 0, fireOnMove: job.lockWeapons === false || def.fireOnMove };
      const weapons = cfg?.disabledWeapons?.length ? def.weapons.map(w => cfg.disabledWeapons.includes(w.id) ? { ...w, targets: [] } : w) : def.weapons;
      if (s?.tow && cfg?.tow) return { ...def, speed: def.speed * cfg.tow.speed, weapons };
      if (cfg?.squad) return { ...def, weapons: [] };
      return weapons === def.weapons ? def : { ...def, weapons };
    },
    canFire(e, _def, weapon, _point, target) {
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
        }
        if (bearing.burst) {
          const remembered = st.ents.get(bearing.burst.target);
          if (remembered && guns.some(w => w.id === bearing.burst!.weapon && valid(remembered, w))) chosen = remembered;
          else if (bearing.burst.target) { delete bearing.burst; chosen = null; }
        }
        const point = bearing.burst ? chosen ?? { x: bearing.burst.x, y: bearing.burst.y } : chosen ?? aim;
        if (point) {
          const want = Math.atan2(point.y - at.y, point.x - at.x), off = Math.max(-mount.arc, Math.min(mount.arc, normAngle(want - base - mount.rest)));
          bearing.angle = turnToward(bearing.angle, base + mount.rest + off, mount.turnRate * dt);
        }
        bearing.target = chosen?.id ?? 0;
        if (e.holdFire || !point || power <= 0) continue;
        const off = normAngle(Math.atan2(point.y - at.y, point.x - at.x) - base - mount.rest);
        if (Math.abs(off) > mount.arc || Math.abs(normAngle(Math.atan2(point.y - at.y, point.x - at.x) - bearing.angle)) > mount.tolerance) continue;
        const scale = unitDisplayScale(def), hull = def.kind === 'building' ? 0 : e.angle + Math.PI / 2, dx = (at.x - e.x) / scale, dy = (at.y - e.y) / scale;
        const shotDef: UnitDef = { ...def, turretSprite: mount.sprite ?? def.turretSprite ?? def.sprite, airMount: undefined,
          turretMounts: [{ x: dx * Math.cos(hull) + dy * Math.sin(hull), y: -dx * Math.sin(hull) + dy * Math.cos(hull) }] };
        const emit = (w: WeaponDef, victim: Ent | null, point: GroundAim, shot: number): void => {
          const old = e.turretAngle, bore = e.boreI, left = e.burstLeft, wi = e.burstWi;
          e.turretAngle = bearing.angle; e.boreI = bearing.bore;
          if (shot > 0) { e.burstLeft = bearing.burst?.left ?? 0; e.burstWi = def.weapons.findIndex(a => a.id === w.id); }
          try {
            const effectsStart = world.effects.length;
            host.fireShot(world, e, { ...shotDef, weapons: [w] }, { ...w, turret: true }, victim, victim ? null : point, shot);
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
          const oldAngle = e.turretAngle, oldLeft = e.burstLeft, oldWi = e.burstWi;
          e.turretAngle = bearing.angle;
          if (continuation) { e.burstLeft = bearing.burst?.left ?? 0; e.burstWi = def.weapons.findIndex(a => a.id === w.id); }
          try { return host.canFire(e, shotDef, w, point, victim); }
          finally { e.turretAngle = oldAngle; e.burstLeft = oldLeft; e.burstWi = oldWi; }
        };
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
            const amount = Math.min(travel, Math.max(0, length - cfg.tow.length)), p = { x: child.x + (length ? dx / length * amount : 0), y: child.y + (length ? dy / length * amount : 0), angle: length ? Math.atan2(dy, dx) : child.angle };
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
            if (live(child) && slot?.onParentDeath === 'kill') kill(st, child);
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
      const passenger = order.kind === 'board' ? e : order.kind === 'pickup' ? st.ents.get(order.targetId) : undefined;
      return !passenger || !(config(passenger)?.attachments.length || children.has(passenger.id) || states.get(passenger.id)?.tow || trailers.has(passenger.id));
    },
    actions(e) {
      const cfg = config(e); if (!cfg || !live(e)) return []; const s = state(e), out: ModuleAction[] = [];
      if (s.job) { if (cfg.deployments.find(a => a.id === s.job!.id)?.cancelable) out.push({ id: 'cancel', label: t('extension.cancel'), enabled: true }); return out; }
      for (const d of cfg.deployments) out.push({ id: `deploy:${d.id}`, label: d.label, enabled: !!deploymentPosition(e, d) });
      if (cfg.tow) out.push(s.tow ? { id: 'detach', label: t('extension.detach'), enabled: true } : { id: 'tow', label: t('extension.tow'), enabled: true, target: 'own' });
      return out;
    },
    order(order) {
      let accepted = false;
      for (const id of order.ids) {
        const e = st.ents.get(id); if (!live(e) || e.owner !== order.owner || e.emp) continue; const cfg = config(e); if (!cfg) continue; const s = state(e);
        if (order.action === 'cancel' && s.job && cfg.deployments.find(d => d.id === s.job!.id)?.cancelable) { delete s.job; accepted = true; continue; }
        if (s.job) continue;
        const action = cfg.deployments.find(d => order.action === `deploy:${d.id}`);
        if (action && deploymentPosition(e, action)) { s.job = { id: action.id, from: e.defId, elapsed: 0 }; accepted = true; continue; }
        if (order.action === 'detach' && s.tow) { detach(e, s); accepted = true; continue; }
        if (order.action === 'tow' && cfg.tow && !s.tow && !children.has(id) && !trailers.has(id)) {
          const child = st.ents.get(order.targetId ?? 0);
          if (!live(child) || child.owner !== order.owner || child.id === id || children.has(child.id) || trailers.has(child.id) || states.get(child.id)?.tow || !cfg.tow.accepts.includes(child.defId) || cargoWeight(getDef(child.defId)) > cfg.tow.maxWeight || Math.hypot(e.x - child.x, e.y - child.y) > cfg.tow.range * TILE) continue;
          const distance = Math.hypot(e.x - child.x, e.y - child.y);
          if (distance < getDef(e.defId).radius + getDef(child.defId).radius || !sweep(child, child, e, new Set([e.id, child.id]))) continue;
          s.tow = child.id; trailers.set(child.id, id); child.orders = []; child.path = null; accepted = true;
        }
      }
      return accepted;
    },
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
        mounts: Object.fromEntries(Object.entries(s.mounts).map(([key,m]) => [key, !view ? m : { angle: m.angle, previousAngle: m.previousAngle, target: 0 }])),
        ...(view ? { job: view.privateEntity(id) ? s.job : undefined, tow: s.tow && view.visibleEntities.has(s.tow) ? s.tow : undefined } : {}) }]) as unknown as Json;
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
        if (e.inside && (cfg.attachments.length || raw.tow !== undefined)) throw new Error('Transported assemblies are unsupported');
        const s: Assembly = {definition:e.defId,initialized:raw.initialized,members:Object.create(null),mounts:Object.create(null)};
        if (raw.parentAngle !== undefined) {
          if (!finite(raw.parentAngle,-1e6,1e6)) throw new Error('Invalid attachment parent bearing');
          s.parentAngle = raw.parentAngle;
        }
        for (const [slot,id] of Object.entries(raw.members)) {
          const def = cfg.attachments.find(a => a.id === slot), child = integer(id) ? st.ents.get(id) : undefined;
          if (!def || !integer(id) || id === e.id || memberParents.has(id) || (child && (child.owner !== e.owner || child.defId !== def.unit || child.inside))) throw new Error('Invalid attachment reference');
          s.members[slot] = id; if (child) memberParents.set(id, {parent:e.id,slot});
        }
        if (Object.keys(raw.mounts).length !== cfg.mounts.length) throw new Error('Invalid mount membership');
        for (const def of cfg.mounts) {
          const a = raw.mounts[def.id];
          if (!record(a) || !finite(a.angle,-1e6,1e6) || !finite(a.previousAngle,-1e6,1e6) || !integer(a.target)) throw new Error('Invalid mount bearing');
          if (a.bore !== undefined && (!integer(a.bore) || a.bore > 1024)) throw new Error('Invalid mount barrel');
          const m: Bearing = {bore:typeof a.bore === 'number' ? a.bore : 0,angle:a.angle,previousAngle:a.previousAngle,target:a.target};
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
