/** Photograph the installed mod in a local, unmodified Steel Tide dev client.
 * Start Vite directly (`pnpm exec vite --port 5199`) in sibling game/core;
 * the real Mods folder input installs this folder into a fresh browser profile.
 * Uses the game's own browser harness and order boundary; no game files change.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

const here = dirname(fileURLToPath(import.meta.url));
const game = resolve(here, '../../../steel-tide/game/core');
const { launchChrome, Page } = await import(pathToFileURL(resolve(game, 'scripts/lib/chrome.mjs')));
const origin = process.env.GAME_ORIGIN || 'http://localhost:5199';
const debugPort = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(resolve(tmpdir(), 'ucgr-browser-'));
const manifest = JSON.parse(readFileSync(resolve(here, 'mod.json'), 'utf8'));
const browser = await launchChrome(debugPort, profile);
const page = await Page.open(debugPort);
const output = resolve(here, 'screenshots');
mkdirSync(output, { recursive: true });
async function photograph(name) {
  const result=await page.send('Page.captureScreenshot',{format:'jpeg',quality:92});
  writeFileSync(resolve(output,name+'.jpg'),Buffer.from(result.data,'base64'));
  rmSync(resolve(output,name+'.png'),{force:true});
}

try {
  await page.metrics(1600, 1200, 1);
  await page.onNewDocument(`
    if(${process.env.NO_WEB_CRYPTO==='1'})Object.defineProperty(crypto,'subtle',{value:undefined});

    localStorage.setItem('steeltide.settings', JSON.stringify({graphicsPreset:'high',lang:'en',musicVolume:0}));
    localStorage.setItem('steeltide.guideShown','true');
    window.__captureErrors=[]; window.__captureWarnings=[];
    addEventListener('error',e=>window.__captureErrors.push(e.error?.stack ?? e.message));
    addEventListener('unhandledrejection',e=>window.__captureErrors.push(String(e.reason)));
    const oldWarn=console.warn.bind(console); console.warn=(...args)=>{window.__captureWarnings.push(args.map(String).join(' '));oldWarn(...args)};
  `);
  await page.goto(origin);
  await page.waitFor('!!document.querySelector(".screen") || /PRESS ANY KEY/i.test(document.body.innerText)', 180000);
  await page.send('Input.dispatchKeyEvent', {type:'keyDown', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
  await page.send('Input.dispatchKeyEvent', {type:'keyUp', key:'Enter', code:'Enter', windowsVirtualKeyCode:13});
  await page.waitFor('!!document.querySelector(".screen")', 180000);
  await page.eval(`(async()=>{
    const {showScreen}=await import('/src/ui/screens.ts');
    const {SettingsScreen}=await import('/src/ui/settingsPage.ts');
    showScreen(new SettingsScreen('mods'));
  })()`);
  await page.waitFor('!!document.querySelector("input[webkitdirectory]")');
  await page.send('DOM.enable');
  const {root: dom} = await page.send('DOM.getDocument');
  const {nodeId} = await page.send('DOM.querySelector', {nodeId:dom.nodeId, selector:'input[webkitdirectory]'});
  await page.send('DOM.setFileInputFiles', {nodeId, files:[here]});
  await page.waitFor(`(async()=>{const {installedMods}=await import('/src/mods/manager.ts');return installedMods().some(m=>m.mod.id==='ucgr'&&m.mod.version===${JSON.stringify(manifest.version)});})()`, 60000);
  const folderImport = await page.eval(`(async()=>{const {installedMods}=await import('/src/mods/manager.ts');const m=installedMods().find(m=>m.mod.id==='ucgr');return {version:m.mod.version,enabled:m.stored.enabled,source:m.stored.source,capabilities:m.mod.requiredCapabilities,webCrypto:!!crypto.subtle};})()`);
  await page.goto(`${origin}/?debug=showcase`);
  await page.waitFor('!!window.__game && !!window.__screen && !!window.__orders && !!window.__art', 180000);
  const loaded = await page.eval(`(async()=>{
    const {DEFS}=await import('/src/game/defs.ts');
    const expected=${JSON.stringify(manifest.defs.map(d=>d.id))};
    const missing=expected.filter(id=>!DEFS[id]);
    const missingArt=${JSON.stringify(manifest.sprites.map(s=>s.key))}.filter(key=>!window.__art.getSprite(key));
    window.__screen.paused=true; window.__game.st.cfg.fog=true; window.__game.updateFog();
    window.requestAnimationFrame=()=>0;
    const {contentRuntime}=await import('/src/game/contentGame.ts');
    const {installedMods}=await import('/src/mods/manager.ts');
    const spriteWarnings=(installedMods().find(m=>m.mod.id==='ucgr')?.warnings??[]).filter(w=>String(w.path).startsWith('sprites.'));
    return {defs:expected.length,missing,missingArt,spriteWarnings,modules:contentRuntime(window.__game)?.modules.map(m=>m.id),errors:window.__captureErrors,warnings:window.__captureWarnings};
  })()`);
  console.log('Installed mod', JSON.stringify(loaded));
  if (loaded.missing.length || loaded.missingArt.length || JSON.stringify([...loaded.modules??[]].sort())!==JSON.stringify([...manifest.requiredCapabilities??[]].sort())) throw Error('Missing definitions, loaded art or capability runtime');

  const stage = await page.eval(`(async()=>{
    const g=window.__game,s=window.__screen,o=window.__orders;
    const {getDef}=await import('/src/game/defs.ts');
    o.cmdWorldRemove(g,[...g.st.ents.values()].filter(e=>{
      const d=getDef(e.defId);return d.kind==='unit'||(!d.isHQ&&(d.weapons?.length||d.wall));
    }).map(e=>e.id),'removed');
    const army=[];
    function put(defId,tx,ty,angle=-Math.PI/2,owner=0){
      const id=o.cmdWorldSpawn(g,{id:'preview-'+army.length,defId,owner,x:tx*32,y:ty*32,angle,holdPos:true,holdFire:true});
      army.push(id);return id;
    }
    const tanks=['usgr-re-t90m','usgr-re-t72b3','usgr-re-t14','usgr-re-ztz99a','usgr-re-ztz96a','usgr-re-ztq15'];
    tanks.forEach((id,i)=>put(id,11+(i%3)*4,28+Math.floor(i/3)*4));
    const west=['usgr-re-m1a2sepv3','usgr-re-m1a1hc','usgr-re-l2a6','usgr-re-k1a1-e17a7bf0','usgr-re-90b','usgr-re-74e'];
    west.forEach((id,i)=>put(id,24+(i%3)*4,28+Math.floor(i/3)*4));
    ['usgr-re-btr82a','usgr-re-bmp3','usgr-re-zbd04a','usgr-re-m2a3','usgr-re-pumavjtf'].forEach((id,i)=>put(id,11+i*5,36));
    ['usgr-re-rusgud','usgr-re-plainf','usgr-re-usmarine','usgr-re-gerinf'].forEach((id,i)=>{
      for(let j=0;j<5;j++)put(id,12+i*5.5+j*.4,39+(j%2)*.5);
    });
    s.input.view.selection.clear();s.input.view.selection.add(army[0]);
    s.cam.zoom=1.5*s.cam.scale;s.cam.centerOn(22*32,33*32);
    window.__step(1);window.__step(0);
    return {army,units:army.length,selected:army[0],camera:{zoom:s.cam.zoom,x:s.cam.x,y:s.cam.y}};
  })()`);
  await new Promise(r=>setTimeout(r,500));
  await page.eval('window.__step(0)');
  await photograph('armored-roster');
  const statScroll = await page.eval(`(()=>{
    const before=document.querySelector('.module-stats');
    before.scrollTop=before.scrollHeight;
    const requested=before.scrollTop;
    window.__step(15);window.__step(0);
    const after=document.querySelector('.module-stats');
    return {requested,retained:after.scrollTop,height:after.clientHeight,total:after.scrollHeight};
  })()`);
  if(!(statScroll.requested>0) || statScroll.retained!==statScroll.requested) throw Error('Component list scroll was lost during HUD refresh');

  const air = await page.eval(`(()=>{
    const g=window.__game,s=window.__screen,o=window.__orders;
    const ids=[];
    const roster=['usgr-re-ka52','usgr-re-z10','usgr-re-ah64d','usgr-re-ec556had','usgr-re-su35s','usgr-re-j-10','usgr-re-f-16c-6b611fe0','usgr-re-f-2'];
    roster.forEach((defId,i)=>ids.push(o.cmdWorldSpawn(g,{id:'air-preview-'+i,defId,owner:0,x:(58+(i%4)*7)*32,y:(10+Math.floor(i/4)*9)*32,angle:-Math.PI/2,holdPos:true,holdFire:true})));
    s.input.view.selection.clear();s.input.view.selection.add(ids[2]);
    s.cam.zoom=1.15*s.cam.scale;s.cam.centerOn(69*32,17*32);
    window.__step(1);window.__step(0);
    return {ids,units:ids.length};
  })()`);
  await new Promise(r=>setTimeout(r,300));
  await page.eval('window.__step(0)');
  await photograph('aircraft-roster');
  const combat=await page.eval(`(()=>{
    const g=window.__game,s=window.__screen,o=window.__orders;
    const mover=o.cmdWorldSpawn(g,{id:'movement-check',defId:'usgr-re-ru-engineer',owner:0,x:42*32,y:24*32,angle:0});
    o.cmdMove(g,[mover],46*32,24*32);
    window.__step(30);
    const moved=g.st.ents.get(mover);
    const movement={distance:Math.hypot(moved.x-42*32,moved.y-24*32),orders:moved.orders};
    const friendly=[],enemy=[];
    function put(defId,owner,tx,ty){
      return o.cmdWorldSpawn(g,{id:'combat-'+owner+'-'+tx+'-'+ty,defId,owner,x:tx*32,y:ty*32,angle:owner?Math.PI:0,holdPos:true,holdFire:false});
    }
    for(let i=0;i<4;i++){
      friendly.push(put(i%2?'usgr-re-ztz99a':'usgr-re-t90m',0,40-i%2,29+i*2.8));
      enemy.push(put(i%2?'usgr-re-l2a6':'usgr-re-m1a2sepv3',1,47+i%2,29+i*2.8));
    }
    friendly.push(put('usgr-re-bmp3',0,38,41));enemy.push(put('usgr-re-m2a3',1,49,41));
    friendly.push(put('usgr-re-ka52',0,38,26));enemy.push(put('usgr-re-ah64d',1,49,26));
    friendly.forEach((id,i)=>o.cmdAttack(g,[id],enemy[i]));
    enemy.forEach((id,i)=>o.cmdAttack(g,[id],friendly[i]));
    const before=[...friendly,...enemy].map(id=>({id,hp:g.st.ents.get(id).hp}));
    s.input.view.selection.clear();s.input.view.selection.add(friendly[0]);
    s.cam.zoom=1.9*s.cam.scale;s.cam.centerOn(43.5*32,33.5*32);
    window.__step(45);window.__step(0); // source first shots need ~1 s of aim and warmup
    return {movement,friendly,enemy,projectiles:g.st.projs.length,damaged:before.filter(e=>g.st.ents.get(e.id).hp<e.hp).length};
  })()`);
  await new Promise(r=>setTimeout(r,300));
  await page.eval('window.__step(0)');
  await photograph('combined-arms');
  const sourceCases = await page.eval(`(async()=>{
    const g=window.__game,s=window.__screen,o=window.__orders;
    const {contentRuntime}=await import('/src/game/contentGame.ts');
    const r=contentRuntime(g);
    const hj=o.cmdWorldSpawn(g,{id:'hj-source-case',defId:'usgr-re-plahj8team',owner:0,x:60*32,y:35*32,angle:0,holdFire:true});
    window.__step(62);
    const parent=g.st.ents.get(hj);
    const deployed=parent.defId;
    const attachment=r.module('articulation-v1').snapshot().find(([id])=>id===hj);
    o.cmdMove(g,[hj],65*32,35*32);
    window.__step(61);
    const packed=parent.defId;
    const moveRetained=parent.orders.some(order=>order.kind==='move');
    const observer=o.cmdWorldSpawn(g,{id:'mig-source-case',defId:'usgr-re-mig29',owner:0,x:60*32,y:45*32,angle:0,holdPos:true,holdFire:true});
    const target=o.cmdWorldSpawn(g,{id:'radar-source-target',defId:'usgr-re-f-2',owner:1,x:70*32,y:46*32,angle:Math.PI,holdPos:true,holdFire:true});
    window.__step(5);
    s.input.view.selection.clear();s.input.view.selection.add(observer);
    s.cam.zoom=1.4*s.cam.scale;s.cam.centerOn(65*32,45*32);
    window.__step(0);
    const radar=r.inspect(g.st.ents.get(observer),0);
    return {hj,deployed,packed,moveRetained,attachment,observer,target,radar};
  })()`);
  await photograph('radar-contacts');
  if(sourceCases.deployed!=='usgr-re-plahj8team-deployed' || sourceCases.packed!=='usgr-re-plahj8team' || !sourceCases.moveRetained || !sourceCases.radar.rows.some(row=>row.module==='sensors-v1'&&row.value>0)) throw Error('Source deployment or radar browser check failed');
  const verification=await page.eval(`(()=>({errors:window.__captureErrors,warnings:window.__captureWarnings,fog:window.__game.st.cfg.fog,entities:[...window.__game.st.ents.values()].filter(e=>e.defId.startsWith('usgr-re-')&&!e.dead).length,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height]}))()`);
  const moduleState=await page.eval(`(async()=>{
    const {contentRuntime}=await import('/src/game/contentGame.ts');
    const g=window.__game,r=contentRuntime(g);
    return {selected:r.inspect(g.st.ents.get(${stage.selected}),0),snapshot:r.snapshot()};
  })()`);
  writeFileSync(resolve(here, 'browser-verification.json'), JSON.stringify({origin,folderImport,loaded,ground:stage,statScroll,air,combat,sourceCases,verification,moduleState,screenshots:['screenshots/armored-roster.jpg','screenshots/aircraft-roster.jpg','screenshots/combined-arms.jpg','screenshots/radar-contacts.jpg']},null,2)+'\n');
  if(combat.movement.distance<1 || (!combat.projectiles && !combat.damaged)) throw Error('Movement or combat smoke check had no effect');
  console.log('Captured',JSON.stringify(verification));
} catch (error) {
  console.error('Browser failure state', await page.eval('({url:location.href,text:document.body.innerText.slice(0,5000),errors:window.__captureErrors,step:typeof window.__step})').catch(()=>null));
  await photograph('verification-error').catch(()=>{});
  throw error;
} finally {
  try {
    await page.close();
  } finally {
    browser.kill();
    if(browser.exitCode===null && browser.signalCode===null) await once(browser,'exit');
    rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
