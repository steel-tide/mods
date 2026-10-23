import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyContent } from '../../../steel-tide/game/core/src/game/content';
import { parseDefinitionPack } from '../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../steel-tide/game/core/src/game/state';
import { createRuntimeGame } from '../../../steel-tide/game/core/src/game/extensions/runtime';
import type { ModuleHost } from '../../../steel-tide/game/core/src/game/extensions/contracts';
import { arena } from '../../../steel-tide/game/core/server/testkit/game';
import { createArticulationModule } from './extensions/combined-arms-v1/src/articulation';

const active: (() => void)[] = [];
afterEach(() => { active.splice(0).forEach(dispose => dispose()); applyContent([]); });
async function setup() {
  const raw = JSON.parse(readFileSync(new URL('./mod.json', import.meta.url), 'utf8'));
  await prepareContentSchema(raw, true);
  const parsed = parseDefinitionPack(raw); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  expect(applyContent([parsed.pack]).rejected).toEqual([]);
  let host!: ModuleHost;
  const base = arena({ mode: 'campaign', fog: false, dayNight: false });
  const { game, runtime } = createRuntimeGame(base.st.cfg, base.st.map, true, [{ id: 'articulation-v1', create(value) {
    host = value; return createArticulationModule(value);
  } }]);
  active.push(() => runtime.dispose());
  return { game, runtime, host };
}

test('actual F-2 missiles leave fixed wing slots even when native air fire control aims across the hull', async () => {
  const { game, host } = await setup();
  const jet = newEnt(game.st, 'usgr-re-f-2', 0, 500, 500), def = getDef(jet.defId);
  const weapon = def.weapons.find(w => w.extensions?.['sensors-v1'] && w.muzzlePoints?.length === 4)!;
  jet.angle = .37;
  const original = JSON.stringify(weapon);
  // RW attachment positions (15,-1),(-15,-1),(30,-5),(-30,-5), at .625 world scale.
  const points = [[-.625, 9.375], [-.625, -9.375], [-3.125, 18.75], [-3.125, -18.75]];
  for (let i = 0; i < 8; i++) {
    host.fireShot(game.st, jet, def, weapon, null, { x: 500, y: 900 }, i);
    const [forward, lateral] = points[i % 4], projectile = game.st.projs.at(-1)!;
    const x = 500 + Math.cos(.37) * forward - Math.sin(.37) * lateral;
    const y = 500 + Math.sin(.37) * forward + Math.cos(.37) * lateral;
    expect(projectile.x).toBeCloseTo(x); expect(projectile.y).toBeCloseTo(y);
    const flash = game.st.effects.at(-1)!;
    expect(flash.x).toBeCloseTo(x); expect(flash.y).toBeCloseTo(y);
    expect(jet.boreI).toBe((i + 1) % 4);
  }
  expect(JSON.stringify(weapon)).toBe(original);
});

test('actual PGZ09 turret launches alternate at the two source barrels, including continuation after restore', async () => {
  const { game, runtime } = await setup();
  const tank = newEnt(game.st, 'usgr-re-pgz09', 0, 500, 500), target = newEnt(game.st, 'mbt', 1, 650, 500);
  tank.angle = tank.turretAngle = 0; tank.holdPos = true; target.holdFire = true;
  const module = runtime.module('articulation-v1')!, observed: { x: number; y: number }[] = [];
  for (let tick = 0; tick < 120 && observed.length < 4; tick++) {
    const prior = new Set(game.st.projs);
    game.step();
    for (const p of game.st.projs) if (!prior.has(p) && p.src === tank.id) {
      const flash = game.st.effects.findLast(f => f.key === 'fx.muzzle')!;
      observed.push({ x: flash.x, y: flash.y });
      if (observed.length === 1) module.restore(module.snapshot());
    }
  }
  expect(observed.length).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < 4; i++) {
    // Source ring y=-9, barrel relative y=20+10, native x=500-5.625+18.75.
    expect(observed[i].x).toBeCloseTo(513.125);
    expect(observed[i].y).toBeCloseTo(500 + (i % 2 ? -6.5625 : 6.5625));
  }
});

test('actual T90M main gun uses native recoil at the source barrel tip', async () => {
  const { game } = await setup();
  const tank = newEnt(game.st, 'usgr-re-t90m', 0, 500, 500), target = newEnt(game.st, 'mbt', 1, 650, 500);
  tank.angle = tank.turretAngle = 0; tank.holdPos = true; target.holdFire = true;
  for (let tick = 0; tick < 120 && !game.st.effects.some(f => f.recoil?.src === tank.id); tick++) game.step();
  const flash = game.st.effects.find(f => f.recoil?.src === tank.id)!;
  expect(flash).toBeDefined();
  // Original source spawn lies 21 source pixels beyond the visible tube.
  // Native 4x atlas: first opaque row 3, barrel center x39, pivot (38,114.596488).
  expect(flash.x).toBeCloseTo(546.092378); expect(flash.y).toBeCloseTo(500.390625);
  expect(flash.recoil!.stroke).toBe(6);
});

test('actual A10 gun keeps its hull anchor while the bore independently tracks a crossing target', async () => {
  const { game, host } = await setup();
  const jet = newEnt(game.st, 'usgr-re-a10', 0, 500, 500), def = getDef(jet.defId), weapon = def.weapons[0];
  jet.angle = .37;
  const before = JSON.stringify(weapon);
  host.fireShot(game.st, jet, def, weapon, null, { x: 500, y: 900 });
  const p = game.st.projs.at(-1)!;
  // Source turret x0,y45 remains in the hull frame; inherited barrel length1
  // points north. Neither native turn aim nor recoil may drag the pivot sideways.
  expect(p.x).toBeCloseTo(500 + Math.cos(.37) * 28.125);
  expect(p.y).toBeCloseTo(500 + Math.sin(.37) * 28.125 + .625);
  expect(game.st.effects.at(-1)!.x).toBeCloseTo(p.x);
  expect(JSON.stringify(weapon)).toBe(before);
});
