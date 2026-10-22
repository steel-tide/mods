import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide/game/core/src/game/state';
import { acquireTarget } from '../../../steel-tide/game/core/src/game/combat';
import { arenaMap, run } from '../../../steel-tide/game/core/server/testkit/game';
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
  const g = createContentGame({ mode: 'campaign', mapKey: 'arena', seed: 36, fog: false, popCap: 100, startMetal: 1000,
    players: [{ isHuman: true, team: 0 }, { isHuman: true, team: 1 }] }, arenaMap(), true);
  games.push(g); return g;
}

test('source AP excludes soldiers while its coax still engages them', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400), soldier = newEnt(g.st, 'usgr-re-plainf', 1, 500, 400);
  const def = getDef(tank.defId), [ap, coax] = def.weapons;
  const module = contentRuntime(g)!.module('usgr-re.targeting-v1')!;
  expect(module.canFire!(tank, def, ap, soldier, soldier)).toBe(false);
  expect(module.canFire!(tank, def, coax, soldier, soldier)).toBe(true);
  run(g, 1 / 30);
  const snapshot = contentRuntime(g)!.snapshot()['usgr-re.targeting-v1'];
  const saved = deserializeGame(serializeGame(g)); games.push(saved);
  expect(contentRuntime(saved)!.snapshot()['usgr-re.targeting-v1']).toEqual(snapshot);
});

test('source ordinary infantry concealment retains its hysteresis and resumes after save', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400), soldier = newEnt(g.st, 'usgr-re-plainf', 1, 800, 400);
  const def = getDef(tank.defId), coax = def.weapons[1], module = contentRuntime(g)!.module('usgr-re.targeting-v1')!;
  module.beforeStep!(1/30);
  expect(module.canFire!(tank, def, coax, soldier, soldier)).toBe(false);
  // Concealed between 350 and 400 RW pixels; an unhidden soldier in the
  // same band must stay unhidden. These are intentionally different tests.
  soldier.x = 550; g.st.time += .2; module.beforeStep!(.2);
  expect(module.canFire!(tank, def, coax, soldier, soldier)).toBe(false);
  soldier.x = 539; g.st.time += .2; module.beforeStep!(.2);
  expect(module.canFire!(tank, def, coax, soldier, soldier)).toBe(true);
  soldier.x = 550; g.st.time += 1.2; module.beforeStep!(1.2);
  expect(module.canFire!(tank, def, coax, soldier, soldier)).toBe(true);
  const saved = deserializeGame(serializeGame(g)); games.push(saved);
  expect(contentRuntime(saved)!.snapshot()['usgr-re.targeting-v1']).toEqual(contentRuntime(g)!.snapshot()['usgr-re.targeting-v1']);
  const view = {player:0,visibleEntities:new Set([tank.id,soldier.id]),visibleProjectiles:new Set<number>(),privateEntity:(id:number)=>id===tank.id};
  expect(module.snapshot(view)).toEqual({});
});

test('source high-altitude exclusions affect target acquisition as well as final firing', () => {
  const g = arena(), tank = newEnt(g.st, 'usgr-re-t90m', 0, 400, 400), jet = newEnt(g.st, 'usgr-re-su35s', 1, 500, 400);
  const def = getDef(tank.defId), gun = def.weapons[2], module = contentRuntime(g)!.module('usgr-re.targeting-v1')!;
  expect(module.canFire!(tank, def, gun, jet, jet)).toBe(false);
  const soldier = newEnt(g.st, 'usgr-re-plainf', 1, 520, 400);
  const enemyTank = newEnt(g.st, 'usgr-re-t90m', 1, 560, 400);
  g.hash.rebuild(g.st);
  const search = module.wrapTargetAcquisition!(acquireTarget);
  expect(search(g.st, g.hash, tank, def, 1, false, undefined, undefined, [soldier, enemyTank], def.weapons[0])).toBe(enemyTank.id);
  expect(search(g.st, g.hash, tank, def, 1, false, () => false, undefined, [enemyTank], def.weapons[0])).toBe(0);
});
