import { capabilities, selection } from './capabilityWorld';
import { afterEach, describe, expect, test } from 'bun:test';
import { applyContent } from '../../../../../../steel-tide/game/core/src/game/content';
import { worldContentHash } from '../../../../../../steel-tide/game/core/src/game/worldValidation';
import { room, type Room } from '../../../../../../steel-tide/game/core/server/testkit/room';

async function until(ready: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) { if (ready()) return; await new Promise(resolve => setTimeout(resolve, 1)); }
  throw new Error('Content preparation did not complete');
}
const rooms: Room[] = [];
function fresh(): Room { const r = room(); rooms.push(r); return r; }
async function begin() {
  const r = fresh(), h = r.joinHost('Host', { worldVersion: 1, engineCapabilities: capabilities }), g = r.joinGuest('Partner', { worldVersion: 1, engineCapabilities: capabilities });
  const world = selection(); r.patch(h.id, { world });
  await until(() => !!h.socket.last('worldContent') || !!h.socket.last('error'));
  expect(h.socket.last('error')).toBeUndefined();
  const contentHash = worldContentHash(world);
  r.say(h.id, { type: 'worldReady', contentHash }); r.say(g.id, { type: 'worldReady', contentHash });
  r.say(g.id, { type: 'ready', ready: true }); r.say(h.id, { type: 'start' });
  expect(h.socket.last('started')).toBeUndefined();
  await until(() => !!h.socket.last('started') || !!h.socket.last('error'));
  expect(h.socket.last('error')).toBeUndefined();
  return { r, h, g, world };
}
afterEach(() => { for (const r of rooms.splice(0)) r.core.stop(); applyContent([]); });

describe('hosted capability matches', () => {
  test('negotiates requirements and prepares modules before starting', async () => {
    const { r, h } = await begin();
    // The lobby advertises what the held world requires, not what a client offers.
    expect(h.socket.last('lobby')?.lobby.engineCapabilities).toEqual(['extension-host-v2', 'content-capacity-large-v1']);
    expect(h.socket.lastFrame().extensions).toBeDefined();
    const old = r.joinGuest('Older', { worldVersion: 1 });
    expect(old.socket.last('error')?.code).toBe('version');
    expect(old.socket.closed?.code).toBe(1008);
    expect(old.socket.frames()).toHaveLength(0);
  });
  test('refuses replacing content underneath a connected client without the modules', async () => {
    const r = fresh(), h = r.joinHost('Host', { worldVersion: 1, engineCapabilities: capabilities });
    r.joinGuest('Older', { worldVersion: 1 });
    r.patch(h.id, { world: selection() });
    await until(() => !!h.socket.last('error'));
    expect(h.socket.last('error')?.code).toBe('config');
    expect(r.core.status().world).toBeUndefined();
  });
  test('commands enforce ownership and capability actions cross actual full and delta JSON', async () => {
    const { r, h, g } = await begin();
    const first = h.socket.lastFrame(), own = first.ents.find((e: { owner: number }) => e.owner === 0).id, ally = first.ents.find((e: { owner: number }) => e.owner === 1).id;
    expect(Object.keys(first.extensions['logistics-v1'])).toEqual([String(own)]);
    expect(Object.keys(g.socket.lastFrame().extensions['logistics-v1'])).toEqual([String(ally)]);
    r.say(g.id, { type: 'command', seq: 1, command: { kind: 'contentAction', ids: [own], module: 'sensors-v1', action: 'emitter:radio', on: false } });
    expect(g.socket.last('commandResult')?.accepted).toBe(false);
    r.say(h.id, { type: 'command', seq: 1, command: { kind: 'contentAction', ids: [own], module: 'sensors-v1', action: 'emitter:radio', on: false } });
    expect(h.socket.last('commandResult')?.accepted).toBe(true);
    r.broadcast(5);
    const changed = h.socket.frames().filter(f => !f.full && f.extensions).at(-1)!;
    expect(changed).toBeDefined();
    expect(changed.extensions['sensors-v1'].states.find(([id]: [number]) => id === own)[1].emitters.radio.active).toBe(false);
    const guestStates = g.socket.frames().flatMap(f => f.extensions?.['sensors-v1']?.states ?? []);
    expect(guestStates.every(([id]: [number]) => id === ally)).toBe(true);
    r.say(h.id, { type: 'command', seq: 2, command: { kind: 'contentAction', ids: [own], module: 'components-v1', action: 'repair', choice: 'missing' } });
    expect(h.socket.last('commandResult')?.accepted).toBe(false);
    r.say(h.id, { type: 'downloadSave' });
    const saved = JSON.parse(h.socket.last('saveData')!.json);
    expect(Object.keys(saved.extensions['logistics-v1'])).toHaveLength(3);
    expect(saved.extensions['sensors-v1'].states.find(([id]: [number]) => id === own)[1].emitters.radio.active).toBe(false);
  });
  test('server checkpoint retains exact module state and resumes through the normal handshake', async () => {
    const { r, h, world } = await begin();
    r.broadcast(5); r.say(h.id, { type: 'downloadSave' });
    const json = h.socket.last('saveData')!.json;
    r.core.stop();
    const restored = room({ checkpoint: { read: () => json, write: () => undefined } }); rooms.push(restored);
    await until(() => !!restored.core.status().loadedSave);
    const a = restored.joinHost('Recovered', { worldVersion: 1, engineCapabilities: capabilities }), b = restored.joinGuest('Partner', { worldVersion: 1, engineCapabilities: capabilities });
    const contentHash = worldContentHash(world);
    restored.say(a.id, { type: 'worldReady', contentHash }); restored.say(b.id, { type: 'worldReady', contentHash }); restored.say(b.id, { type: 'ready', ready: true }); restored.say(a.id, { type: 'start' });
    await until(() => !!a.socket.last('started') || !!a.socket.last('error'));
    expect(a.socket.last('error')).toBeUndefined();
    restored.say(a.id, { type: 'downloadSave' });
    expect(JSON.parse(a.socket.last('saveData')!.json).extensions).toEqual(JSON.parse(json).extensions);
  });
});
