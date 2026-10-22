import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import { TILE } from './host';
import type { EffectPicture } from './effectPictures';
/** RW 1.15 class_998.b, commit 52758091b7888bbe4797789d59952f34653ac960.
 * Positions use pack world pixels; velocity uses pixels/second. Source ticks are 1/60s.
 * Atmospheric applies height-speed drag and absolute-X wind, not invented planar drag. */
export interface SourceParticle {
  key: string; x: number; y: number; height: number; vx: number; vy: number; vh: number;
  rotation: number; spin: number; age: number;
}
const WORLD = .4, RATE = 60 * WORLD;
const approach = (value: number, amount: number) => value > 0 ? Math.max(0, value - amount) : Math.min(0, value + amount);
export function stepSourceParticle(p: SourceParticle, picture: EffectPicture, seconds: number): boolean {
  const dt = seconds * 60;
  p.age += seconds;
  if (p.age > picture.duration) return false;
  if (picture.atmospheric) { p.vh -= p.vh * .002 * dt; p.vx -= .0015 * dt * RATE; }
  if (picture.physics) {
    if (p.height > 0) p.vh -= .1 * (picture.gravity ?? 1) * dt * RATE;
    else {
      if (p.vh < 0) p.vh = approach(-p.vh * .5, 1.3 * RATE);
      if (p.height < 0) p.height = 0;
      p.vx = approach(p.vx, .15 * dt * RATE); p.vy = approach(p.vy, .15 * dt * RATE);
      p.spin = approach(p.spin, dt * Math.PI / 180 * 60);
    }
  }
  p.x += p.vx * seconds; p.y += p.vy * seconds; p.height += p.vh * seconds; p.rotation += p.spin * seconds;
  return true;
}
export function sourceParticleVisible(game: Game, player: number | undefined, p: SourceParticle, picture: EffectPicture): boolean {
  if (picture.showInFog || player === undefined || game.seesAll || !game.st.cfg.fog) return true;
  const team = game.sightTeam(game.st.players[player]?.team ?? player), map = game.st.map;
  const x = Math.floor(p.x / TILE), y = Math.floor(p.y / TILE);
  return x >= 0 && y >= 0 && x < map.w && y < map.h && (game.st.fog[team]?.[y * map.w + x] === 2 || game.st.airFog?.[team]?.[y * map.w + x] === 2);
}
