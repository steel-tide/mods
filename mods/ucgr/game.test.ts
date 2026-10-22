/** Native integration smoke tests; imports the sibling engine without editing it.
 * Run: bun test ./mods/ucgr/game.test.ts
 */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TILE, FogState } from '../../../steel-tide/game/core/src/core/types';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../steel-tide/game/core/src/game/contentCapabilities';
import { createContentGame, contentRuntime, disposeContentGame } from '../../../steel-tide/game/core/src/game/contentGame';
import { availableFactions } from '../../../steel-tide/game/core/src/game/factions';
import { buildGameMap } from '../../../steel-tide/game/core/src/game/mapdefs';
import { cmdProduce, cmdPlaceBuilding, cmdAttack, cmdMove, cmdBoard, cmdContentAction, worldDefAllowed } from '../../../steel-tide/game/core/src/game/orders';
import { kill } from '../../../steel-tide/game/core/src/game/combat';
import { serializeGame, deserializeGame } from '../../../steel-tide/game/core/src/game/save';
import { newEnt, type Ent, type GameConfig } from '../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../steel-tide/game/core/src/game/sim';
import { arenaMap, run, stepUntil, type ArenaOpts } from '../../../steel-tide/game/core/server/testkit/game';
import { sourceTargetAllowed } from './extensions/combined-arms-v1/src/targeting';

const raw = readFileSync(resolve(import.meta.dir, 'mod.json'), 'utf8');
await prepareContentSchema(raw,true);
const parsed = parseMod(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
const mod = parsed.mod;
await prepareContentCapabilities([mod]);
const games: Game[] = [];
function track(game: Game): Game { games.push(game); return game; }
function arena(opts: ArenaOpts & { fog?: boolean } = {}) {
  const cfg: GameConfig = { mode: 'campaign', mapKey: 'arena', seed: 3, fog: opts.fog ?? false,
    popCap: 100, startMetal: opts.metal ?? 1000,
    players: opts.players ?? [{ isHuman: true, team: 0 }, { isHuman: true, team: 1 }] };
  return track(createContentGame(cfg, arenaMap(opts), true));
}
beforeEach(() => {
  expect(parsed.warnings).toEqual([]);
  const result = applyMods([mod]);
  expect(result.rejected).toEqual([]);
  expect(result.warnings).toEqual([]);
});
afterEach(() => { for (const game of games) disposeContentGame(game); games.length = 0; applyMods([]); });

function opening(faction: string, ai = false) {
  const cfg: GameConfig = { mode: 'sandbox', mapKey: 'greenfield', seed: 11, fog: false, popCap: 100, startMetal: 1200,
    players: [{ isHuman: !ai, team: 0, faction }, { isHuman: true, team: 1 }] };
  return track(createContentGame(cfg, buildGameMap(cfg)));
}

for (const f of mod.factions!) {
  test(`${f.id}: opens, recruits, constructs and saves`, () => {
    const g = opening(f.id);
    const own = [...g.st.ents.values()].filter(e => e.owner === 0);
    expect(own.map(e => e.defId)).toEqual([f.headquarters, f.builder, f.builder]);
    expect(cmdProduce(g, own[0].id, f.builder)).toBe(true);
    expect(stepUntil(g, () => [...g.st.ents.values()].filter(e => e.owner === 0 && e.defId === f.builder).length === 3, 30*90)).toBeGreaterThan(0);
    const combat = getDef(f.headquarters).produces!.find(id => getDef(id).weapons.length)!;
    expect(combat).toBeDefined();
    expect(cmdProduce(g, own[0].id, combat)).toBe(true);
    expect(stepUntil(g, () => [...g.st.ents.values()].some(e => e.owner === 0 && e.defId === combat), 30*90)).toBeGreaterThan(0);
    expect(worldDefAllowed(g.st, 0, 'factory')).toBe(false);
    const restored = track(deserializeGame(serializeGame(g)));
    expect(restored.st.cfg.players[0].faction).toBe(f.id);
    const a = arena({ metal: 10000, players: [{ isHuman: true, team: 0, faction: f.id }, { isHuman: true, team: 1 }] });
    newEnt(a.st, f.headquarters, 0, 12*TILE, 12*TILE);
    const builder = newEnt(a.st, f.builder, 0, 16*TILE, 14*TILE);
    expect(cmdPlaceBuilding(a, [builder.id], f.headquarters, 19, 12)).toBe(true);
    expect(stepUntil(a, () => [...a.st.ents.values()].filter(e => e.defId === f.headquarters && !e.site).length === 2, 30*240)).toBeGreaterThan(0);
  });
  test(`${f.id}: AI can sustain economy and recruit`, () => {
    const g = opening(f.id, true);
    run(g, 180);
    const own = [...g.st.ents.values()].filter(e => e.owner === 0);
    expect(own.every(e => f.roster!.includes(e.defId))).toBe(true);
    expect(own.some(e => !e.site && e.defId === 'usgr-re-supply-depot')).toBe(true);
    expect(own.some(e => getDef(e.defId).kind === 'unit' && getDef(e.defId).weapons.length)).toBe(true);
  }, 20000);
}

test('real HJ-8 automatically deploys, fires, packs on movement and retains its rifleman', () => {
  const g = arena({ metal:10000 });
  const unit = newEnt(g.st, 'usgr-re-plahj8team', 0, 14*TILE, 14*TILE);
  unit.angle = 0;
  const assembly = (game: Game) => (contentRuntime(game)!.snapshot()['articulation-v1'] as any[]).find(([id]) => id === unit.id)[1];
  run(g, 1/30);
  const member = g.st.ents.get(assembly(g).members.rifleman)!;
  expect(member.defId).toBe('usgr-re-plainf');
  expect(member.angle).toBeCloseTo(35*Math.PI/180);
  expect(contentRuntime(g)!.module('articulation-v1')!.canFire!(unit, getDef(unit.defId), getDef(unit.defId).weapons[0], unit, null)).toBe(false);
  run(g, 1);
  expect(unit.defId).toBe('usgr-re-plahj8team');
  const saved = track(deserializeGame(serializeGame(g)));
  expect(assembly(saved)).toEqual(assembly(g));
  run(g, 1); run(saved, 1);
  expect(unit.defId).toBe('usgr-re-plahj8team-deployed');
  expect(assembly(saved)).toEqual(assembly(g));
  const foe = newEnt(g.st, 'usgr-re-bmp1p', 1, 19*TILE, 14*TILE);
  foe.holdFire = true; const hp = foe.hp;
  cmdAttack(g, [unit.id], foe.id);
  expect(stepUntil(g, () => foe.hp < hp || foe.dead, 900)).toBeGreaterThan(0);
  expect(assembly(g).members.rifleman).toBe(member.id);
  const start = unit.x;
  cmdMove(g, [unit.id], 17*TILE, 14*TILE);
  run(g, 1);
  expect(unit.defId).toBe('usgr-re-plahj8team-deployed');
  expect(unit.x).toBeCloseTo(start);
  run(g, 1.2);
  expect(unit.defId).toBe('usgr-re-plahj8team');
  expect(unit.x).toBeGreaterThan(start);
  expect(assembly(g).members.rifleman).toBe(member.id);
  const transport = newEnt(g.st, 'usgr-re-m2a3', 0, 20*TILE, 14*TILE);
  cmdBoard(g, [unit.id], transport.id);
  expect(unit.orders[0]).toEqual({ kind: 'board', targetId: transport.id });
  expect(stepUntil(g, () => unit.inside === transport.id, 30*30)).toBeGreaterThan(0);
  expect(member.inside).toBe(transport.id);
  expect(transport.cargo).toContain(unit.id);
  expect(transport.cargo).toContain(member.id);
  expect(assembly(g).members.rifleman).toBe(member.id);
  kill(g.st, unit); run(g, 1/30);
  expect(member.dead).toBeTruthy();
});

const AIR_TARGETS = ['usgr-re-ka52', 'usgr-re-f-2'];
const BATTERY_RADARS: Record<string, string> = { 'usgr-re-hawk-d51d6cc6': 'usgr-re-hawk-fdaa5cb6', 'usgr-re-iris-t-slm': 'usgr-re-iris-t-slm-radar' };
test('every available armed combat unit can damage a compatible target; unavailable loadouts cannot fire', () => {
  const failures: string[] = [];
  const recruited=new Set(mod.defs.flatMap(d=>getDef(d.id).produces??[]));let checked=0;
  // One fresh match per attempt: returns whether the shooter damaged the target.
  const attempt = (def: ReturnType<typeof getDef>, targetId?: string): boolean | 'unavailable' => {
    const g = arena();
    const shooter = newEnt(g.st, def.id, 0, 10*TILE, 15*TILE);
    if (def.id === 'usgr-re-plahj8team') run(g, 2.1);
    if (def.id === 'usgr-re-a10') {
      run(g, 5.1);
      expect(cmdContentAction(g, 'sensors-v1', { owner: 0, ids: [shooter.id], action: 'flight:low' })).toBe(true);
      run(g, .3);
    }
    // Source air-defence policy: some radars start OFF and split launchers fire only
    // through a deployed battery with its own radar on. Set both up as a player would.
    const sensors=def.extensions?.['sensors-v1'] as any;
    const radarOn = (e: Ent) => { if ((getDef(e.defId).extensions?.['sensors-v1'] as any)?.radarControl?.initial === false) expect(cmdContentAction(g, 'sensors-v1', { owner: 0, ids: [e.id], action: 'radar:toggle' })).toBe(true); };
    radarOn(shooter);
    const battery = sensors?.radarBattery?.role === 'launcher';
    if (battery) {
      const provider = newEnt(g.st, BATTERY_RADARS[def.id], 0, 9*TILE, 15*TILE);
      expect(cmdContentAction(g, 'sensors-v1', { owner: 0, ids: [shooter.id], action: 'battery:deploy' })).toBe(true);
      radarOn(provider);
    }
    if (sensors?.radarControl || sensors?.radarBattery) run(g, .8);
    const art=def.extensions?.['articulation-v1'] as any;
    const available = def.weapons.filter(w => !(w.extensions?.['logistics-v1'] as any)?.disabled&&!art?.disabledWeapons?.includes(w.id));
    if (!available.length) {
      const logistics = contentRuntime(g)!.module('logistics-v1')!;
      for (const w of def.weapons) expect(art?.disabledWeapons?.includes(w.id)||logistics.canFire!(shooter, def, w, shooter, null)===false).toBe(true);
      return 'unavailable';
    }
    const ground = available.find(w => w.targets.includes('ground'));
    const weapon = ground ?? available[0];
    const distance = Math.max(1, Math.min(weapon.range*.6, 5));
    const requiresArmor = (weapon.extensions?.['usgr-re.targeting-v1'] as any)?.withTags?.some((tag: string) => ['装甲','轻装甲'].includes(tag));
    const target = newEnt(g.st, ground ? requiresArmor ? 'usgr-re-bmp1p' : 'engineer' : targetId!, 1, (10+distance)*TILE, 15*TILE);
    target.holdFire = true;
    const hp = target.hp;
    if (!ground) {
      // Every source aircraft carries finite decoys; spend them so this checks the
      // weapon's damage path rather than one countermeasure roll.
      run(g, 1/30);
      const sensorsModule = contentRuntime(g)!.module('sensors-v1')!, snap: any = structuredClone(sensorsModule.snapshot());
      for (const entry of snap.sourceOrdnance?.dispensers ?? []) if (entry[0] === target.id) entry[1].remaining = 0;
      sensorsModule.restore!(snap);
    }
    // A battery launcher never acquires: it fires only on what its radar forwards.
    if (!battery) cmdAttack(g, [shooter.id], target.id);
    const ticks = Math.min(3600, Math.ceil((weapon.reload+30)*30));
    return stepUntil(g, () => target.hp < hp || target.dead, ticks) >= 0;
  };
  for (const d of mod.defs) {
    const def = getDef(d.id);
    if (def.kind !== 'unit' || !def.weapons.length || !recruited.has(def.id)) continue;
    checked++;
    const art=def.extensions?.['articulation-v1'] as any;
    const available = def.weapons.filter(w => !(w.extensions?.['logistics-v1'] as any)?.disabled&&!art?.disabledWeapons?.includes(w.id));
    if (!available.length || available.some(w => w.targets.includes('ground'))) { if (attempt(def) === false) failures.push(def.id); continue; }
    // Air-only: each air target its source tag restrictions admit (most SAMs exclude HELI/低空), until one is hit.
    const admissible = AIR_TARGETS.filter(id => available.some(w => sourceTargetAllowed(w.extensions?.['usgr-re.targeting-v1'] as any, ((getDef(id).extensions?.['usgr-re.targeting-v1'] as any)?.tags ?? []))));
    if (!admissible.length) failures.push(def.id + ' (no admissible air target)');
    else if (!admissible.some(id => attempt(def, id) === true)) failures.push(def.id);
  }
  expect(checked).toBeGreaterThan(200);
  expect(failures).toEqual([]);
});

test('pack unload removes factions; unsupported systems have no fake rules', () => {
  expect(availableFactions()).toHaveLength(8);
  for (const def of mod.defs) {
    if (!def.id.startsWith('usgr-re-plahj8team')) expect(def.rules ?? []).toHaveLength(0);
    for (const w of getDef(def.id).weapons) expect(w.ammo).toBeUndefined();
  }
  applyMods([]);
  expect(availableFactions()).toHaveLength(1);
});

test('missile payload slots do not become passenger seats', () => {
  expect(getDef('usgr-re-a10').transportCap ?? 0).toBe(0);
  expect(getDef('usgr-re-m2a3').transportCap).toBeGreaterThan(0);
});

test('the imported pack activates its declared modules and unload restores the native match', () => {
  expect(mod.v).toBe(4);
  expect(mod.requiredCapabilities!.length).toBeGreaterThan(0);
  const g = arena();
  expect(contentRuntime(g)!.modules.map(m => m.id).sort()).toEqual([...mod.requiredCapabilities!].sort());
  applyMods([]);
  expect(contentRuntime(arena())).toBeUndefined();
});

test('source infantry magazine empties, waits its real reload and survives save/load', () => {
  const g = arena();
  const shooter = newEnt(g.st, 'usgr-re-rusgud', 0, 10*TILE, 10*TILE);
  const target = newEnt(g.st, 'engineer', 1, 12*TILE, 10*TILE);
  target.hp = 100000;
  const stock = (getDef(shooter.defId).extensions!['logistics-v1'] as any).stocks[0];
  const read = (game: Game) => (contentRuntime(game)!.snapshot()['logistics-v1'] as any)[shooter.id];
  cmdAttack(g, [shooter.id], target.id);
  expect(stepUntil(g, () => read(g)?.stocks[stock.id] === 0, 30*20)).toBeGreaterThan(0);
  expect(target.hp).toBeLessThan(100000);
  shooter.holdFire = true;
  run(g, 1);
  expect(read(g).stocks[stock.id]).toBe(0);
  const saved = track(deserializeGame(serializeGame(g)));
  expect(read(saved)).toEqual(read(g));
  run(g, stock.refillAfter - 1 - 1/30);
  run(saved, stock.refillAfter - 1 - 1/30);
  expect(read(g).stocks[stock.id]).toBe(0);
  run(g, 1/30); run(saved, 1/30);
  expect(read(g).stocks[stock.id]).toBe(stock.capacity);
  expect(read(saved)).toEqual(read(g));
});

test('the actual T-90M station and main gun traverse separately and retain their bearings in a save', () => {
  const g = arena();
  const tank = newEnt(g.st, 'usgr-re-t90m', 0, 10*TILE, 10*TILE);
  const target = newEnt(g.st, 'engineer', 1, 10*TILE, 7*TILE);
  tank.holdPos = true; tank.angle = 0;
  target.hp = 100000;
  cmdAttack(g, [tank.id], target.id);
  run(g, .3);
  const read = (game: Game) => (contentRuntime(game)!.snapshot()['articulation-v1'] as any[]).find(([id]) => id === tank.id)[1];
  const state = read(g);
  expect(Object.keys(state.mounts).sort()).toEqual(['mount-main', 'mount-nsvt']);
  expect(Math.abs(state.mounts['mount-main'].angle - state.mounts['mount-nsvt'].angle)).toBeGreaterThan(.1);
  const saved = track(deserializeGame(serializeGame(g)));
  expect(read(saved)).toEqual(state);
  const mobile = getDef('usgr-re-plahj8team'), deployed = getDef('usgr-re-plahj8team-deployed');
  expect(deployed.turretSprite).not.toBe(mobile.turretSprite);
});


test('T-90M shares its main reload and resupplies while its weapon keeps firing', () => {
  const g = arena();
  const tank = newEnt(g.st, 'usgr-re-t90m', 0, 12*TILE, 12*TILE);
  const depot = newEnt(g.st, 'usgr-re-supply-depot', 0, 10*TILE, 12*TILE);
  const foe = newEnt(g.st, 'engineer', 1, 18*TILE, 12*TILE);
  foe.hp = 100000; foe.holdFire = true; tank.holdPos = true;
  const read = () => (contentRuntime(g)!.snapshot()['logistics-v1'] as any)[tank.id];
  cmdAttack(g, [tank.id], foe.id);
  expect(stepUntil(g, () => read()?.stocks['shell-ap'] === 19, 600)).toBeGreaterThan(0);
  const remaining = read().feeds['main-gun'].remaining;
  expect(cmdContentAction(g, 'logistics-v1', {owner:0, ids:[tank.id], action:'ammunition', choice:'main-gun/w4'})).toBe(true);
  expect(read().feeds['main-gun'].remaining).toBeGreaterThanOrEqual(remaining);
  expect(cmdContentAction(g, 'logistics-v1', {owner:0, ids:[tank.id], action:'ammunition', choice:'main-gun/w1'})).toBe(true);
  expect(cmdContentAction(g, 'logistics-v1', {owner:0, ids:[tank.id], action:'supply', choice:'tank-resupply',targetId:depot.id})).toBe(true);
  const x = tank.x, y = tank.y;
  cmdMove(g, [tank.id], 16*TILE, 12*TILE);
  run(g, 8);
  expect(tank.x).toBeCloseTo(x); expect(tank.y).toBeCloseTo(y);
  expect(read().stocks['shell-ap']).toBeLessThan(19);
  expect(read().service.progress).toBeCloseTo(8);
  const restored = track(deserializeGame(serializeGame(g)));
  run(g, 2); run(restored, 2);
  expect(read().stocks['shell-ap']).toBe(20);
  expect(read().service).toBeUndefined();
  expect((contentRuntime(restored)!.snapshot()['logistics-v1'] as any)[tank.id]).toEqual(read());
  run(g, .5);
  expect(tank.x).toBeGreaterThan(x);
});

// A fractional imported sight radius used to make integer terrain rays loop forever.
// Assert normalization before calling updateFog so a regression fails without hanging Bun.
test('entire actual roster runs and restores with fog, including fractional T-90M source sight', () => {
  expect(JSON.parse(raw).defs.find((d: {id:string}) => d.id === 'usgr-re-btr82a').vision).toBe(6);
  expect(getDef('usgr-re-btr82a').vision).toBe(6);
  expect(JSON.parse(raw).defs.find((d: {id:string}) => d.id === 'usgr-re-t90m').vision).toBe(3.75);
  expect(getDef('usgr-re-t90m').vision).toBe(4);
  for (const def of mod.defs) expect(Number.isInteger(getDef(def.id).vision)).toBe(true);
  const g = arena({ fog:true, dayNight:false });
  mod.defs.forEach((def, index) => {
    const e = newEnt(g.st, def.id, 0, (12 + index % 8) * TILE, (12 + Math.floor(index / 8)) * TILE);
    e.holdFire = true; e.holdPos = true;
  });
  g.hash.rebuild(g.st); g.updateFog(); run(g, 1);
  expect(g.st.fog[0].some(tile => tile === FogState.Visible)).toBe(true);
  const restored = track(deserializeGame(serializeGame(g)));
  expect(restored.st.cfg.fog).toBe(true);
  restored.updateFog(); run(restored, 1);
  expect(restored.st.fog[0].some(tile => tile === FogState.Visible)).toBe(true);
});


test('source recovery seeks immobilized armor, keeps it exposed and survives save/death without replacing it', () => {
  const g = arena();
  const tractor = newEnt(g.st, 'usgr-re-brem-1', 0, 12*TILE, 12*TILE);
  const tank = newEnt(g.st, 'usgr-re-t90m', 0, 14*TILE, 12*TILE);
  const soldier = newEnt(g.st, 'usgr-re-plainf', 0, 12*TILE, 14*TILE);
  tractor.holdFire = tank.holdFire = true;
  run(g, 1/30);
  const c = contentRuntime(g)!.module('components-v1')!;
  const a = contentRuntime(g)!.module('articulation-v1')!;
  expect(cmdContentAction(g, 'articulation-v1', { owner: 0, ids: [tractor.id], action: 'tow' })).toBe(false);
  cmdBoard(g, [soldier.id], tractor.id);
  expect(soldier.orders).toHaveLength(0);
  const snap = c.snapshot() as any;
  snap.entities[tank.id].parts.track = { damage: 130, failed: true };
  c.restore(snap);
  expect(cmdContentAction(g, 'articulation-v1', { owner: 0, ids: [tractor.id], action: 'tow' })).toBe(true);
  expect(stepUntil(g, () => (a.render!(tractor) as any)?.towing === tank.id, 180)).toBeGreaterThan(0);
  run(g, 1/30);
  expect(tank.inside).toBeUndefined();
  expect(tractor.cargo ?? []).toHaveLength(0);
  expect((a.render!(tractor) as any).towing).toBe(tank.id);
  const at = getDef(tractor.defId).extensions!['articulation-v1'] as any;
  const offset = at.tow.sourceAttachment;
  expect(tank.x).toBeCloseTo(tractor.x + offset.x*Math.cos(tractor.angle+Math.PI/2)-offset.y*Math.sin(tractor.angle+Math.PI/2));
  expect(tank.y).toBeCloseTo(tractor.y + offset.x*Math.sin(tractor.angle+Math.PI/2)+offset.y*Math.cos(tractor.angle+Math.PI/2));
  expect(a.canFire!(tank, getDef(tank.defId), getDef(tank.defId).weapons[0], tank, null)).toBe(false);
  const saved = track(deserializeGame(serializeGame(g)));
  expect(contentRuntime(saved)!.module('articulation-v1')!.snapshot()).toEqual(a.snapshot());
  const hp = tank.hp;
  kill(g.st, tractor); run(g, 1/30);
  expect(tank.dead).toBeFalsy(); expect(tank.hp).toBe(hp);
  const restoredTank = saved.st.ents.get(tank.id)!;
  cmdMove(saved, [tank.id], 20*TILE, 12*TILE); run(saved, 1/30);
  expect((contentRuntime(saved)!.module('articulation-v1')!.render!(saved.st.ents.get(tractor.id)!) as any)?.towing).toBeUndefined();
  expect(restoredTank.id).toBe(tank.id);
});
