import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { packMod } from '../tools/pack.mjs';
import { applyMods, parseCustomMap, parseMod } from '../tools/steel-tide-mod.mjs';

test('a packed Cyberpunk mod includes its maps, music, sheets and sounds for offline use', () => {
  const folder = new URL('../mods/cyberpunk/', import.meta.url);
  const packed = packMod(fileURLToPath(folder));
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
