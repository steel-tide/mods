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
  return {sdk,base:{Renderer:NativeRenderer,Input:class {}}};
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

test('FG mine selection is filtered without changing ordinary unit selection',()=>{
  const {sdk,base}=fixture(),mine={id:1,defId:'mine'},tank={id:2,defId:'mbt'};
  sdk.DEFS.mine={extensions:{'fg-rusted-league.source-v1':{mine:{}}}};
  base.Input=class {game={st:{ents:new Map([[1,mine],[2,tank]])}};pick(){return this.hit;}setSelection(ids){this.ids=ids;}};
  const Input=leaguePresentation(sdk).presentation(base).Input,input=new Input();
  input.hit=mine;assert.equal(input.pick(),null);input.hit=tank;assert.equal(input.pick(),tank);
  input.setSelection([1,2],false);assert.deepEqual(input.ids,[2]);
});

test('FG seeker art balances canvas state and leaves native projectiles to the renderer',()=>{
  const {sdk,base}=fixture();sdk.DEFS.mine={sprite:'mine',extensions:{'fg-rusted-league.source-v1':{mine:{}}}};
  const Renderer=leaguePresentation(sdk).presentation(base).Renderer,r=new Renderer();
  const p={gun:'mine/seeker',x:200,y:300,px:198,py:300,angle:0};let depth=0,draws=0;
  const g={save(){depth++;},restore(){depth--;},translate(){},rotate(){},drawImage(){draws++;}};
  assert.equal(r.drawContentProjectile(g,p,1,bounds),true);assert.equal(draws,1);assert.equal(depth,0);
  assert.equal(r.drawContentProjectile(g,{...p,gun:'mbt/main'},1,bounds),false);
  g.drawImage=()=>{throw Error('invalid canvas image');};
  assert.throws(()=>r.drawContentProjectile(g,p,1,bounds),/invalid canvas image/);assert.equal(depth,0);
});
