/** M6 browser acceptance. Real folder import; screenshots stay outside shipped media. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { once } from 'node:events';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const game = resolve(here, '../../../steel-tide/game/core');
const { launchChrome, Page } = await import(pathToFileURL(resolve(game, 'scripts/lib/chrome.mjs')));
const origin = process.env.GAME_ORIGIN || 'http://127.0.0.1:5207';
const output = resolve(here, 'verification/m6-browser');
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(here, 'mod.json'), 'utf8'));
const debugPort = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(resolve(tmpdir(), 'usgr-re-m6-'));
const browser = await launchChrome(debugPort, profile), page = await Page.open(debugPort);
const report = { origin, packVersion: manifest.version, checkedAt: new Date().toISOString(), screenshots: [] };
async function snap(name, clip) {
  const file = resolve(output, `${name}.png`);
  writeFileSync(file, await page.png(clip)); report.screenshots.push(file);
}
function requireCheck(ok, description) { if (!ok) throw Error(description); }
async function clickUnit(id) {
  const at = await page.eval(`(()=>{const e=__game.st.ents.get(${id}),s=__screen,p=s.cam.worldToScreen(e.x,e.y),r=s.canvas.getBoundingClientRect();return {x:r.x+p.x/s.cam.scale,y:r.y+p.y/s.cam.scale};})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...at });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...at });
  await page.eval('window.__step(0)');
}

try {
  await page.metrics(1600, 1200, 1);
  await page.onNewDocument(`
    localStorage.setItem('steeltide.settings',JSON.stringify({graphicsPreset:'high',lang:'en',musicVolume:0,voiceVolume:.8}));
    localStorage.setItem('steeltide.guideShown','true');
    window.__captureErrors=[];window.__captureWarnings=[];
    addEventListener('error',e=>__captureErrors.push(e.error?.stack??e.message));
    addEventListener('unhandledrejection',e=>__captureErrors.push(String(e.reason)));
    const oldWarn=console.warn.bind(console);console.warn=(...args)=>{__captureWarnings.push(args.map(String).join(' '));oldWarn(...args)};
  `);
  await page.goto(origin);
  await page.waitFor('!!document.querySelector(".screen") || /PRESS ANY KEY/i.test(document.body.innerText)',180000);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await page.waitFor('!!document.querySelector(".screen")',180000);
  await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts');const {SettingsScreen}=await import('/src/ui/settingsPage.ts');showScreen(new SettingsScreen('mods'));})()`);
  await page.waitFor('!!document.querySelector("input[webkitdirectory]")');
  await page.send('DOM.enable');
  const {root:dom}=await page.send('DOM.getDocument');
  const {nodeId}=await page.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'input[webkitdirectory]'});
  await page.send('DOM.setFileInputFiles',{nodeId,files:[here]});
  await page.waitFor(`(async()=>{const {installedMods}=await import('/src/content/manager.ts');return installedMods().some(m=>m.mod.id==='ucgr'&&m.mod.version===${JSON.stringify(manifest.version)});})()`,90000);
  report.folderImport=await page.eval(`(async()=>{const {installedMods,readContentFile}=await import('/src/content/manager.ts');const m=installedMods().find(m=>m.mod.id==='ucgr');return {version:m.mod.version,enabled:m.stored.enabled,source:m.stored.source,capabilities:m.mod.requiredCapabilities,resources:Object.entries(m.mod.extensionPackages[0].assets).map(([id,file])=>({id,file,present:!!readContentFile(m.mod.id,file)}))};})()`);
  requireCheck(report.folderImport.enabled && report.folderImport.resources.every(r=>r.present),'Real folder import did not activate every declared package asset');
  console.log('Folder imported',JSON.stringify({version:report.folderImport.version,resources:report.folderImport.resources.length}));

  report.audioDecode=await page.eval(`(async()=>{const {installedMods,readContentFile}=await import('/src/content/manager.ts');const m=installedMods().find(m=>m.mod.id==='ucgr'),ac=new AudioContext(),out=[];try{for(const [id,file] of Object.entries(m.mod.extensionPackages[0].assets)){if(!id.startsWith('voice-'))continue;const bytes=await(await fetch(readContentFile(m.mod.id,file))).arrayBuffer(),view=new DataView(bytes),header=new TextDecoder().decode(bytes.slice(0,12)),buffer=await ac.decodeAudioData(bytes.slice(0));out.push({id,file,bytes:bytes.byteLength,riff:header.startsWith('RIFF')&&header.endsWith('WAVE'),pcm:view.getUint16(20,true)===1,bits:view.getUint16(34,true),duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate,frames:buffer.length});}}finally{await ac.close();}return out;})()`);
  requireCheck(report.audioDecode.length===41 && report.audioDecode.every(r=>r.riff&&r.pcm&&r.bits===16&&r.frames>0),'All 41 packaged PCM16 voices must decode in the browser');
  console.log('Decoded voices',report.audioDecode.length);

  await page.goto(`${origin}/?debug=showcase`);
  await page.waitFor('!!window.__game && !!window.__screen && !!window.__orders && !!window.__art',180000);
  report.loaded=await page.eval(`(async()=>{const {DEFS}=await import('/src/game/defs.ts');const {contentRuntime}=await import('/src/game/contentGame.ts');__screen.paused=true;window.__savedRaf=requestAnimationFrame;window.requestAnimationFrame=()=>0;__game.st.cfg.fog=false;__game.updateFog();const missing=${JSON.stringify(manifest.defs.map(d=>d.id))}.filter(id=>!DEFS[id]);return {missing,modules:contentRuntime(__game)?.modules.map(m=>m.id),renderer:__screen.renderer.constructor.name,errors:__captureErrors,warnings:__captureWarnings};})()`);
  requireCheck(!report.loaded.missing.length && report.loaded.modules.includes('usgr-re.feedback-v1'),'M6 module and definitions must load');

  report.icons=await page.eval(`(async()=>{const {getDef}=await import('/src/game/defs.ts');const {contentRuntime}=await import('/src/game/contentGame.ts');const g=__game,s=__screen,o=__orders,r=contentRuntime(g);o.cmdWorldRemove(g,[...g.st.ents.values()].filter(e=>getDef(e.defId).kind==='unit').map(e=>e.id),'removed');const ids=[50,54,58].map((x,i)=>o.cmdWorldSpawn(g,{id:'m6-icons-'+i,defId:'usgr-re-t90m',owner:0,x:x*32,y:30*32,angle:-Math.PI/2,holdPos:true,holdFire:true}));window.__m6Tanks=ids;__step(1);const components=r.module('components-v1'),state=components.snapshot();for(let i=1;i<3;i++)for(const part of ['track','driver','gunner','engine']){const p=state.entities[ids[i]].parts[part];p.damage=i===1?70:100;p.failed=i===2;if(p.failed)delete p.occupant;}for(let i=1;i<3;i++){state.entities[ids[i]].parts.rack.damage=i===1?120:175;state.entities[ids[i]].parts.rack.failed=false;}components.restore(state);s.input.view.selection.clear();s.input.view.selection.add(ids[1]);s.cam.zoom=3.2*s.cam.scale;s.cam.centerOn(54*32,30*32);__step(0);return {ids,left:'healthy',middle:'warning',right:'destroyed',visuals:ids.map(id=>r.module('usgr-re.feedback-v1').render(g.st.ents.get(id))),componentState:ids.map(id=>components.snapshot().entities[id])};})()`);
  await new Promise(r=>setTimeout(r,400)); await page.eval('__step(0)'); await snap('t90-component-icons');
  requireCheck(report.icons.visuals[0].length===0 && report.icons.visuals[1].length===5 && report.icons.visuals[2].length===5,'T90 healthy/warning/destroyed indicators must match source states');
  requireCheck(report.icons.visuals.slice(1).every(row=>row.every(v=>v.y===25&&v.scale===.25)&&JSON.stringify(row.map(v=>v.x).sort((a,b)=>a-b))==='[-25,-12.5,0,12.5,25]'),'Source icon offsets and image scale must include native world enlargement');
  console.log('T90 icons rendered at source world scale');

  const voiceUnits=await page.eval(`(async()=>{const {audioEnsure,setVolumes,stopVoice}=await import('/src/core/audio.ts');audioEnsure();setVolumes(.7,0,.8);stopVoice();const id=__orders.cmdWorldSpawn(__game,{id:'m6-select-voice',defId:'usgr-re-hq17',owner:0,x:54*32,y:33*32,angle:0,holdPos:true,holdFire:true});__screen.input.view.selection.clear();__screen.cam.centerOn(54*32,31*32);__step(0);return {hq:id,tank:__m6Tanks[0]};})()`);
  await clickUnit(voiceUnits.hq);
  await page.waitFor(`window.__voice().now==='crew.usgr-re-hq17.select'`,10000);
  report.selectVoice=await page.eval('({voice:__voice(),selected:[...__screen.input.view.selection]})');
  await page.eval(`(async()=>{(await import('/src/core/audio.ts')).stopVoice();})()`);
  await clickUnit(voiceUnits.tank);
  report.silentSelect=await page.eval('({voice:__voice(),selected:[...__screen.input.view.selection]})');
  requireCheck(report.silentSelect.voice.now===null && report.silentSelect.selected.includes(voiceUnits.tank),'Source-unbound T90 selection must remain silent');
  await page.eval(`__screen.commands.issue({kind:'move',ids:[${voiceUnits.tank}],x:50*32,y:32*32,queue:false,attackMove:false})`);
  await page.waitFor(`window.__voice().now==='crew.usgr-re-t90m.move'`,10000);
  report.moveVoice=await page.eval('__voice()');
  await page.eval(`__screen.commands.issue({kind:'move',ids:[${voiceUnits.tank}],x:51*32,y:32*32,queue:false,attackMove:false})`);
  report.repeatVoice=await page.eval('__voice()');
  requireCheck(report.moveVoice.endsAt===report.repeatVoice.endsAt,'Immediate duplicate order must preserve the active source recording');
  console.log('Real selection and command voice routing passed');

  report.muzzle=await page.eval(`(async()=>{
    const {getDef}=await import('/src/game/defs.ts'),{unitDisplayScale}=await import('/src/core/metrics.ts');
    const g=__game,s=__screen,o=__orders;
    const shooter=o.cmdWorldSpawn(g,{id:'m6-recoil',defId:'usgr-re-t90m',owner:0,x:48*32,y:40*32,angle:0,holdPos:true,holdFire:false});
    const target=o.cmdWorldSpawn(g,{id:'m6-recoil-target',defId:'mbt',owner:1,x:48*32+220,y:40*32,angle:Math.PI,holdPos:true,holdFire:true});
    o.cmdAttack(g,[shooter],target);let effect;
    for(let i=0;i<160&&!effect;i++){__step(1);effect=g.st.effects.find(f=>f.recoil?.src===shooter);}
    if(!effect)throw Error('T90 did not emit a native recoil effect');
    window.__m6Muzzle={shooter,target};
    const e=g.st.ents.get(shooter),d=getDef(e.defId),p=g.st.projs.findLast(p=>p.src===shooter);
    s.input.view.selection.clear();s.input.view.selection.add(shooter);s.cam.zoom=3.2*s.cam.scale;s.cam.centerOn(e.x+65,e.y);
    // The first simulation tick has already advanced the flash age. Render its
    // interpolated birth instant to compare the flash against the resting tip.
    s.renderer.render(s.cam,s.input.view,0);s.renderer.flushBakes();s.renderer.render(s.cam,s.input.view,0);
    const picture=s.renderer.pictureOf(e,d,0),sprite=__art.getSprite(d.turretSprite+picture.teamSuffix),ss=sprite.ss??1;
    const w=Math.round(sprite.fw*ss),h=Math.round(sprite.fh*ss),[left,top,right,bottom]=sprite.barrels[0];
    const x0=Math.floor(left*w),x1=Math.ceil(right*w),y0=Math.floor(top*h),y1=Math.ceil(bottom*h);
    const pixels=sprite.cv.getContext('2d').getImageData(0,0,w,h).data;
    let firstOpaqueRow=y0;
    outer:for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*w+x)*4+3]>0){firstOpaqueRow=y;break outer;}
    let opaqueLeft=x1,opaqueRight=x0;for(let x=x0;x<x1;x++)if(pixels[(firstOpaqueRow*w+x)*4+3]>0){opaqueLeft=Math.min(opaqueLeft,x);opaqueRight=Math.max(opaqueRight,x+1);}
    const ring=picture.rings[0],scale=unitDisplayScale(d),forward=((sprite.ay??sprite.fh/2)-firstOpaqueRow/ss)*scale;
    const lateral=((opaqueLeft+opaqueRight)/2/ss-sprite.fw/2)*scale;
    const visualTip={x:ring.x+Math.cos(ring.bearing)*forward-Math.sin(ring.bearing)*lateral,y:ring.y+Math.sin(ring.bearing)*forward+Math.cos(ring.bearing)*lateral};
    const regionForward=((sprite.ay??sprite.fh/2)-y0/ss)*scale;
    return {entity:{x:e.x,y:e.y,angle:e.angle,turretAngle:e.turretAngle},camera:{zoom:s.cam.zoom,scale:s.cam.scale},
      flash:{x:effect.x,y:effect.y,key:effect.key,age:effect.t,recoil:effect.recoil},projectile:p&&{x:p.x,y:p.y,px:p.px,py:p.py,gun:p.gun},
      muzzlePoints:d.weapons[0].muzzlePoints,restFrame:{alpha:0,gunArt:picture.gunArt,barrelRegion:[x0,y0,x1,y1],firstOpaqueRow,
        sprite:{fw:sprite.fw,fh:sprite.fh,ss,ay:sprite.ay},unitDisplayScale:scale,ring:{x:ring.x,y:ring.y,bearing:ring.bearing},
        regionForward,opaqueFront:[opaqueLeft,firstOpaqueRow,opaqueRight],forward,lateral,visualTip,flashTipDistance:Math.hypot(effect.x-visualTip.x,effect.y-visualTip.y)}};
  })()`);
  await snap('t90-source-muzzle-rest-tip');
  const barrelClip=await page.eval(`(()=>{const e=__game.st.ents.get(__m6Muzzle.shooter),p=__screen.cam.worldToScreen(e.x,e.y),scale=__screen.cam.scale;return {x:Math.round(p.x/scale-100),y:Math.round(p.y/scale-120),width:420,height:240};})()`);
  await snap('t90-muzzle-rest-detail',barrelClip);
  report.muzzle.recoilFrame=await page.eval(`(async()=>{const {getDef}=await import('/src/game/defs.ts');const e=__game.st.ents.get(__m6Muzzle.shooter),s=__screen;s.renderer.render(s.cam,s.input.view,1);s.renderer.flushBakes();s.renderer.render(s.cam,s.input.view,1);const picture=s.renderer.pictureOf(e,getDef(e.defId),1);return {alpha:1,gunArt:picture.gunArt,rings:picture.rings.map(r=>({x:r.x,y:r.y,bearing:r.bearing,recoilArt:r.recoil?.art,shifts:r.recoil?.shifts}))};})()`);
  await snap('t90-source-muzzle-native-recoil');
  await snap('t90-muzzle-recoil-detail',barrelClip);
  requireCheck(report.muzzle.flash.recoil.stroke===6,'T90 must retain source recoil stroke on native renderer');
  requireCheck(Math.hypot(report.muzzle.projectile.px-report.muzzle.flash.x,report.muzzle.projectile.py-report.muzzle.flash.y)<.001,'Projectile origin and flash must agree');
  requireCheck(report.muzzle.restFrame.flashTipDistance<1,'T90 flash must originate within one world pixel of the loaded visible barrel tip');
  requireCheck(report.muzzle.recoilFrame.gunArt.startsWith('recoil/'),'Native barrel recoil must remain active after visual muzzle correction');
  console.log('Native T90 visual muzzle/recoil rendered');

  report.disposal=await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts');const {SettingsScreen}=await import('/src/ui/settingsPage.ts');const {voiceState}=await import('/src/core/audio.ts');const {contentRuntime}=await import('/src/game/contentGame.ts');window.__m6OldHud=__screen.hud;const oldGame=__game;showScreen(new SettingsScreen('mods'));const before=voiceState();__m6OldHud.unitVoice('usgr-re-hq17','select',${voiceUnits.hq});const after=voiceState();const manager=await import('/src/content/manager.ts');await manager.setModEnabled('ucgr',false);const stored=await(await import('/src/mods/store.ts')).listStoredMods();const {DEFS}=await import('/src/game/defs.ts');return {before,after,storedEnabled:stored.find(m=>m.id==='ucgr').enabled,runtimeDisposed:!contentRuntime(oldGame),enabled:manager.installedMods().find(m=>m.mod.id==='ucgr').stored.enabled,modDefsRemaining:Object.keys(DEFS).filter(id=>id.startsWith('usgr-re-')).length};})()`);
  requireCheck(report.disposal.after.now===null && !report.disposal.enabled && report.disposal.modDefsRemaining===0,'Leaving and disabling must silence old feedback and remove content');
  await page.eval('window.__m6OldRealm=true');
  await page.goto(`${origin}/?debug=showcase&m6vanilla=1`);
  await page.waitFor('!window.__m6OldRealm && !!window.__game && !!window.__screen && !!window.__orders',180000);
  report.vanilla=await page.eval(`(async()=>{const {contentRuntime}=await import('/src/game/contentGame.ts');const {Game}=await import('/src/game/sim.ts');const {Renderer}=await import('/src/render/renderer.ts');const {Hud}=await import('/src/ui/hud.ts');return {runtime:!!contentRuntime(__game),nativeGame:__game.constructor===Game,nativeRenderer:__screen.renderer.constructor===Renderer,nativeHud:__screen.hud.constructor===Hud,installed:(await import('/src/content/manager.ts')).installedMods().map(m=>({id:m.mod.id,enabled:m.stored.enabled})),errors:__captureErrors,warnings:__captureWarnings};})()`);
  requireCheck(!report.vanilla.runtime && report.vanilla.nativeGame && report.vanilla.nativeRenderer && report.vanilla.nativeHud,'Disabled mod must return to native vanilla constructors');
  await snap('vanilla-after-disable');
  report.passed=true;
  console.log('M6 browser acceptance passed');
} catch(error) {
  report.passed=false;report.failure=String(error.stack??error);
  try {report.failureState=await page.eval('({text:document.body.innerText.slice(0,6000),errors:window.__captureErrors,warnings:window.__captureWarnings,voice:window.__voice?.()})');await snap('failure');}catch{}
  console.error(report.failure);
  process.exitCode=1;
} finally {
  writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  try {await page.close();}finally{browser.kill();if(browser.exitCode===null&&browser.signalCode===null)await once(browser,'exit');rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
