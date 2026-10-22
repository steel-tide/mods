// Browser acceptance uses the existing read-only game harness and a disposable profile.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
const here=import.meta.dirname,game=resolve(here,'../../../steel-tide-game/game/core');
const {launchChrome,Page}=await import(pathToFileURL(resolve(game,'scripts/lib/chrome.mjs')));
const origin=process.env.GAME_ORIGIN??'http://127.0.0.1:5209';
const profile=mkdtempSync(resolve(tmpdir(),'naval-warfare-browser-'));
const port=9487,browser=await launchChrome(port,profile),page=await Page.open(port);
const manifest=JSON.parse(readFileSync(resolve(here,'mod.json'),'utf8'));
const inventory=JSON.parse(readFileSync(resolve(here,'source-inventory.json'),'utf8'));
const id=name=>inventory.find(e=>e.rwName===name).id;
const report={packVersion:manifest.version,origin,errors:[],screenshots:[]};
function check(value,message){if(!value)throw Error(message);}
mkdirSync(resolve(here,'verification'),{recursive:true});
async function screenshot(name){const file=resolve(here,'screenshots',name+'.jpg');const result=await page.send('Page.captureScreenshot',{format:'jpeg',quality:90});writeFileSync(file,Buffer.from(result.data,'base64'));report.screenshots.push(file);}
try{
 await page.metrics(1600,1200,1);
 await page.onNewDocument(`localStorage.setItem('steeltide.settings',JSON.stringify({graphicsPreset:'high',lang:'en',musicVolume:0,voiceVolume:0}));localStorage.setItem('steeltide.guideShown','true');window.__nwErrors=[];addEventListener('error',e=>__nwErrors.push(e.error?.stack??e.message));addEventListener('unhandledrejection',e=>__nwErrors.push(String(e.reason)));`);
 await page.goto(origin);
 await page.waitFor('!!document.querySelector(".screen") || !!document.querySelector("#boot-start")',120000);
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await page.waitFor('!!document.querySelector(".screen")',120000);
 await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts'),{SettingsScreen}=await import('/src/ui/settingsPage.ts');showScreen(new SettingsScreen('mods'));})()`);
 await page.waitFor('!!document.querySelector("input[webkitdirectory]")');
 await page.send('DOM.enable');
 const {root}=await page.send('DOM.getDocument');
 const {nodeId}=await page.send('DOM.querySelector',{nodeId:root.nodeId,selector:'input[webkitdirectory]'});
 await page.send('DOM.setFileInputFiles',{nodeId,files:[here]});
 await page.waitFor(`(async()=>{const {installedMods}=await import('/src/content/manager.ts');return installedMods().some(m=>m.mod.id==='naval-warfare'&&m.mod.version===${JSON.stringify(manifest.version)});})()`,120000);
 report.import=await page.eval(`(async()=>{const {installedMods,readContentFile}=await import('/src/content/manager.ts');const m=installedMods().find(m=>m.mod.id==='naval-warfare');return {enabled:m.stored.enabled,defs:m.mod.defs.length,sprites:m.mod.sprites.length,sounds:m.mod.sounds.length,music:m.mod.music.tracks.length,missing:[...m.mod.sprites,...m.mod.sounds,...m.mod.music.tracks].filter(s=>!readContentFile(m.mod.id,s.file)).map(s=>s.file)};})()`);
 check(report.import.enabled&&!report.import.missing.length,'Folder import must activate every declared asset');
 console.log('Folder installed',JSON.stringify(report.import));
 report.audio=await page.eval(`(async()=>{const {installedMods,readContentFile}=await import('/src/content/manager.ts'),m=installedMods().find(m=>m.mod.id==='naval-warfare'),ac=new AudioContext(),result=[];try{for(const sound of [...m.mod.sounds,m.mod.music.tracks[0]]){const data=await(await fetch(readContentFile(m.mod.id,sound.file))).arrayBuffer(),decoded=await ac.decodeAudioData(data);result.push({file:sound.file,duration:decoded.duration,channels:decoded.numberOfChannels});}}finally{await ac.close();}return result;})()`);
 check(report.audio.length===26&&report.audio.every(a=>a.duration>0),'Every firing recording and a music track must decode in Chrome');
 await page.goto(origin+'/?debug=showcase');
 await page.waitFor('!!window.__game&&!!window.__screen&&!!window.__orders',120000);
 report.runtime=await page.eval(`(async()=>{const {DEFS}=await import('/src/game/defs.ts'),{contentRuntime}=await import('/src/game/contentGame.ts');__screen.paused=true;window.requestAnimationFrame=()=>0;__game.st.cfg.fog=false;__game.st.cfg.mode='campaign';__game.updateFog();return {missing:${JSON.stringify(manifest.defs.map(d=>d.id))}.filter(id=>!DEFS[id]),modules:contentRuntime(__game)?.modules.map(m=>m.id),renderer:__screen.renderer.constructor.name};})()`);
 check(!report.runtime.missing.length&&report.runtime.modules.includes('naval-warfare.systems-v1'),'All definitions and extension must load');
 console.log('Runtime loaded',JSON.stringify(report.runtime));
 report.buildings=await page.eval(`(async()=>{
   const {getDef}=await import('/src/game/defs.ts'),{getSprite}=await import('/src/gfx/atlas.ts');
   return ${JSON.stringify(manifest.defs.filter(d=>d.kind==='building').map(d=>d.id))}.map(id=>{
     const d=getDef(id),s=getSprite(d.sprite);return {id,footprint:[d.fw,d.fh],frame:s&&[s.fw,s.fh]};
   });
 })()`);
 for(const building of report.buildings){
   const d=manifest.defs.find(d=>d.id===building.id),s=manifest.sprites.find(s=>s.key===d.sprite);
   check(JSON.stringify(building.frame)===JSON.stringify([s.fw,s.fh]),'Building must render at its declared size: '+building.id);
 }
 report.fleet=await page.eval(`(async()=>{const g=__game,s=__screen,o=__orders;const {getDef}=await import('/src/game/defs.ts');o.cmdWorldRemove(g,[...g.st.ents.keys()],'removed');const at=(name,owner,x,y,a=-Math.PI/2)=>o.cmdWorldSpawn(g,{id:'nw-'+name,defId:name,owner,x:x*32,y:y*32,angle:a,holdPos:true,holdFire:true});const w=g.st.map.w,h=g.st.map.h;g.st.map.terrain.fill(1);g.st.map.deposits=[];g.st.map.overlays=undefined;g.st.map.decor=[];for(let y=0;y<h;y++)for(let x=0;x<18;x++)g.st.map.terrain[y*w+x]=3;s.renderer.invalidateTerrainArt();const ids=[at(${JSON.stringify(id('CVN-74'))},0,36,35),at(${JSON.stringify(id('DDG-105'))},0,28,35),at(${JSON.stringify(id('CG-72'))},0,45,36),at(${JSON.stringify(id('Admiral_Nakhimov'))},1,57,35),at(${JSON.stringify(id('F-35C'))},0,37,29),at(${JSON.stringify(id('F-18'))},0,40,29),at(${JSON.stringify(id('Borei'))},1,55,44)];for(let i=0;i<3;i++)__step(1);s.input.view.selection.clear();s.input.view.selection.add(ids[0]);s.cam.zoom=1.15*s.cam.scale;s.cam.centerOn(40*32,35*32);__step(0);return {ids,units:ids.map(id=>({id,definition:g.st.ents.get(id)?.defId,cargo:g.st.ents.get(id)?.cargo?.length})),pictures:ids.map(id=>{const e=g.st.ents.get(id),p=s.renderer.pictureOf(e,getDef(e.defId),1);return {id,body:!!p.body,mounts:p.rings.length};})};})()`);
 check(report.fleet.pictures.every(p=>p.body),'Every showcased body must render');
 await screenshot('fleet');
 report.carrierAction=await page.eval(`(async()=>{const {cmdContentAction}=await import('/src/game/orders.ts'),{contentRuntime}=await import('/src/game/contentGame.ts');const g=__game,e=g.st.ents.get(${report.fleet.ids[0]});const before=e.cargo.length;const ok=cmdContentAction(g,'naval-warfare.systems-v1',{owner:0,ids:[e.id],action:'launch'});__step(1);return {ok,before,after:e.cargo.length,actions:contentRuntime(g).inspect(e,0).actions.map(a=>a.label)};})()`);
 check(report.carrierAction.ok&&report.carrierAction.before===5&&report.carrierAction.after===0,'Carrier launch must work after actual install');
 report.translations=await page.eval(`(async()=>{const {setLang,t}=await import('/src/core/i18n.ts');const out={};for(const lang of ['en','zh','ko']){setLang(lang);out[lang]={name:t('unit.${id('CVN-74')}.name'),description:t('unit.${id('CVN-74')}.desc')};}setLang('en');__step(0);return out;})()`);
 check(report.translations.zh.name!==report.translations.en.name&&report.translations.ko.name!==report.translations.en.name,'Localized names must reach the HUD string table');
 report.construction=await page.eval(`(async()=>{const g=__game,s=__screen,o=__orders,{contentRuntime}=await import('/src/game/contentGame.ts');const hq=o.cmdWorldSpawn(g,{id:'nw-builder-hq',defId:${JSON.stringify(id('USHQ'))},owner:0,x:10*32,y:28*32,angle:0,holdFire:true});const crane=o.cmdWorldSpawn(g,{id:'nw-crane',defId:${JSON.stringify(id('Crane Us'))},owner:0,x:13*32,y:30*32,angle:0,holdFire:true});const builder=o.cmdWorldSpawn(g,{id:'nw-excavator',defId:${JSON.stringify(id('Excavator US'))},owner:0,x:8*32,y:31*32,angle:0,holdFire:true});__step(1);const actions=contentRuntime(g).inspect(g.st.ents.get(crane),0).actions;const ok=o.cmdContentAction(g,'naval-warfare.systems-v1',{owner:0,ids:[crane],action:'construct/'+${JSON.stringify(id('USF'))},x:12*32,y:35*32});__step(2);s.input.view.selection.clear();s.input.view.selection.add(crane);s.cam.zoom=2.2*s.cam.scale;s.cam.centerOn(12*32,33*32);__step(0);const site=[...g.st.ents.values()].find(e=>e.defId===${JSON.stringify(id('USF'))});return {hq,crane,builder,ok,actions:actions.map(a=>a.label),site:site&&{id:site.id,building:site.defId,underConstruction:site.site,hp:site.hp}};})()`);
 check(report.construction.ok&&report.construction.site?.underConstruction,'Original crane construction must work through the actual imported package');
 await screenshot('construction');
 // New gallery scenes are authored through the game's ordinary world commands.
 await page.eval(`window.__nwGallery=(spec)=>{
   const g=__game,s=__screen,o=__orders,ids=${JSON.stringify(Object.fromEntries(inventory.map(e=>[e.rwName,e.id])))};
   o.cmdWorldRemove(g,[...g.st.ents.keys()],'removed');__step(1);
   g.st.projs.length=0;g.st.effects.length=0;g.st.decals.length=0;
   for(const p of g.st.players)p.isHuman=true;
   g.st.cfg.dayNight=false;g.st.cfg.weather='clear';
   const m=g.st.map;m.terrain.fill(1);m.deposits=[];m.decor=[];m.overlays=undefined;
   if(spec.shore)for(let y=0;y<m.h;y++)for(let x=0;x<spec.shore;x++)m.terrain[y*m.w+x]=3;
   if(spec.plaza)for(let y=25;y<40;y++)for(let x=31;x<42;x++)m.terrain[y*m.w+x]=6;
   s.renderer.invalidateTerrainArt();
   const spawned=spec.units.map(([name,owner,x,y,angle=-Math.PI/2])=>o.cmdWorldSpawn(g,{id:'gallery-'+name,defId:ids[name],owner,x:x*32,y:y*32,angle,holdPos:true,holdFire:!spec.combat}));
   __step(1);s.input.view.selection.clear();s.cam.zoom=spec.zoom*s.cam.scale;s.cam.centerOn(spec.x*32,spec.y*32);
   return {spawned,units:spec.units.map(u=>u[0])};
 };`);
 report.gallery={};
 report.gallery.carrier=await page.eval(`(async()=>{
   const scene=__nwGallery({x:43,y:35,zoom:2.75,units:[
     ['Gerald R. Ford Aircraft Carrier',0,42,35,-1.15],['DDG-105',0,37.5,32.5,-1.15],
     ['CG-72',0,48,36.5,-1.15],['F-35C',0,45,33,-1.15],['F-18',0,46,34,-1.15],
     ['F-18',0,47,33,-1.15],['F-35C',0,48,34,-1.15]]});
   const {cmdContentAction}=await import('/src/game/orders.ts');
   scene.launched=cmdContentAction(__game,'naval-warfare.systems-v1',{owner:0,ids:[scene.spawned[0]],action:'launch'});
   __step(3);__step(0);return scene;
 })()`);
 check(report.gallery.carrier.launched,'Gallery carrier must launch its aircraft');
 await screenshot('carrier-operations');
 report.gallery.combat=await page.eval(`(()=>{
   const scene=__nwGallery({x:43.5,y:35,zoom:2.65,combat:true,units:[
     ['SimpleIowa',0,38,34.5,0],['CG-72',0,37,39,0],['DDG-105',0,38,30,0],
     ['Admiral_Nakhimov',1,49,34.5,Math.PI],['Project 1164',1,49,39,Math.PI],
     ['Borei',1,49,30,Math.PI]]});
   for(let i=0;i<100;i++){__step(1);if(i>35&&__game.st.projs.length>5)break;}
   __step(0);return {...scene,projectiles:__game.st.projs.length,effects:__game.st.effects.length};
 })()`);
 check(report.gallery.combat.projectiles>0,'Gallery engagement must contain actual firing');
 await screenshot('naval-engagement');
 report.gallery.harbor=await page.eval(`(()=>{
   const scene=__nwGallery({x:40,y:33,zoom:2.6,shore:42,plaza:true,units:[
     ['USHQ',0,34,28],['USF',0,34,32],['USF',0,38.5,28],['C-Ram',0,40,29.5],
     ['Crane Us',0,38,32.5],['Helipad  US',0,34,36],['US_NavalDepot',0,39,36],
     ['USDCK',0,42,32],['Excavator US',0,36,30],['MBT1',0,36,35],
     ['MBT1',0,37,35],['DDG-105',0,45.5,29.5],['CG-72',0,46.5,36.5],
     ['F-35C',0,40,27]]});
   __step(3);__step(0);return scene;
 })()`);
 await screenshot('harbor-base');
 report.errors=await page.eval('__nwErrors');check(!report.errors.length,'Browser errors: '+JSON.stringify(report.errors));
 writeFileSync(resolve(here,'verification/browser.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Browser acceptance passed');
}catch(error){report.failure=String(error.stack??error);try{report.errors=await page.eval('__nwErrors');writeFileSync(resolve(here,'verification/failure.png'),await page.png());}catch{}writeFileSync(resolve(here,'verification/browser.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await page.close();if(browser.exitCode===null){browser.kill();await once(browser,'exit');}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
