import type { UnitDef } from '../../../../steel-tide/game/core/src/core/types';
import { normAngle } from './presentationHost';
import { contentRuntime, contentStateRuntime } from './presentationHost';
import { canSee } from './presentationHost';
import { FIELD_COLORS } from './presentationHost';
import type { SensorsVisual } from './sensors';
import type { Camera } from '../../../../steel-tide/game/core/src/render/camera';
import { createExtendedRenderer } from './presentationHost';
import type { ArticulationVisual } from './articulation';
import type { Ent } from '../../../../steel-tide/game/core/src/game/state';
import { getSprite } from './presentationHost';
import { Renderer, type EntityPicture } from './presentationHost';
import { recoilSprites } from './presentationHost';

/** Module presentation reuses the ordinary shadow, lighting and thermal passes. */
const ExtendedRenderer = createExtendedRenderer((state, hash, team, entity, throughFog) =>
  contentStateRuntime(state)?.visible(entity, team, throughFog) ?? canSee(state, hash, team, entity, throughFog));
export function createContentRenderer(Base:typeof Renderer=ExtendedRenderer) {
 return class ContentRenderer extends Base {
  constructor(...args: ConstructorParameters<typeof Renderer>) {
    super(...args);
    this.overlays.add({ world: (g, cam) => this.drawSignalContacts(g, cam), screen() {} });
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
    const picture = super.pictureOf(e, def, alpha);
    if (picture.stamp > 0 && this.contentPictures.get(e) === picture.stamp) return picture;
    this.contentPictures.set(e, picture.stamp);
    const visual = contentRuntime(this.game)?.module('articulation-v1')?.render?.(e) as ArticulationVisual | undefined;
    if (!visual) return picture;
    if (visual.squad) {
      picture.body = undefined;
      picture.bodyArt = '';
      picture.kit = undefined;
      picture.gun = undefined; picture.gunArt = undefined; picture.rings.length = 0;
    }
    if (!visual.mounts.length) return picture;
    // pictureOf may already have baked the native turret's recoil. Its dynamic
    // atlas key has no team suffix; resolve each mount from its authored sheet.
    const defaultArt = this.gunKey(e.owner, def);
    picture.rings.length = 0;
    picture.gun = undefined;
    picture.gunArt = undefined;
    picture.barrelShifts = undefined;
    for (let i = 0; i < visual.mounts.length; i++) {
      const mount = visual.mounts[i];
      const art = mount.sprite ?? defaultArt;
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
