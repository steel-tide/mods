import { afterAll, afterEach, expect, test } from 'bun:test';
import { expandedManifest } from './test-utils';
import { readFileSync } from 'node:fs';
import { applyContent } from '../../../steel-tide/game/core/src/game/content';
import { parseDefinitionPack } from '../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { contentFrameCodec } from '../../../steel-tide/game/core/src/net/contentFrames';
import { ViewCache, primeMirror } from '../../../steel-tide/game/core/src/net/frames';
import { serializeGame, deserializeGame, deserializeSnapshot } from '../../../steel-tide/game/core/src/game/save';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { newEnt, tickEffects } from '../../../steel-tide/game/core/src/game/state';
import { Terrain, TILE } from '../../../steel-tide/game/core/src/core/types';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';
import { arena } from '../../../steel-tide/game/core/server/testkit/game';
import { FEEDBACK_ID, type FeedbackDef } from './extensions/combined-arms-v1/src/feedbackSpec';
import { installFakeCanvas } from '../../../steel-tide/game/core/server/testkit/canvas';
import type { ComponentsModule } from './extensions/combined-arms-v1/src/components';
import type { FeedbackModule } from './extensions/combined-arms-v1/src/feedback';
import type { LogisticsModule } from './extensions/combined-arms-v1/src/logistics';
import type { Camera } from '../../../steel-tide/game/core/src/render/camera';

const games: Game[] = [];
const restoreCanvas = installFakeCanvas(), oldListener = document.addEventListener;
Object.assign(document, { addEventListener() {} });
const { createFeedback, FeedbackPictures } = await import('./extensions/combined-arms-v1/src/feedbackPresentation');
afterAll(() => { document.addEventListener = oldListener; restoreCanvas(); });
afterEach(() => { for (const g of games.splice(0)) disposeContentGame(g); applyContent([]); });
async function setup() {
  const raw = JSON.parse(readFileSync(new URL('./mod.json', import.meta.url), 'utf8'));
  await prepareContentSchema(raw, true);
  const parsed = parseDefinitionPack(raw); if (!parsed.ok) throw new Error(`${parsed.errors.length} validation errors: ${JSON.stringify(parsed.errors.slice(0, 12))}`);
  await prepareContentCapabilities([parsed.pack]); expect(applyContent([parsed.pack]).rejected).toEqual([]);
  const base = arena({ mode: 'campaign', fog: true, dayNight: false });
  const game = createContentGame(base.st.cfg, base.st.map, true); games.push(game);
  const tank = newEnt(game.st, 'usgr-re-t90m', 1, 500, 500), observer = newEnt(game.st, 'usgr-re-t90m', 0, 550, 500);
  tank.holdFire = observer.holdFire = true;
  game.hash.rebuild(game.st); game.updateFog();
  const runtime = contentRuntime(game)!, components = runtime.module('components-v1') as ComponentsModule;
  const feedback = runtime.module(FEEDBACK_ID) as FeedbackModule, logistics = runtime.module('logistics-v1') as LogisticsModule;
  components.snapshot();
  const damage = (part: string, value: number, failed = value >= 100) => {
    const state = components.snapshot() as any;
    state.entities[tank.id].parts[part].damage = value;
    state.entities[tank.id].parts[part].failed = failed;
    if (failed) delete state.entities[tank.id].parts[part].occupant;
    components.restore(state);
  };
  return { raw, game, tank, observer, runtime, feedback, components, logistics, damage };
}

test('actual T90M source indicators honor 65%, inclusive destruction and stock-dependent rack thresholds', async () => {
  const { game, tank, feedback, components, logistics, damage } = await setup();
  const cfg = getDef(tank.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  const track = cfg.cosmetics.find(c => c.part === 'track')!;
  expect(feedback.render(tank)).toEqual([]);
  damage('track', 64.99, false); expect(feedback.render(tank)).toEqual([]);
  damage('track', 65, false); expect(feedback.render(tank).map(v => v.asset)).toEqual([track.damaged]);
  damage('track', 100); expect(feedback.render(tank).map(v => v.asset)).toEqual([track.destroyed]);
  damage('track', 0, false);
  for (let i = 0; i < 10; i++) logistics.spendRound(tank, getDef(tank.defId), 0);
  const threshold = 175 + 10 * 175 / 48;
  damage('rack', threshold, false);
  expect((components.snapshot() as any).entities[tank.id].parts.rack.failed).toBe(false);
  expect(feedback.render(tank).map(v => v.asset)).toEqual([cfg.cosmetics.find(c => c.part === 'rack')!.destroyed]);
  const restored = deserializeGame(serializeGame(game)); games.push(restored);
  expect(contentRuntime(restored)!.module(FEEDBACK_ID)!.render!(restored.st.ents.get(tank.id)!)).toEqual(feedback.render(tank));
  damage('rack', 0, false); expect(feedback.render(tank)).toEqual([]);
});

test('visible enemy receives only authored icon states; fog and full/delta restoration cannot expose private damage', async () => {
  const { game, tank, observer, runtime, damage } = await setup();
  damage('track', 70, false);
  const codec = contentFrameCodec(game), cache = new ViewCache(codec.viewKey(game, 0, 'none'));
  const full = codec.encodeFullFrame(game, 0, 'none', 1, cache);
  expect((full.extensions!['components-v1'] as any).entities[tank.id]).toBeUndefined();
  expect((full.extensions![FEEDBACK_ID] as any)[tank.id]).toEqual({ icons: [0, 1, 0, 0, 0], public: true });
  const remote = deserializeSnapshot(full); games.push(remote);
  const mirror = new Map(); primeMirror(mirror, full);
  expect(contentRuntime(remote)!.module(FEEDBACK_ID)!.render!(remote.st.ents.get(tank.id)!)).toEqual(runtime.module(FEEDBACK_ID)!.render!(tank));
  const checkpoint = serializeGame(remote);
  expect(contentRuntime(remote)!.module(FEEDBACK_ID)!.render!(remote.st.ents.get(tank.id)!)).toEqual(runtime.module(FEEDBACK_ID)!.render!(tank));
  const resumed = deserializeGame(checkpoint); games.push(resumed);
  expect(contentRuntime(resumed)!.module(FEEDBACK_ID)!.render!(resumed.st.ents.get(tank.id)!)).toEqual(runtime.module(FEEDBACK_ID)!.render!(tank));
  damage('track', 100);
  const delta = codec.encodeFrame(codec.buildTeamView(game, 0, 'none'), cache, 2, game.st.tick, game.st.time);
  contentFrameCodec(remote).applyFrame(remote, mirror, delta);
  expect(contentRuntime(remote)!.module(FEEDBACK_ID)!.render!(remote.st.ents.get(tank.id)!)).toEqual(runtime.module(FEEDBACK_ID)!.render!(tank));
  observer.x = 1500; observer.y = 1500; game.hash.rebuild(game.st); game.updateFog();
  const hidden = codec.encodeFrame(codec.buildTeamView(game, 0, 'none'), cache, 3, game.st.tick, game.st.time);
  expect((hidden.extensions?.[FEEDBACK_ID] as any)?.[tank.id]).toBeUndefined();
  contentFrameCodec(remote).applyFrame(remote, mirror, hidden);
  expect(remote.st.ents.has(tank.id)).toBe(false);
});

test('original local voice routing keeps source silence, gains and order cooldown and disposes cleanly', async () => {
  const { game, observer } = await setup();
  const played: unknown[][] = [], native: unknown[][] = [], released: (readonly string[])[] = [];
  const feedback = createFeedback({ game, player: 0, spectator: false }, { unitVoice: (...args) => native.push(args) },
    id => `data:audio/ogg;base64,${id}`, (...args) => played.push(args), urls => released.push(urls));
  feedback.unitVoice(observer.defId, 'select', observer.id); expect(played).toHaveLength(0); expect(native).toHaveLength(0);
  feedback.unitVoice(observer.defId, 'move', observer.id); expect(played).toHaveLength(1);
  // RW 1.15 class_393 starts every sound item at 0.3; T-90M authors no gain.
  expect(played[0][4]).toEqual({ gain: 0.3, repeatMs: 5000 });
  const selected = newEnt(game.st, 'usgr-re-hq17', 0, 550, 520);
  feedback.unitVoice(selected.defId, 'select', selected.id); expect(played[1][4]).toEqual({ gain: 0.3, repeatMs: 0 });
  const vanilla = newEnt(game.st, 'mbt', 0, 580, 520);
  feedback.unitVoice(vanilla.defId, 'move', vanilla.id); expect(native).toHaveLength(1);
  feedback.unitVoice(observer.defId, 'repair', observer.id); expect(played).toHaveLength(2);
  feedback.dispose!(); feedback.unitVoice(observer.defId, 'attack', observer.id); expect(played).toHaveLength(2);
  feedback.dispose!(); expect(released).toHaveLength(1); expect(released[0].length).toBeGreaterThan(0);
  const spectator = createFeedback({ game, player: 0, spectator: true }, { unitVoice() { throw Error('spectator'); } }, undefined, () => { throw Error('spectator'); });
  spectator.unitVoice(observer.defId, 'move', observer.id);
});

test('cosmetic overlay only requests original images for visible active units and skips missing assets', async () => {
  const { game, tank, observer, damage } = await setup(); damage('track', 70, false);
  const requested: string[] = [], pictures = new FeedbackPictures(id => { requested.push(id); return undefined; });
  const camera = { bounds: () => ({ x0: 0, x1: 2000, y0: 0, y1: 2000 }) } as Camera;
  const context = { drawImage() { throw Error('missing image must not draw'); } } as unknown as CanvasRenderingContext2D;
  pictures.draw(game, 0, false, context, camera); expect(requested).toHaveLength(1);
  const hidden = new FeedbackPictures(id => { throw Error(`hidden icon requested ${id}`); });
  observer.x = 1500; observer.y = 1500; game.hash.rebuild(game.st); game.updateFog();
  hidden.draw(game, 0, false, context, camera);
  const spectatorRequests: string[] = [];
  game.spectate = 'all';
  new FeedbackPictures(id => { spectatorRequests.push(id); return undefined; }).draw(game, 0, true, context, camera);
  expect(spectatorRequests).toHaveLength(1);
  tank.dead = true; pictures.draw(game, 0, false, context, camera); expect(requested).toHaveLength(1);
});

test('feedback schema refuses dangling package assets and nonexistent component bindings', async () => {
  const { raw } = await setup();
  const broken = structuredClone(raw), tank = broken.defs.find((d: any) => d.id === 'usgr-re-t90m');
  // Literal profiles are packed; mutate this one definition's expanded copy.
  tank.extensions = expandedManifest().defs.find((d: any) => d.id === 'usgr-re-t90m').extensions;
  tank.extensions[FEEDBACK_ID].voices.move.assets = ['missing-recording'];
  expect(parseDefinitionPack(broken).ok).toBe(false);
  tank.extensions[FEEDBACK_ID].voices.move.assets = expandedManifest().defs.find((d: any) => d.id === 'usgr-re-t90m').extensions[FEEDBACK_ID].voices.move.assets;
  tank.extensions[FEEDBACK_ID].cosmetics = structuredClone((getDef('usgr-re-t90m').extensions![FEEDBACK_ID] as FeedbackDef).cosmetics);
  tank.extensions[FEEDBACK_ID].cosmetics[0].part = 'missing-part';
  expect(parseDefinitionPack(broken).ok).toBe(false);
});

test('source jet cadence survives save/restore and does not replay earlier one-shots', async () => {
  const { game } = await setup();
  const jet = newEnt(game.st, 'usgr-re-a10', 0, 550, 550); jet.holdFire = true;
  const cfg = getDef(jet.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  expect(cfg.audio!.periodic[0].interval).toBe(2);
  const events = new Set<string>(), at: number[] = [];
  for (let tick = 0; tick < 150; tick++) {
    game.step();
    for (const fx of game.st.effects) if (fx.key.startsWith(`ucgr.audio:${cfg.audio!.periodic[0].cue.assets[0]}:${jet.id}:`) && !events.has(fx.key)) {
      events.add(fx.key); at.push(game.st.time);
    }
  }
  expect(at.length).toBeGreaterThanOrEqual(2);
  expect(at[1] - at[0]).toBeCloseTo(2, 2);
  const copy = deserializeGame(serializeGame(game)); games.push(copy);
  for (let tick = 0; tick < 120; tick++) {
    game.step(); copy.step();
    expect(copy.st.effects.filter(v => v.key.startsWith('ucgr.audio:')).map(v => [v.key, v.t]))
      .toEqual(game.st.effects.filter(v => v.key.startsWith('ucgr.audio:')).map(v => [v.key, v.t]));
  }
});

test('recorded world feedback deduplicates network refresh, pauses, clears seek and disposes its scope', async () => {
  const { game } = await setup(); game.st.cfg.fog = false;
  const played: unknown[][] = [], paused: boolean[] = [];
  let resets = 0, disposed = 0, baseDisposed = 0;
  const scope = { prepare: async () => true, play: (...args: unknown[]) => { played.push(args); return undefined; },
    update() {}, setPaused: (value: boolean) => paused.push(value), reset: () => resets++, dispose: () => disposed++ };
  const feedback = createFeedback({ game, player: 0, spectator: false }, { unitVoice() {}, dispose() { baseDisposed++; } },
    id => `data:audio/wav;base64,${id}`, undefined, undefined, () => scope);
  const frame = { now: 0, dt: 1/60, time: 1, paused: false, player: 0, spectator: false };
  game.st.effects.push({ key: 'ucgr.audio:audio-test:0:123', x: 300, y: 400, t: .5, dur: .5, frames: 1, scale: 2 });
  feedback.update!(frame); feedback.update!({ ...frame, time: 1.1 });
  expect(played).toHaveLength(1);
  expect(played[0][1]).toEqual({ position: { x: 300, y: 400 }, gain: 2 });
  game.st.effects.push({ key: 'ucgr.audio:audio-test:0:124', x: 300, y: 400, t: .5, dur: .5, frames: 1 });
  feedback.update!({ ...frame, time: 1.1, paused: true }); expect(played).toHaveLength(1);
  feedback.update!({ ...frame, time: 1.2 }); expect(played).toHaveLength(2);
  feedback.update!({ ...frame, time: .5 }); expect(resets).toBe(1); expect(played).toHaveLength(2);
  feedback.dispose!(); feedback.dispose!(); expect(disposed).toBe(1); expect(baseDisposed).toBe(1); expect(paused).toContain(true);
});

test('selected allied ERA frames reflect exact source thresholds and are absent from public enemy views', async () => {
  const { tank, feedback, components } = await setup();
  const cfg = getDef(tank.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  expect(cfg.era).toHaveLength(2);
  const change = (front: number) => {
    const state = components.snapshot() as any; state.entities[tank.id].layers.chemical.front = front; components.restore(state);
    return feedback.render(tank, true).filter(v => v.under)[0].frame;
  };
  expect(change(700)).toBe(0); expect(change(525)).toBe(1); expect(change(280)).toBe(2); expect(change(279.99)).toBe(3);
  expect(feedback.render(tank).filter(v => v.under)).toHaveLength(0);
  const publicSnapshot = feedback.snapshot({ visibleEntities: new Set([tank.id]), privateEntity: () => false } as any) as any;
  expect(publicSnapshot[tank.id].era).toBeUndefined();
});

test('source impact art and recordings keep authored lifetime and never consume combat randomness', async () => {
  const { game, tank, feedback } = await setup();
  const cfg = getDef(tank.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  const impact = cfg.impacts!.find(i => i.weapon === 'w2')!;
  const picture = impact.effects.find(e => e.picture)!.picture!;
  expect(picture.life).toBeCloseTo(1); expect(picture.scaleFrom).toBeCloseTo(.625);
  let delegated = 0;
  const impactCall = feedback.wrapImpact(() => { delegated++; });
  const random = JSON.stringify(game.st.rng);
  impactCall(game.st, game.hash, { id: 12345, src: tank.id, gun: `${tank.defId}/w2`, x: 600, y: 620, angle: .4 } as any, null);
  expect(delegated).toBe(1); expect(JSON.stringify(game.st.rng)).toBe(random);
  const visible = game.st.effects.find(e => e.key.startsWith(`ucgr.effect:${tank.defId}:w2:`))!;
  expect(visible.t).toBe(0); expect(visible.dur).toBeCloseTo(4 / 24); expect(visible.x).toBe(600); expect(visible.y).toBe(620);
  expect(impact.effects.some(e => e.cue)).toBe(true);
  tickEffects(game.st, .1); expect(game.st.effects.includes(visible)).toBe(true); expect(visible.t).toBe(.1);
  tickEffects(game.st, 1); expect(game.st.effects.includes(visible)).toBe(false);
});

test('rack failure chooses its source branch once and retains public turret loss through save and filtered frames', async () => {
  const { game, tank, observer, feedback, components } = await setup();
  game.step(); // Initialize the cue baseline before the source event.
  const state = components.snapshot() as any;
  state.entities[tank.id].parts.rack.damage = 1000;
  state.entities[tank.id].parts.rack.failed = true;
  state.entities[tank.id].terminal = { remaining: 3.5, owner: 0, sourceId: observer.id, gun: `${observer.defId}/w1`, hull: 300 };
  tank.hp = 300;
  components.restore(state);
  feedback.afterStep();
  expect(feedback.render(tank).some(v => v.detachTurret)).toBe(true);
  const sounds = game.st.effects.filter(e => e.key.startsWith('ucgr.audio:')).length;
  feedback.afterStep(); expect(game.st.effects.filter(e => e.key.startsWith('ucgr.audio:'))).toHaveLength(sounds);
  const publicState = feedback.snapshot({ visibleEntities: new Set([tank.id]), privateEntity: () => false } as any) as any;
  expect(publicState[tank.id].detached).toBe(true); expect(publicState.$audio).toBeUndefined();
  const copy = deserializeGame(serializeGame(game)); games.push(copy);
  expect((contentRuntime(copy)!.module(FEEDBACK_ID)!.render!(copy.st.ents.get(tank.id)!) as any[]).some(v => v.detachTurret)).toBe(true);
});

test('source firing PCM replaces only its own native event and leaves recoil and combat RNG untouched', async () => {
  const { game, tank, feedback } = await setup();
  const def = getDef(tank.defId), weapon = def.weapons.find(w => w.id === 'w3')!;
  const cue = (def.extensions![FEEDBACK_ID] as FeedbackDef).audio!.shots.find(s => s.weapon === weapon.id)!.cue;
  // NSVT authors `:0.2` on the file, then shoot_sound_vol 0.3 replaces every item gain (class_392.a(float)).
  expect(cue.gain).toBeCloseTo(.3);
  game.st.events.length = 0; game.st.effects.length = 0;
  game.st.events.push({ type: 'sound', sound: 'alarm', x: tank.x, y: tank.y },
    { type: 'sound', sound: weapon.sound ?? 'mg', x: tank.x + 1, y: tank.y },
    { type: 'sound', sound: weapon.sound ?? 'mg', x: tank.x, y: tank.y });
  game.st.effects.push({ key: '@recoil', x: tank.x, y: tank.y, t: .1, dur: .1, frames: 1, recoil: { src: tank.id, barrel: 0, stroke: 1 } });
  const random = JSON.stringify(game.st.rng);
  feedback.onShot(tank, def, weapon, { id: 93001 } as any);
  expect(game.st.events).toHaveLength(2); expect(game.st.events[0].type).toBe('sound');
  expect(game.st.effects.some(e => e.key === '@recoil')).toBe(true);
  const sound = game.st.effects.find(e => e.key.startsWith(`ucgr.audio:${cue.assets[0]}:`))!;
  expect(sound.scale).toBeCloseTo(.3); expect(JSON.stringify(game.st.rng)).toBe(random);
});

test('source aircraft height uses the same live pose and shadow height without changing landing state', async () => {
  const { game } = await setup();
  const jet = newEnt(game.st, 'usgr-re-a10', 0, 550, 550); jet.holdFire = true; game.step();
  jet.prevX = jet.x - 1; // Moving pose excludes the native stationary idle bob.
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  renderer.frameNo = 1; renderer.renderTime = game.st.time;
  const def = getDef(jet.defId), savedAlt = jet.alt;
  const height = (contentRuntime(game)!.module('sensors-v1')!.render!(jet) as any).flight.altitude;
  const picture = renderer.pictureOf(jet, def, 1), nativeFraction = savedAlt ?? 1;
  expect(picture.spriteY).toBeCloseTo(jet.y - height * .4 * nativeFraction);
  expect((def.altitude ?? 12) * picture.altFrac).toBeCloseTo(height * nativeFraction);
  const fraction = picture.altFrac;
  for (let i = 0; i < 4; i++) expect(renderer.pictureOf(jet, def, 1).altFrac).toBe(fraction);
  expect(jet.alt).toBe(savedAlt);
});

test('source animated rack art advances from effect age and draws the original atlas frame', async () => {
  const { game, tank } = await setup();
  const cfg = getDef(tank.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  const index = cfg.rack!.high.findIndex(e => e.picture?.frames === 8), picture = cfg.rack!.high[index].picture!;
  expect(picture.fps).toBe(27); expect(picture.life).toBe(3); expect(picture.last).toBe(7);
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  const image = { naturalWidth: 256, naturalHeight: 64 };
  renderer.projectilePictures = { image: (id: string) => { expect(id).toBe(picture.asset); return image; } };
  const drawings: unknown[][] = [], positions: number[][] = [];
  const context = { save() {}, restore() {}, rotate() {}, translate: (x: number, y: number) => positions.push([x, y]),
    drawImage: (...args: unknown[]) => drawings.push(args) } as unknown as CanvasRenderingContext2D;
  renderer.drawContentEffect(context, { key: `ucgr.effect:${tank.defId}:rack-high:${index}`, x: 123, y: 456, t: .5, dur: 3 }, {}, 1, {});
  expect(positions).toEqual([[123, 456]]);
  expect(drawings[0].slice(0, 5)).toEqual([image, 160, 0, 32, 64]); // floor(.5 * 27) % 8 = 5
  expect(drawings[0][7]).toBeCloseTo(32 * (.25 + (.3125 - .25) / 6));
});

test('radar missile queued launch recording follows the live helper and survives checkpoint before emission', async () => {
  const { game, feedback } = await setup();
  const jet = newEnt(game.st, 'usgr-re-f-2', 0, 550, 550), target = newEnt(game.st, 'usgr-re-a10', 1, 850, 550);
  jet.holdFire = target.holdFire = true;
  const def = getDef(jet.defId), cfg = def.extensions![FEEDBACK_ID] as FeedbackDef;
  const shot = cfg.audio!.shots.find(s => s.atProjectile)!, weapon = def.weapons.find(w => w.id === shot.weapon)!;
  expect(shot.delay).toBe(.1); expect(shot.cue.gain).toBe(.5);
  (feedback as any).host.fireShot(game.st, jet, def, weapon, target, { x: target.x, y: target.y }, 0);
  const p = game.st.projs.at(-1)!;
  const key = `ucgr.audio:${shot.cue.assets[0]}:0:${p.id}`;
  expect(game.st.effects.some(e => e.key === key)).toBe(false);
  expect((feedback.snapshot() as any).$launches).toEqual([[p.id, .1]]);
  const copy = deserializeGame(serializeGame(game)); games.push(copy);
  for (let step = 0; step < 3; step++) { game.step(); copy.step(); }
  const original = game.st.effects.find(e => e.key === key)!;
  expect(original).toBeDefined(); expect(original.x).toBeCloseTo(p.x); expect(original.y).toBeCloseTo(p.y);
  expect(copy.st.effects.find(e => e.key === key)).toEqual(original);
  const pending = feedback.snapshot() as any; expect(pending.$launches).toBeUndefined();
});


test('source cannon smoke keeps independent drift, native recoil, terrain gates and combat RNG', async () => {
  const { game, tank, feedback } = await setup();
  const def = getDef(tank.defId), weapon = def.weapons.find(w => w.id === 'w1')!;
  const cfg = def.extensions![FEEDBACK_ID] as FeedbackDef;
  const source = cfg.flashes!.find(f => f.weapon === 'w1')!.effects[1].picture!;
  const x = 600, y = 620, tile = Math.floor(y / TILE) * game.st.map.w + Math.floor(x / TILE);
  game.st.map.terrain[tile] = Terrain.Grass;
  tank.angle = tank.turretAngle = 0;
  game.st.effects.length = 0; game.st.decals.length = 0;
  const marker = { key: 'fx.muzzle', x, y, t: 0, dur: .5, frames: 1, bore: 0, charge: 1,
    recoil: { src: tank.id, barrel: 0, stroke: 1 } };
  game.st.effects.push(marker);
  const rng = JSON.stringify(game.st.rng);
  feedback.onShot(tank, def, weapon, { id: 94001, x, y } as any);
  expect(marker.key).toBe('@recoil'); expect(marker.recoil.stroke).toBe(1); expect('charge' in marker).toBe(false);
  expect(JSON.stringify(game.st.rng)).toBe(rng);
  const decals = game.st.decals.filter(d => d.key.startsWith(`ucgr.effect:${tank.defId}:shot-w1:`));
  expect(decals).toHaveLength(3); // one direct smoke, plus smoke+dust emitted by the source flash.
  for (const decal of decals) {
    expect(decal.t).toBeCloseTo(100 / 60);
    expect(decal.vx).toBeGreaterThanOrEqual(-16.8); expect(decal.vx).toBeLessThanOrEqual(-7.2);
    expect(decal.vy).toBeGreaterThanOrEqual(-2.4); expect(decal.vy).toBeLessThanOrEqual(12);
  }
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  const direct = decals.find(d => d.key.endsWith(':1'))!, image = { naturalWidth: 100, naturalHeight: 100 };
  renderer.projectilePictures = { image: (id: string) => { expect(id).toBe(source.asset); return image; } };
  const positions: number[][] = [], drawings: unknown[][] = [];
  const context = { save() {}, restore() {}, rotate() {}, translate: (dx: number, dy: number) => positions.push([dx, dy]),
    drawImage: (...args: unknown[]) => drawings.push(args) } as unknown as CanvasRenderingContext2D;
  direct.t -= .5;
  renderer.drawContentDecal(context, direct, {}, 1, {});
  expect(positions[0][0]).toBeCloseTo(direct.x + direct.vx! * .5);
  expect(positions[0][1]).toBeCloseTo(direct.y + direct.vy! * .5);
  expect(drawings).toHaveLength(1);
  game.st.map.terrain[tile] = Terrain.Water;
  game.st.decals.length = 0;
  feedback.onShot(tank, def, weapon, { id: 94002, x, y } as any);
  expect(game.st.decals).toHaveLength(0);
});


test('source custom impacts suppress only their native class feedback, including explicit source silence', async () => {
  const { game, tank, feedback } = await setup();
  const weapon = getDef(tank.defId).weapons.find(w => w.id === 'w1')!;
  expect(weapon.look?.impact).toBe('none');
  game.st.events.length = 0; game.st.effects.length = 0;
  const existing = { id: 90000, key: 'mark.old', x: 600, y: 620, t: 20, frame: 0 }; game.st.decals.push(existing);
  const impact = feedback.wrapImpact(() => {
    game.st.decals.push({ id: 90001, key: 'mark.blast', x: 600, y: 620, t: 20, frame: 0 }, { id: 90002, key: 'mark.other', x: 601, y: 620, t: 20, frame: 0 });
    game.st.events.push({ type: 'sound', sound: 'alarm', x: 600, y: 620 },
      { type: 'sound', sound: 'expl', x: 601, y: 620 }, { type: 'sound', sound: 'expl', x: 600, y: 620 });
    game.st.effects.push({ key: 'fx.splash', x: 601, y: 620, t: 0, dur: 1, frames: 1 },
      { key: 'fx.splash', x: 600, y: 620, t: 0, dur: 1, frames: 1 });
  });
  impact(game.st, game.hash, { id: 95001, gun: `${tank.defId}/w1`, x: 600, y: 620, angle: 0 } as any, null);
  expect(game.st.events).toHaveLength(2);
  expect(game.st.decals).toContain(existing); expect(game.st.decals.some(d => d.id === 90001)).toBe(false); expect(game.st.decals.some(d => d.id === 90002)).toBe(true);
  expect(game.st.events[0]).toEqual({ type: 'sound', sound: 'alarm', x: 600, y: 620 });
  expect(game.st.effects.filter(e => e.key === 'fx.splash').map(e => e.x)).toEqual([601]);
  expect(game.st.effects.some(e => e.key.startsWith('ucgr.effect:'))).toBe(false); // AP carrier has source NONE.
});

test('trench source art draws beneath every member at a fixed world pose while its proxy body stays hidden', async () => {
  const { game } = await setup();
  const trench = newEnt(game.st, 'usgr-re-unit-8c2bed23b4', 0, 650, 650);
  trench.angle = 1.2;
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  const picture = renderer.pictureOf(trench, getDef(trench.defId), 1);
  // Isolate the public pose from asynchronous atlas loading in this headless test.
  const cv = document.createElement('canvas');
  Object.assign(picture, { stamp: 1, body: { cv, fw: 40, fh: 20, frames: 1 }, displayScale: 1.5625, ex: 650, ey: 650 });
  renderer.frameNo = 1;
  const drawings: unknown[][] = [], context = { drawImage: (...args: unknown[]) => drawings.push(args) } as unknown as CanvasRenderingContext2D;
  renderer.drawSquadGround(context, [trench], 1);
  expect(drawings).toHaveLength(1);
  expect(drawings[0]).toEqual([cv, 0, 0, 40, 20, 650 - 40 * 1.5625 / 2, 650 + .4 - 20 * 1.5625 / 2, 40 * 1.5625, 20 * 1.5625]);
  const before = drawings.length;
  renderer.drawEnt(context, trench, 1, {}, {});
  expect(drawings).toHaveLength(before);
});


test('original projectile presentation omits unsupported host trails and projects public helper height once', async () => {
  const { game, feedback } = await setup();
  const jet = newEnt(game.st, 'usgr-re-f-2', 0, 550, 550), target = newEnt(game.st, 'usgr-re-a10', 1, 850, 550);
  jet.holdFire = target.holdFire = true;
  game.step();
  const def = getDef(jet.defId), cfg = def.extensions![FEEDBACK_ID] as FeedbackDef;
  const shot = cfg.audio!.shots.find(s => s.atProjectile)!, weapon = def.weapons.find(w => w.id === shot.weapon)!;
  (feedback as any).host.fireShot(game.st, jet, def, weapon, target, { x: target.x, y: target.y }, 0);
  const p = game.st.projs.at(-1)!;
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  const art = cfg.projectiles!.find(v => v.weapon === weapon.id)!, image = { naturalWidth: 40, naturalHeight: 8 };
  renderer.projectilePictures = { image: (id: string) => { expect(id).toBe(art.asset); return image; } };
  const positions: number[][] = [], context = { save() {}, restore() {}, rotate() {},
    translate: (x: number, y: number) => positions.push([x, y]), drawImage() {} } as unknown as CanvasRenderingContext2D;
  const height = (contentRuntime(game)!.module('sensors-v1')! as any).projectileVisual(p).altitude;
  expect(renderer.drawContentProjectileTrail(context, p, 1, {})).toBe(true);
  expect(renderer.drawContentProjectileTrail(context, {} as any, 1, {})).toBe(false);
  expect(renderer.drawContentProjectile(context, p, 1, {})).toBe(true);
  expect(positions[0][0]).toBeCloseTo(p.x); expect(positions[0][1]).toBeCloseTo(p.y - height * .4);
});


test('omitted source firing recordings stay silent instead of falling back to synthesized class audio', async () => {
  const { game, feedback } = await setup();
  // BMP-2M's recorded gain 5 exceeds the API's 0..4: the cue is omitted, never clamped.
  const heli = newEnt(game.st, 'usgr-re-bmp2m', 0, 550, 550), def = getDef(heli.defId);
  const cfg = def.extensions![FEEDBACK_ID] as FeedbackDef;
  const weapon = def.weapons.find(w => !cfg.audio?.shots.some(s => s.weapon === w.id))!;
  expect(weapon).toBeDefined();
  game.st.events.length = 0; game.st.effects.length = 0;
  game.st.events.push({ type: 'sound', sound: weapon.sound ?? 'mg', x: heli.x, y: heli.y });
  feedback.onShot(heli, def, weapon, { id: 97001, x: heli.x, y: heli.y } as any);
  expect(game.st.events).toHaveLength(0);
  expect(game.st.effects.filter(e => e.key.startsWith('ucgr.audio:'))).toHaveLength(0);
});

test('original battery sheets use public deployment and source radar heading in the native ring pose', async () => {
  const { game, runtime, feedback } = await setup();
  const radar = newEnt(game.st, 'usgr-re-9s18m3', 0, 650, 650);
  radar.angle = .3; radar.holdPos = true; game.step();
  const cfg = getDef(radar.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  expect(cfg.appearance?.states).toHaveLength(2);
  const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
  const { putSprite, getSprite, forgetArt } = await import('../../../steel-tide/game/core/src/gfx/atlas');
  const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
  renderer.frameNo = 1;
  const suffix = renderer.pictureOf(radar, getDef(radar.defId), 1).teamSuffix;
  const art = cfg.appearance!.states.flatMap(s => [s.body, s.radar!.sprite]);
  const prior = new Map([...new Set(art)].map(key => [key + suffix, getSprite(key + suffix)]));
  try {
    for (const key of prior.keys()) putSprite(key, { cv: document.createElement('canvas'), fw: 40, fh: 40, frames: 1, pivotX: .5, pivotY: .5 } as any);
    renderer.frameNo++;
    const travel = renderer.pictureOf(radar, getDef(radar.defId), 1);
    expect(travel.bodyKey).toBe(cfg.appearance!.states[0].body);
    expect(travel.rings).toHaveLength(1);
    expect(travel.rings[0].bearing).toBeCloseTo(travel.heading);
    const sensors = runtime.module('sensors-v1')!;
    expect(sensors.order!({ owner: 0, ids: [radar.id], action: 'radar:toggle' })).toBe(true);
    for (let i = 0; i < 20; i++) game.step();
    renderer.frameNo++; renderer.renderTime = game.st.time;
    const pose = sensors.render!(radar) as any, deployed = renderer.pictureOf(radar, getDef(radar.defId), .5), state = feedback.appearance(radar)!;
    expect(state.deployed).toBe(true);
    expect(deployed.bodyKey).toBe(state.body); expect(deployed.rings).toHaveLength(1);
    expect(deployed.rings[0].bearing).toBeCloseTo(pose.radarPreviousHeading + (pose.radarHeading - pose.radarPreviousHeading) * .5);
    const a = deployed.heading + Math.PI / 2;
    expect(deployed.rings[0].x).toBeCloseTo(deployed.ex - state.radar!.y * Math.sin(a) * deployed.displayScale);
    expect(deployed.rings[0].y).toBeCloseTo(deployed.spriteY + state.radar!.y * Math.cos(a) * deployed.displayScale);
  } finally {
    for (const [key, sprite] of prior) { if (sprite) putSprite(key, sprite); else forgetArt(key); }
  }
});

test('original fragment art selects its component branch and uses simulated height without a parent-projectile substitute', async () => {
  const { game, tank, components } = await setup();
  const cfg = getDef(tank.defId).extensions![FEEDBACK_ID] as FeedbackDef;
  const art = cfg.projectiles!.find(v => v.weapon === 'w1' && v.variant?.kind === 'fragment' && v.variant.index === 0 && v.variant.branch === -1)!;
  expect(art.scale).toBe(.1875);
  const p = { gun: `${tank.defId}/w1`, x: 200, y: 300, px: 180, py: 280, angle: .25 } as any;
  const original = components.projectileVisual;
  let branch = -1;
  components.projectileVisual = () => ({ kind: 'fragment', index: 0, branch, altitude: 12 });
  try {
    const { ContentRenderer } = await import('./extensions/combined-arms-v1/src/contentRenderer');
    const renderer = new ContentRenderer(document.createElement('canvas'), game, 0) as any;
    const image = { naturalWidth: 16, naturalHeight: 32 };
    renderer.projectilePictures = { image: (asset: string) => { expect(asset).toBe(art.asset); return image; } };
    const positions: number[][] = [], drawings: unknown[][] = [];
    const ctx = { save() {}, restore() {}, rotate() {}, translate: (...at: number[]) => positions.push(at), drawImage: (...a: unknown[]) => drawings.push(a) } as any;
    expect(renderer.drawContentProjectile(ctx, p, .5, {})).toBe(true);
    expect(positions).toEqual([[190, 290 - 12 * .4]]);
    expect(drawings[0]).toEqual([image, -1.5, -3, 3, 6]);
    branch = 63;
    expect(renderer.drawContentProjectile(ctx, p, .5, {})).toBe(true);
    expect(drawings).toHaveLength(1);
  } finally { components.projectileVisual = original; }
});
