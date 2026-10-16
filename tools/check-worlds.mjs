#!/usr/bin/env node
/** Registry CI entrypoint. Place beside steel-tide-world.mjs; it never publishes. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { checkWorldFile, WORLD_EXT, WORLD_INDEX_FORMAT } from './steel-tide-world.mjs';
const args = process.argv.slice(2);
const directory = resolve(args.find(x => !x.startsWith('--')) ?? 'worlds');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;
const worlds = [], errors = [];
for (const name of (await readdir(directory)).sort()) {
  if (!name.endsWith(WORLD_EXT)) continue;
  const checked = await checkWorldFile(await readFile(join(directory, name), 'utf8'), basename(name, WORLD_EXT));
  if (!checked.ok) errors.push(`${name}: ${checked.reason}${checked.details ? ` (${checked.details})` : ''}`);
  else worlds.push(checked.entry);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const index = JSON.stringify({ format: WORLD_INDEX_FORMAT, v: 1, worlds }, null, 2) + '\n';
  if (out) await writeFile(resolve(out), index);
  else process.stdout.write(index);
}
