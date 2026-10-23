// Embed only this mod's self-contained modules. No game implementation is bundled.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const here = import.meta.dirname;
const descriptor = { id: 'ek-definitive-edition.systems', version: '1.0.0', api: 2, capabilities: ['ek-definitive-edition.systems-v1'] };
for (const part of ['schema', 'runtime', 'presentation']) {
  let source = readFileSync(`${here}/src/${part}.mjs`, 'utf8');
  if (part === 'runtime') {
    const layout = JSON.parse(readFileSync(`${here}/showcase-layout.json`, 'utf8'));
    source += '\n' + readFileSync(`${here}/src/showcase.mjs`, 'utf8').replace('/* SHOWCASE_LAYOUT */ null', JSON.stringify(layout));
  }
  if (/\bimport\s/.test(source)) throw Error('Extension must be self-contained: ' + part);
  descriptor[part] = { source, sha256: createHash('sha256').update(source).digest('hex') };
}
writeFileSync(`${here}/extension.json`, JSON.stringify(descriptor, null, 2) + '\n');
console.log('Built ek-definitive-edition.systems (host API 2)');
