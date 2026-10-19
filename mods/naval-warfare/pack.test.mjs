import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import {packMod} from '../../tools/pack.mjs';
import {parseMod,prepareContentSchema} from '../../tools/steel-tide-mod.mjs';

test('offline file retains exact extension modules and every declared media byte',async()=>{
 const folder=new URL('./',import.meta.url),manifest=JSON.parse(readFileSync(new URL('mod.json',folder),'utf8'));
 const packed=await packMod(fileURLToPath(folder));assert.equal(packed.ok,true,JSON.stringify(packed.errors));
 await prepareContentSchema(packed.text,true);const parsed=parseMod(packed.text);assert.equal(parsed.ok,true);
 assert.deepEqual(parsed.mod.extensionPackages,manifest.extensionPackages);assert.equal(parsed.mod.capacity,'large');
 const files=JSON.parse(packed.text).files;
 const declared=[...manifest.sprites,...manifest.sounds,...manifest.music.tracks].map(s=>s.file).concat(manifest.maps);
 assert.equal(Object.keys(files).length,new Set(declared).size);
 for(const file of declared){assert.deepEqual(Buffer.from(files[file].split(',')[1],'base64'),readFileSync(new URL(file,folder)),file);}
 assert.equal(parsed.mod.screenshots,undefined);
});
