import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { applyMods, parseMod } from '../../../steel-tide/game/core/src/game/mods';
import { prepareContentSchema } from '../../../steel-tide/game/core/src/game/contentSchema';
import { getDef } from '../../../steel-tide/game/core/src/game/defs';
import { sourceProfiles } from './extensions/combined-arms-v1/src/generatedProfiles';

const encoded=JSON.parse(readFileSync(new URL('mod.json',import.meta.url),'utf8'));
await prepareContentSchema(encoded,true);
function expanded(value:any):any {
  if(Array.isArray(value))return value.map(expanded);
  if(value&&typeof value==='object')return value.$ucgr?expanded(sourceProfiles[value.$ucgr]):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expanded(v)]));
  return value;
}
test('literal-profile encoding produces the identical validated definitions and references',()=>{
  const compact=parseMod(encoded);expect(compact.ok).toBe(true);
  if(!compact.ok)return;
  expect(applyMods([compact.mod]).rejected).toEqual([]);
  const normalized=compact.mod.defs.map(d=>structuredClone(getDef(d.id)));
  // Fully expanded source data deliberately exceeds the host metadata budget.
  // Expand one batch at a time while retaining every cross-reference in the pack.
  for(let start=0;start<encoded.defs.length;start+=32){
    const literal=parseMod({...encoded,defs:encoded.defs.map((d:any,i:number)=>i>=start&&i<start+32?expanded(d):d)});
    if(!literal.ok)throw Error(JSON.stringify(literal.errors));
    expect(compact.warnings).toEqual(literal.warnings);
    expect(applyMods([literal.mod]).rejected).toEqual([]);
    expect(literal.mod.defs.map(d=>getDef(d.id))).toEqual(normalized);
    expect(compact.mod.factions).toEqual(literal.mod.factions);
  }
  applyMods([]);
  expect(JSON.stringify(encoded).length).toBeLessThan(JSON.stringify({...encoded,defs:expanded(encoded.defs)}).length*.7);
});
test('unknown literal profiles reject activation rather than replacing config with defaults',()=>{
  const bad=structuredClone(encoded);bad.defs[0].extensions['components-v1']={$ucgr:'missing-source-profile'};
  const result=parseMod(bad);expect(result.ok).toBe(false);
  if(!result.ok)expect(result.errors.some(e=>e.message.includes('literal profile'))).toBe(true);
});
