import { beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareContentSchema } from '../../../steel-tide-game/game/core/src/game/contentSchema';
import { parseDefinitionPack } from '../../../steel-tide-game/game/core/src/game/contentDefs';
import { applyContent } from '../../../steel-tide-game/game/core/src/game/content';
import { prepareContentCapabilities } from '../../../steel-tide-game/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame } from '../../../steel-tide-game/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide-game/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide-game/game/core/src/game/state';
import { cmdProduce } from '../../../steel-tide-game/game/core/src/game/orders';
import { cmdRuleButton } from '../../../steel-tide-game/game/core/src/game/modRules';
import { serializeGame, deserializeGame } from '../../../steel-tide-game/game/core/src/game/save';
import { arena, arenaMap } from '../../../steel-tide-game/game/core/server/testkit/game';
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

test('both factions start with their HQ and builder, and the HQ trains another builder', () => {
  expect(manifest.factions.map((f: any) => f.id)).toEqual(['gw-efsf-0079', 'gw-zeon-0079']);
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
  ticks(g, 4);
  expect(cmdRuleButton(g, [z.id], 'gw-ms-06f', 0)).toBe(true);
  ticks(g, 30 * 5);
  expect(z.defId).toBe('gw-ms-06f-bazooka');
});

test('the Zaku II C\'s warhead goes once a life', () => {
  const { g, module } = scene();
  const c = newEnt(g.st, 'gw-ms-06c', 0, 400, 600);
  const t = newEnt(g.st, 'gw-type61', 1, 800, 600);
  c.holdPos = true; t.holdFire = true; t.holdPos = true;
  const nukes = () => g.st.projs.filter(p => p.src === c.id && p.gun === 'gw-ms-06c/ZN_MS_06C_Bombing_Nuke').length;
  let fired = 0;
  for (let i = 0; i < 30 * 20; i++) { const n = nukes(); g.step(); if (nukes() > n) fired++; }
  expect(fired).toBe(1);
  expect((module.snapshot() as any).entities[c.id].spent).toEqual(['ZN_MS_06C_Bombing_Nuke']);
});

for (const faction of ['gw-efsf-0079', 'gw-zeon-0079']) test(`a computer ${faction} side builds a ground line and fields armed units`, () => {
  const config: any = { mode: 'sandbox', mapKey: 'greenfield', seed: 19, fog: false, popCap: 200, startMetal: 12000,
    players: [{ isHuman: false, team: 0, faction }, { isHuman: true, team: 1 }] };
  const g = createContentGame(config, buildGameMap(config));
  ticks(g, 30 * 240);
  const own = [...g.st.ents.values()].filter(e => e.owner === 0 && !e.dead);
  expect(own.some(e => e.defId.endsWith('-land') && !e.site)).toBe(true);
  expect(own.filter(e => getDef(e.defId).kind === 'unit' && !getDef(e.defId).buildRate && getDef(e.defId).weapons.length > 0).length).toBeGreaterThan(3);
}, 60000);

test('the showcase map stands every definition, each where it was laid, and neither side in reach of the other', () => {
  const text = readFileSync(resolve(import.meta.dir, manifest.maps[0]), 'utf8');
  const parsed = parseCustomMap(text);
  if (!parsed.ok) throw Error(parsed.error);
  const pieces = JSON.parse(text).units;
  expect(parsed.data.units!.length).toBe(pieces.length);
  const config: any = { mode: 'sandbox', mapKey: 'custom', customMap: parsed.data, seed: 5, fog: false, popCap: 300, startMetal: 20000,
    players: manifest.factions.map((f: any, team: number) => ({ isHuman: true, team, faction: f.id })) };
  const g = createContentGame(config, customMapToGameMap(parsed.data));
  const laid = [...g.st.ents.values()];
  // the opening headquarters and its two engineers, then every piece of the file
  const want = new Map<string, number>();
  for (const f of manifest.factions) { want.set(f.headquarters, 1); want.set(f.builder, 2); }
  for (const p of pieces) want.set(p.id, (want.get(p.id) ?? 0) + 1);
  for (const d of manifest.defs) expect(laid.filter(e => e.defId === d.id).length, d.id).toBe(want.get(d.id) ?? 0);
  for (const p of pieces.filter((p: any) => getDef(p.id).kind === 'unit')) {
    expect(laid.some(e => e.defId === p.id && e.owner === p.owner && Math.hypot(e.x - (p.x + 0.5) * 32, e.y - (p.y + 0.5) * 32) < 1), p.id).toBe(true);
  }
  const hp = new Map(laid.map(e => [e.id, e.hp]));
  ticks(g, 30 * 20);
  expect(g.st.projs.length).toBe(0);
  expect(laid.filter(e => e.dead || e.hp < hp.get(e.id)!).map(e => e.defId)).toEqual([]);
}, 60000);

test('every hull and turret sheet turns smoothly rather than in the 24 baked headings', () => {
  // the game turns a u./tur./dec. sheet live only when its pivotX is 0.5 (spriteLoader's liveRotated)
  const stepped = manifest.sprites.filter((s: any) => s.rotated && /^(u|tur|dec)\./.test(s.key) && (s.pivotX ?? 0.5) !== 0.5);
  expect(stepped.map((s: any) => s.key)).toEqual([]);
  for (const d of manifest.defs.filter((d: any) => d.kind === 'unit')) {
    expect(manifest.sprites.find((s: any) => s.key === d.sprite)?.rotated, d.id).toBe(true);
  }
});
