import {afterEach,expect,test} from 'bun:test';
import {DEFS,getDef} from '../../../../../../steel-tide/game/core/src/game/defs';
import {newEnt} from '../../../../../../steel-tide/game/core/src/game/state';
import {visionTiles} from '../../../../../../steel-tide/game/core/src/game/vision';
import {arena} from '../../../../../../steel-tide/game/core/server/testkit/game';
import {createRuntimeGame} from '../../../../../../steel-tide/game/core/src/game/extensions/runtime';
import {createTargetingModule} from '../src/targeting';
const id='source-fractional-sight';afterEach(()=>delete DEFS[id]);
test('fractional source sight crosses native integer rays safely and clips original tile-centre footprint',()=>{
 DEFS[id]={...getDef('ltank'),id,vision:3.75,weapons:[],extensions:{'usgr-re.targeting-v1':{tags:['UCGR']}}};
 const base=arena({mode:'campaign',fog:true,dayNight:false,weather:false}),{game,runtime}=createRuntimeGame(base.st.cfg,base.st.map,true,[{id:'usgr-re.targeting-v1',create:createTargetingModule}]);
 const e=newEnt(game.st,id,0,400,400),module=runtime.module('usgr-re.targeting-v1')!,def=module.effectiveDef!(e,getDef(id));expect(def.vision).toBe(4);expect(getDef(id).vision).toBe(3.75);
 const x=Math.floor(e.x/32),y=Math.floor(e.y/32),tiles=module.filterVisionTiles!(e,visionTiles(game.st.map,x,y,def.vision,false),true);
 expect([...tiles].every(i=>(i%game.st.map.w-x)**2+(Math.floor(i/game.st.map.w)-y)**2<=3.75**2+3.75)).toBe(true);expect(tiles.length).toBeLessThan(visionTiles(game.st.map,x,y,4,false).length);
 for(let tick=0;tick<8;tick++)game.step();expect(game.st.time).toBeGreaterThan(.25);
 const changed=module.effectiveDef!(e,{...getDef(id),vision:2.25});expect(changed.vision).toBe(3);expect(module.filterVisionTiles!(e,visionTiles(game.st.map,x,y,3,false),false).length).toBeLessThan(tiles.length);
});
