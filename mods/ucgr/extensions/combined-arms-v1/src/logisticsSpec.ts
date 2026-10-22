import type { TextTuple } from '../../../../../../steel-tide/game/core/src/core/i18n';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { ModuleReader, type ModuleIssue } from './componentsSpec';

export interface StockDef { id: string; label: TextTuple; capacity: number; initial: number; refillAfter?: number; queuedReload?: boolean; idleReload?: { after: number; below: number } }
export interface FeedDef { id: string; label: TextTuple; weapons: string[]; selected: string }
export interface ServiceDef {
  id: string; label: TextTuple; mode: 'transfer' | 'refill'; range: number; stocks: string[];
  /** Transfer is conserved, with one shared provider budget in rounds/second. */
  rate?: number;
  /** Refill is an explicitly authored unlimited timed service. */
  seconds?: number;
  stationary: boolean;
  /** Service locks are independent from the requirement to remain stationary. */
  lockMovement: boolean;
  lockWeapons: boolean;
  providerStationary: boolean;
  components: ('crew' | 'protection')[];
}
export interface SuppressionDef {
  label: TextTuple; max: number; decay: number; quiet: number;
  thresholds: { at: number; speed: number; reloadAdd: number; spread: number; disableWeapons: string[] }[];
}
export interface LogisticsDef { serviceSeconds?: Record<string, number>; serviceStocks?: Record<string, string[]>; stocks: StockDef[]; feeds: FeedDef[]; services: ServiceDef[]; suppression?: SuppressionDef }
export interface AccuracyDef {
  base: number; moving: number; targetMoving: number; rangeFactor: number;
  smallTarget?: { radius: number; spread: number };
}
export interface LogisticsWeapon { disabled?: boolean; stock?: string; cost?: number; feed?: string; suppression: number; accuracy?: AccuracyDef }
const rawObject = (v: unknown): Record<string, unknown> | undefined => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : undefined;
function sourceWeapons(ctx?: ExtensionSpecContext): Record<string, unknown>[] {
  return Array.isArray(ctx?.definition?.weapons) ? ctx.definition.weapons.map(rawObject).filter((v): v is Record<string, unknown> => !!v) : [];
}
function unique(r: ModuleReader, ids: string[], path: string): void { if (new Set(ids).size !== ids.length) r.bad(path, 'duplicate identifiers'); }

export function readLogisticsDef(raw: unknown, path: string, issues: ModuleIssue[], ctx?: ExtensionSpecContext): LogisticsDef | undefined {
  const start = issues.length, r = new ModuleReader(issues), o = r.obj(raw, path, ['stocks', 'feeds', 'services', 'suppression', 'serviceSeconds', 'serviceStocks']);
  const weapons = ctx?.weaponIds ?? [], source = sourceWeapons(ctx);
  const stocks = r.list(o.stocks ?? [], `${path}.stocks`, 32).map((raw, i): StockDef => {
    const p = `${path}.stocks[${i}]`, x = r.obj(raw, p, ['id', 'label', 'capacity', 'initial', 'refillAfter', 'idleReload', 'queuedReload']);
    const capacity = r.num(x.capacity, `${p}.capacity`, 1, 100000);
    const s: StockDef = { id: r.id(x.id, `${p}.id`), label: r.text(x.label, `${p}.label`), capacity, initial: r.num(x.initial, `${p}.initial`, 0, capacity, capacity) };
    if (x.refillAfter !== undefined) s.refillAfter = r.num(x.refillAfter, `${p}.refillAfter`, 0.1, 3600);
    if (x.queuedReload !== undefined) { s.queuedReload = r.bool(x.queuedReload, `${p}.queuedReload`); if (!s.refillAfter) r.bad(`${p}.queuedReload`, 'requires a refill duration'); }
    if (x.idleReload !== undefined) {
      const q = `${p}.idleReload`, v = r.obj(x.idleReload, q, ['after', 'below']);
      if (!s.refillAfter) r.bad(q, 'idle discard requires an authored magazine refill');
      s.idleReload = { after: r.num(v.after, `${q}.after`, 0, 3600), below: r.num(v.below, `${q}.below`, .001, capacity) };
    }
    return s;
  });
  unique(r, stocks.map(s => s.id), `${path}.stocks`);
  const feeds = r.list(o.feeds ?? [], `${path}.feeds`, 16).map((raw, i): FeedDef => {
    const p = `${path}.feeds[${i}]`, x = r.obj(raw, p, ['id', 'label', 'weapons', 'selected']);
    const ids = r.ids(x.weapons, `${p}.weapons`, 16);
    if (!ids.length) r.bad(`${p}.weapons`, 'a feed needs at least one weapon');
    for (const id of ids) {
      if (!weapons.includes(id)) r.bad(`${p}.weapons`, `unknown weapon: ${id}`);
      const w = source.find(w => w.id === id);
      if (w?.ammo !== undefined) r.bad(`${p}.weapons`, 'a module feed cannot also use legacy weapon ammo');
      const ext = rawObject(rawObject(w?.extensions)?.['logistics-v1']);
      if (w && ext?.feed !== x.id) r.bad(`${p}.weapons`, `weapon ${id} must name this feed`);
    }
    const selected = r.id(x.selected, `${p}.selected`);
    if (!ids.includes(selected)) r.bad(`${p}.selected`, 'must name a weapon in this feed');
    return { id: r.id(x.id, `${p}.id`), label: r.text(x.label, `${p}.label`), weapons: ids, selected };
  });
  unique(r, feeds.map(f => f.id), `${path}.feeds`); unique(r, feeds.flatMap(f => f.weapons), `${path}.feeds`);
  const services = r.list(o.services ?? [], `${path}.services`, 16).map((raw, i): ServiceDef => {
    const p = `${path}.services[${i}]`, x = r.obj(raw, p, ['id', 'label', 'mode', 'range', 'stocks', 'rate', 'seconds', 'stationary', 'lockMovement', 'lockWeapons', 'providerStationary', 'components']);
    const mode = x.mode === 'transfer' ? 'transfer' : 'refill';
    if (x.mode !== 'transfer' && x.mode !== 'refill') r.bad(`${p}.mode`, 'must be transfer or refill');
    const ids = r.ids(x.stocks ?? [], `${p}.stocks`, 32);
    const components = r.list(x.components ?? [], `${p}.components`, 2).map((c, j) => {
      if (c !== 'crew' && c !== 'protection') r.bad(`${p}.components[${j}]`, 'must be crew or protection');
      return c as 'crew' | 'protection';
    });
    unique(r, components, `${p}.components`);
    if (!ids.length && !components.length) r.bad(p, 'service must supply stocks or components');
    if (mode === 'transfer') {
      if (components.length || x.seconds !== undefined) r.bad(p, 'finite transfer supports stocks and rate only');
      for (const id of ids) if (!stocks.some(s => s.id === id)) r.bad(`${p}.stocks`, `provider has no stock: ${id}`);
    } else if (x.rate !== undefined) r.bad(`${p}.rate`, 'timed refill uses seconds, not a transfer rate');
    const stationary = r.bool(x.stationary, `${p}.stationary`, true);
    return { id: r.id(x.id, `${p}.id`), label: r.text(x.label, `${p}.label`), mode, range: r.num(x.range, `${p}.range`, 1, 4096), stocks: ids,
      ...(mode === 'transfer' ? { rate: r.num(x.rate, `${p}.rate`, 0.001, 10000) } : { seconds: r.num(x.seconds, `${p}.seconds`, 0.1, 3600) }), stationary,
      lockMovement: r.bool(x.lockMovement, `${p}.lockMovement`, stationary),
      lockWeapons: r.bool(x.lockWeapons, `${p}.lockWeapons`, stationary),
      providerStationary: r.bool(x.providerStationary, `${p}.providerStationary`, stationary), components };
  });
  unique(r, services.map(s => s.id), `${path}.services`);
  let suppression: SuppressionDef | undefined;
  if (o.suppression !== undefined) {
    const p = `${path}.suppression`, x = r.obj(o.suppression, p, ['label', 'max', 'decay', 'quiet', 'thresholds']);
    const max = r.num(x.max, `${p}.max`, 1, 100000);
    const thresholds = r.list(x.thresholds, `${p}.thresholds`, 8, 1).map((raw, i) => {
      const q = `${p}.thresholds[${i}]`, v = r.obj(raw, q, ['at', 'speed', 'reloadAdd', 'spread', 'disableWeapons']);
      const ids = r.ids(v.disableWeapons ?? [], `${q}.disableWeapons`, 16);
      for (const id of ids) if (!weapons.includes(id)) r.bad(`${q}.disableWeapons`, `unknown weapon: ${id}`);
      return { at: r.num(v.at, `${q}.at`, 0.001, max), speed: r.num(v.speed, `${q}.speed`, 0, 1, 1), reloadAdd: r.num(v.reloadAdd, `${q}.reloadAdd`, 0, 20, 0), spread: r.num(v.spread, `${q}.spread`, 0, 512, 0), disableWeapons: ids };
    });
    if (thresholds.some((t, i) => i > 0 && t.at <= thresholds[i - 1].at)) r.bad(`${p}.thresholds`, 'thresholds must be strictly increasing; only the highest reached applies');
    suppression = { label: r.text(x.label, `${p}.label`), max, decay: r.num(x.decay, `${p}.decay`, 0.001, 100000), quiet: r.num(x.quiet, `${p}.quiet`, 0, 3600, 0), thresholds };
  }
  let serviceSeconds: Record<string, number> | undefined;
  if (o.serviceSeconds !== undefined) {
    const values = r.obj(o.serviceSeconds, `${path}.serviceSeconds`, Object.keys(rawObject(o.serviceSeconds) ?? {}));
    if (Object.keys(values).length > 16) r.bad(`${path}.serviceSeconds`, 'too many service durations');
    serviceSeconds = Object.fromEntries(Object.entries(values).map(([id, seconds]) => [r.id(id, `${path}.serviceSeconds`), r.num(seconds, `${path}.serviceSeconds.${id}`, .1, 3600)]));
  }
  let serviceStocks: Record<string, string[]> | undefined;
  if (o.serviceStocks !== undefined) {
    const values = r.obj(o.serviceStocks, `${path}.serviceStocks`, Object.keys(rawObject(o.serviceStocks) ?? {}));
    if (Object.keys(values).length > 16) r.bad(`${path}.serviceStocks`, 'too many service stock mappings');
    serviceStocks = Object.fromEntries(Object.entries(values).map(([id, raw]) => {
      const ids = r.ids(raw, `${path}.serviceStocks.${id}`, 32);
      for (const stock of ids) if (!stocks.some(s => s.id === stock)) r.bad(`${path}.serviceStocks.${id}`, `unknown recipient stock: ${stock}`);
      return [r.id(id, `${path}.serviceStocks`), ids];
    }));
  }
  if (!stocks.length && !feeds.length && !services.length && !suppression && !serviceSeconds && !serviceStocks) r.bad(path, 'must configure a stock, feed, service or suppression policy');
  return issues.length === start ? { stocks, feeds, services, ...(serviceSeconds ? { serviceSeconds } : {}), ...(serviceStocks ? { serviceStocks } : {}), ...(suppression ? { suppression } : {}) } : undefined;
}

export function readLogisticsWeapon(raw: unknown, path: string, issues: ModuleIssue[], ctx?: ExtensionSpecContext): LogisticsWeapon | undefined {
  const start = issues.length, r = new ModuleReader(issues), o = r.obj(raw, path, ['disabled', 'stock', 'cost', 'feed', 'suppression', 'accuracy']);
  const cfg = rawObject(rawObject(ctx?.definition?.extensions)?.['logistics-v1']);
  const stocks = Array.isArray(cfg?.stocks) ? cfg.stocks.map(rawObject) : [], feeds = Array.isArray(cfg?.feeds) ? cfg.feeds.map(rawObject) : [];
  const w: LogisticsWeapon = { suppression: r.num(o.suppression, `${path}.suppression`, 0, 100000, 0) };
  if (o.disabled !== undefined) w.disabled = r.bool(o.disabled, `${path}.disabled`);
  if (o.stock !== undefined) {
    w.stock = r.id(o.stock, `${path}.stock`);
    w.cost = r.num(o.cost, `${path}.cost`, 0.001, 100000, 1);
    const stock = stocks.find(s => s?.id === w.stock);
    if (ctx?.definition && !stock) r.bad(`${path}.stock`, 'must name a stock on this definition');
    if (stock && typeof stock.capacity === 'number' && w.cost > stock.capacity) r.bad(`${path}.cost`, 'cost exceeds stock capacity');
  } else if (o.cost !== undefined) r.bad(`${path}.cost`, 'requires a stock');
  if (o.feed !== undefined) {
    w.feed = r.id(o.feed, `${path}.feed`);
    if (ctx?.definition && !feeds.some(f => f?.id === w.feed)) r.bad(`${path}.feed`, 'must name a feed on this definition');
  }
  if (o.accuracy !== undefined) {
    const p = `${path}.accuracy`, x = r.obj(o.accuracy, p, ['base', 'moving', 'targetMoving', 'rangeFactor', 'smallTarget']);
    w.accuracy = { base: r.num(x.base, `${p}.base`, 0, 512, 0), moving: r.num(x.moving, `${p}.moving`, 0, 512, 0), targetMoving: r.num(x.targetMoving, `${p}.targetMoving`, 0, 512, 0), rangeFactor: r.num(x.rangeFactor, `${p}.rangeFactor`, 0, 2, 0) };
    if (x.smallTarget !== undefined) {
      const q = `${p}.smallTarget`, v = r.obj(x.smallTarget, q, ['radius', 'spread']);
      w.accuracy.smallTarget = { radius: r.num(v.radius, `${q}.radius`, 0.1, 1024), spread: r.num(v.spread, `${q}.spread`, 0, 512) };
    }
  }
  // Local weapon validation is repeated here because the reader receives the full definition.
  for (const source of sourceWeapons(ctx)) if (rawObject(rawObject(source.extensions)?.['logistics-v1']) === raw) {
    if ((w.stock || w.feed) && source.ammo !== undefined) r.bad(path, 'module ammunition cannot be combined with legacy ammo');
    if (w.feed) {
      const feed = feeds.find(f => f?.id === w.feed);
      if (!Array.isArray(feed?.weapons) || !feed.weapons.includes(source.id)) r.bad(`${path}.feed`, 'the feed must include this weapon');
    }
    if (w.accuracy && (source.homing || source.projectile === 'flame' || source.projectile === 'fire' || source.projectile === 'smoke')) r.bad(`${path}.accuracy`, 'scatter requires a non-homing discrete projectile');
  }
  return issues.length === start ? w : undefined;
}
