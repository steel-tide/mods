import { t } from './strings';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { DEFS, getDef } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { DamageContext, EngineModuleInstance, Json, ModuleAction, ModuleHost, ModuleOrder, ModuleStatusRow, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { LogisticsDef, LogisticsWeapon, ServiceDef, SuppressionDef } from './logisticsSpec';
import { refillComponentState, refillComponentStocks, componentNeedsRefill } from './components';

interface FeedState { selected: string; remaining: number }
interface ServiceTask { provider: number; service: string; progress: number }
interface LogisticsState {
  form: string; idle: number; reloadStartSerial: Record<string, number>; reloadSerial: Record<string, number>; stocks: Record<string, number>; refill: Record<string, number>;
  feeds: Record<string, FeedState>; suppression: number; quiet: number; service?: ServiceTask;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const only = (v: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(v).every(k => keys.includes(k));
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function plain<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }
function moved(e: Ent): boolean { return Math.hypot(e.x - e.prevX, e.y - e.prevY) > 0.01; }
const runtimes = new WeakMap<Game, LogisticsModule>();

/** Monotonic completion counters distinguish magazine reloads from depot service. */
export function logisticsReloadSerial(game: Game, entity: Ent, id: string): number {
  return runtimes.get(game)?.reloadSerial(entity, id) ?? 0;
}

export function logisticsReloadStartSerial(game: Game, entity: Ent, id: string): number {
  return runtimes.get(game)?.reloadStartSerial(entity, id) ?? 0;
}

/** Optional component policies query real carried stock, never a copied count. */
export function logisticsStock(game: Game, entity: Ent, id: string): { amount: number; capacity: number } | undefined {
  return runtimes.get(game)?.stock(entity, id);
}
/** Explicit action costs use the same stock; failure leaves all counts intact. */
export function logisticsTakeStock(game:Game,entity:Ent,id:string,amount:number):boolean {
  return runtimes.get(game)?.takeStock(entity,id,amount)??false;
}
export function logisticsRefillsComponent(game: Game, entity: Ent, component: 'crew' | 'protection'): boolean {
  return runtimes.get(game)?.refillsComponent(entity, component) ?? false;
}

/** Authored cross-module action uses the ordinary supply eligibility/order path. */
export function beginComponentRefill(game: Game, entity: Ent, service: string): boolean {
  return runtimes.get(game)?.beginRefill(entity, service) ?? false;
}

/** Stores, feeds and services live only on a match which requested this module. */
export class LogisticsModule implements EngineModuleInstance {
  readonly id = 'logistics-v1' as const;
  private readonly states = new Map<number, LogisticsState>();
  private readonly suppressedBy = new WeakMap<Proj, Set<number>>();
  constructor(private readonly host: ModuleHost) { runtimes.set(host.game, this); }
  reloadStartSerial(entity: Ent, id: string): number { return this.ensure(entity)?.reloadStartSerial[id] ?? 0; }
  reloadSerial(entity: Ent, id: string): number { return this.ensure(entity)?.reloadSerial[id] ?? 0; }
  stock(entity: Ent, id: string): { amount: number; capacity: number } | undefined {
    const stock = this.config(entity)?.stocks.find(s => s.id === id), state = this.ensure(entity);
    return stock && state ? { amount: state.stocks[id], capacity: stock.capacity } : undefined;
  }
  takeStock(entity:Ent,id:string,amount:number):boolean {
    if(!Number.isFinite(amount)||amount<0)return false;
    const stock=this.stock(entity,id),state=this.ensure(entity);
    if(!stock||!state||stock.amount<amount)return false;
    state.stocks[id]-=amount;if(amount)state.idle=0;return true;
  }
  refillsComponent(entity: Ent, component: 'crew' | 'protection'): boolean {
    const task = this.ensure(entity)?.service;
    return !!task && !!this.service(entity, task)?.definition.components.includes(component);
  }
  private config(e: Ent): LogisticsDef | undefined { return this.host.config<LogisticsDef>(getDef(e.defId)); }
  private ensure(e: Ent): LogisticsState | undefined {
    const cfg = this.config(e); if (!cfg) return;
    const old = this.states.get(e.id); if (old?.form === e.defId) return old;
    const previous = old && DEFS[old.form] ? this.host.config<LogisticsDef>(DEFS[old.form]) : undefined;
    if (old && previous && JSON.stringify(previous) === JSON.stringify(cfg)) { old.form = e.defId; return old; }
    const state: LogisticsState = { form: e.defId, idle: old?.idle ?? 0, reloadSerial: { ...old?.reloadSerial }, reloadStartSerial: { ...old?.reloadStartSerial }, stocks: {}, refill: {}, feeds: {}, suppression: Math.min(cfg.suppression?.max ?? 0, old?.suppression ?? 0), quiet: Math.min(cfg.suppression?.quiet ?? 0, old?.quiet ?? 0) };
    for (const stock of cfg.stocks) state.stocks[stock.id] = Math.min(stock.capacity, old?.stocks[stock.id] ?? stock.initial);
    for (const feed of cfg.feeds) {
      const held = old?.feeds[feed.id];
      state.feeds[feed.id] = { selected: held && feed.weapons.includes(held.selected) ? held.selected : feed.selected, remaining: held?.remaining ?? 0 };
    }
    this.states.set(e.id, state); return state;
  }
  private threshold(e: Ent): SuppressionDef['thresholds'][number] | undefined {
    const cfg = this.config(e), s = this.ensure(e);
    const thresholds = cfg?.suppression?.thresholds ?? [];
    for (let i = thresholds.length - 1; i >= 0; i--) if (thresholds[i].at <= (s?.suppression ?? 0)) return thresholds[i];
    return undefined;
  }
  private service(e: Ent, task: ServiceTask): { provider: Ent; definition: ServiceDef; state: LogisticsState } | undefined {
    const st = this.host.game.st, p = st.ents.get(task.provider), cfg = p ? this.config(p) : undefined;
    if (!p || p === e || p.dead || p.site || p.inside || p.emp || st.players[p.owner]?.team !== st.players[e.owner]?.team) return;
    const d = cfg?.services.find(d => d.id === task.service), state = this.ensure(p);
    if (!d || !state || Math.hypot(p.x - e.x, p.y - e.y) > d.range) return;
    const recipient = this.config(e), seconds = recipient?.serviceSeconds?.[d.id], stocks = recipient?.serviceStocks?.[d.id];
    return { provider: p, definition: d.mode === 'refill' && (seconds !== undefined || stocks !== undefined) ? { ...d, ...(seconds !== undefined ? { seconds } : {}), ...(stocks ? { stocks } : {}) } : d, state };
  }
  canFire(entity: Ent, _def: UnitDef, weapon: WeaponDef): boolean {
    const w = this.host.config<LogisticsWeapon>(weapon), state = this.ensure(entity);
    if (w?.disabled) return false;
    if (state?.service && this.service(entity, state.service)?.definition.lockWeapons) return false;
    if (this.threshold(entity)?.disableWeapons.includes(weapon.id)) return false;
    if (!w) return true;
    const continuation = entity.burstLeft > 0 && _def.weapons[entity.burstWi]?.id === weapon.id;
    if (!continuation && w.stock && (!state || (state.stocks[w.stock] ?? 0) + 1e-9 < (w.cost ?? 1))) return false;
    if (w.feed) {
      const feed = state?.feeds[w.feed];
      if (!feed || feed.selected !== weapon.id || !continuation && feed.remaining > 1e-8) return false;
    }
    return true;
  }
  spendRound(entity: Ent, definition: UnitDef, index: number): void {
    const weapon = definition.weapons[index], w = this.host.config<LogisticsWeapon>(weapon), state = this.ensure(entity);
    if (!w || !state) return;
    state.idle = 0;
    if (w.stock) state.stocks[w.stock] = Math.max(0, state.stocks[w.stock] - (w.cost ?? 1));
    if (w.feed && state.feeds[w.feed]) {
      // The core has already assigned the real reload, including abilities and rules.
      const reload = Math.max(0, entity.wcd[index] ?? weapon.reload);
      state.feeds[w.feed].remaining = reload;
      const ids = this.config(entity)?.feeds.find(f => f.id === w.feed)?.weapons ?? [];
      definition.weapons.forEach((w, i) => { if (ids.includes(w.id)) entity.wcd[i] = Math.max(entity.wcd[i] ?? 0, reload); });
    }
  }
  effectiveDef(entity: Ent, definition: UnitDef): UnitDef {
    const cfg = this.config(entity), state = this.ensure(entity); if (!cfg || !state) return definition;
    const threshold = this.threshold(entity), service = state.service && this.service(entity, state.service)?.definition;
    const movementLocked = !!service && service.lockMovement, weaponsLocked = !!service && service.lockWeapons;
    const weapons = definition.weapons.map(w => {
      const feed = cfg.feeds.find(f => f.weapons.includes(w.id));
      const disabled = feed && state.feeds[feed.id].selected !== w.id || threshold?.disableWeapons.includes(w.id) || weaponsLocked;
      if (disabled) return { ...w, targets: [] };
      return threshold?.reloadAdd ? { ...w, reload: w.reload * (1 + threshold.reloadAdd) } : w;
    });
    if (!movementLocked && !threshold && weapons.every((w, i) => w === definition.weapons[i])) return definition;
    return { ...definition, speed: movementLocked ? 0 : definition.speed * (threshold?.speed ?? 1), weapons };
  }
  onShot(entity: Ent, _def: UnitDef, weapon: WeaponDef, p: Proj): void {
    const cfg = this.host.config<LogisticsWeapon>(weapon), a = cfg?.accuracy;
    let spread = this.threshold(entity)?.spread ?? 0;
    if (a) {
      const target = this.host.game.st.ents.get(p.targetId);
      spread += a.base + (moved(entity) ? a.moving : 0) + (target && moved(target) ? a.targetMoving : 0) + Math.hypot(p.tx - p.x, p.ty - p.y) * a.rangeFactor;
      if (target && a.smallTarget && getDef(target.defId).radius <= a.smallTarget.radius) spread += a.smallTarget.spread;
    }
    // Guidance owns homing destinations. Continuous hazards have no discrete aim point.
    if (!(spread > 0) || p.homing || p.kind === 'flame' || p.kind === 'fire' || p.kind === 'smoke') return;
    const rng = this.host.game.st.rng, radius = Math.sqrt(rng.next()) * Math.min(1024, spread), angle = rng.range(-Math.PI, Math.PI);
    p.tx += Math.cos(angle) * radius; p.ty += Math.sin(angle) * radius;
    p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
  }
  onDamage(context: DamageContext): void {
    const entity = context.target, cfg = this.config(entity)?.suppression, state = this.ensure(entity);
    if (!cfg || !state || entity.dead || (!context.impact && context.dealt <= 0)) return;
    const split = context.gun.lastIndexOf('/'), definition = split >= 0 ? DEFS[context.gun.slice(0, split)] : undefined;
    const weapon = definition?.weapons.find(w => w.id === context.gun.slice(split + 1));
    const amount = weapon ? this.host.config<LogisticsWeapon>(weapon)?.suppression ?? 0 : 0;
    if (amount <= 0) return;
    if (context.impact) {
      const p = context.impact.projectile;
      // A blast may call the resolver several times, but one projectile suppresses a unit once.
      const hit = this.suppressedBy.get(p) ?? new Set<number>();
      if (hit.has(entity.id)) return;
      hit.add(entity.id); this.suppressedBy.set(p, hit);
    }
    state.suppression = Math.min(cfg.max, state.suppression + amount); state.quiet = cfg.quiet;
  }
  beforeStep(dt: number): void {
    const st = this.host.game.st;
    for (const id of this.states.keys()) if (!st.ents.has(id) || st.ents.get(id)!.dead) this.states.delete(id);
    const participants = [...this.host.participants()].sort((a, b) => a.id - b.id), budgets = new Map<string, number>();
    for (const e of participants) {
      if (e.dead) continue;
      const cfg = this.config(e), s = this.ensure(e); if (!cfg || !s) continue;
      for (const f of Object.values(s.feeds)) f.remaining = Math.max(0, f.remaining - dt);
      const recovery = Math.max(0, dt - s.quiet); s.quiet = Math.max(0, s.quiet - dt);
      if (cfg.suppression) s.suppression = Math.max(0, s.suppression - recovery * cfg.suppression.decay);
      if (e.site || e.inside || e.emp) continue;
      s.idle = Math.min(3601, s.idle + dt);
      for (const stock of cfg.stocks) {
        if (stock.idleReload && !s.refill[stock.id] && s.idle > stock.idleReload.after && s.stocks[stock.id] < stock.idleReload.below) s.stocks[stock.id] = 0;
        const queued = stock.queuedReload && (s.refill[stock.id] !== undefined || s.stocks[stock.id] < stock.capacity && !e.targetId && !e.orders.length && !s.service);
        if (!stock.refillAfter || !queued && s.stocks[stock.id] > 1e-9) { delete s.refill[stock.id]; continue; }
        if (s.refill[stock.id] === undefined) s.reloadStartSerial[stock.id] = (s.reloadStartSerial[stock.id] ?? 0) + 1;
        s.refill[stock.id] = (s.refill[stock.id] ?? 0) + dt;
        if (s.refill[stock.id] >= stock.refillAfter - 1e-8) { s.stocks[stock.id] = stock.capacity; s.reloadSerial[stock.id] = (s.reloadSerial[stock.id] ?? 0) + 1; delete s.refill[stock.id]; }
      }
      if (!s.service) continue;
      const task = s.service, supply = this.service(e, task);
      if (!supply) { delete s.service; continue; }
      const { provider, definition: d, state: providerState } = supply;
      if (d.stationary && moved(e) || d.providerStationary && moved(provider)) continue;
      if (d.mode === 'transfer') {
        const key = `${provider.id}/${d.id}`;
        let budget = budgets.get(key) ?? d.rate! * dt, transferred = false;
        for (const stock of cfg.stocks) if (d.stocks.includes(stock.id)) {
          const amount = Math.min(Math.max(0, stock.capacity - s.stocks[stock.id]), providerState.stocks[stock.id] ?? 0, budget);
          if (amount <= 0) continue;
          s.stocks[stock.id] += amount; providerState.stocks[stock.id] -= amount; budget -= amount; transferred = true;
        }
        budgets.set(key, budget);
        if (!transferred && cfg.stocks.every(stock => !d.stocks.includes(stock.id) || s.stocks[stock.id] >= stock.capacity - 1e-9 || providerState.stocks[stock.id] <= 1e-9)) delete s.service;
      } else {
        task.progress = Math.min(d.seconds!, task.progress + dt);
        if (task.progress >= d.seconds! - 1e-8) {
          refillComponentStocks(this.host.game, e, d.stocks);
          for (const stock of cfg.stocks) if (d.stocks.includes(stock.id)) { s.stocks[stock.id] = stock.capacity; delete s.refill[stock.id]; }
          for (const part of d.components) refillComponentState(this.host.game, e, part);
          delete s.service;
        }
      }
    }
  }
  private needsService(entity: Ent, service: ServiceDef): boolean {
    const cfg = this.config(entity), s = this.ensure(entity);
    return !!cfg && !!s && (service.components.some(which => componentNeedsRefill(this.host.game, entity, which)) || cfg.stocks.some(stock => service.stocks.includes(stock.id) && s.stocks[stock.id] < stock.capacity));
  }
  beginRefill(entity: Ent, serviceId: string): boolean {
    const state = this.ensure(entity);
    if (!state || state.service) return false;
    for (const provider of this.host.participants()) {
      const service = this.service(entity, { provider: provider.id, service: serviceId, progress: 0 });
      if (service?.definition.mode === 'refill' && service.definition.components.includes('crew') &&
          this.order({ action: 'supply', ids: [entity.id], owner: entity.owner, targetId: provider.id, choice: serviceId })) return true;
    }
    return false;
  }
  order(order: ModuleOrder): boolean {
    let done = false;
    for (const id of order.ids) {
      const e = this.host.game.st.ents.get(id);
      if (!e || e.dead || e.site || e.inside || e.owner !== order.owner) continue;
      const cfg = this.config(e), s = this.ensure(e); if (!cfg || !s) continue;
      if (order.action === 'cancel') { done ||= !!s.service; delete s.service; }
      else if (order.action === 'ammunition' && order.choice) {
        const [feedId, weaponId] = order.choice.split('/'), feed = cfg.feeds.find(f => f.id === feedId);
        if (!feed?.weapons.includes(weaponId) || e.burstLeft > 0) continue;
        s.feeds[feedId].selected = weaponId;
        // A change of ammunition never erases a gun's already-running reload.
        const def = getDef(e.defId), remaining = Math.max(s.feeds[feedId].remaining, ...def.weapons.map((w, i) => feed.weapons.includes(w.id) ? e.wcd[i] ?? 0 : 0));
        s.feeds[feedId].remaining = remaining;
        def.weapons.forEach((w, i) => { if (feed.weapons.includes(w.id)) e.wcd[i] = Math.max(e.wcd[i] ?? 0, remaining); }); done = true;
      } else if (order.action === 'supply' && order.choice && order.targetId !== undefined && !s.service) {
        const task: ServiceTask = { provider: order.targetId, service: order.choice, progress: 0 }, service = this.service(e, task);
        if (service && this.needsService(e, service.definition)) { s.service = task; done = true; }
      }
    }
    return done;
  }
  actions(entity: Ent): ModuleAction[] {
    const cfg = this.config(entity), s = this.ensure(entity); if (!cfg || !s) return [];
    const choices = cfg.feeds.flatMap(f => f.weapons.map(id => ({ id: `${f.id}/${id}`, label: cfg.stocks.find(stock => stock.id === this.host.config<LogisticsWeapon>(getDef(entity.defId).weapons.find(w => w.id === id)!)?.stock)?.label ?? f.label })));
    const services = new Map<string, ServiceDef>();
    for (const p of this.host.participants()) for (const d of this.config(p)?.services ?? []) {
      const supply = this.service(entity, { provider: p.id, service: d.id, progress: 0 });
      if (supply && this.needsService(entity, supply.definition)) services.set(d.id, supply.definition);
    }
    return [
      ...(choices.length ? [{ id: 'ammunition', label: t('module.ammunition'), enabled: entity.burstLeft <= 0, choices }] : []),
      ...(s.service ? [{ id: 'cancel', label: t('module.cancel'), enabled: true }] : services.size ? [{ id: 'supply', label: t('module.refill'), enabled: true, target: 'ally' as const, choices: [...services.values()].map(d => ({ id: d.id, label: d.label })) }] : []),
    ];
  }
  inspect(entity: Ent, privateView: boolean): ModuleStatusRow[] {
    if (!privateView) return [];
    const unavailable: ModuleStatusRow[] = getDef(entity.defId).weapons.filter(w => this.host.config<LogisticsWeapon>(w)?.disabled).map(w => ({
      id: `unavailable/${w.id}`, label: [`Weapon ${w.id}`, `武器 ${w.id}`, `무기 ${w.id}`],
      value: ['Unavailable: source loadout not initialized', '不可用：原始挂载尚未初始化', '사용 불가: 원본 무장 탑재가 초기화되지 않음'], tone: 'warning',
    }));
    const cfg = this.config(entity), s = this.ensure(entity); if (!cfg || !s) return unavailable;
    return [
      ...unavailable,
      ...cfg.stocks.map(stock => ({ id: `stock/${stock.id}`, label: stock.label, value: s.stocks[stock.id], fraction: s.stocks[stock.id] / stock.capacity, tone: s.stocks[stock.id] <= 0 ? 'danger' as const : 'normal' as const })),
      ...cfg.feeds.map(feed => ({ id: `feed/${feed.id}`, label: feed.label,
        value: cfg.stocks.find(stock => stock.id === this.host.config<LogisticsWeapon>(getDef(entity.defId).weapons.find(w => w.id === s.feeds[feed.id].selected)!)?.stock)?.label ?? s.feeds[feed.id].selected })),
      ...(s.service && this.service(entity, s.service) ? [{ id: 'service', label: this.service(entity, s.service)!.definition.label,
        fraction: s.service.progress / Math.max(.001, this.service(entity, s.service)!.definition.seconds ?? 1) }] : []),
      ...(cfg.suppression ? [{ id: 'suppression', label: cfg.suppression.label, value: s.suppression, fraction: s.suppression / cfg.suppression.max, tone: this.threshold(entity) ? 'warning' as const : 'normal' as const }] : []),
    ];
  }
  snapshot(view?: RuntimeView): Json {
    for (const e of this.host.participants()) if (!e.dead) this.ensure(e);
    const out: Record<string, Json> = {};
    for (const [id, s] of this.states) if (this.host.game.st.ents.has(id) && !this.host.game.st.ents.get(id)!.dead && (!view || view.visibleEntities.has(id) && view.privateEntity(id))) out[id] = plain(s) as unknown as Json;
    return out;
  }
  restore(value: unknown): void {
    if (!object(value) || Object.keys(value).length > this.host.game.st.ents.size) throw new Error('Invalid logistics state');
    const next = new Map<number, LogisticsState>();
    for (const [key, raw] of Object.entries(value)) {
      const id = Number(key), entity = this.host.game.st.ents.get(id), cfg = entity ? this.config(entity) : undefined;
      if (!Number.isSafeInteger(id) || String(id) !== key || !entity || !cfg || !object(raw) || !only(raw, ['form', 'idle', 'reloadStartSerial', 'reloadSerial', 'stocks', 'feeds', 'refill', 'suppression', 'quiet', 'service']) || raw.form !== entity.defId || !object(raw.stocks) || !object(raw.feeds) || !object(raw.refill) ||
          (raw.idle !== undefined && !finite(raw.idle, 0, 3601)) || !finite(raw.suppression, 0, cfg.suppression?.max ?? 0) || !finite(raw.quiet, 0, cfg.suppression?.quiet ?? 0)) throw new Error('Invalid logistics entity');
      if (raw.reloadSerial !== undefined && (!object(raw.reloadSerial) || Object.entries(raw.reloadSerial).some(([id, n]) => !cfg.stocks.some(s => s.id === id && s.refillAfter) || !Number.isSafeInteger(n) || (n as number) < 0))) throw new Error('Invalid magazine completion count');
      if (raw.reloadStartSerial !== undefined && (!object(raw.reloadStartSerial) || Object.entries(raw.reloadStartSerial).some(([id, n]) => !cfg.stocks.some(s => s.id === id && s.refillAfter) || !Number.isSafeInteger(n) || (n as number) < 0))) throw new Error('Invalid magazine start count');
      if (Object.keys(raw.stocks).length !== cfg.stocks.length || Object.keys(raw.feeds).length !== cfg.feeds.length) throw new Error('Invalid logistics membership');
      for (const stock of cfg.stocks) if (!finite(raw.stocks[stock.id], 0, stock.capacity)) throw new Error('Invalid stock quantity');
      for (const feed of cfg.feeds) {
        const f = raw.feeds[feed.id];
        if (!object(f) || !only(f, ['selected', 'remaining']) || typeof f.selected !== 'string' || !feed.weapons.includes(f.selected) || !finite(f.remaining, 0, 1e9)) throw new Error('Invalid feed state');
      }
      for (const [stockId, progress] of Object.entries(raw.refill)) {
        const stock = cfg.stocks.find(s => s.id === stockId);
        if (!stock?.refillAfter || !finite(progress, 0, stock.refillAfter) || !stock.queuedReload && raw.stocks[stockId] !== 0) throw new Error('Invalid refill state');
      }
      if (raw.service !== undefined) {
        const q = raw.service;
        if (!object(q) || !only(q, ['provider', 'service', 'progress']) || !Number.isSafeInteger(q.provider) || typeof q.service !== 'string' || !finite(q.progress, 0, 3600)) throw new Error('Invalid service task');
        const provider = this.host.game.st.ents.get(q.provider as number), d = provider ? this.config(provider)?.services.find(d => d.id === q.service) : undefined;
        if (!d || !finite(q.progress, 0, cfg.serviceSeconds?.[d.id] ?? d.seconds ?? 0) || provider?.id === id || this.host.game.st.players[provider!.owner]?.team !== this.host.game.st.players[entity.owner]?.team) throw new Error('Invalid service provider');
      }
      next.set(id, { idle: 0, reloadSerial: {}, reloadStartSerial: {}, ...plain(raw) } as unknown as LogisticsState);
    }
    this.states.clear(); for (const [id, state] of next) this.states.set(id, state);
  }
  dispose(): void { this.states.clear(); runtimes.delete(this.host.game); }
}
export function createLogisticsModule(host: ModuleHost): EngineModuleInstance { return new LogisticsModule(host); }
