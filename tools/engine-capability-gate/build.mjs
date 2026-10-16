#!/usr/bin/env node
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2);
const arg=(n,d)=>{const i=args.indexOf(n);return i<0?d:args[i+1]};
const candidate=resolve(arg('--engine',resolve(here,'../../../steel-tide'))),base=resolve(arg('--base','/tmp/steel-tide-capability-baseline-c4754358'));
const out=resolve(arg('--out',resolve(here,'../../dist/engine-capability-gate')));mkdirSync(out,{recursive:true});
const template=readFileSync(resolve(here,'browser-template.ts'),'utf8');
const baselineRevision=execFileSync('git',['rev-parse',arg('--base-ref','c4754358')],{cwd:candidate,encoding:'utf8'}).trim();
process.env.VERCEL_GIT_COMMIT_SHA=baselineRevision;
const metadata={createdAt:new Date().toISOString(),purpose:'Vite/Rollup diagnostic; keeps real vanilla factory/codec dispatch differences',variants:{}};
for(const [variant,root]of Object.entries({base,candidate})){
 const core=resolve(root,'game/core');process.chdir(core);
 const contentDispatch=variant==='candidate'||args.includes('--base-content');
 const {build,loadConfigFromFile}=await import(pathToFileURL(resolve(core,'node_modules/vite/dist/node/index.js')).href);
 const loaded=await loadConfigFromFile({command:'build',mode:'production'},resolve(core,'vite.config.ts'),core);
 if(!loaded)throw Error(`Cannot read ${variant} production config`);
 const production=loaded.config;let source=template.replaceAll('__ROOT__',root);
 source=source.replace('__CODEC_IMPORT__',contentDispatch?`import {contentFrameCodec} from '${root}/game/core/src/net/contentFrames.ts';`:'');
 source=source.replace('__CODEC_BIND__',contentDispatch?'const codec=contentFrameCodec(game);':'');
 if(contentDispatch)for(const name of ['viewKey','encodeFullFrame','buildTeamView','encodeFrame','stringifyFrame'])source=source.replaceAll(`${name}(`,`codec.${name}(`);
 const entry=resolve(out,`${variant}.ts`);writeFileSync(entry,source);
 const graph=[];
 await build({configFile:false,root:core,base:production.base??'./',define:production.define,publicDir:false,
  plugins:[...(contentDispatch?[{name:'real-content-match-factory',enforce:'pre',load(id){if(id===resolve(core,'server/testkit/game.ts'))return readFileSync(id,'utf8').replace("import { Game } from '../../src/game/sim';","import type { Game } from '../../src/game/sim';\nimport {createContentGame} from '../../src/game/contentGame';").replaceAll('new Game(', 'createContentGame(')}}]:[]),
   {name:'diagnostic-graph',generateBundle(_,bundle){for(const item of Object.values(bundle))if(item.type==='chunk')graph.push({file:item.fileName,entry:item.isEntry,imports:item.imports,dynamicImports:item.dynamicImports,bytes:Buffer.byteLength(item.code),modules:Object.keys(item.modules).map(p=>p.replace(root+'/',''))})}}],
  build:{target:production.build?.target,minify:production.build?.minify??'esbuild',assetsInlineLimit:production.build?.assetsInlineLimit,
   outDir:resolve(out,variant),emptyOutDir:true,rollupOptions:{input:entry,output:{entryFileNames:'benchmark.js',chunkFileNames:'chunks/[name]-[hash].js'}}}});
 writeFileSync(resolve(out,variant,'index.html'),'<script type="module" src="./benchmark.js"></script>\n');
 writeFileSync(resolve(out,variant,'graph.json'),JSON.stringify(graph,null,2)+'\n');
 metadata.variants[variant]={root,head:variant==='base'?baselineRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeIncluded:variant==='candidate',contentDispatch,baselineReference:baselineRevision,target:production.build?.target,minify:production.build?.minify??'esbuild',graph};
}
writeFileSync(resolve(out,'build.json'),JSON.stringify(metadata,null,2)+'\n');console.log(out);
