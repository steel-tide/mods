import { getDef, targetCat } from './host';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { ModuleHost } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';

/** RW Projectile.a(float,Unit,float): full blast radius controls falloff even
 * while the independently expanding frontier is still smaller. Radius is
 * measured from the center unless areaRadiusFromEdge was explicitly authored. */
export function sourceAreaFalloff(distance:number,fullRadius:number,edgeRadius=0):number{
 const d=Math.max(0,distance-edgeRadius);
 return d>fullRadius||fullRadius<=0?0:Math.min(1,1.1-d/fullRadius);
}
export function sourceAreaVictims(host:ModuleHost,area:{x:number;y:number;radius:number;fullRadius:number;owner:number;hits?:number[];fromEdge?:boolean;air?:boolean;friendly?:boolean}):{entity:Ent;multiplier:number}[]{
 const st=host.game.st,out:{entity:Ent;multiplier:number}[]=[];
 for(const e of st.ents.values()){
  if(e.dead||e.inside||!area.friendly&&st.players[e.owner]?.team===st.players[area.owner]?.team||!area.air&&targetCat(st,e)==='air'||area.hits?.includes(e.id))continue;
  const distance=Math.hypot(e.x-area.x,e.y-area.y),edge=area.fromEdge?getDef(e.defId).radius:0;
  if(Math.max(0,distance-edge)>area.radius)continue;
  const multiplier=sourceAreaFalloff(distance,area.fullRadius,edge);if(!multiplier)continue;
  area.hits?.push(e.id);out.push({entity:e,multiplier});
 }
 return out;
}
