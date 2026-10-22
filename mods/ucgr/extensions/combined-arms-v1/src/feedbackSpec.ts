import { readEffectPicture, type EffectPicture } from './effectPictures';
import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { ExtensionSpecContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { fields, identifier, issue, list, number, record } from './sensorsSpec';
import type { ComponentsDef } from './componentsSpec';

export const FEEDBACK_ID = 'usgr-re.feedback-v1';
export interface VoiceCue { assets: string[]; gain: number }
export interface Cosmetic { part: string; damaged: string; destroyed: string; x: number; y: number; scale: number }
export interface AudioFeedback { death?: VoiceCue; shots: { weapon: string; cue: VoiceCue; delay?: number; atProjectile?: boolean }[]; periodic: { interval: number; cue: VoiceCue }[]; reloads: { stock: string; cue: VoiceCue }[] }
export interface ProjectileVariant { kind: 'helper' | 'fragment'; index: number; branch?: number }
export function sameProjectileVariant(a: ProjectileVariant | undefined, b: ProjectileVariant | undefined): boolean { return a?.kind === b?.kind && a?.index === b?.index && (a?.branch ?? -1) === (b?.branch ?? -1); }
export function impactTopic(weapon: string, variant?: ProjectileVariant): string { return variant ? `${weapon}~${variant.kind}~${variant.index}~${variant.branch ?? -1}` : weapon; }
export interface ProjectilePicture { weapon: string; variant?: ProjectileVariant; asset?: string; hidden?: boolean; scale: number }
export interface WreckPicture { asset: string; scale: number; x: number; y: number }
export interface EraPicture { face: 'front' | 'side' | 'rear'; maximum: number; asset: string; x: number; y: number; scaleX: number; scaleY: number; alpha: number }
export interface ImpactSound { picture?: EffectPicture; chance: number; land: boolean; water: boolean; cue?: VoiceCue; children?: ImpactSound[] }
export interface AppearanceState { ground?: string; fixedDirection?: boolean; deployed: boolean; minimum: number; body: string; mounts: Record<string, string>; radar?: { sprite: string; x: number; y: number; active: boolean } }
export interface FeedbackDef { actions?: Record<string, ImpactSound[]>; appearance?: { stock?: string; variantModulo?: number; states: AppearanceState[] }; rack?: { threshold: number; low: ImpactSound[]; high: ImpactSound[] }; flashes?: { weapon: string; effects: ImpactSound[] }[]; impacts?: { weapon: string; variant?: ProjectileVariant; effects: ImpactSound[] }[]; era?: EraPicture[]; wreck?: WreckPicture[]; projectiles?: ProjectilePicture[]; audio?: AudioFeedback; voices: Partial<Record<'select' | 'move' | 'attack', VoiceCue>>; cosmetics: Cosmetic[] }
export function readFeedbackDef(raw: unknown, path: string, errors: ContentIssue[], context?: ExtensionSpecContext): FeedbackDef | undefined {
  if (!record(raw)) { issue(errors, path, 'must be an object'); return; }
  fields(raw, ['voices', 'cosmetics', 'audio', 'projectiles', 'wreck', 'era', 'impacts', 'flashes', 'rack', 'appearance', 'actions'], path, errors);
  const asset = (value: unknown, p: string): string => {
    const id = identifier(value, p, errors);
    if (!context?.assetIds?.has(id)) issue(errors, p, 'must name an asset carried by this extension package');
    return id;
  };
  const voices: FeedbackDef['voices'] = {};
  if (!record(raw.voices)) issue(errors, `${path}.voices`, 'must be an object; empty means source silence');
  else {
    fields(raw.voices, ['select', 'move', 'attack'], `${path}.voices`, errors);
    for (const action of ['select', 'move', 'attack'] as const) {
      const cue = raw.voices[action], p = `${path}.voices.${action}`;
      if (cue === undefined) continue;
      if (!record(cue)) { issue(errors, p, 'must be an object'); continue; }
      fields(cue, ['assets', 'gain'], p, errors);
      if (!Array.isArray(cue.assets) || !cue.assets.length || cue.assets.length > 16) {
        issue(errors, `${p}.assets`, 'must contain one to sixteen recordings'); continue;
      }
      voices[action] = { assets: cue.assets.map((id, i) => asset(id, `${p}.assets[${i}]`)), gain: number(cue.gain, .3, 0, 4, `${p}.gain`, errors) };
    }
  }
  const cosmetics = list(raw.cosmetics, 16, `${path}.cosmetics`, errors, (c, p): Cosmetic => {
    fields(c, ['part', 'damaged', 'destroyed', 'x', 'y', 'scale'], p, errors);
    return { part: identifier(c.part, `${p}.part`, errors), damaged: asset(c.damaged, `${p}.damaged`), destroyed: asset(c.destroyed, `${p}.destroyed`),
      x: number(c.x, 0, -128, 128, `${p}.x`, errors), y: number(c.y, 0, -128, 128, `${p}.y`, errors), scale: number(c.scale, 1, .01, 4, `${p}.scale`, errors) };
  });
  if (new Set(cosmetics.map(c => c.part)).size !== cosmetics.length) issue(errors, `${path}.cosmetics`, 'each part may have only one indicator pair');
  let audio: AudioFeedback | undefined;
  if (raw.audio !== undefined) {
    const p = `${path}.audio`;
    if (!record(raw.audio)) issue(errors, p, 'must be an object');
    else {
      fields(raw.audio, ['death', 'periodic', 'reloads', 'shots'], p, errors);
      const cue = (raw: unknown, p: string): VoiceCue => {
        if (!record(raw)) { issue(errors, p, 'must be an object'); return { assets: [], gain: 1 }; }
        fields(raw, ['assets', 'gain'], p, errors);
        if (!Array.isArray(raw.assets) || !raw.assets.length || raw.assets.length > 16) issue(errors, `${p}.assets`, 'must contain one to sixteen recordings');
        return { assets: Array.isArray(raw.assets) ? raw.assets.map((id, i) => asset(id, `${p}.assets[${i}]`)) : [], gain: number(raw.gain, 1, 0, 4, `${p}.gain`, errors) };
      };
      audio = {
        shots: list(raw.audio.shots, 16, `${p}.shots`, errors, (v, p) => {
          fields(v, ['weapon', 'cue', 'delay', 'atProjectile'], p, errors);
          const weapon = identifier(v.weapon, `${p}.weapon`, errors);
          if (context?.weaponIds && !context.weaponIds.includes(weapon)) issue(errors, `${p}.weapon`, 'must name a weapon on this definition');
          if (v.atProjectile !== undefined && v.atProjectile !== true) issue(errors, `${p}.atProjectile`, 'must be true when supplied');
          if (v.delay !== undefined && v.atProjectile !== true) issue(errors, `${p}.delay`, 'queued helper sound must follow its projectile');
          return { weapon, cue: cue(v.cue, `${p}.cue`), ...(v.delay !== undefined ? { delay: number(v.delay, 0, .001, 60, `${p}.delay`, errors) } : {}), ...(v.atProjectile === true ? { atProjectile: true } : {}) };
        }),
        periodic: list(raw.audio.periodic, 8, `${p}.periodic`, errors, (v, p) => {
          fields(v, ['interval', 'cue'], p, errors);
          return { interval: number(v.interval, 2, .1, 3600, `${p}.interval`, errors), cue: cue(v.cue, `${p}.cue`) };
        }),
        reloads: list(raw.audio.reloads, 32, `${p}.reloads`, errors, (v, p) => {
          fields(v, ['stock', 'cue'], p, errors);
          const stock = identifier(v.stock, `${p}.stock`, errors);
          const logistics = (context?.definition?.extensions as Record<string, unknown> | undefined)?.['logistics-v1'] as { stocks?: { id: string }[] } | undefined;
          if (logistics && !logistics.stocks?.some(s => s.id === stock)) issue(errors, `${p}.stock`, 'must name an authored ammunition stock');
          return { stock, cue: cue(v.cue, `${p}.cue`) };
        }),
      };
      if (raw.audio.death !== undefined) audio.death = cue(raw.audio.death, `${p}.death`);
    }
  }
  const readVariant = (value: unknown, p: string): ProjectileVariant | undefined => {
    if (value === undefined) return;
    if (!record(value)) { issue(errors, p, 'must be an object'); return; }
    fields(value, ['kind', 'index', 'branch'], p, errors);
    if (value.kind !== 'helper' && value.kind !== 'fragment') issue(errors, `${p}.kind`, 'must identify an original helper or fragment');
    const index = number(value.index, 0, 0, value.kind === 'fragment' ? 2 : 63, `${p}.index`, errors);
    if (!Number.isSafeInteger(index)) issue(errors, `${p}.index`, 'must be an integer');
    const branch = value.branch === undefined ? undefined : number(value.branch, -1, -1, 63, `${p}.branch`, errors);
    if (branch !== undefined && (!Number.isSafeInteger(branch) || value.kind !== 'fragment')) issue(errors, `${p}.branch`, 'must identify a source fragment helper branch');
    return { kind: value.kind as ProjectileVariant['kind'], index, ...(branch !== undefined ? { branch } : {}) };
  };
  const projectiles = raw.projectiles === undefined ? undefined : list(raw.projectiles, 4160, `${path}.projectiles`, errors, (v, p): ProjectilePicture => {
    fields(v, ['weapon', 'asset', 'hidden', 'scale', 'variant'], p, errors);
    const weapon = identifier(v.weapon, `${p}.weapon`, errors);
    if (context?.weaponIds && !context.weaponIds.includes(weapon)) issue(errors, `${p}.weapon`, 'must name a weapon on this definition');
    if (v.hidden !== true && v.asset === undefined) issue(errors, p, 'visible projectile requires original image');
    const variant = readVariant(v.variant, `${p}.variant`);
    return { weapon, ...(variant ? { variant } : {}), ...(v.asset !== undefined ? { asset: asset(v.asset, `${p}.asset`) } : {}), ...(v.hidden === true ? { hidden: true } : {}), scale: number(v.scale, 1, .0001, 10, `${p}.scale`, errors) };
  });
  const wreck = raw.wreck === undefined ? undefined : list(raw.wreck, 16, `${path}.wreck`, errors, (v, p): WreckPicture => {
    fields(v, ['asset', 'scale', 'x', 'y'], p, errors);
    return { asset: asset(v.asset, `${p}.asset`), scale: number(v.scale, 1, 0, 10, `${p}.scale`, errors), x: number(v.x, 0, -512, 512, `${p}.x`, errors), y: number(v.y, 0, -512, 512, `${p}.y`, errors) };
  });
  const era = raw.era === undefined ? undefined : list(raw.era, 3, `${path}.era`, errors, (v, p): EraPicture => {
    fields(v, ['face', 'maximum', 'asset', 'x', 'y', 'scaleX', 'scaleY', 'alpha'], p, errors);
    if (!['front', 'side', 'rear'].includes(String(v.face))) issue(errors, `${p}.face`, 'must name a hull facing');
    return { face: v.face as EraPicture['face'], maximum: number(v.maximum, 1, .001, 100000, `${p}.maximum`, errors), asset: asset(v.asset, `${p}.asset`),
      x: number(v.x, 0, -512, 512, `${p}.x`, errors), y: number(v.y, 0, -512, 512, `${p}.y`, errors), scaleX: number(v.scaleX, 1, .001, 10, `${p}.scaleX`, errors), scaleY: number(v.scaleY, 1, .001, 10, `${p}.scaleY`, errors), alpha: number(v.alpha, 1, 0, 1, `${p}.alpha`, errors) };
  });
  const impactTree = (value: unknown, p: string, depth = 0): ImpactSound[] => {
    if (depth > 4) { issue(errors, p, 'effect sound tree exceeds four levels'); return []; }
    return list(value, 64, p, errors, (v, p): ImpactSound => {
      fields(v, ['chance', 'cue', 'children', 'picture', 'land', 'water'], p, errors);
      for (const key of ['land', 'water']) if (v[key] !== undefined && typeof v[key] !== 'boolean') issue(errors, `${p}.${key}`, 'must be boolean');
      const node: ImpactSound = { chance: number(v.chance, 1, 0, 1, `${p}.chance`, errors), land: v.land !== false, water: v.water !== false };
      if (v.cue !== undefined) {
        if (!record(v.cue) || !Array.isArray(v.cue.assets) || !v.cue.assets.length || v.cue.assets.length > 16) issue(errors, `${p}.cue`, 'must name original recordings');
        else node.cue = { assets: v.cue.assets.map((id, i) => asset(id, `${p}.cue.assets[${i}]`)), gain: number(v.cue.gain, 1, 0, 4, `${p}.cue.gain`, errors) };
      }
      if (v.picture !== undefined) node.picture = readEffectPicture(v.picture, `${p}.picture`, errors, context);
      if (v.children !== undefined) node.children = impactTree(v.children, `${p}.children`, depth + 1);
      return node;
    });
  };
  const impacts = raw.impacts === undefined ? undefined : list(raw.impacts, 4160, `${path}.impacts`, errors, (v, p) => {
    fields(v, ['weapon', 'effects', 'variant'], p, errors);
    const weapon = identifier(v.weapon, `${p}.weapon`, errors);
    if (context?.weaponIds && !context.weaponIds.includes(weapon)) issue(errors, `${p}.weapon`, 'must name a weapon on this definition');
    const variant = readVariant(v.variant, `${p}.variant`);
    return { weapon, ...(variant ? { variant } : {}), effects: impactTree(v.effects, `${p}.effects`) };
  });
  const flashes = raw.flashes === undefined ? undefined : list(raw.flashes, 16, `${path}.flashes`, errors, (v, p) => {
    fields(v, ['weapon', 'effects'], p, errors);
    const weapon = identifier(v.weapon, `${p}.weapon`, errors);
    if (context?.weaponIds && !context.weaponIds.includes(weapon)) issue(errors, `${p}.weapon`, 'must name a weapon on this definition');
    return { weapon, effects: impactTree(v.effects, `${p}.effects`) };
  });
  let actions: FeedbackDef['actions'];
  if (raw.actions !== undefined) {
    if (!record(raw.actions)) issue(errors, `${path}.actions`, 'must be an object');
    else { actions = {}; for (const [key, effects] of Object.entries(raw.actions)) actions[identifier(key, `${path}.actions`, errors)] = impactTree(effects, `${path}.actions.${key}`); }
  }
  let rack: FeedbackDef['rack'];
  if (raw.rack !== undefined) {
    if (!record(raw.rack)) issue(errors, `${path}.rack`, 'must be an object');
    else { fields(raw.rack, ['threshold', 'low', 'high'], `${path}.rack`, errors); rack = { threshold: number(raw.rack.threshold, 330, 0, 1e8, `${path}.rack.threshold`, errors), low: impactTree(raw.rack.low, `${path}.rack.low`), high: impactTree(raw.rack.high, `${path}.rack.high`) }; }
  }
  let appearance: FeedbackDef['appearance'];
  if (raw.appearance !== undefined) {
    const p = `${path}.appearance`;
    if (!record(raw.appearance)) issue(errors, p, 'must be an object');
    else {
      fields(raw.appearance, ['stock', 'states', 'variantModulo'], p, errors);
      const sprite = (v: unknown, p: string): string => {
        if (typeof v !== 'string' || !context?.spriteKeys?.has(v)) { issue(errors, p, 'must name original pack-owned art'); return ''; }
        return v;
      };
      appearance = { states: list(raw.appearance.states, 34, `${p}.states`, errors, (v, p): AppearanceState => {
        fields(v, ['deployed', 'minimum', 'body', 'mounts', 'radar', 'ground', 'fixedDirection'], p, errors);
        if (typeof v.deployed !== 'boolean') issue(errors, `${p}.deployed`, 'must be boolean');
        const mounts: Record<string, string> = {};
        if (!record(v.mounts)) issue(errors, `${p}.mounts`, 'must be an object');
        else for (const [id, value] of Object.entries(v.mounts)) mounts[identifier(id, `${p}.mounts`, errors)] = sprite(value, `${p}.mounts.${id}`);
        const out: AppearanceState = { deployed: v.deployed === true, minimum: number(v.minimum, 0, 0, 16, `${p}.minimum`, errors), body: sprite(v.body, `${p}.body`), mounts };
        if (v.ground !== undefined) out.ground = sprite(v.ground, `${p}.ground`);
        if (v.fixedDirection !== undefined) { if (v.fixedDirection !== true) issue(errors, `${p}.fixedDirection`, 'must be true when supplied'); out.fixedDirection = v.fixedDirection === true; }
        if (v.radar !== undefined) {
          if (!record(v.radar)) issue(errors, `${p}.radar`, 'must be an object');
          else {
            fields(v.radar, ['sprite', 'x', 'y', 'active'], `${p}.radar`, errors);
            if (typeof v.radar.active !== 'boolean') issue(errors, `${p}.radar.active`, 'must be boolean');
            out.radar = { sprite: sprite(v.radar.sprite, `${p}.radar.sprite`), x: number(v.radar.x, 0, -128, 128, `${p}.radar.x`, errors), y: number(v.radar.y, 0, -128, 128, `${p}.radar.y`, errors), active: v.radar.active === true };
          }
        }
        return out;
      }) };
      if (raw.appearance.variantModulo !== undefined) appearance.variantModulo = number(raw.appearance.variantModulo, 3, 2, 16, `${p}.variantModulo`, errors);
      if (raw.appearance.stock !== undefined) appearance.stock = identifier(raw.appearance.stock, `${p}.stock`, errors);
    }
  }
  return { voices, cosmetics, ...(actions ? { actions } : {}), ...(appearance ? { appearance } : {}), ...(rack ? { rack } : {}), ...(flashes ? { flashes } : {}), ...(impacts ? { impacts } : {}), ...(era ? { era } : {}), ...(wreck ? { wreck } : {}), ...(audio ? { audio } : {}), ...(projectiles ? { projectiles } : {}) };
}
export function validateFeedbackReferences(def: UnitDef, _table: Record<string, UnitDef>, path: string, errors: ContentIssue[]): void {
  const feedback = def.extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
  const components = def.extensions?.['components-v1'] as ComponentsDef | undefined;
  for (const c of feedback?.cosmetics ?? []) if (!components?.parts.some(p => p.id === c.part)) issue(errors, `${path}.extensions.${FEEDBACK_ID}.cosmetics`, `unknown component ${c.part}`);
}

/** One source lookup shared by validation of saved particles and their renderer. */
export function feedbackEffectPicture(cfg: FeedbackDef | undefined, topic: string, branch: string): EffectPicture | undefined {
  let nodes = topic === 'rack-low' ? cfg?.rack?.low : topic === 'rack-high' ? cfg?.rack?.high
    : topic.startsWith('action-') ? cfg?.actions?.[topic.slice(7)]
    : topic.startsWith('shot-') ? cfg?.flashes?.find(i => i.weapon === topic.slice(5))?.effects
    : cfg?.impacts?.find(i => impactTopic(i.weapon, i.variant) === topic)?.effects, node: ImpactSound | undefined;
  for (const part of branch.split('.')) { node = nodes?.[Number(part)]; nodes = node?.children; }
  return node?.picture;
}
