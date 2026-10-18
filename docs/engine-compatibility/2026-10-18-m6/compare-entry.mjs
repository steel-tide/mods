#!/usr/bin/env node
/** Compare final and timed production entry statements without hiding export metadata. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), args = process.argv.slice(2);
const arg = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const engine = resolve(arg('--engine', resolve(here, '../../../../steel-tide')));
const build = resolve(arg('--build', resolve(here, '../../../dist/m6-vanilla-gate')));
const out = resolve(arg('--out', resolve(here, 'final-vs-timed-entry.json')));
const ts = createRequire(resolve(engine, 'game/core/package.json'))('typescript');
const entry = graph => graph.find(item => item.entry).file;
const timedEntry = entry(JSON.parse(readFileSync(resolve(build, 'web-candidate-timed-graph.json'))));
const finalEntry = entry(JSON.parse(readFileSync(resolve(build, 'web-candidate-graph.json'))));
const a = readFileSync(resolve(build, 'web-candidate-timed', timedEntry), 'utf8');
const b = readFileSync(resolve(build, 'web-candidate', finalEntry), 'utf8');
const normalize = source => source.replace(/(?<=-)[A-Za-z0-9_-]{8}(?=\.js)/g, '<CHUNKHASH>');
function split(source) {
  const ast = ts.createSourceFile('entry.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const exports = ast.statements.filter(ts.isExportDeclaration);
  let statements = source;
  for (const node of exports.toReversed()) statements = statements.slice(0, node.getStart(ast)) + statements.slice(node.end);
  return { source: normalize(statements), exports: exports.flatMap(node => node.exportClause?.elements.map(binding => ({ local: (binding.propertyName ?? binding.name).text, name: binding.name.text })) ?? []) };
}
const x = split(a), y = split(b);
const result = {
  timedEntry, finalEntry,
  rawBytesEqual: Buffer.byteLength(a) === Buffer.byteLength(b),
  identicalAfterNormalizingChunkHashes: normalize(a) === normalize(b),
  identicalExecutableStatementsOutsideExportDeclarations: x.source === y.source,
  normalization: 'Normalize eight-character generated chunk hash components immediately before .js. Then remove only top-level ExportDeclaration AST nodes (module linking metadata), preserving all executable function/class/variable/statement text.',
  timedExports: x.exports, finalExports: y.exports,
};
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ rawBytesEqual: result.rawBytesEqual, identicalExecutableStatementsOutsideExportDeclarations: result.identicalExecutableStatementsOutsideExportDeclarations }));
if (!result.identicalExecutableStatementsOutsideExportDeclarations) process.exitCode = 1;
