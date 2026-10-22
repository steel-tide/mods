import { readFileSync } from 'node:fs';
/** Evidence assertions inspect literal data; native parsing still tests raw encoding. */
export function expandedManifest():any {
  const raw=JSON.parse(readFileSync(new URL('mod.json',import.meta.url),'utf8'));
  const profiles=JSON.parse(readFileSync(new URL('literal-profiles.json',import.meta.url),'utf8'));
  function expand(v:any):any {
    if(Array.isArray(v))return v.map(expand);
    if(v&&typeof v==='object')return v.$ucgr?expand(profiles[v.$ucgr]):Object.fromEntries(Object.entries(v).map(([k,v])=>[k,expand(v)]));
    return v;
  }
  return {...raw,defs:expand(raw.defs)};
}
