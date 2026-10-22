import { createSourceMovement, type SourceWaypoint } from './sourceMovement';
import { createSourceWarmup } from './sourceWarmup';
import { createSourceBallistics } from './sourceBallistics';
import { sourceAreaVictims } from './sourceArea';
import { createSourceAps } from './sourceAps';
import { createSourceSmoke } from './sourceSmoke';
import { pick, Terrain, TILE } from './host';
import { t } from './strings';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { DEFS, getDef, setEntityDef } from './host';
import { kill } from './host';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import { EV_HURT } from './host';
import type { DamageContext, EngineModuleInstance, Json, ModuleAction, ModuleHost, ModuleOrder, ModuleStatusRow, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { logisticsStock, logisticsRefillsComponent, beginComponentRefill } from './logistics';
import type { BlastBand, ComponentEffects, ComponentPayload, ComponentsDef, Face, Faces, HpPhase, PartDef, RepairPolicy } from './componentsSpec';

interface PartState { damage: number; failed: boolean; occupant?: string; latched?: boolean }
interface RepairTask { part: string; policy: number; progress: number; paid: number }
interface CrewTask { from: string; to: string; occupant: string; progress: number }
interface ComponentsState {
  form: string;
  achievements?:string[];
  parts: Record<string, PartState>;
  layers: Record<string, Faces>;
  repair?: RepairTask;
  crew?: CrewTask;
  reserve?: { count: number; health: number; progress: number; serial: number };
  group?: { manual: boolean; progress: number; remainder: number };
  credited?: boolean;
  commanderLost?: boolean;
  combat?: { morale: number; armorKills: number; airKills: number; steadfast: boolean; quiet: number; remainder: number };
  abandoning?: number;
  terminal?: { remaining: number; owner: number; sourceId: number; gun: string; hull?: number };
}
interface ShotData { payload: ComponentPayload; startX: number; startY: number; helper?: { id: number; weak: number }; variant?: {kind:'helper'|'fragment';index:number}; branch?:number }
interface HpWave { gun:string; branch:number; phase:number; x:number;y:number;angle:number;owner:number;source:number;scale:number;age:number;hits:number[];air:boolean;forest:boolean }
export interface ProtectionResult { handled: boolean; face: Face; penetrated: boolean; ricochet: boolean; penetration: number; effectiveArmor: number; residual: number }
const FACES: Face[] = ['front', 'side', 'rear', 'top'];
const runtimes = new WeakMap<Game, ComponentsModule>();
/** Logical source helper identities never consume native blocked-grid IDs. */
export function allocateSourceHelperIdentity(game:Game):number | undefined { return runtimes.get(game)?.allocateHelperIdentity(); }
export function bindSourceHelperIdentity(game:Game,projectile:Proj,id:number,componentOnly=false):void { runtimes.get(game)?.bindHelperIdentity(projectile,id,componentOnly); }
export function stepSourceMovement(game:Game,entity:Ent,def:UnitDef,dt:number,desired?:SourceWaypoint):boolean {return runtimes.get(game)?.stepMovement(entity,def,dt,desired)??false;}
export function componentProjectileVariant(game:Game,projectile:Proj):(NonNullable<ShotData['variant']>&{branch?:number})|undefined { const v=runtimes.get(game)?.projectileVisual(projectile);return v&&'kind' in v?v:undefined; }
export function componentIncomingTags(game:Game,projectile:Proj):readonly string[] {return runtimes.get(game)?.incomingTags(projectile)??[];}
/** Package-private input to explicitly public source cosmetics; never serialized as damage data. */
export function componentVisualDamage(game: Game, entity: Ent): Record<string, { damage: number; hp: number; threshold: number }> | undefined {
  return runtimes.get(game)?.visualDamage(entity);
}
export function componentVisualLayers(game: Game, entity: Ent): Record<string, Faces> | undefined {
  return runtimes.get(game)?.visualLayers(entity);
}
/** Source 瘫痪 eligibility for towing: failed drive components, repair clock or terminal flag. */
export function componentImmobilized(game: Game, entity: Ent): boolean {
  return runtimes.get(game)?.immobilized(entity) ?? false;
}
/** Only the component portion of artillery's action lock; movement/deploy flags
 * belong to the queue owner and must be checked there. Equality stays ready. */
export function componentArtilleryReady(game:Game,entity:Ent):boolean { return runtimes.get(game)?.artilleryReady(entity)??false; }
/** The two smoke actions require different surviving crew seats. */
export function componentSmokeReady(game:Game,entity:Ent,kind:'grenade'|'engine'):boolean { return runtimes.get(game)?.smokeReady(entity,kind)??false; }
/** A source rack failure is a one-shot transition; consumers baseline on restore. */
export function componentRackFailure(game: Game, entity: Ent): { serial: number; hull: number } | undefined {
  return runtimes.get(game)?.rackFailure(entity);
}
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
  private readonly hpPass=new WeakMap<Proj,{phase:HpPhase;kind:'direct'|'area'}>();
  private activeHp: {projectile:Proj;phase:HpPhase;kind:'direct'|'area';forest:boolean}|undefined;
  private readonly waves:HpWave[]=[];
  private projectileDt=1/60;
  private readonly componentVisits=new WeakMap<Proj,Set<number>>();
  private readonly weakImpacts = new WeakMap<Proj, number>();
  private readonly impactRecipients = new WeakMap<Proj, { id: number; visited: boolean }>();
  private shots = new WeakMap<Proj, ShotData>();
  private logicalHelpers=0;
  private readonly achievements=new Map<number,Set<string>>();
  private internalHull=0;
  private readonly aps;
  private readonly smoke;
  private readonly ballistics;
  private readonly warmup;
  private readonly movement;
  constructor(private readonly host: ModuleHost) { runtimes.set(host.game, this); this.warmup=createSourceWarmup(host);this.movement=createSourceMovement(host); this.aps=createSourceAps(host);this.smoke=createSourceSmoke(host,(e,k)=>this.smokeReady(e,k),p=>this.aps.incomingTags(p),()=>this.aps.claimed());this.ballistics=createSourceBallistics(host,p=>{const w=p.gun?this.weapon(p.gun):undefined;return this.shots.get(p)?.payload.motion??(w?host.config<ComponentPayload>(w)?.motion:undefined);},p=>{const shot=this.shots.get(p);if(shot?.variant?.kind==='fragment'&&shot.variant.index===0)this.launchFragment(p,1,shot.branch??-1,0);}); }
  wrapWeapons(next:Parameters<NonNullable<EngineModuleInstance['wrapWeapons']>>[0]):ReturnType<NonNullable<EngineModuleInstance['wrapWeapons']>> {return this.warmup.wrapWeapons(next);}
  wrapTargetAcquisition(next:Parameters<NonNullable<EngineModuleInstance['wrapTargetAcquisition']>>[0]):ReturnType<NonNullable<EngineModuleInstance['wrapTargetAcquisition']>> {return this.warmup.wrapTargetAcquisition(next);}
  stepMovement(entity:Ent,def:UnitDef,dt:number,desired?:SourceWaypoint):boolean {return this.movement.step(entity,def,dt,desired);}
  beforeProjectiles(dt:number):void { this.projectileDt=dt;this.ballistics.prune();this.aps.beforeProjectiles(dt);this.smoke.beforeProjectiles(dt);for(let i=this.waves.length-1;i>=0;i--)if(this.stepWave(this.waves[i],dt))this.waves.splice(i,1); }
  projectileStep(p:Proj,dt:number): 'keep'|'remove'|undefined { return this.aps.projectileStep(p,dt)??this.ballistics.step(p,dt); }
  incomingTags(p:Proj):readonly string[] {return this.aps.incomingTags(p);}
  projectileVisual(p:Proj):(NonNullable<ShotData['variant']>&{altitude?:number;branch?:number})|{altitude:number}|undefined { const shot=this.shots.get(p),variant=shot?.variant,motion=this.ballistics.visual(p);return variant?{...variant,...(variant.kind==='fragment'?{branch:shot!.branch??-1}:{}),...motion}:motion; }
  private config(e: Ent): ComponentsDef | undefined { return this.host.config<ComponentsDef>(getDef(e.defId)); }
  artilleryReady(e:Ent):boolean {const cfg=this.config(e),s=this.ensure(e),gun=cfg?.parts.find(p=>p.id==='gunner');return !!gun&&!!s&&!s.parts.rack?.failed&&s.parts.gunner.damage<=gun.hp&&(!s.combat||s.combat.morale>=20);}
  smokeReady(e:Ent,kind:'grenade'|'engine'):boolean {const cfg=this.config(e),s=this.ensure(e),id=kind==='grenade'?'gunner':'driver',p=cfg?.parts.find(p=>p.id===id);return !!p&&!!s&&!s.parts.rack?.failed&&s.parts[id].damage<p.hp;}
  immobilized(e: Ent): boolean {
    const cfg = this.config(e), s = this.ensure(e);
    return !!cfg && !!s && (!!s.terminal || (s.group?.progress ?? 0) > 0 || ['track', 'engine', 'driver'].some(id => {
      const p = cfg.parts.find(p => p.id === id); return !!p && s.parts[id].damage >= p.hp;
    }));
  }
  rackFailure(e: Ent): { serial: number; hull: number } | undefined {
    const s = this.states.get(e.id);
    return s?.form === e.defId && s.terminal && s.parts.rack?.failed ? { serial: 1, hull: s.terminal.hull ?? e.hp } : undefined;
  }
  visualLayers(e: Ent): Record<string, Faces> | undefined {
    const state = this.states.get(e.id);
    return state?.form === e.defId ? state.layers : undefined;
  }
  visualDamage(e: Ent): Record<string, { damage: number; hp: number; threshold: number }> | undefined {
    const cfg = this.config(e), state = this.states.get(e.id);
    if (!cfg || !state || state.form !== e.defId) return;
    return Object.fromEntries(cfg.parts.map(p => [p.id, { damage: state.parts[p.id].damage, hp: p.hp, threshold: this.threshold(e, p) }]));
  }
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
    const state: ComponentsState = { form: e.defId, ...(old?.achievements?{achievements:[...old.achievements]}:{}), parts, layers: plain(cfg.protection?.layers ?? {}) };
    // A compatible form retains spent protection; a new facing cannot conjure lost armor.
    for (const [family, f] of Object.entries(state.layers)) if (old?.layers[family]) {
      for (const face of FACES) f[face] = Math.min(f[face], old.layers[family][face]);
    }
    if (cfg.sourceCombat) state.combat = old?.combat ? { ...old.combat } : { morale: cfg.sourceCombat.initial, armorKills: 0, airKills: 0, steadfast: false, quiet: 3, remainder: 0 };
    if (cfg.commander) state.commanderLost = old?.commanderLost ?? false;
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
    return p.strict || p.stockThreshold?.strict ? damage > this.threshold(e, p) : damage >= this.threshold(e, p);
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
    this.creditExperience(entity, sourceId);
    if (cfg.failureDelay) { s.terminal = { remaining: cfg.failureDelay, owner, sourceId, gun, hull: entity.hp }; entity.orders.length = 0; entity.targetId = 0; }
    else kill(this.host.game.st, entity, owner, 'killed', gun, 0, sourceId);
  }
  private emptyCrew(entity: Ent, cfg: ComponentsDef, s: ComponentsState, owner: number, sourceId: number, gun: string): void {
    if (cfg.crew?.destroyWhenEmpty && !s.reserve?.count && cfg.parts.filter(p => p.crew).every(p => !s.parts[p.id].occupant)) this.destroy(entity, owner, sourceId, gun);
  }
  private creditExperience(victim: Ent, sourceId: number): void {
    const value = this.config(victim)?.experience, source = this.host.game.st.ents.get(sourceId);
    const victimState = this.ensure(victim);
    if (!value || !victimState || victimState.credited || !source || source.dead || this.host.game.st.players[source.owner]?.team === this.host.game.st.players[victim.owner]?.team) return;
    victimState.credited = true;
    const state = this.ensure(source)?.combat;
    if (!state) return;
    if (value.kind === 'air') state.airKills += value.value;
    else {
      state.armorKills += value.value;
      if (value.value) state.morale = state.morale < 80 ? state.morale + 20 : 100;
      if (state.morale === 100) state.steadfast = true;
    }
  }
  onDamage(context: DamageContext): void {
    const state = this.ensure(context.target)?.combat;
    if (state && (context.impact || context.dealt > 0)) state.quiet = 0;
    if (context.target.dead && context.dealt > 0) this.creditExperience(context.target, context.sourceId);
  }
  private nearForest(x: number, y: number, range: number): boolean {
    const m = this.host.game.st.map;
    for (let ty = Math.max(0, Math.floor((y-range)/TILE)); ty <= Math.min(m.h-1, Math.floor((y+range)/TILE)); ty++) {
      for (let tx = Math.max(0, Math.floor((x-range)/TILE)); tx <= Math.min(m.w-1, Math.floor((x+range)/TILE)); tx++) {
        if (m.terrain[ty*m.w+tx] === Terrain.Forest && ((tx+.5)*TILE-x)**2 + ((ty+.5)*TILE-y)**2 <= range**2) return true;
      }
    }
    return false;
  }
  /** Source initial/movement/rank/morale/target-size/range accuracy, in percent. */
  sourceAccuracy(entity: Ent, target?: Ent): number | undefined {
    const cfg = this.config(entity)?.sourceCombat, s = this.ensure(entity)?.combat;
    if (!cfg || !s) return;
    const xp = s.armorKills > 5 ? 10 : s.armorKills > 3 ? 5 : 0;
    const morale = s.morale <= 50 ? -15 : s.morale >= 70 ? 10 : 0;
    const moving = Math.hypot(entity.x-entity.prevX, entity.y-entity.prevY) > .01 ? cfg.movingAccuracy : 0;
    const radius = target ? this.config(target)?.sourceRadius : undefined;
    const size = radius === undefined ? 0 : radius < 12 ? -10 : radius > 14 ? 10 : 0;
    const distance = target ? Math.hypot(entity.x-target.x, entity.y-target.y) : Infinity;
    const range = distance <= cfg.range / 3 ? 20 : distance <= cfg.range / 1.5 ? 10 : 0;
    const forest = target && this.nearForest(target.x, target.y, 60) ? -20 : 0;
    return cfg.baseAccuracy + xp + morale + moving + size + range + forest;
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
    this.warmup.shot(entity,weapon);
    const payload = this.host.config<ComponentPayload>(weapon);
    if (payload) {
      projectile.id ??= this.host.game.st.nextProjId++;
      this.shots.set(projectile, { payload, startX: entity.x, startY: entity.y });
      this.ballistics.launch(entity,projectile);
    }
  }
  /** Pure face policy with only optional-match callers. Angles are radians at runtime. */
  resolveProtection(entity: Ent, payload: ComponentPayload, bearing: number, distance: number, armorKills = 0): ProtectionResult {
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
    const penetration = Math.max(0, payload.penetration + a + b * range + c * range * range) * this.host.game.st.rng.range(payload.experience && payload.family === 'kinetic' ? .95 + (armorKills / 10 < .15 ? armorKills / 100 : .15) : payload.jitter[0], payload.jitter[1]);
    const armor = cfg?.incidence ? nominal / Math.max(1e-6, cosine) : nominal;
    const penetrated = !ricochet && (!payload.positiveArmor || armor > 0) && penetration > armor;
    // A sector's physical layer loses the same share of all its protection families.
    if (!ricochet && payload.wear > 0) for (const layer of Object.values(state.layers)) layer[payload.wearFaces?.[face] ?? face] *= 1 - payload.wear;
    return { handled: true, face, penetrated, ricochet, penetration, effectiveArmor: armor, residual: penetrated && penetration > 0 ? (penetration - armor) / penetration : 0 };
  }
  allocateHelperIdentity():number { return this.host.game.st.nextId+this.logicalHelpers++; }
  bindHelperIdentity(projectile:Proj,id:number,componentOnly=false):void {
    const weapon=projectile.gun?this.weapon(projectile.gun):undefined,payload=weapon&&this.host.config<ComponentPayload>(weapon);
    if(!payload?.sourceHelper)return;
    this.shots.set(projectile,{payload:componentOnly?{...payload,hpPhases:[],spawned:undefined}:payload,startX:projectile.px,startY:projectile.py,helper:{id,weak:1}});
  }
  private prepareHelper(projectile: Proj, payload: ComponentPayload): void {
    if (!payload.sourceHelper) return;
    let shot = this.shots.get(projectile);
    if (shot?.helper) { this.weakImpacts.set(projectile, shot.helper.weak); return; }
    const st = this.host.game.st;
    // Native creations and logical helper creations share a monotonic source
    // identity sequence, while native Uint16 occupancy IDs remain untouched.
    const id = this.allocateHelperIdentity(), source = st.ents.get(projectile.src ?? 0);
    let weak = 1;
    if (payload.sourceWeak && source) {
      const accuracy = this.sourceAccuracy(source, st.ents.get(source.targetId));
      const roll = Math.floor(st.rng.range(0, payload.sourceWeak.roll)) * (payload.sourceWeak.helperParity ? id % 2 + 1 : 1);
      if (accuracy !== undefined && accuracy !== 0 && accuracy < roll) weak = payload.sourceWeak.multiplier;
    }
    shot ??= { payload, startX: projectile.px, startY: projectile.py };
    shot.helper = { id, weak }; this.shots.set(projectile, shot); this.weakImpacts.set(projectile, weak);
  }
  private payloadAt(gun:string,branch:number):ComponentPayload|undefined {
    const weapon=this.weapon(gun),root=weapon&&this.host.config<ComponentPayload>(weapon);
    return branch<0?root:root?.spawned?.[branch]?.payload;
  }
  private hpDamage(projectile:Proj,phase:HpPhase,kind:'direct'|'area',entity:Ent,amount:number,forest=false):void {
    const previous=this.activeHp;this.activeHp={projectile,phase,kind,forest};
    try{this.host.applyDamage(this.host.game.st,entity,amount,projectile.mult,projectile.owner,projectile.src,projectile.gun);}finally{this.activeHp=previous;}
  }
  private stepWave(wave:HpWave,dt:number):boolean {
    const payload=this.payloadAt(wave.gun,wave.branch),phase=payload?.hpPhases?.[wave.phase];if(!phase?.expand)return true;
    wave.age=Math.min(phase.expand,wave.age+dt);
    const radius=wave.forest&&phase.forest?payload!.blast!.forest!.radius:phase.radius;
    const p:Proj={x:wave.x,y:wave.y,px:wave.x,py:wave.y,tx:wave.x,ty:wave.y,angle:wave.angle,speed:0,ttl:0,kind:'flame',homing:false,targetId:0,dmg:0,splash:0,owner:wave.owner,team:this.host.game.st.players[wave.owner]?.team??-1,src:wave.source,gun:wave.gun,hitsAir:wave.air,hitsSub:false,hitsGround:true};
    for(const {entity,multiplier}of sourceAreaVictims(this.host,{x:wave.x,y:wave.y,radius:radius*wave.age/phase.expand,fullRadius:radius,owner:wave.owner,hits:wave.hits,fromEdge:phase.fromEdge,air:wave.air,friendly:phase.friendly}))
      this.hpDamage(p,phase,'area',entity,phase.area*wave.scale*(phase.noFalloff?1:multiplier),wave.forest&&!!phase.forest);
    return wave.age>=phase.expand;
  }
  private applyHpPhases(projectile:Proj,direct:Ent|null,payload:ComponentPayload,scale:number):void {
    for(const [index,phase]of (payload.hpPhases??[]).entries()){
      const forest=!!phase.forest&&!!payload.blast?.forest&&this.nearForest(projectile.x,projectile.y,payload.blast.forest.search);
      if(phase.direct>0&&direct&&!phase.targetGround&&!direct.dead)this.hpDamage(projectile,phase,'direct',direct,phase.direct*scale,forest);
      if(phase.area<=0||phase.radius<=0)continue;
      if(phase.expand){
        const wave:HpWave={gun:projectile.gun!,branch:this.shots.get(projectile)?.variant?.index??-1,phase:index,x:projectile.x,y:projectile.y,angle:projectile.angle,owner:projectile.owner,source:projectile.src??0,scale,age:0,hits:[],air:projectile.hitsAir,forest};
        if(!this.stepWave(wave,this.projectileDt))this.waves.push(wave);
      }else{
        const radius=forest?payload.blast!.forest!.radius:phase.radius;
        for(const {entity,multiplier}of sourceAreaVictims(this.host,{x:projectile.x,y:projectile.y,radius,fullRadius:radius,owner:projectile.owner,fromEdge:phase.fromEdge,air:projectile.hitsAir,friendly:phase.friendly}))
          this.hpDamage(projectile,phase,'area',entity,phase.area*scale*(phase.noFalloff?1:multiplier),forest);
      }
    }
  }
  private launchFragment(parent:Proj,index:number,branch:number,offset:number):void {
    const payload=parent.gun?this.payloadAt(parent.gun,branch)?.fragments?.rounds[index]:undefined;if(!payload)return;
    const p:Proj={...parent,id:this.host.game.st.nextProjId++,px:parent.x,py:parent.y,targetId:0,tx:offset?parent.x+Math.cos(parent.angle)*offset:parent.tx,ty:offset?parent.y+Math.sin(parent.angle)*offset:parent.ty,kind:'bullet',dmg:0,splash:0,force:false,mult:undefined,arc:undefined};
    this.shots.set(p,{payload,startX:parent.x,startY:parent.y,variant:{kind:'fragment',index},branch});
    this.ballistics.launch(undefined,p,this.ballistics.visual(parent)?.altitude??0);this.host.game.st.projs.push(p);
  }
  private fragments(projectile:Proj,payload:ComponentPayload,result:ProtectionResult):void {
    const f=payload.fragments;if(!f)return;
    const shot=this.shots.get(projectile),branch=shot?.variant?.kind==='helper'?shot.variant.index:shot?.branch??-1;
    if(result.ricochet){if(f.ricochet!==undefined)this.launchFragment(projectile,2,branch,f.ricochet);return;}
    if(result.effectiveArmor<=0)return;
    const count=result.penetrated?f.penetrated:f.blocked;for(let i=0;i<count;i++)this.launchFragment(projectile,0,branch,f.offset);
  }
  private spawnHelpers(projectile:Proj,payload:ComponentPayload):void {
    for(const [index,child]of (payload.spawned??[]).entries()){
      const x=projectile.x+child.x,y=projectile.y+child.y;
      const p:Proj={...projectile,id:this.host.game.st.nextProjId++,x,y,px:x,py:y,tx:x,ty:y,kind:'flame',burn:undefined,burnLife:undefined,dmg:0,splash:child.payload.blast?.radius??0,ttl:0,targetId:0,force:child.payload.friendlyFire??false};
      this.shots.set(p,{payload:child.payload,startX:projectile.px,startY:projectile.py,variant:{kind:'helper',index}});
      this.host.resolveImpact(this.host.game.st,this.host.game.hash,p,null);
    }
  }
  /** RW helper recipients are selected once at impact, by distance then stable ID. */
  wrapImpact(next: ModuleHost['resolveImpact']): ModuleHost['resolveImpact'] {
    return (st, hash, projectile, direct, terrain) => {
      const weapon = projectile.gun ? this.weapon(projectile.gun) : undefined;
      const payload = this.shots.get(projectile)?.payload ?? (weapon ? this.host.config<ComponentPayload>(weapon) : undefined);
      if(payload?.incoming && projectile.ttl<=0 && !payload.incoming.end){this.aps.afterImpact(projectile);return;}
      if (payload) this.prepareHelper(projectile, payload);
      this.componentVisits.set(projectile,new Set());
      if (payload?.friendlyFire !== undefined) projectile.force = payload.friendlyFire;
      if (payload?.blast?.forest && this.nearForest(projectile.x, projectile.y, payload.blast.forest.search)) projectile.splash = payload.blast.forest.radius;
      const originalDamage=projectile.dmg,scale=this.shots.get(projectile)?.variant?1:weapon?.dmg?originalDamage/weapon.dmg:1;
      const native=()=>{if(payload?.hpPhases)projectile.dmg=0;try{next(st,hash,projectile,direct,terrain);}finally{projectile.dmg=originalDamage;}};
      const finish=()=>{
        if(payload?.blast){const radius=payload.blast.forest&&this.nearForest(projectile.x,projectile.y,payload.blast.forest.search)?payload.blast.forest.radius:payload.blast.radius;
          for(const e of this.host.participants())if(!e.dead&&!e.inside&&this.config(e)?.blast&&!this.componentVisits.get(projectile)?.has(e.id)&&Math.hypot(e.x-projectile.x,e.y-projectile.y)<=radius&&(payload.friendlyFire||st.players[e.owner]?.team!==projectile.team))this.host.applyDamage(st,e,0,undefined,projectile.owner,projectile.src,projectile.gun);
        }
        if(payload?.hpPhases)this.applyHpPhases(projectile,direct,payload,scale);
        this.componentVisits.delete(projectile);
        if(payload?.spawned)this.spawnHelpers(projectile,payload);
        this.aps.afterImpact(projectile);
      };
      const policy = payload?.recipient;
      if (!policy) { native(); finish(); return; }
      let recipient: Ent | undefined, nearest = policy.range ** 2;
      for (const e of this.host.participants()) {
        const cfg = this.config(e);
        if (!cfg?.sourceRadius || e.dead || e.inside || st.players[e.owner]?.team === projectile.team) continue;
        const distance = (e.x - projectile.x) ** 2 + (e.y - projectile.y) ** 2;
        if (distance < nearest || distance === nearest && (!recipient || e.id < recipient.id)) { nearest = distance; recipient = e; }
      }
      if (recipient && nearest > policy.radiusSquared * this.config(recipient)!.sourceRadius! ** 2) recipient = undefined;
      const state = { id: recipient?.id ?? 0, visited: false };
      this.impactRecipients.set(projectile, state);
      try {
        native();
        // The source's nearest-unit check can reach past the native blast/body radius.
        if (recipient && !state.visited && !recipient.dead) this.host.applyDamage(st, recipient, 0, undefined, projectile.owner, projectile.src, projectile.gun);
      } finally { this.impactRecipients.delete(projectile); finish(); }
    };
  }
  wrapDamage(next: ModuleHost['applyDamage']): ModuleHost['applyDamage'] {
    return (st, target, raw, mult, owner, sourceId = 0, gun = '', from, hit) => {
      if(this.internalHull){next(st,target,raw,mult,owner,sourceId,gun,from,hit);return;}
      const impact = this.host.currentImpact, projectile = this.activeHp?.projectile??impact?.projectile;
      const shot = projectile ? this.shots.get(projectile) : undefined, weapon = this.weapon(gun);
      const payload = shot?.payload ?? (weapon ? this.host.config<ComponentPayload>(weapon) : undefined);
      if (payload && projectile && !this.activeHp) this.prepareHelper(projectile, payload);
      const cfg = this.config(target), state = cfg ? this.ensure(target) : undefined;
      const forest = payload?.blast?.forest;
      if (this.activeHp?.forest && cfg?.sourceArmor?.tags.includes('soldiers')) raw *= .5;
      else if(!this.activeHp && projectile && forest && cfg?.sourceInfantry && this.nearForest(projectile.x, projectile.y, forest.search)) raw *= forest.infantry;
      const hpPass=this.activeHp??(projectile?this.hpPass.get(projectile):undefined);
      const ordinary = (): void => {
        if(hpPass){
          const armor=cfg?.sourceArmor,tags=armor?.tags??[],phase=hpPass.phase;
          const multiplier=phase.mutators.reduce((v,m)=>v*((!m.with.length||m.with.some(t=>tags.includes(t)))&&!m.without.some(t=>tags.includes(t))?m[hpPass.kind]:1),1);
          const amount=raw*multiplier,damage=armor&&amount>0?Math.max(Math.min(armor.minimum,amount),amount-Math.max(0,armor.armor-phase.ignore)):amount;
          next(st,target,damage,armor?undefined:mult,owner,sourceId,gun,from);return;
        }
        if (cfg?.sourceArmor && payload?.ordinary) {
          const armor = cfg.sourceArmor, p = payload.ordinary;
          const multiplier = p.multipliers.reduce((value, m) => value * (armor.tags.includes(m.tag) ? m.value : 1), 1);
          const damage = raw > 0 ? Math.max(Math.min(armor.minimum, raw * multiplier), raw * multiplier - Math.max(0, armor.armor - p.ignore)) : 0;
          next(st, target, damage, undefined, owner, sourceId, gun, from);
        } else next(st, target, raw, mult, owner, sourceId, gun, from, hit);
      };
      if(hpPass){ordinary();return;}
      if (!payload || !projectile || !cfg || !state || target.dead || target.locked) {
        ordinary(); return;
      }
      const visited=this.componentVisits.get(projectile);
      if(visited?.has(target.id)){next(st,target,0,undefined,owner,sourceId,gun,from);return;}
      visited?.add(target.id);
      if (state.terminal) { next(st, target, 0, undefined, owner, sourceId, gun, from); return; }
      if (cfg.protection && !cfg.protection.families[payload.family]) { ordinary(); return; }
      if (!cfg.protection && !cfg.parts.length) { ordinary(); return; }
      const distance = Math.hypot(projectile.x - target.x, projectile.y - target.y);
      const recipient = this.impactRecipients.get(projectile);
      if (recipient?.id === target.id) recipient.visited = true;
      const direct = recipient ? recipient.id === target.id : impact?.direct === target || distance <= getDef(target.defId).radius + 10;
      const blastRadius = payload.blast?.forest && this.nearForest(projectile.x, projectile.y, payload.blast.forest.search) ? payload.blast.forest.radius : payload.blast?.radius;
      const blast = payload.blast && cfg.blast && distance <= blastRadius! ? payload.blast : undefined;
      if (!direct && !blast) {
        next(st, target, payload.collateralHullDamage ?? raw, payload.collateralHullDamage === undefined ? mult : undefined, owner, sourceId, gun, from, hit); return;
      }
      const start = payload.rangeOrigin === 'source' && st.ents.get(sourceId) ? { startX: st.ents.get(sourceId)!.x, startY: st.ents.get(sourceId)!.y }
        : shot ?? { startX: from?.x ?? projectile.px, startY: from?.y ?? projectile.py };
      const source = st.ents.get(sourceId);
      const bearing = payload.bearingOrigin === 'source' && source ? Math.atan2(target.y-source.y, target.x-source.x) : projectile.angle;
      const sourceCombat = payload.experience ? (st.ents.get(sourceId) && this.ensure(st.ents.get(sourceId)!)?.combat) : undefined;
      const result = (!direct && blast || blast && !blast.penetration && !blast.combined) ? { handled: true, face: this.face(target, projectile.angle, payload.top), penetrated: true, residual: 1 }
        : this.resolveProtection(target, payload, bearing, Math.hypot(projectile.x - start.startX, projectile.y - start.startY), sourceCombat?.armorKills ?? 0);
      if (!result.handled) { next(st, target, raw, mult, owner, sourceId, gun, from, hit); return; }
      if(direct&&'effectiveArmor' in result)this.fragments(projectile,payload,result as ProtectionResult);
      if (state.repair && payload.interruptRepair !== false) state.repair.progress *= cfg.repairHitRetention;
      if (!result.penetrated && !blast?.combined) { next(st, target, 0, undefined, owner, sourceId, gun, from); return; }
      if (state.group && payload.interruptRepair !== false && direct && result.penetrated && (!blast || blast.combined)) {
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
        if (state.combat) state.combat.morale = Math.max(0, state.combat.morale - 10 * (state.combat.steadfast ? .5 : 1));
        this.hurtReserve(cfg, state, this.blastDamage(cfg.reserve?.blast, cfg.reserve?.damageHp ?? 0, pressure, blast.yield) * fraction, blast.poolCountOffset);
      }
      if (direct && result.penetrated && (!blast || blast.combined)) {
        const residual = payload.residual ? clamp(payload.residual.base + payload.residual.scale * result.residual, 0, payload.residual.max) : 1;
        let weak = this.weakImpacts.get(projectile);
        if (weak === undefined) {
          weak = payload.weakHit && st.rng.chance(payload.weakHit.chance) ? payload.weakHit.multiplier : 1;
          if (payload.sourceWeak && source) {
            const accuracy = this.sourceAccuracy(source, st.ents.get(source.targetId));
            if (accuracy !== undefined && accuracy !== 0 && accuracy < Math.floor(st.rng.range(0, payload.sourceWeak.roll))) weak = payload.sourceWeak.multiplier;
          }
          this.weakImpacts.set(projectile, weak);
        }
        const damage = (channelId: string, exposure: Faces, partId = channelId): number => {
          const channel = payload.channels[partId] ?? payload.channels[channelId]; if (!channel) return 0;
          const ranges = channel.faces?.[result.face] ?? channel;
          const strong = st.rng.chance(clamp(exposure[payload.exposureFace ?? result.face] * payload.diameter * (payload.channelScale?.[partId] ?? 1) + (sourceCombat?.armorKills ?? 0) / 45, 0, 1));
          return payload.strength * st.rng.range(...(strong ? ranges.strong : ranges.weak)) * residual * fraction * weak;
        };
        for (const part of cfg.parts) {
          if (state.parts[part.id].damage >= (part.damageLimit ?? part.hp)) continue;
          this.hurt(target, part, state.parts[part.id], damage(part.channel, part.exposure, part.id), owner, sourceId, gun);
          if (target.dead) break;
        }
        if (cfg.reserve) {
          const reserveDamage = damage(cfg.reserve.channel, cfg.reserve.exposure);
          if (state.combat) state.combat.morale = Math.max(0, state.combat.morale - reserveDamage * (state.combat.steadfast ? .5 : 1));
          this.hurtReserve(cfg, state, reserveDamage, 0);
        }
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
    } else if (part.failure?.hullDamage) {this.internalHull++;try{this.host.applyDamage(this.host.game.st, entity, part.failure.hullDamage, undefined, owner, sourceId, '', undefined);}finally{this.internalHull--;}}
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
    if (state.combat && state.combat.morale < 20) for (const w of definition.weapons) disabled.add(w.id);
    if (state.terminal) { speed = 0; turn = 0; for (const w of definition.weapons) disabled.add(w.id); }
    if (state.group?.progress) { speed = 0; turn = 0; }
    if (cfg.clearOrdersWhenImmobile && speed === 0) turn = 0;
    if (state.abandoning !== undefined || state.crew || (state.repair && cfg.parts.find(p => p.id === state.repair!.part)?.repairs?.[state.repair.policy].stationary)) speed = 0;
    const vision = cfg.commander && state.reserve && state.commanderLost ? Math.max(0, definition.vision - cfg.commander.visionPenalty) : definition.vision;
    if (speed === 1 && turn === 1 && reloadAdd === 0 && !disabled.size && vision === definition.vision) return definition;
    return { ...definition, vision, speed: definition.speed * speed, turnRate: definition.turnRate * turn, weapons: definition.weapons.map(w => disabled.has(w.id)
      ? { ...w, targets: [] }
      : reloadAdd ? { ...w, reload: w.reload * Math.max(0.1, 1 + reloadAdd) } : w) };
  }
  canFire(entity: Ent, _def: UnitDef, weapon: WeaponDef, point:{x:number;y:number}=entity, target:Ent|null=null): boolean {
    const cfg = this.config(entity), state = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !state) return this.warmup.canFire(entity,_def,weapon,point,target);
    if (state.combat && state.combat.morale < 20) return false;
    if (state.terminal || (state.reserve?.count === 0 && cfg.reserve?.empty?.disableWeapons?.includes(weapon.id))) return false;
    for (const p of cfg.parts) {
      const effects = this.effect(p, state.parts[p.id]);
      if (effects?.disableWeapons?.includes(weapon.id)) return false;
    }
    return this.warmup.canFire(entity,_def,weapon,point,target);
  }
  private eligible(entity: Ent, part: PartDef, policy: RepairPolicy, state: ComponentsState): boolean {
    const p = state.parts[part.id];
    if (!p || p.damage / part.hp < policy.fromDamage || p.damage >= (policy.accrueToStockThreshold ? this.threshold(entity, part) : part.hp * (policy.untilDamage ?? Infinity)) || (part.crew && !p.occupant)) return false;
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
      if(this.applyAchievements(e,cfg,s))continue;
      if (s.terminal) { s.terminal.remaining -= dt; if (s.terminal.remaining <= 0) kill(st, e, s.terminal.owner, 'killed', s.terminal.gun, 0, s.terminal.sourceId); continue; }
      if (e.site || e.inside || e.emp) continue;
      if (s.abandoning !== undefined && cfg.abandon) {
        s.abandoning += dt;
        if (s.abandoning >= cfg.abandon.seconds) { kill(st, e); continue; }
      }
      if (cfg.commander && s.reserve) {
        if (cfg.commander.seat) s.commanderLost = !s.parts[cfg.commander.seat].occupant;
        else if (s.reserve.count === cfg.commander.reserveThreshold) s.commanderLost = true;
        else if (s.reserve.count > cfg.commander.reserveThreshold) s.commanderLost = false;
      }
      if (cfg.sourceCombat && s.combat) {
        const combat = s.combat, interval = cfg.sourceCombat.interval;
        const quietBefore = combat.quiet;
        combat.quiet = Math.min(1e9, combat.quiet + dt);
        combat.remainder += dt;
        const quanta = Math.floor((combat.remainder+1e-9)/interval);
        combat.remainder -= quanta*interval;
        if (!e.targetId && Math.hypot(e.x-e.prevX, e.y-e.prevY) <= .01) {
          const eligible = Math.min(quanta, Math.max(0, Math.floor((combat.quiet-3+1e-9)/interval) - Math.max(0, Math.floor((quietBefore-3+1e-9)/interval))));
          const kills = combat.armorKills + combat.airKills, ceiling = kills > 5 ? 100 : kills > 3 ? 80 : 60;
          const previous = combat.morale;
          if (combat.morale <= ceiling) combat.morale = Math.min(ceiling+1, combat.morale + eligible);
          if (previous <= 100 && combat.morale >= 100) combat.steadfast = true;
        }
      }
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
            delete from.occupant; from.damage = f.hp * (cfg.crew.vacatedDamage ?? 1) + (cfg.crew.vacatedExtra ?? 0); from.failed = true; delete s.crew;
          }
        }
      }
    }
  }
  private applyAchievements(e:Ent,cfg:ComponentsDef,s:ComponentsState):boolean {
    for(const a of cfg.achievements??[]){
      const value=a.counter==='kills'?e.kills:a.counter==='armor'?s.combat?.armorKills:s.combat?.airKills;
      if(value===undefined||value<a.threshold||this.achievements.get(e.owner)?.has(a.id))continue;
      const next=a.to&&DEFS[a.to],nextCfg=next&&this.host.config<ComponentsDef>(next);
      if(a.to&&(!next||!nextCfg||next.kind!==getDef(e.defId).kind||nextCfg.parts.length!==cfg.parts.length||nextCfg.parts.some(p=>!s.parts[p.id])))continue;
      let global=this.achievements.get(e.owner);if(!global){global=new Set();this.achievements.set(e.owner,global);}global.add(a.id);(s.achievements??=[]).push(a.id);
      if(next&&nextCfg){
        const old=getDef(e.defId),health=e.hp/old.hp,cooldowns=new Map(old.weapons.map((w,i)=>[w.id,e.wcd[i]??0]));
        setEntityDef(e,next.id);e.hp=health*next.hp;e.wcd=next.weapons.map(w=>cooldowns.get(w.id)??0);
        // RW custom conversion retains memory, resources, turret clocks and
        // waypoints; the action queue is cleared. No fresh crew or ERA appears.
        s.form=e.defId;delete s.crew;delete s.repair;delete s.abandoning;
        this.host.game.recomputePop();this.host.game.recomputePower();return true;
      }
    }return false;
  }
  private needsManual(entity: Ent, cfg: ComponentsDef, s: ComponentsState): boolean {
    return cfg.parts.some(p => p.repairs?.some(q => !q.auto && s.parts[p.id].damage >= p.hp * q.fromDamage && s.parts[p.id].damage < (q.accrueToStockThreshold ? this.threshold(entity, p) : p.hp * (q.untilDamage ?? Infinity)) && (!p.crew || s.parts[p.id].occupant)));
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
    if (tasks.some(({ p, q }) => q.startAbove === undefined || s.parts[p.id].damage > p.hp * q.startAbove)) g.progress = Math.min(1e9, g.progress + quanta * policy.interval);
    const ready = tasks.find(({ p, q }) => g.progress + 1e-8 >= q.seconds && s.parts[p.id].damage < p.hp * (q.untilDamage ?? Infinity));
    if (ready) {
      const p = s.parts[ready.p.id]; p.damage = ready.q.toDamage * ready.p.hp; p.failed = false; delete p.latched; g.progress = 0;
    }
    if (g.manual && policy.finishBelow !== undefined && cfg.parts.every(p => s.parts[p.id].damage < p.hp * policy.finishBelow!) && this.provider(e, policy.provider, policy.range)) {
      for (const p of cfg.parts) { s.parts[p.id].damage = 0; s.parts[p.id].failed = false; delete s.parts[p.id].latched; }
      if (policy.refillProtection) s.layers = plain(cfg.protection?.layers ?? {});
      g.manual = false; g.progress = 0;
    }
    if (g.manual && policy.finishBelow === undefined && !this.needsManual(e, cfg, s)) { g.manual = false; g.progress = 0; }
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
      if (!cfg || !state || state.terminal || state.abandoning !== undefined && order.action !== 'cancel') continue;
      if (order.action === 'smoke' || order.action === 'engine-smoke') { done = this.smoke.order(e, order.action) || done; continue; }
      if (order.action === 'cancel') { done ||= state.abandoning !== undefined; delete state.abandoning; done ||= !!state.repair || !!state.crew || !!state.group?.manual; delete state.repair; delete state.crew; if (state.group) { state.group.manual = false; state.group.progress = 0; } }
      else if (order.action === 'abandon' && cfg.abandon && !state.reserve?.count && cfg.parts.some(p => p.crew && !state.parts[p.id].occupant) && state.abandoning === undefined) { state.abandoning = 0; done = true; }
      else if (order.action === 'repair' && cfg.repairGroup && state.group && (!order.choice || order.choice === 'group')) {
        if (this.needsManual(e, cfg, state) && this.provider(e, cfg.repairGroup.provider, cfg.repairGroup.range)) { state.group.manual = true;
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
    const aps=this.aps.counts(entity);
    if(aps)rows.push({id:'aps',label:['Active protection rounds','主动防御拦截弹','능동방호 요격탄'],value:aps.join(' + ')});
    if (cfg.sourceCombat && s.combat) {
      rows.push({ id: 'morale', label: cfg.sourceCombat.label, value: s.combat.morale, fraction: Math.min(1, s.combat.morale/100), tone: s.combat.morale < 20 ? 'danger' : s.combat.morale < 40 ? 'warning' : 'normal' });
      rows.push({ id: 'armor-kills', label: ['Armored kills', '装甲击杀', '장갑차량 격파'], value: s.combat.armorKills });
      rows.push({ id: 'air-kills', label: ['Aircraft kills', '空军击杀', '항공기 격추'], value: s.combat.airKills });
    }
    if (cfg.reserve && s.reserve) rows.push({ id: 'reserve-pool', label: cfg.reserve.label, value: s.reserve.count, fraction: cfg.reserve.capacity ? s.reserve.count / cfg.reserve.capacity : 0, tone: s.reserve.count ? 'normal' : 'danger' });
    for(const id of s.achievements??[]){const a=Object.values(DEFS).flatMap(d=>this.host.config<ComponentsDef>(d)?.achievements??[]).find(a=>a.id===id);if(a)rows.push({id:a.id,label:a.label});}
    rows.push(...this.smoke.inspect(entity));
    return rows;
  }
  actions(entity: Ent): ModuleAction[] {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s || s.terminal) return [];
    const smoke = this.smoke.actions(entity);
    if (s.abandoning !== undefined || s.repair || s.crew || s.group?.manual) return [{ id: 'cancel', label: t('module.cancel'), enabled: true }, ...smoke];
    const repairs = cfg.parts.flatMap(p => (p.repairs ?? []).map((q, i) => ({ p, q, i }))).filter(({ p, q }) => this.eligible(entity, p, q, s));
    const choices = cfg.crew?.replacements.filter(p => (!cfg.crew?.requiresEmptyReserve || !s.reserve?.count) && s.parts[p.from]?.occupant && !s.parts[p.to]?.occupant).map(p => ({ id: `${p.from}/${p.to}`, label: `${pick(cfg.parts.find(x => x.id === p.from)!.label)} → ${pick(cfg.parts.find(x => x.id === p.to)!.label)}` })) ?? [];
    return [
      ...(cfg.abandon && !s.reserve?.count && cfg.parts.some(p => p.crew && !s.parts[p.id].occupant) ? [{ id: 'abandon', label: cfg.abandon.label, enabled: true }] : []),
      ...(cfg.repairGroup && this.needsManual(entity, cfg, s) && this.provider(entity, cfg.repairGroup.provider, cfg.repairGroup.range) ? [{ id: 'repair', label: t('module.repair'), enabled: true, choices: [{ id: 'group', label: t('module.repair') }] }] : []),
      ...(!cfg.repairGroup && repairs.length ? [{ id: 'repair', label: t('module.repair'), enabled: true, choices: repairs.map(({ p, i }) => ({ id: `${p.id}/${i}`, label: p.label })) }] : []),
      ...(choices.length ? [{ id: 'reassign', label: t('module.reassign'), enabled: true, choices }] : []),
      ...smoke,
    ];
  }
  needsRefill(entity: Ent, which: 'crew' | 'protection'): boolean {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s || s.terminal) return false;
    if (which === 'protection') return this.aps.needsRefill(entity) || Object.entries(cfg.protection?.layers ?? {}).some(([family, faces]) => FACES.some(face => s.layers[family][face] < faces[face]));
    if (cfg.reserve && s.reserve) return s.reserve.count < cfg.reserve.capacity || cfg.parts.some(p => p.crew && !s.parts[p.id].occupant);
    return cfg.parts.some(p => p.crew && s.parts[p.id].damage > 0);
  }
  refill(entity: Ent, which: 'crew' | 'protection'): boolean {
    const cfg = this.config(entity), s = cfg ? this.ensure(entity) : undefined;
    if (!cfg || !s) return false;
    if (which === 'protection') { s.layers = plain(cfg.protection?.layers ?? {}); this.aps.replenish(entity); }
    else if (cfg.reserve && s.reserve) {
      s.reserve.count = cfg.reserve.refillCount ?? cfg.reserve.capacity; s.reserve.health = cfg.reserve.capacity * cfg.reserve.hpPerMember; s.reserve.progress = 0;
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
      if (s && p.id !== undefined) projectiles.push({ id: p.id, startX: s.startX, startY: s.startY, ...(s.helper ? { helper: s.helper } : {}),...(s.variant?{variant:s.variant,branch:s.branch??-1}:{}) });
    }
    const visuals:Json[]=[];
    if(view)for(const p of this.host.game.st.projs){const s=this.shots.get(p);if(p.id!==undefined&&view.visibleProjectiles.has(p.id)&&s?.variant)visuals.push({id:p.id,variant:s.variant,branch:s.branch??-1});}
    const achievements:Record<string,Json>={};for(const[owner,ids]of this.achievements)if(!view||view.player===owner)achievements[owner]=[...ids];
    const movement=this.movement.snapshot(view) as Record<string,Json>;
    const warmup=this.warmup.snapshot(view) as Record<string,Json>;
    const motion=this.ballistics.snapshot(view) as Json[];
    const aps=this.aps.snapshot(view) as Record<string,Json>;
    const smoke=this.smoke.snapshot(view) as Record<string,Json>;
    return { entities: out, projectiles, ...(Object.keys(achievements).length?{achievements}:{}), ...(Object.keys(movement).length?{movement}:{}), ...(Object.keys(warmup).length?{warmup}:{}), ...(visuals.length?{visuals}:{}), ...(motion.length?{motion}:{}), ...(!view&&this.waves.length?{waves:plain(this.waves) as unknown as Json}:{}), ...(!view&&this.logicalHelpers ? {logicalHelpers:this.logicalHelpers} : {}), ...(Object.values(aps).some(v=>v&&typeof v==='object'&&Object.keys(v).length) ? {aps} : {}), ...(!view&&((smoke.serial as number)||(['units','markers','flights','strikes'] as const).some(k=>(smoke[k] as Json[]).length)) ? {smoke} : {}) };
  }
  restore(value: unknown): void {
    if (!object(value) || !only(value, ['entities', 'projectiles', 'aps', 'smoke', 'logicalHelpers','waves','motion','visuals','warmup','movement','achievements']) || !object(value.entities) || Object.keys(value.entities).length > this.host.game.st.ents.size || !Array.isArray(value.projectiles) || value.projectiles.length > this.host.game.st.projs.length) throw new Error('Invalid component state');
    if(value.logicalHelpers!==undefined&&(!Number.isSafeInteger(value.logicalHelpers)||(value.logicalHelpers as number)<0))throw new Error('Invalid logical source identity sequence');
    const logicalHelpers=(value.logicalHelpers as number|undefined)??0;
    this.warmup.restore(value.warmup??{});
    this.movement.restore(value.movement??{});
    const achievementIds=new Set(Object.values(DEFS).flatMap(d=>this.host.config<ComponentsDef>(d)?.achievements?.map(a=>a.id)??[]));
    const completed=new Map<number,Set<string>>();
    if(value.achievements!==undefined){if(!object(value.achievements))throw Error('Invalid source achievements');for(const[key,raw]of Object.entries(value.achievements)){const owner=Number(key);if(!Number.isInteger(owner)||String(owner)!==key||!this.host.game.st.players[owner]||!Array.isArray(raw)||new Set(raw).size!==raw.length||raw.some(id=>typeof id!=='string'||!achievementIds.has(id)))throw Error('Invalid source achievement owner');completed.set(owner,new Set(raw as string[]));}}
    const next = new Map<number, ComponentsState>();
    const occupants = new Set<string>();
    for (const [key, raw] of Object.entries(value.entities)) {
      const id = Number(key), entity = this.host.game.st.ents.get(id), cfg = entity ? this.config(entity) : undefined;
      if (!Number.isSafeInteger(id) || String(id) !== key || !entity || !cfg || !object(raw) || !only(raw, ['form', 'achievements', 'parts', 'layers', 'repair', 'crew', 'reserve', 'group', 'terminal', 'abandoning', 'combat', 'credited', 'commanderLost']) || raw.form !== entity.defId || !object(raw.parts) || !object(raw.layers)) throw new Error('Invalid component entity');
      if(raw.achievements!==undefined&&(!Array.isArray(raw.achievements)||new Set(raw.achievements).size!==raw.achievements.length||raw.achievements.some(id=>typeof id!=='string'||!achievementIds.has(id))))throw Error('Invalid source unit achievements');
      if (Object.keys(raw.parts).length !== cfg.parts.length) throw new Error('Invalid component membership');
      for (const p of cfg.parts) {
        const ps = raw.parts[p.id];
        if (!object(ps) || !only(ps, ['damage', 'failed', 'occupant', 'latched']) || !number(ps.damage, p.stockThreshold ? -1e6 : 0, p.damageLimit ?? p.hp) || typeof ps.failed !== 'boolean' || (!p.stockThreshold && ps.failed !== (p.strict ? ps.damage > p.hp : ps.damage >= p.hp)) || (ps.latched !== undefined && (!p.latchDamaged || typeof ps.latched !== 'boolean'))) throw new Error('Invalid component damage');
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
        if (!object(q) || !only(q, ['count', 'health', 'progress', 'serial']) || !number(q.count, 0, cfg.reserve.refillCount ?? cfg.reserve.capacity) || !Number.isInteger(q.count) || !number(q.health, -1e6, cfg.reserve.capacity * cfg.reserve.hpPerMember) || !number(q.progress, 0, cfg.reserve.seconds) || !Number.isSafeInteger(q.serial) || (q.serial as number) < 0) throw new Error('Invalid reserve pool');
      } else if (raw.reserve !== undefined) throw new Error('Unexpected reserve pool');
      if (cfg.repairGroup) {
        const q = raw.group;
        if (!object(q) || !only(q, ['manual', 'progress', 'remainder']) || typeof q.manual !== 'boolean' || !number(q.progress, 0, 1e9) || !number(q.remainder, -1e-8, cfg.repairGroup.interval)) throw new Error('Invalid shared repair clock');
      } else if (raw.group !== undefined) throw new Error('Unexpected shared repair clock');
      if (raw.commanderLost !== undefined && (!cfg.commander || typeof raw.commanderLost !== 'boolean')) throw new Error('Invalid commander state');
      if (raw.credited !== undefined && typeof raw.credited !== 'boolean') throw new Error('Invalid experience credit');
      if (raw.combat !== undefined) {
        const q = raw.combat;
        if (!cfg.sourceCombat || !object(q) || !only(q, ['morale', 'armorKills', 'airKills', 'steadfast', 'quiet', 'remainder']) ||
            !number(q.morale, 0, 1000) || !number(q.armorKills, 0, 1e9) || !number(q.airKills, 0, 1e9) || typeof q.steadfast !== 'boolean' ||
            !number(q.quiet, 0, 1e9) || !number(q.remainder, -1e-8, cfg.sourceCombat.interval)) throw new Error('Invalid source combat state');
      } else if (cfg.sourceCombat) raw.combat = { morale: cfg.sourceCombat.initial, armorKills: 0, airKills: 0, steadfast: false, quiet: 3, remainder: 0 };
      if (raw.abandoning !== undefined && (!cfg.abandon || !number(raw.abandoning, 0, cfg.abandon.seconds))) throw new Error('Invalid abandonment queue');
      if (raw.terminal !== undefined) {
        const q = raw.terminal;
        if (!object(q) || !only(q, ['remaining', 'owner', 'sourceId', 'gun', 'hull']) || !cfg.failureDelay || !number(q.remaining, 0, cfg.failureDelay) || !Number.isInteger(q.owner) || !this.host.game.st.players[q.owner as number] || !Number.isSafeInteger(q.sourceId) || (q.sourceId as number) < 0 || typeof q.gun !== 'string' || q.gun.length > 240 || q.hull !== undefined && !number(q.hull, 0, 1e9)) throw new Error('Invalid terminal component state');
      }
      next.set(id, plain(raw) as unknown as ComponentsState);
    }
    const nextShots: [Proj, ShotData][] = [], seen = new Set<number>();
    const visuals=value.visuals??[];
    if(!Array.isArray(visuals)||visuals.length>this.host.game.st.projs.length)throw new Error('Invalid source projectile visuals');
    const visualShots=visuals.map(raw=>{if(!object(raw)||!only(raw,['id','variant','branch']))throw new Error('Invalid source projectile visual');const p=this.host.game.st.projs.find(p=>p.id===raw.id);if(!p)throw new Error('Missing source visual projectile');return {...raw,startX:p.x,startY:p.y};});
    for (const raw of [...value.projectiles,...visualShots]) {
      if (!object(raw) || !only(raw, ['id', 'startX', 'startY', 'helper','variant','branch']) || !Number.isSafeInteger(raw.id) || !number(raw.startX, -1e6, 1e6) || !number(raw.startY, -1e6, 1e6) || seen.has(raw.id as number)) throw new Error('Invalid component projectile');
      const p = this.host.game.st.projs.find(p => p.id === raw.id), w = p?.gun ? this.weapon(p.gun) : undefined, rootPayload = w ? this.host.config<ComponentPayload>(w) : undefined;
      let payload=rootPayload;
      if(raw.variant!==undefined){if(!object(raw.variant)||!only(raw.variant,['kind','index'])||raw.variant.kind!=='fragment'||!Number.isInteger(raw.variant.index)||!number(raw.variant.index,0,2)||!Number.isInteger(raw.branch)||!number(raw.branch,-1,63))throw new Error('Invalid source fragment reference');payload=(raw.branch<0?rootPayload:rootPayload?.spawned?.[raw.branch]?.payload)?.fragments?.rounds[raw.variant.index];}
      if (!p || !payload) throw new Error('Unknown component projectile');
      if (raw.helper !== undefined && (!payload.sourceHelper || !object(raw.helper) || !only(raw.helper, ['id', 'weak']) || !Number.isSafeInteger(raw.helper.id) || (raw.helper.id as number) < 1 || (raw.helper.id as number) >= this.host.game.st.nextId+logicalHelpers || !number(raw.helper.weak, 0, 1))) throw new Error('Invalid source helper identity');
      seen.add(raw.id as number); nextShots.push([p, { payload, startX: raw.startX, startY: raw.startY, ...(raw.helper ? { helper: plain(raw.helper) as ShotData['helper'] } : {}),...(raw.variant?{variant:plain(raw.variant) as ShotData['variant'],branch:raw.branch as number}:{}) }]);
    }
    const waves=value.waves??[];
    if(!Array.isArray(waves)||waves.length>65536)throw new Error('Invalid source blast waves');
    for(const w of waves){
      if(!object(w)||!only(w,['gun','branch','phase','x','y','angle','owner','source','scale','age','hits','air','forest'])||typeof w.gun!=='string'||!Number.isInteger(w.branch)||!number(w.branch,-1,63)||!Number.isInteger(w.phase)||!number(w.phase,0,3))throw new Error('Invalid source blast reference');
      const payload=this.payloadAt(w.gun,w.branch),phase=payload?.hpPhases?.[w.phase];
      if(!phase?.expand||!number(w.x,-1e6,1e6)||!number(w.y,-1e6,1e6)||!number(w.angle,-1e9,1e9)||!Number.isInteger(w.owner)||!this.host.game.st.players[w.owner as number]||!Number.isSafeInteger(w.source)||(w.source as number)<0||!number(w.scale,0,1e6)||!number(w.age,0,phase.expand)||typeof w.air!=='boolean'||typeof w.forest!=='boolean'||w.forest&&!phase.forest||!Array.isArray(w.hits)||w.hits.length>1e6||w.hits.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(w.hits).size!==w.hits.length)throw new Error('Invalid source blast wave');
    }
    this.aps.restore(value.aps??{entities:{},interceptors:[],children:[],ended:[]});this.smoke.restore(value.smoke);this.logicalHelpers=logicalHelpers;
    this.waves.splice(0,this.waves.length,...plain(waves) as HpWave[]);
    this.achievements.clear();for(const[owner,ids]of completed)this.achievements.set(owner,ids);
    this.states.clear(); for (const [id, state] of next) this.states.set(id, state);
    this.shots = new WeakMap();
    for (const [p, shot] of nextShots) this.shots.set(p, shot);
    this.ballistics.restore(value.motion??[]);
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
