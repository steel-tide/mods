/** Verify live hull rotation through the game's actual hullPose + atlas draw.
 * Usage: node mods/ucgr/verify-rotation.mjs before|after
 * Uses an existing sibling Vite client on :5199 and owns/cleans its temporary
 * CORS server and Chrome profile. Does not modify any game files.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const phase=process.argv[2]||'after';
if(!['before','after'].includes(phase)) throw Error('Expected before or after');
const manifest=JSON.parse(readFileSync(resolve(here,'mod.json'),'utf8'));
const tanks=manifest.defs.filter(d=>d.kind==='unit'&&d.armor==='heavy');
const metadata=new Map(manifest.sprites.map(s=>[s.key,s]));
const origin=process.env.GAME_ORIGIN||'http://localhost:5199';
const game=resolve(here,'../../../steel-tide/game/core');
const {launchChrome,Page}=await import(pathToFileURL(resolve(game,'scripts/lib/chrome.mjs')));
const mime={'.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  const path=resolve(here,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(here+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(path);res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(bytes);}
  catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const modOrigin=`http://127.0.0.1:${server.address().port}/`;
const profile=mkdtempSync(resolve(tmpdir(),'usgr-re-rotation-'));
let browser,page;
try{
  const debugPort=9800+Math.floor(Math.random()*200);
  browser=await launchChrome(debugPort,profile);
  page=await Page.open(debugPort);
  await page.metrics(1200,900,1);
  await page.onNewDocument(`
    localStorage.setItem('steeltide.settings',JSON.stringify({graphicsPreset:'high',lang:'en',musicVolume:0}));
    localStorage.setItem('steeltide.guideShown','true');
    window.__rotationErrors=[];window.__rotationWarnings=[];
    addEventListener('error',e=>__rotationErrors.push(e.message));
    addEventListener('unhandledrejection',e=>__rotationErrors.push(String(e.reason)));
    const warn=console.warn.bind(console);console.warn=(...a)=>{__rotationWarnings.push(a.map(String).join(' '));warn(...a)};
  `);
  await page.goto(`${origin}/?debug=showcase&mod=${encodeURIComponent(modOrigin)}`);
  await page.waitFor('!!window.__game&&!!window.__screen&&!!window.__art',180000);
  const result=await page.eval(`(async()=>{
    window.__screen.paused=true;window.requestAnimationFrame=()=>0;
    const {hullPose}=await import('/src/render/hullPose.ts');
    const art=window.__art;
    const tanks=${JSON.stringify(tanks.map(d=>({id:d.id,key:d.sprite,manifestPivotX:metadata.get(d.sprite)?.pivotX}))) };
    const angles=Array.from({length:15},(_,i)=>i);
    const results=[];let preview;
    async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
    for(const tank of tanks){
      const sp=art.getSprite(tank.key);
      if(!sp){results.push({...tank,missing:true});continue;}
      const scale=6,size=Math.max(256,Math.ceil(Math.hypot(sp.fw,sp.fh)*scale)+16);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const hashes=[],poses=[];
      const cells=tank.id==='usgr-re-t90m'?document.createElement('canvas'):null;
      const chosen=[0,1,2,5,7,8,10,14];
      if(cells){cells.width=size*4;cells.height=(size+32)*2;}
      for(const deg of angles){
        const angle=-Math.PI/2+deg*Math.PI/180;
        const pose=hullPose(sp,angle,angle,0,0,0);
        ctx.clearRect(0,0,size,size);
        art.drawSpriteFrame(ctx,sp,pose.frame,size/2,size/2,scale,pose.rot);
        hashes.push(await hash(ctx.getImageData(0,0,size,size).data));poses.push(pose);
        if(cells&&chosen.includes(deg)){
          const i=chosen.indexOf(deg),g=cells.getContext('2d'),x=i%4*size,y=Math.floor(i/4)*(size+32);
          g.fillStyle='#223337';g.fillRect(x,y,size,size+32);g.drawImage(canvas,x,y);
          g.fillStyle='#ffffff';g.font='18px monospace';g.fillText(deg+' degrees',x+12,y+size+24);
        }
      }
      if(cells)preview=cells.toDataURL('image/png').split(',')[1];
      results.push({...tank,directionFrames:!!sp.dirs,frames:sp.frames,fw:sp.fw,fh:sp.fh,
        angles,poses,hashes,uniqueHeadings:new Set(hashes).size,
        adjacentDistinct:hashes.slice(1).every((h,i)=>h!==hashes[i])});
    }
    return {phase:${JSON.stringify(phase)},method:'Loaded real sprites through normal mod URL; renderer hullPose feeds atlas.drawSpriteFrame at up-facing0–14 degrees in1-degree increments; SHA-256 of RGBA pixels.',
      tanks:results,preview,errors:__rotationErrors,warnings:__rotationWarnings};
  })()`);
  const out=resolve(here,'verification');mkdirSync(out,{recursive:true});
  if(result.preview)writeFileSync(resolve(out,`rotation-${phase}.png`),Buffer.from(result.preview,'base64'));
  delete result.preview;
  result.summary={heavyTanks:result.tanks.length,live:result.tanks.filter(t=>!t.missing&&!t.directionFrames&&t.frames===1).length,
    fifteenDistinctHeadings:result.tanks.filter(t=>t.uniqueHeadings===15&&t.adjacentDistinct).length};
  writeFileSync(resolve(out,`rotation-${phase}.json`),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result.summary));
  for(const t of result.tanks)console.log(t.id,JSON.stringify({pivotX:t.manifestPivotX,dirs:t.directionFrames,frames:t.frames,uniqueHeadings:t.uniqueHeadings}));
  if(phase==='after'&&(result.summary.heavyTanks!==14||result.summary.live!==14||result.summary.fifteenDistinctHeadings!==14||result.errors.length))throw Error('Live rotation verification failed');
}finally{
  try{if(page)await page.close();}finally{
    if(browser){browser.kill();if(browser.exitCode===null&&browser.signalCode===null)await once(browser,'exit');}
    rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
    await new Promise(r=>server.close(r));
  }
}
