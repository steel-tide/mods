// Actual folder import and game rendering, using an isolated disposable Chrome profile.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
const here=import.meta.dirname,game=resolve(here,'../../../steel-tide-game/game/core');
const {launchChrome,Page}=await import(pathToFileURL(resolve(game,'scripts/lib/chrome.mjs')));
const origin=process.env.GAME_ORIGIN??'http://127.0.0.1:5209',profile=mkdtempSync(resolve(tmpdir(),'ek-browser-'));
const port=9493,chrome=await launchChrome(port,profile),page=await Page.open(port);
const manifest=JSON.parse(readFileSync(resolve(here,'mod.json'),'utf8'));
const inventory=JSON.parse(readFileSync(resolve(here,'source-inventory.json'),'utf8'));
const ids=Object.fromEntries(inventory.map(e=>[e.rwName,e.id]));
const report={manifestSha256:createHash('sha256').update(readFileSync(resolve(here,'mod.json'))).digest('hex'),screenshots:[]};
function check(value,message){if(!value)throw Error(message);}
async function screenshot(name){const file='screenshots/'+name+'.jpg';const result=await page.send('Page.captureScreenshot',{format:'jpeg',quality:90});writeFileSync(resolve(here,file),Buffer.from(result.data,'base64'));report.screenshots.push(file);}
try{
 await page.metrics(1600,1200,1);
 await page.onNewDocument(`localStorage.setItem('steeltide.settings',JSON.stringify({graphicsPreset:'high',lang:'en',musicVolume:0,voiceVolume:0}));localStorage.setItem('steeltide.guideShown','true');window.__ekErrors=[];addEventListener('error',e=>__ekErrors.push(e.error?.stack??e.message));addEventListener('unhandledrejection',e=>__ekErrors.push(String(e.reason)));`);
 await page.goto(origin);await page.waitFor('!!document.querySelector(".screen") || !!document.querySelector("#boot-start")',120000);
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await page.waitFor('!!document.querySelector(".screen")',120000);
 await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts'),{SettingsScreen}=await import('/src/ui/settingsPage.ts');showScreen(new SettingsScreen('mods'));})()`);
 await page.waitFor('!!document.querySelector("input[webkitdirectory]")');await page.send('DOM.enable');
 const {root}=await page.send('DOM.getDocument');const {nodeId}=await page.send('DOM.querySelector',{nodeId:root.nodeId,selector:'input[webkitdirectory]'});
 await page.send('DOM.setFileInputFiles',{nodeId,files:[here]});
 await page.waitFor(`(async()=>{const {installedMods}=await import('/src/content/manager.ts');return installedMods().some(m=>m.mod.id==='ek-definitive-edition');})()`,120000);
 report.import=await page.eval(`(async()=>{const {installedMods,readContentFile}=await import('/src/content/manager.ts');const m=installedMods().find(m=>m.mod.id==='ek-definitive-edition');return {enabled:m.stored.enabled,defs:m.mod.defs.length,sprites:m.mod.sprites.length,sounds:m.mod.sounds.length,missing:[...m.mod.sprites,...m.mod.sounds].filter(s=>!readContentFile(m.mod.id,s.file)).map(s=>s.file)};})()`);
 check(report.import.enabled&&!report.import.missing.length,'Every asset must be installed');console.log('Installed',report.import);
 await page.goto(origin+'/?debug=showcase');await page.waitFor('!!window.__game&&!!window.__screen&&!!window.__orders',120000);
 report.runtime=await page.eval(`(async()=>{const {DEFS}=await import('/src/game/defs.ts'),{contentRuntime}=await import('/src/game/contentGame.ts');__screen.paused=true;window.requestAnimationFrame=()=>0;__game.st.cfg.fog=false;__game.st.cfg.mode='campaign';__game.updateFog();return {missing:${JSON.stringify(manifest.defs.map(d=>d.id))}.filter(id=>!DEFS[id]),modules:contentRuntime(__game)?.modules.map(m=>m.id),renderer:__screen.renderer.constructor.name};})()`);
 check(!report.runtime.missing.length&&report.runtime.modules.includes('ek-definitive-edition.systems-v1'),'Runtime must contain all EK definitions');
 console.log('Runtime',report.runtime);
 await page.eval(`window.__ekGallery=async(spec)=>{
   const g=__game,s=__screen,o=__orders,ids=${JSON.stringify(ids)},{getDef}=await import('/src/game/defs.ts');
   o.cmdWorldRemove(g,[...g.st.ents.keys()],'removed');__step(1);g.st.projs.length=0;g.st.effects.length=0;g.st.decals.length=0;
   for(const p of g.st.players)p.isHuman=true;g.st.cfg.dayNight=false;g.st.cfg.weather='clear';
   const m=g.st.map;m.terrain.fill(spec.water?1:3);m.deposits=[];m.decor=[];m.overlays=undefined;s.renderer.invalidateTerrainArt();
   const spawned=spec.units.map(([name,x,y,owner=0])=>o.cmdWorldSpawn(g,{id:'ek-gallery-'+name,defId:ids[name],owner,x:x*32,y:y*32,angle:-Math.PI/2,holdPos:true,holdFire:!spec.combat}));
   __step(2);s.input.view.selection.clear();if(spec.select)s.input.view.selection.add(spawned[spec.select-1]);s.cam.zoom=spec.zoom*s.cam.scale;s.cam.centerOn(spec.x*32,spec.y*32);__step(0);
   return {spawned,pictures:spawned.map(id=>{const e=g.st.ents.get(id);if(!e)return {id,removed:true};const p=s.renderer.pictureOf(e,getDef(e.defId),1);return {id,body:!!p.body,mounts:p.rings.length};})};
 };`);
 const definitions=new Set(inventory.map(e=>e.rwName));
 const major=inventory.filter(e=>e.ini.core.displayText&&(/Drake|Gladiator|Excelsior|Colossus|Arsenal|Cordelia|InfantryGrunt|InfantryFactoryT1|SupportFactory$|NebelwerferStatic/.test(e.rwName)));
 console.log('Available gallery units',major.map(e=>e.rwName));
 report.ground=await page.eval(`__ekGallery({x:36,y:35,zoom:1.8,select:1,units:[['Ek_heavyTankDrake',32,34],['EkInfantryFactoryT1',29,29],['EkSupportFactory',38,29],['EkNebelwerferStatic',35,36],['EkInfantryGrunt',31,36],['EkInfantryGrunt',32,36],['EkInfantryGrunt',33,36],['EkExcelsior',41,35]]})`);
 check(report.ground.pictures.every(p=>p.body),'Ground showcase bodies must render');await screenshot('ground-forces');
 const aircraft=inventory.filter(e=>['Ek_Gladiator','Ek_Cordelia','Ek_Arsenal_Bird','EkArsenalBird','EkPterosaur','EkCaesarius'].includes(e.rwName)).map(e=>e.rwName);
 if(aircraft.length){report.air=await page.eval(`__ekGallery({x:35,y:35,zoom:1.2,units:${JSON.stringify(aircraft.map((name,i)=>[name,26+i%3*10,31+Math.floor(i/3)*12]))}})`);await screenshot('air-fleet');}
 report.translations=await page.eval(`(async()=>{const {setLang,t}=await import('/src/core/i18n.ts'),out={};for(const lang of ['en','zh','ko']){setLang(lang);out[lang]={name:t('unit.${ids.EkInfantryFactoryT1}.name'),description:t('unit.${ids.EkInfantryFactoryT1}.desc')};}setLang('en');__step(0);return out;})()`);
 check(report.translations.ko.name!==report.translations.en.name,'Korean localization must reach the game');
 await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts'),{SandboxScreen}=await import('/src/ui/sandbox.ts');window.__ekSetup=new SandboxScreen();showScreen(__ekSetup);})()`);
 await page.waitFor(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('EK Complete Showcase'))`);
 await page.eval(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('EK Complete Showcase')).click()`);
 report.mapPicker=await page.eval(`({name:__ekSetup.custom?.name,placements:__ekSetup.custom?.units.length})`);
 check(report.mapPicker.name==='EK Complete Showcase'&&report.mapPicker.placements===400,'The installed map must appear and be selectable in Conquest');
 await page.eval(`(async()=>{const {showScreen}=await import('/src/ui/screens.ts'),{GameScreen}=await import('/src/ui/gameScreen.ts');showScreen(new GameScreen({kind:'sandbox',cfg:{mode:'sandbox',mapKey:'custom',customMap:__ekSetup.custom,seed:3,fog:false,dayNight:false,weather:'clear',popCap:500,startMetal:1000,players:[{isHuman:true,team:0,spawn:0},{isHuman:false,team:1,spawn:1}]}}));})()`);
 await page.waitFor(`window.__game?.st.cfg.customMap?.name==='EK Complete Showcase'`,120000);
 report.showcase=await page.eval(`(async()=>{const {contentRuntime}=await import('/src/game/contentGame.ts');__screen.paused=true;__step(1);const ids=${JSON.stringify(manifest.defs.map(d=>d.id))},present=new Set([...__game.st.ents.values()].map(e=>e.defId));return {missing:ids.filter(id=>!present.has(id)),uniqueDefinitions:ids.filter(id=>present.has(id)).length,entities:__game.st.ents.size,metal:__game.st.players[0].metal,state:contentRuntime(__game).module('ek-definitive-edition.systems-v1').snapshot().showcase};})()`);
 check(!report.showcase.missing.length&&report.showcase.state.ready,'The actual showcase must open with all 573 definitions');
 for(const [name,x,y,zoom] of [['showcase-overview',192,224,.065],['showcase-air',242,88,.65],['showcase-naval',326,300,.65]]){
   await page.eval(`__screen.cam.zoom=${zoom}*__screen.cam.scale;__screen.cam.centerOn(${x}*32,${y}*32);__step(0)`);
   const result=await page.send('Page.captureScreenshot',{format:'jpeg',quality:90});writeFileSync(resolve(here,'verification/'+name+'.jpg'),Buffer.from(result.data,'base64'));
 }
 if(process.env.EK_SOAK_SECONDS){
   await page.eval(`__screen.cam.zoom=.65*__screen.cam.scale;__screen.cam.centerOn(108*32,296*32);__game.st.cfg.fog=true;__game.updateFog();const e=[...__game.st.ents.values()].find(e=>e.defId==='ek-towerhmgupgraded');__screen.input.view.selection.add(e.id);__step(0)`);
   report.running=[];
   for(let second=0;second<Number(process.env.EK_SOAK_SECONDS);second++){
     const state=await page.eval(`(()=>{let error;try{for(let i=0;i<30;i++){__step(1);__screen.cam.centerOn((108+Math.sin(__game.st.time)*5)*32,296*32);__screen.renderer.render(__screen.cam,__screen.input.view,(i%10)/10);}}catch(e){error=e.stack??String(e);}const s=__game.st,g=__screen.renderer.g,t=g.getTransform();return {time:s.time,entities:s.ents.size,projectiles:s.projs.length,effects:s.effects.length,decals:s.decals.length,error,errors:window.__ekErrors,canvas:{alpha:g.globalAlpha,composite:g.globalCompositeOperation,transform:[t.a,t.b,t.c,t.d,t.e,t.f]},largestEffects:[...s.effects].sort((a,b)=>(b.scale??0)-(a.scale??0)).slice(0,3)};})()`);
     report.running.push(state);
     if(second%10===0||state.error)console.log('Running',state);
     if(state.error)break;
   }
   const shot=await page.send('Page.captureScreenshot',{format:'jpeg',quality:90});writeFileSync(resolve(here,'verification/showcase-running.jpg'),Buffer.from(shot.data,'base64'));
   writeFileSync(resolve(here,'verification/showcase-running.json'),JSON.stringify(report.running,null,2)+'\n');
   check(!report.running.some(s=>s.error||s.errors.length),'Continuous showcase render must not throw');
   check(report.running.every(s=>s.entities===report.showcase.entities&&s.projectiles===0&&s.effects===0&&s.decals===0),'Idle showcase must not generate ordnance, casualties or extra specimens');
   check(report.running.every(s=>s.canvas.alpha===1&&s.canvas.composite==='source-over'&&JSON.stringify(s.canvas.transform)==='[1,0,0,1,0,0]'),'Every rendered frame must leave the canvas clean');
   report.activation=await page.eval(`(async()=>{const {contentRuntime}=await import('/src/game/contentGame.ts');const e=[...__game.st.ents.values()].find(e=>e.defId==='${ids.EkArsenalBird}'),id='ek-definitive-edition.systems-v1';const accepted=__orders.cmdContentAction(__game,id,{owner:e.owner,ids:[e.id],action:'showcase-start'});__step(2);return {accepted,attachedHangars:Object.keys(contentRuntime(__game).module(id).snapshot().entities[e.id].children).length};})()`);
   check(report.activation.accepted&&report.activation.attachedHangars===3,'Explicit activation must still run the source carrier scripts');
 }
 report.errors=await page.eval('window.__ekErrors');check(!report.errors.length,'No browser errors: '+JSON.stringify(report.errors));
 mkdirSync(resolve(here,'verification'),{recursive:true});writeFileSync(resolve(here,'verification/browser.json'),JSON.stringify(report,null,2)+'\n');console.log('Browser acceptance passed');
}finally{await page.close();if(chrome.exitCode===null){chrome.kill('SIGTERM');await once(chrome,'exit');}rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
