import assert from 'node:assert/strict';
import {test} from 'node:test';
import leaguePresentation from './extensions/source/presentation.mjs';
import adolencePresentation from '../adolence/extensions/source/presentation.mjs';

const bounds={x0:0,y0:0,x1:1000,y1:1000};
const decal=key=>({key,x:200,y:300,t:10,rot:.7});
const sprite={cv:{},fw:24,fh:40};
function fixture() {
  const DEFS={};
  for(const mod of ['fg-rusted-league','adolence'])DEFS[mod+'-test']={id:mod+'-test',kind:'unit',extensions:{[mod+'.source-v1']:{wreck:mod+'-wreck'}}};
  DEFS.mbt={id:'mbt',kind:'unit'};
  const sdk={DEFS,getDef(id){if(!DEFS[id])throw Error('unknown def: '+id);return DEFS[id];},getSprite:()=>sprite,unitDisplayScale:()=>1.5625};
  class NativeRenderer {drawContentDecal(_g,d){this.delegated=d.key;return false;}}
  return {sdk,base:{Renderer:NativeRenderer}};
}
for(const [name,factory]of [['FG',leaguePresentation],['Adolence',adolencePresentation]]) {
  test(name+': prop ruins and unknown decal IDs delegate without resolving a unit',()=>{
    const {sdk,base}=fixture(),Renderer=factory(sdk).presentation(base).Renderer,r=new Renderer();
    for(const key of ['ruin.d.tower','ruin.d.hangar','ruin.d.bunker','ruin.d.tent','ruin.d.derrick','ruin.unknown','hulk.unknown','crash.unknown','hulk.mbt','wreck.sea','scorch']){
      assert.equal(r.drawContentDecal({},decal(key),{},1,bounds),false);assert.equal(r.delegated,key);
    }
  });
  test(name+': authored wreck drawing balances canvas state, including a failed image draw',()=>{
    const {sdk,base}=fixture(),Renderer=factory(sdk).presentation(base).Renderer,r=new Renderer();
    const key=(name==='FG'?'fg-rusted-league':'adolence')+'-test';
    let depth=0,draws=0;
    const g={save(){depth++;},restore(){depth--;},translate(){},rotate(){},drawImage(){draws++;}};
    assert.equal(r.drawContentDecal(g,decal('hulk.'+key),{},1,bounds),true);assert.equal(draws,1);assert.equal(depth,0);
    g.drawImage=()=>{throw Error('invalid canvas image');};
    assert.throws(()=>r.drawContentDecal(g,decal('hulk.'+key),{},1,bounds),/invalid canvas image/);assert.equal(depth,0);
  });
}
test('both presentation packages delegate native prop debris in either load order',()=>{
  for(const factories of [[leaguePresentation,adolencePresentation],[adolencePresentation,leaguePresentation]]){
    const {sdk,base}=fixture();let composed=base;
    for(const f of factories)composed=f(sdk).presentation(composed);
    const r=new composed.Renderer();assert.equal(r.drawContentDecal({},decal('ruin.d.bunker'),{},1,bounds),false);assert.equal(r.delegated,'ruin.d.bunker');
  }
});
