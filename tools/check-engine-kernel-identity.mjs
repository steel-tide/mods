#!/usr/bin/env node
/** Reproducible structural gate for optional engine modules. Needs the game checkout's TypeScript dependency. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const game = resolve(arg('--game', resolve(dirname(fileURLToPath(import.meta.url)), '../../steel-tide')));
const base = arg('--base', 'c4754358');
const out = arg('--out', resolve(dirname(fileURLToPath(import.meta.url)), '../docs/engine-compatibility/2026-10-16-m0-m4/canonical-kernel-identity.json'));
const ts = createRequire(resolve(game, 'game/core/package.json'))('typescript');
const git = (...args) => execFileSync('git', args, { cwd: game, encoding: 'utf8' });
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['game/core/src/game/combat.ts', 'game/core/src/game/fireControl.ts', 'game/core/src/game/sim.ts',
  'game/core/src/net/frames.ts', 'game/core/src/net/remoteFrames.ts', 'game/core/src/game/save.ts', 'game/core/src/render/renderer.ts',
  'game/core/src/render/input.ts', 'game/core/src/ui/hud.ts'];
// These are explicit cold serialization/load boundaries; their changes are reported, never counted as identity.
const coldSave = new Set(['serializeGame', 'takeKeyframe', 'deserializeSnapshot', 'applySnapshotObject']);
function bodies(text, file) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), result = new Map();
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.body) result.set(node.name.text, node.body.getText(source));
    if (ts.isClassDeclaration(node)) for (const member of node.members) {
      const name = ts.isConstructorDeclaration(member) ? 'constructor' : member.name?.getText(source);
      if (member.body) result.set(`${node.name.text}.${name}`, member.body.getText(source));
      if (ts.isPropertyDeclaration(member)) result.set(`${node.name.text}.${name}:initializer`, member.initializer?.getText(source) ?? '<no initializer>');
    }
  }
  return result;
}
const evidence = { base: git('rev-parse', base).trim(), candidateHead: git('rev-parse', 'HEAD').trim(),
  workingTreeIncluded: true, algorithm: 'SHA-256 of exact canonical AST function/method body text and class field initializers; new functions excluded',
  coldSaveExceptions: [...coldSave], files: [], passed: true };
for (const file of files) {
  const previous = bodies(git('show', `${base}:${file}`), file), current = bodies(readFileSync(resolve(game, file), 'utf8'), file);
  const functions = [...previous].map(([name, body]) => {
    const next = current.get(name), identical = next === body;
    const coldBoundary = file.endsWith('/save.ts') && coldSave.has(name);
    if (!identical && !coldBoundary) evidence.passed = false;
    return { name, baseline: hash(body), candidate: next === undefined ? null : hash(next), identical, ...(coldBoundary ? {coldBoundary:true} : {}) };
  });
  evidence.files.push({ file, identical: functions.filter(f => f.identical).length, checked: functions.length,
    added: [...current.keys()].filter(key => !previous.has(key)), functions });
}
mkdirSync(dirname(out), {recursive:true}); writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
for (const file of evidence.files) console.log(`${file.file}: ${file.identical}/${file.checked} identical`);
for (const file of evidence.files) for (const fn of file.functions) if (!fn.identical) console.log(`${fn.coldBoundary ? 'Cold boundary' : 'FAIL'}: ${file.file} ${fn.name}`);
console.log(`${evidence.passed ? 'PASS' : 'FAIL'}: ${out}`);
if (!evidence.passed) process.exitCode = 1;
