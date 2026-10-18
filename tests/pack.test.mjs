import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { packMod } from '../tools/pack.mjs';
import { applyMods, parseCustomMap, parseMod } from '../tools/steel-tide-mod.mjs';

test('a packed Cyberpunk mod includes its maps, music, sheets and sounds for offline use', async () => {
  const folder = new URL('../mods/cyberpunk/', import.meta.url);
  const packed = await packMod(fileURLToPath(folder));
  assert.equal(packed.ok, true);
  const parsed = parseMod(packed.text);
  assert.equal(parsed.ok, true);
  const mod = parsed.mod;
  assert.ok(mod.music.tracks.length > 0);
  assert.ok(mod.maps.length > 0);
  const assets = [...mod.sprites, ...mod.sounds, ...mod.music.tracks].map(({ file }) => file);
  for (const file of [...assets, ...mod.maps]) {
    assert.ok(mod.files[file], `${file} is embedded`);
    assert.deepEqual(Buffer.from(mod.files[file].split(',')[1], 'base64'), readFileSync(new URL(file, folder)));
  }
  assert.equal(mod.screenshots, undefined);
  assert.equal(Object.keys(mod.files).some(file => file.startsWith('screenshots/')), false);
  try {
    assert.deepEqual(applyMods([mod]).rejected, []);
    for (const file of mod.maps) {
      const text = Buffer.from(mod.files[file].split(',')[1], 'base64').toString('utf8');
      assert.equal(parseCustomMap(text).ok, true, `${file} loads with the packed mod`);
    }
  } finally {
    applyMods([]);
  }
});


test('large capacity exports a full catalog and validates the encoded asset budget', async () => {
  const root = mkdtempSync(join(tmpdir(), 'steel-large-pack-'));
  const folder = join(root, 'capacity-test');
  mkdirSync(folder);
  try {
    const raw = { format: 'steel-tide-mod', v: 4, id: 'capacity-test', name: 'Capacity test', version: '1.0.0',
      defs: [{ id: 'capacity-unit', name: 'Unit', extends: 'mbt' }],
      sounds: [{ key: 'capacity-test-recording', file: 'recording.wav' }] };
    const data = Buffer.alloc(19 * 1024 * 1024);
    data.write('RIFF');
    writeFileSync(join(folder, 'recording.wav'), data);
    writeFileSync(join(folder, 'mod.json'), JSON.stringify(raw));
    const ordinary = await packMod(folder);
    assert.equal(ordinary.ok, false);
    assert.ok(ordinary.errors.some(issue => issue.path === 'files'));
    raw.capacity = 'large';
    raw.defs = Array.from({ length: 415 }, (_, i) => ({ id: `capacity-unit-${i}`, name: `Unit ${i}`, extends: 'mbt', hp: 23_000_000 }));
    writeFileSync(join(folder, 'mod.json'), JSON.stringify(raw));
    const packed = await packMod(folder);
    assert.equal(packed.ok, true);
    const read = parseMod(packed.text);
    assert.equal(read.ok, true);
    assert.equal(read.mod.defs.length, 415);
    assert.equal(read.mod.capacity, 'large');
    assert.deepEqual(Buffer.from(read.mod.files['recording.wav'].split(',')[1], 'base64'), data);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
