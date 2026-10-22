import type { ContentIssue } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import { fields, issue, record } from './sensorsSpec';

export const TARGETING_ID = 'usgr-re.targeting-v1';
export interface DetectionRange { tag: string; range: number }
export interface Concealment { enter: DetectionRange[]; leave: DetectionRange[]; interval: number; cooldown: number; trench?:{enter:DetectionRange[];leave:DetectionRange[]}; energy?:{max:number;regen:number;costs:{id:string;amount:number}[]} }
export interface SourceTags { tags: string[]; concealment?: Concealment }
export interface TargetRestrictions { withTags: string[]; withoutTags: string[]; selfWithTags: string[] }
function tags(value: unknown, path: string, errors: ContentIssue[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 128 || value.some(v => typeof v !== 'string' || !v.length || v.length > 100 || /[()=\n]/.test(v))) {
    issue(errors, path, 'must be at most 128 literal source tags'); return [];
  }
  return [...new Set(value as string[])];
}
export function readSourceTags(value: unknown, path: string, errors: ContentIssue[]): SourceTags | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['tags', 'concealment'], path, errors);
  const out: SourceTags = { tags: tags(value.tags, `${path}.tags`, errors) };
  if (value.concealment !== undefined) {
    const c = value.concealment;
    if (!record(c)) { issue(errors, path + '.concealment', 'must be an object'); return out; }
    fields(c, ['enter', 'leave', 'interval', 'cooldown', 'trench','energy'], path + '.concealment', errors);
    const read = (v: unknown): v is DetectionRange[] => Array.isArray(v) && v.length === 4 && v.every(d =>
      record(d) && Object.keys(d).length === 2 && typeof d.tag === 'string' && ['装甲', 'soldiers', 'UAV', 'HELI'].includes(d.tag)
      && typeof d.range === 'number' && Number.isFinite(d.range) && d.range > 0 && d.range <= 1000);
    if (!read(c.enter) || !read(c.leave) || typeof c.interval !== 'number' || !Number.isFinite(c.interval) || c.interval < 1/60 || c.interval > 10
      || typeof c.cooldown !== 'number' || !Number.isFinite(c.cooldown) || c.cooldown < 0 || c.cooldown > 60) issue(errors, path + '.concealment', 'invalid source detection table or clock');
    else out.concealment = { enter: c.enter, leave: c.leave, interval: c.interval, cooldown: c.cooldown };
    if(out.concealment&&c.trench!==undefined){if(!record(c.trench)||!read(c.trench.enter)||!read(c.trench.leave))issue(errors,path+'.concealment.trench','invalid source trench detection tables');else out.concealment.trench={enter:c.trench.enter,leave:c.trench.leave};}
    if(out.concealment&&c.energy!==undefined){const e=c.energy;if(!record(e)||typeof e.max!=='number'||!Number.isFinite(e.max)||e.max<=0||e.max>1e6||typeof e.regen!=='number'||!Number.isFinite(e.regen)||e.regen<0||e.regen>1e6||!Array.isArray(e.costs)||e.costs.length>16||e.costs.some(v=>!record(v)||typeof v.id!=='string'||typeof v.amount!=='number'||!Number.isFinite(v.amount)||v.amount<=0||v.amount>Number(e.max)))issue(errors,path+'.concealment.energy','invalid source infantry energy');else out.concealment.energy={max:e.max,regen:e.regen,costs:e.costs as {id:string;amount:number}[]};}

  }
  return out;
}
export function readTargetRestrictions(value: unknown, path: string, errors: ContentIssue[]): TargetRestrictions | undefined {
  if (!record(value)) { issue(errors, path, 'must be an object'); return; }
  fields(value, ['withTags', 'withoutTags', 'selfWithTags'], path, errors);
  return { withTags: tags(value.withTags, `${path}.withTags`, errors), withoutTags: tags(value.withoutTags, `${path}.withoutTags`, errors), selfWithTags: tags(value.selfWithTags, `${path}.selfWithTags`, errors) };
}
