import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { FEEDBACK_ID, type FeedbackDef, type ProjectileVariant, type AppearanceState, sameProjectileVariant, feedbackEffectPicture } from './feedbackSpec';
import { getDef, normAngle } from './presentationHost';
import { contentRuntime, contentStateRuntime } from './presentationHost';
import { canSee } from './presentationHost';
import { FIELD_COLORS } from './presentationHost';
import type { SensorsVisual } from './sensors';
import type { Camera } from '../../../../../../steel-tide/game/core/src/render/camera';
import { createExtendedRenderer } from './presentationHost';
import type { ArticulationVisual } from './articulation';
import type { Effect, Proj, Decal } from '../../../../../../steel-tide/game/core/src/game/state';
import type { ContentDrawBounds } from '../../../../../../steel-tide/game/core/src/render/contentVisuals';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import { getSprite } from './presentationHost';
import { Renderer, type EntityPicture } from './presentationHost';
import { recoilSprites } from './presentationHost';
import type { EffectPicture } from './effectPictures';
import type { ViewState } from '../../../../../../steel-tide/game/core/src/render/renderer';
import type { SourceParticle } from './sourceParticles';
import type { FeedbackVisual } from './feedback';
import { FeedbackPictures } from './feedbackPresentation';

/** Module presentation reuses the ordinary shadow, lighting and thermal passes. */
const ExtendedRenderer = createExtendedRenderer((state, hash, team, entity, throughFog) =>
  contentStateRuntime(state)?.visible(entity, team, throughFog) ?? canSee(state, hash, team, entity, throughFog));
export function createContentRenderer(Base:typeof Renderer=ExtendedRenderer) {
 return class ContentRenderer extends Base {
  constructor(...args: ConstructorParameters<typeof Renderer>) {
    super(...args);
    this.overlays.add({ world: (g, cam) => { this.drawSignalContacts(g, cam); this.drawSourceParticles(g, false); }, screen() {} });
    const feedback = new FeedbackPictures();
    this.overlays.add({ world: (g, cam, alpha) => feedback.draw(this.game, this.humanIdx, this.neutral, g, cam, alpha), screen() {} });
  }
  drawContentEffect(g: CanvasRenderingContext2D, effect: Effect, cam: Camera, alpha: number, bounds: ContentDrawBounds): boolean {
    if (effect.key.startsWith('ucgr.audio:')) return true;
    const picture = this.effectPicture(effect.key);
    if (!picture) return false;
    this.drawSourceEffect(g, picture, effect.x, effect.y, effect.t, effect.bore ?? 0); return true;
  }
  private projectilePictures = new FeedbackPictures();
  drawContentProjectileTrail(_g: CanvasRenderingContext2D, p: Proj, _alpha: number, _bounds: ContentDrawBounds): boolean {
    if (!p.gun) return false;
    const slash = p.gun.indexOf('/');
    const cfg = getDef(p.gun.slice(0, slash)).extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
    // Original images and helper entities own their appearance. An uncompiled
    // source atmospheric trail must not become a synthetic host-class trail.
    return cfg?.projectiles?.some(v => v.weapon === p.gun!.slice(slash + 1)) ?? false;
  }
  drawContentProjectile(g: CanvasRenderingContext2D, p: Proj, alpha: number, _bounds: ContentDrawBounds): boolean {
    if (!p.gun) return false;
    const slash = p.gun.indexOf('/');
    const cfg = getDef(p.gun.slice(0, slash)).extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
    const components = contentRuntime(this.game)?.module('components-v1') as { projectileVisual?(p: Proj): (Partial<ProjectileVariant> & { altitude?: number }) | undefined } | undefined;
    const componentVisual = components?.projectileVisual?.(p);
    const variant = componentVisual?.kind !== undefined && componentVisual.index !== undefined ? { kind: componentVisual.kind, index: componentVisual.index, branch: componentVisual.branch } : undefined;
    const picture = cfg?.projectiles?.find(v => v.weapon === p.gun!.slice(slash + 1) && sameProjectileVariant(v.variant, variant));
    if (!picture && variant && cfg) return true;
    if (!picture) return false;
    if (picture.hidden) return true;
    const image = picture.asset && this.projectilePictures.image(picture.asset);
    if (!image) return true;
    const sensors = contentRuntime(this.game)?.module('sensors-v1') as { projectileVisual?(p: Proj): { altitude: number } | undefined } | undefined;
    const altitude = componentVisual?.altitude ?? sensors?.projectileVisual?.(p)?.altitude;
    const lift = altitude !== undefined ? altitude * .4 : this.projLift(p, alpha);
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha - lift;
    g.save(); g.translate(x, y); g.rotate(p.angle + Math.PI / 2);
    const width = image.naturalWidth * picture.scale, height = image.naturalHeight * picture.scale;
    g.drawImage(image, -width / 2, -height / 2, width, height); g.restore();
    return true;
  }
  drawContentDecal(g: CanvasRenderingContext2D, decal: Decal, _cam: Camera, _alpha: number, _bounds: ContentDrawBounds): boolean {
    const effect = this.effectPicture(decal.key);
    if (effect) {
      const age = effect.duration - decal.t;
      this.drawSourceEffect(g, effect, decal.x + (decal.vx ?? 0) * age, decal.y + (decal.vy ?? 0) * age, age, decal.rot ?? 0); return true;
    }
    const match = /^(?:hulk|crash)\.(.+)$/.exec(decal.key);
    if (!match) return false;
    const cfg = getDef(match[1]).extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
    if (!cfg?.wreck) return false;
    g.save(); g.translate(decal.x, decal.y);
    // Native crash decals retain the final heading and spin for the landing.
    g.rotate((decal.rot ?? 0) + (decal.spin ?? 0) * (decal.fall ?? 0));
    g.globalAlpha = 1;
    for (const layer of cfg.wreck) {
      const image = this.projectilePictures.image(layer.asset);
      if (!image) continue;
      const width = image.naturalWidth * layer.scale, height = image.naturalHeight * layer.scale;
      g.drawImage(image, layer.x - width / 2, layer.y - height / 2, width, height);
    }
    g.restore(); return true;
  }
  private squadGround(e: Ent): { y: number } | undefined {
    return (contentRuntime(this.game)?.module('usgr-re.squads-v1')?.render?.(e) as { fixedBody?: { y: number } } | undefined)?.fixedBody;
  }
  private drawSourceParticles(g: CanvasRenderingContext2D, under: boolean): void {
    const module = contentRuntime(this.game)?.module(FEEDBACK_ID) as { particleVisuals?(player?: number): SourceParticle[] } | undefined;
    for (const particle of module?.particleVisuals?.(this.humanIdx) ?? []) {
      const picture = this.effectPicture(particle.key);
      if (picture && picture.under === under) this.drawSourceEffect(g, picture, particle.x, particle.y - particle.height, particle.age, particle.rotation);
    }
  }
  private drawSquadGround(g: CanvasRenderingContext2D, ground: readonly Ent[], alpha: number): void {
    for (const e of ground) {
      const fixed = this.squadGround(e);
      const appearance = (contentRuntime(this.game)?.module(FEEDBACK_ID) as { appearance?(e: Ent): AppearanceState | undefined } | undefined)?.appearance?.(e);
      if (!fixed && !appearance?.ground) continue;
      const picture = super.pictureOf(e, getDef(e.defId), alpha), sprite = appearance?.ground ? getSprite(appearance.ground + picture.teamSuffix) : picture.body;
      if (!sprite) continue;
      const scale = picture.displayScale, ss = sprite.ss ?? 1;
      g.drawImage(sprite.cv, 0, 0, sprite.fw * ss, sprite.fh * ss,
        picture.ex - sprite.fw * scale / 2, picture.ey + (fixed?.y ?? 0) - (sprite.ay ?? sprite.fh / 2) * scale,
        sprite.fw * scale, sprite.fh * scale);
    }
  }
  protected override drawGroundShadows(g: CanvasRenderingContext2D, ground: readonly Ent[], alpha: number): void {
    super.drawGroundShadows(g, ground, alpha); this.drawSourceParticles(g, true); this.drawSquadGround(g, ground, alpha);
  }
  protected override drawCoarseShadows(g: CanvasRenderingContext2D, ground: readonly Ent[], alpha: number): void {
    super.drawCoarseShadows(g, ground, alpha); this.drawSourceParticles(g, true); this.drawSquadGround(g, ground, alpha);
  }
  protected override drawEnt(g: CanvasRenderingContext2D, e: Ent, alpha: number, view: ViewState, cam: Camera): void {
    const squad = contentRuntime(this.game)?.module('usgr-re.squads-v1')?.render?.(e) as { squad?: boolean; fixedBody?: { y: number } } | undefined;
    if (squad?.squad || squad?.fixedBody) return;
    if ((contentRuntime(this.game)?.module('sensors-v1')?.render?.(e) as SensorsVisual | undefined)?.hidden) return;
    if (!this.neutral && this.game.st.players[e.owner]?.team === this.game.st.players[this.humanIdx]?.team && view.selection.has(e.id)) {
      const visuals = contentRuntime(this.game)?.module(FEEDBACK_ID)?.render?.(e, true) as FeedbackVisual[] | undefined;
      const x = e.prevX + (e.x - e.prevX) * alpha, y = e.prevY + (e.y - e.prevY) * alpha;
      for (const visual of visuals ?? []) {
        if (!visual.under) continue;
        const image = this.projectilePictures.image(visual.asset);
        if (!image) continue;
        const frames = visual.frames ?? 1, fw = image.naturalWidth / frames;
        const width = fw * (visual.scaleX ?? visual.scale), height = image.naturalHeight * visual.scale;
        g.save(); g.globalAlpha = visual.alpha ?? 1;
        g.drawImage(image, fw * (visual.frame ?? 0), 0, fw, image.naturalHeight,
          x + visual.x - width / 2, y + visual.y - height / 2, width, height); g.restore();
      }
    }
    super.drawEnt(g, e, alpha, view, cam);
  }
  private effectPicture(key: string): EffectPicture | undefined {
    const match = /^ucgr\.effect:([^:]+):([^:]+):([\d.]+)$/.exec(key);
    if (!match) return;
    const cfg = getDef(match[1]).extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
    return feedbackEffectPicture(cfg, match[2], match[3]);
  }
  private drawSourceEffect(g: CanvasRenderingContext2D, picture: EffectPicture, x: number, y: number, age: number, rotation: number): void {
    const image = this.projectilePictures.image(picture.asset);
    if (!image) return;
    const elapsed = Math.max(0, age), progress = Math.min(1, elapsed / picture.life);
    if (elapsed >= picture.duration) return;
    const scale = picture.scaleFrom + (picture.scaleTo - picture.scaleFrom) * progress;
    const count = picture.last - picture.first + 1, step = Math.floor(elapsed * picture.fps);
    const frame = picture.first + (picture.loop ? step % count : Math.min(count - 1, step));
    if (frame >= picture.frames) return;
    const fw = image.naturalWidth / picture.frames, width = fw * scale, height = image.naturalHeight * scale;
    g.save(); g.translate(x, y); g.rotate(rotation);
    // RW switches from its fade-in ramp to a fade-out ramp at fadeIn;
    // multiplying both ramps would incorrectly dim their joining point.
    const fade = picture.fade && elapsed >= picture.fadeIn ? (picture.life - elapsed) / (picture.life - picture.fadeIn)
      : picture.fadeIn > 0 && elapsed < picture.fadeIn ? elapsed / picture.fadeIn : 1;
    g.globalAlpha = Math.max(0, Math.min(1, picture.alpha * fade));
    g.drawImage(image, frame * fw, 0, fw, image.naturalHeight, -width / 2, -height / 2, width, height); g.restore();
  }
  private drawSignalContacts(g: CanvasRenderingContext2D, cam: Camera): void {
    if (this.neutral || this.game.spectate !== 'none') return;
    const module = contentRuntime(this.game)?.module('sensors-v1'); if (!module?.render) return;
    const px = cam.scale / cam.zoom, radius = 6 * px, bounds = cam.bounds(), seen = new Set<string>();
    g.save(); g.lineWidth = 1.5 * px;
    for (const e of this.game.st.ents.values()) {
      if (e.dead || e.inside || e.owner !== this.humanIdx) continue;
      const visual = module.render(e, true) as SensorsVisual | undefined;
      for (const c of visual?.contacts ?? []) {
        if (!c.acquired || c.reveal !== 'contact' || c.x < bounds.x0 - radius || c.x > bounds.x1 + radius || c.y < bounds.y0 - radius || c.y > bounds.y1 + radius) continue;
        const key = `${c.channel}/${c.x}/${c.y}`; if (seen.has(key)) continue; seen.add(key);
        const age = Math.max(0, this.game.st.time - c.seenAt);
        g.globalAlpha = Math.max(.25, .9 - age * .12);
        g.strokeStyle = age < .1 ? FIELD_COLORS.sight : FIELD_COLORS.warning;
        g.setLineDash(age < .1 ? [] : [2 * px, 2 * px]);
        g.beginPath(); g.moveTo(c.x, c.y - radius); g.lineTo(c.x + radius, c.y);
        g.lineTo(c.x, c.y + radius); g.lineTo(c.x - radius, c.y); g.closePath(); g.stroke();
      }
    }
    g.restore();
  }
  private contentPictures = new WeakMap<Ent, number>();
  protected override pictureOf(e: Ent, def: UnitDef, alpha: number): EntityPicture {
    const flight = contentRuntime(this.game)?.module('sensors-v1')?.render?.(e) as SensorsVisual | undefined;
    const height = flight?.flight?.altitude;
    const sourceHeight = def.domain === 'air' && (def.altitude ?? 12) > 0 && height !== undefined && Number.isFinite(height) && height >= 0;
    const picture = super.pictureOf(e, sourceHeight ? { ...def, altitude: height } : def, alpha);
    if (picture.stamp > 0 && this.contentPictures.get(e) === picture.stamp) return picture;
    this.contentPictures.set(e, picture.stamp);
    if (flight?.hidden) {
      picture.body = undefined; picture.bodyArt = ''; picture.kit = undefined;
      picture.gun = undefined; picture.gunArt = undefined; picture.rings.length = 0; picture.barrelShifts = undefined;
      return picture;
    }
    // Native shadow placement multiplies the base def height by this fraction.
    // Keep its landing scale and the source-height sprite pose from above, then
    // carry the same height through that shadow pass without mutating Ent.alt.
    if (sourceHeight) picture.altFrac *= height / (def.altitude ?? 12);
    const feedbackModule = contentRuntime(this.game)?.module(FEEDBACK_ID) as { render?(e: Ent): unknown; appearance?(e: Ent): AppearanceState | undefined } | undefined;
    const appearance = feedbackModule?.appearance?.(e);
    if (appearance) {
      if (appearance.fixedDirection) picture.heading = -Math.PI / 2;
      picture.bodyKey = appearance.body; picture.bodyArt = appearance.body + picture.teamSuffix; picture.body = getSprite(picture.bodyArt);
      picture.kit = undefined; picture.gun = undefined; picture.gunArt = undefined; picture.rings.length = 0; picture.barrelShifts = undefined;
      const radar = appearance.radar, sprite = radar && getSprite(radar.sprite + picture.teamSuffix);
      if (radar && sprite) {
        const a = picture.heading + Math.PI / 2, scale = picture.displayScale;
        const heading = radar.active && flight?.radarHeading !== undefined ? flight.radarHeading : picture.heading;
        const previous = radar.active && flight?.radarPreviousHeading !== undefined ? flight.radarPreviousHeading : picture.heading;
        picture.gun = sprite; picture.gunArt = radar.sprite;
        picture.rings.push({ x: picture.ex + (radar.x * Math.cos(a) - radar.y * Math.sin(a)) * scale, y: picture.spriteY + (radar.x * Math.sin(a) + radar.y * Math.cos(a)) * scale, bearing: previous + normAngle(heading - previous) * alpha, recoil: { art: radar.sprite, sprite, shifts: [] } });
      }
    }
    const feedback = feedbackModule?.render?.(e) as FeedbackVisual[] | undefined;
    if (feedback?.some(v => v.detachTurret)) { picture.gun = undefined; picture.gunArt = undefined; picture.rings.length = 0; picture.barrelShifts = undefined; return picture; }
    const runtime = contentRuntime(this.game);
    const articulated = runtime?.module('articulation-v1')?.render?.(e) as ArticulationVisual | undefined;
    const visual = articulated?.squad || articulated?.mounts.length ? articulated
      : runtime?.module('usgr-re.squads-v1')?.render?.(e) as ArticulationVisual | undefined ?? articulated;
    if (!visual) return picture;
    if (visual.squad) {
      picture.body = undefined;
      picture.bodyArt = '';
      picture.kit = undefined;
      picture.gun = undefined; picture.gunArt = undefined; picture.rings.length = 0;
    }
    if (!visual.mounts.length || appearance?.radar) return picture;
    // pictureOf may already have baked the native turret's recoil. Its dynamic
    // atlas key has no team suffix; resolve each mount from its authored sheet.
    const defaultArt = this.gunKey(e.owner, def);
    picture.rings.length = 0;
    picture.gun = undefined;
    picture.gunArt = undefined;
    picture.barrelShifts = undefined;
    for (let i = 0; i < visual.mounts.length; i++) {
      const mount = visual.mounts[i];
      if (appearance && !appearance.mounts[mount.id]) continue;
      const art = appearance?.mounts[mount.id] ?? mount.sprite ?? defaultArt;
      const sprite = art ? getSprite(art + picture.teamSuffix) : undefined;
      if (!sprite || !art) continue;
      const pose = !this.coarse && sprite.barrels ? this.gunRecoil.pose(e.id, sprite.barrels.length, this.renderTime, i) : 0;
      const stroke = pose ? this.gunRecoil.strokes(e.id, i) ?? mount.recoil : undefined;
      const distance = typeof stroke === 'number' ? stroke : stroke ? Math.max(...stroke) : 0;
      const recoil = stroke && distance * picture.displayScale * this.detail >= .5
        ? recoilSprites.get(sprite, stroke, pose, this.recoilFrame) : undefined;
      const prepared = recoil ?? { art, sprite, shifts: [] };
      picture.gun ??= prepared.sprite;
      picture.gunArt ??= prepared.art;
      if (visual.mounts.length === 1) picture.barrelShifts = recoil?.shifts;
      picture.rings.push({
        x: mount.x + picture.ex - e.x,
        y: mount.y + picture.spriteY - e.y,
        bearing: mount.previousAngle + normAngle(mount.angle - mount.previousAngle) * alpha,
        // The prepared per-ring picture carries its own sheet through every pass.
        recoil: prepared,
      });
    }
    return picture;
  }
}

}
export const ContentRenderer=createContentRenderer();
