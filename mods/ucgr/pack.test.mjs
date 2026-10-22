import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { packMod } from '../../tools/pack.mjs';
import { parseMod } from '../../tools/steel-tide-mod.mjs';

test('UCGR carries its exact executable package inside the ordinary offline mod file', async () => {
  const folder = new URL('./', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('mod.json', folder), 'utf8'));
  const packed = await packMod(fileURLToPath(folder));
  assert.equal(packed.ok, true);
  const parsed = parseMod(packed.text);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mod.v, 4);
  assert.deepEqual(parsed.mod.extensionPackages, manifest.extensionPackages);
  assert.deepEqual(parsed.mod.requiredCapabilities, manifest.requiredCapabilities);
  const files = JSON.parse(packed.text).files;
  for (const file of Object.values(manifest.extensionPackages[0].assets ?? {})) {
    const expected = readFileSync(new URL(file, folder));
    const encoded = files[file];
    assert.ok(encoded?.startsWith('data:'));
    assert.deepEqual(Buffer.from(encoded.slice(encoded.indexOf(',') + 1), 'base64'), expected);
  }
});
