import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { exampleFull, parseModCatalog, parseModDetail, parseModIndex } from '../tools/steel-tide-mod.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the generator publishes summaries, matching details and a compatible legacy index together', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'steel-mod-catalog-'));
  try {
    mkdirSync(join(fixture, 'tools'));
    for (const file of ['build-index.mjs', 'registry-folders.mjs', 'steel-tide-mod.mjs']) copyFileSync(join(root, 'tools', file), join(fixture, 'tools', file));
    execFileSync('git', ['init', '-q'], { cwd: fixture });
    writeFileSync(join(fixture, '.gitignore'), '/mods/unfinished/\n');
    mkdirSync(join(fixture, 'mods', 'unfinished'), { recursive: true });
    const mod = exampleFull();
    writeFileSync(join(fixture, 'mods', 'unfinished', 'mod.json'), JSON.stringify(mod).replaceAll('ironworks', 'unfinished'));
    const folder = join(fixture, 'mods', mod.id);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'mod.json'), JSON.stringify(mod));
    const png = Buffer.alloc(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    png.writeUInt32BE(1600, 16);
    png.writeUInt32BE(1200, 20);
    for (const file of [...mod.sprites.map((s) => s.file), ...mod.screenshots]) {
      mkdirSync(dirname(join(folder, file)), { recursive: true });
      writeFileSync(join(folder, file), png);
    }
    mkdirSync(join(fixture, 'details'));
    writeFileSync(join(fixture, 'details', 'removed-mod.json'), '{}');
    const countsFile = join(fixture, 'counts.json');
    const build = (count) => {
      writeFileSync(countsFile, JSON.stringify({ [mod.id]: count }));
      execFileSync(process.execPath, [join(fixture, 'tools', 'build-index.mjs'), '--counts', countsFile], { cwd: fixture, stdio: 'pipe' });
    };
    build(12);
    const raw = readFileSync(join(fixture, 'catalog.json'), 'utf8');
    const catalog = parseModCatalog(raw);
    assert.equal(catalog.mods.length, 1);
    const summary = catalog.mods[0];
    assert.equal(summary.units, 1);
    assert.equal(summary.buildings, 2);
    assert.equal(summary.downloads, 12);
    assert.match(summary.details, /^https:\/\/raw\.githubusercontent\.com\/steel-tide\/mods\/main\/details\/ironworks\/[a-f0-9]{16}\.json$/);
    const detailPath = join(fixture, new URL(summary.details).pathname.replace('/steel-tide/mods/main/', ''));
    for (const field of ['defs', 'sprites', 'sounds']) assert.equal(Object.hasOwn(JSON.parse(raw).mods[0], field), false);
    const detailRaw = readFileSync(detailPath, 'utf8');
    const detail = parseModDetail(detailRaw, summary);
    assert.equal(detail.defs.length, 3);
    assert.equal(detail.sprites.length, 2);
    assert.equal(detail.screenshots[0].w, 1600);
    const legacy = parseModIndex(readFileSync(join(fixture, 'index.json'), 'utf8'));
    assert.deepEqual(legacy.mods[0].defs, detail.defs);
    assert.equal(legacy.generated, catalog.generated);
    assert.deepEqual(readdirSync(join(fixture, 'details')), ['ironworks']);
    build(23);
    assert.equal(parseModCatalog(readFileSync(join(fixture, 'catalog.json'), 'utf8')).mods[0].downloads, 23);
    assert.equal(readFileSync(detailPath, 'utf8'), detailRaw);
    assert.equal(readdirSync(join(fixture, 'details', 'ironworks')).length, 1);
    mod.version = '2.0.0';
    writeFileSync(join(folder, 'mod.json'), JSON.stringify(mod));
    build(23);
    const updated = parseModCatalog(readFileSync(join(fixture, 'catalog.json'), 'utf8')).mods[0];
    assert.notEqual(updated.details, summary.details);
    assert.equal(readFileSync(detailPath, 'utf8'), detailRaw);
    assert.ok(parseModDetail(detailRaw, summary));
    assert.equal(readdirSync(join(fixture, 'details', 'ironworks')).length, 2);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
