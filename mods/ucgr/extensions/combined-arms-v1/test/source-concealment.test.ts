import {afterEach,expect,test} from 'bun:test';
import {DEFS,getDef} from '../../../../../../steel-tide/game/core/src/game/defs';
import {newEnt} from '../../../../../../steel-tide/game/core/src/game/state';
import {arena} from '../../../../../../steel-tide/game/core/server/testkit/game';
import {createRuntimeGame} from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import {createTargetingModule} from '../src/targeting';
import {createSquadsModule,squadEntrenched} from '../src/squads';
import {TARGETING_ID} from '../src/targetingSpec';
import {SQUADS_ID} from '../src/squadsSpec';
const ids=['cover-soldier','cover-detector','cover-mobile','cover-trench'];afterEach(()=>ids.forEach(id=>delete DEFS[id]));
const ranges=(values:number[])=>['装甲','soldiers','UAV','HELI'].map((tag,i)=>({tag,range:values[i]}));
function fixture(energy=false){
 const concealment={enter:ranges([160,160,80,120]),leave:ranges([140,140,70,100]),trench:{enter:ranges([120,120,60,60]),leave:ranges([120,120,60,60])},interval:8/60,cooldown:1,...(energy?{energy:{max:550,regen:60,costs:[{id:'gun',amount:550}]}}:{})};
 DEFS[ids[0]]={...getDef('buggy'),id:ids[0],weapons:[{...getDef('buggy').weapons[0],id:'gun'}],extensions:{[TARGETING_ID]:{tags:['soldiers'],concealment},...(!energy?{[SQUADS_ID]:{member:{controller:ids[2],special:false}}}:{})}};
 DEFS[ids[1]]={...getDef('ltank'),id:ids[1],weapons:[{...getDef('ltank').weapons[0],extensions:{[TARGETING_ID]:{withTags:[],withoutTags:['隐蔽'],selfWithTags:[]}}}],extensions:{[TARGETING_ID]:{tags:['装甲']}}};
 for(const [i,entrenched] of [[2,false],[3,true]] as const)DEFS[ids[i]]={...getDef('ltank'),id:ids[i],weapons:[],extensions:{[SQUADS_ID]:{controller:{capacity:3,positions:[{x:0,y:0},{x:0,y:0},{x:0,y:0}],mobile:ids[2],trench:ids[3],entrenched,digTime:0,exitTime:0,groundOffset:0}}}};
 const base=arena({mode:'campaign',fog:false,dayNight:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:SQUADS_ID,create:createSquadsModule},{id:TARGETING_ID,create:createTargetingModule}]);
 const soldier=newEnt(game.st,ids[0],0,400,400),enemy=newEnt(game.st,ids[1],1,530,400),module=runtime.module(TARGETING_ID)!,squads=runtime.module(SQUADS_ID)!;
 const tick=(dt=.2)=>{game.st.time+=dt;squads.beforeStep!(dt);module.beforeStep!(dt);};
 const targetable=()=>module.canFire!(enemy,getDef(enemy.defId),getDef(enemy.defId).weapons[0],soldier,soldier);
 return{game,module,squads,soldier,enemy,tick,targetable};
}
test('trench uses source smaller detection radii without running ordinary MAS table concurrently',()=>{
 const {game,module,squads,soldier,tick,targetable}=fixture();tick();expect(targetable()).toBe(true);
 const parent=[...game.st.ents.values()].find(e=>e.defId===ids[2])!;expect(squads.order!({owner:0,ids:[parent.id],action:'trench'})).toBe(true);tick();expect(squadEntrenched(game,soldier)).toBe(true);expect(targetable()).toBe(false);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));module.restore(saved);expect(targetable()).toBe(false);
});
test('MAS3 firing consumes literal energy, reveals on source scan, and restores full-energy concealment after refill',()=>{
 const {game,module,soldier,enemy,tick,targetable}=fixture(true);enemy.x=900;tick();expect(targetable()).toBe(false);
 const weapon=getDef(soldier.defId).weapons[0];module.onShot!(soldier,getDef(soldier.defId),weapon,{targetId:enemy.id} as any);tick();expect(targetable()).toBe(true);expect(module.canFire!(soldier,getDef(soldier.defId),weapon,enemy,enemy)).toBe(false);
 const saved=JSON.parse(JSON.stringify(module.snapshot()));module.restore(saved);tick(9);expect(targetable()).toBe(false);expect(module.canFire!(soldier,getDef(soldier.defId),weapon,enemy,enemy)).toBe(true);
 const bad=JSON.parse(JSON.stringify(module.snapshot()));bad[soldier.id].energy=551;expect(()=>module.restore(bad)).toThrow();expect(game.st.time).toBeGreaterThan(9);
});
