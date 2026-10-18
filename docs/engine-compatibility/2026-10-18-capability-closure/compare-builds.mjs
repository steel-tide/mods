#!/usr/bin/env node
/** API 2 build witness: exact executable hashes and optional-module reachability. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const build = resolve(arg('--build', resolve(here, '../../../dist/capability-closure-gate')));
const out = resolve(arg('--out', resolve(here, 'build-identity.json')));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const optionalModule = path => /\/src\/(?:core\/recordedAudio\.|game\/(?:extensions\/(?!contracts\.)|contentCapabilityLoader\.)|render\/(?:contentRenderer|contentInput|contentVisuals|generatedContentRenderer)\.|ui\/(?:contentHud|contentFeedback|contentResources|contentPresentationLoader)\.)/.test('/' + path);
const result = {
  createdAt: new Date().toISOString(),
  note: 'Exact bytes and static reachability, without a timing threshold. Optional source must remain outside the vanilla initial closure. This does not prove performance on every device.',
  variants: {},
};
for (const variant of ['base', 'candidate']) {
  const graph = JSON.parse(readFileSync(resolve(build, `web-${variant}-graph.json`), 'utf8'));
  const chunks = new Map(graph.filter(item => item.type === 'chunk').map(item => [item.file, item]));
  const seen = new Set();
  function visit(file) {
    if (seen.has(file) || !chunks.has(file)) return;
    seen.add(file);
    for (const dependency of chunks.get(file).imports) visit(dependency);
  }
  for (const chunk of chunks.values()) if (chunk.entry) visit(chunk.file);
  const initial = [...seen].map(file => {
    const bytes = readFileSync(resolve(build, `web-${variant}`, file));
    return { file, bytes: bytes.length, gzip: gzipSync(bytes).length, sha256: sha256(bytes) };
  });
  const benchmark = readFileSync(resolve(build, variant, 'benchmark.js'));
  result.variants[variant] = {
    benchmark: { bytes: benchmark.length, sha256: sha256(benchmark) },
    initial: { bytes: initial.reduce((sum, item) => sum + item.bytes, 0), gzip: initial.reduce((sum, item) => sum + item.gzip, 0), files: initial },
    eagerlyReachableOptionalModules: [...new Set([...seen].flatMap(file => chunks.get(file).modules.filter(optionalModule)))],
    optionalChunks: [...chunks.values()].filter(chunk => chunk.modules.some(optionalModule)).map(chunk => ({ file: chunk.file, bytes: chunk.bytes, modules: chunk.modules.filter(optionalModule) })),
  };
}
result.benchmarkByteIdentical = result.variants.base.benchmark.sha256 === result.variants.candidate.benchmark.sha256;
result.initialDelta = {
  bytes: result.variants.candidate.initial.bytes - result.variants.base.initial.bytes,
  gzip: result.variants.candidate.initial.gzip - result.variants.base.initial.gzip,
};
result.optionalIsolationPassed = result.variants.candidate.eagerlyReachableOptionalModules.length === 0;
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ benchmarkByteIdentical: result.benchmarkByteIdentical, initialDelta: result.initialDelta, optionalIsolationPassed: result.optionalIsolationPassed }));
if (!result.optionalIsolationPassed) process.exitCode = 1;
