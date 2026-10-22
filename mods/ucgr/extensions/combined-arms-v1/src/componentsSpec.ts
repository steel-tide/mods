import type { TextTuple } from '../../../../../../steel-tide/game/core/src/core/i18n';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';

/** Data belongs to a pack; these identifiers have no built-in gameplay meaning. */
export type Face = 'front' | 'side' | 'rear' | 'top';
export type Faces = Record<Face, number>;
export interface ModuleIssue { path: string; message: string }
export interface ComponentEffects {
  speed?: number;
  turn?: number;
  /** Fractions of the original reload are added before applying other multipliers. */
  reloadAdd?: number;
  disableWeapons?: string[];
}
export interface RepairPolicy {
  seconds: number;
  /** Accumulated damage fraction at completion (0 is fully repaired). */
  toDamage: number;
  fromDamage: number;
  provider?: string;
  range?: number;
  stationary?: boolean;
  auto?: boolean;
  metal?: number;
  /** Shared work may start strictly above this fraction; completion still uses fromDamage. */
  startAbove?: number;
  untilDamage?: number;
  accrueToStockThreshold?: boolean;
}
export interface BlastBand { above: number; damage: [number, number]; scale: 'part' | 'pressure-part' | 'yield-pressure-part' }
export interface StockThreshold { stocks: string[]; perMissing: number; strict: boolean; rebaseOnRefill: boolean }
export interface PartDef {
  strict?: boolean;
  id: string;
  label: TextTuple;
  hp: number;
  channel: string;
  exposure: Faces;
  damagedAt: number;
  damaged?: ComponentEffects;
  destroyed?: ComponentEffects;
  /** One-shot consequence when this threshold is crossed. */
  failure?: { destroy?: boolean; hullDamage?: number; hullRange?: [number, number] };
  /** Damage can exceed the functional threshold, without making the part immortal. */
  damageLimit?: number;
  stockThreshold?: StockThreshold;
  damagedBelow?: number;
  latchDamaged?: boolean;
  blast?: BlastBand[];
  repairs?: RepairPolicy[];
  /** A crew seat is a part with an occupant, rather than a magical function name. */
  crew?: boolean;
}
export interface ProtectionDef {
  frontHalfAngle: number;
  rearHalfAngle: number;
  incidence: boolean;
  families: Record<string, Faces>;
  layers?: Record<string, Faces>;
}
export interface CrewDef {
  /** Ordered destinations when an unoccupied seat is automatically filled. */
  priority: string[];
  /** Explicit directed seat transfers; a reserve seat is an ordinary named seat. */
  replacements: { from: string; to: string }[];
  seconds: number;
  automatic: boolean;
  destroyWhenEmpty: boolean;
  requiresEmptyReserve?: boolean;
  vacatedDamage?: number;
  vacatedExtra?: number;
}
export interface ApsDef { launchers:{x:number;y:number;capacity:number;reload:number}[]; range:number; cadence:number; life:number; speed:number; targetSpeed:number; acceleration:number; spread:number; turn:number; contact:number }
export interface IncomingDef { tags:string[]; end:boolean; child?:{chance:number;angle:number;life:number;speed:number;tags:string[]} }
export interface SourceMovement {speed:number;acceleration:number;deceleration:number;turn:number;turnAcceleration:number;yScale:number}
export interface AchievementDef {id:string;label:TextTuple;counter:'armor'|'air'|'kills';threshold:number;to?:string}
/** Source tank-template smoke: grenade launchers and engine smoke drop 5 s
 * smokeG markers that intercept ATGM-tagged rounds. Points are mount-frame
 * (RW px × 0.4); `mount` names the articulation ring they ride, else the hull. */
export interface SmokePoint { x:number; y:number; mount?:string }
export interface SmokeDef {
  flight?: { speed:number; spread:number };
  grenades?: { label:TextTuple; cooldown:number; launchers:SmokePoint[]; aim:{forward:number;lateral:number}[] };
  engine?: { label:TextTuple; cooldown:number; shared:boolean; duration:number; point:SmokePoint; aim:{forward:number;lateral:number} };
  marker: { life:number; range:number; energy:number; regen:number; usage:number; reload:number; tags:string[] };
}
export interface ComponentsDef {
  achievements?:AchievementDef[];
  smoke?:SmokeDef;
  sourceMovement?:SourceMovement;
  aps?: ApsDef;
  sourceRadius?: number;
  experience?: { kind: 'armor' | 'air'; value: number };
  sourceArmor?: { armor: number; minimum: number; tags: string[] };
  sourceInfantry?: boolean;
  commander?: { visionPenalty: number; reserveThreshold: number; seat?: string };
  sourceCombat?: { label: TextTuple; initial: number; interval: number; baseAccuracy: number; movingAccuracy: number; range: number };
  protection?: ProtectionDef;
  parts: PartDef[];
  crew?: CrewDef;
  /** Remaining repair progress after a hit, 0 discards it and 1 retains it. */
  repairHitRetention: number;
  /** Tags this entity offers as a stationary or mobile repair provider. */
  services?: string[];
  reserve?: {
    label: TextTuple; capacity: number; refillCount?: number; hpPerMember: number; damageHp: number; channel: string; exposure: Faces;
    seconds: number; priority: string[]; roundHealth: boolean; refillCosts: Record<string, number>;
    empty?: ComponentEffects; blast?: BlastBand[];
  };
  repairGroup?: { interval: number; priority: string[]; provider: string; range: number; floorOnHit: boolean; finishBelow?: number; refillProtection?: boolean; beginRefill?: string };
  /** [offset, scale] of the composed movement multiplier, relative to base turn rate. */
  turnFromSpeed?: [number, number];
  failureDelay?: number;
  clearOrdersWhenImmobile?: boolean;
  abandon?: { label: TextTuple; seconds: number };
  blast?: { family: string; base: number; armorScale: number; coefficient: number; minimumDistance: number };
}
export interface DamageChannel {
  strong: [number, number]; weak: [number, number];
  faces?: Partial<Record<Face, { strong: [number, number]; weak: [number, number] }>>;
}
export interface HpPhase { direct:number;area:number;radius:number;ignore:number;fromEdge:boolean;noFalloff:boolean;friendly:boolean;targetGround:boolean;expand?:number;forest?:boolean;mutators:{with:string[];without:string[];direct:number;area:number}[] }
export interface ProjectileMotion {life:number;speed:number;speedSpread:number;spread:number;vx:number;vy:number;vz:number;gravity:number;trueGravity:number;targetHeight:number;height:number;targetSpeed:number;acceleration:number;turn:number;nearTurn:number;delay:number;ground:boolean;includeHeight:boolean;noLead:boolean;end:boolean}
export interface ComponentPayload {
  warmup?: {seconds:number;decay:number};
  fragments?: {penetrated:number;blocked:number;offset:number;ricochet?:number;rounds:ComponentPayload[]};
  motion?: ProjectileMotion;
  spawned?: {x:number;y:number;payload:ComponentPayload}[];
  hpPhases?: HpPhase[];
  incoming?: IncomingDef;
  family: string;
  penetration: number;
  hullDamage: number;
  strength: number;
  diameter: number;
  /** Each channel supplies its independent strong/weak damage ranges. */
  channels: Record<string, DamageChannel>;
  wear: number;
  top: boolean;
  jitter: [number, number];
  /** Polynomial addition to penetration in travelled world pixels. */
  rangeAdjustment: [number, number, number];
  ricochet?: { cosine: number; requiresNominalBlock: boolean };
  /** Optional residual-depth multiplier, clamped to this interval. */
  residual?: { base: number; scale: number; max: number };
  friendlyFire?: boolean;
  ordinary?: { ignore: number; multipliers: { tag: string; value: number }[] };
  positiveArmor?: boolean;
  sourceHelper?: boolean;
  sourceWeak?: { roll: number; multiplier: number; helperParity?: boolean };
  weakHit?: { chance: number; multiplier: number };
  experience?: boolean;
  interruptRepair?: boolean;
  bearingOrigin?: 'projectile' | 'source';
  recipient?: { range: number; radiusSquared: number };
  exposureFace?: Face;
  channelScale?: Record<string, number>;
  rangeOrigin?: 'launch' | 'source';
  wearFaces?: Partial<Record<Face, Face>>;
  layerScale?: Faces;
  /** Explicit collateral hull policy; omitted retains legacy collateral damage. */
  collateralHullDamage?: number;
  /** Yield drives a recipient's authored blast pressure response, independently of penetration. */
  blast?: { yield: number; radius: number; poolCountOffset: number; penetration: boolean; combined?: boolean; forest?: { search: number; radius: number; infantry: number } };
}

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const FACES: Face[] = ['front', 'side', 'rear', 'top'];
export class ModuleReader {
  constructor(readonly issues: ModuleIssue[]) {}
  bad(path: string, message: string): void { this.issues.push({ path, message }); }
  obj(v: unknown, path: string, keys: readonly string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) {
      this.bad(path, 'must be a plain object'); return {};
    }
    for (const k of Object.keys(v)) if (!keys.includes(k)) this.bad(`${path}.${k}`, 'unsupported field');
    return v as Record<string, unknown>;
  }
  num(v: unknown, path: string, min: number, max: number, fallback?: number): number {
    if (v === undefined && fallback !== undefined) return fallback;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) { this.bad(path, `must be between ${min} and ${max}`); return min; }
    return v;
  }
  bool(v: unknown, path: string, fallback = false): boolean {
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') { this.bad(path, 'must be a boolean'); return fallback; }
    return v;
  }
  id(v: unknown, path: string): string {
    if (typeof v !== 'string' || !ID.test(v) || v === '__proto__' || v === 'constructor' || v === 'prototype') { this.bad(path, 'must be a bounded identifier'); return ''; }
    return v;
  }
  list(v: unknown, path: string, max: number, min = 0): unknown[] {
    if (!Array.isArray(v) || v.length < min || v.length > max) { this.bad(path, `must contain ${min}–${max} entries`); return []; }
    return v;
  }
  ids(v: unknown, path: string, max = 32): string[] {
    const a = this.list(v, path, max).map((x, i) => this.id(x, `${path}[${i}]`));
    if (new Set(a).size !== a.length) this.bad(path, 'duplicate identifiers');
    return a;
  }
  text(v: unknown, path: string): TextTuple {
    const a = this.list(v, path, 3, 3);
    if (a.some(x => typeof x !== 'string' || !x.trim() || x.length > 240)) this.bad(path, 'must contain non-empty [en, zh, ko] text, up to 240 characters each');
    return a.map(x => typeof x === 'string' ? x : '') as TextTuple;
  }
  range(v: unknown, path: string, min: number, max: number, fallback?: [number, number]): [number, number] {
    if (v === undefined && fallback) return [...fallback];
    const a = this.list(v, path, 2, 2);
    const lo = this.num(a[0], `${path}[0]`, min, max), hi = this.num(a[1], `${path}[1]`, min, max);
    if (hi < lo) this.bad(path, 'upper value is below lower value');
    return [lo, hi];
  }
  keyed(v: unknown, path: string, max: number): [string, unknown][] {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) { this.bad(path, 'must be an object keyed by identifiers'); return []; }
    const entries = Object.entries(v);
    if (entries.length < 1 || entries.length > max) { this.bad(path, `must contain 1–${max} entries`); return []; }
    for (const [id] of entries) this.id(id, `${path}.${id}`);
    return entries;
  }
}

function faces(r: ModuleReader, v: unknown, path: string, max: number): Faces {
  const o = r.obj(v, path, FACES);
  return Object.fromEntries(FACES.map(face => [face, r.num(o[face], `${path}.${face}`, 0, max, face === 'top' ? 0 : undefined)])) as Faces;
}
function effects(r: ModuleReader, v: unknown, path: string, weapons: readonly string[]): ComponentEffects {
  const o = r.obj(v, path, ['speed', 'turn', 'reloadAdd', 'disableWeapons']);
  const result: ComponentEffects = {};
  if (o.speed !== undefined) result.speed = r.num(o.speed, `${path}.speed`, 0, 4);
  if (o.turn !== undefined) result.turn = r.num(o.turn, `${path}.turn`, 0, 4);
  if (o.reloadAdd !== undefined) result.reloadAdd = r.num(o.reloadAdd, `${path}.reloadAdd`, -0.9, 20);
  if (o.disableWeapons !== undefined) {
    result.disableWeapons = r.ids(o.disableWeapons, `${path}.disableWeapons`, 16);
    for (const id of result.disableWeapons) if (!weapons.includes(id)) r.bad(`${path}.disableWeapons`, `unknown weapon ${id}`);
  }
  return result;
}
function blastBands(r: ModuleReader, v: unknown, path: string): BlastBand[] {
  const result = r.list(v, path, 8, 1).map((raw, i): BlastBand => {
    const p = `${path}[${i}]`, o = r.obj(raw, p, ['above', 'damage', 'scale']);
    const scale = o.scale ?? 'part';
    if (scale !== 'part' && scale !== 'pressure-part' && scale !== 'yield-pressure-part') r.bad(`${p}.scale`, 'unknown pressure response scale');
    return { above: r.num(o.above, `${p}.above`, 0, 1000), damage: r.range(o.damage, `${p}.damage`, 0, 100), scale: scale as BlastBand['scale'] };
  });
  if (result.some((b, i) => i > 0 && b.above >= result[i - 1].above)) r.bad(path, 'bands must have strictly descending pressure thresholds');
  return result;
}

export function readComponentsDef(value: unknown, path: string, issues: ModuleIssue[], context?: ExtensionSpecContext): ComponentsDef | undefined {
  const weapons = context?.weaponIds ?? [];
  const start = issues.length, r = new ModuleReader(issues);
  const o = r.obj(value, path, ['smoke','achievements','sourceMovement', 'sourceArmor', 'commander', 'sourceInfantry', 'sourceCombat', 'experience', 'aps', 'sourceRadius', 'protection', 'parts', 'crew', 'repairHitRetention', 'services', 'reserve', 'repairGroup', 'turnFromSpeed', 'failureDelay', 'clearOrdersWhenImmobile', 'blast', 'abandon']);
  const out: ComponentsDef = { parts: [], repairHitRetention: r.num(o.repairHitRetention, `${path}.repairHitRetention`, 0, 1, 1) };
  if(o.achievements!==undefined)out.achievements=r.list(o.achievements,`${path}.achievements`,32).map((raw,i)=>{const p=`${path}.achievements[${i}]`,v=r.obj(raw,p,['id','label','counter','threshold','to']);if(!['armor','air','kills'].includes(v.counter as string))r.bad(`${p}.counter`,'invalid source counter');const to=v.to!==undefined?r.id(v.to,`${p}.to`):undefined;if(to&&context?.defIds&&!context.defIds.has(to))r.bad(`${p}.to`,`unknown definition ${to}`);return{id:r.id(v.id,`${p}.id`),label:r.text(v.label,`${p}.label`),counter:v.counter as AchievementDef['counter'],threshold:r.num(v.threshold,`${p}.threshold`,1,100000),...(to?{to}:{})};});
  if(o.smoke!==undefined){
    const p=`${path}.smoke`,q=r.obj(o.smoke,p,['flight','grenades','engine','marker']);
    const point=(raw:unknown,at:string):SmokePoint=>{const v=r.obj(raw,at,['x','y','mount']);return{x:r.num(v.x,`${at}.x`,-512,512),y:r.num(v.y,`${at}.y`,-512,512),...(v.mount!==undefined?{mount:r.id(v.mount,`${at}.mount`)}:{})};};
    const m=r.obj(q.marker,`${p}.marker`,['life','range','energy','regen','usage','reload','tags']);
    const tags=r.list(m.tags,`${p}.marker.tags`,8,1).map(v=>{if(typeof v!=='string'||!v.length||v.length>40)r.bad(`${p}.marker.tags`,'invalid source tag');return String(v);});
    const smoke:SmokeDef={marker:{life:r.num(m.life,`${p}.marker.life`,.01,600),range:r.num(m.range,`${p}.marker.range`,0,1000),energy:r.num(m.energy,`${p}.marker.energy`,0,1000),
      regen:r.num(m.regen,`${p}.marker.regen`,0,1000),usage:r.num(m.usage,`${p}.marker.usage`,0,1000),reload:r.num(m.reload,`${p}.marker.reload`,0,600),tags}};
    if(q.flight!==undefined){const f=r.obj(q.flight,`${p}.flight`,['speed','spread']);smoke.flight={speed:r.num(f.speed,`${p}.flight.speed`,1,10000),spread:r.num(f.spread,`${p}.flight.spread`,0,1000)};}
    const aimOf=(raw:unknown,at:string)=>{const a=r.obj(raw,at,['forward','lateral']);return{forward:r.num(a.forward,`${at}.forward`,-1000,1000),lateral:r.num(a.lateral,`${at}.lateral`,-1000,1000)};};
    if(q.grenades!==undefined){const at=`${p}.grenades`,g=r.obj(q.grenades,at,['label','cooldown','launchers','aim']);
      const launchers=r.list(g.launchers,`${at}.launchers`,8,1).map((v,i)=>point(v,`${at}.launchers[${i}]`));
      const aim=r.list(g.aim,`${at}.aim`,8,1).map((v,i)=>aimOf(v,`${at}.aim[${i}]`));
      if(aim.length!==launchers.length)r.bad(`${at}.aim`,'needs one aim point per launcher');
      smoke.grenades={label:r.text(g.label,`${at}.label`),cooldown:r.num(g.cooldown,`${at}.cooldown`,0,3600),launchers,aim};}
    if(q.engine!==undefined){const at=`${p}.engine`,g=r.obj(q.engine,at,['label','cooldown','shared','duration','point','aim']);
      smoke.engine={label:r.text(g.label,`${at}.label`),cooldown:r.num(g.cooldown,`${at}.cooldown`,0,3600),shared:r.bool(g.shared,`${at}.shared`),duration:r.num(g.duration,`${at}.duration`,0,600),point:point(g.point,`${at}.point`),aim:aimOf(g.aim,`${at}.aim`)};}
    if(!smoke.grenades&&!smoke.engine)r.bad(p,'requires grenades or engine smoke');
    out.smoke=smoke;
  }
  if(o.sourceMovement!==undefined){const p=`${path}.sourceMovement`,v=r.obj(o.sourceMovement,p,['speed','acceleration','deceleration','turn','turnAcceleration','yScale']);out.sourceMovement=Object.fromEntries(['speed','acceleration','deceleration','turn','turnAcceleration','yScale'].map(k=>[k,r.num(v[k],`${p}.${k}`,k==='yScale'?.0001:0,100000)])) as unknown as SourceMovement;}
  if (o.experience !== undefined) {
    const q = r.obj(o.experience, `${path}.experience`, ['kind', 'value']);
    if (q.kind !== 'armor' && q.kind !== 'air') r.bad(`${path}.experience.kind`, 'must be armor or air');
    out.experience = { kind: q.kind as 'armor' | 'air', value: r.num(q.value, `${path}.experience.value`, 0, 10000) };
  }
  if (o.sourceArmor !== undefined) {
    const p = `${path}.sourceArmor`, q = r.obj(o.sourceArmor, p, ['armor', 'minimum', 'tags']);
    const tags = r.list(q.tags, `${p}.tags`, 128).map(v => { if (typeof v !== 'string' || !v.length || v.length > 120) r.bad(`${p}.tags`, 'invalid source tag'); return typeof v === 'string' ? v : ''; });
    out.sourceArmor = { armor: r.num(q.armor, `${p}.armor`, 0, 1e9), minimum: r.num(q.minimum, `${p}.minimum`, 0, 1e6), tags };
  }
  if (o.commander !== undefined) { const q = r.obj(o.commander, `${path}.commander`, ['visionPenalty', 'reserveThreshold', 'seat']); out.commander = { visionPenalty: r.num(q.visionPenalty, `${path}.commander.visionPenalty`, 0, 64), reserveThreshold: r.num(q.reserveThreshold, `${path}.commander.reserveThreshold`, 0, 32), ...(q.seat !== undefined ? {seat:r.id(q.seat, `${path}.commander.seat`)} : {}) }; }
  if (o.sourceInfantry !== undefined) out.sourceInfantry = r.bool(o.sourceInfantry, `${path}.sourceInfantry`);
  if (o.sourceCombat !== undefined) {
    const p = `${path}.sourceCombat`, q = r.obj(o.sourceCombat, p, ['label', 'initial', 'interval', 'baseAccuracy', 'movingAccuracy', 'range']);
    out.sourceCombat = { label: r.text(q.label, `${p}.label`), initial: r.num(q.initial, `${p}.initial`, 0, 100), interval: r.num(q.interval, `${p}.interval`, .01, 10), baseAccuracy: r.num(q.baseAccuracy, `${p}.baseAccuracy`, -1000, 1000), movingAccuracy: r.num(q.movingAccuracy, `${p}.movingAccuracy`, -1000, 1000), range: r.num(q.range, `${p}.range`, 0, 100000) };
  }
  if (o.aps !== undefined) {
    const p=`${path}.aps`, a=r.obj(o.aps,p,['launchers','range','cadence','life','speed','targetSpeed','acceleration','spread','turn','contact']);
    const launchers=r.list(a.launchers,`${p}.launchers`,8,1).map((raw,i)=>{const q=`${p}.launchers[${i}]`,v=r.obj(raw,q,['x','y','capacity','reload']);return {x:r.num(v.x,`${q}.x`,-1024,1024),y:r.num(v.y,`${q}.y`,-1024,1024),capacity:r.num(v.capacity,`${q}.capacity`,0,1000),reload:r.num(v.reload,`${q}.reload`,0,3600)};});
    out.aps={launchers,range:r.num(a.range,`${p}.range`,.01,4096),cadence:r.num(a.cadence,`${p}.cadence`,.01,3600),life:r.num(a.life,`${p}.life`,.001,3600),speed:r.num(a.speed,`${p}.speed`,0,100000),targetSpeed:r.num(a.targetSpeed,`${p}.targetSpeed`,0,100000),acceleration:r.num(a.acceleration,`${p}.acceleration`,0,100000),spread:r.num(a.spread,`${p}.spread`,0,100000),turn:r.num(a.turn,`${p}.turn`,0,100000),contact:r.num(a.contact,`${p}.contact`,0,1024)};
    if(out.aps.spread>out.aps.speed||launchers.some(l=>!Number.isInteger(l.capacity)))r.bad(p,'invalid source APS stock or speed spread');
  }
  if (o.sourceRadius !== undefined) out.sourceRadius = r.num(o.sourceRadius, `${path}.sourceRadius`, .1, 4096);
  if (o.protection !== undefined) {
    const p = r.obj(o.protection, `${path}.protection`, ['frontHalfAngle', 'rearHalfAngle', 'incidence', 'families', 'layers']);
    out.protection = {
      frontHalfAngle: r.num(p.frontHalfAngle, `${path}.protection.frontHalfAngle`, 1, 89, 45),
      rearHalfAngle: r.num(p.rearHalfAngle, `${path}.protection.rearHalfAngle`, 1, 89, 45),
      incidence: r.bool(p.incidence, `${path}.protection.incidence`, true),
      families: Object.fromEntries(r.keyed(p.families, `${path}.protection.families`, 16).map(([id, f]) => [id, faces(r, f, `${path}.protection.families.${id}`, 100000)])),
    };
    if (p.layers !== undefined) {
      out.protection.layers = Object.fromEntries(r.keyed(p.layers, `${path}.protection.layers`, 16).map(([id, f]) => {
        if (!(id in out.protection!.families)) r.bad(`${path}.protection.layers.${id}`, 'layer needs a matching family');
        return [id, faces(r, f, `${path}.protection.layers.${id}`, 100000)];
      }));
    }
  }
  if (o.parts !== undefined) out.parts = r.list(o.parts, `${path}.parts`, 32).map((raw, i) => {
    const p = `${path}.parts[${i}]`, c = r.obj(raw, p, ['strict', 'id', 'label', 'hp', 'channel', 'exposure', 'damagedAt', 'damaged', 'destroyed', 'failure', 'repairs', 'crew', 'damageLimit', 'stockThreshold', 'damagedBelow', 'latchDamaged', 'blast']);
    const part: PartDef = { id: r.id(c.id, `${p}.id`), label: r.text(c.label, `${p}.label`), hp: r.num(c.hp, `${p}.hp`, 1, 1000000), channel: r.id(c.channel, `${p}.channel`), exposure: faces(r, c.exposure, `${p}.exposure`, 10), damagedAt: r.num(c.damagedAt, `${p}.damagedAt`, 0.01, 0.99, 0.65) };
    if (c.strict !== undefined) part.strict = r.bool(c.strict, `${p}.strict`);
    if (c.damaged !== undefined) part.damaged = effects(r, c.damaged, `${p}.damaged`, weapons);
    if (c.destroyed !== undefined) part.destroyed = effects(r, c.destroyed, `${p}.destroyed`, weapons);
    if (c.crew !== undefined) part.crew = r.bool(c.crew, `${p}.crew`);
    if (c.damageLimit !== undefined) part.damageLimit = r.num(c.damageLimit, `${p}.damageLimit`, part.hp, 1e6);
    if (c.damagedBelow !== undefined) part.damagedBelow = r.num(c.damagedBelow, `${p}.damagedBelow`, part.damagedAt + 0.001, 100);
    if (c.latchDamaged !== undefined) part.latchDamaged = r.bool(c.latchDamaged, `${p}.latchDamaged`);
    if (c.blast !== undefined) part.blast = blastBands(r, c.blast, `${p}.blast`);
    if (c.stockThreshold !== undefined) {
      const q = `${p}.stockThreshold`, f = r.obj(c.stockThreshold, q, ['stocks', 'perMissing', 'strict', 'rebaseOnRefill']);
      const stocks = r.ids(f.stocks, `${q}.stocks`, 32);
      if (!stocks.length) r.bad(`${q}.stocks`, 'requires at least one stock');
      const logistics = context?.definition?.extensions as Record<string, { stocks?: { id: string }[] }> | undefined;
      const localStocks = logistics?.['logistics-v1']?.stocks;
      for (const id of stocks) if (context?.definition && !(Array.isArray(localStocks) && localStocks.some(s => s && s.id === id))) r.bad(`${q}.stocks`, `unknown local logistics stock ${id}`);
      if (!part.damageLimit) r.bad(q, 'stock thresholds require an explicit damageLimit');
      part.stockThreshold = { stocks, perMissing: r.num(f.perMissing, `${q}.perMissing`, 0, 1e6), strict: r.bool(f.strict, `${q}.strict`), rebaseOnRefill: r.bool(f.rebaseOnRefill, `${q}.rebaseOnRefill`) };
      if (Array.isArray(localStocks)) { const capacity = localStocks.filter(s => s && stocks.includes(s.id)).reduce((sum, s) => sum + (typeof (s as { capacity?: unknown }).capacity === 'number' ? (s as unknown as { capacity: number }).capacity : 0), 0); const maxThreshold = part.hp + capacity * part.stockThreshold.perMissing; if (part.damageLimit !== undefined && (part.stockThreshold.strict ? part.damageLimit <= maxThreshold : part.damageLimit < maxThreshold)) r.bad(`${p}.damageLimit`, 'must allow reaching the largest stock-dependent failure threshold'); }
    }
    if (c.failure !== undefined) {
      const f = r.obj(c.failure, `${p}.failure`, ['destroy', 'hullDamage', 'hullRange']);
      part.failure = { destroy: r.bool(f.destroy, `${p}.failure.destroy`), hullDamage: r.num(f.hullDamage, `${p}.failure.hullDamage`, 0, 1000000, 0) };
      if (f.hullRange !== undefined) {
        part.failure.hullRange = r.range(f.hullRange, `${p}.failure.hullRange`, 1, 1e6);
        if (!part.failure.destroy) r.bad(`${p}.failure.hullRange`, 'requires terminal failure');
      }
    }
    if (c.repairs !== undefined) part.repairs = r.list(c.repairs, `${p}.repairs`, 4).map((rawRepair, j) => {
      const rp = `${p}.repairs[${j}]`, q = r.obj(rawRepair, rp, ['seconds', 'toDamage', 'fromDamage', 'provider', 'range', 'stationary', 'auto', 'metal', 'startAbove', 'untilDamage', 'accrueToStockThreshold']);
      const policy: RepairPolicy = { seconds: r.num(q.seconds, `${rp}.seconds`, 0.1, 3600), toDamage: r.num(q.toDamage, `${rp}.toDamage`, 0, 0.99, 0), fromDamage: r.num(q.fromDamage, `${rp}.fromDamage`, 0, 1, part.damagedAt), stationary: r.bool(q.stationary, `${rp}.stationary`, true), auto: r.bool(q.auto, `${rp}.auto`), metal: r.num(q.metal, `${rp}.metal`, 0, 100000, 0) };
      if (policy.toDamage >= policy.fromDamage) r.bad(rp, 'repair must reduce damage');
      if (q.startAbove !== undefined) policy.startAbove = r.num(q.startAbove, `${rp}.startAbove`, policy.fromDamage, 100);
      if (q.untilDamage !== undefined) policy.untilDamage = r.num(q.untilDamage, `${rp}.untilDamage`, policy.fromDamage + 0.001, 100);
      if (q.accrueToStockThreshold !== undefined) { policy.accrueToStockThreshold = r.bool(q.accrueToStockThreshold, `${rp}.accrueToStockThreshold`); if (!part.stockThreshold || q.untilDamage === undefined) r.bad(rp, 'stock-bound accrual requires a stock threshold and completion ceiling'); }
      if (q.provider !== undefined) { policy.provider = r.id(q.provider, `${rp}.provider`); policy.range = r.num(q.range, `${rp}.range`, 1, 4096); }
      else if (q.range !== undefined) r.bad(`${rp}.range`, 'range needs a provider');
      return policy;
    });
    return part;
  });
  if (new Set(out.parts.map(p => p.id)).size !== out.parts.length) r.bad(`${path}.parts`, 'duplicate part IDs');
  if (o.services !== undefined) out.services = r.ids(o.services, `${path}.services`, 16);
  if (o.crew !== undefined) {
    const p = `${path}.crew`, c = r.obj(o.crew, p, ['priority', 'replacements', 'seconds', 'automatic', 'destroyWhenEmpty', 'requiresEmptyReserve', 'vacatedDamage', 'vacatedExtra']);
    const seats = out.parts.filter(part => part.crew).map(part => part.id);
    if (seats.length < 1 || seats.length > 8) r.bad(p, 'crew needs 1–8 crew parts');
    const crew: CrewDef = { priority: r.ids(c.priority, `${p}.priority`, 8), replacements: [], seconds: r.num(c.seconds, `${p}.seconds`, 0.1, 600), automatic: r.bool(c.automatic, `${p}.automatic`), destroyWhenEmpty: r.bool(c.destroyWhenEmpty, `${p}.destroyWhenEmpty`) };
    for (const id of crew.priority) if (!seats.includes(id)) r.bad(`${p}.priority`, `unknown crew seat ${id}`);
    crew.replacements = r.list(c.replacements, `${p}.replacements`, 32).map((raw, i) => {
      const q = `${p}.replacements[${i}]`, pair = r.obj(raw, q, ['from', 'to']);
      const from = r.id(pair.from, `${q}.from`), to = r.id(pair.to, `${q}.to`);
      if (!seats.includes(from) || !seats.includes(to) || from === to) r.bad(q, 'replacement must name two distinct crew seats');
      return { from, to };
    });
    if (new Set(crew.replacements.map(x => `${x.from}/${x.to}`)).size !== crew.replacements.length) r.bad(`${p}.replacements`, 'duplicate replacement');
    if (c.requiresEmptyReserve !== undefined) crew.requiresEmptyReserve = r.bool(c.requiresEmptyReserve, `${p}.requiresEmptyReserve`);
    if (c.vacatedDamage !== undefined) { crew.vacatedDamage = r.num(c.vacatedDamage, `${p}.vacatedDamage`, 1, 100); for (const seat of out.parts.filter(p => p.crew)) if (seat.hp * crew.vacatedDamage > (seat.damageLimit ?? seat.hp)) r.bad(`${p}.vacatedDamage`, 'exceeds a crew seat damageLimit'); }
    if (c.vacatedExtra !== undefined) { crew.vacatedExtra = r.num(c.vacatedExtra, `${p}.vacatedExtra`, 0, 1e6); for (const seat of out.parts.filter(p => p.crew)) if (seat.hp * (crew.vacatedDamage ?? 1) + crew.vacatedExtra > (seat.damageLimit ?? seat.hp)) r.bad(`${p}.vacatedExtra`, 'exceeds a crew seat damageLimit'); }
    out.crew = crew;
  } else if (out.parts.some(p => p.crew)) r.bad(path, 'crew parts require a crew policy');
  if (o.reserve !== undefined) {
    const p = `${path}.reserve`, q = r.obj(o.reserve, p, ['label', 'capacity', 'refillCount', 'hpPerMember', 'damageHp', 'channel', 'exposure', 'seconds', 'priority', 'roundHealth', 'refillCosts', 'empty', 'blast']);
    const seats = out.parts.filter(p => p.crew).map(p => p.id), priority = r.ids(q.priority, `${p}.priority`, 8);
    if (!out.crew || !priority.length) r.bad(p, 'reserve requires crew seats and replacement priority');
    for (const id of priority) if (!seats.includes(id)) r.bad(`${p}.priority`, `unknown crew seat ${id}`);
    const capacity = r.num(q.capacity, `${p}.capacity`, 0, 64);
    if (!Number.isInteger(capacity)) r.bad(`${p}.capacity`, 'must be an integer');
    const refillCosts: Record<string, number> = {};
    if (q.refillCosts !== undefined) for (const [id, value] of r.keyed(q.refillCosts, `${p}.refillCosts`, 8)) {
      if (!seats.includes(id)) r.bad(`${p}.refillCosts.${id}`, 'must name a crew seat');
      const cost = r.num(value, `${p}.refillCosts.${id}`, 0, 64);
      if (!Number.isInteger(cost)) r.bad(`${p}.refillCosts.${id}`, 'must be an integer');
      refillCosts[id] = cost;
    }
    out.reserve = { label: r.text(q.label, `${p}.label`), capacity, hpPerMember: r.num(q.hpPerMember, `${p}.hpPerMember`, 1, 100000), damageHp: r.num(q.damageHp, `${p}.damageHp`, 1, 1e6), channel: r.id(q.channel, `${p}.channel`), exposure: faces(r, q.exposure, `${p}.exposure`, 10), seconds: r.num(q.seconds, `${p}.seconds`, 0.1, 600), priority, roundHealth: r.bool(q.roundHealth, `${p}.roundHealth`), refillCosts };
    if (q.refillCount !== undefined) out.reserve.refillCount = r.num(q.refillCount, `${p}.refillCount`, capacity, 64);
    if (q.empty !== undefined) out.reserve.empty = effects(r, q.empty, `${p}.empty`, weapons);
    if (q.blast !== undefined) out.reserve.blast = blastBands(r, q.blast, `${p}.blast`);
  }
  if (out.commander?.seat && !out.parts.some(p => p.id === out.commander!.seat && p.crew)) r.bad(`${path}.commander.seat`, 'must name a crew seat');
  if (out.crew?.requiresEmptyReserve && !out.reserve) r.bad(`${path}.crew.requiresEmptyReserve`, 'requires a reserve pool');
  if (o.repairGroup !== undefined) {
    const p = `${path}.repairGroup`, q = r.obj(o.repairGroup, p, ['interval', 'priority', 'provider', 'range', 'floorOnHit', 'finishBelow', 'refillProtection', 'beginRefill']);
    const priority = r.list(q.priority, `${p}.priority`, 128, 1).map((v, i) => {
      const match = typeof v === 'string' ? /^([a-z0-9][a-z0-9_-]{0,39})\/([0-3])$/.exec(v) : null;
      if (!match || !out.parts.find(p => p.id === match[1])?.repairs?.[Number(match[2])]) r.bad(`${p}.priority[${i}]`, 'must name an existing part/policy');
      return typeof v === 'string' ? v : '';
    });
    if (new Set(priority).size !== priority.length) r.bad(`${p}.priority`, 'duplicate repair policy');
    if (out.parts.some(p => p.repairs?.some(q => q.metal))) r.bad(p, 'shared repair groups do not support paid policies');
    if (q.beginRefill !== undefined && !out.reserve) r.bad(`${p}.beginRefill`, 'requires a reserve pool');
    out.repairGroup = { ...(q.beginRefill !== undefined ? { beginRefill: r.id(q.beginRefill, `${p}.beginRefill`) } : {}), interval: r.num(q.interval, `${p}.interval`, 0.01, 10), priority, provider: r.id(q.provider, `${p}.provider`), range: r.num(q.range, `${p}.range`, 1, 4096), floorOnHit: r.bool(q.floorOnHit, `${p}.floorOnHit`) };
  }
  if (out.repairGroup && o.repairGroup) { const q = o.repairGroup as Record<string, unknown>; if (q.finishBelow !== undefined) out.repairGroup.finishBelow = r.num(q.finishBelow, `${path}.repairGroup.finishBelow`, .001, 1); if (q.refillProtection !== undefined) { out.repairGroup.refillProtection = r.bool(q.refillProtection, `${path}.repairGroup.refillProtection`); if (out.repairGroup.finishBelow === undefined) r.bad(`${path}.repairGroup.refillProtection`, 'requires finishBelow'); } }
  if (o.turnFromSpeed !== undefined) out.turnFromSpeed = r.list(o.turnFromSpeed, `${path}.turnFromSpeed`, 2, 2).map((v, i) => r.num(v, `${path}.turnFromSpeed[${i}]`, 0, 4)) as [number, number];
  if (o.abandon !== undefined) { const q = r.obj(o.abandon, `${path}.abandon`, ['label', 'seconds']); if (!out.crew || !out.reserve) r.bad(`${path}.abandon`, 'requires source crew and reserve state'); out.abandon = { label: r.text(q.label, `${path}.abandon.label`), seconds: r.num(q.seconds, `${path}.abandon.seconds`, .01, 600) }; }
  if (o.failureDelay !== undefined) out.failureDelay = r.num(o.failureDelay, `${path}.failureDelay`, 0, 60);
  if (o.clearOrdersWhenImmobile !== undefined) out.clearOrdersWhenImmobile = r.bool(o.clearOrdersWhenImmobile, `${path}.clearOrdersWhenImmobile`);
  if (o.blast !== undefined) {
    const p = `${path}.blast`, q = r.obj(o.blast, p, ['family', 'base', 'armorScale', 'coefficient', 'minimumDistance']);
    const family = r.id(q.family, `${p}.family`);
    if (!out.protection?.families[family]) r.bad(`${p}.family`, 'requires a matching armor family');
    out.blast = { family, base: r.num(q.base, `${p}.base`, 0.001, 1e6), armorScale: r.num(q.armorScale, `${p}.armorScale`, 0, 1e6), coefficient: r.num(q.coefficient, `${p}.coefficient`, 0, 1e6), minimumDistance: r.num(q.minimumDistance, `${p}.minimumDistance`, 0, 4096) };
  } else if (out.parts.some(p => p.blast) || out.reserve?.blast) r.bad(path, 'blast response bands require a blast pressure policy');
  if (!out.protection && !out.parts.length && !out.services?.length && !out.experience && !out.sourceCombat && !out.sourceInfantry && !out.sourceArmor && !out.sourceMovement && !out.achievements && !out.smoke) r.bad(path, 'requires protection, parts or a service');
  return issues.length === start ? out : undefined;
}

export function readComponentsWeapon(value: unknown, path: string, issues: ModuleIssue[], _context?: ExtensionSpecContext, depth=0): ComponentPayload | undefined {
  const start = issues.length, r = new ModuleReader(issues);
  const o = r.obj(value, path, ['family', 'penetration', 'hullDamage', 'strength', 'diameter', 'channels', 'wear', 'top', 'jitter', 'rangeAdjustment', 'ricochet', 'residual', 'weakHit', 'rangeOrigin', 'wearFaces', 'layerScale', 'collateralHullDamage', 'blast', 'recipient', 'channelScale', 'experience', 'interruptRepair', 'bearingOrigin', 'sourceWeak', 'exposureFace', 'friendlyFire', 'positiveArmor', 'ordinary', 'sourceHelper', 'incoming', 'hpPhases', 'spawned','motion','fragments','warmup']);
  const out: ComponentPayload = { family: r.id(o.family, `${path}.family`), penetration: r.num(o.penetration, `${path}.penetration`, 0, 100000), hullDamage: r.num(o.hullDamage, `${path}.hullDamage`, 0, 1000000, 0), strength: r.num(o.strength, `${path}.strength`, 0, 1000000, 0), diameter: r.num(o.diameter, `${path}.diameter`, 0, 10, 1), channels: {}, wear: r.num(o.wear, `${path}.wear`, 0, 1, 0), top: r.bool(o.top, `${path}.top`), jitter: r.range(o.jitter, `${path}.jitter`, 0, 4, [1, 1]), rangeAdjustment: [0, 0, 0] };
  if(o.motion!==undefined){
    const p=`${path}.motion`,v=r.obj(o.motion,p,['life','speed','speedSpread','spread','vx','vy','vz','gravity','trueGravity','targetHeight','height','targetSpeed','acceleration','turn','nearTurn','delay','ground','includeHeight','noLead','end']);
    const m={} as ProjectileMotion;
    for(const key of ['life','speed','speedSpread','spread','targetSpeed','acceleration','delay'] as const)m[key]=r.num(v[key],`${p}.${key}`,0,key==='life'||key==='delay'?3600:1e5);
    for(const key of ['vx','vy','vz','gravity','trueGravity','targetHeight','height','turn','nearTurn'] as const)m[key]=r.num(v[key],`${p}.${key}`,-1e5,1e5);
    for(const key of ['ground','includeHeight','noLead','end'] as const)m[key]=r.bool(v[key],`${p}.${key}`);
    if(m.life<=0||m.speedSpread>m.speed)r.bad(p,'invalid source projectile lifetime or speed spread');out.motion=m;
  }
  if(o.warmup!==undefined){const p=`${path}.warmup`,v=r.obj(o.warmup,p,['seconds','decay']);out.warmup={seconds:r.num(v.seconds,`${p}.seconds`,.001,3600),decay:r.num(v.decay,`${p}.decay`,0,1000)};}
  if (o.channels !== undefined && !(o.channels && typeof o.channels === 'object' && !Array.isArray(o.channels) && Object.getPrototypeOf(o.channels) === Object.prototype && Object.keys(o.channels).length === 0)) out.channels = Object.fromEntries(r.keyed(o.channels, `${path}.channels`, 16).map(([id, value]) => {
    const p = `${path}.channels.${id}`, c = r.obj(value, p, ['strong', 'weak', 'faces']);
    const channel: DamageChannel = { strong: r.range(c.strong, `${p}.strong`, 0, 100), weak: r.range(c.weak, `${p}.weak`, 0, 100) };
    if (c.faces !== undefined) {
      const f = r.obj(c.faces, `${p}.faces`, FACES); channel.faces = {};
      for (const face of FACES) if (f[face] !== undefined) { const b = r.obj(f[face], `${p}.faces.${face}`, ['strong', 'weak']); channel.faces[face] = { strong: r.range(b.strong, `${p}.faces.${face}.strong`, 0, 100), weak: r.range(b.weak, `${p}.faces.${face}.weak`, 0, 100) }; }
    }
    return [id, channel];
  }));
  if (o.rangeAdjustment !== undefined) out.rangeAdjustment = r.list(o.rangeAdjustment, `${path}.rangeAdjustment`, 3, 3).map((n, i) => r.num(n, `${path}.rangeAdjustment[${i}]`, -100000, 100000)) as [number, number, number];
  if (o.ricochet !== undefined) { const q = r.obj(o.ricochet, `${path}.ricochet`, ['cosine', 'requiresNominalBlock']); out.ricochet = { cosine: r.num(q.cosine, `${path}.ricochet.cosine`, 0, 1), requiresNominalBlock: r.bool(q.requiresNominalBlock, `${path}.ricochet.requiresNominalBlock`, true) }; }
  if (o.residual !== undefined) { const q = r.obj(o.residual, `${path}.residual`, ['base', 'scale', 'max']); out.residual = { base: r.num(q.base, `${path}.residual.base`, 0, 10), scale: r.num(q.scale, `${path}.residual.scale`, 0, 10), max: r.num(q.max, `${path}.residual.max`, 0, 10) }; }
  if (o.ordinary !== undefined) {
    const p = `${path}.ordinary`, q = r.obj(o.ordinary, p, ['ignore', 'multipliers']);
    out.ordinary = { ignore: r.num(q.ignore, `${p}.ignore`, 0, 1e9), multipliers: r.list(q.multipliers, `${p}.multipliers`, 64).map((v, i) => {
      const t = `${p}.multipliers[${i}]`, m = r.obj(v, t, ['tag', 'value']);
      if (typeof m.tag !== 'string' || !m.tag.length || m.tag.length > 120) r.bad(`${t}.tag`, 'invalid source tag');
      return { tag: typeof m.tag === 'string' ? m.tag : '', value: r.num(m.value, `${t}.value`, 0, 1000) };
    }) };
  }
  if (o.friendlyFire !== undefined) out.friendlyFire = r.bool(o.friendlyFire, `${path}.friendlyFire`);
  if (o.positiveArmor !== undefined) out.positiveArmor = r.bool(o.positiveArmor, `${path}.positiveArmor`);
  if(o.hpPhases!==undefined)out.hpPhases=r.list(o.hpPhases,`${path}.hpPhases`,4).map((raw,i)=>{
    const p=`${path}.hpPhases[${i}]`,v=r.obj(raw,p,['direct','area','radius','ignore','fromEdge','noFalloff','friendly','targetGround','mutators','expand','forest']);
    const tagList=(raw:unknown,q:string)=>r.list(raw,q,32).map((v,j)=>{if(typeof v!=='string'||!v.length||v.length>80){r.bad(`${q}[${j}]`,'invalid tag');return '';}return v;});
    const mutators=r.list(v.mutators,`${p}.mutators`,32).map((raw,j)=>{const q=`${p}.mutators[${j}]`,m=r.obj(raw,q,['with','without','direct','area']);return {with:tagList(m.with,`${q}.with`),without:tagList(m.without,`${q}.without`),direct:r.num(m.direct,`${q}.direct`,0,10000),area:r.num(m.area,`${q}.area`,0,10000)};});
    return {direct:r.num(v.direct,`${p}.direct`,0,1e7),area:r.num(v.area,`${p}.area`,0,1e7),radius:r.num(v.radius,`${p}.radius`,0,4096),ignore:r.num(v.ignore,`${p}.ignore`,0,1e9),fromEdge:r.bool(v.fromEdge,`${p}.fromEdge`),noFalloff:r.bool(v.noFalloff,`${p}.noFalloff`),friendly:r.bool(v.friendly,`${p}.friendly`),targetGround:r.bool(v.targetGround,`${p}.targetGround`),mutators,...(v.expand!==undefined?{expand:r.num(v.expand,`${p}.expand`,.001,60)}:{}),...(v.forest!==undefined?{forest:r.bool(v.forest,`${p}.forest`)}:{})};
  });
  if(o.spawned!==undefined){
    if(depth>0)r.bad(`${path}.spawned`,'nested helper spawn chains are not supported');
    else out.spawned=r.list(o.spawned,`${path}.spawned`,64,1).flatMap((raw,i)=>{const p=`${path}.spawned[${i}]`,v=r.obj(raw,p,['x','y','payload']),payload=readComponentsWeapon(v.payload,`${p}.payload`,issues,undefined,depth+1);return payload?[{x:r.num(v.x,`${p}.x`,-4096,4096),y:r.num(v.y,`${p}.y`,-4096,4096),payload}]:[];});
  }
  if(o.fragments!==undefined){
    const p=`${path}.fragments`,v=r.obj(o.fragments,p,['penetrated','blocked','offset','ricochet','rounds']);
    if(depth>1)r.bad(p,'fragment chains cannot contain more fragments');
    else{
      const rounds=r.list(v.rounds,`${p}.rounds`,3,2).flatMap((raw,i)=>{const q=`${p}.rounds[${i}]`,v=r.obj(raw,q,['motion','hpPhases','family','penetration','hullDamage','strength','diameter','channels','wear','top','jitter','rangeAdjustment']),payload=readComponentsWeapon({family:'ordinary',penetration:0,...v},q,issues,undefined,2);return payload?[payload]:[];});
      out.fragments={penetrated:r.num(v.penetrated,`${p}.penetrated`,0,32),blocked:r.num(v.blocked,`${p}.blocked`,0,32),offset:r.num(v.offset,`${p}.offset`,0,1024),rounds,...(v.ricochet!==undefined?{ricochet:r.num(v.ricochet,`${p}.ricochet`,0,1024)}:{})};
      if(!Number.isInteger(out.fragments.penetrated)||!Number.isInteger(out.fragments.blocked)||rounds.some(p=>!p.motion||!p.hpPhases)||v.ricochet!==undefined&&rounds.length!==3)r.bad(p,'invalid source fragment family');
    }
  }
  if(o.incoming!==undefined){
    const p=`${path}.incoming`,v=r.obj(o.incoming,p,['tags','end','child']);
    const tags=(raw:unknown,q:string)=>r.list(raw,q,32).map((t,i)=>{if(typeof t!=='string'||!t.length||t.length>80){r.bad(`${q}[${i}]`,'invalid projectile tag');return '';}return t;});
    out.incoming={tags:tags(v.tags,`${p}.tags`),end:r.bool(v.end,`${p}.end`)};
    if(v.child!==undefined){const q=`${p}.child`,c=r.obj(v.child,q,['chance','angle','life','speed','tags']);out.incoming.child={chance:r.num(c.chance,`${q}.chance`,0,1),angle:r.num(c.angle,`${q}.angle`,0,Math.PI*2),life:r.num(c.life,`${q}.life`,.001,3600),speed:r.num(c.speed,`${q}.speed`,0,100000),tags:tags(c.tags,`${q}.tags`)};}
  }
  if (o.sourceHelper !== undefined) out.sourceHelper = r.bool(o.sourceHelper, `${path}.sourceHelper`);
  if (o.sourceWeak !== undefined) { const q = r.obj(o.sourceWeak, `${path}.sourceWeak`, ['roll', 'multiplier', 'helperParity']); out.sourceWeak = { roll: r.num(q.roll, `${path}.sourceWeak.roll`, 1, 1000), multiplier: r.num(q.multiplier, `${path}.sourceWeak.multiplier`, 0, 1), ...(q.helperParity !== undefined ? { helperParity: r.bool(q.helperParity, `${path}.sourceWeak.helperParity`) } : {}) }; if (out.sourceWeak.helperParity && !out.sourceHelper) r.bad(`${path}.sourceWeak.helperParity`, 'requires source helper creation'); }
  if (o.weakHit !== undefined) { const q = r.obj(o.weakHit, `${path}.weakHit`, ['chance', 'multiplier']); out.weakHit = { chance: r.num(q.chance, `${path}.weakHit.chance`, 0, 1), multiplier: r.num(q.multiplier, `${path}.weakHit.multiplier`, 0, 1) }; }
  if (o.interruptRepair !== undefined) out.interruptRepair = r.bool(o.interruptRepair, `${path}.interruptRepair`);
  if (o.bearingOrigin !== undefined) { if (o.bearingOrigin !== 'source' && o.bearingOrigin !== 'projectile') r.bad(`${path}.bearingOrigin`, 'must be source or projectile'); else out.bearingOrigin = o.bearingOrigin; }
  if (o.experience !== undefined) out.experience = r.bool(o.experience, `${path}.experience`);
  if (o.recipient !== undefined) { const q = r.obj(o.recipient, `${path}.recipient`, ['range', 'radiusSquared']); out.recipient = { range: r.num(q.range, `${path}.recipient.range`, .1, 4096), radiusSquared: r.num(q.radiusSquared, `${path}.recipient.radiusSquared`, .01, 100) }; }
  if (o.exposureFace !== undefined) { if (!FACES.includes(o.exposureFace as Face)) r.bad(`${path}.exposureFace`, 'must be a face'); else out.exposureFace = o.exposureFace as Face; }
  if (o.channelScale !== undefined) out.channelScale = Object.fromEntries(r.keyed(o.channelScale, `${path}.channelScale`, 32).map(([id, value]) => [id, r.num(value, `${path}.channelScale.${id}`, 0, 100)]));
  if (o.rangeOrigin !== undefined) { if (o.rangeOrigin !== 'launch' && o.rangeOrigin !== 'source') r.bad(`${path}.rangeOrigin`, 'must be launch or source'); else out.rangeOrigin = o.rangeOrigin; }
  if (o.wearFaces !== undefined) { const q = r.obj(o.wearFaces, `${path}.wearFaces`, FACES); out.wearFaces = {}; for (const face of FACES) if (q[face] !== undefined) { if (!FACES.includes(q[face] as Face)) r.bad(`${path}.wearFaces.${face}`, 'must be a face'); else out.wearFaces[face] = q[face] as Face; } }
  if (o.layerScale !== undefined) out.layerScale = faces(r, o.layerScale, `${path}.layerScale`, 4);
  if (o.collateralHullDamage !== undefined) out.collateralHullDamage = r.num(o.collateralHullDamage, `${path}.collateralHullDamage`, 0, 1e6);
  if (o.blast !== undefined) { const q = r.obj(o.blast, `${path}.blast`, ['yield', 'radius', 'poolCountOffset', 'penetration', 'combined', 'forest']); out.blast = { yield: r.num(q.yield, `${path}.blast.yield`, 0, 10000), radius: r.num(q.radius, `${path}.blast.radius`, 0.1, 4096), poolCountOffset: r.num(q.poolCountOffset, `${path}.blast.poolCountOffset`, 0, 4, 0), penetration: r.bool(q.penetration, `${path}.blast.penetration`), combined: r.bool(q.combined, `${path}.blast.combined`) }; if (q.forest !== undefined) { const p = `${path}.blast.forest`, f = r.obj(q.forest, p, ['search', 'radius', 'infantry']); out.blast.forest = { search: r.num(f.search, `${p}.search`, .1, 4096), radius: r.num(f.radius, `${p}.radius`, .1, out.blast.radius), infantry: r.num(f.infantry, `${p}.infantry`, 0, 10) }; } }
  return issues.length === start ? out : undefined;
}
/** An achievement's reward form is created by the module, never by a production line. */
export function validateComponentsReferences(def: import('../../../../../../steel-tide/game/core/src/core/types').UnitDef, table: Record<string, import('../../../../../../steel-tide/game/core/src/core/types').UnitDef>, path: string, issues: import('../../../../../../steel-tide/game/core/src/game/contentDefs').ContentIssue[], forms?: Set<string>): void {
  const spec = def.extensions?.['components-v1'] as ComponentsDef | undefined;
  const mounts = new Set(((def.extensions?.['articulation-v1'] as { mounts?: { id: string }[] } | undefined)?.mounts ?? []).map(m => m.id));
  const points = [...(spec?.smoke?.grenades?.launchers ?? []), ...(spec?.smoke?.engine ? [spec.smoke.engine.point] : [])];
  for (const point of points) if (point.mount && !mounts.has(point.mount)) issues.push({ path: `${path}.smoke`, message: `smoke launcher rides unknown mount ${point.mount}` });
  for (const [i, a] of (spec?.achievements ?? []).entries()) {
    if (!a.to) continue;
    forms?.add(a.to);
    const to = table[a.to];
    if (!to || to.kind !== def.kind || to.domain !== def.domain) issues.push({ path: `${path}.achievements[${i}].to`, message: 'must name a form of the same kind and domain' });
  }
}
