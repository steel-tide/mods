/** Exercise the ported factions against the sibling Steel Tide checkout.
 * Run from this registry: bun test tests/factions.test.ts
 */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE } from '../../steel-tide/game/core/src/core/types';
import { getDef } from '../../steel-tide/game/core/src/game/defs';
import { availableFactions } from '../../steel-tide/game/core/src/game/factions';
import { buildGameMap } from '../../steel-tide/game/core/src/game/mapdefs';
import { applyMods, parseMod } from '../../steel-tide/game/core/src/game/mods';
import { cmdPlaceBuilding, cmdProduce, cmdUpgrade, productionSlots, worldDefAllowed } from '../../steel-tide/game/core/src/game/orders';
import { deserializeGame, serializeGame } from '../../steel-tide/game/core/src/game/save';
import { Game } from '../../steel-tide/game/core/src/game/sim';
import { newEnt, type GameConfig } from '../../steel-tide/game/core/src/game/state';
import { arena, run, stepUntil } from '../../steel-tide/game/core/server/testkit/game';

const mods = ['fg-rusted-league', 'adolence'].map(id => {
  const parsed = parseMod(readFileSync(resolve(import.meta.dir, '..', 'mods', id, 'mod.json'), 'utf8'));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  expect(parsed.warnings).toEqual([]);
  return parsed.mod;
});
const factions = mods.flatMap(m => m.factions!);
beforeEach(() => {
  const result = applyMods(mods);
  expect(result.rejected).toEqual([]);
  expect(result.warnings).toEqual([]);
});
afterEach(() => applyMods([]));

function opening(faction: string, mode: GameConfig['mode'] = 'sandbox', seat = 0, ai = false) {
  const cfg: GameConfig = { mode, mapKey: 'greenfield', seed: 11, fog: true, popCap: 100, startMetal: 1200,
    players: [0, 1].map(i => ({ isHuman: i !== seat || !ai, team: i, ...(i === seat ? { faction } : {}) })) };
  return new Game(cfg, buildGameMap(cfg));
}

test('both ports register their factions together and unload cleanly', () => {
  expect(availableFactions().map(f => f.id)).toEqual(['vanilla', ...factions.map(f => f.id)]);
  applyMods([]);
  expect(availableFactions().map(f => f.id)).toEqual(['vanilla']);
});

for (const f of factions) {
  test(`${f.id}: own HQ, builders, production, construction and save/load`, () => {
    const g = opening(f.id);
    const own = [...g.st.ents.values()].filter(e => e.owner === 0);
    expect(own.map(e => e.defId)).toEqual([f.headquarters, f.builder, f.builder]);
    expect(productionSlots(g.st, 0).total).toBe(productionSlots(g.st, 1).total);
    expect(worldDefAllowed(g.st, 0, 'factory')).toBe(false);
    expect(cmdProduce(g, own[0].id, 'engineer')).toBe(false);
    expect(cmdProduce(g, own[0].id, f.builder)).toBe(true);
    expect(stepUntil(g, () => [...g.st.ents.values()].filter(e => e.owner === 0 && e.defId === f.builder).length === 3, 30 * 90)).toBeGreaterThan(0);
    const restored = deserializeGame(serializeGame(g));
    expect(restored.st.cfg.players[0].faction).toBe(f.id);
    expect([...restored.st.ents.values()].find(e => e.id === own[0].id)?.defId).toBe(f.headquarters);

    const a = arena({ metal: 10000, players: [{ isHuman: true, team: 0, faction: f.id }, { isHuman: true, team: 1 }] });
    newEnt(a.st, f.headquarters, 0, 12 * TILE, 12 * TILE);
    const builder = newEnt(a.st, f.builder, 0, 16 * TILE, 14 * TILE);
    expect(cmdPlaceBuilding(a, [builder.id], f.headquarters, 19, 12)).toBe(true);
    expect(stepUntil(a, () => [...a.st.ents.values()].filter(e => e.defId === f.headquarters && !e.site).length === 2, 30 * 240)).toBeGreaterThan(0);
  });

  test(`${f.id}: AI opens an economy and fields combat units on 1200 metal`, () => {
    const g = opening(f.id, 'sandbox', 0, true);
    run(g, 360);
    const own = [...g.st.ents.values()].filter(e => e.owner === 0);
    expect(own.every(e => f.roster!.includes(e.defId))).toBe(true);
    expect(own.some(e => !e.site && !getDef(e.defId).isHQ && getDef(e.defId).metalRate)).toBe(true);
    expect(own.some(e => getDef(e.defId).kind === 'unit' && !getDef(e.defId).buildRate && getDef(e.defId).weapons.length)).toBe(true);
    expect(own.some(e => !e.site && !getDef(e.defId).isHQ && getDef(e.defId).produces?.some(id => !getDef(id).buildRate))).toBe(true);
  }, 20000);

  test(`${f.id}: Breakthrough staging and checkpoints use its roster`, () => {
    for (const seat of [0, 1]) {
      const g = opening(f.id, 'breakthrough', seat);
      const own = [...g.st.ents.values()].filter(e => e.owner === seat);
      expect(own.length).toBeGreaterThan(0);
      expect(own.every(e => f.roster!.includes(e.defId))).toBe(true);
      if (seat === 1) expect(own.some(e => getDef(e.defId).isHQ)).toBe(true);
      else {
        const line = own.find(e => !getDef(e.defId).isHQ && getDef(e.defId).produces?.some(id => !getDef(id).buildRate));
        expect(line).toBeDefined();
        const recruit = getDef(line!.defId).produces!.find(id => !getDef(id).buildRate)!;
        expect(cmdProduce(g, line!.id, recruit)).toBe(true);
      }
    }
  });
}

test('Adolence sides cannot construct or recruit the other side; an upgraded precinct remains an HQ', () => {
  const g = opening('adolence-city');
  const hq = [...g.st.ents.values()].find(e => e.defId === 'adolence-precinct')!;
  expect(worldDefAllowed(g.st, 0, 'adolence-sloth-nest')).toBe(false);
  expect(worldDefAllowed(g.st, 0, 'adolence-brute')).toBe(false);
  expect(cmdUpgrade(g, [hq.id])).toBe(true);
  expect(stepUntil(g, () => hq.defId === 'adolence-precinct-2', 30 * 60)).toBeGreaterThan(0);
  expect(getDef(hq.defId).isHQ).toBe(true);
  expect(productionSlots(g.st, 0).total).toBeGreaterThan(0);
  expect(cmdProduce(g, hq.id, 'adolence-police-engineer')).toBe(true);
  const infected = opening('adolence-infected');
  expect(worldDefAllowed(infected.st, 0, 'adolence-outpost')).toBe(false);
  expect(worldDefAllowed(infected.st, 0, 'adolence-cruiser')).toBe(false);
});
