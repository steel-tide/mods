import type { ContentIssue, ContentText } from '../../../../steel-tide/game/core/src/game/contentDefs';
import type { TargetDomain } from '../../../../steel-tide/game/core/src/core/types';
import type { ExtensionSpecContext } from '../../../../steel-tide/game/core/src/game/extensions/contracts';

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
export interface SensorsDef {
  sensors: SensorSpec[]; emitters: EmitterSpec[]; decoys: DecoySpec[];
  signatures: { channel: string; strength: number }[];
  obstruction?: { forest: boolean; smoke: boolean };
  remote?: { channel: string; range: number; commands: ('move' | 'attack')[] };
}
export interface GuidanceDef {
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

export function readSensorsDef(value: unknown, path: string, errors: ContentIssue[]): SensorsDef | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['sensors', 'emitters', 'decoys', 'signatures', 'obstruction', 'remote'], path, errors);
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
  if (value.obstruction !== undefined) {
    if (!record(value.obstruction)) issue(errors, `${path}.obstruction`, 'must be an object');
    else { fields(value.obstruction, ['forest', 'smoke'], `${path}.obstruction`, errors); result.obstruction = { forest: flag(value.obstruction.forest, false, `${path}.obstruction.forest`, errors), smoke: flag(value.obstruction.smoke, false, `${path}.obstruction.smoke`, errors) }; }
  }
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
  fields(value, ['mode', 'channel', 'range', 'cone', 'turnRate', 'acquire', 'lossGrace', 'reacquire', 'maxLife', 'forest', 'smoke', 'decoyResistance'], path, errors);
  const index = path.match(/weapons\[(\d+)\]/)?.[1], list = context?.definition?.weapons;
  const weapon = index !== undefined && Array.isArray(list) ? list[Number(index)] : undefined;
  if (context?.definition?.mine !== undefined || context?.definition?.kamikaze || record(weapon) && (weapon.arc || weapon.projectile === 'fire' || weapon.projectile === 'smoke' || record(weapon.look) && weapon.look.beam)) issue(errors, path, 'guidance requires a travelling, non-ballistic projectile on an ordinary weapon');

  return { mode: choice(value.mode, ['self', 'designation', 'illumination', 'emitter'], 'self', `${path}.mode`, errors), channel: identifier(value.channel, `${path}.channel`, errors),
    range: number(value.range, 20, .1, 256, `${path}.range`, errors), cone: number(value.cone, Math.PI, .01, Math.PI, `${path}.cone`, errors), turnRate: number(value.turnRate, 7, .01, 100, `${path}.turnRate`, errors),
    acquire: number(value.acquire, 0, 0, 120, `${path}.acquire`, errors), lossGrace: number(value.lossGrace, 0, 0, 120, `${path}.lossGrace`, errors), reacquire: flag(value.reacquire, false, `${path}.reacquire`, errors),
    maxLife: number(value.maxLife, 10, .01, 600, `${path}.maxLife`, errors), forest: flag(value.forest, false, `${path}.forest`, errors), smoke: flag(value.smoke, false, `${path}.smoke`, errors), decoyResistance: number(value.decoyResistance, 0, 0, 1, `${path}.decoyResistance`, errors) };
}
