// Requires the sibling game's dev server; installs both mods without editing game files.
// node mods/fg-rusted-league/verify-mines.mjs http://127.0.0.1:5173
import assert from 'node:assert/strict';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {packMod} from '../../tools/pack.mjs';
import {Page,launchChrome} from '../../../steel-tide-game/game/core/scripts/lib/chrome.mjs';
const origin=process.argv[2]??'http://127.0.0.1:5173',output=join(tmpdir(),'fg-mines');
const profile=mkdtempSync(join(tmpdir(),'fg-mines-chrome-'));let chrome,page;
try{
 chrome=await launchChrome(9348,profile);page=await Page.open(9348);await page.metrics(1440,1000,1);
 await page.onNewDocument(`window.mineErrors=[];addEventListener('error',e=>mineErrors.push(e.error?.stack??e.message));addEventListener('unhandledrejection',e=>mineErrors.push(String(e.reason)));`);
 await page.goto(origin);await page.waitFor('document.querySelector("#boot-start")',45000);
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await page.waitFor('!document.getElementById("boot")',45000);
 for(const name of ['adolence','fg-rusted-league']){
  const packed=await packMod(fileURLToPath(new URL('../'+name+'/',import.meta.url)));assert.equal(packed.ok,true,JSON.stringify(packed.errors));
  const result=await page.eval(`(async()=>{window.manager=await import('/src/content/manager.ts');const r=await manager.installFromFiles([{path:'${name}.steel-tide-mod',blob:new Blob([${JSON.stringify(packed.text)}])}],'${name}');return {ok:r.ok,errors:r.errors};})()`);
  assert.equal(result.ok,true,JSON.stringify(result.errors));
 }
 await page.eval(`(async()=>{
  const {createContentGame}=await import('/src/game/contentGame.ts'),{buildGameMap}=await import('/src/game/mapdefs.ts'),{newEnt}=await import('/src/game/state.ts');
  const {GameScreen}=await import('/src/ui/gamescreen.ts'),{showScreen}=await import('/src/ui/screens.ts');
  const cfg={mode:'campaign',customMap:manager.enabledModMaps().find(m=>m.mod.id==='fg-rusted-league').data,mapKey:'custom',seed:14,fog:false,dayNight:false,hour:12,popCap:500,startMetal:10000,players:[{isHuman:true,team:0},{isHuman:true,team:1}]};
  const game=createContentGame(cfg,buildGameMap(cfg),true),layer=newEnt(game.st,'fg-rusted-league-minelayer',0,900,1000);
  layer.holdFire=true;layer.holdPos=true;
  window.qa={game,layer,newEnt};qa.screen=new GameScreen({kind:'custom',make:()=>game});showScreen(qa.screen);
 })()`);
 await page.waitFor('qa.screen.input&&qa.screen.renderer',45000);
 await page.eval(`qa.screen.cam.x=900;qa.screen.cam.y=1000;qa.screen.cam.zoom=2.5;qa.screen.input.setSelection([qa.layer.id],false);`);
 await page.waitFor(`[...document.querySelectorAll('button')].some(b=>/Widow Mine|部署寡妇雷/.test(b.getAttribute('aria-label')))`,10000);
 const placement=await page.eval(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Widow Mine|部署寡妇雷/.test(b.getAttribute('aria-label')));const label=b.getAttribute('aria-label'),st=qa.game.st,effects=st.effects.length,decals=st.decals.length,events=st.events.length;b.click();return {label,effects:st.effects.length-effects,decals:st.decals.length-decals,sounds:st.events.slice(events).filter(e=>e.type==='sound').map(e=>e.sound)};})()`);
 console.log('placement',placement);assert.equal(placement.effects,0);assert.equal(placement.decals,0);assert.deepEqual(placement.sounds,[]);
 await page.waitFor(`[...qa.game.st.ents.values()].some(e=>e.defId==='fg-rusted-league-widow-mine')`,10000);
 await page.eval(`qa.screen.togglePause();qa.layer.x=qa.layer.prevX=850;qa.layer.y=qa.layer.prevY=1020;for(let i=0;i<20;i++)qa.game.step();`);
 await page.eval(`new Promise(requestAnimationFrame)`);writeFileSync(output+'-armed.png',await page.png());
 const selection=await page.eval(`(()=>{const mine=[...qa.game.st.ents.values()].find(e=>e.defId==='fg-rusted-league-widow-mine');qa.screen.input.setSelection([mine.id,qa.layer.id],false);return [...qa.screen.input.view.selection];})()`);
 assert.equal(selection.length,1);
 await page.eval(`qa.target=qa.newEnt(qa.game.st,'mbt',1,946,1000);qa.target.holdFire=true;qa.target.holdPos=true;qa.hp=qa.target.hp;qa.game.step();`);
 assert.equal(await page.eval(`qa.game.st.projs.filter(p=>p.gun==='fg-rusted-league-widow-mine/seeker').length`),1);
 await page.eval(`for(let i=0;i<9;i++)qa.game.step();`);
 await page.eval(`new Promise(requestAnimationFrame)`);writeFileSync(output+'-seeking.png',await page.png());
 const result=await page.eval(`(async()=>{for(let i=0;i<45;i++){qa.game.step();await new Promise(requestAnimationFrame);}return {damage:qa.hp-qa.target.hp,remaining:qa.game.st.projs.filter(p=>p.gun==='fg-rusted-league-widow-mine/seeker').length,errors:mineErrors};})()`);
 assert(result.damage>0);assert.equal(result.remaining,0);assert.deepEqual(result.errors,[]);
 writeFileSync(output+'-impact.png',await page.png());writeFileSync(output+'.json',JSON.stringify(result,null,2));
 console.log('Verified actual deployment button, mine selection, seeker drawing and damage.',result,'Screenshots: '+output+'-*.png');
}catch(error){
 if(page){writeFileSync(output+'-failure.png',await page.png());console.log(await page.eval(`({errors:mineErrors,selection:window.qa?[...qa.screen.input.view.selection]:[],text:document.body.innerText.slice(-5000),buttons:[...document.querySelectorAll('button')].map(b=>b.outerHTML).slice(-30)})`));}
 throw error;
}finally{await page?.close();if(chrome){chrome.kill();await new Promise(r=>chrome.once('exit',r));}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
