import { contentRuntime } from './presentationHost';
import type { ArticulationVisual } from './articulation';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import { InputController } from './presentationHost';

/** Authored selection proxies apply only to the owner's real attached members. */
export function createContentInput(Base:typeof InputController=InputController) {
 return class ContentInput extends Base {
  protected override visibleToHuman(e: Ent): boolean {
    if (this.game.seesAll) return true;
    const team = this.game.sightTeam(this.humanTeam);
    if (this.game.st.players[e.owner]?.team === team) return true;
    return contentRuntime(this.game)?.visible(e, team) ?? super.visibleToHuman(e);
  }
  protected override setSelection(ids: number[], add: boolean): void {
    const module = contentRuntime(this.game)?.module('articulation-v1');
    const mapped = ids.map(id => {
      const entity = this.game.st.ents.get(id);
      if (!entity || entity.owner !== this.humanIdx) return id;
      const ordinary = module?.render?.(entity) as ArticulationVisual | undefined;
      const view = ordinary?.selectParent ? ordinary : contentRuntime(this.game)?.module('usgr-re.squads-v1')?.render?.(entity) as ArticulationVisual | undefined;
      const parent = view?.selectParent && view.parentId ? this.game.st.ents.get(view.parentId) : undefined;
      return parent && !parent.dead && parent.owner === this.humanIdx ? parent.id : id;
    });
    super.setSelection([...new Set(mapped)], add);
  }
}

}
export const ContentInput=createContentInput();
