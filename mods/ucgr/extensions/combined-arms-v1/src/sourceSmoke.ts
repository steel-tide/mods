import { DEFS, getDef } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Json, ModuleAction, ModuleHost, ModuleStatusRow, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { ComponentsDef, SmokeDef, SmokePoint } from './componentsSpec';
import { articulationPointPose } from './articulation';
import { emitSourceActionEffect } from './feedback';

/**
 * Source tank-template smoke (模板/坦克模板.key, 步战车模板.key).
 *
 * [action_烟雾弹] fires four 烟雾弹 rounds from turrets smoke1–4 and
 * [action_尾烟] one per whole second of the unit's age for ten seconds from
 * turret 尾烟. Each round spawns smokeG (中立及通用单位/烟雾弹/烟雾弹.ini): a
 * five-second marker whose invisible KAZProjectile turret removes the life of
 * one ATGM-tagged enemy round inside 100 RW px, paid from energy 2 regenerating
 * 0.015/frame with the default 50-frame shootDelay. A round with life 0 bursts
 * on its first update at its launcher (RW Projectile life countdown); the
 * life-999 variant flies to its rotated aim point. The KAZ round travels 99 RW
 * px/frame, so it reaches anything inside its radius on the following tick.
 *
 * Not represented: DynamicLoS target nudges, smokeG soft collision and enemy
 * auto-targeting of the invulnerable marker unit (see SMOKE notes).
 */
interface Marker { id: number; x: number; y: number; owner: number; team: number; born: number; energy: number; ready: number; definition: string }
interface Flight { x: number; y: number; land: number; owner: number; team: number; source: number; definition: string }
interface Strike { target: number; marker: number }
interface UnitSmoke { born: number; grenade: number; engine: number; release?: { start: number; next: number } }

export function createSourceSmoke(host: ModuleHost, ready: (e: Ent, kind: 'grenade' | 'engine') => boolean, incomingTags: (p: Proj) => readonly string[], claimedByAps: () => ReadonlySet<number>) {
  const st = host.game.st, units = new Map<number, UnitSmoke>(), flights: Flight[] = [], strikes: Strike[] = [];
  let markers: Marker[] = [], serial = 0;
  const cfg = (e: Ent): SmokeDef | undefined => host.config<ComponentsDef>(getDef(e.defId))?.smoke;
  const team = (owner: number) => st.players[owner]?.team ?? owner;
  const live = (e: Ent | undefined): e is Ent => !!e && !e.dead && !e.inside;
  function unit(e: Ent): UnitSmoke { let s = units.get(e.id); if (!s) { s = { born: st.time, grenade: 0, engine: 0 }; units.set(e.id, s); } return s; }
  function at(e: Ent, p: SmokePoint) { return articulationPointPose(host.game, e, p.mount, p.x, p.y); }
  function drop(x: number, y: number, owner: number, source: Ent | { id: number; defId: string }, definition: string) {
    const m = spec({ definition }); if (!m) return;
    markers.push({ id: ++serial, x, y, owner, team: team(owner), born: st.time, energy: m.energy, ready: st.time, definition });
    emitSourceActionEffect(host.game, source as Ent, 'smoke-marker', x, y, 0);
  }
  /** One smoke round from a launcher: bursts there (life 0) or flies to its aim. */
  function fire(e: Ent, d: SmokeDef, launcher: SmokePoint, aim: { forward: number; lateral: number }) {
    const from = at(e, launcher); if (!from) return;
    if (!d.flight) { drop(from.x, from.y, e.owner, e, e.defId); return; }
    // fireTurretXAtGround_withOffset rotates by the unit's heading (class_113).
    const c = Math.cos(e.angle), s = Math.sin(e.angle), spread = d.flight.spread;
    const quantized = () => spread > 0 ? Math.round(st.rng.range(-spread, spread) / .004) * .004 : 0;
    const tx = e.x + c * aim.forward - s * aim.lateral + quantized(), ty = e.y + s * aim.forward + c * aim.lateral + quantized();
    flights.push({ x: tx, y: ty, land: st.time + Math.hypot(tx - from.x, ty - from.y) / d.flight.speed, owner: e.owner, team: team(e.owner), source: e.id, definition: e.defId });
  }
  return {
    actions(e: Ent): ModuleAction[] {
      const d = cfg(e); if (!d || !live(e)) return [];
      const s = unit(e), out: ModuleAction[] = [];
      if (d.grenades) out.push({ id: 'smoke', label: d.grenades.label, enabled: st.time >= s.grenade && ready(e, 'grenade') });
      if (d.engine) out.push({ id: 'engine-smoke', label: d.engine.label, enabled: st.time >= s.engine && !s.release && ready(e, 'engine') });
      return out;
    },
    order(e: Ent, action: string): boolean {
      const d = cfg(e); if (!d || !live(e)) return false;
      const s = unit(e);
      if (action === 'smoke' && d.grenades && st.time >= s.grenade && ready(e, 'grenade')) {
        // addActionCooldownApplyToActions:尾烟,烟雾弹 on the grenade action.
        s.grenade = Math.max(s.grenade, st.time + d.grenades.cooldown); s.engine = Math.max(s.engine, st.time + d.grenades.cooldown);
        emitSourceActionEffect(host.game, e, 'smoke');
        d.grenades.launchers.forEach((launcher, i) => fire(e, d, launcher, d.grenades!.aim[i])); return true;
      }
      if (action === 'engine-smoke' && d.engine && st.time >= s.engine && !s.release && ready(e, 'engine')) {
        s.engine = Math.max(s.engine, st.time + d.engine.cooldown);
        if (d.engine.shared) s.grenade = Math.max(s.grenade, st.time + d.engine.cooldown);
        // hiddenAction_尾烟释放: int(age*10)%10==0, i.e. the first frame of each
        // whole second of age, then its default 60-frame trigger cooldown.
        const age = st.time - s.born, k = age - Math.floor(age) < .1 - 1e-9 ? Math.floor(age) : Math.ceil(age);
        s.release = { start: st.time, next: s.born + k };
        emitSourceActionEffect(host.game, e, 'smoke'); return true;
      }
      return false;
    },
    inspect(e: Ent): ModuleStatusRow[] {
      const d = cfg(e), s = units.get(e.id); if (!d || !s) return [];
      const wait = Math.max(s.grenade, s.engine) - st.time;
      return wait > 0 ? [{ id: 'smoke-cooldown', label: ['Smoke cooldown', '烟雾冷却', '연막 재사용 대기'], value: Math.ceil(wait) }] : [];
    },
    beforeProjectiles(dt: number): void {
      for (const e of host.participants()) if (cfg(e) && !e.dead) unit(e);
      for (const [id] of units) { const e = st.ents.get(id); if (!e || e.dead) units.delete(id); }
      // Engine smoke while the source tag 释放引擎烟 holds.
      for (const [id, s] of units) {
        const e = st.ents.get(id)!; if (!s.release) continue;
        const smoke = cfg(e), d = smoke?.engine;
        if (!smoke || !d || st.time - s.release.start >= d.duration) { delete s.release; continue; }
        if (st.time + 1e-9 >= s.release.next && live(e)) {
          fire(e, smoke, d.point, d.aim);
          s.release.next += 1;
        }
      }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i]; if (st.time + 1e-9 < f.land) continue;
        flights.splice(i, 1); drop(f.x, f.y, f.owner, st.ents.get(f.source) ?? { id: f.source, defId: f.definition }, f.definition);
      }
      // Strikes launched on the previous tick reach their quarry now.
      for (const s of strikes.splice(0)) { const q = st.projs.find(p => p.id === s.target); if (q && !q.downed && q.ttl > 0) q.ttl = 0; }
      markers = markers.filter(m => st.time - m.born < (spec(m)?.life ?? 0) - 1e-9);
      const claimed = new Set<number>(claimedByAps());
      for (const m of markers) {
        const c = spec(m); if (!c) continue;
        m.energy = Math.min(c.energy, m.energy + c.regen * dt);
        if (st.time + 1e-9 < m.ready || m.energy < c.usage) continue;
        // RW scans creation order and keeps the LAST eligible round.
        let target: Proj | undefined;
        for (const p of st.projs) {
          if (p.downed || p.ttl <= 0 || p.team === m.team || Math.hypot(p.x - m.x, p.y - m.y) >= c.range || !incomingTags(p).some(t => c.tags.includes(t))) continue;
          p.id ??= st.nextProjId++; if (!claimed.has(p.id)) target = p;
        }
        if (!target) continue;
        claimed.add(target.id!); m.energy -= c.usage; m.ready = st.time + c.reload;
        strikes.push({ target: target.id!, marker: m.id });
      }
    },
    points(): readonly { x: number; y: number }[] { return markers.map(m => ({ x: m.x, y: m.y })); },
    snapshot(view?: RuntimeView): Json {
      // Clouds reach clients through the feedback particles; interception is authoritative.
      if (view) return { serial: 0, units: [], markers: [], flights: [], strikes: [] } as unknown as Json;
      return { serial, units: [...units].map(([id, s]) => [id, { ...s, ...(s.release ? { release: { ...s.release } } : {}) }]), markers: markers.map(m => ({ ...m })), flights: flights.map(f => ({ ...f })), strikes: strikes.map(s => ({ ...s })) } as unknown as Json;
    },
    restore(raw: unknown): void {
      units.clear(); flights.length = 0; strikes.length = 0; markers = []; serial = 0;
      if (raw === undefined) return;
      const v = raw as Record<string, unknown>, plain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
      const finite = (x: unknown, lo = -1e9, hi = 1e9): x is number => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
      if (!plain(v) || !Array.isArray(v.units) || !Array.isArray(v.markers) || !Array.isArray(v.flights) || !Array.isArray(v.strikes) || !Number.isSafeInteger(v.serial)) throw Error('Invalid source smoke state');
      for (const entry of v.units) {
        const [id, s] = entry as [number, UnitSmoke], e = st.ents.get(id);
        if (!e || !cfg(e) || !plain(s) || !finite(s.born, -1, st.time) || !finite(s.grenade, 0, st.time + 3600) || !finite(s.engine, 0, st.time + 3600) || s.release !== undefined && (!plain(s.release) || !finite(s.release.start, 0, st.time) || !finite(s.release.next, 0, st.time + 2))) throw Error('Invalid source smoke unit');
        units.set(id, { born: s.born, grenade: s.grenade, engine: s.engine, ...(s.release ? { release: { start: s.release.start, next: s.release.next } } : {}) });
      }
      for (const m of v.markers as Marker[]) {
        if (!plain(m) || !Number.isSafeInteger(m.id) || m.id > (v.serial as number) || typeof m.definition !== 'string' || !spec(m) || !finite(m.x) || !finite(m.y) || !st.players[m.owner] || m.team !== team(m.owner) || !finite(m.born, 0, st.time) || !finite(m.energy, 0, 1000) || !finite(m.ready, 0, st.time + 600)) throw Error('Invalid source smoke marker');
        markers.push({ ...m });
      }
      for (const f of v.flights as Flight[]) {
        if (!plain(f) || !finite(f.x) || !finite(f.y) || !finite(f.land, 0, st.time + 600) || !st.players[f.owner] || f.team !== team(f.owner) || !Number.isSafeInteger(f.source) || !spec(f)) throw Error('Invalid source smoke flight');
        flights.push({ ...f });
      }
      for (const s of v.strikes as Strike[]) {
        if (!plain(s) || !Number.isSafeInteger(s.target) || !markers.some(m => m.id === s.marker)) throw Error('Invalid source smoke strike');
        strikes.push({ ...s });
      }
      serial = v.serial as number;
    },
  };
  function spec(m: { definition: string }): SmokeDef['marker'] | undefined {
    const d = DEFS[m.definition]; return d ? host.config<ComponentsDef>(d)?.smoke?.marker : undefined;
  }
}
