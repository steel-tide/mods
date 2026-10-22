import { fields, flag, identifier, issue, label, list, number } from './sensorsSpec';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
export interface BarrageSpec {
  id:string;label:string[];weapon:string;mount:string;shots:number;first:number;interval:number;cooldown:number;componentGate:boolean;stock?:string;minimumStock?:number;energyCost?:number;disabled?:boolean;
}
export function readBarrages(raw:unknown,path:string,errors:ContentIssue[]):BarrageSpec[]{
  if(raw===undefined)return[];
  return list(raw,4,path,errors,(v,p)=>{
    fields(v,['id','label','weapon','mount','shots','first','interval','cooldown','componentGate','stock','minimumStock','energyCost','disabled'],p,errors);
    const id=identifier(v.id,p+'.id',errors),shots=number(v.shots,1,1,100,p+'.shots',errors);
    if(!Number.isInteger(shots))issue(errors,p+'.shots','must be a whole source shell count');
    return{id,label:label(v.label,id,p+'.label',errors) as string[],weapon:identifier(v.weapon,p+'.weapon',errors),mount:identifier(v.mount,p+'.mount',errors),shots,
      first:number(v.first,0,0,600,p+'.first',errors),interval:number(v.interval,1,.01,600,p+'.interval',errors),cooldown:number(v.cooldown,0,0,600,p+'.cooldown',errors),componentGate:flag(v.componentGate,false,p+'.componentGate',errors),
      energyCost:number(v.energyCost,0,0,10000,p+'.energyCost',errors),disabled:flag(v.disabled,false,p+'.disabled',errors),
      ...(v.stock===undefined?{}:{stock:identifier(v.stock,p+'.stock',errors)}),
      ...(v.minimumStock===undefined?{}:{minimumStock:number(v.minimumStock,1,1,10000,p+'.minimumStock',errors)})};
  });
}
