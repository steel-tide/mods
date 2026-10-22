import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { fields, identifier, issue, number, record } from './sensorsSpec';

export interface SeadCarrierSpec {
 family:string;helper:string;rounds:number;range:number;scanLimit:number;scanInterval:number;scanCone:number;
 queueTime:number;waypointTime:number;warmup:number;reload:number;launchCone:number;lateral:number[];alternate:boolean;
 energy:number;energyRegen:number;severeDamage:number;speedReset?:number;
}
export interface SeadMissileSpec {
 family:string;speed:number;acceleration:number;turnRate:number;turnAcceleration:number;inheritSpeed:number;
 heightRate:number;initialHeight:number;energy:number;interval:number;lostDrain:number;proximity:number;
 primaryDamage:number;primaryRadius:number;payloadDamage:number;payloadRadius:number;payloadExpand:number;payloadDelay:number;
 primaryWeapon:string;payloadWeapon:string;interceptionRange:number;
}
export function readSeadCarrier(v:unknown,p:string,errors:ContentIssue[],context?:ExtensionSpecContext):SeadCarrierSpec|undefined{
 if(!record(v)){issue(errors,p,'must be an object');return;}
 const keys=['rounds','range','scanLimit','scanInterval','scanCone','queueTime','waypointTime','warmup','reload','launchCone','energy','severeDamage'];
 fields(v,[...keys,'family','helper','lateral','alternate','energyRegen','speedReset'],p,errors);
 const out={...Object.fromEntries(keys.map(k=>[k,number(v[k],0,0,10000,`${p}.${k}`,errors)])),family:identifier(v.family,`${p}.family`,errors),helper:identifier(v.helper,`${p}.helper`,errors),energyRegen:number(v.energyRegen,0,-10000,10000,`${p}.energyRegen`,errors),lateral:[],alternate:v.alternate} as unknown as SeadCarrierSpec;
 if(context?.defIds&&!context.defIds.has(out.helper))issue(errors,`${p}.helper`,'must reference a package helper definition');
 if(typeof v.alternate!=='boolean')issue(errors,`${p}.alternate`,'must be boolean');
 if(!Array.isArray(v.lateral)||v.lateral.length!==2)issue(errors,`${p}.lateral`,'must contain two source launch stations');
 else out.lateral=v.lateral.map((x,i)=>number(x,0,-1000,1000,`${p}.lateral[${i}]`,errors));
 if(!Number.isSafeInteger(out.rounds)||out.rounds<1||out.rounds>16||!Number.isSafeInteger(out.scanLimit)||out.scanLimit<1||out.scanLimit>256)issue(errors,p,'invalid bounded magazine/scan count');
 if(out.scanInterval<1/60||out.waypointTime<=0||out.scanCone>Math.PI||out.launchCone>Math.PI||out.severeDamage>1)issue(errors,p,'invalid source clock or angle');
 if(v.speedReset!==undefined)out.speedReset=number(v.speedReset,0,-1,1,`${p}.speedReset`,errors);
 return out;
}
export function readSeadMissile(v:unknown,p:string,errors:ContentIssue[],context?:ExtensionSpecContext):SeadMissileSpec|undefined{
 if(!record(v)){issue(errors,p,'must be an object');return;}
 const keys=['speed','acceleration','turnRate','turnAcceleration','inheritSpeed','heightRate','initialHeight','energy','interval','lostDrain','proximity','primaryDamage','primaryRadius','payloadDamage','payloadRadius','payloadExpand','payloadDelay','interceptionRange'];
 fields(v,[...keys,'family','primaryWeapon','payloadWeapon'],p,errors);
 const out={...Object.fromEntries(keys.map(k=>[k,number(v[k],0,0,100000,`${p}.${k}`,errors)])),family:identifier(v.family,`${p}.family`,errors),primaryWeapon:identifier(v.primaryWeapon,`${p}.primaryWeapon`,errors),payloadWeapon:identifier(v.payloadWeapon,`${p}.payloadWeapon`,errors)} as unknown as SeadMissileSpec;
 if(out.interval<1/60||out.payloadExpand<=0||out.primaryRadius<=0||out.payloadRadius<=0||out.energy<=0)issue(errors,p,'invalid source lifecycle');
 for(const id of [out.primaryWeapon,out.payloadWeapon])if(context?.weaponIds&&!context.weaponIds.includes(id))issue(errors,p,`missing helper weapon ${id}`);
 return out;
}
