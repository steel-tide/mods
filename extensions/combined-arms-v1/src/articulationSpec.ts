import type { ContentIssue, ContentText } from '../../../../steel-tide/game/core/src/game/contentDefs';
import type { UnitDef } from '../../../../steel-tide/game/core/src/core/types';
import type { ExtensionSpecContext } from '../../../../steel-tide/game/core/src/game/extensions/contracts';
import { choice, fields, flag, identifier, ids, issue, label, list, number, record, unique } from './sensorsSpec';

export interface MountSpec {
  id: string; label: ContentText; sprite?: string; parent?: string;
  x: number; y: number; rest: number; arc: number; turnRate: number;
  weapons: string[]; targeting: 'shared' | 'independent'; tolerance: number;
}
export interface AttachmentSpec {
  id: string; label: ContentText; unit: string; x: number; y: number;
  rest: number; rotation: 'fixed' | 'independent';
  fire: 'none' | 'parent' | 'independent'; select: 'parent' | 'self'; onParentDeath: 'kill' | 'detach';
}
export interface TowSpec { accepts: string[]; range: number; length: number; speed: number; maxWeight: number; detachOnMove: boolean }
export interface DeploymentSpec {
  id: string; label: ContentText; to: string; time: number; metal: number;
  cancelable: boolean; health: 'fraction' | 'absolute'; cargo: 'retain' | 'empty';
  automatic?: 'idle' | 'move'; orders: 'clear' | 'retain'; lockWeapons: boolean;
}
export interface ArticulationDef {
  mounts: MountSpec[]; attachments: AttachmentSpec[]; deployments: DeploymentSpec[];
  /** A selection/order controller for actual attached members. */
  squad: boolean; tow?: TowSpec;
  disabledWeapons: string[];
}

export function readArticulationDef(value: unknown, path: string, errors: ContentIssue[], context?: ExtensionSpecContext): ArticulationDef | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['mounts', 'attachments', 'deployments', 'squad', 'tow', 'disabledWeapons'], path, errors);
  const mounts = list(value.mounts, 8, `${path}.mounts`, errors, (s, p): MountSpec => {
    fields(s, ['id', 'label', 'sprite', 'parent', 'x', 'y', 'rest', 'arc', 'turnRate', 'weapons', 'targeting', 'tolerance'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    const out: MountSpec = { id, label: label(s.label, id, `${p}.label`, errors), x: number(s.x, 0, -512, 512, `${p}.x`, errors), y: number(s.y, 0, -512, 512, `${p}.y`, errors),
      rest: number(s.rest, 0, -Math.PI, Math.PI, `${p}.rest`, errors), arc: number(s.arc, Math.PI, .01, Math.PI, `${p}.arc`, errors), turnRate: number(s.turnRate, 3, .01, 100, `${p}.turnRate`, errors),
      weapons: ids(s.weapons, 8, `${p}.weapons`, errors), targeting: choice(s.targeting, ['shared', 'independent'], 'independent', `${p}.targeting`, errors), tolerance: number(s.tolerance, .2, .001, 1, `${p}.tolerance`, errors) };
    if (s.sprite !== undefined) out.sprite = identifier(s.sprite, `${p}.sprite`, errors);
    if (out.sprite && context?.spriteKeys && !context.spriteKeys.has(out.sprite)) issue(errors, `${p}.sprite`, 'must name an existing or pack-owned sprite');
    if (s.parent !== undefined) out.parent = identifier(s.parent, `${p}.parent`, errors);
    return out;
  });
  const attachments = list(value.attachments, 16, `${path}.attachments`, errors, (s, p): AttachmentSpec => {
    fields(s, ['id', 'label', 'unit', 'x', 'y', 'rest', 'rotation', 'fire', 'select', 'onParentDeath'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    return { id, label: label(s.label, id, `${p}.label`, errors), unit: identifier(s.unit, `${p}.unit`, errors),
      x: number(s.x, 0, -256, 256, `${p}.x`, errors), y: number(s.y, 0, -256, 256, `${p}.y`, errors),
      rest: number(s.rest, 0, -Math.PI, Math.PI, `${p}.rest`, errors), rotation: choice(s.rotation, ['fixed', 'independent'], 'fixed', `${p}.rotation`, errors),
      fire: choice(s.fire, ['none', 'parent', 'independent'], 'independent', `${p}.fire`, errors), select: choice(s.select, ['self', 'parent'], 'self', `${p}.select`, errors), onParentDeath: choice(s.onParentDeath, ['kill', 'detach'], 'detach', `${p}.onParentDeath`, errors) };
  });
  const deployments = list(value.deployments, 4, `${path}.deployments`, errors, (s, p): DeploymentSpec => {
    fields(s, ['id', 'label', 'to', 'time', 'metal', 'cancelable', 'health', 'cargo', 'automatic', 'orders', 'lockWeapons'], p, errors);
    const id = identifier(s.id, `${p}.id`, errors);
    return { id, label: label(s.label, id, `${p}.label`, errors), to: identifier(s.to, `${p}.to`, errors), time: number(s.time, 1, 0, 600, `${p}.time`, errors), metal: number(s.metal, 0, 0, 1e7, `${p}.metal`, errors),
      cancelable: flag(s.cancelable, true, `${p}.cancelable`, errors), health: choice(s.health, ['fraction', 'absolute'], 'fraction', `${p}.health`, errors), cargo: choice(s.cargo, ['retain', 'empty'], 'empty', `${p}.cargo`, errors),
      orders: choice(s.orders, ['clear', 'retain'], 'clear', `${p}.orders`, errors), lockWeapons: flag(s.lockWeapons, true, `${p}.lockWeapons`, errors),
      ...(s.automatic !== undefined ? { automatic: choice<'idle' | 'move'>(s.automatic, ['idle', 'move'], 'idle', `${p}.automatic`, errors) } : {}) };
  });
  unique(mounts, `${path}.mounts`, errors); unique(attachments, `${path}.attachments`, errors); unique(deployments, `${path}.deployments`, errors);
  const disabledWeapons = value.disabledWeapons === undefined || Array.isArray(value.disabledWeapons) && !value.disabledWeapons.length ? [] : ids(value.disabledWeapons, 16, `${path}.disabledWeapons`, errors);
  if (new Set(disabledWeapons).size !== disabledWeapons.length || context?.weaponIds && disabledWeapons.some(w => !context.weaponIds!.includes(w))) issue(errors, `${path}.disabledWeapons`, 'must name distinct weapons on this form');
  for (const trigger of ['idle', 'move']) if (deployments.filter(d => d.automatic === trigger).length > 1) issue(errors, `${path}.deployments`, 'only one deployment may use each automatic trigger');
  const result: ArticulationDef = { mounts, attachments, deployments, disabledWeapons, squad: flag(value.squad, false, `${path}.squad`, errors) };
  if (result.squad && !attachments.length) issue(errors, `${path}.squad`, 'requires real attachment members');
  const assigned = new Set<string>();
  for (const m of mounts) {
    for (const w of m.weapons) {
      if (assigned.has(w)) issue(errors, `${path}.mounts`, `weapon ${w} is assigned more than once`);
      if (context?.weaponIds && !context.weaponIds.includes(w)) issue(errors, `${path}.mounts`, `unknown weapon ${w}`);
      assigned.add(w);
    }
    const chain = new Set([m.id]); let parent = m.parent;
    while (parent) {
      const next = mounts.find(x => x.id === parent);
      if (!next || chain.has(parent) || chain.size >= 3) { issue(errors, `${path}.mounts`, 'mount parents must exist, be acyclic, and at most two levels deep'); break; }
      chain.add(parent); parent = next.parent;
    }
  }
  if (mounts.length && context?.weaponIds?.some(w => !assigned.has(w))) issue(errors, `${path}.mounts`, 'every weapon must belong to one mount');
  if (value.tow !== undefined) {
    if (!record(value.tow)) issue(errors, `${path}.tow`, 'must be an object');
    else {
      const s = value.tow, p = `${path}.tow`; fields(s, ['accepts', 'range', 'length', 'speed', 'maxWeight', 'detachOnMove'], p, errors);
      result.tow = { accepts: ids(s.accepts, 64, `${p}.accepts`, errors), range: number(s.range, 2, .1, 16, `${p}.range`, errors), length: number(s.length, 48, 8, 512, `${p}.length`, errors),
        speed: number(s.speed, .5, .01, 1, `${p}.speed`, errors), maxWeight: number(s.maxWeight, 100, 1, 10000, `${p}.maxWeight`, errors), detachOnMove: flag(s.detachOnMove, true, `${p}.detachOnMove`, errors) };
    }
  }
  if (context?.defIds) for (const id of [...attachments.map(x => x.unit), ...deployments.map(x => x.to), ...(result.tow?.accepts ?? [])]) {
    if (!context.defIds.has(id)) issue(errors, path, `unknown definition ${id}`);
  }
  return result;
}

/** Cross-form safety is checked after every definition has been resolved. */
export function validateArticulationReferences(def: UnitDef, table: Record<string, UnitDef>, path: string, errors: ContentIssue[], forms?: Set<string>): void {
  const spec = (def as UnitDef & { extensions?: Record<string, unknown> }).extensions?.['articulation-v1'] as ArticulationDef | undefined;
  if (!spec) return;
  for (const a of spec.attachments) forms?.add(a.unit);
  for (const d of spec.deployments) forms?.add(d.to);
  for (const a of spec.attachments) {
    const child = table[a.unit];
    if (!child || child.kind !== 'unit' || child.warhead || child.transportCap || (child as UnitDef & { extensions?: Record<string, unknown> }).extensions?.['articulation-v1']) {
      issue(errors, `${path}.attachments`, 'members must be ordinary units without nested articulation, cargo, or warheads');
    }
  }
  for (const d of spec.deployments) {
    const to = table[d.to];
    if (!to || to.id === def.id || to.domain === 'air' || def.domain === 'air' || to.warhead || def.warhead) issue(errors, `${path}.deployments`, 'deployment requires distinct surface definitions');
    if (to && (to.produces?.length || def.produces?.length || to.nukeCapacity || def.nukeCapacity || to.wing || def.wing)) issue(errors, `${path}.deployments`, 'production, warhead stockpiles and carrier wings cannot deploy');
    const target = (to as (UnitDef & { extensions?: Record<string, unknown> }) | undefined)?.extensions?.['articulation-v1'] as ArticulationDef | undefined;
    if (!target || JSON.stringify(spec.mounts) !== JSON.stringify(target.mounts)) issue(errors, `${path}.deployments`, 'both forms must declare articulation with identical mount layouts to preserve mount state');
    if (!target || JSON.stringify(spec.attachments.map(x => [x.id, x.unit])) !== JSON.stringify(target.attachments.map(x => [x.id, x.unit]))) issue(errors, `${path}.deployments`, 'deployment must retain every member slot and definition');
    if (to) for (const key of ['components-v1', 'logistics-v1', 'sensors-v1'] as const) {
      if (JSON.stringify(def.extensions?.[key]) !== JSON.stringify(to.extensions?.[key])) issue(errors, `${path}.deployments`, `${key} must remain identical across forms to preserve module state`);
    }
    if (to && def.weapons.some(w => JSON.stringify(w.extensions?.['sensors-v1']) !== JSON.stringify(to.weapons.find(v => v.id === w.id)?.extensions?.['sensors-v1']))) issue(errors, `${path}.deployments`, 'weapon guidance must remain identical across forms to preserve lock state');
    if (to && (to.interceptMag !== def.interceptMag || to.isHQ || def.isHQ || to.metalRate || def.metalRate)) issue(errors, `${path}.deployments`, 'HQ, extraction and changed interceptor magazines cannot deploy');
    if (to && (def.weapons.some(w => !to.weapons.some(v => v.id === w.id)) || to.weapons.some(w => !def.weapons.some(v => v.id === w.id)))) issue(errors, `${path}.deployments`, 'deployment must retain weapon IDs to preserve ammunition and cooldowns');
  }
  if (spec.tow) for (const id of spec.tow.accepts) {
    const to = table[id];
    if (!to || to.kind !== 'unit' || to.domain === 'air' || to.warhead || to.transportCap) issue(errors, `${path}.tow.accepts`, 'trailers must be surface units without cargo or warheads');
  }
}
