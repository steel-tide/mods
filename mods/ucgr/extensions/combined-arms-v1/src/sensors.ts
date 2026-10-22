import { createFpv } from './fpv';
export { sensorFpvDeployed } from './fpv';
import { createSourceOrdnance } from './sourceOrdnance';
import { createFlightControls } from './flightControls';
import { createRadarBattery } from './radarBattery';
export { sensorDeployed } from './radarBattery';
import { createRadarControls } from './radarControls';
import { createSead } from './sead';
export { sensorAltitude } from './flightControls';
export { sensorRadarActive } from './radarControls';
export { sensorElectronicWarfare } from './sead';
import { TILE, Terrain } from './host';
import { normAngle, turnToward } from './host';
import { walkGridLine } from './host';
import { t } from './strings';
import { DEFS, getDef } from './host';
import { canSee, targetCat } from './host';
import { cmdAttack, cmdMove } from './host';
import type { Ent, Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import type { EngineModuleInstance, Json, ModuleHost, ModuleAction } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { GuidanceDef, SensorsDef, SensorSpec } from './sensorsSpec';
import { record } from './sensorsSpec';

export interface SensorsVisual { deployed?:boolean; radarHeading?:number; radarPreviousHeading?:number; hidden?:boolean; flight?: { altitude: number }; contacts: {sensor:string;label:SensorSpec['label'];channel:string;reveal:'contact'|'entity';x:number;y:number;seenAt:number;acquired:boolean;strength?:number}[] }
export interface SensorsModule extends EngineModuleInstance { projectileVisual(projectile:Proj):{altitude:number}|undefined; }

interface Contact { target: number; x: number; y: number; since: number; seen: number; acquired: boolean; strength?: number }
interface Emitter { active: boolean; pending?: boolean; ready: number; cooldown: number }
interface Decoy { charges: number; until: number; ready: number; serial: number }
interface SensorState { emitters: Record<string, Emitter>; decoys: Record<string, Decoy>; contacts: Record<string, Contact[]>; scans: Record<string, number>; link?: number }
interface Lock { target: number; since: number; checked: number; ready: boolean }
interface Flight { spec: GuidanceDef; target: number; source: number; age: number; lost: number; permanent: boolean; x: number; y: number; tried: string[] }

/** All signal knowledge belongs to the enabled match, never the entity or global fog. */
export function createSensorsModule(host: ModuleHost): SensorsModule {
  const st = host.game.st;
  const flightControls = createFlightControls(host);
  const radarControls = createRadarControls(host);
  const battery = createRadarBattery(host,radarControls.active);
  const sead = createSead(host,flightControls.resetSpeed);
  const fpv = createFpv(host);
  const sourceOrdnance = createSourceOrdnance(host,id=>{const e=st.ents.get(id),s=states.get(id);return e&&s?Object.values(s.contacts).flat().filter(c=>c.acquired).map(c=>c.target):[];});
  const states = new Map<number, SensorState>(), locks = new Map<string, Lock>(), flights = new Map<number, Flight>();
  const config = (e: Ent): SensorsDef | undefined => host.config<SensorsDef>(getDef(e.defId));
  const trackable = (e: Ent | undefined): e is Ent => !!e && !e.dead && !e.inside && !e.site;
  const live = (e: Ent | undefined): e is Ent => trackable(e) && !e.emp;
  const team = (e: { owner: number }): number => st.players[e.owner]?.team ?? -1;
  function state(e: Ent): SensorState {
    let s = states.get(e.id);
    if (!s) { s = { emitters: Object.create(null), decoys: Object.create(null), contacts: Object.create(null), scans: Object.create(null) }; states.set(e.id, s); }
    const cfg = config(e);
    for (const a of cfg?.emitters ?? []) s.emitters[a.id] ??= { active: a.active, ready: 0, cooldown: 0 };
    for (const a of cfg?.decoys ?? []) s.decoys[a.id] ??= { charges: a.charges, until: 0, ready: 0, serial: 0 };
    return s;
  }
  function clearLine(a: {x:number;y:number}, b: {x:number;y:number}, forest: boolean, smoke: boolean): boolean {
    if (forest && !walkGridLine(a.x, a.y, b.x, b.y, (x, y, nx, ny) => {
      const clear = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < st.map.w && ty < st.map.h
        && ((tx === Math.floor(a.x / TILE) && ty === Math.floor(a.y / TILE)) || st.map.terrain[ty * st.map.w + tx] !== Terrain.Forest);
      return clear(nx, ny) && (x === nx || y === ny || (clear(x, ny) && clear(nx, y)));
    })) return false;
    if (smoke) {
      const dx = b.x - a.x, dy = b.y - a.y, n = dx * dx + dy * dy;
      for (const p of st.projs) if (p.kind === 'smoke' && p.ttl > 0) {
        const k = n ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / n)) : 0;
        if (Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy) <= p.splash) return false;
      }
    }
    return true;
  }
  function within(a: {x:number;y:number}, angle: number, target: Ent, range: number, cone: number, forest: boolean, smoke: boolean): boolean {
    return Math.hypot(a.x - target.x, a.y - target.y) <= range * TILE
      && Math.abs(normAngle(Math.atan2(target.y - a.y, target.x - a.x) - angle)) <= cone
      && clearLine(a, target, forest, smoke);
  }
  function emitting(target: Ent, channel: string, from: {x:number;y:number}): boolean {
    if (!live(target)) return false;
    if(channel==='usgr-re-radar'&&radarControls.emitting(target,from))return true;
    const cfg = config(target); if (!cfg?.emitters.length) return false;
    const s = state(target);
    return cfg.emitters.some(e => e.channel === channel && s.emitters[e.id]?.active
      && Math.hypot(target.x - from.x, target.y - from.y) <= e.range * TILE);
  }
  function sensorPose(observer: Ent, sensor: SensorSpec): {x:number;y:number;angle:number} {
    const angle = sensor.basis === 'body' ? observer.angle : observer.turretAngle, a = angle + Math.PI / 2;
    return {x:observer.x + sensor.x * Math.cos(a) - sensor.y * Math.sin(a),
      y:observer.y + sensor.x * Math.sin(a) + sensor.y * Math.cos(a), angle};
  }
  const freshness = (sensor: SensorSpec): number => sensor.interval + .1;
  const strength = (target: Ent, channel: string): number | undefined => config(target)?.signatures.find(s => s.channel === channel)?.strength;
  /** Range/signature candidate limits precede the directional filter. */
  function sensorCandidate(observer: Ent, sensor: SensorSpec, target: Ent, origin = sensorPose(observer, sensor)): boolean {
    if (!sensor.active || !live(observer) || !trackable(target) || team(observer) === team(target)
      || !sensor.targets.includes(targetCat(st, target)) || Math.hypot(origin.x - target.x, origin.y - target.y) > sensor.range * TILE) return false;
    if (sensor.mode === 'signature') { const value = strength(target, sensor.channel); return value !== undefined && value >= sensor.minimumSignature; }
    return sensor.mode === 'passive' ? emitting(target, sensor.channel, origin) : canSee(st, host.game.hash, team(observer), target, true);
  }
  function seesSensor(observer: Ent, sensor: SensorSpec, target: Ent): boolean {
    const origin = sensorPose(observer, sensor);
    return sensorCandidate(observer, sensor, target, origin)
      && within(origin, origin.angle, target, sensor.range, sensor.cone, sensor.forest, sensor.smoke);
  }
  function known(source: { owner: number }, target: Ent, guide: GuidanceDef): boolean {
    for (const observer of host.participants()) {
      if (!live(observer) || team(observer) !== team(source)) continue;
      const s = states.get(observer.id); if (!s) continue;
      for (const sensor of config(observer)?.sensors ?? []) if (sensor.channel === guide.channel && s.contacts[sensor.id]?.some(c => c.target === target.id && c.acquired && st.time - c.seen < freshness(sensor))) return true;
    }
    return false;
  }
  function supported(source: { owner: number }, target: Ent, guide: GuidanceDef, from: {x:number;y:number}, angle: number, launch: boolean): boolean {
    if (!trackable(target) || team(source) === team(target)) return false;
    if (!within(from, angle, target, guide.range, guide.cone, guide.forest, guide.smoke)) return false;
    if (guide.mode === 'emitter') return emitting(target, guide.channel, from);
    if (guide.mode === 'self') return !launch || host.visible(target, team(source)) || known(source, target, guide);
    for (const observer of host.participants()) {
      if (!live(observer) || team(observer) !== team(source)) continue;
      const cfg = config(observer); if (!cfg) continue;
      const s = state(observer);
      for (const sensor of cfg.sensors) {
        if (sensor.channel !== guide.channel || sensor.mode !== (guide.mode === 'illumination' ? 'illuminate' : 'designate')) continue;
        const c = s.contacts[sensor.id]?.find(c => c.target === target.id && c.acquired);
        if (c && st.time - c.seen < freshness(sensor) && seesSensor(observer, sensor, target)) return true;
      }
    }
    return false;
  }
  const module: SensorsModule = {
    id: 'sensors-v1',
    projectileVisual: sourceOrdnance.visual,
    effectiveDef(e,def) {return fpv.effectiveDef(e,battery.effectiveDef(e,sead.effectiveDef(e,radarControls.effectiveDef(e,flightControls.effectiveDef(e,def)))));},
    dispose() {flightControls.dispose();radarControls.dispose();sead.dispose();battery.dispose();fpv.dispose();},
    wrapUnitStep(next){return(e,def,dt)=>{if(!sead.step(e,dt)&&!fpv.step(e,dt))next(e,def,dt);};},
    allowOrder(e){return sead.allowOrder(e)&&fpv.allowOrder(e);},
    beforeProjectiles:sead.beforeProjectiles,
    wrapTargetAcquisition(next){return(st,hash,e,def,range,air,accepts,priority,candidates,weapon)=>next(st,hash,e,def,range,air,t=>battery.canAcquire(e)&&sead.allowedTarget(e,t)&&(!accepts||accepts(t)),priority,candidates,weapon);},
    wrapTargetTracking(next){return(st,hash,e,def,target,...rest)=>sead.allowedTarget(e,target)&&next(st,hash,e,def,target,...rest);},
    beforeStep(dt) {
      flightControls.beforeStep(dt);
      radarControls.beforeStep();
      battery.beforeStep(dt);
      sead.beforeStep(dt);
      fpv.beforeStep();
      sourceOrdnance.beforeStep(dt);
      for (const e of host.participants()) {
        if (!live(e)) continue;
        const cfg = config(e); if (!cfg) continue;
        const s = state(e);
        for (const emitter of cfg.emitters) {
          const a = s.emitters[emitter.id];
          if (a.pending !== undefined && st.time >= a.ready) { a.active = a.pending; delete a.pending; }
        }
        for (const sensor of cfg.sensors) {
          const lastScan = s.scans[sensor.id];
          if (lastScan !== undefined && st.time + 1e-9 < lastScan + sensor.interval) continue;
          s.scans[sensor.id] = st.time;
          const old = new Map((s.contacts[sensor.id] ?? []).map(c => [c.target, c]));
          const next: Contact[] = [];
          const origin = sensorPose(e, sensor);
          let scanned = 0;
          for (const target of st.ents.values()) {
            if (!sensorCandidate(e, sensor, target, origin)) continue;
            if (sensor.scanLimit && ++scanned > sensor.scanLimit) break;
            if (!within(origin, origin.angle, target, sensor.range, sensor.cone, sensor.forest, sensor.smoke)) continue;
            const prior = old.get(target.id);
            const c = prior ?? { target: target.id, x: target.x, y: target.y, since: st.time, seen: st.time, acquired: false };
            // A break before acquisition must restart the continuous lock clock.
            if (prior && st.time - c.seen > freshness(sensor)) c.since = st.time;
            c.x = target.x; c.y = target.y; c.seen = st.time; c.acquired = st.time - c.since + 1e-6 >= sensor.acquire;
            if (sensor.mode === 'signature') c.strength = strength(target, sensor.channel);
            if (next.length < sensor.maxTracks) next.push(c); old.delete(target.id);
          }
          for (const c of old.values()) if (next.length < sensor.maxTracks && c.acquired && st.time - c.seen <= sensor.retain) next.push(c);
          s.contacts[sensor.id] = next;
        }
        if (s.link) {
          const other = st.ents.get(s.link), remote = other && config(other)?.remote;
          if (!live(other) || other.owner !== e.owner || !cfg.remote || remote?.channel !== cfg.remote.channel
            || Math.hypot(e.x - other.x, e.y - other.y) > Math.min(cfg.remote.range, remote.range) * TILE) delete s.link;
        }
      }
    },
    canTrack(e, target, weapon) {
      if(battery.canTrack(e,target))return true;
      const guide = host.config<GuidanceDef>(weapon);
      return !!guide && known(e, target, guide) && supported(e, target, guide, e, Math.atan2(target.y - e.y, target.x - e.x), true);
    },
    canFire(e, _def, w, _point, target) {
      if(!sead.allowedTarget(e,target)||!battery.canFire(e))return false;
      if(!flightControls.canFire(e,w))return false;
      if(!radarControls.canFire(e,w,_point,target))return false;
      const guide = host.config<GuidanceDef>(w); if (!guide) return true;
      if(guide.sourceFlight){
        if(!target)return false;
        return Math.abs(normAngle(Math.atan2(target.y-e.y,target.x-e.x)-e.angle)) <= (guide.launchArc ?? Math.PI);
      }
      const key = `${e.id}/${w.id}`, old = locks.get(key);
      if (!target || !supported(e, target, guide, e, e.turretAngle, true)) { locks.delete(key); return false; }
      const lock = old?.target === target.id ? old : { target: target.id, since: st.time, checked: st.time, ready: false };
      if (st.time - lock.checked > .1) lock.since = st.time;
      lock.checked = st.time; lock.ready = st.time - lock.since + 1e-6 >= guide.acquire; locks.set(key, lock);
      return lock.ready;
    },
    onShot(e, _def, weapon, p) {
      battery.onShot(e);
      const spec = host.config<GuidanceDef>(weapon); if (!spec || !p.targetId) return;
      if(sourceOrdnance.onShot(e,spec,p))return;
      p.id ??= st.nextProjId++;
      flights.set(p.id, { spec, source: e.id, target: p.targetId, age: 0, lost: 0, permanent: false, x: p.tx, y: p.ty, tried: [] });
      p.ttl = Math.min(p.ttl, spec.maxLife);
    },
    wrapDamage(next) {const damage=sead.damage(next);return (...args)=>{
      const impact=host.currentImpact?.projectile;
      if(impact?.gun&&config(args[1])?.helicopter){const i=impact.gun.lastIndexOf('/'),w=DEFS[impact.gun.slice(0,i)]?.weapons.find(w=>w.id===impact.gun!.slice(i+1));if(w){const flight=host.config<GuidanceDef>(w)?.sourceFlight;if(flight&&!flight.radar&&!(w.extensions?.['components-v1'] as {hpPhases?:unknown}|undefined)?.hpPhases)args[2]*=2;};}
      damage(...args);
    };},
    projectileStep: sourceOrdnance.projectileStep,
    guideProjectile(p, dt) {
      const f = p.id === undefined ? undefined : flights.get(p.id); if (!f) return false;
      f.age += dt;
      const target = st.ents.get(f.target), source = { owner: p.owner };
      let hasLock = !f.permanent && !!target && supported(source, target, f.spec, p, p.angle, false);
      for (const e of host.participants()) {
        if (!hasLock || !live(e) || team(e) === p.team) continue;
        const cfg = config(e); if (!cfg?.decoys.length) continue;
        const s = state(e);
        for (const d of cfg.decoys) {
          const a = s.decoys[d.id], key = `${e.id}/${d.id}/${a.serial}`;
          if (a.until <= st.time || !d.channels.includes(f.spec.channel) || f.tried.includes(key) || Math.hypot(e.x - p.x, e.y - p.y) > d.range * TILE) continue;
          f.tried = f.tried.filter(old => !old.startsWith(`${e.id}/${d.id}/`)); f.tried.push(key);
          if (st.rng.chance(d.chance * (1 - f.spec.decoyResistance))) { hasLock = false; f.permanent = true; }
        }
      }
      if (hasLock && target) { f.x = target.x; f.y = target.y; f.lost = 0; }
      else { f.lost += dt; if (f.lost > f.spec.lossGrace && !f.spec.reacquire) f.permanent = true; }
      // Never leave native homing a live entity reference after support is lost.
      p.targetId = hasLock ? f.target : 0; p.homing = hasLock;
      if (hasLock || f.lost <= f.spec.lossGrace) p.angle = turnToward(p.angle, Math.atan2(f.y - p.y, f.x - p.x), f.spec.turnRate * dt);
      p.tx = p.x + Math.cos(p.angle) * p.speed * Math.max(dt * 2, f.spec.maxLife - f.age);
      p.ty = p.y + Math.sin(p.angle) * p.speed * Math.max(dt * 2, f.spec.maxLife - f.age);
      return true;
    },
    filterVisionTiles(e, tiles) {
      const cfg = config(e)?.obstruction; if (!cfg || (!cfg.forest && !cfg.smoke)) return tiles;
      return tiles.filter(i => clearLine(e, { x: (i % st.map.w + .5) * TILE, y: (Math.floor(i / st.map.w) + .5) * TILE }, cfg.forest, cfg.smoke));
    },
    filterVisibility(e, viewerTeam, visible) {
      if(sead.hidden(e)||fpv.render(e)?.hidden)return false;
      if (visible || st.players[e.owner]?.team === viewerTeam) return visible;
      for (const observer of host.participants()) {
        if (!live(observer) || team(observer) !== viewerTeam) continue;
        const cfg = config(observer), s = states.get(observer.id); if (!cfg || !s) continue;
        for (const sensor of cfg.sensors) if (sensor.reveal === 'entity' && s.contacts[sensor.id]?.some(c => c.target === e.id && c.acquired && st.time - c.seen < freshness(sensor))) return true;
      }
      return false;
    },
    afterStep() {
      flightControls.afterStep();
      radarControls.afterStep();battery.afterStep();
      sead.afterStep();
      fpv.afterStep();
      sourceOrdnance.afterStep();
      const ids = new Set(st.projs.map(p => p.id));
      for (const flight of flights.values()) flight.tried = flight.tried.filter(key => st.ents.has(Number(key.split('/')[0])));
      for (const id of flights.keys()) if (!ids.has(id)) flights.delete(id);
      for (const id of states.keys()) if (!st.ents.has(id)) states.delete(id);
      for (const key of locks.keys()) if (!st.ents.has(Number(key.split('/')[0]))) locks.delete(key);
    },
    actions(e) {
      const cfg = config(e); if (!cfg || !live(e)) return [];
      const s = state(e), out: ModuleAction[] = [...flightControls.actions(e),...radarControls.actions(e),...sead.actions(e),...battery.actions(e),...fpv.actions(e)];
      for (const a of cfg.emitters) out.push({ id: `emitter:${a.id}`, label: a.label, enabled: st.time >= s.emitters[a.id].cooldown && s.emitters[a.id].pending === undefined });
      for (const a of cfg.decoys) out.push({ id: `decoy:${a.id}`, label: a.label, enabled: s.decoys[a.id].charges > 0 && st.time >= s.decoys[a.id].ready });
      if (cfg.remote) {
        out.push({ id: 'link', label: t('extension.link'), enabled: true, target: 'own' });
        if (s.link) {
          out.push({ id: 'unlink', label: t('extension.unlink'), enabled: true });
          if (cfg.remote.commands.includes('move')) out.push({ id: 'remote-move', label: t('extension.remoteMove'), enabled: true, target: 'ground' });
          if (cfg.remote.commands.includes('attack')) out.push({ id: 'remote-attack', label: t('extension.remoteAttack'), enabled: true, target: 'enemy' });
        }
      }
      return out;
    },
    order(order) {
      let accepted = false;
      for (const id of order.ids) {
        const e = st.ents.get(id); if (!live(e) || e.owner !== order.owner) continue;
        const cfg = config(e); if (!cfg) continue;
        const s = state(e);
        if(flightControls.order(e,order)){accepted=true;continue;}
        if(battery.order(e,order)){accepted=true;continue;}
        if(radarControls.order(e,order)){accepted=true;continue;}
        if(sead.order(e,order)){accepted=true;continue;}
        if(fpv.order(e,order)){accepted=true;continue;}
        const emitter = cfg.emitters.find(a => order.action === `emitter:${a.id}`);
        if (emitter) { const a = s.emitters[emitter.id]; if (a.pending !== undefined || st.time < a.cooldown) continue;
          a.pending = order.on ?? !a.active; a.ready = st.time + emitter.toggleTime; a.cooldown = a.ready + emitter.cooldown; accepted = true; continue; }
        const decoy = cfg.decoys.find(a => order.action === `decoy:${a.id}`);
        if (decoy) { const a = s.decoys[decoy.id]; if (!a.charges || st.time < a.ready) continue;
          a.charges--; a.until = st.time + decoy.duration; a.ready = st.time + decoy.cooldown; a.serial++; accepted = true; continue; }
        const remote = cfg.remote; if (!remote) continue;
        if (order.action === 'unlink') { delete s.link; accepted = true; continue; }
        if (order.action === 'link') {
          const target = st.ents.get(order.targetId ?? 0), targetCfg = target && config(target)?.remote;
          if (!live(target) || target.id === id || target.owner !== order.owner || targetCfg?.channel !== remote.channel || Math.hypot(e.x - target.x, e.y - target.y) > Math.min(remote.range, targetCfg.range) * TILE) continue;
          s.link = target.id; accepted = true; continue;
        }
        const target = st.ents.get(s.link ?? 0), targetCfg = target && config(target)?.remote;
        if (!live(target) || target.owner !== e.owner || targetCfg?.channel !== remote.channel || Math.hypot(e.x - target.x, e.y - target.y) > Math.min(remote.range, targetCfg.range) * TILE) continue;
        if (order.action === 'remote-move' && remote.commands.includes('move') && Number.isFinite(order.x) && Number.isFinite(order.y)) { cmdMove(host.game, [target.id], order.x!, order.y!); accepted = true; }
        if (order.action === 'remote-attack' && remote.commands.includes('attack')) { const enemy = st.ents.get(order.targetId ?? 0); if (trackable(enemy) && team(enemy) !== team(e) && host.visible(enemy, team(e))) { cmdAttack(host.game, [target.id], enemy.id); accepted = true; } }
      }
      return accepted;
    },
    inspect(e, privateView) { if (!privateView) return []; const cfg = config(e); if (!cfg) return []; const s = state(e);
      return [...sead.inspect(e),...fpv.inspect(e),...sourceOrdnance.inspect(e), ...cfg.sensors.flatMap(a => [{ id: a.id, label: a.label, value: s.contacts[a.id]?.filter(c => c.acquired).length ?? 0 },
        ...(s.contacts[a.id] ?? []).filter(c => c.acquired).slice(0, 16).map((c, index) => ({id:`${a.id}.${index}`, label:a.label, value:`(${(c.x / TILE).toFixed(1)}, ${(c.y / TILE).toFixed(1)})`}))]),
        ...cfg.emitters.map(a => ({ id: a.id, label: a.label, value: s.emitters[a.id].active ? 1 : 0 })), ...cfg.decoys.map(a => ({ id: a.id, label: a.label, value: s.decoys[a.id].charges }))]; },
    render(e, privateView = false): SensorsVisual | undefined {
      const missile=sead.render(e)??fpv.render(e),flight=missile?.flight??flightControls.render(e),deployed=battery.deployed(e)??fpv.deployed(e);
      if (!privateView) return flight||deployed!==undefined?{...(flight?{flight}:{}),...(deployed!==undefined?{deployed,...battery.visual(e)}:{}),...(missile?.hidden?{hidden:true}:{}),contacts:[]}:undefined;
      const cfg = config(e), s = states.get(e.id); if (!cfg || !s) return;
      return { ...(flight?{flight}:{}), ...(deployed!==undefined?{deployed,...battery.visual(e)}:{}), ...(missile?.hidden?{hidden:true}:{}), contacts: cfg.sensors.flatMap(sensor => (s.contacts[sensor.id] ?? []).map(c => ({ sensor: sensor.id, label: sensor.label, channel: sensor.channel, reveal: sensor.reveal, x: c.x, y: c.y, seenAt: c.seen, acquired: c.acquired, ...(c.strength !== undefined ? {strength:c.strength} : {}) }))) };
    },
    snapshot(view) {
      if (!view) return { ...(fpv.hasState()?{fpv:fpv.snapshot(view)}:{}), ...(battery.hasState()?{radarBattery:battery.snapshot(view)}:{}), ...(sead.hasState()?{sead:sead.snapshot()}:{}), ...(radarControls.hasState()?{radarControls:radarControls.snapshot()}:{}), ...(flightControls.hasState()?{flightControls:flightControls.snapshot()}:{}), ...(sourceOrdnance.hasState()?{sourceOrdnance:sourceOrdnance.snapshot()}:{}), states: [...states], locks: [...locks], flights: [...flights] } as unknown as Json;
      // Flight solutions and launch locks are host-only simulation state. Contacts
      // retain measured positions, but never a reference absent from this view.
      const visible = (id: number): boolean => view.visibleEntities.has(id);
      const entries = [...states].filter(([id]) => visible(id) && view.privateEntity(id)).map(([id,s]) => [id, {
        emitters: s.emitters, decoys: s.decoys, scans: s.scans,
        contacts: Object.fromEntries(Object.entries(s.contacts).map(([key,list]) => [key,list.map(c => ({...c,target:visible(c.target) ? c.target : 0}))])),
        ...(s.link && visible(s.link) ? {link:s.link} : {}),
      }]);
      return { ...(fpv.hasState()?{fpv:fpv.snapshot(view)}:{}), ...(battery.hasState()?{radarBattery:battery.snapshot(view)}:{}), ...(sead.hasState()?{sead:sead.snapshot(view)}:{}), ...(radarControls.hasState()?{radarControls:radarControls.snapshot(view)}:{}), ...(flightControls.hasState()?{flightControls:flightControls.snapshot(view)}:{}), ...(sourceOrdnance.hasState()?{sourceOrdnance:sourceOrdnance.snapshot(view)}:{}), states: entries, locks: [], flights: [] } as unknown as Json;
    },
    restore(value) {
      if (!record(value) || !Array.isArray(value.states) || value.states.length > st.ents.size || !Array.isArray(value.locks) || value.locks.length > st.ents.size * 8 || !Array.isArray(value.flights) || value.flights.length > st.projs.length) throw new Error('Invalid sensor state');
      sourceOrdnance.restore(value.sourceOrdnance);
      flightControls.restore(value.flightControls);
      radarControls.restore(value.radarControls);
      sead.restore(value.sead);
      battery.restore(value.radarBattery);
      fpv.restore(value.fpv);
      states.clear(); locks.clear(); flights.clear();
      const finite = (v: unknown, min = 0, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
      const integer = (v: unknown): v is number => finite(v) && Number.isInteger(v);
      if (Array.isArray(value.states)) for (const entry of value.states.slice(0, st.ents.size)) {
        if (!Array.isArray(entry) || !integer(entry[0]) || !record(entry[1])) throw new Error('Invalid sensor entity');
        const e = st.ents.get(entry[0]), raw = entry[1], cfg = e && config(e); if (!e || !cfg || !record(raw.emitters) || !record(raw.decoys) || !record(raw.contacts)) throw new Error('Invalid sensor membership');
        if (states.has(entry[0]) || raw.scans !== undefined && (!record(raw.scans) || Object.keys(raw.scans).some(id => !cfg.sensors.some(sensor => sensor.id === id)))) throw new Error('Invalid sensor scan clocks');
        const s = state(e);
        for (const def of cfg.emitters) {
          const a = record(raw.emitters) && raw.emitters[def.id];
          if (record(a) && typeof a.active === 'boolean' && finite(a.ready, 0, st.time + def.toggleTime + .1) && finite(a.cooldown, 0, st.time + def.toggleTime + def.cooldown + .1) && (a.pending === undefined || typeof a.pending === 'boolean')) s.emitters[def.id] = { active: a.active, ready: a.ready, cooldown: a.cooldown, ...(typeof a.pending === 'boolean' ? {pending:a.pending} : {}) };
          else throw new Error('Invalid emitter state');
        }
        for (const def of cfg.decoys) {
          const a = record(raw.decoys) && raw.decoys[def.id];
          if (record(a) && integer(a.charges) && a.charges <= def.charges && finite(a.until, 0, st.time + def.duration + .1) && finite(a.ready, 0, st.time + def.cooldown + .1) && integer(a.serial) && a.serial <= def.charges) s.decoys[def.id] = { charges:a.charges, until:a.until, ready:a.ready, serial:a.serial };
          else throw new Error('Invalid decoy state');
        }
        for (const sensor of cfg.sensors) {
          const sampled = record(raw.scans) ? raw.scans[sensor.id] : undefined;
          if (sampled !== undefined && !finite(sampled, 0, st.time + .1)) throw new Error('Invalid sensor scan clock');
          if (typeof sampled === 'number') s.scans[sensor.id] = sampled;
          const contacts = record(raw.contacts) && raw.contacts[sensor.id];
          s.contacts[sensor.id] = [];
          if (contacts !== undefined && (!Array.isArray(contacts) || contacts.length > sensor.maxTracks)) throw new Error('Invalid sensor contacts');
          if (Array.isArray(contacts)) for (const c of contacts) if (record(c) && integer(c.target) && finite(c.x, 0, st.map.w * TILE) && finite(c.y, 0, st.map.h * TILE) && finite(c.since, 0, st.time + .1) && finite(c.seen, c.since, st.time + .1) && typeof c.acquired === 'boolean' && (c.strength === undefined || sensor.mode === 'signature' && finite(c.strength, sensor.minimumSignature, 1e6))) s.contacts[sensor.id].push({target:c.target,x:c.x,y:c.y,since:c.since,seen:c.seen,acquired:c.acquired,...(typeof c.strength === 'number' ? {strength:c.strength} : {})}); else throw new Error('Invalid sensor contact');
        }
        if (integer(raw.link) && st.ents.get(raw.link)?.owner === e.owner) s.link = raw.link;
      }
      if (Array.isArray(value.locks)) for (const entry of value.locks.slice(0, st.ents.size * 8)) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !record(entry[1])) throw new Error('Invalid seeker lock');
        const [id, weapon] = entry[0].split('/'), e = st.ents.get(Number(id)), a = entry[1];
        if (e && getDef(e.defId).weapons.some(w => w.id === weapon && host.config<GuidanceDef>(w)) && integer(a.target) && finite(a.since, 0, st.time + .1) && finite(a.checked, a.since, st.time + .1) && typeof a.ready === 'boolean') locks.set(entry[0], {target:a.target,since:a.since,checked:a.checked,ready:a.ready}); else throw new Error('Invalid seeker lock');
      }
      if (Array.isArray(value.flights)) for (const entry of value.flights.slice(0, st.projs.length)) {
        if (!Array.isArray(entry) || !integer(entry[0]) || !record(entry[1])) throw new Error('Invalid guidance flight');
        const p = st.projs.find(p => p.id === entry[0]), a = entry[1];
        if (!p?.gun) throw new Error('Invalid guidance projectile');
        const slash = p.gun.lastIndexOf('/'), def = DEFS[p.gun.slice(0, slash)], weapon = def?.weapons.find(w => w.id === p.gun!.slice(slash + 1)), spec = weapon && host.config<GuidanceDef>(weapon);
        if (!spec || !integer(a.source) || !integer(a.target) || !finite(a.age, 0, spec.maxLife + 1) || !finite(a.lost, 0, spec.maxLife + 1) || !finite(a.x, 0, st.map.w * TILE) || !finite(a.y, 0, st.map.h * TILE) || typeof a.permanent !== 'boolean' || !Array.isArray(a.tried) || a.tried.length > 32768 || !a.tried.every(x => typeof x === 'string' && /^\d+\/[a-zA-Z0-9_.-]{1,64}\/\d+$/.test(x))) throw new Error('Invalid guidance flight');
        flights.set(entry[0], {spec,source:a.source,target:a.target,age:a.age,lost:a.lost,x:a.x,y:a.y,permanent:a.permanent,tried:[...a.tried]});
      }
    },
  };
  return module;
}
