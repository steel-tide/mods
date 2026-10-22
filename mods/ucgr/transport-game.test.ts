import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { cargoWeight } from '../../../steel-tide/game/core/src/game/transport';
import { newEnt, type Ent } from '../../../steel-tide/game/core/src/game/state';
import { cmdBoard, cmdUnload } from '../../../steel-tide/game/core/src/game/orders';
import { arenaMap, run, stepUntil } from '../../../steel-tide/game/core/server/testkit/game';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';

const raw = readFileSync(new URL('mod.json', import.meta.url), 'utf8');
await prepareContentSchema(raw, true);
const parsed = parseMod(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
// A plain native hold of the largest native size: no source policy of its own.
const probe = parseMod(JSON.stringify({ format: 'steel-tide-mod', v: 1, id: 'transport-probe', name: 'Probe', version: '1',
  defs: [{ id: 'transport-probe-truck', extends: 'engineer', name: 'Probe truck', transportCap: 50, transportMaxWeight: 50 }] }));
if (!probe.ok) throw new Error(JSON.stringify(probe.errors));
await prepareContentCapabilities([parsed.mod, probe.mod]);
let games: Game[] = [];
beforeEach(() => { expect(applyMods([parsed.mod, probe.mod]).rejected).toEqual([]); });
afterEach(() => { for (const g of games) disposeContentGame(g); games = []; applyMods([]); });
function arena() {
  const g = createContentGame({ mode: 'sandbox', mapKey: 'arena', seed: 37, fog: false, popCap: 200, startMetal: 1000,
    players: [{ isHuman: true, team: 0 }, { isHuman: true, team: 1 }] }, arenaMap(), true);
  games.push(g); return g;
}
const source = (id: string) => (getDef(id).extensions?.['articulation-v1'] as any)?.sourceTransport;
function boardAll(g: Game, units: Ent[], carrier: Ent) {
  for (const e of units) cmdBoard(g, [e.id], carrier.id);
  stepUntil(g, () => units.every(e => e.inside === carrier.id || !e.orders.length), 30 * 20);
}

test('source cargo weights survive the native 50-slot bridge', () => {
  expect(cargoWeight(getDef('usgr-re-t90m'))).toBe(48);
  expect(cargoWeight(getDef('usgr-re-m2a3'))).toBe(34);
  for (const id of ['usgr-re-rusfpvsquad', 'usgr-re-plafpvsquad', 'usgr-re-usfpvsquad', 'usgr-re-eufpvsquad']) {
    expect(source(id)).toMatchObject({ weight: 100000, capacity: 0 });
    expect(cargoWeight(getDef(id))).toBe(50);
  }
  expect(source('usgr-re-hmmv')).toEqual({ weight: 30, capacity: 5, tags: ['soldiers'], blockTransports: true, unload: 0.05 });
});

test('HMMV takes five soldiers, refuses a sixth and armour, and unloads at the source 0.05 s cadence', () => {
  const g = arena(), hmmv = newEnt(g.st, 'usgr-re-hmmv', 0, 400, 400);
  const soldiers = Array.from({ length: 6 }, (_, i) => newEnt(g.st, 'usgr-re-plainf', 0, 380 + i * 6, 440));
  const tank = newEnt(g.st, 'usgr-re-t90m', 0, 460, 400);
  run(g, 1 / 30);
  boardAll(g, soldiers.slice(0, 5), hmmv);
  expect(soldiers.slice(0, 5).every(e => e.inside === hmmv.id)).toBe(true);
  cmdBoard(g, [soldiers[5].id], hmmv.id); run(g, 3);
  expect(soldiers[5].inside).toBeFalsy();
  cmdBoard(g, [tank.id], hmmv.id); run(g, 3);
  expect(tank.inside).toBeFalsy();
  expect(hmmv.cargo).toHaveLength(5);
  cmdUnload(g, [hmmv.id], hmmv.x, hmmv.y);
  // Native holds put one passenger down every 0.6 s (3 s for five); the source 3 frames each.
  const ticks = stepUntil(g, () => !hmmv.cargo?.length, 30 * 3);
  expect(ticks).toBeGreaterThan(0);
  expect(ticks).toBeLessThanOrEqual(15);
  expect(soldiers.slice(0, 5).every(e => !e.inside && !e.dead)).toBe(true);
});

test('M2A3 refuses the T-90M by source weight and other transports by default policy', () => {
  const g = arena(), m2 = newEnt(g.st, 'usgr-re-m2a3', 0, 400, 400), tank = newEnt(g.st, 'usgr-re-t90m', 0, 460, 400);
  run(g, 1 / 30);
  cmdBoard(g, [tank.id], m2.id); run(g, 3);
  expect(tank.inside).toBeFalsy();
  expect(m2.cargo ?? []).toHaveLength(0);
});

test('FPV teams keep the untransportable source sentinel, also against a native 50-slot hold', () => {
  const g = arena(), truck = newEnt(g.st, 'transport-probe-truck', 0, 400, 400), hmmv = newEnt(g.st, 'usgr-re-hmmv', 0, 400, 480);
  const fpv = newEnt(g.st, 'usgr-re-usfpvsquad', 0, 440, 440), soldier = newEnt(g.st, 'usgr-re-plainf', 0, 360, 440);
  run(g, 1 / 30);
  cmdBoard(g, [fpv.id], truck.id); run(g, 3);
  expect(fpv.inside).toBeFalsy();
  cmdBoard(g, [fpv.id], hmmv.id); run(g, 3);
  expect(fpv.inside).toBeFalsy();
  // The native hold still loads an ordinary passenger.
  boardAll(g, [soldier], truck);
  expect(soldier.inside).toBe(truck.id);
});
