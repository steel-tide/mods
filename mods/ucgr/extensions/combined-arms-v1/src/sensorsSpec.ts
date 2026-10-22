import { readFpvOperator, readFpvDrone, type FpvOperatorSpec, type FpvDroneSpec } from './fpvSpec';
import type { RadarFlightSpec } from './radarFlight';
import type { FlightControlSpec } from './flightControls';
import type { RadarBatterySpec } from './radarBattery';
import type { RadarControlSpec } from './radarControls';
import { readSeadCarrier, readSeadMissile, type SeadCarrierSpec, type SeadMissileSpec } from './seadSpec';
import type { ContentIssue, ContentText } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { TargetDomain } from '../../../../../../steel-tide/game/core/src/core/types';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';

/** Pack-owned signal channels are identifiers, never unit names or translated labels. */
export interface SensorSpec {
  id: string; label: ContentText; channel: string;
  mode: 'observe' | 'designate' | 'illuminate' | 'passive' | 'signature';
  reveal: 'contact' | 'entity'; maxTracks: number;
  range: number; cone: number; targets: TargetDomain[];
  /** Signal filters and clocks belong to the optional receiver, not native fog. */
  minimumSignature: number; basis: 'body' | 'turret'; x: number; y: number;
  interval: number; scanLimit: number;
  acquire: number; retain: number; active: boolean;
  forest: boolean; smoke: boolean;
}
export interface EmitterSpec { id: string; label: ContentText; channel: string; range: number; active: boolean; toggleTime: number; cooldown: number }
export interface DecoySpec { id: string; label: ContentText; channels: string[]; range: number; duration: number; cooldown: number; charges: number; chance: number }
export interface SourceFlightSpec { radar?: RadarFlightSpec; heightRate?:number; speed:number; acceleration:number; turnRate:number; turnAcceleration:number; inheritSpeed:number; launchLeg:number; launchTime:number; sample:number; lossDelay:number; fovDegrees:number; life:number; resistance:number; proximity:number; blastRadius:number }
export interface CountermeasureSpec { charges:number; reload:number; range:number; x:number; y:number; life:number; speed:number; radius:number; energy:number }
export interface SensorsDef {
  fpvOperator?:FpvOperatorSpec; fpvDrone?:FpvDroneSpec;
  radarBattery?: RadarBatterySpec;
  seadCarrier?: SeadCarrierSpec;
  seadMissile?: SeadMissileSpec;
  seadHits?: {id:string;missile:boolean;ahead:boolean;energy:number}[];
  flightControls?: FlightControlSpec;
  radarControl?: RadarControlSpec;
  countermeasures?: CountermeasureSpec; unmanned?: boolean; helicopter?: boolean; fixedWing?: boolean; airSuperiority?: boolean; electronicWarfare?: boolean; ecm?: number; altitude?: 'normal'|'low'|'high';
  sensors: SensorSpec[]; emitters: EmitterSpec[]; decoys: DecoySpec[];
  signatures: { channel: string; strength: number }[];
  obstruction?: { forest: boolean; smoke: boolean };
  remote?: { channel: string; range: number; commands: ('move' | 'attack')[] };
}
export interface GuidanceDef {
  sourceFlight?: SourceFlightSpec; launchArc?: number;
  mode: 'self' | 'designation' | 'illumination' | 'emitter';
  channel: string; range: number; cone: number; turnRate: number;
  acquire: number; lossGrace: number; reacquire: boolean; maxLife: number;
  forest: boolean; smoke: boolean; decoyResistance: number;
}

export function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
export function issue(errors: ContentIssue[], path: string, message: string): void { errors.push({ path, message }); }
export function fields(v: Record<string, unknown>, allowed: readonly string[], path: string, errors: ContentIssue[]): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) issue(errors, `${path}.${k}`, 'unsupported field');
}
export function number(v: unknown, fallback: number, min: number, max: number, path: string, errors: ContentIssue[], integer = false): number {
  if (v === undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    issue(errors, path, `must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`); return fallback;
  }
  return v;
}
export function identifier(v: unknown, path: string, errors: ContentIssue[]): string {
  if (typeof v !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(v) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(v)) { issue(errors, path, 'must be a bounded stable identifier'); return ''; }
  return v;
}
export function label(v: unknown, fallback: string, path: string, errors: ContentIssue[]): ContentText {
  if (v === undefined) return fallback;
  if (typeof v === 'string' && v.length > 0 && v.length <= 512) return v;
  if (Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'string' && x.length > 0 && x.length <= 512)) return v as string[];
  issue(errors, path, 'must be text or an [en, zh, ko] text tuple'); return fallback;
}
export function flag(v: unknown, fallback: boolean, path: string, errors: ContentIssue[]): boolean {
  if (v === undefined) return fallback;
  if (typeof v !== 'boolean') { issue(errors, path, 'must be a boolean'); return fallback; }
  return v;
}
export function choice<T extends string>(v: unknown, values: readonly T[], fallback: T, path: string, errors: ContentIssue[]): T {
  if (v === undefined) return fallback;
  if (typeof v !== 'string' || !values.includes(v as T)) { issue(errors, path, `must be one of ${values.join(', ')}`); return fallback; }
  return v as T;
}
export function list<T>(v: unknown, max: number, path: string, errors: ContentIssue[], read: (v: Record<string, unknown>, path: string) => T): T[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) { issue(errors, path, `must be a list of at most ${max} entries`); return []; }
  return v.flatMap((x, i) => {
    if (!record(x)) { issue(errors, `${path}[${i}]`, 'must be an object'); return []; }
    return [read(x, `${path}[${i}]`)];
  });
}
export function unique(items: readonly { id: string }[], path: string, errors: ContentIssue[]): void {
  const ids = new Set<string>(); for (const item of items) { if (ids.has(item.id)) issue(errors, path, `duplicate id ${item.id}`); ids.add(item.id); }
}
export function ids(v: unknown, max: number, path: string, errors: ContentIssue[]): string[] {
  if (!Array.isArray(v) || !v.length || v.length > max) { issue(errors, path, `must contain one to ${max} identifiers`); return []; }
  return v.map((x, i) => identifier(x, `${path}[${i}]`, errors));
}

export function readSensorsDef(value: unknown, path: string, errors: ContentIssue[], context?: ExtensionSpecContext): SensorsDef | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['sensors', 'emitters', 'decoys', 'signatures', 'obstruction', 'remote', 'countermeasures', 'unmanned', 'helicopter', 'fixedWing', 'airSuperiority', 'electronicWarfare', 'ecm', 'altitude', 'flightControls', 'radarControl', 'seadCarrier', 'seadMissile', 'seadHits', 'radarBattery', 'fpvOperator', 'fpvDrone'], path, errors);
  const sensors = list(value.sensors, 8, `${path}.sensors`, errors, (s, p): SensorSpec => {
    fields(s, ['id', 'label', 'channel', 'mode', 'reveal', 'maxTracks', 'range', 'cone', 'targets', 'acquire', 'retain', 'active', 'forest', 'smoke', 'minimumSignature', 'basis', 'x', 'y', 'interval', 'scanLimit'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    const mode = choice(s.mode, ['observe', 'designate', 'illuminate', 'passive', 'signature'], 'observe', `${p}.mode`, errors);
    if (s.minimumSignature !== undefined && mode !== 'signature') issue(errors, `${p}.minimumSignature`, 'requires signature detection');
    const domains: TargetDomain[] = ['ground', 'ship', 'sub', 'air'];
    const targets = s.targets === undefined ? domains : ids(s.targets, 4, `${p}.targets`, errors).filter(x => {
      if (!domains.includes(x as TargetDomain)) { issue(errors, `${p}.targets`, `unknown target domain ${x}`); return false; } return true;
    }) as TargetDomain[];
    return { id, label: label(s.label, id, `${p}.label`, errors), channel: identifier(s.channel, `${p}.channel`, errors),
      mode,
      reveal: choice(s.reveal, ['contact', 'entity'], 'contact', `${p}.reveal`, errors), maxTracks: number(s.maxTracks, 64, 1, 256, `${p}.maxTracks`, errors, true),
      range: number(s.range, 10, .1, 256, `${p}.range`, errors), cone: number(s.cone, Math.PI, .01, Math.PI, `${p}.cone`, errors), targets,
      minimumSignature: number(s.minimumSignature, 1, 0, 1e6, `${p}.minimumSignature`, errors), basis: choice(s.basis, ['body', 'turret'], 'turret', `${p}.basis`, errors),
      x: number(s.x, 0, -256, 256, `${p}.x`, errors), y: number(s.y, 0, -256, 256, `${p}.y`, errors),
      interval: number(s.interval, 0, 0, 60, `${p}.interval`, errors), scanLimit: number(s.scanLimit, 0, 1, 256, `${p}.scanLimit`, errors, true),
      acquire: number(s.acquire, 0, 0, 120, `${p}.acquire`, errors), retain: number(s.retain, 0, 0, 120, `${p}.retain`, errors),
      active: flag(s.active, true, `${p}.active`, errors), forest: flag(s.forest, false, `${p}.forest`, errors), smoke: flag(s.smoke, false, `${p}.smoke`, errors) };
  });
  const emitters = list(value.emitters, 8, `${path}.emitters`, errors, (s, p): EmitterSpec => {
    fields(s, ['id', 'label', 'channel', 'range', 'active', 'toggleTime', 'cooldown'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    return { id, label: label(s.label, id, `${p}.label`, errors), channel: identifier(s.channel, `${p}.channel`, errors), range: number(s.range, 20, .1, 256, `${p}.range`, errors),
      active: flag(s.active, true, `${p}.active`, errors), toggleTime: number(s.toggleTime, 0, 0, 120, `${p}.toggleTime`, errors), cooldown: number(s.cooldown, 0, 0, 600, `${p}.cooldown`, errors) };
  });
  const decoys = list(value.decoys, 4, `${path}.decoys`, errors, (s, p): DecoySpec => {
    fields(s, ['id', 'label', 'channels', 'range', 'duration', 'cooldown', 'charges', 'chance'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    return { id, label: label(s.label, id, `${p}.label`, errors), channels: ids(s.channels, 8, `${p}.channels`, errors),
      range: number(s.range, 3, .1, 64, `${p}.range`, errors), duration: number(s.duration, 3, .01, 120, `${p}.duration`, errors),
      cooldown: number(s.cooldown, 10, 0, 600, `${p}.cooldown`, errors), charges: number(s.charges, 1, 1, 1000, `${p}.charges`, errors, true), chance: number(s.chance, 1, 0, 1, `${p}.chance`, errors) };
  });
  unique(sensors, `${path}.sensors`, errors); unique(emitters, `${path}.emitters`, errors); unique(decoys, `${path}.decoys`, errors);
  const signatures = list(value.signatures, 8, `${path}.signatures`, errors, (s, p) => {
    fields(s, ['channel', 'strength'], p, errors);
    return { channel: identifier(s.channel, `${p}.channel`, errors), strength: number(s.strength, 0, 0, 1e6, `${p}.strength`, errors) };
  });
  unique(signatures.map(s => ({id:s.channel})), `${path}.signatures`, errors);
  const result: SensorsDef = { sensors, emitters, decoys, signatures };
  if(value.seadCarrier!==undefined)result.seadCarrier=readSeadCarrier(value.seadCarrier,`${path}.seadCarrier`,errors,context);
  if(value.seadMissile!==undefined)result.seadMissile=readSeadMissile(value.seadMissile,`${path}.seadMissile`,errors,context);
  if(value.seadHits!==undefined)result.seadHits=list(value.seadHits,16,`${path}.seadHits`,errors,(v,p)=>{fields(v,['id','missile','ahead','energy'],p,errors);return{id:identifier(v.id,`${p}.id`,errors),missile:flag(v.missile,false,`${p}.missile`,errors),ahead:flag(v.ahead,false,`${p}.ahead`,errors),energy:number(v.energy,0,0,10000,`${p}.energy`,errors)};});
  if(value.radarBattery!==undefined){const s=value.radarBattery,p=path+'.radarBattery';
    if(!record(s))issue(errors,p,'must be an object');else{
      fields(s,['role','interval','linkRange','range','acceptRange','scanInterval','scanLimit','lateral','indexDistance','listCap','hpTransfer','spin','stock','high','low','helicopter','waypointTime'],p,errors);
      const common={interval:number(s.interval,8/60,1/60,10,p+'.interval',errors),linkRange:number(s.linkRange,200,0,10000,p+'.linkRange',errors)};
      if(s.role==='provider')result.radarBattery={...common,role:'provider',range:number(s.range,1200,0,10000,p+'.range',errors),acceptRange:number(s.acceptRange,1280,0,10000,p+'.acceptRange',errors),scanInterval:number(s.scanInterval,.2,1/60,10,p+'.scanInterval',errors),scanLimit:number(s.scanLimit,100,1,100,p+'.scanLimit',errors,true),lateral:number(s.lateral,40,-1000,1000,p+'.lateral',errors),indexDistance:flag(s.indexDistance,false,p+'.indexDistance',errors),listCap:number(s.listCap,1,1,100,p+'.listCap',errors,true),hpTransfer:number(s.hpTransfer,.6,0,100,p+'.hpTransfer',errors),spin:number(s.spin,0,0,400,p+'.spin',errors)};
      else if(s.role==='launcher')result.radarBattery={...common,role:'launcher',stock:identifier(s.stock,p+'.stock',errors),high:number(s.high,1000,0,10000,p+'.high',errors),low:number(s.low,600,0,10000,p+'.low',errors),helicopter:number(s.helicopter,480,0,10000,p+'.helicopter',errors),waypointTime:number(s.waypointTime,5,0,5,p+'.waypointTime',errors)};
      else issue(errors,p+'.role','must be provider or launcher');
    }
  }
  if(value.radarControl!==undefined){const s=value.radarControl,p=`${path}.radarControl`;
    if(!record(s))issue(errors,p,'must be an object');
    else{fields(s,['range','rangeOn','rangeOff','switchTime','cooldown','groundRange','groundTime','interval','weapons','initial'],p,errors);
      result.radarControl={initial:flag(s.initial,true,`${p}.initial`,errors),range:number(s.range,1,.01,256,`${p}.range`,errors),rangeOn:number(s.rangeOn,1,0,256,`${p}.rangeOn`,errors),rangeOff:number(s.rangeOff,0,0,256,`${p}.rangeOff`,errors),switchTime:number(s.switchTime,.5,0,60,`${p}.switchTime`,errors),cooldown:number(s.cooldown,10,0,600,`${p}.cooldown`,errors),interval:number(s.interval,.1,1/60,60,`${p}.interval`,errors),weapons:list(s.weapons,16,`${p}.weapons`,errors,(w,wp)=>{fields(w,['id','mode'],wp,errors);return{id:identifier(w.id,`${wp}.id`,errors),mode:choice<'air'|'ground'|'target'>(w.mode,['air','ground','target'],'air',`${wp}.mode`,errors)};})};
      if(s.groundRange!==undefined)result.radarControl.groundRange=number(s.groundRange,1,0,256,`${p}.groundRange`,errors);
      if(s.groundTime!==undefined)result.radarControl.groundTime=number(s.groundTime,.05,0,60,`${p}.groundTime`,errors);
    }
  }
  if(value.flightControls!==undefined){
    const s=value.flightControls,p=`${path}.flightControls`;
    if(!record(s))issue(errors,p,'must be an object');
    else{const keys=['initialHeight','lowHeight','highHeight','heightSpread','heightRate','altitudeTime','altitudeCooldown','thrust','thrustDuration','thrustCooldown','brake','brakeTurn','damageSpeed'];fields(s,[...keys,'initial','damageThresholds','highRangeBonus','rangeWeapons','heightWeapons'],p,errors);
      result.flightControls={...Object.fromEntries(keys.map(key=>[key,number(s[key],0,0,10000,`${p}.${key}`,errors)])),initial:choice<'normal'|'low'|'high'>(s.initial,['normal','low','high'],'normal',`${p}.initial`,errors),damageThresholds:[]} as unknown as FlightControlSpec;
      if(!Array.isArray(s.damageThresholds)||s.damageThresholds.length>8)issue(errors,`${p}.damageThresholds`,'must be at most eight health fractions');
      else result.flightControls.damageThresholds=s.damageThresholds.map((v,i)=>number(v,0,0,1,`${p}.damageThresholds[${i}]`,errors));
      if(result.flightControls.heightRate<=0)issue(errors,`${p}.heightRate`,'must be positive');
      if(s.highRangeBonus!==undefined)result.flightControls.highRangeBonus=number(s.highRangeBonus,0,0,256,`${p}.highRangeBonus`,errors);
      if(s.rangeWeapons!==undefined)result.flightControls.rangeWeapons=Array.isArray(s.rangeWeapons)&&!s.rangeWeapons.length?[]:ids(s.rangeWeapons,16,`${p}.rangeWeapons`,errors);
      if(s.heightWeapons!==undefined)result.flightControls.heightWeapons=list(s.heightWeapons,16,`${p}.heightWeapons`,errors,(w,wp)=>{fields(w,['id','below','above'],wp,errors);return {id:identifier(w.id,`${wp}.id`,errors),...(w.below!==undefined?{below:number(w.below,0,0,10000,`${wp}.below`,errors)}:{}),...(w.above!==undefined?{above:number(w.above,0,0,10000,`${wp}.above`,errors)}:{})};});
    }
  }
  for(const key of ['fixedWing','airSuperiority','electronicWarfare'] as const)if(value[key]!==undefined)result[key]=flag(value[key],false,`${path}.${key}`,errors);
  if(value.ecm!==undefined)result.ecm=number(value.ecm,0,0,10000,`${path}.ecm`,errors);
  if(value.altitude!==undefined)result.altitude=choice<'normal'|'low'|'high'>(value.altitude,['normal','low','high'],'normal',`${path}.altitude`,errors);
  if(value.helicopter!==undefined)result.helicopter=flag(value.helicopter,false,`${path}.helicopter`,errors);
  if(value.unmanned!==undefined)result.unmanned=flag(value.unmanned,false,`${path}.unmanned`,errors);
  if(value.countermeasures!==undefined){
    if(!record(value.countermeasures))issue(errors,`${path}.countermeasures`,'must be an object');
    else { const s=value.countermeasures,p=`${path}.countermeasures`;fields(s,['charges','reload','range','x','y','life','speed','radius','energy'],p,errors);
      result.countermeasures={charges:number(s.charges,1,1,10000,`${p}.charges`,errors,true),reload:number(s.reload,.5,.01,600,`${p}.reload`,errors),range:number(s.range,180,0,10000,`${p}.range`,errors),x:number(s.x,0,-1000,1000,`${p}.x`,errors),y:number(s.y,18,-1000,1000,`${p}.y`,errors),life:number(s.life,.5,.01,600,`${p}.life`,errors),speed:number(s.speed,192,0,10000,`${p}.speed`,errors),radius:number(s.radius,80,0,10000,`${p}.radius`,errors),energy:number(s.energy,60,0,10000,`${p}.energy`,errors)};}
  }
  if (value.obstruction !== undefined) {
    if (!record(value.obstruction)) issue(errors, `${path}.obstruction`, 'must be an object');
    else { fields(value.obstruction, ['forest', 'smoke'], `${path}.obstruction`, errors); result.obstruction = { forest: flag(value.obstruction.forest, false, `${path}.obstruction.forest`, errors), smoke: flag(value.obstruction.smoke, false, `${path}.obstruction.smoke`, errors) }; }
  }
  if(value.fpvOperator!==undefined)result.fpvOperator=readFpvOperator(value.fpvOperator,path+'.fpvOperator',errors,context);
  if(value.fpvDrone!==undefined)result.fpvDrone=readFpvDrone(value.fpvDrone,path+'.fpvDrone',errors,context);
  if (value.remote !== undefined) {
    if (!record(value.remote)) issue(errors, `${path}.remote`, 'must be an object');
    else {
      const r = value.remote, p = `${path}.remote`; fields(r, ['channel', 'range', 'commands'], p, errors);
      const commands = ids(r.commands, 2, `${p}.commands`, errors).filter(x => { if (x !== 'move' && x !== 'attack') { issue(errors, `${p}.commands`, 'only move and attack are supported'); return false; } return true; }) as ('move' | 'attack')[];
      result.remote = { channel: identifier(r.channel, `${p}.channel`, errors), range: number(r.range, 20, .1, 256, `${p}.range`, errors), commands };
    }
  }
  return result;
}

export function readGuidanceDef(value: unknown, path: string, errors: ContentIssue[], context?: ExtensionSpecContext): GuidanceDef | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['mode', 'channel', 'range', 'cone', 'turnRate', 'acquire', 'lossGrace', 'reacquire', 'maxLife', 'forest', 'smoke', 'decoyResistance', 'sourceFlight', 'launchArc'], path, errors);
  const index = path.match(/weapons\[(\d+)\]/)?.[1], list = context?.definition?.weapons;
  const weapon = index !== undefined && Array.isArray(list) ? list[Number(index)] : undefined;
  if (context?.definition?.mine !== undefined || context?.definition?.kamikaze || record(weapon) && (weapon.arc || weapon.projectile === 'fire' || weapon.projectile === 'smoke' || record(weapon.look) && weapon.look.beam)) issue(errors, path, 'guidance requires a travelling, non-ballistic projectile on an ordinary weapon');

  const result: GuidanceDef = { mode: choice(value.mode, ['self', 'designation', 'illumination', 'emitter'], 'self', `${path}.mode`, errors), channel: identifier(value.channel, `${path}.channel`, errors),
    range: number(value.range, 20, .1, 256, `${path}.range`, errors), cone: number(value.cone, Math.PI, .01, Math.PI, `${path}.cone`, errors), turnRate: number(value.turnRate, 7, .01, 100, `${path}.turnRate`, errors),
    acquire: number(value.acquire, 0, 0, 120, `${path}.acquire`, errors), lossGrace: number(value.lossGrace, 0, 0, 120, `${path}.lossGrace`, errors), reacquire: flag(value.reacquire, false, `${path}.reacquire`, errors),
    maxLife: number(value.maxLife, 10, .01, 600, `${path}.maxLife`, errors), forest: flag(value.forest, false, `${path}.forest`, errors), smoke: flag(value.smoke, false, `${path}.smoke`, errors), decoyResistance: number(value.decoyResistance, 0, 0, 1, `${path}.decoyResistance`, errors) };
  if(value.launchArc!==undefined)result.launchArc=number(value.launchArc,Math.PI,0,Math.PI,`${path}.launchArc`,errors);
  if(value.sourceFlight!==undefined){
    if(!record(value.sourceFlight))issue(errors,`${path}.sourceFlight`,'must be an object');
    else{const s=value.sourceFlight,p=`${path}.sourceFlight`;const keys=['speed','acceleration','turnRate','turnAcceleration','inheritSpeed','launchLeg','launchTime','sample','lossDelay','fovDegrees','life','resistance','proximity','blastRadius'];fields(s,[...keys,'radar','heightRate'],p,errors);
      result.sourceFlight=Object.fromEntries(keys.map(key=>[key,number(s[key],key==='sample'?8/60:1,key==='sample'?.001:0,key==='inheritSpeed'?1:key==='fovDegrees'?180:10000,`${p}.${key}`,errors)])) as unknown as SourceFlightSpec;
      if(s.heightRate!==undefined)result.sourceFlight.heightRate=number(s.heightRate,1800,0,1e6,`${p}.heightRate`,errors);
      if(s.radar!==undefined){
        if(!record(s.radar))issue(errors,`${p}.radar`,'must be an object');
        else{const r=s.radar,radarKeys=['range','ecmX','ecmY','lowPenalty','lostChecks','lockDelay','scriptInterval','seekerInterval','speedDrop','speedUp','speedDown','speedFloor'];fields(r,[...radarKeys,'canLose','semiActive'],`${p}.radar`,errors);
          result.sourceFlight.radar={...Object.fromEntries(radarKeys.map(key=>[key,number(r[key],0,0,10000,`${p}.radar.${key}`,errors)])),canLose:flag(r.canLose,true,`${p}.radar.canLose`,errors),semiActive:flag(r.semiActive,false,`${p}.radar.semiActive`,errors)} as unknown as RadarFlightSpec;
          if(result.sourceFlight.radar.scriptInterval<=0||result.sourceFlight.radar.seekerInterval<=0)issue(errors,`${p}.radar`,'requires positive clock intervals');
        }
      }
      if(result.sourceFlight.sample<=0||result.sourceFlight.life<=0||result.sourceFlight.acceleration<=0||result.sourceFlight.turnAcceleration<=0)issue(errors,p,'requires positive sample, life and acceleration');
    }
  }
  return result;
}

/** Sandbox loadouts own released helper entities; they are not factory recipes. */
export function validateSensorsReferences(def: import('../../../../../../steel-tide/game/core/src/core/types').UnitDef, table: Record<string, import('../../../../../../steel-tide/game/core/src/core/types').UnitDef>, path:string, errors:ContentIssue[], forms?:Set<string>):void {
  const carrier=(def.extensions?.['sensors-v1'] as SensorsDef|undefined)?.seadCarrier;
  const operator=(def.extensions?.['sensors-v1'] as SensorsDef|undefined)?.fpvOperator;
  for(const [i,id]of (operator?.drones??[]).entries()){forms?.add(id);const helper=table[id],role=(helper?.extensions?.['sensors-v1'] as SensorsDef|undefined)?.fpvDrone?.role;if(!helper||helper.kind!=='unit'||helper.domain!=='air'||helper.warhead||role!==(i===0?'recon':'attack'))issue(errors,path+'.fpvOperator.drones','must name matching source drone bodies');}
  if(!carrier)return;
  forms?.add(carrier.helper);
  const helper=table[carrier.helper],cfg=helper?.extensions?.['sensors-v1'] as SensorsDef|undefined;
  if(!helper||helper.kind!=='unit'||helper.domain!=='air'||helper.warhead||helper.transportCap||cfg?.seadMissile?.family!==carrier.family)
    issue(errors,path+'.seadCarrier.helper','must name a matching source anti-radiation missile unit');
}
