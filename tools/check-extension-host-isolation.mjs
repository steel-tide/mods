#!/usr/bin/env node
/** Compare a frozen working-tree baseline with a candidate without timing tolerances. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); if (at < 0) throw Error(`Missing ${name}`); return resolve(args[at + 1]); };
const base = option('--base'), candidate = option('--candidate'), out = option('--out');
const ts = createRequire(resolve(candidate, 'game/core/package.json'))('typescript');
const hash = value => createHash('sha256').update(value).digest('hex');
const files = [
  'game/core/src/game/sim.ts', 'game/core/src/game/combat.ts', 'game/core/src/game/fireControl.ts',
  'game/core/src/game/orders.ts', 'game/core/src/game/save.ts',
  'game/core/src/net/frames.ts', 'game/core/src/net/remoteFrames.ts',
  'game/core/src/render/renderer.ts', 'game/core/src/render/input.ts',
  'game/core/src/ui/hud.ts', 'game/core/src/ui/gamescreen.ts', 'game/core/src/ui/gameFrameLoop.ts',
  'game/core/src/core/audio.ts',
];
const cold = new Set(['game/core/src/game/save.ts:validateSaveJson', 'game/core/src/ui/gamescreen.ts:GameScreen.mount']);
function bodies(text, path) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS), result = new Map();
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node) && node.body) result.set(node.name.text, node.body.getText(source));
    if (ts.isClassDeclaration(node)) for (const member of node.members) {
      const name = ts.isConstructorDeclaration(member) ? 'constructor' : member.name?.getText(source);
      if (member.body) result.set(`${node.name.text}.${name}`, member.body.getText(source));
      if (ts.isPropertyDeclaration(member)) result.set(`${node.name.text}.${name}:initializer`, member.initializer?.getText(source) ?? '<none>');
    }
  }
  return result;
}
const result = { base, candidate, at: new Date().toISOString(),
  method: 'Exact AST body/initializer text; access/export modifiers excluded. New helpers and two explicit cold boundaries are reported separately.',
  coldBoundaries: [...cold], files: [], passed: true };
for (const path of files) {
  const previous = bodies(readFileSync(resolve(base, path), 'utf8'), path);
  const current = bodies(readFileSync(resolve(candidate, path), 'utf8'), path);
  const entries = [...previous].map(([name, text]) => {
    const next = current.get(name), identical = text === next, coldBoundary = cold.has(`${path}:${name}`);
    if (!identical && !coldBoundary) result.passed = false;
    return { name, identical, coldBoundary, base: hash(text), candidate: next === undefined ? null : hash(next) };
  });
  result.files.push({ path, entries, added: [...current.keys()].filter(name => !previous.has(name)) });
}
result.identical = result.files.flatMap(f => f.entries).filter(e => e.identical).length;
result.checked = result.files.reduce((n, f) => n + f.entries.length, 0);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, identical: result.identical, checked: result.checked,
  changed: result.files.flatMap(f => f.entries.filter(e => !e.identical).map(e => ({ file: f.path, name: e.name, coldBoundary: e.coldBoundary }))) }));
if (!result.passed) process.exitCode = 1;
