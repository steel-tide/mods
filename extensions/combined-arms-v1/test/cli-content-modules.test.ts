import extensionPackage from '../extension.json';
import { afterEach, expect, test } from 'bun:test';
import { Terrain, TILE } from '../../../../steel-tide/game/core/src/core/types';
import { applyGameCommand, lastCommandRefusal, type GameCommand } from '../../../../steel-tide/game/core/src/game/commands';
import { prepareContentCapabilities } from '../../../../steel-tide/game/core/src/game/contentCapabilities';
import { parseDefinitionPack } from '../../../../steel-tide/game/core/src/game/contentDefs';
import { contentFrameCodec } from '../../../../steel-tide/game/core/src/net/contentFrames';
import { contentRuntime, createContentGame } from '../../../../steel-tide/game/core/src/game/contentGame';
import { prepareContentSchema } from '../../../../steel-tide/game/core/src/game/contentSchema';
import { applyMods } from '../../../../steel-tide/game/core/src/game/mods';
import { newEnt } from '../../../../steel-tide/game/core/src/game/state';
import { ViewCache, type Frame } from '../../../../steel-tide/game/core/src/net/frames';
import { handle, type Context } from '../../../../steel-tide/game/cli/src/api';
import { Autopilot } from '../../../../steel-tide/game/cli/src/auto/autopilot';
import { BrainLink } from '../../../../steel-tide/game/cli/src/brain';
import type { Connection } from '../../../../steel-tide/game/cli/src/connection';
import { Journal } from '../../../../steel-tide/game/cli/src/journal';
import { ScriptHost } from '../../../../steel-tide/game/cli/src/script';
import { renderEntity } from '../../../../steel-tide/game/cli/src/view/text';
import { World } from '../../../../steel-tide/game/cli/src/world';

const label = ['Secret ammunition', '私有弹药', '비공개 탄약'];
const games: ReturnType<typeof createContentGame>[] = [];
afterEach(() => { for (const game of games) contentRuntime(game)?.dispose(); games.length = 0; applyMods([]); });

async function fixture() {
  const raw = { format: 'steel-tide-mod', v: 4, extensionPackages:[extensionPackage], id: 'cli-module-test', name: label, version: '1.0.0', requiredCapabilities: ['logistics-v1'], defs: [
    { id: 'cli-module-test-hull', extends: 'mbt', name: label,
      extensions: { 'logistics-v1': { stocks: [{ id: 'round', label, capacity: 5, initial: 3 }], feeds: [{ id: 'breech', label, weapons: ['main', 'alternate'], selected: 'main' }] } },
      weapons: ['main', 'alternate'].map(id => ({ id, cls: 'cannon', dmg: 10, reload: 2, range: 4, extensions: { 'logistics-v1': { stock: 'round', feed: 'breech' } } })),
    },
    { id: 'cli-module-test-provider', extends: 'repairtower', name: ['Workshop', '维修站', '정비소'], extensions: { 'logistics-v1': {
      services: [{ id: 'refill', label: ['Replenish', '补给', '보급'], mode: 'refill', range: 160, stocks: ['round'], seconds: 1 }],
    } } },
  ] };
  await prepareContentSchema(raw,true);
  const parsed = parseDefinitionPack(raw); if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]);
  const applied = applyMods([parsed.pack]); if (applied.rejected.length) throw new Error(JSON.stringify(applied.rejected));
  const game = createContentGame({ mode: 'campaign', multiplayer: true, mapKey: 'cli-modules', seed: 7, fog: false, popCap: 100, startMetal: 1000, players: [{ isHuman: true, team: 0 }, { isHuman: true, team: 1 }] },
    { nameKey: 'cli-modules', w: 32, h: 32, terrain: new Uint8Array(32 * 32).fill(Terrain.Grass), deposits: [], spawns: [] }, true);
  games.push(game);
  const own = newEnt(game.st, 'cli-module-test-hull', 0, 160, 160), enemy = newEnt(game.st, 'cli-module-test-hull', 1, 240, 160), provider = newEnt(game.st, 'cli-module-test-provider', 0, 192, 192);
  game.hash.rebuild(game.st);
  const journal = new Journal(), world = new World(journal); world.setPlayer(0);
  const codec = contentFrameCodec(game), cache = new ViewCache(codec.viewKey(game, 0, 'none')); let seq = 0;
  const frame = (full = false): Frame => full || !seq ? codec.encodeFullFrame(game, 0, 'none', ++seq, cache)
    : codec.encodeFrame(codec.buildTeamView(game, 0, 'none'), cache, ++seq, game.st.tick, game.st.time);
  const sync = (full = false): Frame => { const f = frame(full); world.loadFrame(JSON.stringify(f)); return f; };
  sync(); games.push(world.game!);
  const sent: GameCommand[] = [], hands: number[][] = [], auto = new Autopilot(7, journal);
  const handOrder = auto.handOrder.bind(auto); auto.handOrder = ids => { hands.push([...ids]); handOrder(ids); };
  const conn = { phase: 'playing', error: null, command: async (command: GameCommand) => {
    sent.push(command); const accepted = applyGameCommand(game, 0, command); return { accepted, reason: accepted ? undefined : lastCommandRefusal() ?? undefined };
  } } as unknown as Connection;
  const context: Context = { session: 'module-test', world, journal, conn, auto, brain: new BrainLink(), scripts: new ScriptHost(journal), log: () => {}, quit: () => {} };
  return { game, world, own, enemy, provider, sent, hands, context, sync, frame };
}

test('content-action dispatches the shared command and counts as a hand order only after acceptance', async () => {
  const f = await fixture();
  const result = await handle(f.context, 'content-action', { select: { ids: [f.own.id] }, module: 'logistics-v1', action: 'ammunition', choice: 'breech/alternate' });
  expect(result.data).toEqual({ accepted: true, command: { kind: 'contentAction', ids: [f.own.id], module: 'logistics-v1', action: 'ammunition', choice: 'breech/alternate' } });
  expect(f.sent).toHaveLength(1); expect(f.hands).toEqual([[f.own.id]]);
  const state = contentRuntime(f.game)!.snapshot()['logistics-v1'] as any;
  expect(state[f.own.id].feeds.breech.selected).toBe('alternate');
  await expect(handle(f.context, 'content-action', { select: { ids: [f.own.id] }, module: 'logistics-v1', action: 'ammunition', choice: 'breech/missing' })).rejects.toThrow('refused, nothing was done');
  expect(f.hands).toEqual([[f.own.id]]);
});

test('content-action enforces ownership and rejects spectators and unknown modules', async () => {
  const f = await fixture();
  const params = { module: 'logistics-v1', action: 'ammunition', choice: 'breech/alternate' };
  await expect(handle(f.context, 'content-action', { ...params, select: { ids: [f.enemy.id] } })).rejects.toThrow('not yours');
  expect(f.sent).toHaveLength(0);
  // A forged broad selector still crosses the authoritative command gateway.
  await expect(handle(f.context, 'content-action', { ...params, select: { ids: [f.enemy.id], side: 'all' } })).rejects.toThrow('refused, nothing was done');
  expect(f.sent).toHaveLength(1); expect(f.hands).toEqual([]);
  await expect(handle(f.context, 'content-action', { ...params, module: 'invented-v1', select: { ids: [f.own.id] } })).rejects.toThrow();
  expect(f.sent).toHaveLength(1);
  f.world.setPlayer(null);
  await expect(handle(f.context, 'content-action', { ...params, select: { ids: [f.own.id] } })).rejects.toThrow('spectating');
  expect(f.sent).toHaveLength(1);
});

test('content-action resolves provider IDs and converts tile points at the shared API boundary', async () => {
  const f = await fixture();
  await handle(f.context, 'content-action', { select: { ids: [f.own.id] }, module: 'logistics-v1', action: 'supply', choice: 'refill', target: `@${f.provider.id}`, at: '4,5' });
  expect(f.sent[0]).toEqual({ kind: 'contentAction', ids: [f.own.id], module: 'logistics-v1', action: 'supply', choice: 'refill', targetId: f.provider.id, x: 4.5 * TILE, y: 5.5 * TILE });
  expect((contentRuntime(f.game)!.snapshot()['logistics-v1'] as any)[f.own.id].service.provider).toBe(f.provider.id);
});

test('World preserves full and delta extension state and renders only the seat private data', async () => {
  const f = await fixture(), mirror = contentRuntime(f.world.game!)!;
  const ownMirror = f.world.st!.ents.get(f.own.id)!, enemyMirror = f.world.st!.ents.get(f.enemy.id)!;
  expect(mirror.inspect(ownMirror, 0).rows.find(r => r.id === 'stock/round')?.value).toBe(3);
  const enemy = renderEntity(f.world, enemyMirror), own = renderEntity(f.world, ownMirror);
  expect((enemy.data as any).modules.rows).toEqual([]); expect((enemy.data as any).modules.actions).toEqual([]);
  expect(enemy.text).not.toContain('Secret ammunition'); expect(JSON.stringify(enemy.data)).not.toContain('stock/round');
  expect(own.text).toContain('Secret ammunition'); expect((own.data as any).modules.actions.some((a: any) => a.id === 'ammunition')).toBe(true);
  applyGameCommand(f.game, 0, { kind: 'contentAction', ids: [f.own.id], module: 'logistics-v1', action: 'ammunition', choice: 'breech/alternate' });
  const delta = f.sync(); expect(delta.full).not.toBe(true); expect(delta.extensions).toBeDefined();
  expect((mirror.snapshot()['logistics-v1'] as any)[f.own.id].feeds.breech.selected).toBe('alternate');
  const unchanged = f.sync(); expect(unchanged.extensions).toBeUndefined();
  expect((mirror.snapshot()['logistics-v1'] as any)[f.own.id].feeds.breech.selected).toBe('alternate');
  f.game.st.ents.delete(f.own.id); f.game.hash.rebuild(f.game.st); f.sync();
  expect(f.world.st!.ents.has(f.own.id)).toBe(false); expect((mirror.snapshot()['logistics-v1'] as any)[f.own.id]).toBeUndefined();
});
