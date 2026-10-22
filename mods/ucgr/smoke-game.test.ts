import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { newEnt } from '../../../steel-tide/game/core/src/game/state';
import { cmdAttack, cmdContentAction } from '../../../steel-tide/game/core/src/game/orders';
import { arenaMap, run, stepUntil } from '../../../steel-tide/game/core/server/testkit/game';
import { serializeGame, deserializeGame } from '../../../steel-tide/game/core/src/game/save';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';

const raw = readFileSync(new URL('mod.json', import.meta.url), 'utf8');
await prepareContentSchema(raw, true);
const parsed = parseMod(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
await prepareContentCapabilities([parsed.mod]);
let games: Game[] = [];
beforeEach(() => { expect(applyMods([parsed.mod]).rejected).toEqual([]); });
afterEach(() => { for (const g of games) disposeContentGame(g); games = []; applyMods([]); });
function arena() {
  const g = createContentGame({ mode: 'sandbox', mapKey: 'arena', seed: 61, fog: false, popCap: 100, startMetal: 1000,
    players: [{ isHuman: true, team: 0 }, { isHuman: true, team: 1 }] }, arenaMap(), true);
  games.push(g); return g;
}
const components = (g: Game) => contentRuntime(g)!.module('components-v1')!;
const smoke = (g: Game) => (components(g).snapshot() as any).smoke ?? { markers: [], units: [] };
const action = (g: Game, id: number, name: string) => cmdContentAction(g, 'components-v1', { owner: 0, ids: [id], action: name });
const enabled = (g: Game, e: any, name: string) => components(g).actions!(e).find(a => a.id === name)?.enabled;

test('Deploy Smoke drops four five-second markers at the launchers and shares its 30 s cooldown', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400); tank.holdFire = true; run(g, .5);
  expect(enabled(g, tank, 'smoke')).toBe(true); expect(enabled(g, tank, 'engine-smoke')).toBe(true);
  expect(action(g, tank.id, 'smoke')).toBe(true); run(g, 1 / 30);
  const markers = smoke(g).markers;
  expect(markers).toHaveLength(4);
  for (const m of markers) expect(Math.hypot(m.x - tank.x, m.y - tank.y)).toBeLessThan(40);
  expect(enabled(g, tank, 'smoke')).toBe(false); expect(enabled(g, tank, 'engine-smoke')).toBe(false);
  expect(action(g, tank.id, 'smoke')).toBe(false);
  const saved = deserializeGame(serializeGame(g)); games.push(saved);
  expect(smoke(saved)).toEqual(smoke(g));
  run(g, 4.8); expect(smoke(g).markers).toHaveLength(4);
  run(g, .3); expect(smoke(g).markers).toHaveLength(0);
  run(g, 25); expect(enabled(g, tank, 'smoke')).toBe(true); expect(enabled(g, tank, 'engine-smoke')).toBe(true);
});

test('a smoke marker removes the life of an enemy ATGM-tagged missile inside its radius', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400), tow = newEnt(g.st, 'usgr-re-hmmv-tow2', 1, 640, 400);
  tank.holdFire = true; run(g, .5);
  cmdAttack(g, [tow.id], tank.id);
  expect(stepUntil(g, () => g.st.projs.some(p => p.src === tow.id), 30 * 20)).toBeGreaterThan(0);
  const missile = g.st.projs.find(p => p.src === tow.id)!;
  expect(action(g, tank.id, 'smoke')).toBe(true); run(g, 1 / 30);
  const m = smoke(g).markers[0];
  missile.x = m.x + 10; missile.y = m.y; missile.px = missile.x; missile.py = missile.y;
  const ttl = missile.ttl; expect(ttl).toBeGreaterThan(0);
  missile.speed = 0;
  run(g, 1 / 30); expect(missile.ttl).toBeGreaterThan(0); // strike launched this tick
  run(g, 1 / 30); expect(missile.ttl).toBeLessThanOrEqual(0); // and reaches it on the next
  // The marker paid one energy and waits its 50-frame reload.
  expect(smoke(g).markers.find((x: any) => x.id === m.id).energy).toBeLessThan(2);
});

test('Engine Smoke drops one marker per whole second of age for ten seconds', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400); tank.holdFire = true; run(g, .5);
  expect(action(g, tank.id, 'engine-smoke')).toBe(true);
  const ids = new Set<number>();
  for (let i = 0; i < 30 * 11; i++) { run(g, 1 / 30); for (const m of smoke(g).markers) ids.add(m.id); }
  expect(ids.size).toBeGreaterThanOrEqual(9); expect(ids.size).toBeLessThanOrEqual(10);
  expect(enabled(g, tank, 'smoke')).toBe(false);
  run(g, 20); expect(enabled(g, tank, 'engine-smoke')).toBe(true);
});
