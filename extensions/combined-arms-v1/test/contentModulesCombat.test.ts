import extensionPackage from '../extension.json';
import { afterEach, describe, expect, test } from 'bun:test';
import type { UnitDef, WeaponDef } from '../../../../steel-tide/game/core/src/core/types';
import { acquireTarget, applyDamage, canSee } from '../../../../steel-tide/game/core/src/game/combat';
import { DEFS, getDef } from '../../../../steel-tide/game/core/src/game/defs';
import { parseDefinitionPack, resolveDefinitions } from '../../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentSchema } from '../../../../steel-tide/game/core/src/game/contentSchema';
import { ComponentsModule } from '../src/components';
import { readComponentsDef, readComponentsWeapon, type ComponentsDef, type ComponentPayload, type PartDef } from '../src/componentsSpec';
import type { ImpactContext, ModuleHost } from '../../../../steel-tide/game/core/src/game/extensions/contracts';
import { LogisticsModule } from '../src/logistics';
import { readLogisticsDef, readLogisticsWeapon, type LogisticsDef, type LogisticsWeapon } from '../src/logisticsSpec';
import { newEnt, type Ent, type Proj } from '../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../steel-tide/game/core/server/testkit/game';

const label: [string, string, string] = ['Test component', '测试部件', '시험 부품'];
const ids: string[] = [];
function definition(config?: ComponentsDef, logistics?: LogisticsDef, payload?: ComponentPayload, weaponLogistics?: LogisticsWeapon, baseId = 'mbt'): UnitDef {
  const id = `module-test-${ids.length}`, base = getDef(baseId); ids.push(id);
  return DEFS[id] = { ...base, id, weapons: [{ ...base.weapons[0], id: 'main', extensions: { ...(payload ? { 'components-v1': payload } : {}), ...(weaponLogistics ? { 'logistics-v1': weaponLogistics } : {}) } }],
    extensions: { ...(config ? { 'components-v1': config } : {}), ...(logistics ? { 'logistics-v1': logistics } : {}) } };
}
afterEach(() => { for (const id of ids) delete DEFS[id]; ids.length = 0; });
function part(id: string, changes: Partial<PartDef> = {}): PartDef { return { id, label, hp: 100, channel: 'internal', exposure: { front: 1, side: 1, rear: 1, top: 1 }, damagedAt: 0.65, ...changes }; }
function components(parts: PartDef[] = [part('engine')]): ComponentsDef { return { parts, repairHitRetention: 0.5, protection: { frontHalfAngle: 35, rearHalfAngle: 35, incidence: false, families: { kinetic: { front: 0, side: 0, rear: 0, top: 0 } } } }; }
function payload(changes: Partial<ComponentPayload> = {}): ComponentPayload { return { family: 'kinetic', penetration: 700, hullDamage: 0, strength: 60, diameter: 1, channels: { internal: { strong: [1, 1], weak: [0.5, 0.5] } }, wear: 0, top: false, jitter: [1, 1], rangeAdjustment: [0, 0, 0], ...changes }; }
function logistics(): LogisticsDef { return { stocks: [], feeds: [], services: [] }; }
function harness() {
  const game = arena({ mode: 'campaign' }); let impact: ImpactContext | null = null;
  const host = (id: ModuleHost['id']): ModuleHost => ({ game, id, get currentImpact() { return impact; },
    config: <T>(def: UnitDef | WeaponDef) => def.extensions?.[id] as T | undefined,
    participants: () => [...game.st.ents.values()].filter(e => !!getDef(e.defId).extensions?.[id]),
    effectiveDef: (e, def) => def ?? getDef(e.defId), canFire: () => true, fireShot: () => {}, spendRound: () => {}, visible: () => true,
    acquireTarget, trackTarget: (e, _def, target) => canSee(game.st, game.hash, game.st.players[e.owner].team, target), applyDamage });
  const ch = host('components-v1'), lh = host('logistics-v1'), c = new ComponentsModule(ch), l = new LogisticsModule(lh);
  const hit = (target: Ent, source: Ent, w: WeaponDef, distance = 10): Proj => {
    const p: Proj = { x: target.x, y: target.y, px: target.x + 1, py: target.y, angle: Math.PI, speed: 200, kind: 'shell', homing: false, targetId: target.id, tx: target.x, ty: target.y, dmg: 100, splash: 0, owner: source.owner, team: source.owner, src: source.id, gun: `${source.defId}/${w.id}`, ttl: 5, hitsSub: false, hitsAir: false, hitsGround: true };
    source.x = target.x + distance; c.onShot(source, getDef(source.defId), w, p); game.st.projs.push(p); impact = { projectile: p, direct: target, terrain: false };
    c.wrapDamage(applyDamage)(game.st, target, p.dmg, undefined, source.owner, source.id, p.gun); impact = null; return p;
  };
  return { game, c, l, host, hit, setImpact: (value: ImpactContext | null) => { impact = value; } };
}
function componentState(c: ComponentsModule): any { return c.snapshot() as any; }
function logisticState(l: LogisticsModule): any { return l.snapshot() as any; }

describe('optional components and protection', () => {
  test('author-authored sector arcs and fractional protection remain continuous', () => {
    const h = harness(), cfg = components(); cfg.protection!.families.kinetic.front = 600;
    cfg.protection!.layers = { kinetic: { front: 300, side: 200, rear: 0, top: 0 } };
    const def = definition(cfg), e = newEnt(h.game.st, def.id, 0, 200, 200);
    const round = payload({ wear: 0.3286667 });
    expect(h.c.resolveProtection(e, round, Math.PI, 0).penetrated).toBe(false);
    expect(componentState(h.c).entities[e.id].layers.kinetic.front).toBeCloseTo(201.39999, 6);
    expect(h.c.resolveProtection(e, round, Math.PI, 0).penetrated).toBe(false);
    expect(h.c.resolveProtection(e, round, Math.PI, 0).penetrated).toBe(false);
    expect(h.c.resolveProtection(e, round, Math.PI, 0).penetrated).toBe(true);
    expect(h.c.resolveProtection(e, payload(), Math.PI - 40 * Math.PI / 180, 0).face).toBe('side');
  });

  test('independent strong and weak channel rolls can damage several components without hull HP', () => {
    const h = harness(), cfg = components([part('engine', { damagedAt: 0.5, damaged: { speed: 0.8, reloadAdd: 0.2 } }), part('drive', { exposure: { front: 0, side: 0, rear: 0, top: 0 } })]);
    const d = definition(cfg), sourceDef = definition(undefined, undefined, payload()), e = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sourceDef.id, 0, 210, 200), hp = e.hp;
    h.hit(e, shooter, sourceDef.weapons[0]);
    const s = componentState(h.c).entities[e.id]; expect(s.parts.engine.damage).toBe(60); expect(s.parts.drive.damage).toBe(30); expect(e.hp).toBe(hp);
    const view = h.c.effectiveDef(e, d); expect(view.speed).toBeCloseTo(d.speed * 0.8); expect(view.weapons[0].reload).toBeCloseTo(d.weapons[0].reload * 1.2);
  });

  test('a shield absorbs component energy exactly once, including zero hull payload', () => {
    const h = harness(), d = definition(components()), sd = definition(undefined, undefined, payload({ strength: 100 }));
    const e = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sd.id, 0, 210, 200);
    e.rs = { def: e.defId, movedAt: 0, shotAt: 0, hurtAt: 0, formAt: 0, last: [], runs: [], held: [], ev: 0, shield: 150 };
    h.hit(e, shooter, sd.weapons[0]); expect(e.rs.shield).toBe(50); expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(0);
    h.hit(e, shooter, sd.weapons[0]); expect(e.rs.shield).toBe(0); expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(50);
  });

  test('crew identity and health survive a timed replacement and save continuation', () => {
    const h = harness(), cfg = components([part('driver', { crew: true }), part('reserve', { crew: true })]);
    cfg.crew = { priority: ['driver'], replacements: [{ from: 'reserve', to: 'driver' }], seconds: 5, automatic: true, destroyWhenEmpty: true };
    const d = definition(cfg), e = newEnt(h.game.st, d.id, 0, 200, 200), state = componentState(h.c);
    state.entities[e.id].parts.driver = { damage: 100, failed: true }; state.entities[e.id].parts.reserve.damage = 25;
    const identity = state.entities[e.id].parts.reserve.occupant;
    h.c.restore(state); h.c.beforeStep(2); const saved = h.c.snapshot();
    const restored = new ComponentsModule(h.host('components-v1')); restored.restore(saved); restored.beforeStep(3);
    const s = componentState(restored).entities[e.id]; expect(s.parts.driver.occupant).toBe(identity); expect(s.parts.driver.damage).toBe(25); expect(s.parts.reserve.occupant).toBeUndefined(); expect(s.parts.reserve.damage).toBe(100);
    expect(restored.inspect(e, false)).toEqual([]);
    expect(restored.snapshot({ visibleEntities: new Set([e.id]), visibleProjectiles: new Set(), privateEntity: () => false })).toEqual({ entities: {}, projectiles: [] });
    s.parts.reserve = { ...s.parts.driver }; expect(() => restored.restore({ entities: { [e.id]: s }, projectiles: [] })).toThrow('crew identity');
  });

  test('repair pays over time, retains authored progress on a hit, and loses an ineligible provider', () => {
    const h = harness(), cfg = components([part('engine', { repairs: [{ seconds: 10, toDamage: 0, fromDamage: 0.65, provider: 'workshop', range: 100, stationary: true, metal: 100 }] })]);
    cfg.protection!.families.kinetic.front = 1000;
    const d = definition(cfg), providerDef = definition({ parts: [], repairHitRetention: 1, services: ['workshop'] }), sd = definition(undefined, undefined, payload());
    const e = newEnt(h.game.st, d.id, 0, 200, 200), provider = newEnt(h.game.st, providerDef.id, 0, 230, 200), shooter = newEnt(h.game.st, sd.id, 1, 210, 200), state = componentState(h.c), money = h.game.st.players[0].metal;
    state.entities[e.id].parts.engine = { damage: 100, failed: true }; h.c.restore(state);
    expect(h.c.order({ action: 'repair', ids: [e.id], owner: 0, choice: 'engine/0' })).toBe(true); h.c.beforeStep(4);
    expect(h.game.st.players[0].metal).toBeCloseTo(money - 40); h.hit(e, shooter, sd.weapons[0]);
    expect(componentState(h.c).entities[e.id].repair.progress).toBe(2);
    provider.dead = true; h.c.beforeStep(1); expect(componentState(h.c).entities[e.id].repair).toBeUndefined();
    expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(100);
  });

  test('range-dependent penetration retains a live projectile launch origin through restore', () => {
    const h = harness(), cfg = components(); cfg.protection!.families.kinetic.front = 50;
    const d = definition(cfg), sd = definition(undefined, undefined, payload({ penetration: 100, rangeAdjustment: [0, -1, 0] })), e = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sd.id, 0, 300, 200);
    const p = h.hit(e, shooter, sd.weapons[0], 100), saved = h.c.snapshot();
    const restored = new ComponentsModule(h.host('components-v1')); restored.restore(saved); h.setImpact({ projectile: p, direct: e, terrain: false });
    restored.wrapDamage(applyDamage)(h.game.st, e, 100, undefined, 0, shooter.id, p.gun);
    expect(componentState(restored).entities[e.id].parts.engine.damage).toBe(0);
  });

  test('a terminal component uses the common death lifecycle and shooter attribution', () => {
    const h = harness(), d = definition(components([part('rack', { failure: { destroy: true } })])), sd = definition(undefined, undefined, payload({ strength: 120 }));
    const e = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sd.id, 0, 210, 200);
    h.hit(e, shooter, sd.weapons[0]); expect(e.dead).toBe(true); expect(shooter.kills).toBe(1); expect(h.game.st.players[0].stats.killedUnits).toBe(1);
  });

  test('an unrelated ship reactor uses the same failure, repair and restoration contract', () => {
    const h = harness(), cfg = components([part('reactor', {
      destroyed: { speed: 0, disableWeapons: ['main'] }, failure: { hullDamage: 10 },
      repairs: [{ seconds: 2, toDamage: 0, fromDamage: 0.65, stationary: true }],
    })]);
    const d = definition(cfg, undefined, undefined, undefined, 'gunboat'), sd = definition(undefined, undefined, payload({ strength: 100 }));
    const ship = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sd.id, 0, 210, 200), hp = ship.hp;
    expect(d.domain).toBe('ship'); h.hit(ship, shooter, sd.weapons[0]);
    expect(ship.dead).toBeFalsy(); expect(ship.hp).toBe(hp - 10);
    expect(h.c.effectiveDef(ship, d).speed).toBe(0); expect(h.c.canFire(ship, d, d.weapons[0])).toBe(false);
    h.hit(ship, shooter, sd.weapons[0]); expect(ship.hp).toBe(hp - 10);
    expect(h.c.order({ action: 'repair', ids: [ship.id], owner: 1, choice: 'reactor/0' })).toBe(true);
    h.c.beforeStep(1); const restored = new ComponentsModule(h.host('components-v1')); restored.restore(h.c.snapshot()); restored.beforeStep(1);
    expect(componentState(restored).entities[ship.id].parts.reactor.damage).toBe(0);
    expect(restored.effectiveDef(ship, d).speed).toBe(d.speed); expect(restored.canFire(ship, d, d.weapons[0])).toBe(true);
    expect(ship.hp).toBe(hp - 10);
  });
});

describe('optional feeds, stocks and suppression', () => {
  test('ammunition alternatives share one cooldown and conserve one stock cost per burst', () => {
    const h = harness(), cfg = logistics(); cfg.stocks = [{ id: 'round', label, capacity: 3, initial: 3 }]; cfg.feeds = [{ id: 'breech', label, weapons: ['main', 'alternate'], selected: 'main' }];
    const w: LogisticsWeapon = { stock: 'round', cost: 1, feed: 'breech', suppression: 0 }, d = definition(undefined, cfg, undefined, w);
    d.weapons.push({ ...d.weapons[0], id: 'alternate' }); const e = newEnt(h.game.st, d.id, 0, 200, 200);
    expect(h.l.canFire(e, d, d.weapons[0])).toBe(true); expect(h.l.canFire(e, d, d.weapons[1])).toBe(false);
    e.wcd[0] = 6.5; h.l.spendRound(e, d, 0); expect(logisticState(h.l)[e.id].stocks.round).toBe(2);
    expect(h.l.order({ action: 'ammunition', ids: [e.id], owner: 0, choice: 'breech/alternate' })).toBe(true);
    expect(h.l.canFire(e, d, d.weapons[1])).toBe(false); h.l.beforeStep(6.5); expect(h.l.canFire(e, d, d.weapons[1])).toBe(true);
    e.burstLeft = 2; e.burstWi = 1; e.wcd[1] = 6.5; h.l.spendRound(e, d, 1);
    expect(h.l.canFire(e, d, d.weapons[1])).toBe(true); expect(h.l.order({ action: 'ammunition', ids: [e.id], owner: 0, choice: 'breech/main' })).toBe(false);
    expect(logisticState(h.l)[e.id].stocks.round).toBe(1);
  });

  test('finite service shares a provider rate budget and conserves its inventory across recipients', () => {
    const h = harness(), recipient = logistics(); recipient.stocks = [{ id: 'round', label, capacity: 10, initial: 0 }];
    const supply = logistics(); supply.stocks = [{ id: 'round', label, capacity: 7, initial: 7 }]; supply.services = [{ id: 'supply', label, mode: 'transfer', range: 100, stocks: ['round'], rate: 4, stationary: true, lockMovement: true, lockWeapons: true, providerStationary: true, components: [] }];
    const d = definition(undefined, recipient), sd = definition(undefined, supply), a = newEnt(h.game.st, d.id, 0, 200, 200), b = newEnt(h.game.st, d.id, 0, 220, 200), p = newEnt(h.game.st, sd.id, 0, 210, 200);
    expect(h.l.order({ action: 'supply', ids: [a.id, b.id], owner: 0, targetId: p.id, choice: 'supply' })).toBe(true); h.l.beforeStep(1);
    let s = logisticState(h.l); expect(s[a.id].stocks.round + s[b.id].stocks.round).toBe(4); expect(s[p.id].stocks.round).toBe(3);
    h.l.beforeStep(1); s = logisticState(h.l); expect(s[a.id].stocks.round + s[b.id].stocks.round + s[p.id].stocks.round).toBe(7); expect(s[p.id].stocks.round).toBe(0);
    const saved = h.l.snapshot(), restored = new LogisticsModule(h.host('logistics-v1')); restored.restore(saved); expect(restored.snapshot()).toEqual(saved);
  });

  test('an explicitly authored empty magazine and refill provider use distinct timed policies', () => {
    const h = harness(), cfg = logistics(); cfg.stocks = [{ id: 'clip', label, capacity: 10, initial: 0, refillAfter: 2 }];
    const d = definition(undefined, cfg), e = newEnt(h.game.st, d.id, 0, 200, 200);
    h.l.beforeStep(1); expect(logisticState(h.l)[e.id].stocks.clip).toBe(0); h.l.beforeStep(1); expect(logisticState(h.l)[e.id].stocks.clip).toBe(10);
    const provider = logistics(); provider.services = [{ id: 'refill', label, mode: 'refill', range: 100, stocks: ['clip'], seconds: 3, stationary: true, lockMovement: true, lockWeapons: true, providerStationary: true, components: [] }];
    const pd = definition(undefined, provider), p = newEnt(h.game.st, pd.id, 0, 210, 200), s = logisticState(h.l); s[e.id].stocks.clip = 1; h.l.restore(s);
    expect(h.l.order({ action: 'supply', ids: [e.id], owner: 0, targetId: p.id, choice: 'refill' })).toBe(true); h.l.beforeStep(2); expect(logisticState(h.l)[e.id].stocks.clip).toBe(1); h.l.beforeStep(1); expect(logisticState(h.l)[e.id].stocks.clip).toBe(10);
  });

  test('suppression accumulates once per impact, changes behavior, and recovers after quiet time', () => {
    const h = harness(), cfg = logistics(); cfg.suppression = { label, max: 100, decay: 10, quiet: 2, thresholds: [{ at: 20, speed: 0.5, reloadAdd: 1, spread: 20, disableWeapons: [] }] };
    const d = definition(undefined, cfg), sd = definition(undefined, undefined, undefined, { cost: 1, suppression: 30 }), e = newEnt(h.game.st, d.id, 1, 200, 200), shooter = newEnt(h.game.st, sd.id, 0, 210, 200);
    const p = h.hit(e, shooter, sd.weapons[0]), context = { target: e, raw: 0, dealt: 0, owner: 0, sourceId: shooter.id, gun: p.gun!, impact: { projectile: p, direct: e, terrain: false } };
    h.l.onDamage(context); h.l.onDamage(context); expect(logisticState(h.l)[e.id].suppression).toBe(30); expect(h.l.effectiveDef(e, d).speed).toBe(d.speed / 2);
    h.l.beforeStep(2); expect(logisticState(h.l)[e.id].suppression).toBe(30); h.l.beforeStep(2); expect(logisticState(h.l)[e.id].suppression).toBe(10); expect(h.l.effectiveDef(e, d)).toBe(d);
    expect(h.l.inspect(e, false)).toEqual([]); expect(h.l.snapshot({ visibleEntities: new Set([e.id]), visibleProjectiles: new Set(), privateEntity: () => false })).toEqual({});
  });

  test('scatter uses the match RNG and leaves guidance destinations untouched', () => {
    const shoot = (homing: boolean) => {
      const h = harness(), w: LogisticsWeapon = { suppression: 0, accuracy: { base: 12, moving: 2, targetMoving: 2, rangeFactor: 0 } };
      const d = definition(undefined, undefined, undefined, w), e = newEnt(h.game.st, d.id, 0, 200, 200), target = newEnt(h.game.st, 'mbt', 1, 220, 200);
      const p = h.hit(target, e, d.weapons[0]); p.homing = homing;
      const before = [p.tx, p.ty]; h.l.onShot(e, d, d.weapons[0], p);
      return { before, after: [p.tx, p.ty] };
    };
    const a = shoot(false), b = shoot(false), guided = shoot(true);
    expect(a.after).toEqual(b.after); expect(a.after).not.toEqual(a.before); expect(guided.after).toEqual(guided.before);
  });

  test('equal-config form changes retain refill and service clocks without creating stock', () => {
    const h = harness(), cfg = logistics(); cfg.stocks = [{ id: 'round', label, capacity: 10, initial: 0, refillAfter: 10 }];
    const d = definition(undefined, cfg), next = definition(undefined, structuredClone(cfg)), e = newEnt(h.game.st, d.id, 0, 200, 200);
    h.l.beforeStep(3); e.defId = next.id; h.l.beforeStep(2);
    const s = logisticState(h.l)[e.id]; expect(s.refill.round).toBe(5); expect(s.stocks.round).toBe(0);
    s.stocks.round = 11; expect(() => h.l.restore({ [e.id]: s })).toThrow('stock quantity');
  });
});

test('module schemas reject unsupported mechanics and invalid local references', () => {
  const issues: { path: string; message: string }[] = [];
  expect(readComponentsDef({ ...components(), stockDamageThreshold: { stock: 'round' } }, 'component', issues)).toBeUndefined();
  expect(issues.some(i => i.path.endsWith('stockDamageThreshold'))).toBe(true);
  expect(readComponentsWeapon({ ...payload(), penetration: Infinity }, 'weapon', issues)).toBeUndefined();
  expect(readLogisticsDef({ feeds: [{ id: 'feed', label, weapons: ['unknown'], selected: 'unknown' }] }, 'logistics', issues, { weaponIds: ['main'] })).toBeUndefined();
  expect(readLogisticsWeapon({ stock: 'unknown' }, 'weapon', issues, { definition: {} })).toBeUndefined();
  const clean: { path: string; message: string }[] = [];
  expect(readComponentsDef(components(), 'component', clean)).toBeDefined(); expect(clean).toEqual([]);
  const accuracy = { accuracy: { base: 10 } }, source = { weapons: [{ id: 'main', homing: true, extensions: { 'logistics-v1': accuracy } }] };
  expect(readLogisticsWeapon(accuracy, 'weapon', clean, { definition: source })).toBeUndefined();
  expect(clean.some(i => i.message.includes('non-homing'))).toBe(true);
});

test('inherited module definitions validate their normalized local references again', async () => {
  const cfg = logistics(); cfg.feeds = [{ id: 'breech', label, weapons: ['main'], selected: 'main' }];
  const raw = { format: 'steel-tide-mod', v: 3, id: 'module-inherit', name: label, version: '1.0.0', requiredCapabilities: ['components-v1', 'logistics-v1'], defs: [
    { id: 'module-inherit-base', extends: 'mbt', name: label, extensions: { 'components-v1': components(), 'logistics-v1': cfg }, weapons: [{ id: 'main', cls: 'cannon', dmg: 10, reload: 2, range: 4, extensions: { 'components-v1': payload({ channels: {} }), 'logistics-v1': { feed: 'breech' } } }] },
    { id: 'module-inherit-derived', extends: 'module-inherit-base', name: label },
  ] };
  raw.v=4; (raw as any).extensionPackages=[extensionPackage]; await prepareContentSchema(raw,true); const parsed = parseDefinitionPack(raw); expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(resolveDefinitions(parsed.pack).errors).toEqual([]);
});
