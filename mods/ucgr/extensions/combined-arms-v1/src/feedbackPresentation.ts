import type { PresentationFeedback, PresentationFeedbackContext } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import type { UnitVoiceAction } from '../../../../../../steel-tide/game/core/src/core/unitVoice';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { Camera } from '../../../../../../steel-tide/game/core/src/render/camera';
import { asset, getDef, contentRuntime, playRecordedUnitVoice, releaseRecordedVoiceResources, createRecordedAudioScope, TILE } from './presentationHost';
import { FEEDBACK_ID, type FeedbackDef } from './feedbackSpec';
import type { RecordedAudioScope } from '../../../../../../steel-tide/game/core/src/core/recordedAudio';
import type { FeedbackVisual } from './feedback';

export function createFeedback(context: PresentationFeedbackContext, base: PresentationFeedback,
  resolve = asset, play = playRecordedUnitVoice, release = releaseRecordedVoiceResources, makeAudio: () => RecordedAudioScope = createRecordedAudioScope): PresentationFeedback {
  let disposed = false;
  const recordings = new Set<string>(), heard = new Set<string>(), choices = new Map<string, number>();
  let audio: RecordedAudioScope | undefined, time: number | undefined;
  return {
    unitVoice(defId: string, action: UnitVoiceAction, entityId: number) {
      if (disposed || context.spectator) return;
      const entity = context.game.st.ents.get(entityId);
      if (!entity || entity.dead || entity.inside || entity.owner !== context.player || entity.defId !== defId) return;
      const cfg = getDef(defId).extensions?.[FEEDBACK_ID] as FeedbackDef | undefined;
      if (!cfg) { base.unitVoice(defId, action, entityId); return; }
      const cue = action === 'select' || action === 'move' || action === 'attack' ? cfg.voices[action] : undefined;
      // The source leaves most selection slots silent. Do not invent a native crew reply.
      if (!cue) return;
      const takes = cue.assets.map(resolve).filter((url): url is string => !!url);
      if (!takes.length) return;
      for (const url of takes) recordings.add(url);
      const key = `${defId}/${action}`, index = choices.get(key) ?? 0;
      choices.set(key, (index + 1) % takes.length);
      play(defId, action, entityId, [takes[index]], { gain: cue.gain, repeatMs: action === 'select' ? 0 : 5000 });
    },
    update(frame) {
      if (disposed) return;
      base.update?.(frame);
      const seek = time !== undefined && frame.time < time;
      if (seek) { audio?.reset(); heard.clear(); }
      time = frame.time;
      audio?.setPaused(frame.paused);
      const current = new Set<string>();
      for (const effect of context.game.st.effects) {
        const match = /^ucgr\.audio:([a-z0-9_-]+):(\d+):(\d+)$/.exec(effect.key);
        if (!match) continue;
        current.add(effect.key);
        if (heard.has(effect.key)) continue;
        if (frame.paused) continue;
        heard.add(effect.key);
        if (seek) continue;
        const team = context.game.sightTeam(context.game.st.players[frame.player]?.team ?? frame.player);
        const st = context.game.st, tx = Math.floor(effect.x / TILE), ty = Math.floor(effect.y / TILE);
        // The core FogState.Visible wire value is 2. Dead emitters may already
        // have left ents; they still need the same positional fog filter.
        if (!context.game.seesAll && st.cfg.fog && (tx < 0 || ty < 0 || tx >= st.map.w || ty >= st.map.h || (st.fog[team]?.[ty * st.map.w + tx] !== 2 && st.airFog?.[team]?.[ty * st.map.w + tx] !== 2))) continue;
        const source = context.game.st.ents.get(Number(match[2]));
        if (source && !context.game.seesAll && !contentRuntime(context.game)?.visible(source, team)) continue;
        const url = resolve(match[1]);
        if (!url) continue;
        audio ??= makeAudio();
        audio.setPaused(frame.paused);
        audio.play(url, { position: { x: effect.x, y: effect.y }, gain: effect.scale ?? 1 });
      }
      for (const key of heard) if (!current.has(key)) heard.delete(key);
      audio?.update();
    },
    dispose() { if (disposed) return; disposed = true; release([...recordings]); recordings.clear(); choices.clear(); audio?.dispose(); heard.clear(); base.dispose?.(); },
  };
}

/** Match-owned cache; missing optional art is silence/absence, never a replacement indicator. */
export class FeedbackPictures {
  private images = new Map<string, HTMLImageElement | null>();
  constructor(private resolve: (id: string) => string | undefined = asset) {}
  image(id: string): HTMLImageElement | undefined {
    if (!this.images.has(id)) {
      const url = this.resolve(id);
      if (!url || typeof Image === 'undefined') this.images.set(id, null);
      else {
        const image = new Image(); image.src = url;
        this.images.set(id, image);
      }
    }
    const image = this.images.get(id);
    return image?.complete && image.naturalWidth > 0 ? image : undefined;
  }
  draw(game: Game, viewer: number, _neutral: boolean, g: CanvasRenderingContext2D, cam: Camera, alpha = 1): void {
    const runtime = contentRuntime(game), module = runtime?.module(FEEDBACK_ID);
    if (!module?.render) return;
    const bounds = cam.bounds(), team = game.sightTeam(game.st.players[viewer]?.team ?? viewer);
    for (const entity of game.st.ents.values()) {
      if (entity.dead || entity.inside || entity.site || entity.x < bounds.x0 - 128 || entity.x > bounds.x1 + 128 || entity.y < bounds.y0 - 128 || entity.y > bounds.y1 + 128) continue;
      if (!game.seesAll && !runtime!.visible(entity, team)) continue;
      const visuals = module.render(entity) as FeedbackVisual[];
      for (const visual of visuals) {
        const image = this.image(visual.asset);
        if (!image) continue;
        const width = image.naturalWidth * visual.scale, height = image.naturalHeight * visual.scale;
        const x = entity.prevX + (entity.x - entity.prevX) * alpha;
        const y = entity.prevY + (entity.y - entity.prevY) * alpha;
        g.drawImage(image, x + visual.x - width / 2, y + visual.y - height / 2, width, height);
      }
    }
  }
}
