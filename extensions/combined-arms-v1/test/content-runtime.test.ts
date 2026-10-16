import extensionPackage from '../extension.json';
import { prepareContentSchema } from '../../../../steel-tide/game/core/src/game/contentSchema';
import { afterEach, describe, expect, test } from 'bun:test';
import { applyContent } from '../../../../steel-tide/game/core/src/game/content';
import { parseDefinitionPack, type DefinitionPack } from '../../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentCapabilities } from '../../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentFrameCodec } from '../../../../steel-tide/game/core/src/net/contentFrames';
import { contentRuntime, createContentGame } from '../../../../steel-tide/game/core/src/game/contentGame';
import { serializeGame, deserializeSnapshot, takeKeyframe, type Snapshot } from '../../../../steel-tide/game/core/src/game/save';
import { VANILLA_FRAME_CODEC, ViewCache } from '../../../../steel-tide/game/core/src/net/frames';
import { createContentRemoteFrames } from '../../../../steel-tide/game/core/src/net/contentRemoteFrames';
import { RemoteFrames } from '../../../../steel-tide/game/core/src/net/remoteFrames';
import { Game } from '../../../../steel-tide/game/core/src/game/sim';
import { newEnt } from '../../../../steel-tide/game/core/src/game/state';
import { arena } from '../../../../steel-tide/game/core/server/testkit/game';

const labels = ['Fixture', '测试', '시험'];
const faces = { front: 1, side: 1, rear: 1, top: 1 };
function fixture(): unknown {
  return { format: 'steel-tide-mod', v: 4, extensionPackages:[extensionPackage], id: 'cap-fixture', name: labels, version: '1',
    requiredCapabilities: ['components-v1', 'logistics-v1', 'sensors-v1', 'articulation-v1'],
    defs: [{ id: 'cap-fixture-tank', extends: 'ltank', name: labels, hp: 1000,
      weapons: [{ id: 'bolt', cls: 'cannon', dmg: 0, range: 8, reload: .3, speed: 400, spread: 0, projectile: 'missile', homing: true, targets: ['ground'],
        extensions: {
          'components-v1': { family: 'kinetic', penetration: 100, hullDamage: 10, strength: 5, channels: { engine: { strong: [1, 1], weak: [1, 1] } } },
          'logistics-v1': { stock: 'rounds', feed: 'main' },
          'sensors-v1': { mode: 'self', channel: 'track', maxLife: 10 },
        } }],
      extensions: {
        'components-v1': { protection: { families: { kinetic: faces }, incidence: false }, parts: [{ id: 'engine', label: labels, hp: 100, channel: 'engine', exposure: faces, damaged: { speed: .5 } }] },
        'logistics-v1': { stocks: [{ id: 'rounds', label: labels, capacity: 2, initial: 2 }], feeds: [{ id: 'main', label: labels, weapons: ['bolt'], selected: 'bolt' }] },
        'sensors-v1': { emitters: [{ id: 'radio', label: labels, channel: 'track', range: 20 }] },
        'articulation-v1': { mounts: [{ id: 'main', label: labels, weapons: ['bolt'], targeting: 'shared' }] },
      } }],
  };
}
async function setup() {
  await prepareContentSchema(fixture(),true);
  const parsed = parseDefinitionPack(fixture());
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]);
  const applied = applyContent([parsed.pack]);
  if (applied.rejected.length) throw new Error(JSON.stringify(applied.rejected));
  const base = arena({ mode: 'campaign', seed: 67, dayNight: false });
  const game = createContentGame(base.st.cfg, base.st.map, true);
  const shooter = newEnt(game.st, 'cap-fixture-tank', 0, 400, 400);
  const target = newEnt(game.st, 'cap-fixture-tank', 1, 560, 400, Math.PI);
  shooter.holdPos = target.holdPos = true; target.holdFire = true;
  shooter.targetId = target.id;
  game.hash.rebuild(game.st); game.updateFog();
  return { game, shooter, target, pack: parsed.pack };
}
afterEach(() => applyContent([]));

describe('capability content activation and match codecs', () => {
  test('rejects undeclared, unknown and pre-v3 capabilities', async () => {
    await prepareContentSchema(fixture(),true);
    const raw = fixture() as DefinitionPack;
    expect(parseDefinitionPack({ ...raw, v: 2 }).ok).toBe(false);
    expect(parseDefinitionPack({ ...raw, requiredCapabilities: [] }).ok).toBe(false);
    expect(parseDefinitionPack({ ...raw, requiredCapabilities: ['unsupported-v1'] }).ok).toBe(false);
  });
  test('runs real firing through four modules, then preserves save and keyframe state', async () => {
    const { game, target } = await setup();
    for (let tick = 0; tick < 90; tick++) game.step();
    expect(target.hp).toBeLessThan(1000);
    expect(target.hp).toBeGreaterThanOrEqual(980);
    const runtime = contentRuntime(game)!;
    expect(runtime.modules.map(m => m.id)).toEqual(['components-v1', 'logistics-v1', 'sensors-v1', 'articulation-v1']);
    const snap = JSON.parse(serializeGame(game)) as Snapshot;
    const restored = deserializeSnapshot(snap);
    expect(contentRuntime(restored)!.snapshot()).toEqual(runtime.snapshot());
    const keyframe = takeKeyframe(game);
    const continued = deserializeSnapshot({ ...keyframe.world, cfg: game.st.cfg, terrain: snap.terrain } as Snapshot);
    for (let tick = 0; tick < 30; tick++) { game.step(); continued.step(); }
    expect(contentRuntime(continued)!.snapshot()).toEqual(runtime.snapshot());
    expect(continued.st.ents.get(target.id)?.hp).toBe(game.st.ents.get(target.id)?.hp);
  });
  test('full and delta views redact private state and replace forgotten state', async () => {
    const { game, shooter, target } = await setup();
    game.step();
    const codec = contentFrameCodec(game);
    const cache = new ViewCache(codec.viewKey(game, 0, 'none'));
    const full = codec.encodeFullFrame(game, 0, 'none', 1, cache);
    expect(full.extensions).toBeDefined();
    const privateParts = full.extensions!['components-v1'] as Record<string, unknown>;
    expect(JSON.stringify(privateParts)).not.toContain(`"${target.id}":`);
    const remote = deserializeSnapshot(full);
    const frames = createContentRemoteFrames(full, remote);
    expect(frames.apply).not.toBe(RemoteFrames.prototype.apply);
    for (let tick = 0; tick < 40; tick++) game.step();
    const view = codec.buildTeamView(game, 0, 'none');
    const delta = codec.encodeFrame(view, cache, 2, game.st.tick, game.st.time);
    expect(JSON.parse(codec.stringifyFrame(delta, new (await import('../../../../steel-tide/game/core/src/net/frames')).RecMemo()))).toEqual(delta);
    frames.apply(remote, delta, 0);
    expect(contentRuntime(remote)!.snapshot({ player: 0, visibleEntities: new Set(remote.st.ents.keys()), visibleProjectiles: new Set(remote.st.projs.flatMap(p => p.id === undefined ? [] : [p.id])), privateEntity: id => id === shooter.id })).toEqual(view.extensions!);
    const enemyCache = new ViewCache(codec.viewKey(game, 1, 'none'));
    expect(enemyCache.key).not.toBe(cache.key);
  });
  test('vanilla factories and codecs are direct before and after an extended match', async () => {
    const before = arena({ mode: 'campaign' });
    expect(contentFrameCodec(before)).toBe(VANILLA_FRAME_CODEC);
    const { game } = await setup(); game.step();
    expect(contentFrameCodec(game)).not.toBe(VANILLA_FRAME_CODEC);
    applyContent([]);
    const after = createContentGame(before.st.cfg, before.st.map, true);
    expect(after.constructor).toBe(Game);
    expect(after.step).toBe(Game.prototype.step);
    expect(contentRuntime(after)).toBeUndefined();
    expect(contentFrameCodec(after)).toBe(VANILLA_FRAME_CODEC);
    expect(JSON.parse(serializeGame(after)).extensions).toBeUndefined();
    expect(Object.keys(after.st)).toEqual(Object.keys(before.st));
    const first = JSON.parse(serializeGame(after)) as Snapshot;
    const frames = createContentRemoteFrames(first, after);
    expect(frames.constructor).toBe(RemoteFrames);
    expect(frames.apply).toBe(RemoteFrames.prototype.apply);
    expect(Object.keys(frames)).toEqual(Object.keys(new RemoteFrames(first)));
  });
});
