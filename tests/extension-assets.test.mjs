import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { packMod } from '../tools/pack.mjs';
import { parseMod } from '../tools/steel-tide-mod.mjs';

test('an unrelated extension carries its private resource bytes in the ordinary offline pack', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'extension-assets-'));
  const code = source => ({ source, sha256: createHash('sha256').update(source).digest('hex') });
  const pkg = { id: 'fixture.resources', version: '1.0.0', api: 1, capabilities: ['fixture.resources-v1'],
    assets: { clip: 'resources/clip.wav' },
    schema: code('export default function(){return {capabilities:[{id:"fixture.resources-v1",definition:v=>v}]}}'),
    runtime: code('export default function(){return {capabilities:[{id:"fixture.resources-v1",create(){return {id:"fixture.resources-v1",snapshot(){return {}},restore(){}}}}]}}') };
  const raw = { format: 'steel-tide-mod', v: 4, id: 'fixture-assets', name: ['Fixture', '测试', '시험'], version: '1',
    requiredCapabilities: ['fixture.resources-v1'], extensionPackages: [pkg],
    defs: [{ id: 'fixture-assets-tank', extends: 'mbt', name: ['Tank', '坦克', '전차'], extensions: { 'fixture.resources-v1': {} } }] };
  const bytes = Buffer.from('RIFFfixture private audio bytes');
  try {
    mkdirSync(join(folder, 'resources'));
    writeFileSync(join(folder, 'resources/clip.wav'), bytes);
    writeFileSync(join(folder, 'mod.json'), JSON.stringify(raw));
    const packed = await packMod(folder);
    assert.equal(packed.ok, true);
    assert.equal(parseMod(packed.text).ok, true);
    const data = JSON.parse(packed.text);
    assert.deepEqual(data.extensionPackages[0].assets, pkg.assets);
    assert.equal(data.files['resources/clip.wav'], `data:audio/wav;base64,${bytes.toString('base64')}`);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
