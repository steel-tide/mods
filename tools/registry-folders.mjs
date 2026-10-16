import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Local ignored drafts must never enter registry checks, indexes or releases. */
export function registryModFolders(root) {
  const folders = readdirSync(join(root, 'mods'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, 'mods', entry.name))
    .sort();
  if (!folders.length) return folders;
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
    cwd: root, input: folders.join('\0') + '\0', encoding: 'utf8',
  });
  // An exported registry without Git contains only the shipped folders.
  if (result.status !== 0 && result.status !== 1) return folders;
  const ignored = new Set(result.stdout.split('\0').filter(Boolean));
  return folders.filter((folder) => !ignored.has(folder));
}
