import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { fields, number, record, issue, identifier } from './sensorsSpec';
export interface EffectPicture {
  asset: string; life: number; duration: number; frames: number; first: number; last: number; fps: number; loop: boolean;
  fade: boolean; fadeIn: number; scaleFrom: number; scaleTo: number; alpha: number;
  x: number; y: number; forward: number; lateral: number; vx: number; vy: number; speedForward: number; speedLateral: number;
  dir: number; zero: boolean; under: boolean;
  height?: number; heightVelocity?: number; spin?: number; atmospheric?: boolean; physics?: boolean; gravity?: number; showInFog?: boolean;
  random?: Partial<Record<'x'|'y'|'forward'|'lateral'|'height'|'vx'|'vy'|'speedForward'|'speedLateral'|'heightVelocity'|'dir', number>>;
}
export function readEffectPicture(raw: unknown, path: string, errors: ContentIssue[], context?: ExtensionSpecContext): EffectPicture | undefined {
  if (!record(raw)) { issue(errors, path, 'must be an object'); return; }
  const numeric = ['life', 'frames', 'first', 'last', 'fps', 'fadeIn', 'scaleFrom', 'scaleTo', 'alpha', 'x', 'y', 'forward', 'lateral', 'vx', 'vy', 'speedForward', 'speedLateral', 'dir'] as const;
  fields(raw, ['asset', ...numeric, 'duration', 'loop', 'fade', 'zero', 'under', 'random', 'height', 'heightVelocity', 'spin', 'atmospheric', 'physics', 'gravity', 'showInFog'], path, errors);
  const asset = identifier(raw.asset, `${path}.asset`, errors);
  if (!context?.assetIds?.has(asset)) issue(errors, `${path}.asset`, 'must name original package art');
  const out = { asset } as EffectPicture;
  for (const key of numeric) out[key] = number(raw[key], key === 'frames' ? 1 : 0, ['x','y','forward','lateral','vx','vy','speedForward','speedLateral','dir'].includes(key) ? -10000 : 0, 10000, `${path}.${key}`, errors);
  out.duration = number(raw.duration, out.life, .0001, out.life, `${path}.duration`, errors);
  for (const key of ['height', 'heightVelocity', 'spin', 'gravity'] as const) if (raw[key] !== undefined) out[key] = number(raw[key], key === 'gravity' ? 1 : 0, key === 'gravity' ? 0 : -10000, 10000, `${path}.${key}`, errors);
  for (const key of ['atmospheric', 'physics', 'showInFog'] as const) if (raw[key] !== undefined) {
    if (typeof raw[key] !== 'boolean') issue(errors, `${path}.${key}`, 'must be boolean');
    out[key] = raw[key] === true;
  }
  if (raw.random !== undefined) {
    if (!record(raw.random)) issue(errors, `${path}.random`, 'must be an object');
    else {
      const keys = ['x','y','forward','lateral','height','vx','vy','speedForward','speedLateral','heightVelocity','dir'] as const;
      fields(raw.random, [...keys], `${path}.random`, errors); out.random = {};
      for (const key of keys) if (raw.random[key] !== undefined) out.random[key] = number(raw.random[key], 0, 0, 10000, `${path}.random.${key}`, errors);
    }
  }
  for (const key of ['loop', 'fade', 'zero', 'under'] as const) {
    if (typeof raw[key] !== 'boolean') issue(errors, `${path}.${key}`, 'must be boolean');
    out[key] = raw[key] === true;
  }
  if (out.life <= 0 || out.frames < 1 || out.frames > 64 || !Number.isInteger(out.frames) || !Number.isInteger(out.first) || !Number.isInteger(out.last) || out.last < out.first) issue(errors, path, 'invalid source animation bounds');
  return out;
}
