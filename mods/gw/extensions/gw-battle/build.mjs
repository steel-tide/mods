// Embed only this mod's self-contained modules. No game implementation is bundled.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const here = import.meta.dirname;
const descriptor = { id: 'gw.battle', version: '0.1.0', api: 2, capabilities: ['gw.battle-v1'] };
for (const part of ['schema', 'runtime']) {
  const source = readFileSync(`${here}/src/${part}.mjs`, 'utf8');
  if (/\bimport\s/.test(source)) throw Error('Extension must be self-contained: ' + part);
  descriptor[part] = { source, sha256: createHash('sha256').update(source).digest('hex') };
}
writeFileSync(`${here}/extension.json`, JSON.stringify(descriptor, null, 2) + '\n');
console.log('Built gw.battle (host API 2)');
