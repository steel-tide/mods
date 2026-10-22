import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import { fields, flag, issue, number, record } from './sensorsSpec';
export interface SourceTransport { weight:number;capacity:number;tags:string[];blockTransports:boolean;unload:number }
export function readSourceTransport(v:unknown,path:string,errors:ContentIssue[]):SourceTransport|undefined{
 if(v===undefined)return;
 if(!record(v)){issue(errors,path,'must be an object');return;}
 fields(v,['weight','capacity','tags','blockTransports','unload'],path,errors);
 const tags=Array.isArray(v.tags)&&v.tags.length<=128&&v.tags.every(s=>typeof s==='string'&&s.length>0&&s.length<=100)?v.tags as string[]:[];
 if(!Array.isArray(v.tags)||tags.length!==v.tags.length)issue(errors,path+'.tags','must contain literal source passenger tags');
 return{weight:number(v.weight,1,0,1000000,path+'.weight',errors),capacity:number(v.capacity,0,0,50,path+'.capacity',errors),tags,blockTransports:flag(v.blockTransports,true,path+'.blockTransports',errors),unload:number(v.unload,.5,1/60,600,path+'.unload',errors)};
}
