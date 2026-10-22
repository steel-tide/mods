import extensionPackage from '../extension.json';
import { afterAll, afterEach, expect, test } from 'bun:test';
import { applyContent } from '../../../../../../steel-tide/game/core/src/game/content';
import { parseDefinitionPack } from '../../../../../../steel-tide/game/core/src/game/contentDefs';
import { prepareContentSchema } from '../../../../../../steel-tide/game/core/src/game/contentSchema';
import { prepareContentCapabilities } from '../../../../../../steel-tide/game/core/src/game/contentCapabilities';
import { contentRuntime, createContentGame } from '../../../../../../steel-tide/game/core/src/game/contentGame';
import { getDef } from '../../../../../../steel-tide/game/core/src/game/defs';
import { canSee } from '../../../../../../steel-tide/game/core/src/game/combat';
import { applyGameCommand } from '../../../../../../steel-tide/game/core/src/game/commands';
import { newEnt, type Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import { putSprite, getSprite } from '../../../../../../steel-tide/game/core/src/gfx/atlas';

import { GunRecoil, recoilSprites, RECOIL_KICK, RECOIL_LIFE } from '../../../../../../steel-tide/game/core/src/render/recoil';
import type { EntityPicture } from '../../../../../../steel-tide/game/core/src/render/renderer';
import type { Camera } from '../../../../../../steel-tide/game/core/src/render/camera';
import type { UnitDef } from '../../../../../../steel-tide/game/core/src/core/types';
import { FakeCanvas, installFakeCanvas } from '../../../../../../steel-tide/game/core/server/testkit/canvas';
import { arena } from '../../../../../../steel-tide/game/core/server/testkit/game';

const restoreCanvas = installFakeCanvas();
const originalListener = document.addEventListener;
Object.assign(document, { addEventListener() {} });
const { ContentRenderer } = await import('../src/contentRenderer');
const { ContentInput } = await import('../src/contentInput');
afterAll(() => { document.addEventListener = originalListener; restoreCanvas(); });
afterEach(() => applyContent([]));
interface Prepared { frameNo:number; renderTime:number; gunRecoil:GunRecoil; recoilFrame:number; pictureOf(e:Ent,def:UnitDef,alpha:number):EntityPicture }
const labels=['Fixture','测试','시험'];
async function setup() {
  const gun={id:'front',cls:'cannon',projectile:'shell',dmg:1,reload:100,range:10,speed:50,targets:['ground'],turret:true,recoil:2};
  const pack={format:'steel-tide-mod',v:4,capacity:'large',extensionPackages:[extensionPackage],id:'cap-render',name:labels,version:'1',requiredCapabilities:['articulation-v1','sensors-v1'],defs:[
    {id:'cap-render-hull',extends:'ltank',name:labels,weapons:[gun,{...gun,id:'rear',recoil:4}],extensions:{'articulation-v1':{mounts:[{id:'front',weapons:['front'],x:0,y:-9,arc:.5,turnRate:100},{id:'rear',sprite:'tur.mbt',weapons:['rear'],x:0,y:9,rest:Math.PI,arc:.5,turnRate:100}]}}},
    {id:'cap-render-member',extends:'engineer',name:labels,weapons:[],builds:[]},
    {id:'cap-render-squad',extends:'ltank',name:labels,weapons:[],extensions:{'articulation-v1':{squad:true,attachments:[{id:'member',unit:'cap-render-member',x:0,y:0,select:'parent'}]}}},
    {id:'cap-render-contact',extends:'ltank',name:labels,weapons:[],vision:1,extensions:{'sensors-v1':{sensors:[{id:'optic',channel:'field',range:20,reveal:'contact'}]}}},
    {id:'cap-render-reveal',extends:'ltank',name:labels,weapons:[],vision:1,extensions:{'sensors-v1':{sensors:[{id:'optic',channel:'field',range:20,reveal:'entity'}]}}},
  ]};
  await prepareContentSchema(pack,true); const parsed=parseDefinitionPack(pack); if(!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  await prepareContentCapabilities([parsed.pack]); applyContent([parsed.pack]);
  const base=arena({mode:'campaign',fog:true,dayNight:false}), game=createContentGame(base.st.cfg,base.st.map,true);
  for(const key of ['u.ltank.0','tur.ltank.0','tur.mbt.0','u.engineer.0']) {const cv=new FakeCanvas();cv.width=key==='tur.mbt.0'?40:32;cv.height=32;putSprite(key,{cv:cv as unknown as HTMLCanvasElement,fw:cv.width,fh:32,frames:1,barrels:key.startsWith('tur.')?[[.4,0,.6,.5]]:undefined});}
  const renderer=new ContentRenderer(document.createElement('canvas'),game,0), prepared=renderer as unknown as Prepared; prepared.frameNo=1;prepared.renderTime=0;
  return {game,renderer,prepared};
}

test('independent mount sheets and default art survive every repeated picture pass', async()=>{
  const {game,prepared}=await setup(), e=newEnt(game.st,'cap-render-hull',0,400,400), def=getDef(e.defId); game.step();
  const first=prepared.pictureOf(e,def,1), rings=first.rings;
  expect(rings).toHaveLength(2); expect(rings[0].recoil?.sprite).toBe(getSprite('tur.ltank.0'));expect(rings[1].recoil?.sprite).toBe(getSprite('tur.mbt.0'));
  const x=rings.map(r=>r.x), bearings=rings.map(r=>r.bearing);
  for(let i=0;i<5;i++){expect(prepared.pictureOf(e,def,1)).toBe(first);expect(first.rings).toHaveLength(2);expect(first.rings.map(r=>r.x)).toEqual(x);expect(first.rings.map(r=>r.bearing)).toEqual(bearings);}
  prepared.frameNo++;expect(prepared.pictureOf(e,def,1).rings[0].recoil?.sprite).toBe(getSprite('tur.ltank.0'));
});
test('firing preserves inherited and explicit mount sheets with independent recoil through every picture pass',async()=>{
  for(const frontFires of [true,false]) {
    const {game,prepared}=await setup(), e=newEnt(game.st,'cap-render-hull',0,400,400), def=getDef(e.defId);e.angle=0;e.prevAngle=0;
    if(!frontFires)e.wcd[0]=100;
    for(const x of [300,500]){const target=newEnt(game.st,'cap-render-contact',1,x,400);target.holdFire=true;}
    game.hash.rebuild(game.st);game.updateFog();game.step();
    const shots=game.st.effects.filter(f=>f.recoil?.src===e.id);
    expect(shots.map(f=>[f.recoil!.mount,f.recoil!.stroke])).toEqual(frontFires?[[0,2],[1,4]]:[[1,4]]);
    const born=game.st.time-shots[0].t;prepared.renderTime=born+RECOIL_KICK;
    prepared.gunRecoil.hear(game.st.effects,game.st.time,prepared.renderTime);prepared.recoilFrame=recoilSprites.beginFrame();prepared.frameNo++;
    const picture=prepared.pictureOf(e,def,1), rings=picture.rings;
    expect(rings).toHaveLength(2);expect(picture.gun).toBeDefined();
    expect(rings[0].recoil!.shifts.map(s=>s.offset)).toEqual(frontFires?[2]:[]);
    expect(rings[1].recoil!.shifts.map(s=>s.offset)).toEqual([4]);
    expect(rings.map(r=>r.recoil!.sprite.fw)).toEqual([32,40]);
    expect(rings[1].recoil!.sprite).not.toBe(getSprite('tur.mbt.0'));
    if(frontFires)expect(rings[0].recoil!.sprite).not.toBe(getSprite('tur.ltank.0'));
    else expect(rings[0].recoil!.sprite).toBe(getSprite('tur.ltank.0')!);
    for(const ring of rings)expect(getSprite(ring.recoil!.art.startsWith('recoil/')?ring.recoil!.art:ring.recoil!.art+picture.teamSuffix)).toBe(ring.recoil!.sprite);
    for(let pass=0;pass<3;pass++){expect(prepared.pictureOf(e,def,1)).toBe(picture);expect(picture.rings).toHaveLength(2);expect(picture.rings[1].recoil!.shifts[0].offset).toBe(4);}
    prepared.renderTime=born+RECOIL_LIFE+.01;prepared.gunRecoil.hear(game.st.effects,game.st.time,prepared.renderTime);prepared.recoilFrame=recoilSprites.beginFrame();prepared.frameNo++;
    const settled=prepared.pictureOf(e,def,1);expect(settled.rings.map(r=>r.recoil!.shifts)).toEqual([[],[]]);
    expect(settled.rings[0].recoil!.sprite).toBe(getSprite('tur.ltank.0')!);expect(settled.rings[1].recoil!.sprite).toBe(getSprite('tur.mbt.0')!);
  }
});
test('squad controller contributes no hull or turret while its real member keeps a picture',async()=>{
  const {game,prepared}=await setup(), e=newEnt(game.st,'cap-render-squad',0,400,400);game.step();
  const controller=prepared.pictureOf(e,getDef(e.defId),1);expect(controller.body).toBeUndefined();expect(controller.bodyArt).toBe('');expect(controller.gun).toBeUndefined();expect(controller.rings).toHaveLength(0);
  const child=[...game.st.ents.values()].find(e=>e.defId==='cap-render-member')!;expect(prepared.pictureOf(child,getDef(child.defId),1).body).toBeDefined();
});
test('contact overlay uses measured positions and CSS scale, never labels IDs or displays other owners or spectators',async()=>{
  const {game,renderer}=await setup(), observer=newEnt(game.st,'cap-render-contact',0,400,400), target=newEnt(game.st,'cap-render-contact',1,700,400);game.hash.rebuild(game.st);game.updateFog();game.step();
  expect(canSee(game.st,game.hash,0,target)).toBe(false);
  const points:number[][]=[], canvas={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(x:number,y:number){points.push([x,y]);},lineTo(){},closePath(){},stroke(){},fillText(){throw new Error('Contact IDs must not be drawn');}} as unknown as CanvasRenderingContext2D;
  const camera={scale:1,zoom:2,bounds:()=>({x0:0,y0:0,x1:1000,y1:1000})} as Camera;
  for(const o of renderer.overlays)o.world(canvas,camera,1);expect(points).toEqual([[target.x,target.y-3]]);
  const visual=contentRuntime(game)!.module('sensors-v1')!.render!(observer,true);expect(JSON.stringify(visual)).not.toContain('target');
  points.length=0;renderer.neutral=true;for(const o of renderer.overlays)o.world(canvas,camera,1);expect(points).toHaveLength(0);
  renderer.neutral=false;game.spectate='all';for(const o of renderer.overlays)o.world(canvas,camera,1);expect(points).toHaveLength(0);
});
test('entity reveal uses the same visibility for graphical selection as the runtime',async()=>{
  const {game}=await setup();const observer=newEnt(game.st,'cap-render-reveal',0,400,400);const target=newEnt(game.st,'ltank',1,700,400);target.holdFire=true;game.hash.rebuild(game.st);game.updateFog();game.step();
  expect(canSee(game.st,game.hash,0,target)).toBe(false);expect(contentRuntime(game)!.visible(target,0)).toBe(true);
  const input=Object.create(ContentInput.prototype) as {game:typeof game;humanIdx:number;visibleToHuman(e:Ent):boolean};input.game=game;input.humanIdx=0;expect(input.visibleToHuman(target)).toBe(true);
  expect(applyGameCommand(game,0,{kind:'attack',ids:[observer.id],targetId:target.id,queue:false})).toBe(true);
});
