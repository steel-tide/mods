#!/usr/bin/env bun
/** Verify an actual standalone server using locally approved external package code. */
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {once} from 'node:events';
if (typeof Bun === 'undefined') throw Error('Run this standalone WebSocket verifier with Bun.');
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const binary=resolve(arg('--server','../steel-tide/game/core/release/steel-tide-server/steel-tide-server'));
const packagePath=resolve(arg('--package','mods/ucgr/mod.json'));
const fixture=JSON.parse(readFileSync(arg('--world','dist/external-production/worker-world.json'),'utf8'));
const out=arg('--out','docs/engine-compatibility/2026-10-16-external-packages/standalone-server.json');
const data=mkdtempSync(resolve(tmpdir(),'steel-extension-server-'));
const port=28866,hostKey='local-extension-verification',logs=[];
const server=spawn(binary,[],{env:{...process.env,STEEL_TIDE_PORT:String(port),STEEL_TIDE_HOST_KEY:hostKey,STEEL_TIDE_JOIN_CODE:'',STEEL_TIDE_DATA_DIR:data,STEEL_TIDE_EXTENSION_PACKAGES:packagePath},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>logs.push(String(b)));server.stderr.on('data',b=>logs.push(String(b)));
let socket;
const wait=async(fn)=>{for(let i=0;i<400;i++){const value=await fn();if(value)return value;if(server.exitCode!==null)throw Error(logs.join(''));await new Promise(r=>setTimeout(r,20));}throw Error('Verification deadline expired: '+logs.join(''));};
try {
 await wait(async()=>{try{return (await fetch(`http://127.0.0.1:${port}/status`)).ok}catch{return false}});
 socket=new WebSocket(`ws://127.0.0.1:${port}/ws`);await once(socket,'open');
 const events=[],frames=[];
 socket.onmessage=({data})=>{const raw=String(data);if(!raw.trim())return;try{if(raw.startsWith('S'))frames.push(JSON.parse(raw.slice(1)));else events.push(JSON.parse(raw));}catch(error){events.push({type:'error',message:'invalid packet',length:raw.length,prefix:raw.slice(0,80)})}};
 const say=message=>socket.send(JSON.stringify(message));
 say({type:'hello',protocol:fixture.protocol,name:'Host',hostKey,worldVersion:1,engineCapabilities:['extension-host-v1']});
 await wait(()=>events.some(e=>e.type==='welcome')||events.some(e=>e.type==='error'));
 if(events.some(e=>e.type==='error'))throw Error(JSON.stringify(events.filter(e=>e.type==='error')));
 say({type:'lobbyPatch',patch:{world:fixture.world}});
 const content=await wait(()=>events.find(e=>e.type==='worldContent')||events.find(e=>e.type==='error'));
 if(content.type==='error')throw Error(JSON.stringify(content));
 say({type:'worldReady',contentHash:content.contentHash});say({type:'start'});
 const frame=await wait(()=>frames[0]||events.find(e=>e.type==='error'));
 if(frame.type==='error'||!frame.extensions)throw Error(JSON.stringify({type:frame.type,message:frame.message,modules:Object.keys(frame.extensions??{})}));
 const result={standalone:true,worldVerified:true,modules:Object.keys(frame.extensions),errors:events.filter(e=>e.type==='error'),protocol:fixture.protocol,packageVersion:JSON.parse(readFileSync(packagePath,'utf8')).version};
 writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(result);
} finally {
 socket?.close();if(server.exitCode===null){const closed=once(server,'exit');server.kill('SIGTERM');await closed;}
 rmSync(data,{recursive:true,force:true});
}
