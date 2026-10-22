import { createSourceBallistics } from '../src/sourceBallistics';
import { createSourceAps } from '../src/sourceAps';
import extensionPackage from '../extension.json';
import { afterEach, describe, expect, test } from 'bun:test';
import { Terrain } from '../../../../../../steel-tide/game/core/src/core/types';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { acquireTarget, applyDamage, canSee } from '../../../../../../steel-tide/game/core/src/game/combat';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { parseDefinitionPack, resolveDefinitions } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentSchema } from '../../../../../../steel-tide/game/core/src/game/contentSchema';
import { ComponentsModule, componentRackFailure, componentImmobilized, componentArtilleryReady } from '../src/components';
import { readComponentsDef, readComponentsWeapon, type ComponentsDef, type ComponentPayload, type PartDef } from '../src/componentsSpec';
import type { ImpactContext, ModuleHost } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { LogisticsModule, logisticsTakeStock, logisticsStock } from '../src/logistics';
import { readLogisticsDef, readLogisticsWeapon, type LogisticsDef, type LogisticsWeapon } from '../src/logisticsSpec';
import { newEnt, type Ent, type Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';

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
  const game = arena({ mode: 'campaign' }); let impact: ImpactContext | null = null; let combat:ComponentsModule|undefined;
  const host = (id: ModuleHost['id']): ModuleHost => ({ game, id, get currentImpact() { return impact; },
    config: <T>(def: UnitDef | WeaponDef) => def.extensions?.[id] as T | undefined,
    participants: () => [...game.st.ents.values()].filter(e => !!getDef(e.defId).extensions?.[id]),
    effectiveDef: (e, def) => def ?? getDef(e.defId), canFire: () => true, fireShot: () => {}, spendRound: () => {}, visible: () => true,
    acquireTarget, trackTarget: (e, _def, target) => canSee(game.st, game.hash, game.st.players[e.owner].team, target),
    resolveImpact:(st,hash,p,direct,terrain)=>{const previous=impact;impact={projectile:p,direct,terrain:!!terrain};try{combat!.wrapImpact(()=>{})(st,hash,p,direct,terrain);}finally{impact=previous;}},
    applyDamage:(...args)=>combat?combat.wrapDamage(applyDamage)(...args):applyDamage(...args) });
  const ch = host('components-v1'), lh = host('logistics-v1'), c = combat = new ComponentsModule(ch), l = new LogisticsModule(lh);
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

function sourceCombat(): NonNullable<ComponentsDef['sourceCombat']> {
  return { label, initial: 60, interval: .1, baseAccuracy: 75, movingAccuracy: -10, range: 260 };
}

test('source armor experience is credited at terminal entry, before the delayed death', () => {
  const h = harness(), victim = components([part('rack', { failure: { destroy: true }, damageLimit: 1000 })]);
  victim.experience = { kind: 'armor', value: 1 }; victim.failureDelay = 3.5;
  const shooterCfg = components(); shooterCfg.sourceCombat = sourceCombat();
  const vd = definition(victim), sd = definition(shooterCfg, undefined, payload({ strength: 120 }));
  const e = newEnt(h.game.st, vd.id, 1, 200, 200), source = newEnt(h.game.st, sd.id, 0, 210, 200);
  h.hit(e, source, sd.weapons[0]);
  const state = componentState(h.c); expect(e.dead).toBeFalsy(); expect(source.kills).toBe(0);
  expect(state.entities[source.id].combat.armorKills).toBe(1); expect(state.entities[source.id].combat.morale).toBe(80);
  const restored = new ComponentsModule(h.host('components-v1')); restored.restore(h.c.snapshot()); restored.beforeStep(3.5);
  expect(e.dead).toBe(true); expect(componentState(restored).entities[source.id].combat.armorKills).toBe(1);
});

test('source morale recovery keeps inclusive ceilings, separate air rank, steadfast latch and suppression', () => {
  const h = harness(), cfg = components(); cfg.sourceCombat = sourceCombat();
  const d = definition(cfg), e = newEnt(h.game.st, d.id, 0, 200, 200);
  h.c.beforeStep(.1); expect(componentState(h.c).entities[e.id].combat.morale).toBe(61);
  let state = componentState(h.c); Object.assign(state.entities[e.id].combat, { morale: 79, armorKills: 4 }); h.c.restore(state);
  h.c.beforeStep(.2); expect(componentState(h.c).entities[e.id].combat.morale).toBe(81);
  state = componentState(h.c); Object.assign(state.entities[e.id].combat, { morale: 99, armorKills: 4, airKills: 2 }); h.c.restore(state);
  h.c.beforeStep(.2); const combat = componentState(h.c).entities[e.id].combat;
  expect(combat.morale).toBe(101); expect(combat.steadfast).toBe(true);
  state = componentState(h.c); state.entities[e.id].combat.morale = 19; h.c.restore(state);
  expect(h.c.canFire(e, d, d.weapons[0])).toBe(false); expect(h.c.effectiveDef(e,d).weapons[0].targets).toEqual([]);
  h.c.onDamage({ target:e, raw:1, dealt:1, owner:1, sourceId:0, gun:'', impact:null });
  h.c.beforeStep(3); expect(componentState(h.c).entities[e.id].combat.morale).toBe(19);
  h.c.beforeStep(.1); expect(componentState(h.c).entities[e.id].combat.morale).toBe(20); expect(h.c.canFire(e,d,d.weapons[0])).toBe(true);
});

test('source AP rank uses the authored discontinuous penetration jitter lower bound', () => {
  const h = harness(), d = definition(components()), e = newEnt(h.game.st,d.id,1,200,200);
  h.game.st.rng.range = (lo) => lo;
  const round = payload({ penetration:1000, experience:true, jitter:[.95,1.1] });
  expect(h.c.resolveProtection(e,round,Math.PI,0,0).penetration).toBe(950);
  expect(h.c.resolveProtection(e,round,Math.PI,0,1).penetration).toBe(960);
  expect(h.c.resolveProtection(e,round,Math.PI,0,2).penetration).toBeCloseTo(1100);
});

test('source accuracy derives rank, morale, movement, target size and range without a substitute damage buff', () => {
  const h = harness(), cfg=components(); cfg.sourceCombat=sourceCombat();
  const small=components(); small.sourceRadius=10;
  const d=definition(cfg), td=definition(small), e=newEnt(h.game.st,d.id,0,200,200), target=newEnt(h.game.st,td.id,1,220,200);
  expect(h.c.sourceAccuracy(e,target)).toBe(85);
  const state=componentState(h.c); Object.assign(state.entities[e.id].combat,{armorKills:6,morale:80}); h.c.restore(state);
  expect(h.c.sourceAccuracy(e,target)).toBe(105);
  e.prevX=e.x-1; expect(h.c.sourceAccuracy(e,target)).toBe(95);
});

test('source HEAT blast still harms parts when its separate penetration fails', () => {
  const h = harness(), cfg = components([part('engine', { blast: [{ above: 0, damage: [.2, .2], scale: 'part' }] })]);
  cfg.protection!.families.chemical = { front: 1000, side: 1000, rear: 1000, top: 1000 };
  cfg.blast = { family: 'kinetic', base: 12, armorScale: 2, coefficient: 100, minimumDistance: 1 };
  const d = definition(cfg), sd = definition(undefined, undefined, payload({ family: 'chemical', penetration: 500, blast: { yield: 1, radius: 40, poolCountOffset: 1, penetration: false, combined: true } }));
  const e = newEnt(h.game.st, d.id, 1, 200, 200), source = newEnt(h.game.st, sd.id, 0, 210, 200), hp = e.hp;
  h.hit(e, source, sd.weapons[0]); expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(20); expect(e.hp).toBe(hp);
  sd.weapons[0].extensions!['components-v1'] = payload({ family: 'chemical', penetration: 2000, blast: { yield: 1, radius: 40, poolCountOffset: 1, penetration: false, combined: true } });
  h.hit(e, source, sd.weapons[0]); expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(100);
});

test('source impact helper chooses one nearest armored recipient, not every blast victim', () => {
  const h = harness(), cfg = components(); cfg.sourceRadius = 16;
  const d = definition(cfg), sd = definition(undefined, undefined, payload({ recipient: { range: 40, radiusSquared: 1.5 } }));
  const a = newEnt(h.game.st, d.id, 1, 200, 200), b = newEnt(h.game.st, d.id, 1, 210, 200), source = newEnt(h.game.st, sd.id, 0, 300, 200);
  const p = h.hit(a, source, sd.weapons[0]);
  const snap = componentState(h.c); snap.entities[a.id].parts.engine.damage = 0; h.c.restore(snap);
  h.setImpact({ projectile: p, direct: null, terrain: false });
  h.c.wrapImpact(() => {
    h.c.wrapDamage(applyDamage)(h.game.st, b, 100, undefined, 0, source.id, p.gun);
    h.c.wrapDamage(applyDamage)(h.game.st, a, 100, undefined, 0, source.id, p.gun);
  })(h.game.st, h.game.hash, p, null);
  expect(componentState(h.c).entities[a.id].parts.engine.damage).toBe(60);
  expect(componentState(h.c).entities[b.id].parts.engine.damage).toBe(0);
});

test('empty-rack repair clock accrues above base durability without completing', () => {
  const h = harness(), cfg = components([part('rack', { damageLimit: 1000,
    stockThreshold: { stocks: ['shell'], perMissing: 50, strict: true, rebaseOnRefill: true },
    repairs: [{ seconds: 10, fromDamage: .65, untilDamage: 1, accrueToStockThreshold: true, toDamage: 0, provider: 'maintenance', range: 100 }],
  })]);
  cfg.repairGroup = { interval: .1, priority: ['rack/0'], provider: 'maintenance', range: 100, floorOnHit: true, finishBelow: .65 };
  const supply = logistics(); supply.stocks = [{ id: 'shell', label, capacity: 2, initial: 0 }];
  const d = definition(cfg, supply), pd = definition({ parts: [], services: ['maintenance'], repairHitRetention: 1 }), e = newEnt(h.game.st, d.id, 0, 200, 200);
  newEnt(h.game.st, pd.id, 0, 220, 200);
  const state = componentState(h.c); state.entities[e.id].parts.rack.damage = 150; h.c.restore(state);
  expect(h.c.order({ action: 'repair', ids: [e.id], owner: 0, choice: 'group' })).toBe(true);
  h.c.beforeStep(20); expect(componentState(h.c).entities[e.id].group.progress).toBeCloseTo(20);
  expect(componentState(h.c).entities[e.id].parts.rack.damage).toBe(150);
  const restored = new ComponentsModule(h.host('components-v1')); restored.restore(h.c.snapshot());
  restored.refillStocks(e, ['shell']); restored.beforeStep(.1);
  expect(componentState(restored).entities[e.id].parts.rack.damage).toBe(0);
});

test('source abandonment requires an empty reserve and lost seat and uses a five-second queue', () => {
  const h = harness(), cfg = components([part('driver', { crew: true }), part('gunner', { crew: true })]);
  cfg.crew = { priority: ['gunner', 'driver'], replacements: [], seconds: 5, automatic: false, destroyWhenEmpty: false };
  cfg.reserve = { label, capacity: 1, hpPerMember: 100, damageHp: 100, channel: 'crew', exposure: { front: 1, side: 1, rear: 1, top: 0 }, seconds: 5, priority: ['gunner', 'driver'], roundHealth: true, refillCosts: {} };
  cfg.abandon = { label, seconds: 5 };
  const d = definition(cfg), e = newEnt(h.game.st, d.id, 0, 200, 200);
  expect(h.c.order({ action: 'abandon', ids: [e.id], owner: 0 })).toBe(false);
  const state = componentState(h.c); state.entities[e.id].reserve.count = 0; state.entities[e.id].parts.driver = { damage: 100, failed: true }; h.c.restore(state);
  expect(h.c.order({ action: 'abandon', ids: [e.id], owner: 0 })).toBe(true); expect(h.c.effectiveDef(e, d).speed).toBe(0);
  h.c.beforeStep(4); expect(e.dead).toBeFalsy();
  const restored = new ComponentsModule(h.host('components-v1')); restored.restore(h.c.snapshot()); restored.beforeStep(1); expect(e.dead).toBe(true);
});

test('source idle partial-magazine discard waits strictly past ten seconds and survives save', () => {
  const h = harness(), cfg = logistics(); cfg.stocks = [{ id: 'clip', label, capacity: 30, initial: 9, refillAfter: 3, idleReload: { after: 10, below: 10 } }];
  const d = definition(undefined, cfg, undefined, { stock: 'clip', cost: 1, suppression: 0 }), e = newEnt(h.game.st, d.id, 0, 200, 200);
  h.l.beforeStep(10); expect(logisticState(h.l)[e.id].stocks.clip).toBe(9);
  const restored = new LogisticsModule(h.host('logistics-v1')); restored.restore(h.l.snapshot()); restored.beforeStep(.1);
  expect(logisticState(restored)[e.id].stocks.clip).toBe(0);
  restored.beforeStep(2.9); expect(logisticState(restored)[e.id].stocks.clip).toBe(30);
  expect(restored.reloadSerial(e, 'clip')).toBe(1);
  restored.spendRound(e, d, 0); expect(logisticState(restored)[e.id].idle).toBe(0);
});

test('queued partial reload preserves rounds, continues through combat, and resumes once after save', () => {
  const h=harness(), cfg=logistics(); cfg.stocks=[{id:'clip',label,capacity:30,initial:29,refillAfter:3,queuedReload:true}];
  const d=definition(undefined,cfg,undefined,{stock:'clip',cost:1,suppression:0}),e=newEnt(h.game.st,d.id,0,200,200);
  h.l.beforeStep(1); expect(logisticState(h.l)[e.id].stocks.clip).toBe(29); expect(h.l.reloadStartSerial(e,'clip')).toBe(1);
  e.targetId=999;h.l.spendRound(e,d,0);expect(logisticState(h.l)[e.id].stocks.clip).toBe(28);
  const restored=new LogisticsModule(h.host('logistics-v1'));restored.restore(h.l.snapshot());restored.beforeStep(2);
  expect(logisticState(restored)[e.id].stocks.clip).toBe(30);expect(restored.reloadSerial(e,'clip')).toBe(1);expect(restored.reloadStartSerial(e,'clip')).toBe(1);
  restored.spendRound(e,d,0);restored.beforeStep(4);expect(logisticState(restored)[e.id].stocks.clip).toBe(29);
});

test('fixed rack failure is strictly above durability and remembers its sampled explosion hull', () => {
  const h=harness(), cfg=components([part('rack',{strict:true,damageLimit:1000,failure:{destroy:true,hullRange:[60,600]}})]);cfg.failureDelay=3.5;
  const d=definition(cfg),sd=definition(undefined,undefined,payload({strength:100})),e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,210,200);
  h.hit(e,source,sd.weapons[0]);expect(componentState(h.c).entities[e.id].parts.rack.failed).toBe(false);
  h.hit(e,source,sd.weapons[0]);const sampled=e.hp;expect(componentRackFailure(h.game,e)?.hull).toBe(sampled);e.hp=1;
  const restored=new ComponentsModule(h.host('components-v1'));restored.restore(h.c.snapshot());expect(componentRackFailure(h.game,e)?.hull).toBe(sampled);
});

test('source seat reassignment adds ten to a twenty-HP vacated seat instead of multiplying it', () => {
  const h=harness(),cfg=components([part('driver',{hp:20,crew:true,damageLimit:1000}),part('gunner',{hp:20,crew:true,damageLimit:1000})]);
  cfg.crew={priority:['gunner'],replacements:[{from:'driver',to:'gunner'}],seconds:2,automatic:false,destroyWhenEmpty:false,vacatedExtra:10};
  const d=definition(cfg),e=newEnt(h.game.st,d.id,0,200,200),s=componentState(h.c);s.entities[e.id].parts.gunner={damage:20,failed:true};s.entities[e.id].parts.driver.damage=4;h.c.restore(s);
  expect(h.c.order({action:'reassign',ids:[e.id],owner:0,choice:'driver/gunner'})).toBe(true);h.c.beforeStep(2);
  expect(componentState(h.c).entities[e.id].parts.driver.damage).toBe(30);expect(componentState(h.c).entities[e.id].parts.gunner.damage).toBe(4);
});

test('source HEAT weak shot uses its accuracy threshold and scales independent damage channels once', () => {
  const h=harness(),cfg=components();cfg.sourceCombat={...sourceCombat(),baseAccuracy:1};
  const d=definition(components()),sd=definition(cfg,undefined,payload({sourceWeak:{roll:80,multiplier:.25}})),e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,210,200);source.targetId=e.id;
  h.game.st.rng.range=(lo,hi)=>hi===80?79:lo;h.hit(e,source,sd.weapons[0]);expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(15);
  const state=componentState(h.c);state.entities[source.id].combat.morale=Number.NaN;expect(()=>h.c.restore(state)).toThrow('source combat');
});

test('source top attack uses positive top armor and front-layout exposure independently', () => {
  const h=harness(),cfg=components([part('engine',{exposure:{front:1,side:0,rear:0,top:0}})]);cfg.protection!.families.chemical={front:9999,side:9999,rear:9999,top:10};
  const d=definition(cfg),sd=definition(undefined,undefined,payload({family:'chemical',top:true,positiveArmor:true,exposureFace:'front'})),e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,210,200);
  h.hit(e,source,sd.weapons[0]);expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(60);
  cfg.protection!.families.chemical.top=0;expect(h.c.resolveProtection(e,payload({family:'chemical',top:true,positiveArmor:true}),0,0).penetrated).toBe(false);
});

test('source flat armor and ignore apply to pack infantry while vanilla armor cells stay native', () => {
  const h=harness(),cfg:ComponentsDef={parts:[],repairHitRetention:1,sourceInfantry:true,sourceArmor:{armor:12,minimum:.3,tags:['soldiers']}};
  const d=definition(cfg),vanilla=definition(),sd=definition(undefined,undefined,payload({family:'ordinary',ordinary:{ignore:9,multipliers:[]}}));
  const e=newEnt(h.game.st,d.id,1,200,200),v=newEnt(h.game.st,vanilla.id,1,220,200),source=newEnt(h.game.st,sd.id,0,210,200);
  const p=h.hit(e,source,sd.weapons[0]);e.hp=d.hp;h.setImpact({projectile:p,direct:e,terrain:false});
  h.c.wrapDamage(applyDamage)(h.game.st,e,12,{heavy:.5},0,source.id,p.gun);expect(d.hp-e.hp).toBe(9);
  h.c.wrapDamage(applyDamage)(h.game.st,v,12,{heavy:.5},0,source.id,p.gun);expect(vanilla.hp-v.hp).toBe(6);
  h.c.wrapDamage(applyDamage)(h.game.st,e,1,{heavy:.5},0,source.id,p.gun);expect(d.hp-e.hp).toBeCloseTo(9.3);
});

test('recipient service duration overrides provider default and survives its longer queued progress', () => {
  const h=harness(),recipient=logistics();recipient.stocks=[{id:'round',label,capacity:1,initial:0}];recipient.serviceSeconds={refill:20};
  const provider=logistics();provider.services=[{id:'refill',label,mode:'refill',range:100,stocks:['round'],seconds:18,stationary:false,lockMovement:true,lockWeapons:false,providerStationary:false,components:[]}];
  const d=definition(undefined,recipient),sd=definition(undefined,provider),e=newEnt(h.game.st,d.id,0,200,200),p=newEnt(h.game.st,sd.id,0,220,200);
  expect(h.l.order({action:'supply',ids:[e.id],owner:0,targetId:p.id,choice:'refill'})).toBe(true);h.l.beforeStep(19);
  expect(logisticState(h.l)[e.id].stocks.round).toBe(0);const restored=new LogisticsModule(h.host('logistics-v1'));restored.restore(h.l.snapshot());restored.beforeStep(1);expect(logisticState(restored)[e.id].stocks.round).toBe(1);
});

test('recipient stock mapping exposes and performs special artillery service through the common depot', () => {
  const h=harness(),recipient=logistics();recipient.stocks=[{id:'artillery',label,capacity:33,initial:0},{id:'coax',label,capacity:60,initial:0}];recipient.serviceSeconds={refill:20};recipient.serviceStocks={refill:['artillery']};
  const provider=logistics();provider.services=[{id:'refill',label,mode:'refill',range:100,stocks:['shell-ap'],seconds:10,stationary:false,lockMovement:true,lockWeapons:false,providerStationary:false,components:[]}];
  const d=definition(undefined,recipient),sd=definition(undefined,provider),e=newEnt(h.game.st,d.id,0,200,200),p=newEnt(h.game.st,sd.id,0,220,200);
  expect(h.l.actions(e).some(a=>a.id==='supply')).toBe(true);
  expect(h.l.order({action:'supply',ids:[e.id],owner:0,targetId:p.id,choice:'refill'})).toBe(true);h.l.beforeStep(19);expect(logisticState(h.l)[e.id].stocks.artillery).toBe(0);
  h.l.beforeStep(1);expect(logisticState(h.l)[e.id].stocks.artillery).toBe(33);expect(logisticState(h.l)[e.id].stocks.coax).toBe(0);
});

test('source towing eligibility uses exact component threshold and a running repair clock', () => {
  const h=harness(),cfg=components([part('track'),part('engine'),part('driver',{crew:true})]);cfg.repairGroup={interval:.1,priority:['track','engine'],provider:'maintenance',range:96,floorOnHit:true};
  const d=definition(cfg),e=newEnt(h.game.st,d.id,0,200,200);expect(componentImmobilized(h.game,e)).toBe(false);
  let s=componentState(h.c);s.entities[e.id].parts.driver.damage=100;s.entities[e.id].parts.driver.failed=true;delete s.entities[e.id].parts.driver.occupant;h.c.restore(s);expect(componentImmobilized(h.game,e)).toBe(true);
});

test('AP weakness uses the impact helper source identity parity and survives continuation without allocating again', () => {
  for (const parity of [0,1]) {
    const h=harness(),cfg=components();cfg.protection!.families.kinetic.front=100;
    const shooterCfg=components([]);shooterCfg.sourceCombat={label,initial:50,interval:.1,baseAccuracy:75,movingAccuracy:0,range:100};
    const d=definition(cfg),sd=definition(shooterCfg,undefined,payload({sourceHelper:true,sourceWeak:{roll:50,multiplier:.25,helperParity:true}})),e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,210,200);
    if(h.game.st.nextId%2!==parity)h.game.st.nextId++;
    const helperId=h.game.st.nextId;h.game.st.rng.range=(low,high)=>high===50?40:low;
    const p=h.hit(e,source,sd.weapons[0]);expect(componentState(h.c).entities[e.id].parts.engine.damage).toBe(parity?15:60);expect(h.game.st.nextId).toBe(helperId);
    const saved=h.c.snapshot();expect((saved as any).logicalHelpers).toBe(1);h.c.restore(saved);h.c.wrapImpact(()=>{})(h.game.st,h.game.hash,p,e);expect(h.game.st.nextId).toBe(helperId);expect((h.c.snapshot() as any).logicalHelpers).toBe(1);
  }
});

test('source APS launches independently, selects the last eligible unclaimed missile, and expires its life without deleting it', () => {
  const h=harness(),cfg=components([]);cfg.aps={launchers:[{x:0,y:0,capacity:1,reload:2.5},{x:0,y:0,capacity:2,reload:2.5}],range:48,cadence:1.5,life:1/3,speed:240,targetSpeed:288,acceleration:144,spread:0,turn:100,contact:2.4};
  const d=definition(cfg),sd=definition(undefined,undefined,payload({family:'ordinary',incoming:{tags:['ATGM'],end:true,child:{chance:1,angle:0,life:1/3,speed:60,tags:['ATGM2']}}})),e=newEnt(h.game.st,d.id,0,200,200),source=newEnt(h.game.st,sd.id,1,230,200);
  const a=h.hit(e,source,sd.weapons[0]);a.x=240;a.y=200;a.team=1;
  const b=h.hit(e,source,sd.weapons[0]);b.x=230;b.y=200;b.team=1;
  h.c.beforeProjectiles(0);let aps=(h.c.snapshot() as any).aps;
  expect(aps.interceptors.map((p:any)=>p.target)).toEqual([b.id,a.id]);expect(aps.entities[e.id].map((l:any)=>l.count)).toEqual([0,1]);
  const interceptor=h.game.st.projs.find(p=>p.id===aps.interceptors[0].id)!;
  expect(h.c.projectileStep(interceptor,.01)).toBe('keep');expect(b.ttl).toBe(5);
  expect(h.c.projectileStep(interceptor,.2)).toBe('remove');expect(b.ttl).toBe(0);expect(b.downed).toBeUndefined();
  const count=h.game.st.projs.length;h.c.wrapImpact(()=>{})(h.game.st,h.game.hash,b,null);expect(h.game.st.projs.length).toBe(count+1);const child=h.game.st.projs.at(-1)!;expect([child.speed,child.ttl]).toEqual([60,1/3]);
  h.c.restore(h.c.snapshot());h.c.wrapImpact(()=>{})(h.game.st,h.game.hash,b,null);expect(h.game.st.projs.length).toBe(count+1);
  expect(h.c.needsRefill(e,'protection')).toBe(true);h.c.refill(e,'protection');expect((h.c.snapshot() as any).aps.entities[e.id].map((l:any)=>l.count)).toEqual([1,2]);
});

test('source APS reload requires strictly more than its timer and cannot create rounds after its reserve ends', () => {
  const h=harness(),cfg=components([]);cfg.aps={launchers:[{x:0,y:0,capacity:2,reload:2.5}],range:48,cadence:1.5,life:1/3,speed:240,targetSpeed:288,acceleration:144,spread:0,turn:100,contact:2.4};
  const d=definition(cfg),sd=definition(undefined,undefined,payload({family:'ordinary',incoming:{tags:['ATGM'],end:true}})),e=newEnt(h.game.st,d.id,0,200,200),source=newEnt(h.game.st,sd.id,1,230,200);
  const a=h.hit(e,source,sd.weapons[0]);a.x=230;a.team=1;h.c.beforeProjectiles(0);h.game.st.projs.splice(0);h.c.beforeProjectiles(2.5);
  expect((h.c.snapshot() as any).aps.entities[e.id][0].loaded).toBe(false);h.c.beforeProjectiles(.01);expect((h.c.snapshot() as any).aps.entities[e.id][0].loaded).toBe(true);
  const b=h.hit(e,source,sd.weapons[0]);b.x=230;b.team=1;h.c.beforeProjectiles(0);h.game.st.projs.splice(0);h.c.beforeProjectiles(100);
  const state=(h.c.snapshot() as any).aps.entities[e.id][0];expect([state.count,state.loaded]).toEqual([0,false]);
});

test('source direct and area HP add independently with original center falloff and distinct tag mutators', () => {
  const h=harness(),cfg:ComponentsDef={parts:[],repairHitRetention:1,sourceArmor:{armor:0,minimum:0,tags:['soldiers']}};
  const d=definition(cfg),phase={direct:10,area:20,radius:40,ignore:0,fromEdge:false,noFalloff:false,friendly:false,targetGround:false,mutators:[{with:['soldiers','other'],without:[],direct:2,area:.5}]};
  const sd=definition(undefined,undefined,payload({family:'ordinary',hpPhases:[phase]})),e=newEnt(h.game.st,d.id,1,200,200),neighbor=newEnt(h.game.st,d.id,1,220,200),source=newEnt(h.game.st,sd.id,0,210,200);
  const p=h.hit(e,source,sd.weapons[0]);p.dmg=sd.weapons[0].dmg;p.splash=40;e.hp=d.hp;h.setImpact({projectile:p,direct:e,terrain:false});
  h.c.wrapImpact(()=>{h.c.wrapDamage(applyDamage)(h.game.st,e,p.dmg,undefined,0,source.id,p.gun);})(h.game.st,h.game.hash,p,e);
  expect(d.hp-e.hp).toBeCloseTo(30);expect(d.hp-neighbor.hp).toBeCloseTo(6);expect(p.dmg).toBe(sd.weapons[0].dmg);
});

test('source HE forest variant changes radius and infantry multiplier while preserving friendly fire', () => {
  const h=harness(),cfg:ComponentsDef={parts:[],repairHitRetention:1,sourceInfantry:true,sourceArmor:{armor:0,minimum:0,tags:['soldiers']}};
  const d=definition(cfg),sd=definition(undefined,undefined,payload({friendlyFire:true,ordinary:{ignore:0,multipliers:[]},blast:{yield:1,radius:40,poolCountOffset:1,penetration:false,forest:{search:48,radius:20,infantry:.5}}}));
  const e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,210,200);h.game.st.map.terrain[6*h.game.st.map.w+6]=Terrain.Forest;
  const p=h.hit(e,source,sd.weapons[0]);expect(d.hp-e.hp).toBe(50);h.c.wrapImpact(()=>{})(h.game.st,h.game.hash,p,e);expect(p.splash).toBe(20);expect(p.force).toBe(true);
});

test('manual-loader and commander source thresholds keep the source commander latch', () => {
  const h=harness(),cfg=components([part('driver',{crew:true}),part('gunner',{crew:true})]);cfg.crew={priority:['gunner','driver'],replacements:[],seconds:5,automatic:false,destroyWhenEmpty:false};
  cfg.reserve={label,capacity:2,hpPerMember:100,damageHp:100,channel:'crew',exposure:{front:1,side:1,rear:1,top:1},seconds:5,priority:['gunner','driver'],roundHealth:true,refillCosts:{},empty:{reloadAdd:.5}};
  cfg.commander={visionPenalty:1.875,reserveThreshold:1};const d=definition(cfg),e=newEnt(h.game.st,d.id,0,200,200);
  let s=componentState(h.c);s.entities[e.id].reserve.count=0;h.c.restore(s);h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision);expect(h.c.effectiveDef(e,d).weapons[0].reload).toBeCloseTo(d.weapons[0].reload*1.5);
  s=componentState(h.c);s.entities[e.id].reserve.count=1;h.c.restore(s);h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision-1.875);
  s=componentState(h.c);s.entities[e.id].reserve.count=0;h.c.restore(s);h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision-1.875);
  s=componentState(h.c);s.entities[e.id].reserve.count=2;h.c.restore(s);h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision);
});

test('source zero-reserve refill adds one count but retains zero pooled health and gunner commander logic', () => {
  const h=harness(),cfg=components([part('driver',{crew:true}),part('gunner',{crew:true})]);cfg.crew={priority:['gunner','driver'],replacements:[],seconds:5,automatic:false,destroyWhenEmpty:false};
  cfg.reserve={label,capacity:0,refillCount:1,hpPerMember:100,damageHp:100,channel:'reserve',exposure:{front:1,side:1,rear:1,top:1},seconds:5,priority:['gunner','driver'],roundHealth:true,refillCosts:{gunner:0,driver:1}};
  cfg.commander={visionPenalty:1.875,reserveThreshold:0,seat:'gunner'};const d=definition(cfg),e=newEnt(h.game.st,d.id,0,200,200);
  h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision);
  const s=componentState(h.c);s.entities[e.id].parts.gunner={damage:100,failed:true};h.c.restore(s);h.c.beforeStep(.1);expect(h.c.effectiveDef(e,d).vision).toBe(d.vision-1.875);
  expect(h.c.refill(e,'crew')).toBe(true);const filled=componentState(h.c).entities[e.id];expect(filled.reserve.count).toBe(1);expect(filled.reserve.health).toBe(0);expect(filled.parts.gunner.damage).toBe(0);
  const restored=new ComponentsModule(h.host('components-v1'));restored.restore(h.c.snapshot());restored.beforeStep(.1);expect(restored.effectiveDef(e,d).vision).toBe(d.vision);
});

test('uninitialized source weapons keep valid domains but cannot fire and explain why privately', () => {
  const h=harness(),d=definition(undefined,undefined,undefined,{disabled:true,suppression:0}),e=newEnt(h.game.st,d.id,0,200,200);
  expect(d.weapons[0].targets.length).toBeGreaterThan(0);expect(h.l.canFire(e,d,d.weapons[0])).toBe(false);
  expect(h.l.inspect(e,false)).toEqual([]);const rows=h.l.inspect(e,true);expect(rows).toHaveLength(1);expect(rows[0].value).toEqual(['Unavailable: source loadout not initialized','不可用：原始挂载尚未初始化','사용 불가: 원본 무장 탑재가 초기화되지 않음']);
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
  raw.v=4; (raw as any).capacity="large"; (raw as any).extensionPackages=[extensionPackage]; await prepareContentSchema(raw,true); const parsed = parseDefinitionPack(raw); expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(resolveDefinitions(parsed.pack).errors).toEqual([]);
});

test('source helper list keeps independent HP branches and serializes a hit-once expanding wave',()=>{
  const h=harness();
  const phase={direct:0,area:10,radius:100,ignore:0,fromEdge:false,noFalloff:false,friendly:false,targetGround:true,mutators:[]};
  const round=payload({family:'ordinary',penetration:0,hpPhases:[{...phase,area:5}],spawned:[
    {x:0,y:0,payload:payload({family:'ordinary',sourceHelper:true,hpPhases:[phase]})},
    {x:20,y:0,payload:payload({family:'ordinary',sourceHelper:true,hpPhases:[{...phase,area:20,expand:1}]})},
  ]});
  const d=definition(undefined,undefined,round),victim=definition({parts:[],repairHitRetention:1,sourceArmor:{armor:0,minimum:0,tags:[]}});
  const shooter=newEnt(h.game.st,d.id,0,400,200),e=newEnt(h.game.st,victim.id,1,200,200),far=newEnt(h.game.st,victim.id,1,280,200),hp=e.hp,farHp=far.hp;
  const p:Proj={id:h.game.st.nextProjId++,x:200,y:200,px:400,py:200,tx:200,ty:200,angle:Math.PI,speed:0,kind:'shell',homing:false,targetId:e.id,dmg:d.weapons[0].dmg,splash:0,owner:0,team:0,src:shooter.id,gun:`${d.id}/main`,ttl:0,hitsSub:false,hitsAir:false,hitsGround:true};
  h.c.onShot(shooter,d,d.weapons[0],p);h.host('components-v1').resolveImpact(h.game.st,h.game.hash,p,e);
  expect(hp-e.hp).toBeCloseTo(15);expect(farHp-far.hp).toBeCloseTo(4.5);
  const save=h.c.snapshot() as any;expect(save.logicalHelpers).toBe(2);expect(save.waves).toHaveLength(1);expect(save.waves[0].branch).toBe(1);
  const c=h.c;c.restore(save);c.beforeProjectiles(.5);
  expect(hp-e.hp).toBeCloseTo(33);expect(farHp-far.hp).toBeCloseTo(4.5);
  // The center victim moves into the later frontier but cannot be hit twice.
  e.x=280;c.beforeProjectiles(.5);
  expect(hp-e.hp).toBeCloseTo(33);expect(farHp-far.hp).toBeCloseTo(14.5);
  expect((c.snapshot() as any).waves).toBeUndefined();
  expect((h.c.snapshot({visibleEntities:new Set([e.id]),visibleProjectiles:new Set(),privateEntity:()=>true}) as any).waves).toBeUndefined();
  save.waves[0].phase=99;expect(()=>c.restore(save)).toThrow('blast reference');
});

test('source ordinary missiles retain acceleration, turn rate, moving target and expiry',()=>{
 const h=harness(),base=definition(),e=newEnt(h.game.st,base.id,0,100,200),target=newEnt(h.game.st,base.id,1,500,200);
 const cfg={life:2.5,speed:48,speedSpread:0,spread:0,vx:0,vy:0,vz:0,gravity:0,trueGravity:0,targetHeight:0,height:0,targetSpeed:144,acceleration:432,turn:1.2*Math.PI/3,nearTurn:-Math.PI/3,delay:0,ground:false,includeHeight:false,noLead:false,end:true};
 const p:Proj={id:1,x:100,y:200,px:100,py:200,tx:500,ty:200,angle:0,speed:1000,kind:'missile',homing:true,targetId:target.id,dmg:0,splash:0,owner:0,team:0,src:e.id,ttl:20,hitsSub:false,hitsAir:false,hitsGround:true};
 const host=h.host('components-v1');let impacts=0;host.resolveImpact=()=>{impacts++;};
 const runtime=createSourceBallistics(host,()=>cfg);h.game.st.projs.push(p);runtime.launch(e,p);expect(p.speed).toBe(48);expect(p.ttl).toBe(2.5);
 target.y=500;runtime.step(p,1/60);expect(p.tx).toBe(500);expect(p.ty).toBe(500);expect(p.angle).toBeCloseTo(1.2*Math.PI/180);expect(p.speed).toBeCloseTo(55.2);
 const save=runtime.snapshot(),restored=createSourceBallistics(host,()=>cfg);restored.restore(save);expect(restored.visual(p)).toEqual(runtime.visual(p));
 p.ttl=.001;expect(restored.step(p,1/60)).toBe('remove');expect(impacts).toBe(1);
});

test('source gravity is vertical displacement plus target-height steering, not an invented ballistic arc',()=>{
 const h=harness(),d=definition(),e=newEnt(h.game.st,d.id,0,100,200);
 const cfg={life:20,speed:242.4,speedSpread:0,spread:0,vx:0,vy:0,vz:72,gravity:24,trueGravity:0,targetHeight:0,height:0,targetSpeed:0,acceleration:144,turn:-Math.PI/3,nearTurn:-Math.PI/3,delay:0,ground:true,includeHeight:false,noLead:false,end:true};
 const p:Proj={id:1,x:100,y:200,px:100,py:200,tx:500,ty:200,angle:0,speed:242.4,kind:'shell',homing:false,targetId:0,dmg:0,splash:0,owner:0,team:0,src:e.id,ttl:20,hitsSub:false,hitsAir:false,hitsGround:true};
 const runtime=createSourceBallistics(h.host('components-v1'),()=>cfg);h.game.st.projs.push(p);runtime.launch(e,p);runtime.step(p,1/60);
 expect(p.x).toBeCloseTo(104.04);expect(runtime.visual(p)?.altitude).toBeCloseTo(.79192);expect(p.arc).toBeUndefined();
 expect(runtime.snapshot({visibleEntities:new Set(),visibleProjectiles:new Set(),privateEntity:()=>false})).toEqual([]);
});

test('manual artillery uses exact source damage thresholds and a shared atomic stock debit',()=>{
 const h=harness(),cfg=components([part('gunner',{crew:true}),part('rack',{strict:true,damageLimit:200})]);
 cfg.sourceCombat={label,initial:60,interval:.1,baseAccuracy:60,movingAccuracy:0,range:0};
 const supply=logistics();supply.stocks=[{id:'shell',label,capacity:3,initial:3}];const d=definition(cfg,supply),e=newEnt(h.game.st,d.id,0,200,200);
 const save=h.c.snapshot() as any;save.entities[e.id].parts.gunner={damage:100,failed:true};h.c.restore(save);
 expect(componentArtilleryReady(h.game,e)).toBe(true);expect(logisticsTakeStock(h.game,e,'shell',2)).toBe(true);expect(logisticsTakeStock(h.game,e,'shell',2)).toBe(false);expect(logisticsStock(h.game,e,'shell')?.amount).toBe(1);
 const later=h.c.snapshot() as any;later.entities[e.id].parts.rack={damage:101,failed:true};h.c.restore(later);expect(componentArtilleryReady(h.game,e)).toBe(false);
});

test('penetration fragments preserve the source count, delayed child, save continuation and visible identity',()=>{
 const h=harness(),cfg=components();cfg.protection!.families.kinetic.front=100;
 const motion={life:35/60,speed:72,speedSpread:48,spread:20,vx:0,vy:0,vz:24,gravity:12,trueGravity:0,targetHeight:4,height:0,targetSpeed:0,acceleration:144,turn:-Math.PI/3,nearTurn:-Math.PI/3,delay:0,ground:true,includeHeight:false,noLead:false,end:true};
 const hp={direct:24,area:.6,radius:.4,ignore:0,fromEdge:false,noFalloff:false,friendly:false,targetGround:true,mutators:[]};
 const fragments={penetrated:6,blocked:4,offset:2,rounds:[payload({family:'ordinary',motion,hpPhases:[hp]}),payload({family:'ordinary',motion:{...motion,life:50/60,delay:10/60},hpPhases:[hp]})]};
 const sd=definition(undefined,undefined,payload({fragments})),d=definition(cfg),e=newEnt(h.game.st,d.id,1,200,200),source=newEnt(h.game.st,sd.id,0,240,200);
 h.hit(e,source,sd.weapons[0]);let emitted=h.game.st.projs.filter(p=>(h.c.projectileVisual(p) as any)?.kind==='fragment');expect(emitted).toHaveLength(6);
 h.c.projectileStep(emitted[0],1/60);emitted=h.game.st.projs.filter(p=>(h.c.projectileVisual(p) as any)?.kind==='fragment');expect(emitted).toHaveLength(7);
 const child=emitted.find(p=>(h.c.projectileVisual(p) as any).index===1)!;const ttl=child.ttl;h.c.projectileStep(child,1/60);expect(child.ttl).toBe(ttl);
 const saved=h.c.snapshot();h.c.restore(saved);expect((h.c.projectileVisual(child) as any).index).toBe(1);h.c.projectileStep(emitted[0],1/60);expect(h.game.st.projs.filter(p=>(h.c.projectileVisual(p) as any)?.index===1)).toHaveLength(1);
 const view=h.c.snapshot({visibleEntities:new Set(),visibleProjectiles:new Set([child.id!]),privateEntity:()=>false}) as any;
 expect(view.projectiles).toEqual([]);expect(view.visuals).toEqual([{id:child.id,variant:{kind:'fragment',index:1},branch:-1}]);expect(view.motion).toHaveLength(1);
 const issues:any[]=[];const normalized=readComponentsWeapon(sd.weapons[0].extensions!['components-v1'],'test',issues);expect(issues).toEqual([]);expect(readComponentsWeapon(normalized,'again',issues)).toEqual(normalized);expect(issues).toEqual([]);
});

test('source warmup begins after reload, fires only after crossing, and decays only while every barrel is idle', () => {
  const h=harness(),round=payload({warmup:{seconds:.1,decay:4}}),d=definition(undefined,undefined,round),e=newEnt(h.game.st,d.id,0,200,200),target=newEnt(h.game.st,'mbt',1,240,200),w=d.weapons[0];
  e.angle=e.turretAngle=0;e.wcd[0]=0;let shots=0;
  const update=h.c.wrapWeapons((_st,entity,def,tg,dt)=>{
    entity.wcd[0]-=dt;if(entity.wcd[0]>0||!tg)return;
    if(!h.c.canFire(entity,def,w,tg,tg))return;
    // Multiple fire-path probes in the same update cannot warm a barrel twice.
    expect(h.c.canFire(entity,def,w,tg,tg)).toBe(true);
    entity.wcd[0]=.5;shots++;
    h.c.onShot(entity,def,w,{id:100+shots,x:entity.x,y:entity.y,px:entity.x,py:entity.y,angle:0,speed:10,kind:'shell',homing:false,targetId:target.id,tx:target.x,ty:target.y,dmg:1,splash:0,owner:0,team:0,ttl:1,hitsSub:false,hitsAir:false,hitsGround:true});
  });
  const step=(dt:number,tg:Ent|null=target)=>update(h.game.st,e,d,tg,dt,1);
  step(.06);step(.06);expect(shots).toBe(0);expect((h.c.snapshot() as any).warmup[e.id].guns.main).toBeCloseTo(.12);
  const saved=h.c.snapshot();h.c.restore(saved);step(.01);expect(shots).toBe(1);expect((h.c.snapshot() as any).warmup).toBeUndefined();
  step(.25);expect(shots).toBe(1);expect((h.c.snapshot() as any).warmup).toBeUndefined();
  step(.25);expect((h.c.snapshot() as any).warmup[e.id].guns.main).toBeCloseTo(.25);step(.01);expect(shots).toBe(2);
  e.wcd[0]=0;step(.06);step(.01,null);expect((h.c.snapshot() as any).warmup[e.id].guns.main).toBeCloseTo(.02);
  expect((h.c.snapshot({visibleEntities:new Set([e.id]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any).warmup).toBeUndefined();
  step(.01,null);expect((h.c.snapshot() as any).warmup).toBeUndefined();
});

test('warmup leaves acquisition probes pure and does not advance an unaligned or vetoed weapon', () => {
  const h=harness(),round=payload({warmup:{seconds:.1,decay:4}}),d=definition(undefined,undefined,round),e=newEnt(h.game.st,d.id,0,200,200),target=newEnt(h.game.st,'mbt',1,240,200),w=d.weapons[0];e.wcd[0]=0;e.angle=e.turretAngle=Math.PI;w.turret=false;
  const query=h.c.wrapTargetAcquisition((()=>{expect(h.c.canFire(e,d,w,target,target)).toBe(true);return target.id;}) as any);
  const update=h.c.wrapWeapons(()=>{query(h.game.st,h.game.hash,e,d);expect(h.c.canFire(e,d,w,target,target)).toBe(true);});
  update(h.game.st,e,d,target,.05,1);expect((h.c.snapshot() as any).warmup).toBeUndefined();
  e.angle=e.turretAngle=0;e.holdFire=true;update(h.game.st,e,d,target,.05,1);expect((h.c.snapshot() as any).warmup).toBeUndefined();
  expect(h.c.canFire(e,d,w,target,target)).toBe(true); // An out-of-step AI/path query.
});

test('source FPV sliding preserves float table drift, angular acceleration and independent travel heading', () => {
  const h=harness(),cfg=components([]);cfg.sourceMovement={speed:2.85,acceleration:1,deceleration:1,turn:9,turnAcceleration:9,yScale:1};
  const d=definition(cfg);d.speed=68.4;d.turnRate=3*Math.PI;
  const e=newEnt(h.game.st,d.id,0,200,200);e.angle=e.turretAngle=Math.PI/2;
  expect(h.c.stepMovement(e,d,1/60,{x:400,y:200})).toBe(true);
  // Independently calculated float32 reference: 1.41 * cos/sin of RW's
  // first 8192-entry table midpoint, added to source coordinate500.
  expect(e.x).toBe(200.56400146484376);expect(e.y).toBe(200.0002197265625);
  expect(e.angle).toBeCloseTo(81*Math.PI/180,10);
  const motion=(h.c.snapshot() as any).movement[e.id];
  expect(motion.vx).toBe(1.4099998474121094);expect(motion.vy).toBe(0.0005407282151281834);expect(motion.angular).toBe(-9);
});

test('source zero-deceleration drone coasts and saved velocity resumes without a native stall or speed reset', () => {
  const h=harness(),cfg=components([]);cfg.sourceMovement={speed:3.25,acceleration:1,deceleration:0,turn:9,turnAcceleration:9,yScale:1};
  const d=definition(cfg);d.speed=78;d.turnRate=3*Math.PI;const e=newEnt(h.game.st,d.id,0,200,200);e.angle=e.turretAngle=0;
  for(let i=0;i<3;i++)h.c.stepMovement(e,d,1/60,{x:400,y:200});
  const saved=h.c.snapshot(),before={x:e.x,y:e.y,angle:e.angle,turretAngle:e.turretAngle},velocity=(saved as any).movement[e.id].vx;
  h.c.stepMovement(e,d,1/60);const continued={x:e.x,y:e.y,angle:e.angle};
  expect((h.c.snapshot() as any).movement[e.id].vx).toBe(velocity);expect(e.x).toBeGreaterThan(before.x);
  Object.assign(e,before);h.c.restore(saved);h.c.stepMovement(e,d,1/60);expect({x:e.x,y:e.y,angle:e.angle}).toEqual(continued);
  expect((h.c.snapshot({visibleEntities:new Set([e.id]),visibleProjectiles:new Set(),privateEntity:()=>false}) as any).movement).toBeUndefined();
  (saved as any).movement[e.id].vx=Infinity;expect(()=>h.c.restore(saved)).toThrow('source movement');
});

test('the five-kill Arena conversion retains identity, damaged parts, ERA, stocks and turret cooldowns',()=>{
  const h=harness(),cfg=components([part('engine'),part('rack'),part('driver',{crew:true}),part('gunner',{crew:true})]);cfg.sourceCombat=sourceCombat();
  cfg.protection!.layers={kinetic:{front:100,side:50,rear:0,top:0}};
  const nextCfg=JSON.parse(JSON.stringify(cfg)) as ComponentsDef;
  nextCfg.aps={launchers:[{x:0,y:0,capacity:4,reload:2.5}],range:48,cadence:1.5,life:1/3,speed:240,targetSpeed:288,acceleration:144,spread:0,turn:100,contact:2.4};
  const supply=logistics();supply.stocks=[{id:'shell',label,capacity:30,initial:30}];
  const upgrade=definition(nextCfg,supply);upgrade.hp=1600;
  cfg.achievements=[{id:'arena-m',label,counter:'armor',threshold:5,to:upgrade.id}];
  const base=definition(cfg,supply);base.hp=800;
  const e=newEnt(h.game.st,base.id,0,200,200);e.hp=400;e.wcd[0]=2.5;e.orders=[{type:'move',x:300,y:220}];
  expect(logisticsTakeStock(h.game,e,'shell',7)).toBe(true);
  const save=h.c.snapshot() as any;save.entities[e.id].parts.engine.damage=75;save.entities[e.id].layers.kinetic.front=32;save.entities[e.id].combat.armorKills=4;
  const crew=save.entities[e.id].parts.driver.occupant;h.c.restore(save);h.c.beforeStep(.1);expect(e.defId).toBe(base.id);
  const threshold=h.c.snapshot() as any;threshold.entities[e.id].combat.armorKills=5;h.c.restore(threshold);h.c.beforeStep(.1);
  expect(e.defId).toBe(upgrade.id);expect(e.hp).toBe(800);expect(e.wcd).toEqual([2.5]);expect(e.orders).toEqual([{type:'move',x:300,y:220}]);
  const state=h.c.snapshot() as any;expect(state.entities[e.id].parts.engine.damage).toBe(75);expect(state.entities[e.id].parts.driver.occupant).toBe(crew);expect(state.entities[e.id].layers.kinetic.front).toBe(32);expect(state.entities[e.id].combat.armorKills).toBe(5);expect(state.achievements).toEqual({'0':['arena-m']});
  expect(state.aps.entities[e.id][0].count).toBe(4);expect(logisticsStock(h.game,e,'shell')?.amount).toBe(23);
  expect(h.c.inspect(e,true).some(row=>row.id==='arena-m')).toBe(true);
});

test('source achievement completion belongs to one owner, survives the winner death, and is private in snapshots',()=>{
  const h=harness(),cfg=components();cfg.sourceCombat=sourceCombat();const target=definition(structuredClone(cfg));
  cfg.achievements=[{id:'arena-m',label,counter:'armor',threshold:5,to:target.id}];
  const d=definition(cfg),first=newEnt(h.game.st,d.id,0,200,200),second=newEnt(h.game.st,d.id,0,220,200),ally=newEnt(h.game.st,d.id,1,240,200);
  h.game.st.players[1].team=h.game.st.players[0].team;
  const s=h.c.snapshot() as any;for(const e of [first,second,ally])s.entities[e.id].combat.armorKills=5;h.c.restore(s);h.c.beforeStep(.1);
  expect(first.defId).toBe(target.id);expect(second.defId).toBe(d.id);expect(ally.defId).toBe(target.id);
  first.dead=true;h.c.beforeStep(.1);const saved=h.c.snapshot();const restored=new ComponentsModule(h.host('components-v1'));restored.restore(saved);restored.beforeStep(.1);expect(second.defId).toBe(d.id);
  const view=restored.snapshot({player:0,visibleEntities:new Set([second.id,ally.id]),visibleProjectiles:new Set(),privateEntity:id=>id===second.id}) as any;
  expect(view.achievements).toEqual({'0':['arena-m']});expect(view.entities[ally.id]).toBeUndefined();
  const corrupt=structuredClone(saved) as any;corrupt.achievements['0']=['unknown'];expect(()=>restored.restore(corrupt)).toThrow('achievement owner');
});
