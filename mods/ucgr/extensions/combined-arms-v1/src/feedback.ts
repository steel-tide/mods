import type { EngineModuleInstance, Json, ModuleHost, RuntimeView } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { EffectPicture } from './effectPictures';
import { stepSourceParticle, sourceParticleVisible, type SourceParticle } from './sourceParticles';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { UnitDef, WeaponDef } from '../../../../../../steel-tide/game/core/src/core/types';
import type { Proj } from '../../../../../../steel-tide/game/core/src/game/state';
import { logisticsReloadSerial, logisticsStock } from './logistics';
import { sensorDeployed, sensorFpvDeployed } from './sensors';
import { getDef, Terrain, TILE } from './host';
import { componentVisualDamage, componentVisualLayers, componentRackFailure, componentProjectileVariant } from './components';
import { FEEDBACK_ID, type FeedbackDef, type VoiceCue, type ImpactSound, sameProjectileVariant, impactTopic, feedbackEffectPicture } from './feedbackSpec';

export interface FeedbackVisual { asset: string; x: number; y: number; scale: number; frame?: number; frames?: number; scaleX?: number; alpha?: number; under?: boolean; detachTurret?: boolean }
const feedbackModules = new WeakMap<Game, FeedbackModule>();
export function emitSourceActionEffect(game: Game, entity: Ent, action: string, x = entity.x, y = entity.y, angle = entity.angle): boolean {
  return feedbackModules.get(game)?.actionEffect(entity, action, x, y, angle) ?? false;
}
/** Source-public indicators contain only an icon choice, never internal damage or stock values. */
export class FeedbackModule implements EngineModuleInstance {
  readonly id = FEEDBACK_ID;
  private audioStates = new Map<number, { born: number; phase: number[]; sequence: number; rackSerial: number; detached: boolean; reloads: Record<string, number> }>();
  private living = new Map<number, Ent>();
  private launches = new Map<number, number>();
  private cueChoices = new Map<string, number>();
  private choose(cue: VoiceCue, key: string): string | undefined {
    // RW class_392 advances a definition-owned cyclic list, independently of
    // combat RNG and emitter identity. Keep that cursor in match state.
    const index = (this.cueChoices.get(key) ?? 0) % cue.assets.length;
    this.cueChoices.set(key, (index + 1) % cue.assets.length);
    return cue.assets[index];
  }
  private received = new Map<number, { icons: number[]; public: boolean; era?: number[]; detached?: boolean; appearance?: number }>();
  private particles: SourceParticle[] = [];
  constructor(private host: ModuleHost) { feedbackModules.set(host.game, this); }
  actionEffect(e: Ent, action: string, x: number, y: number, angle: number): boolean {
    const effects = this.config(e)?.actions?.[action];
    if (!effects) return false;
    this.effects(effects, e.defId, `action-${action}`, x, y, angle, e.id, this.host.game.st.tick); return true;
  }
  private particlePicture(key: string): EffectPicture | undefined {
    const m = /^ucgr\.effect:([^:]+):([^:]+):([\d.]+)$/.exec(key);
    return m ? feedbackEffectPicture(this.host.config<FeedbackDef>(getDef(m[1])), m[2], m[3]) : undefined;
  }
  particleVisuals(player?: number): SourceParticle[] {
    return this.particles.filter(p => { const picture = this.particlePicture(p.key); return picture && sourceParticleVisible(this.host.game, player, p, picture); });
  }
  private config(e: Ent): FeedbackDef | undefined { return this.host.config(getDef(e.defId)); }
  private sound(e: Ent, cue: VoiceCue, sequence: number, topic: string): void {
    // Effects are already filtered by native fog/replication. This transports
    // only public audible cues, never private stock or component values.
    const resource = this.choose(cue, `${e.defId}/${topic}`);
    if (!resource) return;
    this.host.game.st.effects.push({ key: `ucgr.audio:${resource}:${e.id}:${sequence}`, x: e.x, y: e.y, t: 0, dur: .5, frames: 1, scale: cue.gain });
  }
  onShot(e: Ent, _def: UnitDef, weapon: WeaponDef, projectile: Proj): void {
    if (weapon.fan && e.burstLeft > 0) return;
    const cfg = this.config(e), flashes = cfg?.flashes?.find(s => s.weapon === weapon.id);
    if (flashes) {
      const effects = this.host.game.st.effects;
      let index = -1;
      for (let i = effects.length - 1; i >= 0; i--) {
        const f = effects[i];
        if (f.t === 0 && f.x === projectile.x && f.y === projectile.y && (f.key === 'fx.muzzle' || f.recoil?.src === e.id)) { index = i; break; }
      }
      const marker = effects[index], bearing = marker?.bore ?? (weapon.turret ? e.turretAngle : e.angle);
      if (marker) {
        if (marker.recoil) { marker.key = '@recoil'; delete marker.charge; }
        else effects.splice(index, 1);
      }
      this.effects(flashes.effects, e.defId, `shot-${weapon.id}`, projectile.x, projectile.y, bearing, projectile.id ?? e.id, this.host.game.st.tick);
    }
    const shot = cfg?.audio?.shots.find(s => s.weapon === weapon.id), cue = shot?.cue;
    if (!cfg) return;
    // The host has emitted this shot's ordinary sound before onShot. Replace
    // precisely that event; recoil, muzzle art and all other events stay native.
    const events = this.host.game.st.events;
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event.type === 'sound' && event.sound === (weapon.sound ?? 'mg') && event.x === e.x && event.y === e.y) {
        events.splice(i, 1); break;
      }
    }
    // A source recording with unproven gain remains silent; no synthesized
    // class sound is substituted for an omitted original cue.
    if (!shot || !cue) return;
    const identity = projectile.id ?? this.host.game.st.tick;
    if (shot.atProjectile && projectile.id !== undefined) { this.launches.set(projectile.id, this.host.game.st.time + (shot.delay ?? 0)); return; }
    this.sound(e, cue, identity, `shot-${weapon.id}`);
  }
  beforeStep(dt = 0): void {
    this.particles = this.particles.filter(p => { const picture = this.particlePicture(p.key); return picture && stepSourceParticle(p, picture, dt); });
    for (const e of this.host.participants()) {
      const cfg = this.config(e)?.audio;
      if (!cfg || e.dead) continue;
      this.living.set(e.id, e);
      if (!this.audioStates.has(e.id)) this.audioStates.set(e.id, { born: this.host.game.st.time, phase: cfg.periodic.map(() => -1), sequence: 0, rackSerial: componentRackFailure(this.host.game, e)?.serial ?? 0, detached: false,
        reloads: Object.fromEntries(cfg.reloads.map(r => [r.stock, logisticsReloadSerial(this.host.game, e, r.stock)])) });
      const state = this.audioStates.get(e.id)!;
      if (e.site || e.inside) continue;
      cfg.periodic.forEach((p, i) => {
        const phase = Math.floor((this.host.game.st.time - state.born + 1e-8) / p.interval);
        if (phase > state.phase[i]) { state.phase[i] = phase; this.sound(e, p.cue, state.sequence++, `periodic-${i}`); }
      });

    }
  }
  afterStep(): void {
    for (const [id, ready] of this.launches) {
      const projectile = this.host.game.st.projs.find(p => p.id === id);
      if (!projectile) { this.launches.delete(id); continue; }
      if (this.host.game.st.time + 1e-8 < ready) continue;
      const shot = this.launchCue(projectile), cue = shot?.cue;
      if (cue) {
        const resource = this.choose(cue, `${projectile.gun}/launch`);
        this.host.game.st.effects.push({ key: `ucgr.audio:${resource}:0:${id}`, x: projectile.x, y: projectile.y, t: 0, dur: .5, frames: 1, scale: cue.gain });
      }
      this.launches.delete(id);
    }
    for (const [id, e] of this.living) {
      const cfg = this.config(e)?.audio, state = this.audioStates.get(id);
      if (!cfg || !state) continue;
      if (e.dead) {
        if (cfg.death) this.sound(e, cfg.death, state.sequence++, 'death');
        this.living.delete(id); this.audioStates.delete(id); continue;
      }
      if (!this.host.game.st.ents.has(id)) { this.living.delete(id); this.audioStates.delete(id); continue; }
      if (e.site || e.inside) continue;
      const rack = this.config(e)?.rack, failure = componentRackFailure(this.host.game, e);
      if (rack && failure && failure.serial > state.rackSerial) {
        const branch = failure.hull <= rack.threshold ? 'rack-low' : 'rack-high';
        this.effects(branch === 'rack-low' ? rack.low : rack.high, e.defId, branch, e.x, e.y, e.angle, e.id, this.host.game.st.tick);
        state.rackSerial = failure.serial; state.detached = branch === 'rack-low';
      }
      for (const r of cfg.reloads) {
        const serial = logisticsReloadSerial(this.host.game, e, r.stock), previous = state.reloads[r.stock];
        if (previous !== undefined && serial > previous) this.sound(e, r.cue, state.sequence++, `reload-${r.stock}`);
        state.reloads[r.stock] = serial;
      }
    }
  }
  private launchCue(projectile: Proj) {
    if (!projectile.gun) return;
    const split = projectile.gun.indexOf('/');
    if (split < 0) return;
    return this.host.config<FeedbackDef>(getDef(projectile.gun.slice(0, split)))?.audio?.shots.find(s => s.weapon === projectile.gun!.slice(split + 1) && s.atProjectile);
  }
  private effects(effects: ImpactSound[], defId: string, topic: string, x: number, y: number, angle: number, identity: number, tick: number): void {
    let seed = (identity ^ Math.imul(tick, 1103515245)) >>> 0, sequence = 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const map = this.host.game.st.map, tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const terrain = tx >= 0 && ty >= 0 && tx < map.w && ty < map.h ? map.terrain[ty * map.w + tx] : undefined;
    const water = terrain === Terrain.DeepWater || terrain === Terrain.Water || terrain === Terrain.Shallows;
    const visit = (nodes: ImpactSound[], path = ''): void => { for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index], branch = path ? `${path}.${index}` : `${index}`;
      if (water ? !node.water : !node.land) continue;
      if (random() >= node.chance) continue;
      if (node.cue) {
        const cue = node.cue, resource = this.choose(cue, `${defId}/${topic}/${branch}`);
        if (resource) this.host.game.st.effects.push({ key: `ucgr.audio:${resource}:0:${identity * 128 + sequence++}`, x, y, t: 0, dur: .5, frames: 1, scale: cue.gain });
      }
      if (node.picture) {
        const v = node.picture, c = Math.cos(angle), s = Math.sin(angle);
        const jitter = (key: keyof NonNullable<typeof v.random>) => (v.random?.[key] ?? 0) * (random() * 2 - 1);
        const key = `ucgr.effect:${defId}:${topic}:${branch}`;
        const forward = v.forward + jitter('forward'), lateral = v.lateral + jitter('lateral');
        const speedForward = v.speedForward + jitter('speedForward'), speedLateral = v.speedLateral + jitter('speedLateral');
        const dynamic = v.atmospheric || v.physics || v.showInFog || v.spin;
        const height = (v.height ?? 0) + jitter('height'), vh = (v.heightVelocity ?? 0) + jitter('heightVelocity');
        const px = x + v.x + jitter('x') + c * forward - s * lateral, py = y + v.y + jitter('y') - (dynamic ? 0 : height) + s * forward + c * lateral;
        const bearing = (v.zero ? 0 : angle + Math.PI / 2) + v.dir + jitter('dir');
        const vx = v.vx + jitter('vx') + c * speedForward - s * speedLateral;
        const vy = v.vy + jitter('vy') - (dynamic ? 0 : vh) + s * speedForward + c * speedLateral;
        if (dynamic) { this.particles.push({ key, x: px, y: py, height, vx, vy, vh, rotation: bearing, spin: v.spin ?? 0, age: 0 }); }
        else
        if (v.under) this.host.game.st.decals.push({ id: this.host.game.st.nextDecalId++, key, frame: 0, x: px, y: py, t: v.duration, rot: bearing, vx, vy });
        else this.host.game.st.effects.push({ key, x: px, y: py, t: 0, dur: v.duration, frames: v.frames, bore: bearing,
          vx, vy });
      }
      if (node.children) visit(node.children, branch);
    } };
    visit(effects);
  }
  wrapImpact(next: NonNullable<EngineModuleInstance['wrapImpact']> extends (next: infer N) => unknown ? N : never) {
    return (...args: Parameters<typeof next>) => {
      const p = args[2], split = p.gun?.indexOf('/') ?? -1;
      let ownsEffects = false;
      if (p.gun && split > 0) {
        const id = p.gun.slice(0, split), weapon = p.gun.slice(split + 1);
        const cfg = this.host.config<FeedbackDef>(getDef(id)), variant = componentProjectileVariant(this.host.game, p);
        const effects = cfg?.impacts?.find(v => v.weapon === weapon && sameProjectileVariant(v.variant, variant))?.effects;
        // A transient child probe belongs to its own source definition. Missing
        // child media stays silent instead of replaying the parent's explosion.
        ownsEffects = !!effects || (!!variant && !!cfg);
        if (effects) this.effects(effects, id, impactTopic(weapon, variant), p.x, p.y, p.angle, p.id ?? 0, this.host.game.st.tick);
      }
      const state = this.host.game.st, eventsBefore = state.events.length, effectsBefore = state.effects.length;
      const decalsBefore = ownsEffects ? new Set(state.decals) : undefined;
      next(...args);
      if (ownsEffects) {
        // The public manifest has no ground-mark override. Remove only the
        // cosmetic mark newly emitted at this owned impact, retaining damage,
        // pre-existing terrain art, wrecks and the original source decals.
        for (let i = state.decals.length - 1; i >= 0; i--) {
          const decal = state.decals[i];
          if (!decalsBefore!.has(decal) && decal.key.startsWith('mark.') && decal.x === p.x && decal.y === p.y) state.decals.splice(i, 1);
        }
        // Source custom lists own their impact feedback. Preserve unrelated
        // hit/death events; the native impact appends its class sound last.
        for (let i = state.events.length - 1; i >= eventsBefore; i--) {
          const event = state.events[i];
          if (event.type === 'sound' && event.x === p.x && event.y === p.y && ['expl', 'explBig', 'splash'].includes(event.sound)) { state.events.splice(i, 1); break; }
        }
        // Water impacts bypass WeaponLook.impact in the host's ordinary path.
        for (let i = state.effects.length - 1; i >= effectsBefore; i--) {
          const effect = state.effects[i];
          if (effect.x === p.x && effect.y === p.y && ['fx.splash', 'fx.splash.l'].includes(effect.key)) { state.effects.splice(i, 1); break; }
        }
      }
    };
  }
  private detached(e: Ent, cfg: FeedbackDef): boolean {
    const received = this.received.get(e.id);
    if (received?.public) return received.detached === true;
    return !!cfg.rack && (this.audioStates.get(e.id)?.detached ?? received?.detached ?? false);
  }

  private icons(e: Ent, cfg: FeedbackDef): number[] {
    const received = this.received.get(e.id);
    // A public network view cannot reconstruct private components. Even a local
    // snapshot that initializes empty component defaults must retain these icons.
    if (received?.public) return received.icons;
    const damage = componentVisualDamage(this.host.game, e);
    if (!damage) return received?.icons ?? cfg.cosmetics.map(() => 0);
    return cfg.cosmetics.map(c => {
      const p = damage[c.part];
      // Source draws the destroyed image last at the shared inclusive boundary.
      return !p ? 0 : p.damage >= p.threshold ? 2 : p.damage >= p.hp * .65 ? 1 : 0;
    });
  }
  private era(e: Ent, cfg: FeedbackDef): number[] {
    const layers = componentVisualLayers(this.host.game, e)?.chemical;
    if (!layers) return this.received.get(e.id)?.era ?? cfg.era?.map(() => 0) ?? [];
    return cfg.era?.map(p => { const value = layers[p.face]; return value === p.maximum ? 0 : value >= p.maximum * .75 ? 1 : value >= p.maximum * .4 ? 2 : 3; }) ?? [];
  }
  private appearanceIndex(e: Ent, cfg: FeedbackDef): number | undefined {
    const appearance = cfg.appearance;
    if (!appearance) return;
    const received = this.received.get(e.id);
    if (received?.public) return received.appearance;
    const deployed = sensorDeployed(this.host.game, e) ?? sensorFpvDeployed(this.host.game, e);
    if (deployed === undefined) return received?.appearance;
    const amount = appearance.variantModulo ? e.id % appearance.variantModulo : appearance.stock ? logisticsStock(this.host.game, e, appearance.stock)?.amount ?? 0 : 0;
    let index: number | undefined, minimum = -1;
    appearance.states.forEach((state, i) => {
      if (state.deployed === deployed && state.minimum <= amount && state.minimum > minimum) { index = i; minimum = state.minimum; }
    });
    return index;
  }
  appearance(e: Ent) {
    const cfg = this.config(e), index = cfg && this.appearanceIndex(e, cfg);
    return cfg && index !== undefined ? cfg.appearance?.states[index] : undefined;
  }
  render(e: Ent, privateView = false): FeedbackVisual[] {
    const cfg = this.config(e);
    if (!cfg || e.dead || e.site || e.inside) return [];
    const icons: FeedbackVisual[] = this.icons(e, cfg).flatMap((state, i) => state ? [{ asset: state === 2 ? cfg.cosmetics[i].destroyed : cfg.cosmetics[i].damaged,
      x: cfg.cosmetics[i].x, y: cfg.cosmetics[i].y, scale: cfg.cosmetics[i].scale }] : []);
    if (privateView) this.era(e, cfg).forEach((frame, i) => { const p = cfg.era![i]; icons.push({ asset: p.asset, x: p.x, y: p.y, scale: p.scaleY, scaleX: p.scaleX, alpha: p.alpha, frames: 4, frame, under: true }); });
    if (this.detached(e, cfg)) icons.push({ asset: '', x: 0, y: 0, scale: 0, detachTurret: true });
    return icons;
  }
  snapshot(view?: RuntimeView): Json {
    const out: Record<string, Json> = {};
    for (const e of this.host.participants()) {
      const cfg = this.config(e);
      if (!cfg || (!cfg.cosmetics.length && !cfg.appearance) || e.dead || e.site || e.inside || (view && !view.visibleEntities.has(e.id))) continue;
      const appearance = this.appearanceIndex(e, cfg);
      out[e.id] = { ...(appearance !== undefined ? { appearance } : {}), icons: this.icons(e, cfg), public: this.received.get(e.id)?.public === true || (!!view && !view.privateEntity(e.id)), ...(this.detached(e, cfg) ? { detached: true } : {}), ...(cfg.era?.length && !this.received.get(e.id)?.public && (!view || view.privateEntity(e.id)) ? { era: this.era(e, cfg) } : {}) };
    }
    const audio: Record<string, Json> = {};
    for (const [id, state] of this.audioStates) if (!view || view.visibleEntities.has(id) && view.privateEntity(id)) audio[id] = JSON.parse(JSON.stringify(state)) as Json;
    if (Object.keys(audio).length) out.$audio = audio;
    const launches = [...this.launches].filter(([id]) => !view || view.visibleProjectiles.has(id));
    if (launches.length) out.$launches = launches;
    const particles = this.particleVisuals(view?.player);
    if (particles.length) out.$particles = JSON.parse(JSON.stringify(particles)) as Json;
    if (!view && this.cueChoices.size) out.$choices = Object.fromEntries(this.cueChoices);
    return out;
  }
  restore(raw: unknown): void {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid feedback state');
    const next = new Map<number, { icons: number[]; public: boolean; era?: number[]; detached?: boolean; appearance?: number }>();
    const audio = new Map<number, { born: number; phase: number[]; sequence: number; rackSerial: number; detached: boolean; reloads: Record<string, number> }>();
    const particles: SourceParticle[] = [];
    const launches = new Map<number, number>(), choices = new Map<string, number>();
    for (const [id, value] of Object.entries(raw)) {
      if (id === '$particles') {
        if (!Array.isArray(value) || value.length > 200000) throw new Error('Invalid source particles');
        for (const p of value as SourceParticle[]) {
          const picture = p && typeof p.key === 'string' && this.particlePicture(p.key);
          if (!picture || Object.keys(p).some(k => !['key','x','y','height','vx','vy','vh','rotation','spin','age'].includes(k))
            || ['x','y','height','vx','vy','vh','rotation','spin','age'].some(k => !Number.isFinite((p as any)[k]))
            || p.age < 0 || p.age > picture.duration + 1e-8) throw new Error('Invalid source particles');
          particles.push({ ...p });
        }
        continue;
      }
      if (id === '$choices') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source recording cursor');
        for (const [key, index] of Object.entries(value)) {
          if (key.length > 512 || !Number.isInteger(index) || Number(index) < 0 || Number(index) > 15) throw new Error('Invalid source recording cursor');
          choices.set(key, Number(index));
        }
        continue;
      }
      if (id === '$launches') {
        if (!Array.isArray(value) || value.length > this.host.game.st.projs.length) throw new Error('Invalid queued source launch sound');
        for (const entry of value) {
          if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[0]) || launches.has(entry[0]) || !Number.isFinite(entry[1])) throw new Error('Invalid queued source launch sound');
          const projectile = this.host.game.st.projs.find(p => p.id === entry[0]), shot = projectile && this.launchCue(projectile);
          if (!projectile || !shot || entry[1] < this.host.game.st.time - 1e-8 || entry[1] > this.host.game.st.time + (shot.delay ?? 0) + 1e-8) throw new Error('Invalid queued source launch sound');
          launches.set(entry[0], entry[1]);
        }
        continue;
      }
      if (id === '$audio') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid feedback audio state');
        for (const [key, state] of Object.entries(value)) {
          const e = this.host.game.st.ents.get(Number(key)), cfg = e && this.config(e)?.audio;
          const a = state as { born: number; phase: number[]; sequence: number; rackSerial: number; detached: boolean; reloads: Record<string, number> };
          if (!e || e.dead || !cfg || !a || Object.keys(a).some(k => !['born', 'phase', 'sequence', 'rackSerial', 'detached', 'reloads'].includes(k)) || !Number.isFinite(a.born) || a.born < 0 || a.born > this.host.game.st.time || typeof a.detached !== 'boolean' || !Number.isInteger(a.rackSerial) || a.rackSerial < 0 || a.rackSerial > 1 || !Number.isInteger(a.sequence) || a.sequence < 0 || !Array.isArray(a.phase) || a.phase.length !== cfg.periodic.length || a.phase.some(v => !Number.isInteger(v) || v < -1) || !a.reloads || typeof a.reloads !== 'object' || Array.isArray(a.reloads) || Object.entries(a.reloads).some(([k, v]) => !cfg.reloads.some(r => r.stock === k) || !Number.isInteger(v) || v < 0)) throw new Error('Invalid feedback audio state');
          audio.set(e.id, JSON.parse(JSON.stringify(a)));
        }
        continue;
      }
      const e = this.host.game.st.ents.get(Number(id)), cfg = e && this.config(e);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid feedback indicator');
      const data = value as { icons: unknown; public: unknown; era?: number[]; detached?: boolean; appearance?: number };
      if (!e || e.dead || (!cfg || (!cfg.cosmetics.length && !cfg.appearance)) || String(e.id) !== id || Object.keys(value).some(k => k !== 'icons' && k !== 'public' && k !== 'era' && k !== 'detached' && k !== 'appearance') || typeof data.public !== 'boolean' || !Array.isArray(data.icons) || data.icons.length !== cfg.cosmetics.length || data.icons.some(v => v !== 0 && v !== 1 && v !== 2)) throw new Error('Invalid feedback indicator');
      if (data.era !== undefined && (data.public || !Array.isArray(data.era) || data.era.length !== cfg.era?.length || data.era.some(v => !Number.isInteger(v) || v < 0 || v > 3))) throw new Error('Invalid feedback armor frames');
      if (data.detached !== undefined && (typeof data.detached !== 'boolean' || !cfg.rack)) throw new Error('Invalid feedback turret state');
      if (data.appearance !== undefined && (!cfg.appearance || !Number.isSafeInteger(data.appearance) || data.appearance < 0 || data.appearance >= cfg.appearance.states.length)) throw new Error('Invalid feedback source appearance');
      next.set(e.id, { ...(data.appearance !== undefined ? { appearance: data.appearance } : {}), icons: [...data.icons], public: data.public, ...(data.detached ? { detached: true } : {}), ...(data.era ? { era: [...data.era] } : {}) });
    }
    this.received = next; this.audioStates = audio; this.launches = launches; this.cueChoices = choices; this.particles = particles; this.living.clear();
    for (const id of audio.keys()) this.living.set(id, this.host.game.st.ents.get(id)!);
  }
  dispose(): void { feedbackModules.delete(this.host.game); this.particles = []; this.received.clear(); this.audioStates.clear(); this.launches.clear(); this.cueChoices.clear(); this.living.clear(); }
}
export const createFeedbackModule = (host: ModuleHost): EngineModuleInstance => new FeedbackModule(host);
