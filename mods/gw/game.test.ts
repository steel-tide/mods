import { beforeAll, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareContentSchema } from '../../../steel-tide-game/game/core/src/game/contentSchema';
import { parseDefinitionPack } from '../../../steel-tide-game/game/core/src/game/contentDefs';
import { applyContent } from '../../../steel-tide-game/game/core/src/game/content';
import { prepareContentCapabilities } from '../../../steel-tide-game/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame } from '../../../steel-tide-game/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide-game/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide-game/game/core/src/game/state';
import { cmdBoard, cmdCancelResearch, cmdContentAction, cmdProduce, cmdResearch, techMet } from '../../../steel-tide-game/game/core/src/game/orders';
const cmdBoardOrder = (g: any, rider: any, carrier: any): boolean => { cmdBoard(g, [rider.id], carrier.id); return rider.orders.some((o: any) => o.kind === 'board'); };
import { researchOffer } from '../../../steel-tide-game/game/core/src/game/tech';
import { cmdRuleButton } from '../../../steel-tide-game/game/core/src/game/modRules';
import { serializeGame, deserializeGame } from '../../../steel-tide-game/game/core/src/game/save';
import { arena, arenaMap, stepUntil } from '../../../steel-tide-game/game/core/server/testkit/game';
import { Terrain } from '../../../steel-tide-game/game/core/src/core/types';
import { buildGameMap } from '../../../steel-tide-game/game/core/src/game/mapdefs';
import { customMapToGameMap, parseCustomMap } from '../../../steel-tide-game/game/core/src/game/customMap';

const CAP = 'gw.battle-v1';
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, 'mod.json'), 'utf8'));

beforeAll(async () => {
  await prepareContentSchema(manifest, true);
  const parsed = parseDefinitionPack(manifest);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const applied = applyContent([parsed.pack]);
  if (applied.rejected.length) throw Error(JSON.stringify(applied.rejected));
  await prepareContentCapabilities([parsed.pack]);
});

function scene(fill = Terrain.Grass) {
  const base = arena({ mode: 'campaign', fog: false, dayNight: false, metal: 100000, popCap: 500 });
  const g = createContentGame(base.st.cfg, arenaMap({ w: 96, h: 96, fill }), true);
  return { g, module: contentRuntime(g)!.module(CAP)! };
}
const ticks = (g: any, n: number) => { for (let i = 0; i < n; i++) g.step(); };
const en = (module: any, e: any) => (module.snapshot() as any).entities[e.id]?.en;
const techPoint = (module: any, owner = 0): number => (module.snapshot() as any).techPoint?.[owner] ?? 0;
const planOf = (faction: string) => manifest.tech.find((n: any) => n.factions.includes(faction));
const plansOf = (faction: string) => manifest.tech.filter((n: any) => n.factions.includes(faction));

/** a faction's headquarters standing alone, with the tech tree on */
function headquarters(faction: string) {
  const base = arena({ mode: 'campaign', fog: false, dayNight: false, metal: 100000, popCap: 500 });
  const cfg = { ...base.st.cfg, tech: true, players: base.st.cfg.players.map((p, i) => i === 0 ? { ...p, faction } : p) };
  const g = createContentGame(cfg, arenaMap({ w: 96, h: 96 }), true);
  const hq = newEnt(g.st, manifest.factions.find((f: any) => f.id === faction).headquarters, 0, 900, 900);
  hq.site = false;
  g.recomputePower();
  return { g, hq, module: contentRuntime(g)!.module(CAP)! };
}

const FACTIONS = ['gw-efsf-0079', 'gw-zeon-0079', 'gw-aeug-0087', 'gw-titans-0087', 'gw-neo-zeon-0087', 'gw-omni-ce71', 'gw-zaft-ce71'];

test('every faction starts with its HQ and builder, and the HQ trains another builder', () => {
  expect(manifest.factions.map((f: any) => f.id)).toEqual(FACTIONS);
  for (const f of manifest.factions) {
    expect(getDef(f.headquarters).isHQ).toBe(true);
    expect(getDef(f.headquarters).produces).toContain(f.builder);
    expect(getDef(f.builder).builds).toContain(f.headquarters);
    const config: any = { mode: 'sandbox', mapKey: 'greenfield', seed: 11, fog: false, popCap: 100, startMetal: 5000,
      players: [{ isHuman: true, team: 0, faction: f.id }, { isHuman: true, team: 1 }] };
    const g = createContentGame(config, buildGameMap(config));
    const own = [...g.st.ents.values()].filter(e => e.owner === 0);
    expect(own[0].defId).toBe(f.headquarters);
    expect(own.slice(1).every(e => e.defId === f.builder)).toBe(true);
    const builders = own.length - 1;
    expect(cmdProduce(g, own[0].id, f.builder)).toBe(true);
    ticks(g, 30 * 20);
    expect([...g.st.ents.values()].filter(e => e.owner === 0 && e.defId === f.builder).length).toBe(builders + 1);
    expect(() => deserializeGame(serializeGame(g))).not.toThrow();
  }
});

test('a land factory sells its base units at the source price per head', () => {
  const zaku = getDef('gw-ms-06f');
  expect(zaku.cost).toBeCloseTo((800 + 1600) / 3);
  expect(getDef('gw-factory-zeon-0079-land').produces).toContain('gw-ms-06f');
  const { g } = scene();
  const f = newEnt(g.st, 'gw-factory-zeon-0079-land', 0, 900, 900);
  f.site = false;
  ticks(g, 1);
  expect(cmdProduce(g, f.id, 'gw-ms-06f')).toBe(true);
  ticks(g, Math.ceil(zaku.buildTime * 30) + 60);
  expect([...g.st.ents.values()].some(e => e.defId === 'gw-ms-06f' && e.owner === 0)).toBe(true);
});

test('a Zaku machine gun hurts a Type 61 by the GW formula, and infantry rifles do nothing to it', () => {
  const { g } = scene();
  const zaku = newEnt(g.st, 'gw-ms-06f', 0, 600, 600);
  const tank = newEnt(g.st, 'gw-type61', 1, 760, 600);
  zaku.angle = 0; tank.angle = 0; tank.holdFire = true; zaku.holdPos = true;
  const before = tank.hp;
  const hits: number[] = [];
  for (let i = 0; i < 30 * 6 && hits.length < 6; i++) {
    const hp = tank.hp;
    g.step();
    if (tank.hp < hp) hits.push(hp - tank.hp);
  }
  expect(hits.length).toBeGreaterThan(0);
  // (575 × 110% − 45) × (1 − 10%) × 0.75..1, and ×1.25 when the round comes from behind.
  const top = (575 * 1.1 - 45) * 0.9 * 1.25;
  for (const h of hits) { expect(h).toBeGreaterThan(0); expect(h).toBeLessThanOrEqual(top + 1e-6); }
  expect(tank.hp).toBeLessThan(before);

  const s2 = scene();
  const squad = newEnt(s2.g.st, 'gw-army-squad-zeon-0079', 0, 600, 600);
  const t2 = newEnt(s2.g.st, 'gw-type61', 1, 700, 600);
  t2.holdFire = true; squad.holdPos = true;
  const hp0 = t2.hp;
  let shots = 0;
  for (let i = 0; i < 30 * 8; i++) { s2.g.step(); if (s2.g.st.projs.some(p => p.src === squad.id)) shots++; }
  expect(shots).toBeGreaterThan(0);
  // 8-damage rifles never get past 45 flat shell armour; only the bazookas tell.
  expect(t2.hp).toBeGreaterThan(hp0 - 2000);
});

test('firing spends EN, an empty unit holds its fire, and a supply point refills it', () => {
  const { g, module } = scene();
  const tank = newEnt(g.st, 'gw-type61', 0, 600, 600);
  const target = newEnt(g.st, 'gw-type61', 1, 760, 600);
  target.holdFire = true; tank.holdPos = true;
  ticks(g, 1);
  const full = en(module, tank);
  expect(full).toBe(450);
  ticks(g, 30 * 6);
  expect(en(module, tank)).toBeLessThan(full);
  // Drain it: an empty tank stops shooting.
  const state = module.snapshot() as any;
  state.entities[tank.id].en = 0;
  module.restore(state);
  const projs = () => g.st.projs.filter(p => p.src === tank.id).length;
  ticks(g, 30 * 6);
  const fired = projs();
  ticks(g, 30 * 6);
  expect(projs()).toBe(0 * fired);
  // Beside its headquarters it is refilled.
  const hq = newEnt(g.st, 'gw-hq-efsf-0079', 0, 640, 680);
  hq.site = false;
  ticks(g, 30 * 3);
  expect(en(module, tank)).toBeGreaterThan(0);
});

test('a human side pays each unit\'s MP every second; a computer side earns its income twice', () => {
  const { g } = scene();
  g.st.players[0].isHuman = true;
  for (let i = 0; i < 4; i++) newEnt(g.st, 'gw-ms-06f', 0, 500 + i * 40, 500).holdPos = true;
  ticks(g, 2);
  const m0 = g.st.players[0].metal;
  ticks(g, 30 * 5);
  // four Zakus are 2 MP each: 8 metal a second
  expect(m0 - g.st.players[0].metal).toBeCloseTo(8 * 5, -1);
});

test('the battle state survives a save', () => {
  const { g, module } = scene();
  const a = newEnt(g.st, 'gw-ms-06f', 0, 600, 600);
  const b = newEnt(g.st, 'gw-type61', 1, 760, 600);
  b.holdFire = true; a.holdPos = true;
  ticks(g, 30 * 3);
  const g2 = deserializeGame(serializeGame(g));
  const m2 = contentRuntime(g2)!.module(CAP)!;
  expect((m2.snapshot() as any).entities[a.id].en).toBeCloseTo(en(module, a));
});

test('a submarine dives and surfaces from its card', () => {
  const { g } = scene(Terrain.Water);
  const u = newEnt(g.st, 'gw-u-type-submarine', 0, 900, 900);
  ticks(g, 1);
  expect(getDef('gw-u-type-submarine').underwater).toBeFalsy();
  expect(cmdRuleButton(g, [u.id], 'gw-u-type-submarine', 0)).toBe(true);
  ticks(g, 2);
  expect(u.defId).toBe('gw-u-type-submarine-submerged');
  expect(getDef(u.defId).underwater).toBe(true);
  expect(cmdRuleButton(g, [u.id], u.defId, 0)).toBe(true);
  ticks(g, 2);
  expect(u.defId).toBe('gw-u-type-submarine');
});

test('a Zaku changes its loadout only beside a supply point', () => {
  const { g } = scene();
  const z = newEnt(g.st, 'gw-ms-06f', 0, 600, 600);
  ticks(g, 1);
  expect(cmdRuleButton(g, [z.id], 'gw-ms-06f', 0)).toBe(false);
  const depot = newEnt(g.st, 'gw-supply-depot-t1', 0, 680, 600);
  depot.site = false;
  // the package raises the supplied flag on its next second
  ticks(g, 31);
  expect(z.rs?.flags).toContain('gw-supplied');
  expect(cmdRuleButton(g, [z.id], 'gw-ms-06f', 0)).toBe(true);
  ticks(g, 30 * 5);
  expect(z.defId).toBe('gw-ms-06f-bazooka');
});

test('the Zaku II C\'s warhead is the player\'s to aim, once in its cooldown, and never fires by itself', () => {
  const { g, module } = scene();
  const c = newEnt(g.st, 'gw-ms-06c', 0, 400, 600);
  const t = newEnt(g.st, 'gw-type61', 1, 800, 600);
  c.holdPos = true; t.holdFire = true; t.holdPos = true;
  const gun = 'gw-ms-06c/ZN_MS_06C_Bombing_Nuke';
  const nukes = () => g.st.projs.filter(p => p.src === c.id && p.gun === gun).length;
  let fired = 0;
  for (let i = 0; i < 30 * 10; i++) { const n = nukes(); g.step(); if (nukes() > n) fired++; }
  expect(fired).toBe(0);
  const action = contentRuntime(g)!.inspect(c, 0).actions.find(a => a.id === 'skill/ZN_MS_06C_Bombing_Nuke')!;
  expect(action.target).toBe('ground');
  expect(action.enabled).toBe(true);
  const order = { action: action.id, ids: [c.id], owner: 0, x: t.x, y: t.y };
  expect(cmdContentAction(g, CAP, order)).toBe(true);
  const en0 = en(module, c);
  for (let i = 0; i < 30 * 10; i++) { const n = nukes(); g.step(); if (nukes() > n) fired++; }
  expect(fired).toBe(1);
  expect(en0).toBeLessThan(getDef('gw-ms-06c').extensions![CAP].en.max);
  expect(cmdContentAction(g, CAP, order)).toBe(false);
});

for (const faction of FACTIONS) test(`a computer ${faction} side builds a ground line and fields armed units`, () => {
  const config: any = { mode: 'sandbox', mapKey: 'greenfield', seed: 19, fog: false, popCap: 200, startMetal: 12000,
    players: [{ isHuman: false, team: 0, faction }, { isHuman: true, team: 1 }] };
  const g = createContentGame(config, buildGameMap(config));
  ticks(g, 30 * 240);
  const own = [...g.st.ents.values()].filter(e => e.owner === 0 && !e.dead);
  expect(own.some(e => e.defId.endsWith('-land') && !e.site)).toBe(true);
  expect(own.filter(e => getDef(e.defId).kind === 'unit' && !getDef(e.defId).buildRate && getDef(e.defId).weapons.length > 0).length).toBeGreaterThan(3);
}, 60000);

const showcases = (manifest.maps as string[]).filter(m => m.includes('showcase-'));
test('the showcase maps stand every definition between them, but the drones and mines a skill puts down', () => {
  const placed = new Set<string>();
  for (const m of showcases) for (const p of JSON.parse(readFileSync(resolve(import.meta.dir, m), 'utf8')).units) placed.add(p.id);
  const skillMade = (d: any) => d.extends === 'landmine' || d.extensions?.[CAP]?.drone;
  expect(manifest.defs.filter((d: any) => !skillMade(d) && !placed.has(d.id)).map((d: any) => d.id)).toEqual([]);
});

for (const m of showcases) test(`${m} stands its pieces, each where it was laid, and no side in reach of another`, () => {
  const text = readFileSync(resolve(import.meta.dir, m), 'utf8');
  const parsed = parseCustomMap(text);
  if (!parsed.ok) throw Error(parsed.error);
  const pieces = JSON.parse(text).units;
  expect(parsed.data.units!.length).toBe(pieces.length);
  // each seat's faction is the one whose headquarters stands for it; a seat with none is open
  const seats = parsed.data.spawns.map((_: any, i: number) => manifest.factions.find((f: any) => pieces.some((p: any) => p.owner === i && p.id === f.headquarters)));
  const config: any = { mode: 'sandbox', mapKey: 'custom', customMap: parsed.data, seed: 5, fog: false, popCap: 500, startMetal: 20000,
    players: seats.map((f: any, team: number) => ({ isHuman: true, team, ...(f ? { faction: f.id } : {}) })) };
  const g = createContentGame(config, customMapToGameMap(parsed.data));
  const laid = [...g.st.ents.values()];
  const want = new Map<string, number>();
  for (const f of seats) if (f) { want.set(f.headquarters, 1); want.set(f.builder, 2); }
  for (const p of pieces) want.set(p.id, (want.get(p.id) ?? 0) + 1);
  for (const d of manifest.defs) expect(laid.filter(e => e.defId === d.id).length, d.id).toBe(want.get(d.id) ?? 0);
  for (const p of pieces.filter((p: any) => getDef(p.id).kind === 'unit')) {
    expect(laid.some(e => e.defId === p.id && e.owner === p.owner && Math.hypot(e.x - (p.x + 0.5) * 32, e.y - (p.y + 0.5) * 32) < 1), p.id).toBe(true);
  }
  const hp = new Map(laid.map(e => [e.id, e.hp]));
  ticks(g, 30 * 20);
  expect(g.st.projs.length).toBe(0);
  // a system's run (EXAM, HADES) wears its own hull
  expect(laid.filter(e => !getDef(e.defId).extensions?.[CAP]?.drain && (e.dead || e.hp < hp.get(e.id)! - 1)).map(e => e.defId)).toEqual([]);
}, 120000);

test('the source\'s ground maps load as Steel Tide maps', () => {
  const sources = (manifest.maps as string[]).filter(m => !m.includes('showcase-'));
  expect(sources.length).toBe(9);
  expect(manifest.maps.length).toBeLessThanOrEqual(16);
  for (const m of sources) {
    const parsed = parseCustomMap(readFileSync(resolve(import.meta.dir, m), 'utf8'));
    if (!parsed.ok) throw Error(`${m}: ${parsed.error}`);
    expect(parsed.data.spawns.length, m).toBeGreaterThanOrEqual(2);
    const config: any = { mode: 'sandbox', mapKey: 'custom', customMap: parsed.data, seed: 3, fog: true, popCap: 100, startMetal: 5000,
      players: [{ isHuman: true, team: 0, faction: 'gw-efsf-0079' }, { isHuman: false, team: 1, faction: 'gw-zeon-0079' }] };
    const g = createContentGame(config, customMapToGameMap(parsed.data));
    ticks(g, 30);
    expect([...g.st.ents.values()].filter(e => getDef(e.defId).isHQ).length, m).toBe(2);
  }
}, 120000);

for (const faction of ['gw-efsf-0079', 'gw-zeon-0079']) test(`${faction} researches its first plan at its headquarters, TechPoint first, and the plan opens its units`, () => {
  const { g, hq, module } = headquarters(faction);
  const plan = planOf(faction);
  const ask = manifest.defs.find((d: any) => d.id === hq.defId).extensions[CAP].research[plan.id];
  const units = manifest.defs.filter((d: any) => d.requires?.includes(plan.id));
  expect(ask).toBe(1200);
  expect(units.length).toBeGreaterThan(9);
  expect(researchOffer(g.st, 0, hq.defId)).toEqual([plan.id]);
  for (const u of units) expect(techMet(g.st, 0, u.id), u.id).toBe(false);
  expect(cmdResearch(g, hq.id, plan.id)).toBe(true);
  // the headquarters earns 7.5 TechPoint a second; until the plan's 1200 are in hand it waits, unbilled
  const spent = g.st.players[0].stats.metalSpent;
  ticks(g, 30 * 60);
  expect(hq.research!.progress).toBe(0);
  expect(g.st.players[0].stats.metalSpent).toBe(spent);
  // the package's clock ticks whole seconds: 59 or 60 of them in a minute's ticks
  expect(techPoint(module)).toBeGreaterThanOrEqual(7.5 * 59);
  expect(techPoint(module)).toBeLessThanOrEqual(7.5 * 60);
  expect(contentRuntime(g)!.inspect(hq, 0).rows.find(r => r.id === 'techPoint')?.tone).toBe('warning');
  expect(stepUntil(g, () => g.st.players[0].tech?.includes(plan.id) === true, 30 * 240)).toBeGreaterThan(0);
  expect(g.st.time).toBeGreaterThan(ask / 7.5 + plan.time - 2);
  expect(g.st.players[0].stats.metalSpent - spent).toBeCloseTo(plan.cost, 0);
  for (const u of units) expect(techMet(g.st, 0, u.id), u.id).toBe(true);
  const factory = newEnt(g.st, units[0].producedBy[0], 0, 1300, 900);
  factory.site = false;
  ticks(g, 1);
  expect(cmdProduce(g, factory.id, units[0].id)).toBe(true);
}, 60000);

for (const [faction, ship] of [['gw-efsf-0079', 'gw-big-tray-class'], ['gw-zeon-0079', 'gw-dabude-class']]) test(`${faction}'s second plan waits on its first, takes its own TechPoint, and opens its units and the Mega Factory's ${ship}`, () => {
  const { g, hq, module } = headquarters(faction);
  const [first, second] = plansOf(faction);
  expect(second.requires).toEqual([first.id]);
  const price = manifest.defs.find((d: any) => d.id === hq.defId).extensions[CAP].research;
  expect(price[second.id]).toBe(3600);
  // offered once the first is on order, and queued behind it
  expect(researchOffer(g.st, 0, hq.defId)).toEqual([first.id]);
  expect(cmdResearch(g, hq.id, second.id)).toBe(false);
  expect(cmdResearch(g, hq.id, first.id)).toBe(true);
  expect(researchOffer(g.st, 0, hq.defId)).toEqual([second.id]);
  expect(cmdResearch(g, hq.id, second.id)).toBe(true);
  const state = module.snapshot() as any;
  state.techPoint[0] = 1200 + 3600;
  module.restore(state);
  expect(stepUntil(g, () => g.st.players[0].tech?.includes(second.id) === true, 30 * 120)).toBeGreaterThan(0);
  expect(g.st.players[0].tech).toEqual([first.id, second.id]);
  expect(techPoint(module)).toBeLessThan(7.5 * 70);
  const units = manifest.defs.filter((d: any) => d.requires?.includes(second.id));
  expect(units.length).toBeGreaterThan(8);
  for (const u of units) expect(techMet(g.st, 0, u.id), u.id).toBe(true);
  const mega = newEnt(g.st, manifest.defs.find((d: any) => d.id.endsWith('-mega') && d.id.includes(faction.slice(3, 7))).id, 0, 1500, 900);
  mega.site = false;
  ticks(g, 1);
  expect(getDef(mega.defId).produces).toContain(ship);
  expect(cmdProduce(g, mega.id, ship)).toBe(true);
}, 60000);

test('an Institute adds its TechPoint; a plan taken off the queue gives its TechPoint back; both survive a save', () => {
  const { g, hq, module } = headquarters('gw-zeon-0079');
  const institute = newEnt(g.st, 'gw-institute-t1', 0, 1100, 900);
  institute.site = false;
  ticks(g, 30 * 10 + 1);
  expect(techPoint(module)).toBeCloseTo((7.5 + 0.75) * 10, 6);
  const state = module.snapshot() as any;
  state.techPoint[0] = 5000;
  module.restore(state);
  const plan = planOf('gw-zeon-0079');
  expect(cmdResearch(g, hq.id, plan.id)).toBe(true);
  ticks(g, 30 * 5);
  expect(hq.research!.progress).toBeGreaterThan(0);
  expect(techPoint(module)).toBeLessThan(5000 - 1200 + 50);
  const g2 = deserializeGame(serializeGame(g));
  const m2 = contentRuntime(g2)!.module(CAP)!;
  expect(techPoint(m2)).toBeCloseTo(techPoint(module), 6);
  expect((m2.snapshot() as any).paid).toEqual({ [hq.id]: plan.id });
  const before = techPoint(module);
  expect(cmdCancelResearch(g, hq.id, 0)).toBe(true);
  ticks(g, 2);
  expect(techPoint(module)).toBeGreaterThanOrEqual(before + 1200);
});

for (const faction of ['gw-efsf-0079', 'gw-zeon-0079']) test(`a computer ${faction} side climbs its tree`, () => {
  const config: any = { mode: 'sandbox', mapKey: 'greenfield', seed: 19, fog: false, popCap: 200, startMetal: 12000,
    players: [{ isHuman: false, team: 0, faction }, { isHuman: true, team: 1 }] };
  const g = createContentGame(config, buildGameMap(config));
  const [first, second] = plansOf(faction).map((n: any) => n.id);
  // a computer side earns three quarters of the TechPoint: 1200 at 5.6 a second, then 30 seconds of work
  expect(stepUntil(g, () => g.st.players[0].tech?.includes(first) === true, 30 * 60 * 8)).toBeGreaterThan(0);
  // and the second plan's 3600 after it
  expect(stepUntil(g, () => g.st.players[0].tech?.includes(second) === true, 30 * 60 * 14)).toBeGreaterThan(0);
}, 180000);

test('every hull and turret sheet turns smoothly rather than in the 24 baked headings', () => {
  // the game turns a u./tur./dec. sheet live only when its pivotX is 0.5 (spriteLoader's liveRotated)
  const stepped = manifest.sprites.filter((s: any) => s.rotated && /^(u|tur|dec)\./.test(s.key) && (s.pivotX ?? 0.5) !== 0.5);
  expect(stepped.map((s: any) => s.key)).toEqual([]);
  for (const d of manifest.defs.filter((d: any) => d.kind === 'unit')) {
    expect(manifest.sprites.find((s: any) => s.key === d.sprite)?.rotated, d.id).toBe(true);
  }
});

// ---------------------------------------------------------------- the battle systems

const state = (module: any, e: any) => (module.snapshot() as any).entities[e.id];
const setState = (module: any, e: any, change: (s: any) => void) => {
  const snap = module.snapshot() as any;
  change(snap.entities[e.id]);
  module.restore(snap);
};
const skillOf = (kind: string) => {
  for (const d of manifest.defs) for (const w of d.weapons ?? []) if (w.extensions?.[CAP]?.skill?.kind === kind && !d.id.startsWith('gw-ace-')) return { def: d.id, weapon: w.id, skill: w.extensions[CAP].skill };
  throw Error('no ' + kind);
};
/** a faction's seat with the tech tree on, nothing standing */
function seat(faction: string) {
  const base = arena({ mode: 'campaign', fog: false, dayNight: false, metal: 100000, popCap: 500 });
  const cfg = { ...base.st.cfg, tech: true, players: base.st.cfg.players.map((p, i) => i === 0 ? { ...p, faction } : p) };
  const g = createContentGame(cfg, arenaMap({ w: 96, h: 96 }), true);
  return { g, rt: contentRuntime(g)!, module: contentRuntime(g)!.module(CAP)! };
}

test('every unit is made with a pilot of its kind, and a command ship with an officer', () => {
  const { g, module } = scene();
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 600, 600);
  const ship = newEnt(g.st, 'gw-himalaya-class', 0, 900, 900);
  ticks(g, 2);
  const p = state(module, gm).pilot;
  for (const k of ['shoot', 'cqb', 'def', 'speed', 'accuracy', 'reaction']) { expect(p[k]).toBeGreaterThanOrEqual(100); expect(p[k]).toBeLessThan(110); }
  expect(p.leadership).toBeGreaterThanOrEqual(55);
  expect(state(module, ship).pilot.leadership).toBeGreaterThanOrEqual(100);
  expect(state(module, ship).pilot.shoot).toBeLessThan(57);
});

test('a pilot learns from the harm it does and climbs a level, its skills rising by its comprehension', () => {
  const { g, module } = scene();
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 600, 600);
  const tank = newEnt(g.st, 'gw-type61', 1, 760, 600);
  tank.holdFire = true; gm.holdPos = true;
  ticks(g, 2);
  const before = state(module, gm).pilot;
  setState(module, gm, s => { s.pilot.exp = s.pilot.need - 1; });
  expect(stepUntil(g, () => state(module, gm).pilot.level === 1, 30 * 30)).toBeGreaterThan(0);
  const after = state(module, gm).pilot;
  expect(after.shoot).toBeCloseTo(before.shoot * before.comprehension / 100, 6);
  expect(after.need).toBeCloseTo(before.need * 1.5, 6);
});

test('the Academy trains a pilot who boards a unit left without one, and keeps its training', () => {
  const { g, rt, module } = seat('gw-efsf-0079');
  const academy = newEnt(g.st, 'gw-academy-t1', 0, 900, 900);
  academy.site = false;
  ticks(g, 2);
  const metal = g.st.players[0].metal;
  expect(cmdContentAction(g, CAP, { action: 'train/shoot', ids: [academy.id], owner: 0 })).toBe(true);
  expect(g.st.players[0].metal).toBe(metal - 1500);
  expect(rt.inspect(academy, 0).actions.map(a => a.id)).toContain('pilot/N');
  expect(cmdContentAction(g, CAP, { action: 'pilot/N', ids: [academy.id], owner: 0 })).toBe(true);
  expect(stepUntil(g, () => [...g.st.ents.values()].some(e => e.defId === 'gw-pilot-efsf-0079'), 30 * 6)).toBeGreaterThan(0);
  const pilot = [...g.st.ents.values()].find(e => e.defId === 'gw-pilot-efsf-0079')!;
  // trained as a shooter: shoot ×1.1 on a 100–110 roll, at the Academy's level 1
  expect(state(module, pilot).carry.shoot).toBeGreaterThanOrEqual(100 * 1.025 * 1.1);
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 1000, 900);
  ticks(g, 2);
  expect(cmdContentAction(g, CAP, { action: 'unload', ids: [gm.id], owner: 0 })).toBe(true);
  expect(state(module, gm).pilot).toBeNull();
  const walker = [...g.st.ents.values()].filter(e => e.defId === 'gw-pilot-efsf-0079' && e.id !== pilot.id)[0];
  expect(walker).toBeDefined();
  expect(cmdContentAction(g, CAP, { action: 'board', ids: [pilot.id], owner: 0, targetId: gm.id })).toBe(true);
  expect(stepUntil(g, () => !!state(module, gm).pilot, 30 * 20)).toBeGreaterThan(0);
  expect(pilot.dead).toBe(true);
});

test('the beacon calls a named ACE once its plan is researched, one at a time, with the ACE\'s own skills', () => {
  const { g, rt, module } = seat('gw-efsf-0079');
  const beacon = newEnt(g.st, 'gw-beacon-ace-0079', 0, 900, 900);
  beacon.site = false;
  ticks(g, 2);
  expect(rt.inspect(beacon, 0).actions.some(a => a.id === 'ace/gw-ace-amr')).toBe(false);
  g.st.players[0].tech = [...getDef('gw-ace-amr').requires!];
  const order = { action: 'ace/gw-ace-amr', ids: [beacon.id], owner: 0 };
  expect(cmdContentAction(g, CAP, order)).toBe(true);
  expect(cmdContentAction(g, CAP, order)).toBe(false);
  expect(stepUntil(g, () => [...g.st.ents.values()].some(e => e.defId === 'gw-ace-amr'), 30 * 40)).toBeGreaterThan(0);
  const amuro = [...g.st.ents.values()].find(e => e.defId === 'gw-ace-amr')!;
  ticks(g, 2);
  expect(state(module, amuro).pilot.ace).toBe('AMR');
  expect(state(module, amuro).pilot.shoot).toBe(190);
  expect(cmdContentAction(g, CAP, order)).toBe(false);
}, 30000);

test('a broken right arm holds the hand weapons, a broken head shortens sight and reach, and any break locks a transformation', () => {
  const { g, module } = scene();
  const rt = contentRuntime(g)!;
  const zeta = newEnt(g.st, 'gw-msz-006', 0, 600, 600);
  ticks(g, 2);
  const whole = contentRuntime(g)!.module(CAP)!;
  const d0 = rt.module(CAP)!.effectiveDef!(zeta, getDef(zeta.defId));
  setState(module, zeta, s => { s.parts = 1 | 8; });
  zeta.rs!.flags = [...(zeta.rs!.flags ?? []), 'gw-cant-transform'];
  const d1 = rt.module(CAP)!.effectiveDef!(zeta, getDef(zeta.defId));
  expect(d1.vision).toBeLessThan(d0.vision);
  expect(d1.weapons[0].range).toBeCloseTo(d0.weapons[0].range * 0.75, 6);
  const hand = getDef(zeta.defId).weapons.find(w => w.extensions?.[CAP]?.hand)!;
  expect(whole.canFire!(zeta, getDef(zeta.defId), hand, { x: 700, y: 600 }, null)).toBe(false);
  expect(cmdRuleButton(g, [zeta.id], zeta.defId, getDef(zeta.defId).rules!.findIndex(r => ([] as any[]).concat(r.do).some((e: any) => e.morph === 'gw-msz-006-ma')))).toBe(false);
});

test('a mobile suit hit hard and often loses parts', () => {
  const { g, module } = scene();
  // a Gundam, sturdy enough to stand the Guncannon's rounds while they work on its parts
  const zaku = newEnt(g.st, 'gw-rx-78-2', 1, 760, 600);
  const guns = [newEnt(g.st, 'gw-rx-77-2', 0, 600, 600)];
  zaku.holdFire = true; zaku.holdPos = true;
  for (const e of guns) e.holdPos = true;
  ticks(g, 2);
  // keep it standing so the hits go on
  const top = getDef(zaku.defId).hp;
  zaku.hp = top * 0.5;
  for (let i = 0; i < 30 * 60 && !state(module, zaku)?.parts; i++) { g.step(); zaku.hp = Math.max(zaku.hp, top * 0.5); }
  expect(zaku.dead).toBeFalsy();
  expect(state(module, zaku).parts).toBeGreaterThan(0);
}, 30000);

test('DP past its whole staggers a unit, which cannot fire while it lasts', () => {
  const { g, module } = scene();
  const rt = contentRuntime(g)!;
  const zaku = newEnt(g.st, 'gw-ms-06f', 0, 600, 600);
  ticks(g, 2);
  setState(module, zaku, s => { s.staggerUntil = g.st.time + 5; });
  const w = getDef(zaku.defId).weapons[0];
  expect(rt.module(CAP)!.canFire!(zaku, getDef(zaku.defId), w, { x: 700, y: 600 }, null)).toBe(false);
  expect(rt.module(CAP)!.effectiveDef!(zaku, getDef(zaku.defId)).speed).toBeCloseTo(getDef(zaku.defId).speed * 0.25 * (1 + (state(module, zaku).pilot.speed - 100) * 0.00105), 3);
});

test('a shield takes the blows it blocks; an I-Field turns beams and PS armour shells', () => {
  const { g, module } = scene();
  const gm = newEnt(g.st, 'gw-rgm-79-e', 1, 760, 600);
  const zaku = newEnt(g.st, 'gw-ms-06f', 0, 600, 600);
  gm.holdFire = true; gm.holdPos = true; zaku.holdPos = true;
  ticks(g, 2);
  const shield = state(module, gm).shield;
  expect(stepUntil(g, () => state(module, gm).shield < shield, 30 * 30)).toBeGreaterThan(0);

  const s2 = scene();
  // within the Gundam's detection: the field is struck only by what finds it
  const zam = newEnt(s2.g.st, 'gw-ma-08', 1, 820, 600);
  const gundam = newEnt(s2.g.st, 'gw-rx-79-g-beam-rifle', 0, 600, 600);
  zam.holdFire = true; zam.holdPos = true; gundam.holdPos = true;
  ticks(s2.g, 2);
  const field = state(s2.module, zam).field;
  expect(stepUntil(s2.g, () => state(s2.module, zam).field < field, 30 * 30)).toBeGreaterThan(0);

  const s3 = scene();
  const duel = newEnt(s3.g.st, 'gw-gat-x102', 1, 600, 600);
  ticks(s3.g, 2);
  expect(state(s3.module, duel).psa).toBe(true);
  expect(cmdContentAction(s3.g, CAP, { action: 'psa', ids: [duel.id], owner: 1 })).toBe(true);
  expect(state(s3.module, duel).psa).toBe(false);
}, 30000);

test('an enemy is seen only once a detector finds it, and stays found five seconds', () => {
  const { g } = scene();
  const rt = contentRuntime(g)!;
  const zaku = newEnt(g.st, 'gw-ms-06f', 1, 2500, 2500);
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 600, 600);
  zaku.holdPos = true; gm.holdPos = true;
  ticks(g, 31);
  expect(rt.visible(zaku, g.st.players[0].team)).toBe(false);
  zaku.x = 700; zaku.y = 600;
  ticks(g, 31);
  expect(rt.visible(zaku, g.st.players[0].team)).toBe(true);
  zaku.x = 2500; zaku.y = 2500;
  ticks(g, 30 * 2);
  expect(rt.visible(zaku, g.st.players[0].team)).toBe(true);
  ticks(g, 30 * 5);
  expect(rt.visible(zaku, g.st.players[0].team)).toBe(false);
});

test('FullBoost spends its EN for twelve seconds of speed, then its cooldown', () => {
  const { g, module } = scene();
  const rt = contentRuntime(g)!;
  const pr = newEnt(g.st, 'gw-rx-80pr-ground-type', 0, 600, 600);
  ticks(g, 2);
  const speed = rt.module(CAP)!.effectiveDef!(pr, getDef(pr.defId)).speed;
  const en0 = state(module, pr).en;
  expect(cmdContentAction(g, CAP, { action: 'boost', ids: [pr.id], owner: 0 })).toBe(true);
  expect(state(module, pr).en).toBeCloseTo(en0 - 100, 6);
  expect(rt.module(CAP)!.effectiveDef!(pr, getDef(pr.defId)).speed).toBeCloseTo(speed * 1.2, 3);
  expect(cmdContentAction(g, CAP, { action: 'boost', ids: [pr.id], owner: 0 })).toBe(false);
});

test('aimed and instant skills: a mortar falls on its point, mines are laid, a pulse stuns, drones fly and come home', () => {
  const mortar = skillOf('shot');
  const { g, module } = scene();
  const gun = newEnt(g.st, 'gw-rx-75', 0, 600, 600);
  gun.holdFire = true;
  ticks(g, 2);
  const w = getDef('gw-rx-75').weapons.find(x => x.extensions?.[CAP]?.skill)!;
  expect(cmdContentAction(g, CAP, { action: 'skill/' + w.id, ids: [gun.id], owner: 0, x: 1000, y: 600 })).toBe(true);
  expect(stepUntil(g, () => g.st.projs.some(p => p.src === gun.id && p.gun.endsWith('/' + w.id)), 30 * 5)).toBeGreaterThan(0);
  expect(mortar.skill.aim).toBe('ground');

  const mines = skillOf('mines');
  const s2 = scene();
  const layer = newEnt(s2.g.st, mines.def, 0, 600, 600);
  ticks(s2.g, 2);
  expect(cmdContentAction(s2.g, CAP, { action: 'skill/' + mines.weapon, ids: [layer.id], owner: 0 })).toBe(true);
  expect(stepUntil(s2.g, () => [...s2.g.st.ents.values()].some(e => e.defId === mines.skill.spawn), 30 * 15)).toBeGreaterThan(0);

  const pulse = skillOf('emp');
  const s3 = scene();
  const ap = newEnt(s3.g.st, pulse.def, 0, 600, 600);
  const near = newEnt(s3.g.st, 'gw-ms-06f', 1, 680, 600);
  near.holdFire = true;
  ticks(s3.g, 2);
  expect(cmdContentAction(s3.g, CAP, { action: 'skill/' + pulse.weapon, ids: [ap.id], owner: 0 })).toBe(true);
  expect(state(s3.module, near).stunUntil).toBeGreaterThan(s3.g.st.time);

  const drone = skillOf('drone');
  const s4 = scene();
  const host = newEnt(s4.g.st, drone.def, 0, 600, 600);
  ticks(s4.g, 2);
  expect(cmdContentAction(s4.g, CAP, { action: 'skill/' + drone.weapon, ids: [host.id], owner: 0 })).toBe(true);
  expect(stepUntil(s4.g, () => [...s4.g.st.ents.values()].some(e => e.defId === drone.skill.spawn && !e.dead), 30 * 5)).toBeGreaterThan(0);
  expect(stepUntil(s4.g, () => ![...s4.g.st.ents.values()].some(e => e.defId === drone.skill.spawn && !e.dead), 30 * 30)).toBeGreaterThan(0);
}, 60000);

test('a mobile suit transforms to its flight form, and a Type 61 converts at a supply point once its plan is in', () => {
  const { g } = scene();
  const zeta = newEnt(g.st, 'gw-msz-006', 0, 600, 600);
  ticks(g, 2);
  const i = getDef('gw-msz-006').rules!.findIndex(r => ([] as any[]).concat(r.do).some((e: any) => e.morph === 'gw-msz-006-ma'));
  expect(cmdRuleButton(g, [zeta.id], 'gw-msz-006', i)).toBe(true);
  ticks(g, 2);
  expect(zeta.defId).toBe('gw-msz-006-ma');
  expect(getDef(zeta.defId).domain).toBe('air');

  const s = seat('gw-efsf-0079');
  const t61 = newEnt(s.g.st, 'gw-type61', 0, 600, 600);
  const depot = newEnt(s.g.st, 'gw-supply-depot-t1', 0, 680, 600);
  depot.site = false;
  ticks(s.g, 31);
  const r = getDef('gw-type61').rules!.findIndex(x => ([] as any[]).concat(x.do).some((e: any) => e.morph === 'gw-type61a5'));
  expect(cmdRuleButton(s.g, [t61.id], 'gw-type61', r)).toBe(false);
  s.g.st.players[0].tech = [...getDef('gw-type61').rules![r].button!.requires!];
  expect(cmdRuleButton(s.g, [t61.id], 'gw-type61', r)).toBe(true);
  expect(stepUntil(s.g, () => t61.defId === 'gw-type61a5', 30 * 30)).toBeGreaterThan(0);
});

test('a mobile suit riding a sub-flight system fires from it', () => {
  const { g } = scene();
  const dodai = newEnt(g.st, 'gw-dodai-ys', 0, 600, 600);
  const rider = newEnt(g.st, 'gw-ms-06f', 0, 620, 600);
  ticks(g, 1);
  expect(cmdBoardOrder(g, rider, dodai)).toBe(true);
  expect(stepUntil(g, () => rider.inside === dodai.id, 30 * 10)).toBeGreaterThan(0);
  const target = newEnt(g.st, 'gw-type61', 1, 760, 600);
  target.holdFire = true; target.holdPos = true; dodai.holdPos = true;
  expect(stepUntil(g, () => g.st.projs.some(p => p.src === rider.id), 30 * 20)).toBeGreaterThan(0);
}, 30000);

test('a command ship lifts the allies round it with its officer\'s leadership', () => {
  const { g, module } = scene();
  newEnt(g.st, 'gw-himalaya-class', 0, 900, 900);
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 960, 900);
  ticks(g, 31);
  const aura = state(module, gm).aura;
  expect(aura?.com).toBeGreaterThan(1.09);
});

test('a unit asking MoralPoint waits on the factory once the side has spent its thousand', () => {
  const { g, module } = seat('gw-zeon-0079');
  const f = newEnt(g.st, 'gw-factory-zeon-0079-land', 0, 900, 900);
  f.site = false;
  // a headquarters powers the line
  newEnt(g.st, 'gw-hq-zeon-0079', 0, 1300, 900).site = false;
  g.recomputePower();
  g.st.players[0].tech = manifest.tech.filter((n: any) => n.factions.includes('gw-zeon-0079')).map((n: any) => n.id);
  ticks(g, 2);
  for (let i = 0; i < 5; i++) expect(cmdProduce(g, f.id, 'gw-ms-06c')).toBe(true);
  ticks(g, 30 * 60 * 4);
  expect([...g.st.ents.values()].filter(e => e.defId === 'gw-ms-06c').length).toBe(4);
  expect((module.snapshot() as any).moral[0]).toBe(0);
}, 60000);

test('a harder computer side earns more of its refineries\' income', () => {
  const earn = (difficulty: string) => {
    const base = arena({ mode: 'campaign', fog: false, dayNight: false, metal: 0, popCap: 500 });
    const cfg = { ...base.st.cfg, players: base.st.cfg.players.map((p, i) => i === 0 ? { ...p, isHuman: false, difficulty, faction: 'gw-efsf-0079' } : p) };
    const g = createContentGame(cfg, arenaMap({ w: 64, h: 64 }), true);
    g.st.players[0].isHuman = false; (g.st.players[0] as any).difficulty = difficulty;
    const r = newEnt(g.st, 'gw-refinery-t1', 0, 600, 600);
    r.site = false;
    ticks(g, 31);
    const m0 = g.st.players[0].metal;
    ticks(g, 30 * 10);
    return g.st.players[0].metal - m0;
  };
  expect(earn('veteran') / earn('standard')).toBeCloseTo(1.75, 1);
});

test('pilots, parts, shields and skills survive a save', () => {
  const { g, module } = scene();
  const gm = newEnt(g.st, 'gw-rgm-79-e', 0, 600, 600);
  ticks(g, 2);
  setState(module, gm, s => { s.parts = 4; s.shield = 1234; s.cd = { boost: 99 }; });
  const g2 = deserializeGame(serializeGame(g));
  const m2 = contentRuntime(g2)!.module(CAP)!;
  expect(state(m2, gm)).toEqual(state(module, gm));
});
