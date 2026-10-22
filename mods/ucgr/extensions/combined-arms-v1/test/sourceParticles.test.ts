import { afterEach, expect, test } from 'bun:test';
import { DEFS, getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { newEnt } from '../../../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';
import { createRuntimeGame } from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import { createFeedbackModule, emitSourceActionEffect, type FeedbackModule } from '../src/feedback';
import { FEEDBACK_ID, readFeedbackDef } from '../src/feedbackSpec';
import { stepSourceParticle, type SourceParticle } from '../src/sourceParticles';
import type { EffectPicture } from '../src/effectPictures';
const id = 'original-smoke';
const smoke: EffectPicture = { asset: 'source-smoke', life: 10, duration: 10, frames: 1, first: 0, last: 0, fps: 0, loop: false,
  fade: true, fadeIn: .5, scaleFrom: .3125, scaleTo: .46875, alpha: .5, x: 0, y: 0, forward: 0, lateral: 0,
  vx: 0, vy: 0, speedForward: 0, speedLateral: 0, dir: 0, zero: false, under: false, atmospheric: true, showInFog: true,
  height: 0, heightVelocity: 0, random: { speedForward: 4.8, speedLateral: 4.8, dir: Math.PI } };
afterEach(() => { delete DEFS[id]; });
test('RW atmospheric updates preserve height-only drag, world-X wind and bounce constants', () => {
  const p: SourceParticle = { key: 'source', x: 0, y: 0, height: 5, vx: 24, vy: -24, vh: 24, age: 0, rotation: 0, spin: 0 };
  expect(stepSourceParticle(p, smoke, 1/60)).toBe(true);
  expect(p.vx).toBeCloseTo(23.964); expect(p.vy).toBe(-24); expect(p.vh).toBeCloseTo(23.952);
  expect(p.x).toBeCloseTo(.3994); expect(p.y).toBeCloseTo(-.4); expect(p.height).toBeCloseTo(5.3992);
  const falling = { ...p, height: -.1, vx: 24, vy: -24, vh: -96, spin: Math.PI };
  stepSourceParticle(falling, { ...smoke, atmospheric: false, physics: true }, 1/60);
  expect(falling.vh).toBeCloseTo(16.8); expect(falling.vx).toBeCloseTo(20.4); expect(falling.vy).toBeCloseTo(-20.4);
  expect(falling.height).toBeCloseTo(.28); expect(falling.spin).toBeCloseTo(Math.PI - Math.PI/3);
});
test('authored smoke survives its emitter, carries only public fog-visible particles, and resumes exactly', () => {
  const errors: any[] = [];
  const feedback = readFeedbackDef({ voices: {}, actions: { smoke: [{ chance: 1, picture: smoke }], private: [{ chance: 1, picture: { ...smoke, showInFog: false } }] } }, 'feedback', errors, { assetIds: new Set(['source-smoke']) } as any)!;
  expect(errors).toEqual([]);
  DEFS[id] = { ...getDef('ltank'), id, extensions: { [FEEDBACK_ID]: feedback } };
  const base = arena({ mode: 'campaign', fog: true, dayNight: false });
  const { game, runtime } = createRuntimeGame(base.st.cfg, base.st.map, true, [{ id: FEEDBACK_ID, create: createFeedbackModule }]);
  const e = newEnt(game.st, id, 1, 500, 500), module = runtime.module(FEEDBACK_ID) as FeedbackModule;
  const rng = JSON.stringify(game.st.rng);
  expect(emitSourceActionEffect(game, e, 'smoke')).toBe(true);
  expect(emitSourceActionEffect(game, e, 'private')).toBe(true);
  expect(JSON.stringify(game.st.rng)).toBe(rng);
  e.dead = true; game.st.ents.delete(e.id);
  for (let i = 0; i < 150; i++) module.beforeStep(1/30);
  expect(module.particleVisuals()).toHaveLength(2);
  const view = { player: 0, visibleEntities: new Set<number>(), visibleProjectiles: new Set<number>(), privateEntity: () => false };
  const publicState = module.snapshot(view) as any;
  expect(publicState.$particles).toHaveLength(1); expect(publicState.$particles[0].key).toContain('action-smoke');
  expect(Object.keys(publicState)).toEqual(['$particles']);
  const full = module.snapshot(); module.beforeStep(1/30); const expected = module.snapshot();
  module.restore(full); module.beforeStep(1/30); expect(module.snapshot()).toEqual(expected);
  module.restore(publicState); for (let i = 0; i < 151; i++) module.beforeStep(1/30);
  expect(module.particleVisuals()).toHaveLength(0);
  expect(() => module.restore({ $particles: [{ ...publicState.$particles[0], key: 'forged' }] })).toThrow('Invalid source particles');
  runtime.dispose();
});
test('source recording alternatives cycle across emitters and preserve their cursor in saves', () => {
  DEFS[id] = { ...getDef('ltank'), id, extensions: { [FEEDBACK_ID]: { voices: {}, cosmetics: [], audio: { shots: [{ weapon: 'gun', cue: { assets: ['a', 'b'], gain: .3 } }], periodic: [], reloads: [] } } } } as any;
  const base = arena({ mode: 'campaign', fog: false, dayNight: false });
  const { game, runtime } = createRuntimeGame(base.st.cfg, base.st.map, true, [{ id: FEEDBACK_ID, create: createFeedbackModule }]);
  const e = newEnt(game.st, id, 0, 500, 500), other = newEnt(game.st, id, 0, 600, 500), module = runtime.module(FEEDBACK_ID) as FeedbackModule;
  const shoot = (who: typeof e, projectile: number) => module.onShot(who, getDef(id), { id: 'gun' } as any, { id: projectile, x: who.x, y: who.y } as any);
  shoot(e, 42); const saved = module.snapshot(); shoot(other, 99); shoot(e, 51);
  expect(game.st.effects.map(e => e.key.split(':')[1])).toEqual(['a', 'b', 'a']);
  module.restore(saved); shoot(e, 60); expect(game.st.effects.at(-1)!.key.split(':')[1]).toBe('b');
  runtime.dispose();
});
