/** Run against the sibling game checkout: bun test tests/ironworks.test.ts */
import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Terrain } from '../../steel-tide/game/core/src/core/types';
import { DEFS, getDef } from '../../steel-tide/game/core/src/game/defs';
import { applyMods, parseMod } from '../../steel-tide/game/core/src/game/mods';
import { cmdProduce } from '../../steel-tide/game/core/src/game/orders';
import { deserializeGame, serializeGame } from '../../steel-tide/game/core/src/game/save';
import { newEnt } from '../../steel-tide/game/core/src/game/state';
import { arena, at, columns, stepUntil } from '../../steel-tide/game/core/server/testkit/game';

const parsed = parseMod(readFileSync(resolve(import.meta.dir, '../mods/ironworks/mod.json'), 'utf8'));
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const mod = parsed.mod;
afterEach(() => applyMods([]));

test.each(['navyard2', 'navyard3'])('%s launches the mod Orca and still refuses the vanilla copy', yardId => {
  expect(parsed.warnings).toEqual([]);
  const report = applyMods([mod]);
  expect(report.rejected).toEqual([]);
  expect(report.warnings).toEqual([]);

  const game = arena({ metal: 5000, paint: columns(16, 64, Terrain.DeepWater) });
  newEnt(game.st, 'hq', 0, ...at(4, 10));
  newEnt(game.st, 'power3', 0, ...at(8, 10));
  const yard = newEnt(game.st, yardId, 0, ...at(22, 10));
  game.recomputePower();
  expect(cmdProduce(game, yard.id, 'destroyer')).toBe(false);
  expect(cmdProduce(game, yard.id, 'ironworks-orca')).toBe(true);
  const ships = () => [...game.st.ents.values()].filter(e => e.defId === 'ironworks-orca');
  expect(stepUntil(game, () => ships().length === 1, 30 * 90)).toBeGreaterThan(0);
  const orca = ships()[0];
  expect(orca.owner).toBe(0);
  expect(orca.hp).toBe(getDef('ironworks-orca').hp);
  const restored = deserializeGame(serializeGame(game));
  expect(restored.st.ents.get(orca.id)?.defId).toBe('ironworks-orca');
});

test('disabling Ironworks removes its Orca while preserving vanilla Orcas in saves', () => {
  applyMods([]);
  const original = structuredClone(getDef('destroyer'));
  const game = arena({ mode: 'campaign', fill: Terrain.DeepWater });
  const legacy = newEnt(game.st, 'destroyer', 0, ...at(20, 20));
  const save = serializeGame(game);

  applyMods([mod]);
  expect(getDef('destroyer')).toEqual(original);
  for (const id of ['navyard2', 'navyard3']) {
    expect(getDef(id).produces).toContain('ironworks-orca');
    expect(getDef(id).produces).not.toContain('destroyer');
  }
  applyMods([]);
  expect(DEFS['ironworks-orca']).toBeUndefined();
  expect(getDef('destroyer')).toEqual(original);
  for (const def of Object.values(DEFS)) {
    expect(def.produces ?? []).not.toContain('destroyer');
    expect(def.produces ?? []).not.toContain('ironworks-orca');
  }
  const restored = deserializeGame(save);
  expect(restored.st.ents.get(legacy.id)?.defId).toBe('destroyer');
});
