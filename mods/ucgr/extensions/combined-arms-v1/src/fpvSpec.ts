import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { choice, fields, identifier, issue, number, record } from './sensorsSpec';
export interface FpvOperatorSpec {drones:string[];stock:number;range:number;deployTime:number;check:number;cooldown:number;reconDelay:number;attackDelay:number}
export interface FpvDroneSpec {role:'recon'|'attack';energy:number;regen:number;linkDrain:number;speed:number;acceleration:number;deceleration:number;turnRate:number;turnAcceleration:number;height:number;range:number;reload:number;payloads:{weapon:string;chance:number;delay:number}[]}
export function readFpvOperator(v:unknown,p:string,errors:ContentIssue[],context?:ExtensionSpecContext):FpvOperatorSpec|undefined{
 if(!record(v)){issue(errors,p,'must be an object');return;}
 const keys=['stock','range','deployTime','check','cooldown','reconDelay','attackDelay'];fields(v,[...keys,'drones'],p,errors);
 const out={...Object.fromEntries(keys.map(k=>[k,number(v[k],0,0,10000,p+'.'+k,errors)])),drones:[]} as unknown as FpvOperatorSpec;
 if(!Array.isArray(v.drones)||v.drones.length!==3)issue(errors,p+'.drones','requires recon, HEAT and thermobaric helper definitions');else out.drones=v.drones.map((s,i)=>identifier(s,`${p}.drones[${i}]`,errors));
 if(!Number.isSafeInteger(out.stock)||out.stock<1||out.stock>100||out.check<1/60||out.cooldown<1/60||out.range<=0)issue(errors,p,'invalid source controller clock or inventory');
 for(const id of out.drones)if(context?.defIds&&!context.defIds.has(id))issue(errors,p+'.drones','unknown helper '+id);return out;
}
export function readFpvDrone(v:unknown,p:string,errors:ContentIssue[],context?:ExtensionSpecContext):FpvDroneSpec|undefined{
 if(!record(v)){issue(errors,p,'must be an object');return;}
 const keys=['energy','linkDrain','speed','acceleration','deceleration','turnRate','turnAcceleration','height','range','reload'];fields(v,[...keys,'regen','role','payloads'],p,errors);
 const out={...Object.fromEntries(keys.map(k=>[k,number(v[k],0,0,10000,p+'.'+k,errors)])),regen:number(v.regen,0,-1000,0,p+'.regen',errors),role:choice(v.role,['recon','attack'],'recon',p+'.role',errors),payloads:[]} as unknown as FpvDroneSpec;
 if(!Array.isArray(v.payloads)||v.payloads.length>4)issue(errors,p+'.payloads','invalid source helper tree');else out.payloads=v.payloads.flatMap((s,i)=>{if(!record(s)){issue(errors,p+'.payloads','invalid source helper');return[];}fields(s,['weapon','chance','delay'],p+'.payloads',errors);const weapon=identifier(s.weapon,`${p}.payloads[${i}].weapon`,errors);if(context?.weaponIds&&!context.weaponIds.includes(weapon))issue(errors,p+'.payloads','unknown helper weapon');return[{weapon,chance:number(s.chance,1,0,1,p+'.chance',errors),delay:number(s.delay,0,0,10,p+'.delay',errors)}];});
 if(out.energy<=0||out.reload<=0||out.speed<=0||out.acceleration<=0||out.turnAcceleration<=0)issue(errors,p,'invalid source drone lifecycle');return out;
}
