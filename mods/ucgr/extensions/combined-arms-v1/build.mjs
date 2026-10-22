/** Bundle package implementations; the shipped modules resolve only host API values. */
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const here=import.meta.dirname;
const engine=resolve(here,'../../../../../steel-tide/game/core');
const { build }=await import(pathToFileURL(resolve(engine,'node_modules/vite/dist/node/index.js')));
const metadata=JSON.parse(readFileSync(resolve(here,'package.json'),'utf8'));
const descriptors={id:'combined-arms',version:metadata.version,api:2,capabilities:['usgr-re.squads-v1','articulation-v1','components-v1','logistics-v1','sensors-v1','usgr-re.targeting-v1','usgr-re.feedback-v1'],assets:JSON.parse(readFileSync(resolve(here,'assets.json'),'utf8'))};
for(const part of ['schema','runtime','presentation']) {
 const used=new Set();
 const result=await build({root:engine,configFile:false,publicDir:false,logLevel:'error',
  // Preserve the embedded package's field initialization semantics across source locations.
  esbuild:{tsconfigRaw:{compilerOptions:{useDefineForClassFields:false}}},
  plugins:[{name:'extension-host-binding',enforce:'pre',resolveId(id){if(id==='./host'||id==='./presentationHost')return '\0extension-host';},load(id){
   if(id!=='\0extension-host')return;
   // Enumerate imports from package sources, without bundling the engine SDK.
   const names=['asset','playRecordedUnitVoice','releaseRecordedVoiceResources','DEFS','EV_HURT','FIELD_COLORS','InputController','Renderer','TILE','Terrain','abilityReloadMul','canPlace','canSee','cargoLoad','cargoWeight','cmdAttack','cmdMove','contentRuntime','contentStateRuntime','createExtendedRenderer','footprintTiles','getDef','getSprite','groundAimCat','hasRound','hullBeam','kill','markBlocked','maxHp','newEnt','normAngle','passable','pick','recoilSprites','ruleMul','setEntityDef','t','targetCat','techMet','turnToward','unitDisplayScale','walkGridLine','weaponCanBombard','weaponReaches'];
   names.push('ownsAirMount', 'ownsSubMount', 'createRecordedAudioScope', 'cmdEmbarkGroup', 'cmdDisembarkGroup', 'cmdBoard', 'cmdUnload', 'cmdPickup', 'cmdContentAction', 'airSteer', 'moveToward', 'canCarry', 'cargoDist', 'liftable', 'downOrdnance', 'addEffect', 'emit');
   return names.map(name=>`export const ${name}=__steelExtensionHost.${name};`).join('\n');
  },generateBundle(_,bundle){for(const output of Object.values(bundle))if(output.type==='chunk')for(const id of Object.keys(output.modules)){used.add(id);if(id.includes('/steel-tide/game/core/'))throw new Error('Package may not bundle game code: '+id);}}}],
  build:{write:false,minify:true,target:'es2022',lib:{entry:resolve(here,'src',part+'.ts'),formats:['iife'],name:'SteelExtension'},rollupOptions:{output:{inlineDynamicImports:true}}}
 });
 const chunks=(Array.isArray(result)?result.flatMap(r=>r.output):result.output).filter(o=>o.type==='chunk');if(chunks.length!==1)throw new Error('Expected a self-contained package module');
 const source=`/* Steel Tide implementation; SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 */\nexport default function(__steelExtensionHost){\n${chunks[0].code}\nreturn SteelExtension;\n}\n`;
 const sha256=createHash('sha256').update(source).digest('hex');
 descriptors[part]={source,sha256};
 mkdirSync(resolve(here,'dist'),{recursive:true});
 writeFileSync(resolve(here,'dist',part+'.mjs'),source);
 console.log(part,source.length,'bytes',used.size,'package source modules');
}
writeFileSync(resolve(here,'extension.json'),JSON.stringify(descriptors,null,2)+'\n');
console.log('wrote extension.json');
