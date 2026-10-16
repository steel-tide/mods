import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const candidate=process.env.STEEL_CANDIDATE??resolve(import.meta.dir,'../../../steel-tide');
const home=process.env.STEEL_GATE_OUT??resolve(candidate,'.steel-tide-data/engine-capability-gate');mkdirSync(home,{recursive:true});
const roots={base:process.env.STEEL_BASELINE??'/tmp/steel-tide-capability-baseline-c4754358',candidate:process.env.STEEL_CANDIDATE??candidate};
for (const [variant, root] of Object.entries(roots)) {
  const entry = `${home}/browser-${variant}.ts`;
  let source=readFileSync(`${import.meta.dir}/browser-legacy-template.ts`,'utf8').replaceAll('__ROOT__',root);
  const candidate=variant==='candidate';
  source=source.replace('__FACTORY_IMPORT__',candidate?`import {contentFrameCodec} from '${root}/game/core/src/net/contentFrames.ts';`:'');
  source=source.replace('__BIND_CODEC__',candidate?'const codec=contentFrameCodec(game);':'');
  if(candidate) for(const name of ['viewKey','encodeFullFrame','buildTeamView','encodeFrame','stringifyFrame']) source=source.replaceAll(`${name}(`,`codec.${name}(`);
  writeFileSync(entry,source);
  const result=await Bun.build({entrypoints:[entry],outdir:`${home}/browser`,naming:{entry:`${variant}.js`,chunk:`${variant}-[name]-[hash].js`},target:'browser',minify:true,splitting:true,plugins:candidate?[{name:'real-match-factory',setup(build){build.onLoad({filter:/server\/testkit\/game\.ts$/},async({path})=>({loader:'ts',contents:readFileSync(path,'utf8').replace("import { Game } from '../../src/game/sim';","import type { Game } from '../../src/game/sim';\nimport {createContentGame} from '../../src/game/contentGame';").replaceAll('new Game(', 'createContentGame(')}));}}]:[]});
  if(!result.success)throw Error(result.logs.join('\n'));
  writeFileSync(`${home}/browser/${variant}.html`,`<script type="module" src="./${variant}.js"></script>`);
  console.log(variant,result.outputs.map(x=>[x.path,x.size]));
}
