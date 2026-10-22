import { sourceProfiles } from './generatedProfiles';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';

/** A pack-local encoding: decoded values still cross the full typed schema. */
export function literalProfiles<T extends (raw:unknown,path:string,errors:ContentIssue[],...args:any[])=>any>(reader:T):T {
  return ((raw:unknown,path:string,errors:ContentIssue[],...args:any[])=>{
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
    try{
      const context=args[0];
      const resolved=context?.definition?{...context,definition:expand(context.definition,new Set(),0)}:context;
      return reader(expand(raw,new Set(),0),path,errors,...(args.length?[resolved,...args.slice(1)]:args));
    }
    catch(error){errors.push({path,message:error instanceof Error?error.message:'invalid UCGR literal profile'});return undefined;}
  }) as T;
}
