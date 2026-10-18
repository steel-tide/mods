#!/usr/bin/env node
/**
 * Pack a mod folder into the single-file form the game's "Upload file…"
 * takes — mod.json with sheets, sounds, music and maps embedded as data URLs:
 *
 *   node tools/pack.mjs mods/my-mod [out.steel-tide-mod]
 *
 * Handy for sharing a mod that is not (yet) in the registry. The registry
 * itself packs every mod this way onto its `registry` release
 * (tools/sync-release.mjs), which is where the download counts come from.
 * The screenshots stay out of the file: they are for the pages, not the game.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM_MAP_EXT, MOD_FILE_EXT, parseMod } from './steel-tide-mod.mjs';
import { prepareContentSchema } from './steel-tide-mod.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };

/** the packed file's text for a mod folder, or an error message; deterministic for the same folder, so a hash of it says whether the mod changed */
export async function packMod(folder) {
  const raw=readFileSync(join(folder,'mod.json'),'utf8');
  await prepareContentSchema(raw,true);
  const parsed = parseMod(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const files = {};
  const assets = [...(parsed.mod.sprites ?? []), ...(parsed.mod.sounds ?? []), ...(parsed.mod.music?.tracks ?? [])].map(({ file }) => file);
  assets.push(...(parsed.mod.extensionPackages ?? []).flatMap(pkg => Object.values(pkg.assets ?? {})));
  for (const file of new Set([...assets, ...(parsed.mod.maps ?? [])])) {
    const bytes = readFileSync(join(folder, file));
    const mime = file.endsWith(CUSTOM_MAP_EXT) ? 'application/json' : MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    files[file] = `data:${mime};base64,${bytes.toString('base64')}`;
  }
  // the screenshots are the pages' business, not the game's: neither the files nor their names travel
  const { screenshots: _shots, ...mod } = parsed.mod;
  return { ok: true, mod: parsed.mod, text: JSON.stringify({ ...mod, files }, null, 2) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [folderArg, outArg] = process.argv.slice(2);
  if (!folderArg) {
    console.error('usage: node tools/pack.mjs mods/<id> [out]');
    process.exit(2);
  }
  const folder = resolve(folderArg);
  const packed = await packMod(folder);
  if (!packed.ok) {
    for (const e of packed.errors) console.error(`✗ ${e.path}: ${e.message}`);
    process.exit(1);
  }
  const out = outArg ? resolve(outArg) : resolve(here, '..', 'dist', `${basename(folder)}${MOD_FILE_EXT}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, packed.text);
  console.log(`wrote ${out}`);
}
