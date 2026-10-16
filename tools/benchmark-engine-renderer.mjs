#!/usr/bin/env node
/** Actual match renderer/HUD ABBA sample. Starts only its own plain Vite servers; no asset-generation scripts. */
import { createWriteStream, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2), option = (key, fallback) => { const at = args.indexOf(key); return at < 0 ? fallback : args[at + 1]; };
const mods = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = { base: resolve(option('--baseline', '/tmp/steel-tide-capability-baseline-c4754358')), candidate: resolve(option('--game', resolve(mods, '../steel-tide'))) };
const out = resolve(option('--out', resolve(mods, 'docs/engine-compatibility/2026-10-16-m0-m4/renderer')));
const ports = { base: 5201, candidate: 5202 }, order = ['base', 'candidate', 'candidate', 'base'];
const settings = ['--presets', 'high', '--skies', 'clear', '--cuts', 'pitched', '--units', '1024', '--seconds', '10', '--warmup', '5', '--match', '--width', '1920', '--height', '1080', '--zoom', '0.5'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const alive = async port => { try { return (await fetch(`http://localhost:${port}/`, {signal:AbortSignal.timeout(1000)})).ok; } catch { return false; } };
const processes = [], logs = [], runs = [];
mkdirSync(out, {recursive:true});
const manifest = { started: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', option('--base-ref', 'c4754358')], {cwd:roots.candidate,encoding:'utf8'}).trim(), candidateHead: execFileSync('git', ['rev-parse','HEAD'], {cwd:roots.candidate,encoding:'utf8'}).trim(), roots, ports, order, settings,
  notes: ['Candidate includes uncommitted working tree.', 'Runs the same unchanged native raster benchmark driver for both served checkouts, with full GameScreen/HUD and no profiling/pass timers.', 'Fresh Chrome profile for each sample, high clear/noon, 1024 opening units; terrain pre-baked then 5 s live warmup.', 'Direct installed Vite binary on owned ports 5201/5202, bypassing pnpm auto-install; never uses or stops the existing port 5199 server.', 'Development module delivery; this is a warmed renderer/HUD comparison, not a production startup benchmark.'] };
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
function owned(command, argv, cwd, log) {
  const stream = createWriteStream(log), child = spawn(command, argv, {cwd,env:{...process.env,VERCEL_GIT_COMMIT_SHA:manifest.baseCommit},stdio:['ignore','pipe','pipe'],detached:true});
  child.stdout.pipe(stream); child.stderr.pipe(stream); processes.push(child); logs.push(stream); return child;
}
async function ended(child) { return await new Promise((resolve,reject) => {child.once('error',reject); child.once('exit',(code,signal)=> code===0 ? resolve() : reject(Error(`Process failed (${code ?? signal})`)));}); }
try {
  for (const variant of ['base','candidate']) {
    const port = ports[variant];
    if (await alive(port)) throw Error(`Port ${port} is already occupied; refusing to use or stop an unrelated server`);
    const child = owned(process.execPath,[resolve(roots[variant],'game/core/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],resolve(roots[variant],'game/core'),resolve(out,`vite-${variant}.log`));
    let ready = false;
    for (let wait = 0; wait < 120; wait++) { if (child.exitCode !== null) break; if (await alive(port)) {ready=true;break;} await sleep(500); }
    if (!ready) throw Error(`${variant} Vite did not become ready`);
  }
  for (const [index, variant] of order.entries()) {
    const name = `${index+1}-${variant}`, raw = resolve(out,`${name}.json`);
    console.log(`Starting renderer ${name}`);
    const argv = [resolve(roots.candidate,'game/core/scripts/benchmark-raster.mjs'),...settings,'--port',String(ports[variant]),'--debug-port','9367','--out',raw];
    await ended(owned(process.execPath,argv,roots[variant],resolve(out,`${name}.log`)));
    const result = JSON.parse(readFileSync(raw,'utf8'));
    runs.push({variant,index:index+1,file:raw,screenshot:result.screenshot,errors:result.errors,summary:result.runs[0].summary});
    writeFileSync(resolve(out,'summary.json'),JSON.stringify({manifest,runs},null,2)+'\n');
    console.log(JSON.stringify(runs.at(-1)));
  }
} finally {
  for (const child of processes) if (child.exitCode === null && child.pid) {try {process.kill(-child.pid,'SIGTERM');} catch {}}
  for (const log of logs) log.end();
}
