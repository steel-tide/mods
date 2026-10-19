// Naval Warfare package schema. Source expressions are evidence, never executable code.
export default function () {
  const id = 'naval-warfare.systems-v1';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  function read(raw, path, issues,context) {
    const fail = (at, message) => issues.push({ path: at, message });
    if (!object(raw)) { fail(path, 'expected a Naval Warfare configuration'); return; }
    function number(value, at, low, high) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) fail(at, `expected a number in ${low}–${high}`);
    }
    for (const key of ['armor','minDamage','energyMax','energyStart','energyRegen','cargoHeal','regen']) {
      number(raw[key], path+'.'+key, key==='energyRegen' ? -10000 : 0, key==='energyStart' ? 1 : 100000000);
    }
    const allowed = new Set(['tags','armor','minDamage','mounts','guns','actions','initial','rearm','energyMax','energyRegen','energyStart','fullRecharge','startCargo','airCargo','cargoHeal','regen','rechargingRegen','deathBlast','reactor','reactorForms','cooling','transitions','capacity','dieOnZeroEnergy','wreck','attachments','construction','buildRange','mobileBuilder']);
    for (const key of Object.keys(raw)) if (!allowed.has(key)) fail(path+'.'+key,'unknown Naval Warfare field');
    for (const key of ['mounts','guns','actions','rearm','startCargo','tags']) {
      if (!Array.isArray(raw[key]) || raw[key].length > (key==='tags' ? 128 : 64)) fail(path+'.'+key,'expected a bounded list');
    }
    if (!Array.isArray(raw.mounts) || !Array.isArray(raw.guns) || !Array.isArray(raw.actions)) return;
    const mounts = new Set();
    for (const [i,m] of raw.mounts.entries()) {
      const at=path+`.mounts[${i}]`;
      if (!object(m) || typeof m.id!=='string' || mounts.has(m.id)) {fail(at,'invalid or duplicate mount');continue;}
      mounts.add(m.id);
      if(m.sprite&&context?.spriteKeys&&!context.spriteKeys.has(m.sprite))fail(at+'.sprite','missing source mount sheet');
      for (const key of ['x','y','rest','arc','turn','spin']) number(m[key],at+'.'+key,key==='x'||key==='y'||key==='rest'||key==='spin' ? -10000 : 0,10000);
    }
    for (const [i,m] of raw.mounts.entries()) if (m.parent && !mounts.has(m.parent)) fail(path+`.mounts[${i}].parent`,'missing parent mount');
    const guns=new Set();
    for (const [i,g] of raw.guns.entries()) {
      const at=path+`.guns[${i}]`;
      if (!object(g) || typeof g.id!=='string' || guns.has(g.id) || !mounts.has(g.mount) || !object(g.weapon)) {fail(at,'invalid gun or mount');continue;}
      guns.add(g.id);
      if(g.weapon.look?.sprite&&context?.spriteKeys&&!context.spriteKeys.has(g.weapon.look.sprite))fail(at+'.weapon.look.sprite','missing source projectile sheet');
      for(const key of ['range','reload','warmup','direct','area','radius','ignoreArmor','buildingMult','shieldMult','life','targetSpeed','acceleration','turnSpeed','spread','muzzle','lateral']) number(g[key],at+'.'+key,key==='lateral'||key==='ignoreArmor' ? -100000000000 : 0,100000000000);
      if(!Array.isArray(g.weapon.targets)||g.weapon.targets.some(t=>!['ground','ship','sub','air'].includes(t)))fail(at+'.weapon.targets','invalid target domain');
      if(!['mg','autocannon','cannon','at','he','rocket','navgun','ashm','torpedo','aa'].includes(g.weapon.cls))fail(at+'.weapon.cls','invalid weapon class');
      if(!['bullet','shell','missile','rocket','bomb','torpedo','flak','flame'].includes(g.weapon.projectile))fail(at+'.weapon.projectile','invalid projectile');
      if(!object(g.costs)||Object.values(g.costs).some(v=>!Number.isFinite(v)||v<0||v>1000000000))fail(at+'.costs','invalid local ammunition cost');
      if(!Array.isArray(g.mutators)||g.mutators.length>32)fail(at+'.mutators','invalid source damage mutators');
      else for(const m of g.mutators){if(!object(m)||!Array.isArray(m.tags)||m.tags.some(t=>typeof t!=='string'))fail(at+'.mutators','invalid source tags');else{number(m.direct,at+'.mutators.direct',0,1000000000);number(m.area,at+'.mutators.area',0,1000000000);}}
    }
    for(const key of ['initial'])if(!object(raw[key])||Object.entries(raw[key]).some(([k,v])=>!/^\w{1,64}$/.test(k)||['__proto__','constructor','prototype'].includes(k)||!Number.isFinite(v)||v<0||v>1e12))fail(path+'.'+key,'invalid local stock');
    if(raw.wreck&&context?.spriteKeys&&!context.spriteKeys.has(raw.wreck))fail(path+'.wreck','missing source wreck sheet');
    if(raw.construction){if(!Array.isArray(raw.construction)||raw.construction.length>128)fail(path+'.construction','invalid crane build list');else for(const a of raw.construction){if(!object(a)||typeof a.unit!=='string'||!Array.isArray(a.name)||a.name.length!==3)fail(path+'.construction','invalid construction entry');else{number(a.cost,path+'.construction.cost',0,99999);number(a.time,path+'.construction.time',0,3600);}}number(raw.buildRange,path+'.buildRange',0,10000);}
    const actions=new Set();
    for(const [i,a] of raw.actions.entries()) {
      const at=path+`.actions[${i}]`;
      if(!object(a)||typeof a.id!=='string'||actions.has(a.id)){fail(at,'invalid action');continue;}
      actions.add(a.id);
      if(!Array.isArray(a.name)||a.name.length!==3||a.name.some(s=>typeof s!=='string'||!s))fail(at+'.name','English, Chinese and Korean labels required');
      for(const key of ['time','cost','cooldown'])number(a[key],at+'.'+key,0,100000000);
      if(a.gun&&!guns.has(a.gun))fail(at+'.gun','missing action gun');
      if(a.spawns&&(!Array.isArray(a.spawns)||a.spawns.length>32||a.spawns.some(s=>!object(s)||!Number.isInteger(s.count)||s.count<1||s.count>50)))fail(at+'.spawns','invalid spawn batch');
    }
    return structuredClone(raw);
  }
  function references(def, table, path, issues,forms) {
    const c=def.extensions?.[id];if(!c)return;
    const ids=[...c.startCargo,...c.actions.flatMap(a=>a.spawns??[])].map(s=>s.unit);
    ids.push(...(c.construction??[]).map(a=>a.unit));
    if(c.reactorForms)ids.push(...c.reactorForms,...c.transitions.map(t=>t.to),...c.actions.flatMap(a=>[a.temporaryMorph,a.returnMorph].filter(Boolean)));
    for(const ref of ids)if(!table[ref]||ref.slice(0,14)!=='naval-warfare-')issues.push({path,message:'missing or foreign package reference: '+ref});
    for(const ref of ids)if(table[ref]?.kind==='unit')forms?.add(ref);
    for(const m of c.mounts){const seen=new Set([m.id]);let p=m.parent;while(p){if(seen.has(p)){issues.push({path,message:'cyclic turret attachment'});break;}seen.add(p);p=c.mounts.find(x=>x.id===p)?.parent;}}
  }
  return {capabilities:[{id,definition:read,references}]};
}
