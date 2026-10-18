// Run against a game/core Vite server: node presentation-browser.mjs [origin].
// PLAYWRIGHT_MODULE may override the installed browser test runtime.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/rivertwilight/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const origin = process.argv[2] ?? 'http://127.0.0.1:5208';
const pcm = Buffer.alloc(44 + 16000);
pcm.write('RIFF'); pcm.writeUInt32LE(pcm.length - 8, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(8000, 24); pcm.writeUInt32LE(16000, 28);
pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(16000, 40);
for (let i = 0; i < 8000; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 8000 * 440 * Math.PI * 2) * 12000), 44 + i * 2);
const reports = [];
for (const [name, engine, options] of [
  ['chrome', chromium, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--autoplay-policy=no-user-gesture-required'] }],
  ['webkit', webkit, { executablePath: '/Users/rivertwilight/Library/Caches/ms-playwright/webkit-2370/pw_run.sh' }],
]) {
  const browser = await engine.launch({ headless: true, ...options });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__presentation_probe', route => route.fulfill({ contentType: 'text/html', body: '<button id="start">Start</button><canvas width="600" height="400"></canvas>' }));
    await page.route('**/sfx/**', route => route.fulfill({ status: 404, body: '' }));
    await page.goto(`${origin}/__presentation_probe`);
    await page.evaluate(async data => {
      const audio = await import('/src/core/audio.ts');
      window.probeAudio = audio;
      document.querySelector('#start').addEventListener('click', () => audio.audioEnsure());
      window.probeData = data;
    }, `data:audio/wav;base64,${pcm.toString('base64')}`);
    await page.click('#start');
    const setup = await page.evaluate(async () => {
      const { prepareContentSchema } = await import('/src/game/contentSchema.ts');
      const { parseDefinitionPack } = await import('/src/game/contentDefs.ts');
      const { prepare, presentation } = await import('/src/ui/contentPresentationLoader.ts');
      const { arena } = await import('/server/testkit/game.ts');
      const { newEnt } = await import('/src/game/state.ts');
      const { Camera } = await import('/src/render/camera.ts');
      const { gfx } = await import('/src/core/graphics.ts');
      const { Renderer } = await import('/src/render/renderer.ts');
      const capability = 'probe.presentation';
      const code = async source => ({ source, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)))].map(n => n.toString(16).padStart(2, '0')).join('') });
      const pkg = { id: 'probe', version: '1.0.0', api: 2, capabilities: [capability], assets: { tone: 'tone.wav' },
        schema: await code(`export default () => ({capabilities:[{id:'${capability}',definition:raw=>raw}]})`),
        runtime: await code(`export default () => ({capabilities:[{id:'${capability}',create:()=>({id:'${capability}',snapshot:()=>({}),restore(){}})}]})`),
        presentation: await code(`export default host => ({
          presentation(base) { return {...base,Renderer:class extends base.Renderer {
            drawContentDecal(g,d,...rest){if(d.key==='probe.wreck'){window.probe.draws.push('decal');g.fillStyle='#ff0000';g.fillRect(d.x-20,d.y-20,40,40);return true;}return super.drawContentDecal(g,d,...rest);}
            drawEnt(g,e){window.probe.draws.push('unit');g.fillStyle='#0000ff';g.fillRect(e.x-15,e.y-15,30,30);}
            drawContentEffect(g,e,...rest){if(e.key==='probe.effect'){window.probe.draws.push('effect');g.fillStyle='#ff00ff';g.fillRect(e.x-10,e.y-10,20,20);return true;}return super.drawContentEffect(g,e,...rest);}
            drawContentProjectileTrail(g,p,...rest){if(p.gun==='probe'){window.probe.draws.push('trail');return true;}return super.drawContentProjectileTrail(g,p,...rest);}
            drawContentProjectile(g,p,...rest){if(p.gun==='probe'){window.probe.draws.push('projectile');g.fillStyle='#ffff00';g.fillRect(p.x,p.y,4,4);return true;}return super.drawContentProjectile(g,p,...rest);}
          }};},
          feedback(context,base){const scope=host.createRecordedAudioScope();window.probe={scope,draws:[],frames:[],disposed:false};return {...base,
            update(frame){window.probe.frames.push(frame);scope.setPaused(frame.paused);scope.update();},
            dispose(){scope.dispose();window.probe.disposed=true;}
          };}
        })`),
      };
      const raw = { format: 'steel-tide-mod', v: 4, id: 'probe', name: 'Probe', version: '1', requiredCapabilities: [capability], extensionPackages: [pkg], defs: [{ id: 'probe-unit', extends: 'engineer', name: 'Probe', extensions: { [capability]: {} } }], files: { 'tone.wav': window.probeData } };
      await prepareContentSchema(raw, true); const parsed = parseDefinitionPack(raw);
      if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
      await prepare([parsed.pack]);
      const game = arena({ w: 16, h: 16, fog: false, dayNight: false, hour: 12 });
      const feedback = window.probeFeedback = presentation().feedback({ game, player: 0, spectator: false }, { unitVoice() {} });
      const audio = window.probeAudio, scope = window.probe.scope;
      audio.setVolumes(1, 0, 0); audio.setListener(256,256,600,400);
      await scope.prepare(window.probeData);
      window.probe.loop = scope.play(window.probeData, { loop:true,position:{x:256,y:256},gain:.25 });
      const mixer = audio.recordedAudioOutput(), analyser = mixer.context.createAnalyser(); analyser.fftSize=1024; mixer.output.connect(analyser);
      window.probeRms = () => {const wave=new Float32Array(1024);analyser.getFloatTimeDomainData(wave);return Math.sqrt(wave.reduce((n,v)=>n+v*v,0)/wave.length);};
      Object.assign(gfx, { lighting:'off',water:'off',groundMarks:false,wetReflections:false,rainRipples:false,snowCover:false,cloudShadows:false,buildingShadows:false,chimneySmoke:false,muzzleSmoke:false,heatHaze:false,lavaGlow:false,rainOutline:false });
      const cv=document.querySelector('canvas'),cam=new Camera();cam.x=256;cam.y=256;cam.zoom=1;cam.mapW=cam.mapH=16;cam.setViewport(600,400);
      const r=new (presentation().Renderer)(cv,game,0),ground=document.createElement('canvas');ground.width=ground.height=16;ground.getContext('2d').fillRect(0,0,16,16);
      r.deferBakes=true;r.terrainPreview=ground;r.interfaceMarks=false;
      newEnt(game.st,'engineer',0,256,256);
      game.st.decals.push({key:'probe.wreck',x:256,y:256,t:10,frame:0});game.st.effects.push({key:'probe.effect',x:256,y:256,t:.1,dur:1,frames:1});
      game.st.projs.push({id:1,gun:'probe',kind:'bullet',x:300,y:256,px:300,py:256,angle:0});
      const view={selection:new Set(),hoverId:0,dragBox:null,placing:null,placeTx:0,placeTy:0,attackMoveArmed:false,moveArmed:false,protectArmed:false,nukeTargeting:null,direct:false,aim:null,showAllHealth:false,xray:false,pings:[],pendingGoals:new Map()};
      r.render(cam,view,1);
      const point=cam.worldToScreen(256,256),pixel=[...cv.getContext('2d').getImageData(point.x,point.y,1,1).data];
      if (pixel[0]<250 || pixel[1]>3 || pixel[2]<250) throw Error('wrong layer pixel '+pixel);
      if (window.probe.draws.join(',')!=='decal,unit,trail,projectile,effect') throw Error('wrong draw order '+window.probe.draws);
      return { draws:window.probe.draws,pixel,nativeHasHooks:'drawContentDecal' in Renderer.prototype,audioState:mixer.context.state };
    });
    await page.waitForTimeout(150);
    const playing = await page.evaluate(() => ({ playing:window.probe.loop.playing,rms:window.probeRms() }));
    await page.evaluate(() => window.probeFeedback.update({ now:1000,dt:.03,time:10,paused:true,player:0,spectator:false }));
    await page.waitForTimeout(150);
    const paused = await page.evaluate(() => ({ playing:window.probe.loop.playing,rms:window.probeRms() }));
    await page.evaluate(() => window.probeFeedback.update({ now:1030,dt:.03,time:2,paused:false,player:1,spectator:true }));
    await page.waitForTimeout(150);
    const resumed = await page.evaluate(() => ({ playing:window.probe.loop.playing,rms:window.probeRms(),frames:window.probe.frames }));
    await page.evaluate(() => { window.probeFeedback.dispose();window.probeFeedback.dispose(); });
    await page.waitForTimeout(150);
    const stopped = await page.evaluate(() => ({ playing:window.probe.loop.playing,rms:window.probeRms(),disposed:window.probe.disposed }));
    if (!playing.playing || playing.rms<.001 || paused.rms>.00001 || resumed.rms<.001 || stopped.playing || stopped.rms>.00001 || errors.length) throw Error(JSON.stringify({name,setup,playing,paused,resumed,stopped,errors}));
    reports.push({ name,setup,playing,paused,resumed,stopped,errors });
  } finally { await browser.close(); }
}
writeFileSync(fileURLToPath(new URL('./presentation-browser.json', import.meta.url)), JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
