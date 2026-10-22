import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { fields, flag, identifier, issue, list, number, record } from './sensorsSpec';
export const SQUADS_ID = 'usgr-re.squads-v1';
export interface SquadDef {
  member?: { controller: string; special: boolean };
  controller?: { capacity: number; positions: { x: number; y: number }[]; mobile: string; trench: string; entrenched: boolean; digTime: number; exitTime: number; groundOffset: number };
  settings?: boolean;
}
export interface SquadWeapon { moraleLoss: number }
export function readSquadDef(raw: unknown, path: string, errors: ContentIssue[], ctx?: ExtensionSpecContext): SquadDef | undefined {
  if (!record(raw)) { issue(errors,path,'must be an object'); return; }
  fields(raw,['member','controller','settings'],path,errors);
  const out: SquadDef = {};
  if (raw.settings !== undefined) out.settings = flag(raw.settings,false,path+'.settings',errors);
  if (raw.member !== undefined) {
    if (!record(raw.member)) issue(errors,path+'.member','must be an object');
    else { fields(raw.member,['controller','special'],path+'.member',errors); out.member={controller:identifier(raw.member.controller,path+'.member.controller',errors),special:flag(raw.member.special,false,path+'.member.special',errors)}; }
  }
  if (raw.controller !== undefined) {
    if (!record(raw.controller)) issue(errors,path+'.controller','must be an object');
    else {
      const c=raw.controller,p=path+'.controller'; fields(c,['capacity','positions','mobile','trench','entrenched','digTime','exitTime','groundOffset'],p,errors);
      const positions=list(c.positions,5,p+'.positions',errors,(v,q)=>{fields(v,['x','y'],q,errors);return {x:number(v.x,0,-100,100,q+'.x',errors),y:number(v.y,0,-100,100,q+'.y',errors)};});
      const capacity=number(c.capacity,5,3,5,p+'.capacity',errors);
      if (![3,5].includes(capacity)||positions.length!==capacity) issue(errors,p,'requires the original three or five positions');
      out.controller={capacity,positions,mobile:identifier(c.mobile,p+'.mobile',errors),trench:identifier(c.trench,p+'.trench',errors),entrenched:flag(c.entrenched,false,p+'.entrenched',errors),digTime:number(c.digTime,20,0,600,p+'.digTime',errors),exitTime:number(c.exitTime,1,0,600,p+'.exitTime',errors),groundOffset:number(c.groundOffset,0,-100,100,p+'.groundOffset',errors)};
    }
  }
  if (out.member && out.controller) issue(errors,path,'a soldier cannot also be a squad controller');
  if (ctx?.defIds) for (const id of [out.member?.controller,out.controller?.mobile,out.controller?.trench]) if (id && !ctx.defIds.has(id)) issue(errors,path,`unknown squad form ${id}`);
  return out;
}
export function readSquadWeapon(raw: unknown,path:string,errors:ContentIssue[]):SquadWeapon|undefined {
  if (!record(raw)){issue(errors,path,'must be an object');return;}
  fields(raw,['moraleLoss'],path,errors);return {moraleLoss:number(raw.moraleLoss,0,0,10,path+'.moraleLoss',errors)};
}

export function validateSquadReferences(def:import('../../../../../../steel-tide/game/core/src/core/types').UnitDef,table:Record<string,import('../../../../../../steel-tide/game/core/src/core/types').UnitDef>,path:string,errors:ContentIssue[],forms?:Set<string>):void {
  const spec=def.extensions?.[SQUADS_ID] as SquadDef|undefined;if(!spec)return;
  for(const id of [spec.member?.controller,spec.controller?.mobile,spec.controller?.trench])if(id){
    forms?.add(id);const target=table[id],cfg=target?.extensions?.[SQUADS_ID] as SquadDef|undefined;
    if(!cfg?.controller)issue(errors,path,`squad form ${id} must declare its controller`);
    if(spec.controller&&cfg?.controller&&spec.controller.capacity!==cfg.controller.capacity)issue(errors,path,'squad forms must retain the same capacity');
  }
}
