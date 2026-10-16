import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const engine = process.env.STEEL_CANDIDATE ?? resolve(import.meta.dir, '../../../steel-tide');
const out = process.env.STEEL_GATE_OUT ?? resolve(engine, '.steel-tide-data/engine-capability-gate');
const { selection } = await import(resolve(engine, 'game/core/server/testkit/capabilityWorld.ts'));
const { PROTOCOL_VERSION } = await import(resolve(engine, 'game/core/src/net/protocol.ts'));
const world = selection();
world.project.scenarios[0].cfg.players[1].isHuman = false;
if (process.env.STEEL_GATE_MOD) {
  const mod=await Bun.file(process.env.STEEL_GATE_MOD).json();
  world.project.mods=[mod];
  const scenario=world.project.scenarios[0];
  scenario.instances=scenario.instances.map((e,index)=>({...e,defId:index===1?'usgr-re-plahj8team':'usgr-re-t90m'}));
}
const trustedExtensions=world.project.mods.flatMap(mod=>(mod.extensionPackages??[]).map(pkg=>`${pkg.id}@${pkg.version}:${pkg.schema.sha256}:${pkg.runtime.sha256}:${pkg.presentation?.sha256??''}`));
mkdirSync(out, { recursive: true });
await Bun.write(resolve(out, 'worker-world.json'), JSON.stringify({ world, protocol: PROTOCOL_VERSION, trustedExtensions }));
