import type { TextTuple } from '../../../../steel-tide/game/core/src/core/i18n';
import type { ExtensionSpecContext } from '../../../../steel-tide/game/core/src/game/extensions/contracts';

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
}
export interface BlastBand { above: number; damage: [number, number]; scale: 'part' | 'pressure-part' | 'yield-pressure-part' }
export interface StockThreshold { stocks: string[]; perMissing: number; strict: boolean; rebaseOnRefill: boolean }
export interface PartDef {
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
}
export interface ComponentsDef {
  protection?: ProtectionDef;
  parts: PartDef[];
  crew?: CrewDef;
  /** Remaining repair progress after a hit, 0 discards it and 1 retains it. */
  repairHitRetention: number;
  /** Tags this entity offers as a stationary or mobile repair provider. */
  services?: string[];
  reserve?: {
    label: TextTuple; capacity: number; hpPerMember: number; damageHp: number; channel: string; exposure: Faces;
    seconds: number; priority: string[]; roundHealth: boolean; refillCosts: Record<string, number>;
    empty?: ComponentEffects; blast?: BlastBand[];
  };
  repairGroup?: { interval: number; priority: string[]; provider: string; range: number; floorOnHit: boolean; finishBelow?: number; refillProtection?: boolean; beginRefill?: string };
  /** [offset, scale] of the composed movement multiplier, relative to base turn rate. */
  turnFromSpeed?: [number, number];
  failureDelay?: number;
  clearOrdersWhenImmobile?: boolean;
  blast?: { family: string; base: number; armorScale: number; coefficient: number; minimumDistance: number };
}
export interface DamageChannel {
  strong: [number, number]; weak: [number, number];
  faces?: Partial<Record<Face, { strong: [number, number]; weak: [number, number] }>>;
}
export interface ComponentPayload {
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
  weakHit?: { chance: number; multiplier: number };
  rangeOrigin?: 'launch' | 'source';
  wearFaces?: Partial<Record<Face, Face>>;
  layerScale?: Faces;
  /** Explicit collateral hull policy; omitted retains legacy collateral damage. */
  collateralHullDamage?: number;
  /** Yield drives a recipient's authored blast pressure response, independently of penetration. */
  blast?: { yield: number; radius: number; poolCountOffset: number; penetration: boolean };
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
  const o = r.obj(value, path, ['protection', 'parts', 'crew', 'repairHitRetention', 'services', 'reserve', 'repairGroup', 'turnFromSpeed', 'failureDelay', 'clearOrdersWhenImmobile', 'blast']);
  const out: ComponentsDef = { parts: [], repairHitRetention: r.num(o.repairHitRetention, `${path}.repairHitRetention`, 0, 1, 1) };
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
    const p = `${path}.parts[${i}]`, c = r.obj(raw, p, ['id', 'label', 'hp', 'channel', 'exposure', 'damagedAt', 'damaged', 'destroyed', 'failure', 'repairs', 'crew', 'damageLimit', 'stockThreshold', 'damagedBelow', 'latchDamaged', 'blast']);
    const part: PartDef = { id: r.id(c.id, `${p}.id`), label: r.text(c.label, `${p}.label`), hp: r.num(c.hp, `${p}.hp`, 1, 1000000), channel: r.id(c.channel, `${p}.channel`), exposure: faces(r, c.exposure, `${p}.exposure`, 10), damagedAt: r.num(c.damagedAt, `${p}.damagedAt`, 0.01, 0.99, 0.65) };
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
      const rp = `${p}.repairs[${j}]`, q = r.obj(rawRepair, rp, ['seconds', 'toDamage', 'fromDamage', 'provider', 'range', 'stationary', 'auto', 'metal', 'startAbove', 'untilDamage']);
      const policy: RepairPolicy = { seconds: r.num(q.seconds, `${rp}.seconds`, 0.1, 3600), toDamage: r.num(q.toDamage, `${rp}.toDamage`, 0, 0.99, 0), fromDamage: r.num(q.fromDamage, `${rp}.fromDamage`, 0, 1, part.damagedAt), stationary: r.bool(q.stationary, `${rp}.stationary`, true), auto: r.bool(q.auto, `${rp}.auto`), metal: r.num(q.metal, `${rp}.metal`, 0, 100000, 0) };
      if (policy.toDamage >= policy.fromDamage) r.bad(rp, 'repair must reduce damage');
      if (q.startAbove !== undefined) policy.startAbove = r.num(q.startAbove, `${rp}.startAbove`, policy.fromDamage, 100);
      if (q.untilDamage !== undefined) policy.untilDamage = r.num(q.untilDamage, `${rp}.untilDamage`, policy.fromDamage + 0.001, 100);
      if (q.provider !== undefined) { policy.provider = r.id(q.provider, `${rp}.provider`); policy.range = r.num(q.range, `${rp}.range`, 1, 4096); }
      else if (q.range !== undefined) r.bad(`${rp}.range`, 'range needs a provider');
      return policy;
    });
    return part;
  });
  if (new Set(out.parts.map(p => p.id)).size !== out.parts.length) r.bad(`${path}.parts`, 'duplicate part IDs');
  if (o.services !== undefined) out.services = r.ids(o.services, `${path}.services`, 16);
  if (o.crew !== undefined) {
    const p = `${path}.crew`, c = r.obj(o.crew, p, ['priority', 'replacements', 'seconds', 'automatic', 'destroyWhenEmpty', 'requiresEmptyReserve', 'vacatedDamage']);
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
    out.crew = crew;
  } else if (out.parts.some(p => p.crew)) r.bad(path, 'crew parts require a crew policy');
  if (o.reserve !== undefined) {
    const p = `${path}.reserve`, q = r.obj(o.reserve, p, ['label', 'capacity', 'hpPerMember', 'damageHp', 'channel', 'exposure', 'seconds', 'priority', 'roundHealth', 'refillCosts', 'empty', 'blast']);
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
    if (q.empty !== undefined) out.reserve.empty = effects(r, q.empty, `${p}.empty`, weapons);
    if (q.blast !== undefined) out.reserve.blast = blastBands(r, q.blast, `${p}.blast`);
  }
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
  if (o.failureDelay !== undefined) out.failureDelay = r.num(o.failureDelay, `${path}.failureDelay`, 0, 60);
  if (o.clearOrdersWhenImmobile !== undefined) out.clearOrdersWhenImmobile = r.bool(o.clearOrdersWhenImmobile, `${path}.clearOrdersWhenImmobile`);
  if (o.blast !== undefined) {
    const p = `${path}.blast`, q = r.obj(o.blast, p, ['family', 'base', 'armorScale', 'coefficient', 'minimumDistance']);
    const family = r.id(q.family, `${p}.family`);
    if (!out.protection?.families[family]) r.bad(`${p}.family`, 'requires a matching armor family');
    out.blast = { family, base: r.num(q.base, `${p}.base`, 0.001, 1e6), armorScale: r.num(q.armorScale, `${p}.armorScale`, 0, 1e6), coefficient: r.num(q.coefficient, `${p}.coefficient`, 0, 1e6), minimumDistance: r.num(q.minimumDistance, `${p}.minimumDistance`, 0.1, 4096) };
  } else if (out.parts.some(p => p.blast) || out.reserve?.blast) r.bad(path, 'blast response bands require a blast pressure policy');
  if (!out.protection && !out.parts.length && !out.services?.length) r.bad(path, 'requires protection, parts or a service');
  return issues.length === start ? out : undefined;
}

export function readComponentsWeapon(value: unknown, path: string, issues: ModuleIssue[]): ComponentPayload | undefined {
  const start = issues.length, r = new ModuleReader(issues);
  const o = r.obj(value, path, ['family', 'penetration', 'hullDamage', 'strength', 'diameter', 'channels', 'wear', 'top', 'jitter', 'rangeAdjustment', 'ricochet', 'residual', 'weakHit', 'rangeOrigin', 'wearFaces', 'layerScale', 'collateralHullDamage', 'blast']);
  const out: ComponentPayload = { family: r.id(o.family, `${path}.family`), penetration: r.num(o.penetration, `${path}.penetration`, 0, 100000), hullDamage: r.num(o.hullDamage, `${path}.hullDamage`, 0, 1000000, 0), strength: r.num(o.strength, `${path}.strength`, 0, 1000000, 0), diameter: r.num(o.diameter, `${path}.diameter`, 0, 10, 1), channels: {}, wear: r.num(o.wear, `${path}.wear`, 0, 1, 0), top: r.bool(o.top, `${path}.top`), jitter: r.range(o.jitter, `${path}.jitter`, 0, 4, [1, 1]), rangeAdjustment: [0, 0, 0] };
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
  if (o.weakHit !== undefined) { const q = r.obj(o.weakHit, `${path}.weakHit`, ['chance', 'multiplier']); out.weakHit = { chance: r.num(q.chance, `${path}.weakHit.chance`, 0, 1), multiplier: r.num(q.multiplier, `${path}.weakHit.multiplier`, 0, 1) }; }
  if (o.rangeOrigin !== undefined) { if (o.rangeOrigin !== 'launch' && o.rangeOrigin !== 'source') r.bad(`${path}.rangeOrigin`, 'must be launch or source'); else out.rangeOrigin = o.rangeOrigin; }
  if (o.wearFaces !== undefined) { const q = r.obj(o.wearFaces, `${path}.wearFaces`, FACES); out.wearFaces = {}; for (const face of FACES) if (q[face] !== undefined) { if (!FACES.includes(q[face] as Face)) r.bad(`${path}.wearFaces.${face}`, 'must be a face'); else out.wearFaces[face] = q[face] as Face; } }
  if (o.layerScale !== undefined) out.layerScale = faces(r, o.layerScale, `${path}.layerScale`, 4);
  if (o.collateralHullDamage !== undefined) out.collateralHullDamage = r.num(o.collateralHullDamage, `${path}.collateralHullDamage`, 0, 1e6);
  if (o.blast !== undefined) { const q = r.obj(o.blast, `${path}.blast`, ['yield', 'radius', 'poolCountOffset', 'penetration']); out.blast = { yield: r.num(q.yield, `${path}.blast.yield`, 0, 10000), radius: r.num(q.radius, `${path}.blast.radius`, 0.1, 4096), poolCountOffset: r.num(q.poolCountOffset, `${path}.blast.poolCountOffset`, 0, 4, 0), penetration: r.bool(q.penetration, `${path}.blast.penetration`) }; }
  return issues.length === start ? out : undefined;
}
