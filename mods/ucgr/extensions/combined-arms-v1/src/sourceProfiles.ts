import { sourceProfiles } from './generatedProfiles';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';

function expand(value:unknown,stack:Set<string>,depth:number):unknown {
  if(depth>64)throw Error('literal profile nesting exceeds 64');
  if(Array.isArray(value))return value.map(child=>expand(child,stack,depth+1));
  if(!value||typeof value!=='object')return value;
  const data=value as Record<string,unknown>;
  if('$ucgr' in data){
    const id=data.$ucgr;
    if(Object.keys(data).length!==1||typeof id!=='string'||!Object.hasOwn(sourceProfiles,id)||stack.has(id))throw Error('unknown or cyclic UCGR literal profile');
    const next=new Set(stack);next.add(id);return expand(sourceProfiles[id],next,depth+1);
  }
  return Object.fromEntries(Object.entries(data).map(([key,child])=>[key,expand(child,stack,depth+1)]));
}

/**
 * The host hands every reader of a def the one definition, and between them
 * only replaces a weapon's extensions with what they read as. So the
 * definition is expanded once for all its readers, not once a reader (seconds
 * for the whole pack), and again whenever a value on it or on one of its
 * weapons is no longer the one it was expanded from.
 */
const expandedDefinitions=new WeakMap<object,{values:unknown[];value:unknown}>();
function ownValues(definition:Record<string,unknown>):unknown[] {
  const weapons=Array.isArray(definition.weapons)?definition.weapons:[];
  return [...Object.values(definition),...weapons.flatMap(w=>w&&typeof w==='object'?Object.values(w):[w])];
}
function expandDefinition(definition:unknown):unknown {
  if(!definition||typeof definition!=='object')return expand(definition,new Set(),0);
  const values=ownValues(definition as Record<string,unknown>),seen=expandedDefinitions.get(definition);
  if(seen&&seen.values.length===values.length&&seen.values.every((v,i)=>v===values[i]))return seen.value;
  const value=expand(definition,new Set(),0);
  expandedDefinitions.set(definition,{values,value});
  return value;
}

/** A pack-local encoding: decoded values still cross the full typed schema. */
export function literalProfiles<T extends (raw:unknown,path:string,errors:ContentIssue[],...args:any[])=>any>(reader:T):T {
  return ((raw:unknown,path:string,errors:ContentIssue[],...args:any[])=>{
    try{
      const context=args[0];
      const resolved=context?.definition?{...context,definition:expandDefinition(context.definition)}:context;
      return reader(expand(raw,new Set(),0),path,errors,...(args.length?[resolved,...args.slice(1)]:args));
    }
    catch(error){errors.push({path,message:error instanceof Error?error.message:'invalid UCGR literal profile'});return undefined;}
  }) as T;
}
