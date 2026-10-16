import extensionPackage from '../extension.json';
import { afterEach, expect, test } from 'bun:test';
import { applyContent } from '../../../../steel-tide/game/core/src/game/content';
import { prepareContentSchema } from '../../../../steel-tide/game/core/src/game/contentSchema';
import { parseDefinitionPack } from '../../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentCapabilities } from '../../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentFrameCodec } from '../../../../steel-tide/game/core/src/net/contentFrames';
import { contentRuntime, createContentGame } from '../../../../steel-tide/game/core/src/game/contentGame';
import { canSee } from '../../../../steel-tide/game/core/src/game/combat';
import { deserializeSnapshot } from '../../../../steel-tide/game/core/src/game/save';
import { newEnt } from '../../../../steel-tide/game/core/src/game/state';
import { ViewCache, primeMirror } from '../../../../steel-tide/game/core/src/net/frames';
import { arena } from '../../../../steel-tide/game/core/server/testkit/game';

const label = ['Signal fixture', '信号测试', '신호 시험'];
afterEach(() => applyContent([]));

for (const reveal of ['contact', 'entity'] as const) test(`typed ${reveal} knowledge drives acquisition and full/delta disclosure separately`, async () => {
  const weapon = { id: 'guided', cls: 'cannon', projectile: 'missile', homing: true, turret: true,
    dmg: 10, range: 20, reload: 10, speed: 30, spread: 0, targets: ['ground'],
    extensions: { 'sensors-v1': { mode: 'emitter', channel: 'search', range: 20, maxLife: 30 } } };
  const raw = { format: 'steel-tide-mod', v: 4, extensionPackages:[extensionPackage], id: 'signal-fixture', name: label, version: '1',
    requiredCapabilities: ['sensors-v1'], defs: [
      { id: 'signal-launcher', extends: 'ltank', name: label, vision: 1, speed: 0, weapons: [weapon],
        extensions: { 'sensors-v1': { sensors: [{ id: 'receiver', label, channel: 'search', mode: 'passive', reveal, range: 20 }] } } },
      { id: 'signal-emitter', extends: 'ltank', name: label, vision: 1, speed: 0, weapons: [],
        extensions: { 'sensors-v1': { emitters: [{ id: 'radar', label, channel: 'search', range: 20 }] } } },
    ] };
  await prepareContentSchema(raw,true);
  const parsed = parseDefinitionPack(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]);
  expect(applyContent([parsed.pack]).rejected).toEqual([]);
  const base = arena({ mode: 'campaign', fog: true, dayNight: false });
  const game = createContentGame(base.st.cfg, base.st.map, true);
  const shooter = newEnt(game.st, 'signal-launcher', 0, 400, 400);
  const target = newEnt(game.st, 'signal-emitter', 1, 800, 400);
  shooter.holdPos = target.holdPos = true;
  game.hash.rebuild(game.st); game.updateFog();
  for (let tick = 0; tick < 15; tick++) game.step();
  expect(canSee(game.st, game.hash, 0, target)).toBe(false);
  expect(shooter.targetId).toBe(target.id);
  expect(game.st.projs.some(p => p.src === shooter.id && p.targetId === target.id)).toBe(true);
  const runtime = contentRuntime(game)!, codec = contentFrameCodec(game);
  expect(runtime.visible(target, 0)).toBe(reveal === 'entity');
  const cache = new ViewCache(codec.viewKey(game, 0, 'none'));
  const full = codec.encodeFullFrame(game, 0, 'none', 1, cache);
  expect(full.ents.some(e => e.id === target.id)).toBe(reveal === 'entity');
  expect(full.ents.find(e => e.id === shooter.id)?.targetId).toBe(reveal === 'entity' ? target.id : undefined);
  expect(full.projs.some(p => p.targetId !== undefined || p.src !== undefined || p.gun !== undefined)).toBe(false);
  const sensors = full.extensions!['sensors-v1'] as { states: [number, { contacts: Record<string, { target: number }[]> }][]; flights: unknown[]; locks: unknown[] };
  expect(sensors.states[0][1].contacts.receiver[0].target).toBe(reveal === 'entity' ? target.id : 0);
  expect(sensors.flights).toEqual([]); expect(sensors.locks).toEqual([]);
  const remote = deserializeSnapshot(full), mirror = new Map(); primeMirror(mirror, full);
  const view = codec.buildTeamView(game, 0, 'none');
  expect(view.recs.has(target.id)).toBe(reveal === 'entity');
  const delta = codec.encodeFrame(view, cache, 2, game.st.tick, game.st.time);
  expect(delta.ents).toBeUndefined();
  expect(JSON.parse(codec.stringifyFrame(delta)).extensions).toBeUndefined();
  expect(runtime.order('sensors-v1', { owner: 1, ids: [target.id], action: 'emitter:radar', on: false })).toBe(true);
  for (let tick = 0; tick < 6; tick++) game.step();
  const forgotten = codec.encodeFrame(codec.buildTeamView(game, 0, 'none'), cache, 3, game.st.tick, game.st.time);
  expect(forgotten.gone?.includes(target.id) ?? false).toBe(reveal === 'entity');
  contentFrameCodec(remote).applyFrame(remote, mirror, forgotten);
  expect(remote.st.ents.has(target.id)).toBe(false);
  expect(shooter.targetId).toBe(0);
});
