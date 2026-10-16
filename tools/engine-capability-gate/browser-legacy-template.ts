__FACTORY_IMPORT__
import { arena, conquest } from '__ROOT__/game/core/server/testkit/game.ts';
import { newEnt } from '__ROOT__/game/core/src/game/state.ts';
import { cmdHold, cmdMove } from '__ROOT__/game/core/src/game/orders.ts';
import { serializeGame, deserializeGame, collectNewEffects } from '__ROOT__/game/core/src/game/save.ts';
import { buildTeamView, encodeFullFrame, encodeFrame, RecMemo, rememberSent, stringifyFrame, ViewCache, viewKey } from '__ROOT__/game/core/src/net/frames.ts';
const byteLength = (s: string) => new TextEncoder().encode(s).byteLength;
const fnv1a32 = () => { let h = 2166136261; const hash = { update(s: string) { for(let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h=Math.imul(h,16777619); } return hash; }, digest(_: string) {return (h>>>0).toString(16);} }; return hash; };

(globalThis as any).runBenchmark = (workload: string, warmup = 900, measured = 3600) => {
const startHeap = (performance.memory ? {heapUsed:performance.memory.usedJSHeapSize} : {});
const startupAt = performance.now();
const game = workload === 'battle'
  ? conquest('random-l', { seed: 42, fog: true, multiplayer: true, popCap: 5000, metal: 5000,
      players: Array.from({ length: 4 }, (_, team) => ({ isHuman: false, team, difficulty: 'veteran' })) })
  : arena({ mode: 'campaign', w: 270, h: 270, dayNight: false, fog: true, multiplayer: true, metal: 0, popCap: 5000, seed: 42 });
const startupMs = performance.now() - startupAt;
__BIND_CODEC__
const lists: number[][] = game.st.players.map(() => []);
if (workload === 'battle') {
  for (let owner = 0; owner < 4; owner++) {
    const spawn = game.st.map.spawns[owner];
    for (let i = 0; i < 198; i++) lists[owner].push(newEnt(game.st, ['buggy', 'ltank', 'flak', 'arty'][i % 4], owner,
      (spawn.x + (i % 18 - 9) * 0.55) * 32, (spawn.y + (Math.floor(i / 18) - 5) * 0.55) * 32).id);
    cmdMove(game, lists[owner], game.st.map.w * 16, game.st.map.h * 16, false, true);
  }
} else {
  const pairs = workload === 'idle' ? 128 : 500;
  for (let i = 0; i < pairs; i++) for (let owner = 0; owner < 2; owner++) {
    const kind = workload === 'projectiles' ? (i % 2 ? 'arty' : 'flak') : 'ltank';
    const unit = newEnt(game.st, kind, owner, (5 + i % 25 * 10 + owner * (workload === 'idle' ? 7 : 3.5)) * 32,
      (5 + Math.floor(i / 25) * 10) * 32, owner ? Math.PI : 0);
    unit.hp = 1e8;
    lists[owner].push(unit.id);
  }
  for (const ids of lists) cmdHold(game, ids);
}
for (let tick = 0; tick < warmup; tick++) game.step();
const join = serializeGame(game, 0, true);
const clients = game.st.players.map((_: unknown, viewer: number) => ({ viewer, cache: new ViewCache(viewKey(game, viewer, 'none')), seq: 0 }));
for (const client of clients) encodeFullFrame(game, client.viewer, 'none', ++client.seq, client.cache);
const sent = new WeakMap(), seen = new WeakSet(), born: unknown[] = [];
const sim: number[] = [], replication: number[] = [];
const wireDigest = fnv1a32();
let wireBytes = 0, maxProjectiles = 0;
for (let tick = 0; tick < measured; tick++) {
  const start = performance.now();
  game.step();
  sim.push(performance.now() - start);
  maxProjectiles = Math.max(maxProjectiles, game.st.projs.length);
  collectNewEffects(game.st, seen, born);
  if (tick % 3 === 0) {
    const at = performance.now(), memo = new RecMemo(), texts: string[] = [];
    for (const client of clients) {
      const view = buildTeamView(game, client.viewer, 'none', born, sent, memo);
      const frame = encodeFrame(view, client.cache, ++client.seq, game.st.tick, game.st.time);
      texts.push(stringifyFrame(frame, memo));
    }
    rememberSent(game.st, sent); born.length = 0;
    replication.push(performance.now() - at);
    for (const text of texts) { wireBytes += byteLength(text); wireDigest.update(text); }
  }
}
const snapshot = serializeGame(game);
const digest = fnv1a32().update(snapshot).digest('hex');
const saveTimes: number[] = [], loadTimes: number[] = [];
for (let i = 0; i < 48; i++) {
  const a = performance.now(); serializeGame(game); saveTimes.push(performance.now() - a);
  const b = performance.now(); deserializeGame(snapshot); loadTimes.push(performance.now() - b);
}
const stats = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { mean: values.reduce((a, b) => a + b, 0) / values.length, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)] };
};
const sampledHeap = performance.memory?.usedJSHeapSize;
return { workload, startupMs, runtime: navigator.userAgent, warmup, measured, entities: game.st.ents.size,
  maxProjectiles, digest, wireDigest: wireDigest.digest('hex'), snapshotBytes: byteLength(snapshot), joinBytes: byteLength(join), wireBytes,
  entKeys: Object.keys(game.st.ents.values().next().value), gameKeys: Object.keys(game), stateKeys: Object.keys(game.st),
  sim: stats(sim), replication: stats(replication), save: stats(saveTimes), load: stats(loadTimes), hashAlgorithm: 'FNV-1a32', startHeap, sampledHeap };

};
