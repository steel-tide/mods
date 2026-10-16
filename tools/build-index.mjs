#!/usr/bin/env node
/**
 * Write catalog.json for the list, details/<id>/<hash>.json for each mod's page,
 * and the full index.json for released clients. The catalogue carries
 * counts instead of rosters and asset tables. Run by
 * CI on every push to main and nightly (for the counts); run it yourself to
 * see what the entry for your mod will look like.
 *
 *   node tools/build-index.mjs [--counts <file>]
 *
 * `--counts` is the file tools/sync-release.mjs writes: the download count
 * per mod id, from the release the packed mods are attached to. Without it,
 * the counts already in index.json are kept.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMods, imageSize, indexEntryFor, modRegistryBase, modSummaryFor, parseCustomMap, parseMod, parseModIndex } from './steel-tide-mod.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const countsFile = args.includes('--counts') ? resolve(args[args.indexOf('--counts') + 1]) : null;

function lastChange(path) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', path], { cwd: root, encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
}

// the counts: the sync's file, else what the last index said
let counts = {};
if (countsFile && existsSync(countsFile)) counts = JSON.parse(readFileSync(countsFile, 'utf8'));
else if (existsSync(join(root, 'index.json'))) {
  const last = parseModIndex(readFileSync(join(root, 'index.json'), 'utf8'));
  for (const m of last?.mods ?? []) if (m.downloads !== undefined) counts[m.id] = m.downloads;
}

const mods = [];
for (const name of readdirSync(join(root, 'mods')).sort()) {
  const folder = join(root, 'mods', name);
  if (!statSync(folder).isDirectory() || !existsSync(join(folder, 'mod.json'))) continue;
  const parsed = parseMod(readFileSync(join(folder, 'mod.json'), 'utf8'));
  if (!parsed.ok || parsed.mod.id !== name) {
    console.warn(`skipping mods/${name}: ${parsed.ok ? 'id does not match the folder' : 'does not validate'}`);
    continue;
  }
  // every picture's size, sheets and screenshots alike, by the path the manifest names
  const sizes = {};
  for (const file of [...(parsed.mod.sprites ?? []).map((s) => s.file), ...(parsed.mod.screenshots ?? [])]) {
    const path = join(folder, file);
    if (!existsSync(path)) continue;
    const size = imageSize(readFileSync(path));
    if (size) sizes[file] = size;
  }
  // the maps it carries, read with the mod's own pieces in the table: a name, a size and the seats, for the pages to list
  const maps = [];
  if (parsed.mod.maps?.length) {
    applyMods([parsed.mod]);
    for (const file of parsed.mod.maps) {
      const path = join(folder, file);
      if (!existsSync(path)) continue;
      const map = parseCustomMap(readFileSync(path, 'utf8'));
      if (map.ok) maps.push({ file, name: map.data.name, w: map.data.w, h: map.data.h, spawns: map.data.spawns.length });
    }
    applyMods([]);
  }
  mods.push(indexEntryFor(parsed.mod, `mods/${name}`, modRegistryBase(name), { sizes, updated: lastChange(`mods/${name}`), downloads: counts[name] ?? 0, ...(maps.length ? { maps } : {}) }));
}

const generated = new Date().toISOString();
const detailDir = join(root, 'details');
mkdirSync(detailDir, { recursive: true });
const summaries = mods.map((entry) => {
  // Counts change nightly; keep that churn in the catalogue and legacy index.
  const { downloads: _downloads, updated: _updated, ...detail } = entry;
  const json = JSON.stringify(detail) + '\n';
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  const folder = join(detailDir, entry.id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, `${hash}.json`), json);
  const url = new URL(`../../details/${entry.id}/${hash}.json`, modRegistryBase(entry.id)).href;
  return modSummaryFor(entry, url);
});
// Retain earlier detail documents while a cached catalogue may still name them.
// Removing a mod removes its generated documents as well.
const ids = new Set(mods.map((entry) => entry.id));
for (const name of readdirSync(detailDir)) {
  if (!ids.has(name)) rmSync(join(detailDir, name), { recursive: true, force: true });
}
const catalog = { format: 'steel-tide-mod-catalog', v: 1, generated, mods: summaries };
writeFileSync(join(root, 'catalog.json'), JSON.stringify(catalog) + '\n');
const index = { format: 'steel-tide-mod-index', v: 1, generated, mods };
writeFileSync(join(root, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`catalog.json + details/ + legacy index.json: ${mods.length} mod${mods.length === 1 ? '' : 's'}`);
