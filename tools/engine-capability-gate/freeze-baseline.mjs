import { mkdtempSync, existsSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const engine = resolve(arg('--engine', resolve(fileURLToPath(new URL('./', import.meta.url)), '../../../steel-tide')));
const commit = execFileSync('git', ['rev-parse', arg('--ref', 'c4754358')], { cwd: engine, encoding: 'utf8' }).trim();
const out = mkdtempSync(resolve(tmpdir(), 'steel-capability-baseline-'));
const archive = spawn('git', ['archive', commit], { cwd: engine, stdio: ['ignore', 'pipe', 'inherit'] });
const unpack = spawn('tar', ['-x', '-C', out], { stdio: ['pipe', 'ignore', 'inherit'] });
archive.stdout.pipe(unpack.stdin);
const success = child => new Promise((ok, fail) => { child.on('error', fail); child.on('exit', code => code === 0 ? ok() : fail(new Error(`Archive command exited ${code}`))); });
await Promise.all([success(archive), success(unpack)]);
for (const relative of ['node_modules', 'game/core/node_modules', 'game/core/public']) {
  const target = resolve(out, relative);
  if (existsSync(target)) renameSync(target, target + '.archived');
  symlinkSync(resolve(engine, relative), target, 'dir');
}
writeFileSync(resolve(out, 'baseline-provenance.json'), JSON.stringify({ commit, engine, out,
  note: 'Frozen tracked source; uses the candidate installation and unchanged generated media for both variants. No branch or worktree is created.' }, null, 2) + '\n');
console.log(out);
