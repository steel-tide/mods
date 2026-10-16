#!/usr/bin/env node
/**
 * Keep the rolling `registry` release in step with mods/ — the download
 * counter that costs nothing, the way the map registry keeps its own: GitHub
 * counts downloads of a release asset, so every mod is packed into its
 * single-file form (tools/pack.mjs) and attached to one release as an asset,
 * the game fetches the asset URL when a player installs the mod from the
 * registry, and the count is read back off the release. The packed files are
 * also the one-file form of each mod for anyone who wants it, but the release
 * is never "latest" and its notes say what it is for.
 *
 *   node tools/sync-release.mjs --out .counts.json
 *
 * Needs `gh` signed in (CI's GITHUB_TOKEN). A mod new to the release is
 * uploaded; one whose packed file changed is replaced — GitHub cannot swap an
 * asset's bytes, and a re-upload starts the count over, so the old count is
 * carried in `counts.json`, an asset of the release's own, and added back.
 * A mod gone from mods/ has its asset removed. What is written to `--out`
 * is the count per mod id, which tools/build-index.mjs bakes into the index.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packMod } from './pack.mjs';
import { MOD_FILE_EXT, MOD_REGISTRY_RELEASE, MOD_REGISTRY_REPO } from './steel-tide-mod.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const modsDir = join(root, 'mods');
const args = process.argv.slice(2);
const outFile = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1]) : join(root, '.counts.json');
const COUNTS = 'counts.json';
const INDEX = 'index.json';
const CATALOG = 'catalog.json';

function gh(...argv) {
  return execFileSync('gh', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// the release, made if it is not there
let release;
try {
  release = JSON.parse(gh('api', `repos/${MOD_REGISTRY_REPO}/releases/tags/${MOD_REGISTRY_RELEASE}`));
} catch {
  console.log(`creating the ${MOD_REGISTRY_RELEASE} release`);
  gh('release', 'create', MOD_REGISTRY_RELEASE, '--repo', MOD_REGISTRY_REPO, '--title', 'Registry', '--latest=false',
    '--notes', `The mods of this registry packed into their single-file form (\`${MOD_FILE_EXT}\`, what the game's *Upload file…* takes) as release assets, so GitHub counts their downloads for the index. Not a release for people: install a mod from the game, under *Settings → Mods*, or from \`mods/\`.`);
  release = JSON.parse(gh('api', `repos/${MOD_REGISTRY_REPO}/releases/tags/${MOD_REGISTRY_RELEASE}`));
}
const assets = new Map(release.assets.map((a) => [a.name, a]));

// the carried counts and the hashes of what is up there
const work = mkdtempSync(join(tmpdir(), 'steel-tide-mods-'));
let carried = { carried: {}, sha: {} };
if (assets.has(COUNTS)) {
  gh('release', 'download', MOD_REGISTRY_RELEASE, '--repo', MOD_REGISTRY_REPO, '--pattern', COUNTS, '--dir', work, '--clobber');
  try {
    const read = JSON.parse(readFileSync(join(work, COUNTS), 'utf8'));
    if (read && typeof read === 'object') carried = { carried: read.carried ?? {}, sha: read.sha ?? {} };
  } catch {
    /* a counts file that does not read starts the carry over from nothing */
  }
}

const upload = (file) => gh('release', 'upload', MOD_REGISTRY_RELEASE, file, '--repo', MOD_REGISTRY_REPO, '--clobber');
const remove = (name) => gh('release', 'delete-asset', MOD_REGISTRY_RELEASE, name, '--repo', MOD_REGISTRY_REPO, '--yes');

const counts = {};
const ids = readdirSync(modsDir).filter((d) => statSync(join(modsDir, d)).isDirectory() && existsSync(join(modsDir, d, 'mod.json'))).sort();
const packedNames = new Set();
for (const id of ids) {
  const packed = packMod(join(modsDir, id));
  if (!packed.ok || packed.mod.id !== id) {
    console.warn(`skipping mods/${id}: ${packed.ok ? 'id does not match the folder' : 'does not validate'}`);
    continue;
  }
  const file = id + MOD_FILE_EXT;
  packedNames.add(file);
  const sha = createHash('sha256').update(packed.text).digest('hex');
  const asset = assets.get(file);
  const known = carried.sha[id];
  if (asset && (known === sha || known === undefined)) {
    // up there and unchanged (or from before hashes were kept: taken as is)
    counts[id] = (carried.carried[id] ?? 0) + asset.download_count;
  } else {
    if (asset) {
      // changed: the old asset's count goes into the carry before the asset goes
      carried.carried[id] = (carried.carried[id] ?? 0) + asset.download_count;
      console.log(`replacing ${file} (${asset.download_count} downloads carried)`);
      remove(file);
    } else {
      console.log(`uploading ${file}`);
    }
    const path = join(work, file);
    writeFileSync(path, packed.text);
    upload(path);
    counts[id] = carried.carried[id] ?? 0;
  }
  carried.sha[id] = sha;
  assets.delete(file);
}
// whatever is still on the release and not in mods/ is gone from the registry
for (const name of assets.keys()) {
  if (name === COUNTS || name === INDEX || name === CATALOG) continue;
  console.log(`removing ${name}`);
  remove(name);
}
for (const id of Object.keys(carried.sha)) if (!packedNames.has(id + MOD_FILE_EXT)) delete carried.sha[id];

const countsPath = join(work, COUNTS);
writeFileSync(countsPath, JSON.stringify(carried, null, 2) + '\n');
upload(countsPath);
writeFileSync(outFile, JSON.stringify(counts, null, 2) + '\n');
rmSync(work, { recursive: true, force: true });
console.log(`${packedNames.size} mod${packedNames.size === 1 ? '' : 's'} on the release; counts in ${outFile}`);
