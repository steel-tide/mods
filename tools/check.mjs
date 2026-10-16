#!/usr/bin/env node
/**
 * Check one mod, or every mod in the registry:
 *
 *   node tools/check.mjs                 every folder under mods/
 *   node tools/check.mjs mods/my-mod     one folder (anywhere on disk)
 *
 * The same validation the game runs on load — every error with its path
 * into mod.json — plus what only the registry can know: the folder is named
 * after the mod's id, every sheet it names exists and is an image, it
 * carries at least one screenshot of itself in play (4:3, wide enough, not
 * too heavy: `checkScreenshot` in the game's own code), and no def id, alias
 * or sheet key is taken by another published mod. Exit code 1 on any error;
 * warnings are printed and do not fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_MOD_MAP_BYTES, applyMods, checkScreenshot, imageSize, parseCustomMap, menuCutMapError, parseMod } from './steel-tide-mod.mjs';
import { prepareContentSchema } from './steel-tide-mod.mjs';
import { registryModFolders } from './registry-folders.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const MAX_SHEET_BYTES = 4 * 1024 * 1024;

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const folders = args.length > 0
  ? args.map((a) => resolve(a))
  : registryModFolders(root);

let failed = false;
const loaded = [];

function isImage(bytes) {
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const webp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return png || jpg || webp;
}

function isAudio(bytes) {
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const mpeg = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
  const ogg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  return id3 || mpeg || riff || ogg;
}
const MAX_SOUND_BYTES = 1024 * 1024;

for (const folder of folders) {
  const label = `mods/${basename(folder)}`;
  const errors = [];
  const warnings = [];
  const manifestPath = join(folder, 'mod.json');
  if (!existsSync(manifestPath)) {
    console.error(`✗ ${label}: no mod.json`);
    failed = true;
    continue;
  }
  const raw=readFileSync(manifestPath,'utf8');
  await prepareContentSchema(raw,true);
  const parsed = parseMod(raw);
  warnings.push(...parsed.warnings);
  if (!parsed.ok) errors.push(...parsed.errors);
  else {
    const mod = parsed.mod;
    if (mod.id !== basename(folder)) errors.push({ path: 'mod.id', message: `is "${mod.id}" but the folder is "${basename(folder)}"` });
    if (mod.files) errors.push({ path: 'mod.files', message: 'the registry takes files beside mod.json, not embedded' });
    for (const [i, sheet] of (mod.sprites ?? []).entries()) {
      const file = join(folder, sheet.file);
      if (!existsSync(file)) { errors.push({ path: `sprites[${i}].file`, message: `${sheet.file} is missing` }); continue; }
      const bytes = readFileSync(file);
      if (!isImage(bytes)) errors.push({ path: `sprites[${i}].file`, message: `${sheet.file} is not a PNG, WebP or JPEG` });
      if (bytes.length > MAX_SHEET_BYTES) errors.push({ path: `sprites[${i}].file`, message: `${sheet.file} is ${(bytes.length / 1048576).toFixed(1)} MB; keep a sheet under 4` });
    }
    for (const [i, sound] of (mod.sounds ?? []).entries()) {
      const file = join(folder, sound.file);
      if (!existsSync(file)) { errors.push({ path: `sounds[${i}].file`, message: `${sound.file} is missing` }); continue; }
      const bytes = readFileSync(file);
      if (!isAudio(bytes)) errors.push({ path: `sounds[${i}].file`, message: `${sound.file} is not an MP3, WAV or OGG` });
      if (bytes.length > MAX_SOUND_BYTES) errors.push({ path: `sounds[${i}].file`, message: `${sound.file} is ${(bytes.length / 1024).toFixed(0)} KB; keep a one-shot under 1 MB` });
      if (/\.ogg$/i.test(sound.file)) warnings.push({ path: `sounds[${i}].file`, message: `${sound.file}: OGG does not play on Safari; MP3 plays everywhere` });
    }
    for (const [i, track] of (mod.music?.tracks ?? []).entries()) {
      const file = join(folder, track.file);
      if (!existsSync(file)) { errors.push({ path: `music.tracks[${i}].file`, message: `${track.file} is missing` }); continue; }
      if (!isAudio(readFileSync(file))) errors.push({ path: `music.tracks[${i}].file`, message: `${track.file} is not an MP3, WAV or OGG` });
    }
    // the pictures: the registry shows a mod by them, so a published mod has at least one
    const shots = mod.screenshots ?? [];
    if (shots.length === 0) errors.push({ path: 'mod.screenshots', message: 'a published mod carries at least one screenshot of itself in play (4:3, under screenshots/), named here' });
    for (const [i, file] of shots.entries()) {
      const path = join(folder, file);
      if (!existsSync(path)) { errors.push({ path: `screenshots[${i}]`, message: `${file} is missing` }); continue; }
      const bytes = readFileSync(path);
      const why = checkScreenshot(imageSize(bytes), bytes.length);
      if (why) errors.push({ path: `screenshots[${i}]`, message: `${file} ${why}` });
    }
    // the maps: read the way the game reads them, with this mod's own pieces in the table
    const maps = mod.maps ?? [];
    if (maps.length > 0) applyMods([mod]);
    for (const [i, file] of maps.entries()) {
      const path = join(folder, file);
      if (!existsSync(path)) { errors.push({ path: `maps[${i}]`, message: `${file} is missing` }); continue; }
      const text = readFileSync(path, 'utf8');
      if (Buffer.byteLength(text) > MAX_MOD_MAP_BYTES) { errors.push({ path: `maps[${i}]`, message: `${file} is ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB; keep a map under ${MAX_MOD_MAP_BYTES / 1024}` }); continue; }
      const map = parseCustomMap(text);
      if (!map.ok) errors.push({ path: `maps[${i}]`, message: `${file}: ${map.error}` });
      else if (map.data.spawns.length < 2) warnings.push({ path: `maps[${i}]`, message: `${file}: a map needs at least two spawn points to be played` });
      if (map.ok) for (const [k, cut] of (mod.menuBackground?.cuts ?? []).entries()) {
        if (cut.map !== file) continue;
        const issue = menuCutMapError(cut, map.data);
        if (issue) errors.push({ path: `menuBackground.cuts[${k}]`, message: issue });
      }
    }
    if (!existsSync(join(folder, 'README.md'))) warnings.push({ path: 'README.md', message: 'a README tells players what the mod is about' });
    loaded.push({ mod, label });
  }
  for (const e of errors) console.error(`  ✗ ${label} ${e.path}: ${e.message}`);
  for (const w of warnings) console.warn(`  ! ${label} ${w.path}: ${w.message}`);
  if (errors.length > 0) failed = true;
  else console.log(`✓ ${label} (${parsed.mod.defs.length} defs, ${(parsed.mod.sprites ?? []).length} sheets${(parsed.mod.sounds ?? []).length ? `, ${parsed.mod.sounds.length} sounds` : ''}${(parsed.mod.maps ?? []).length ? `, ${parsed.mod.maps.length} map${parsed.mod.maps.length === 1 ? '' : 's'}` : ''}, ${(parsed.mod.screenshots ?? []).length} screenshot${(parsed.mod.screenshots ?? []).length === 1 ? '' : 's'})`);
}

// what only the whole registry can tell: two mods claiming the same id, alias or sheet key
if (args.length > 0) {
  // a single folder is checked against everything already published
  const others = (await Promise.all(registryModFolders(root)
    .filter((d) => !folders.includes(d) && existsSync(join(d, 'mod.json')))
    .map(async(d) => {const raw=readFileSync(join(d,'mod.json'),'utf8'); await prepareContentSchema(raw,true);return parseMod(raw);})))
    .filter((p) => p.ok)
    .map((p) => ({ mod: p.mod, label: `mods/${p.mod.id}` }));
  loaded.unshift(...others);
}
const report = applyMods(loaded.map((l) => l.mod));
for (const r of report.rejected) {
  // the checked folders come last, so a clash is reported against the newcomer
  for (const e of r.errors) console.error(`  ✗ mods/${r.id} ${e.path}: ${e.message}`);
  failed = true;
}
const keys = new Map();
for (const { mod } of loaded) {
  for (const s of mod.sprites ?? []) {
    if (keys.has(s.key)) { console.error(`  ✗ mods/${mod.id}: sheet key "${s.key}" is also in mods/${keys.get(s.key)}`); failed = true; }
    keys.set(s.key, mod.id);
  }
}

if (failed) {
  console.error('\nsome mods have errors');
  process.exit(1);
}
console.log(`\n${loaded.length} mod${loaded.length === 1 ? '' : 's'} ok`);
