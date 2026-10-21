#!/usr/bin/env node
// Validate the shipped layouts independently through the native map reader.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseCustomMap, customMapToGameMap } from '../../tools/steel-tide-map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mods = resolve(here, '..');
const report = JSON.parse(readFileSync(resolve(here, 'map-port-report.json'), 'utf8'));
const sources = readdirSync(resolve(here, '../../rusted-warfare-mods/adolence/maps')).filter(f => f.endsWith('.tmx')).sort();
assert.deepEqual(report.map(r => r.source).sort(), sources, 'every source TMX must be ported exactly once');
const ground = new Set([2, 3, 6, 7, 8, 9, 10, 17, 18, 19]);
const foundation = new Set([2, 3, 6, 9]);
let seats = 0;
for (const pack of ['adolence', 'adolence-maps']) {
  const manifest = JSON.parse(readFileSync(resolve(mods, pack, 'mod.json'), 'utf8'));
  assert.equal(manifest.maps.length, 8, `${pack}: expected eight registered maps`);
  const expected = report.filter(r => r.pack === pack).map(r => `maps/${r.map}`);
  if (pack === 'adolence') expected.unshift('maps/city-of-sin.steel-tide-map');
  assert.deepEqual(manifest.maps, expected, `${pack}: unregistered port`);
}
for (const row of report) {
  const source = readFileSync(resolve(here, '../../rusted-warfare-mods/adolence/maps', row.source));
  assert.equal(createHash('sha256').update(source).digest('hex'), row.sourceSha256, `${row.source}: regenerate after a source change`);
  const raw = readFileSync(resolve(mods, row.pack, 'maps', row.map), 'utf8');
  assert(Buffer.byteLength(raw) <= 512 * 1024, `${row.map}: asset budget`);
  const parsed = parseCustomMap(raw);
  assert(parsed.ok, `${row.map}: ${parsed.error}`);
  const map = customMapToGameMap(parsed.data);
  assert.deepEqual([map.w, map.h], row.size);
  assert(map.w <= 512 && map.h <= 512);
  assert.equal(map.spawns.length, row.sourceTeams.length ? Math.min(8, row.sourceTeams.length) : 2);
  assert.equal(map.deposits.length, row.sourceDeposits + row.addedDeposits, `${row.map}: a resource was lost`);
  assert.equal(row.omittedDeposits, 0);
  const tile = (x, y) => map.overlays?.[y * map.w + x] || map.terrain[y * map.w + x];
  for (const spawn of map.spawns) {
    // Enough foundation for either Adolence HQ and its two builders.
    for (let y = spawn.y - 4; y <= spawn.y + 4; y++) for (let x = spawn.x - 4; x <= spawn.x + 4; x++) {
      assert(x >= 0 && y >= 0 && x < map.w && y < map.h && foundation.has(tile(x, y)), `${row.map}: obstructed starting area`);
    }
  }
  let landDeposits = 0;
  for (const p of map.deposits) {
    const tiles = [tile(p.x,p.y), tile(p.x+1,p.y), tile(p.x,p.y+1), tile(p.x+1,p.y+1)];
    const land = tiles.every(t => foundation.has(t));
    assert(land || tiles.every(t => t === 1), `${row.map}: no extractor/platform foundation`);
    landDeposits += Number(land);
  }
  const start = map.spawns[0].y * map.w + map.spawns[0].x;
  const seen = new Uint8Array(map.w * map.h), queue = [start];
  seen[start] = 1;
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i], x = at % map.w, y = Math.floor(at / map.w);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      const to = ny * map.w + nx;
      if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && !seen[to] && ground.has(tile(nx,ny))) {
        seen[to] = 1;
        queue.push(to);
      }
    }
  }
  assert(map.spawns.every(s => seen[s.y * map.w + s.x]), `${row.map}: disconnected starting teams`);
  seats += map.spawns.length;
  console.log(`✓ ${row.map}: ${map.spawns.length} seats, ${landDeposits} land / ${map.deposits.length-landDeposits} sea deposits`);
}
console.log(`Verified ${report.length} original maps and ${seats} starting seats.`);
