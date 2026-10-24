// Embed only this mod's self-contained modules. No game implementation is bundled.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const here = import.meta.dirname;
const descriptor = { id: 'gw.battle', version: '0.2.0', api: 2, capabilities: ['gw.battle-v1'] };
// the soundtrack queues and voices port.py read from the source (`audio.json`)
const audio = existsSync(`${here}/audio.json`) ? JSON.parse(readFileSync(`${here}/audio.json`, 'utf8')) : { era: {}, lines: {}, picked: {}, assets: {} };
for (const part of ['schema', 'runtime', 'presentation']) {
  let source = readFileSync(`${here}/src/${part}.mjs`, 'utf8');
  if (part === 'presentation') {
    source = source.replace('/* ERA_MUSIC */ {}', JSON.stringify(audio.era)).replace('/* LINES */ {}', JSON.stringify(audio.lines))
      .replace('/* PICKED */ {}', JSON.stringify(audio.picked));
  }
  if (/\bimport\s/.test(source)) throw Error('Extension must be self-contained: ' + part);
  descriptor[part] = { source, sha256: createHash('sha256').update(source).digest('hex') };
}
if (Object.keys(audio.assets).length) descriptor.assets = audio.assets;
writeFileSync(`${here}/extension.json`, JSON.stringify(descriptor, null, 2) + '\n');
console.log('Built gw.battle (host API 2)');
