// Requires a running dev server from the sibling game checkout; never edits game files.
// node mods/fg-rusted-league/verify-combat.mjs http://127.0.0.1:5173 [--both]
import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packMod} from '../../tools/pack.mjs';
import {Page,launchChrome} from '../../../steel-tide-game/game/core/scripts/lib/chrome.mjs';
const origin=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5173';
const both=process.argv.includes('--both');
const output=join(tmpdir(),both?'fg-combat-both':'fg-combat');
const profile=mkdtempSync(join(tmpdir(),'fg-combat-chrome-'));let chrome,page;
try{
 chrome=await launchChrome(9347,profile);page=await Page.open(9347);await page.metrics(1440,1000,1);
 await page.onNewDocument(`window.parityErrors=[];addEventListener('error',e=>parityErrors.push(e.error?.stack??e.message));addEventListener('unhandledrejection',e=>parityErrors.push(String(e.reason)));`);
 await page.goto(origin);await page.waitFor('document.querySelector("#boot-start")',45000);
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await page.waitFor('!document.getElementById("boot")',45000);
 for(const name of (both?['adolence','fg-rusted-league']:['fg-rusted-league'])){
 const packed=await packMod(fileURLToPath(new URL('../'+name+'/',import.meta.url)));assert.equal(packed.ok,true,JSON.stringify(packed.errors));
 const result=await page.eval(`(async()=>{window.manager=await import('/src/content/manager.ts');const r=await manager.installFromFiles([{path:'${name}.steel-tide-mod',blob:new Blob([${JSON.stringify(packed.text)}])}],'${name}');return {ok:r.ok,errors:r.errors};})()`);assert.equal(result.ok,true,JSON.stringify(result.errors));
 }
 console.log('scene',await page.eval(`(async()=>{
 const {createContentGame}=await import('/src/game/contentGame.ts'),{buildGameMap}=await import('/src/game/mapdefs.ts'),{getDef}=await import('/src/game/defs.ts');
 const {GameScreen}=await import('/src/ui/gamescreen.ts'),{showScreen}=await import('/src/ui/screens.ts');
 const cfg={mode:'campaign',customMap:manager.enabledModMaps().find(m=>m.mod.id==='fg-rusted-league').data,mapKey:'custom',seed:14,fog:false,dayNight:false,hour:12,popCap:500,startMetal:100000,players:[{isHuman:true,team:0,faction:manager.installedMods().find(m=>m.mod.id==='fg-rusted-league').mod.factions[0].id},{isHuman:true,team:1}]};
 const game=createContentGame(cfg,buildGameMap(cfg));window.qa={game,getDef,errors:[],renders:0};qa.screen=new GameScreen({kind:'custom',make:()=>game});showScreen(qa.screen);return {units:game.st.ents.size,props:game.st.map.decor.length};
 })()`));
 await page.waitFor('qa.screen.renderer',45000);
 const battle=await page.eval(`(async()=>{
 qa.screen.togglePause();qa.screen.cam.x=1550;qa.screen.cam.y=950;
 const r=qa.screen.renderer,original=r.drawContentDecal; r.drawContentDecal=function(...args){try{return original.apply(this,args);}catch(e){if(qa.errors.length<10)qa.errors.push({key:args[1].key,error:e.stack});throw e;}};
 const render=r.render;r.render=function(...args){qa.renders++;try{return render.apply(this,args);}catch(e){if(qa.errors.length<10)qa.errors.push({render:true,error:e.stack});throw e;}};
 const {cmdMove}=await import('/src/game/orders.ts');
 for(const owner of [0,1]){const ids=[...qa.game.st.ents.values()].filter(e=>e.owner===owner&&qa.getDef(e.defId).kind==='unit').map(e=>e.id);cmdMove(qa.game,ids,48*32,30*32,false,true);}
 for(let batch=0;batch<60&&!qa.errors.length;batch++){for(let t=0;t<90;t++)qa.game.step();await new Promise(requestAnimationFrame);}
 return {time:qa.game.st.time,decals:qa.game.st.decals.length,errors:qa.errors,renders:qa.renders,global:parityErrors.slice(0,5)};
 })()`);
 console.log('battle',battle);assert.deepEqual(battle.errors,[]);assert.deepEqual(battle.global,[]);assert(battle.time>=180);assert(battle.renders>=60);
 writeFileSync(output+'.png',await page.png());
 if(!(await page.eval('qa.errors.length'))){console.log('destroy-props',await page.eval(`(async()=>{const {razeDecor}=await import('/src/game/combat.ts');while(qa.game.st.map.decor.length)razeDecor(qa.game.st,0);await new Promise(requestAnimationFrame);return {errors:qa.errors,decals:qa.game.st.decals.map(d=>d.key)};})()`));}
 const final=await page.eval('({errors:qa.errors,global:parityErrors.slice(0,5)})');assert.deepEqual(final,{errors:[],global:[]});
 writeFileSync(output+'.json',JSON.stringify({battle,final},null,2));console.log('Verified 180 simulated seconds of showcase combat and prop destruction; screenshot: '+output+'.png');
}finally{await page?.close();if(chrome){chrome.kill();await new Promise(r=>chrome.once('exit',r));}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
