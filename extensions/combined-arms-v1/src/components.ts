import { pick } from './host';
import { t } from './strings';
import type { UnitDef, WeaponDef } from '../../../../steel-tide/game/core/src/core/types';
import { DEFS, getDef } from './host';
import { kill } from './host';
import type { Game } from '../../../../steel-tide/game/core/src/game/sim';
import type { Ent, Proj } from '../../../../steel-tide/game/core/src/game/state';
import { EV_HURT } from './host';
import type { EngineModuleInstance, Json, ModuleAction, ModuleHost, ModuleOrder, ModuleStatusRow, RuntimeView } from '../../../../steel-tide/game/core/src/game/extensions/contracts';
import { logisticsStock, logisticsRefillsComponent, beginComponentRefill } from './logistics';
import type { BlastBand, ComponentEffects, ComponentPayload, ComponentsDef, Face, Faces, PartDef, RepairPolicy } from './componentsSpec';

interface PartState { damage: number; failed: boolean; occupant?: string; latched?: boolean }
interface RepairTask { part: string; policy: number; progress: number; paid: number }
interface CrewTask { from: string; to: string; occupant: string; progress: number }
interface ComponentsState {
  form: string;
  parts: Record<string, PartState>;
  layers: Record<string, Faces>;
  repair?: RepairTask;
  crew?: CrewTask;
  reserve?: { count: number; health: number; progress: number; serial: number };
  group?: { manual: boolean; progress: number; remainder: number };
  terminal?: { remaining: number; owner: number; sourceId: number; gun: string };
}
interface ShotData { payload: ComponentPayload; startX: number; startY: number }
export interface ProtectionResult { handled: boolean; face: Face; penetrated: boolean; ricochet: boolean; penetration: number; effectiveArmor: number; residual: number }
const FACES: Face[] = ['front', 'side', 'rear', 'top'];
const runtimes = new WeakMap<Game, ComponentsModule>();
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const only = (v: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(v).every(k => keys.includes(k));
const number = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function plain<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

/** Explicitly called by authored refill services; hull healing cannot refill components. */
export function refillComponentState(game: Game, entity: Ent, which: 'crew' | 'protection'): boolean {
  return runtimes.get(game)?.refill(entity, which) ?? false;
}

/** Services share the same authoritative eligibility used by commands and HUD. */
export function componentNeedsRefill(game: Game, entity: Ent, which: 'crew' | 'protection'): boolean {
  return runtimes.get(game)?.needsRefill(entity, which) ?? false;
}

/** Rebase stock-dependent accumulated damage before the inventory is refilled. */
export function refillComponentStocks(game: Game, entity: Ent, stocks: readonly string[]): void {
  runtimes.get(game)?.refillStocks(entity, stocks);
}

export class ComponentsModule implements EngineModuleInstance {
  readonly id = 'components-v1' as const;
  private readonly states = new Map<number, ComponentsState>();
  private shots = new WeakMap<Proj, ShotData>();
  constructor(private readonly host: ModuleHost) { runtimes.set(host.game, this); }
  private config(e: Ent): ComponentsDef | undefined { return this.host.config<ComponentsDef>(getDef(e.defId)); }
  private ensure(e: Ent): ComponentsState | undefined {
    const cfg = this.config(e);
    if (!cfg) return;
    const old = this.states.get(e.id);
    if (old?.form === e.defId) return old;
    const previous = old && DEFS[old.form] ? this.host.config<ComponentsDef>(DEFS[old.form]) : undefined;
    if (old && previous && JSON.stringify(previous) === JSON.stringify(cfg)) { old.form = e.defId; return old; }
    const parts: Record<string, PartState> = {};
    for (const p of cfg.parts) {
      const oldPart = previous?.parts.find(part => part.id === p.id);
      const held = !!oldPart?.crew === !!p.crew ? old?.parts[p.id] : undefined;
      parts[p.id] = held ? { ...held, damage: Math.min(p.damageLimit ?? p.hp, held.damage), failed: this.failed(e, p, held.damage) }
        : { damage: 0, failed: false, ...(p.crew ? { occupant: `${e.id}:${p.id}` } : {}) };
      if (parts[p.id].damage >= p.hp) delete parts[p.id].occupant;
      if (!p.crew) delete parts[p.id].occupant;
    }
    const state: ComponentsState = { form: e.defId, parts, layers: plain(cfg.protection?.layers ?? {}) };
    // A compatible form retains spent protection; a new facing cannot conjure lost armor.
    for (const [family, f] of Object.entries(state.layers)) if (old?.layers[family]) {
      for (const face of FACES) f[face] = Math.min(f[face], old.layers[family][face]);
    }
    if (cfg.reserve) state.reserve = { count: cfg.reserve.capacity, health: cfg.reserve.capacity * cfg.reserve.hpPerMember, progress: 0, serial: 0 };
    if (cfg.repairGroup) state.group = { manual: false, progress: 0, remainder: 0 };
    this.states.set(e.id, state);
    return state;
  }
  private threshold(e: Ent, p: PartDef): number {
    return p.hp + (p.stockThreshold?.stocks.reduce((n, id) => {
      const stock = logisticsStock(this.host.game, e, id);
      return n + (stock ? stock.capacity - stock.amount : 0);
    }, 0) ?? 0) * (p.stockThreshold?.perMissing ?? 0);
  }
  private failed(e: Ent, p: PartDef, damage: number): boolean {
    return p.stockThreshold?.strict ? damage > this.threshold(e, p) : damage >= this.threshold(e, p);
  }
  private effect(p: PartDef, s: PartState): ComponentEffects | undefined {
    if (s.failed) return p.destroyed ?? p.damaged;
    return s.latched || (s.damage >= p.hp * p.damagedAt && s.damage < p.hp * (p.damagedBelow ?? Infinity)) ? p.damaged : undefined;
  }
  private face(entity: Ent, bearing: number, top = false): Face {
    const p = this.config(entity)?.protection, forward = -Math.cos(bearing - entity.angle);
    return top ? 'top' : forward >= Math.cos((p?.frontHalfAngle ?? 45) * Math.PI / 180) ? 'front'
      : forward <= -Math.cos((p?.rearHalfAngle ?? 45) * Math.PI / 180) ? 'rear' : 'side';
  }
  private destroy(entity: Ent, owner: number, sourceId: number, gun: string): void {
    const cfg = this.config(entity), s = this.ensure(entity);
    if (!cfg || !s || entity.dead || s.terminal) return;
    if (cfg.failureDelay) { s.terminal = { remaining: cfg.failureDelay, owner, sourceId, gun }; entity.orders.length = 0; entity.targetId = 0; }
    else kill(this.host.game.st, entity, owner, 'killed', gun, 0, sourceId);
  }
  private emptyCrew(entity: Ent, cfg: ComponentsDef, s: ComponentsState, owner: number, sourceId: number, gun: string): void {
    if (cfg.crew?.destroyWhenEmpty && !s.reserve?.count && cfg.parts.filter(p => p.crew).every(p => !s.parts[p.id].occupant)) this.destroy(entity, owner, sourceId, gun);
  }
  private hurtReserve(cfg: ComponentsDef, s: ComponentsState, amount: number, offset: number): void {
    if (!cfg.reserve || !s.reserve || amount <= 0) return;
    const r = cfg.reserve, pool = s.reserve;
    pool.health = Math.max(-1e6, pool.health - amount);
    if (r.roundHealth) pool.health = Math.trunc(pool.health);
    pool.count = Math.min(pool.count, Math.max(0, Math.floor((pool.health + offset * r.hpPerMember) / r.hpPerMember)));
  }
  private blastDamage(bands: BlastBand[] | undefined, hp: number, pressure: number, yieldValue: number): number {
    const b = bands?.find(b => pressure > b.above);
    if (!b) return 0;
    return hp * this.host.game.st.rng.range(...b.damage) * (b.scale === 'part' ? 1 : pressure * (b.scale === 'yield-pressure-part' ? yieldValue : 1));
  }
  private weapon(gun: string): WeaponDef | undefined {
    const split = gun.lastIndexOf('/');
    if (split < 0) return;
    return DEFS[gun.slice(0, split)]?.weapons.find(w => w.id === gun.slice(split + 1));
  }
  onShot(entity: Ent, _def: UnitDef, weapon: WeaponDef, projectile: Proj): void {
    const payload = this.host.config<ComponentPayload>(weapon);
    if (payload) {
      projectile.id ??= this.host.game.st.nextProjId++;
      this.shots.set(projectile, { payload, startX: entity.x, startY: entity.y });
    }
  }
  /** Pure face policy with only optional-match callers. Angles are radians at runtime. */
  resolveProtection(entity: Ent, payload: ComponentPayload, bearing: number, distance: number): ProtectionResult {
    const definition = this.config(entity), state = this.ensure(entity), cfg = definition?.protection;
    const family = cfg?.families[payload.family] ?? (!cfg && definition?.parts.length ? { front: 0, side: 0, rear: 0, top: 0 } : undefined);
    if (!state || !family) return { handled: false, face: 'front', penetrated: false, ricochet: false, penetration: 0, effectiveArmor: 0, residual: 0 };
    const forward = -Math.cos(bearing - entity.angle);
    const face = this.face(entity, bearing, payload.top);
    const cosine = payload.top ? 1 : face === 'side' ? Math.abs(Math.sin(bearing - entity.angle)) : Math.abs(forward);
    const nominal = family[face] + (state.layers[payload.family]?.[face] ?? 0) * (payload.layerScale?.[face] ?? 1);
    const ricochet = !!payload.ricochet && cosine < payload.ricochet.cosine && (!payload.ricochet.requiresNominalBlock || nominal > payload.penetration);
    const range = Math.min(32768, Math.max(0, distance));
    const [a, b, c] = payload.rangeAdjustment;
    const penetration = Math.max(0, payload.penetration + a + b * range + c * range * range) * this.host.game.st.rng.range(...payload.jitter);
    const armor = cfg?.incidence ? nominal / Math.max(1e-6, cosine) : nominal;
    const penetrated = !ricochet && penetration > armor;
    // A sector's physical layer loses the same share of all its protection families.
    if (!ricochet && payload.wear > 0) for (const layer of Object.values(state.layers)) layer[payload.wearFaces?.[face] ?? face] *= 1 - payload.wear;
    return { handled: true, face, penetrated, ricochet, penetration, effectiveArmor: armor, residual: penetrated && penetration > 0 ? (penetration - armor) / penetration : 0 };
  }
  wrapDamage(next: ModuleHost['applyDamage']): ModuleHost['applyDamage'] {
    return (st, target, raw, mult, owner, sourceId = 0, gun = '', from, hit) => {
      const impact = this.host.currentImpact, projectile = impact?.projectile;
      const shot = projectile ? this.shots.get(projectile) : undefined, weapon = this.weapon(gun);
      const payload = shot?.payload ?? (weapon ? this.host.config<ComponentPayload>(weapon) : undefined);
      const cfg = this.config(target), state = cfg ? this.ensure(target) : undefined;
      if (!payload || !projectile || !cfg || !state || target.dead || target.locked) { next(st, target, raw, mult, owner, sourceId, gun, from, hit); return; }
      if (state.terminal) { next(st, target, 0, undefined, owner, sourceId, gun, from); return; }
      if (cfg.protection && !cfg.protection.families[payload.family]) { next(st, target, raw, mult, owner, sourceId, gun, from, hit); return; }
      if (!cfg.protection && !cfg.parts.length) { next(st, target, raw, mult, owner, sourceId, gun, from, hit); return; }
      const distance = Math.hypot(projectile.x - target.x, projectile.y - target.y);
      const direct = impact?.direct === target || distance <= getDef(target.defId).radius + 10;
      const blast = payload.blast && cfg.blast && distance <= payload.blast.radius ? payload.blast : undefined;
      if (!direct && !blast) {
        next(st, target, payload.collateralHullDamage ?? raw, payload.collateralHullDamage === undefined ? mult : undefined, owner, sourceId, gun, from, hit); return;
      }
      const start = payload.rangeOrigin === 'source' && st.ents.get(sourceId) ? { startX: st.ents.get(sourceId)!.x, startY: st.ents.get(sourceId)!.y }
        : shot ?? { startX: from?.x ?? projectile.px, startY: from?.y ?? projectile.py };
      const result = blast && !blast.penetration ? { handled: true, face: this.face(target, projectile.angle, payload.top), penetrated: true, residual: 1 }
        : this.resolveProtection(target, payload, projectile.angle, Math.hypot(projectile.x - start.startX, projectile.y - start.startY));
      if (!result.handled) { next(st, target, raw, mult, owner, sourceId, gun, from, hit); return; }
      if (state.repair) state.repair.progress *= cfg.repairHitRetention;
      if (!result.penetrated) { next(st, target, 0, undefined, owner, sourceId, gun, from); return; }
      if (state.group && !blast) {
        state.group.progress *= cfg.repairHitRetention;
        if (cfg.repairGroup?.floorOnHit) state.group.progress = Math.floor(state.group.progress);
      }
      const energy = Math.max(payload.strength, payload.hullDamage);
      let fraction = 1;
      if (target.rs?.shield && energy > 0) {
        const soak = Math.min(target.rs.shield, energy); target.rs.shield -= soak;
        target.rs.hurtAt = st.time; target.rs.ev |= EV_HURT; fraction = 1 - soak / energy;
      }
      next(st, target, payload.hullDamage * fraction, undefined, owner, sourceId, gun, from);
      if (fraction <= 0 || target.dead) return;
      if (blast && cfg.blast) {
        const b = cfg.blast, plate = cfg.protection?.families[b.family]?.[result.face] ?? 0;
        const pressure = b.base / (b.base + b.armorScale * plate) * b.coefficient * blast.yield ** 2 / Math.max(b.minimumDistance ** 2, distance ** 2);
        for (const p of cfg.parts) this.hurt(target, p, state.parts[p.id], this.blastDamage(p.blast, p.hp, pressure, blast.yield) * fraction, owner, sourceId, gun);
        this.hurtReserve(cfg, state, this.blastDamage(cfg.reserve?.blast, cfg.reserve?.damageHp ?? 0, pressure, blast.yield) * fraction, blast.poolCountOffset);
      } else {
        const residual = payload.residual ? clamp(payload.residual.base + payload.residual.scale * result.residual, 0, payload.residual.max) : 1;
        const weak = payload.weakHit && st.rng.chance(payload.weakHit.chance) ? payload.weakHit.multiplier : 1;
        const damage = (channelId: string, exposure: Faces): number => {
          const channel = payload.channels[channelId]; if (!channel) return 0;
          const ranges = channel.faces?.[result.face] ?? channel;
          const strong = st.rng.chance(clamp(exposure[result.face] * payload.diameter, 0, 1));
          return payload.strength * st.rng.range(...(strong ? ranges.strong : ranges.weak)) * residual * fraction * weak;
        };
        for (const part of cfg.parts) {
          if (state.parts[part.id].damage >= (part.damageLimit ?? part.hp)) continue;
          this.hurt(target, part, state.parts[part.id], damage(part.channel, part.exposure), owner, sourceId, gun);
          if (target.dead) break;
        }
        if (cfg.reserve) this.hurtReserve(cfg, state, damage(cfg.reserve.channel, cfg.reserve.exposure), 0);
      }
      this.emptyCrew(target, cfg, state, owner, sourceId, gun);
    };
  }
  private hurt(entity: Ent, part: PartDef, state: PartState, amount: number, owner: number, sourceId: number, gun: string): void {
    if (amount <= 0) return;
    state.damage = Math.min(part.damageLimit ?? part.hp, Math.max(part.stockThreshold ? -1e6 : 0, state.damage + amount));
    if (part.latchDamaged && state.damage >= part.hp * part.damagedAt && state.damage < part.hp * (part.damagedBelow ?? Infinity)) state.latched = true;
    if (part.crew && state.damage >= part.hp) delete state.occupant;
    if (!this.failed(entity, part, state.damage) || state.failed) return;
    state.failed = true;
    if (part.failure?.destroy) {
      if (part.failure.hullRange) entity.hp = Math.floor(this.host.game.st.rng.range(...part.failure.hullRange));
      this.destroy(entity, owner, sourceId, gun);
    } else if (part.failure?.hullDamage) this.host.applyDamage(this.host.game.st, entity, part.failure.hullDamage, undefined, owner, sourceId, '', undefined);
  }
  effectiveDef(entity: Ent, definition: UnitDef): UnitDef {
    const cfg = this.config(entity), state = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !state) return definition;
    let speed = 1, turn = 1, reloadAdd = 0;
    const disabled = new Set<string>();
    const add = (effect?: ComponentEffects): void => {
      if (!effect) return;
      speed *= effect.speed ?? 1; turn *= effect.turn ?? 1; reloadAdd += effect.reloadAdd ?? 0;
      for (const id of effect.disableWeapons ?? []) disabled.add(id);
    };
    for (const p of cfg.parts) {
      add(this.effect(p, state.parts[p.id]));
    }
    if (state.reserve?.count === 0) add(cfg.reserve?.empty);
    if (cfg.turnFromSpeed) turn *= cfg.turnFromSpeed[0] + cfg.turnFromSpeed[1] * speed;
    if (state.terminal) { speed = 0; turn = 0; for (const w of definition.weapons) disabled.add(w.id); }
    if (state.group?.progress) { speed = 0; turn = 0; }
    if (cfg.clearOrdersWhenImmobile && speed === 0) turn = 0;
    if (state.crew || (state.repair && cfg.parts.find(p => p.id === state.repair!.part)?.repairs?.[state.repair.policy].stationary)) speed = 0;
    if (speed === 1 && turn === 1 && reloadAdd === 0 && !disabled.size) return definition;
    return { ...definition, speed: definition.speed * speed, turnRate: definition.turnRate * turn, weapons: definition.weapons.map(w => disabled.has(w.id)
      ? { ...w, targets: [] }
      : reloadAdd ? { ...w, reload: w.reload * Math.max(0.1, 1 + reloadAdd) } : w) };
  }
  canFire(entity: Ent, _def: UnitDef, weapon: WeaponDef): boolean {
    const cfg = this.config(entity), state = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !state) return true;
    if (state.terminal || (state.reserve?.count === 0 && cfg.reserve?.empty?.disableWeapons?.includes(weapon.id))) return false;
    for (const p of cfg.parts) {
      const effects = this.effect(p, state.parts[p.id]);
      if (effects?.disableWeapons?.includes(weapon.id)) return false;
    }
    return true;
  }
  private eligible(entity: Ent, part: PartDef, policy: RepairPolicy, state: ComponentsState): boolean {
    const p = state.parts[part.id];
    if (!p || p.damage / part.hp < policy.fromDamage || p.damage / part.hp >= (policy.untilDamage ?? Infinity) || (part.crew && !p.occupant)) return false;
    if (!policy.provider) return true;
    return this.provider(entity, policy.provider, policy.range!);
  }
  private provider(entity: Ent, tag: string, range: number): boolean {
    const st = this.host.game.st;
    return this.host.participants().some(provider => provider.id !== entity.id && !provider.dead && !provider.site && !provider.inside && !provider.emp &&
      st.players[provider.owner]?.team === st.players[entity.owner]?.team &&
      this.config(provider)?.services?.includes(tag) && Math.hypot(provider.x - entity.x, provider.y - entity.y) <= range);
  }
  beforeStep(dt: number): void {
    const st = this.host.game.st;
    for (const id of this.states.keys()) if (!st.ents.has(id) || st.ents.get(id)!.dead) this.states.delete(id);
    for (const e of this.host.participants()) {
      if (e.dead) continue;
      const cfg = this.config(e), s = cfg ? this.ensure(e) : undefined;
      if (!cfg || !s) continue;
      if (s.terminal) { s.terminal.remaining -= dt; if (s.terminal.remaining <= 0) kill(st, e, s.terminal.owner, 'killed', s.terminal.gun, 0, s.terminal.sourceId); continue; }
      if (e.site || e.inside || e.emp) continue;
      if (cfg.repairGroup && s.group) this.stepGroup(e, cfg, s, dt);
      if (cfg.reserve && s.reserve) {
        const pool = s.reserve, dest = cfg.reserve.priority.find(id => !s.parts[id].occupant);
        if (pool.count > 0 && dest && !logisticsRefillsComponent(this.host.game, e, 'crew')) {
          pool.progress += dt;
          if (pool.progress + 1e-8 >= cfg.reserve.seconds) {
            s.parts[dest] = { damage: 0, failed: false, occupant: `${e.id}:reserve:${++pool.serial}` };
            pool.count--; pool.progress = 0;
          }
        } else if (!dest || pool.count <= 0) pool.progress = 0;
      }
      if (cfg.clearOrdersWhenImmobile && this.effectiveDef(e, getDef(e.defId)).speed === 0) e.orders.length = 0;
      if (!cfg.repairGroup && !s.repair) {
        for (const p of cfg.parts) {
          const i = p.repairs?.findIndex(q => q.auto && this.eligible(e, p, q, s)) ?? -1;
          if (i >= 0 && !e.holdPos && !e.helm && e.orders.length === 0) { s.repair = { part: p.id, policy: i, progress: 0, paid: 0 }; break; }
        }
      }
      if (s.repair) {
        const task = s.repair, p = cfg.parts.find(p => p.id === task.part), policy = p?.repairs?.[task.policy];
        if (!p || !policy || !this.eligible(e, p, policy, s)) delete s.repair;
        else if (!policy.stationary || Math.hypot(e.x - e.prevX, e.y - e.prevY) < 0.01) {
          const progress = Math.min(policy.seconds, task.progress + dt);
          const cost = Math.min((policy.metal ?? 0) - task.paid, (progress - task.progress) / policy.seconds * (policy.metal ?? 0));
          const pl = st.players[e.owner];
          if (pl && pl.metal + 1e-9 >= cost) {
            pl.metal -= cost; task.paid += cost; task.progress = progress;
            if (progress >= policy.seconds - 1e-8) { s.parts[p.id].damage = policy.toDamage * p.hp; s.parts[p.id].failed = false; delete s.repair; }
          }
        }
      }
      if (!s.crew && cfg.crew?.automatic && !e.holdPos && !e.helm) {
        for (const to of cfg.crew.priority) {
          if (s.parts[to]?.occupant) continue;
          const pair = cfg.crew.replacements.find(pair => pair.to === to && s.parts[pair.from]?.occupant);
          if (pair) { s.crew = { ...pair, occupant: s.parts[pair.from].occupant!, progress: 0 }; break; }
        }
      }
      if (s.crew && cfg.crew) {
        const task = s.crew, from = s.parts[task.from], to = s.parts[task.to];
        if (from?.occupant !== task.occupant || to?.occupant) delete s.crew;
        else {
          task.progress += dt;
          if (task.progress >= cfg.crew.seconds) {
            const f = cfg.parts.find(p => p.id === task.from)!, d = cfg.parts.find(p => p.id === task.to)!;
            to.occupant = from.occupant; to.damage = from.damage / f.hp * d.hp; to.failed = false;
            delete from.occupant; from.damage = f.hp * (cfg.crew.vacatedDamage ?? 1); from.failed = true; delete s.crew;
          }
        }
      }
    }
  }
  private needsManual(cfg: ComponentsDef, s: ComponentsState): boolean {
    return cfg.parts.some(p => p.repairs?.some(q => !q.auto && s.parts[p.id].damage >= p.hp * q.fromDamage && s.parts[p.id].damage < p.hp * (q.untilDamage ?? Infinity) && (!p.crew || s.parts[p.id].occupant)));
  }
  private stepGroup(e: Ent, cfg: ComponentsDef, s: ComponentsState, dt: number): void {
    const g = s.group!, policy = cfg.repairGroup!;
    const tasks = policy.priority.flatMap(key => {
      const [id, index] = key.split('/'), p = cfg.parts.find(p => p.id === id)!, q = p.repairs![Number(index)];
      return (q.auto || g.manual) && this.eligible(e, p, q, s) ? [{ p, q }] : [];
    });
    g.remainder += dt;
    // One bounded update handles any number of fixed source-clock quanta.
    const quanta = Math.floor((g.remainder + 1e-9) / policy.interval);
    g.remainder -= quanta * policy.interval;
    if (tasks.some(({ p, q }) => q.startAbove === undefined || s.parts[p.id].damage > p.hp * q.startAbove)) g.progress = Math.min(Math.max(...cfg.parts.flatMap(p => (p.repairs ?? []).map(q => q.seconds))), g.progress + quanta * policy.interval);
    const ready = tasks.find(({ q }) => g.progress + 1e-8 >= q.seconds);
    if (ready) {
      const p = s.parts[ready.p.id]; p.damage = ready.q.toDamage * ready.p.hp; p.failed = false; delete p.latched; g.progress = 0;
    }
    if (g.manual && policy.finishBelow !== undefined && cfg.parts.every(p => s.parts[p.id].damage < p.hp * policy.finishBelow!) && this.provider(e, policy.provider, policy.range)) {
      for (const p of cfg.parts) { s.parts[p.id].damage = 0; s.parts[p.id].failed = false; delete s.parts[p.id].latched; }
      if (policy.refillProtection) s.layers = plain(cfg.protection?.layers ?? {});
      g.manual = false; g.progress = 0;
    }
    if (g.manual && policy.finishBelow === undefined && !this.needsManual(cfg, s)) { g.manual = false; g.progress = 0; }
  }
  refillStocks(entity: Ent, stocks: readonly string[]): void {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s || s.terminal) return;
    for (const p of cfg.parts) if (p.stockThreshold?.rebaseOnRefill) {
      const missing = p.stockThreshold.stocks.filter(id => stocks.includes(id)).reduce((n, id) => {
        const stock = logisticsStock(this.host.game, entity, id); return n + (stock ? stock.capacity - stock.amount : 0);
      }, 0);
      s.parts[p.id].damage = Math.max(-1e6, s.parts[p.id].damage - missing * p.stockThreshold.perMissing);
      s.parts[p.id].failed = this.failed(entity, p, s.parts[p.id].damage);
    }
  }
  order(order: ModuleOrder): boolean {
    let done = false;
    for (const id of order.ids) {
      const e = this.host.game.st.ents.get(id);
      if (!e || e.dead || e.owner !== order.owner || e.site || e.inside) continue;
      const cfg = this.config(e), state = cfg ? this.ensure(e) : undefined;
      if (!cfg || !state || state.terminal) continue;
      if (order.action === 'cancel') { done ||= !!state.repair || !!state.crew || !!state.group?.manual; delete state.repair; delete state.crew; if (state.group) { state.group.manual = false; state.group.progress = 0; } }
      else if (order.action === 'repair' && cfg.repairGroup && state.group && (!order.choice || order.choice === 'group')) {
        if (this.needsManual(cfg, state) && this.provider(e, cfg.repairGroup.provider, cfg.repairGroup.range)) { state.group.manual = true;
          if (cfg.repairGroup.beginRefill && cfg.reserve && state.reserve && (state.reserve.count < cfg.reserve.capacity || cfg.parts.some(p => p.crew && !state.parts[p.id].occupant))) beginComponentRefill(this.host.game, e, cfg.repairGroup.beginRefill);
          done = true; }
      }
      else if (order.action === 'repair' && !cfg.repairGroup && order.choice && !state.repair && !state.crew) {
        const [partId, index] = order.choice.split('/'), p = cfg.parts.find(p => p.id === partId), i = Number(index), q = p?.repairs?.[i];
        if (p && q && Number.isInteger(i) && this.eligible(e, p, q, state)) { state.repair = { part: p.id, policy: i, progress: 0, paid: 0 }; done = true; }
      } else if (order.action === 'reassign' && cfg.crew && order.choice && !state.crew && !state.repair && !state.group?.progress) {
        const [from, to] = order.choice.split('/');
        if ((!cfg.crew.requiresEmptyReserve || !state.reserve?.count) && cfg.crew.replacements.some(p => p.from === from && p.to === to) && state.parts[from]?.occupant && !state.parts[to]?.occupant) {
          state.crew = { from, to, occupant: state.parts[from].occupant!, progress: 0 }; done = true;
        }
      }
    }
    return done;
  }
  inspect(entity: Ent, privateView: boolean): ModuleStatusRow[] {
    if (!privateView) return [];
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s) return [];
    const rows: ModuleStatusRow[] = cfg.parts.map(p => ({ id: p.id, label: p.label, value: Math.max(0, this.threshold(entity, p) - s.parts[p.id].damage), fraction: clamp(1 - s.parts[p.id].damage / this.threshold(entity, p), 0, 1), tone: s.parts[p.id].failed ? 'danger' : s.parts[p.id].damage >= p.hp * p.damagedAt ? 'warning' : 'normal' }));
    if (cfg.reserve && s.reserve) rows.push({ id: 'reserve-pool', label: cfg.reserve.label, value: s.reserve.count, fraction: cfg.reserve.capacity ? s.reserve.count / cfg.reserve.capacity : 0, tone: s.reserve.count ? 'normal' : 'danger' });
    return rows;
  }
  actions(entity: Ent): ModuleAction[] {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s || s.terminal) return [];
    if (s.repair || s.crew || s.group?.manual) return [{ id: 'cancel', label: t('module.cancel'), enabled: true }];
    const repairs = cfg.parts.flatMap(p => (p.repairs ?? []).map((q, i) => ({ p, q, i }))).filter(({ p, q }) => this.eligible(entity, p, q, s));
    const choices = cfg.crew?.replacements.filter(p => (!cfg.crew?.requiresEmptyReserve || !s.reserve?.count) && s.parts[p.from]?.occupant && !s.parts[p.to]?.occupant).map(p => ({ id: `${p.from}/${p.to}`, label: `${pick(cfg.parts.find(x => x.id === p.from)!.label)} → ${pick(cfg.parts.find(x => x.id === p.to)!.label)}` })) ?? [];
    return [
      ...(cfg.repairGroup && this.needsManual(cfg, s) && this.provider(entity, cfg.repairGroup.provider, cfg.repairGroup.range) ? [{ id: 'repair', label: t('module.repair'), enabled: true, choices: [{ id: 'group', label: t('module.repair') }] }] : []),
      ...(!cfg.repairGroup && repairs.length ? [{ id: 'repair', label: t('module.repair'), enabled: true, choices: repairs.map(({ p, i }) => ({ id: `${p.id}/${i}`, label: p.label })) }] : []),
      ...(choices.length ? [{ id: 'reassign', label: t('module.reassign'), enabled: true, choices }] : []),
    ];
  }
  needsRefill(entity: Ent, which: 'crew' | 'protection'): boolean {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s || s.terminal) return false;
    if (which === 'protection') return Object.entries(cfg.protection?.layers ?? {}).some(([family, faces]) => FACES.some(face => s.layers[family][face] < faces[face]));
    if (cfg.reserve && s.reserve) return s.reserve.count < cfg.reserve.capacity || cfg.parts.some(p => p.crew && !s.parts[p.id].occupant);
    return cfg.parts.some(p => p.crew && s.parts[p.id].damage > 0);
  }
  refill(entity: Ent, which: 'crew' | 'protection'): boolean {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s) return false;
    if (which === 'protection') s.layers = plain(cfg.protection?.layers ?? {});
    else if (cfg.reserve && s.reserve) {
      s.reserve.count = cfg.reserve.capacity; s.reserve.health = cfg.reserve.capacity * cfg.reserve.hpPerMember; s.reserve.progress = 0;
      for (const id of cfg.reserve.priority) if (!s.parts[id].occupant && s.reserve.count >= (cfg.reserve.refillCosts[id] ?? 0)) {
        s.parts[id] = { damage: 0, failed: false, occupant: `${entity.id}:reserve:${++s.reserve.serial}` }; s.reserve.count -= cfg.reserve.refillCosts[id] ?? 0;
      }
      delete s.crew;
    } else {
      for (const p of cfg.parts) if (p.crew) s.parts[p.id] = { damage: 0, failed: false, occupant: s.parts[p.id].occupant ?? `${entity.id}:${p.id}:${this.host.game.st.tick}` };
      delete s.crew;
    }
    return true;
  }
  snapshot(view?: RuntimeView): Json {
    for (const e of this.host.participants()) if (!e.dead) this.ensure(e);
    const out: Record<string, Json> = {};
    for (const [id, s] of this.states) if (this.host.game.st.ents.has(id) && !this.host.game.st.ents.get(id)!.dead && (!view || (view.visibleEntities.has(id) && view.privateEntity(id)))) {
      const copy = plain(s);
      if (view && copy.terminal && !view.visibleEntities.has(copy.terminal.sourceId)) { copy.terminal.sourceId = 0; copy.terminal.gun = ''; }
      out[id] = copy as unknown as Json;
    }
    const projectiles: Json[] = [];
    if (!view) for (const p of this.host.game.st.projs) {
      const s = this.shots.get(p);
      if (s && p.id !== undefined) projectiles.push({ id: p.id, startX: s.startX, startY: s.startY });
    }
    return { entities: out, projectiles };
  }
  restore(value: unknown): void {
    if (!object(value) || !only(value, ['entities', 'projectiles']) || !object(value.entities) || Object.keys(value.entities).length > this.host.game.st.ents.size || !Array.isArray(value.projectiles) || value.projectiles.length > this.host.game.st.projs.length) throw new Error('Invalid component state');
    const next = new Map<number, ComponentsState>();
    const occupants = new Set<string>();
    for (const [key, raw] of Object.entries(value.entities)) {
      const id = Number(key), entity = this.host.game.st.ents.get(id), cfg = entity ? this.config(entity) : undefined;
      if (!Number.isSafeInteger(id) || String(id) !== key || !entity || !cfg || !object(raw) || !only(raw, ['form', 'parts', 'layers', 'repair', 'crew', 'reserve', 'group', 'terminal']) || raw.form !== entity.defId || !object(raw.parts) || !object(raw.layers)) throw new Error('Invalid component entity');
      if (Object.keys(raw.parts).length !== cfg.parts.length) throw new Error('Invalid component membership');
      for (const p of cfg.parts) {
        const ps = raw.parts[p.id];
        if (!object(ps) || !only(ps, ['damage', 'failed', 'occupant', 'latched']) || !number(ps.damage, p.stockThreshold ? -1e6 : 0, p.damageLimit ?? p.hp) || typeof ps.failed !== 'boolean' || (!p.stockThreshold && ps.failed !== (ps.damage >= p.hp)) || (ps.latched !== undefined && (!p.latchDamaged || typeof ps.latched !== 'boolean'))) throw new Error('Invalid component damage');
        if (ps.occupant !== undefined) {
          if (!p.crew || typeof ps.occupant !== 'string' || ps.occupant.length > 120 || !ps.occupant.length || occupants.has(ps.occupant) || ps.damage >= p.hp) throw new Error('Invalid crew identity');
          occupants.add(ps.occupant);
        } else if (p.crew && ps.damage < p.hp) throw new Error('Missing live crew occupant');
      }
      const baseLayers = cfg.protection?.layers ?? {};
      if (Object.keys(raw.layers).length !== Object.keys(baseLayers).length) throw new Error('Invalid armor layers');
      for (const [family, faces] of Object.entries(baseLayers)) {
        const layer = raw.layers[family];
        if (!object(layer) || Object.keys(layer).length !== 4 || FACES.some(face => !number(layer[face], 0, faces[face]))) throw new Error('Invalid armor layer');
      }
      if (raw.repair !== undefined) {
        if (cfg.repairGroup) throw new Error('Shared repair cannot contain an individual task');
        const q = raw.repair;
        if (!object(q) || !only(q, ['part', 'policy', 'progress', 'paid']) || typeof q.part !== 'string' || !Number.isInteger(q.policy)) throw new Error('Invalid repair task');
        const part = cfg.parts.find(p => p.id === q.part), policy = part?.repairs?.[q.policy as number];
        if (!policy || !number(q.progress, 0, policy.seconds) || !number(q.paid, 0, policy.metal ?? 0)) throw new Error('Invalid repair progress');
      }
      if (raw.crew !== undefined) {
        const q = raw.crew;
        if (!object(q) || !only(q, ['from', 'to', 'occupant', 'progress']) || !cfg.crew || typeof q.from !== 'string' || typeof q.to !== 'string' || typeof q.occupant !== 'string' || !number(q.progress, 0, cfg.crew.seconds) ||
            (cfg.crew.requiresEmptyReserve && !!(raw.reserve as ComponentsState['reserve'])?.count) || !cfg.crew.replacements.some(p => p.from === q.from && p.to === q.to) || (raw.parts[q.from] as PartState)?.occupant !== q.occupant || (raw.parts[q.to] as PartState)?.occupant) throw new Error('Invalid crew task');
      }
      if (cfg.reserve) {
        const q = raw.reserve;
        if (!object(q) || !only(q, ['count', 'health', 'progress', 'serial']) || !number(q.count, 0, cfg.reserve.capacity) || !Number.isInteger(q.count) || !number(q.health, -1e6, cfg.reserve.capacity * cfg.reserve.hpPerMember) || !number(q.progress, 0, cfg.reserve.seconds) || !Number.isSafeInteger(q.serial) || (q.serial as number) < 0) throw new Error('Invalid reserve pool');
      } else if (raw.reserve !== undefined) throw new Error('Unexpected reserve pool');
      if (cfg.repairGroup) {
        const q = raw.group, max = Math.max(...cfg.parts.flatMap(p => (p.repairs ?? []).map(q => q.seconds)));
        if (!object(q) || !only(q, ['manual', 'progress', 'remainder']) || typeof q.manual !== 'boolean' || !number(q.progress, 0, max + cfg.repairGroup.interval) || !number(q.remainder, -1e-8, cfg.repairGroup.interval)) throw new Error('Invalid shared repair clock');
      } else if (raw.group !== undefined) throw new Error('Unexpected shared repair clock');
      if (raw.terminal !== undefined) {
        const q = raw.terminal;
        if (!object(q) || !only(q, ['remaining', 'owner', 'sourceId', 'gun']) || !cfg.failureDelay || !number(q.remaining, 0, cfg.failureDelay) || !Number.isInteger(q.owner) || !this.host.game.st.players[q.owner as number] || !Number.isSafeInteger(q.sourceId) || (q.sourceId as number) < 0 || typeof q.gun !== 'string' || q.gun.length > 240) throw new Error('Invalid terminal component state');
      }
      next.set(id, plain(raw) as unknown as ComponentsState);
    }
    const nextShots: [Proj, ShotData][] = [], seen = new Set<number>();
    for (const raw of value.projectiles) {
      if (!object(raw) || !only(raw, ['id', 'startX', 'startY']) || !Number.isSafeInteger(raw.id) || !number(raw.startX, -1e6, 1e6) || !number(raw.startY, -1e6, 1e6) || seen.has(raw.id as number)) throw new Error('Invalid component projectile');
      const p = this.host.game.st.projs.find(p => p.id === raw.id), w = p?.gun ? this.weapon(p.gun) : undefined, payload = w ? this.host.config<ComponentPayload>(w) : undefined;
      if (!p || !payload) throw new Error('Unknown component projectile');
      seen.add(raw.id as number); nextShots.push([p, { payload, startX: raw.startX, startY: raw.startY }]);
    }
    this.states.clear(); for (const [id, state] of next) this.states.set(id, state);
    this.shots = new WeakMap();
    for (const [p, shot] of nextShots) this.shots.set(p, shot);
  }
  validateRestoredState(): void {
    for (const [id, s] of this.states) {
      const e = this.host.game.st.ents.get(id), cfg = e && this.config(e);
      if (!e || !cfg) throw new Error('Missing restored component entity');
      for (const p of cfg.parts) if (p.stockThreshold && s.parts[p.id].failed !== this.failed(e, p, s.parts[p.id].damage)) throw new Error('Component failure disagrees with restored inventory');
    }
  }
  dispose(): void { this.states.clear(); runtimes.delete(this.host.game); }
}
export function createComponentsModule(host: ModuleHost): EngineModuleInstance { return new ComponentsModule(host); }
