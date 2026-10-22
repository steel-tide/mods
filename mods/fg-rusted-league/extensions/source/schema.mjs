export default function () {
  const id='fg-rusted-league.source-v1';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function definition(raw,path,issues,context) {
    const fail=(key,message)=>issues.push({path:path+(key?'.'+key:''),message});
    const number=(v,key,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(key,'invalid bounded number');};
    if(!object(raw)){fail('','expected source configuration');return;}
    for(const k of Object.keys(raw))if(!['energy','reloadTime','reloadSound','selectSound','wreck','decay','dockRecharge','mineLayer','mine'].includes(k))fail(k,'unknown source field');
    if(raw.mineLayer!==undefined){const m=raw.mineLayer;
      if(!object(m))fail('mineLayer','expected mine deployment configuration');
      else {
        for(const k of Object.keys(m))if(!['unit','cost','energy'].includes(k))fail('mineLayer.'+k,'unknown deployment field');
        if(!context?.defIds?.has(m.unit))fail('mineLayer.unit','missing mine definition');
        number(m.cost,'mineLayer.cost',0,99999);number(m.energy,'mineLayer.energy',.001,raw.energy?.max??0);
        if(!raw.energy)fail('mineLayer','requires energy');
      }
    }
    if(raw.mine!==undefined){const m=raw.mine;
      if(!object(m))fail('mine','expected mine configuration');
      else {
        for(const k of Object.keys(m))if(!['speed','targetSpeed','life','directDamage'].includes(k))fail('mine.'+k,'unknown mine field');
        number(m.speed,'mine.speed',1,5000);number(m.targetSpeed,'mine.targetSpeed',m.speed,5000);
        number(m.life,'mine.life',.01,3600);number(m.directDamage,'mine.directDamage',0,100000);
      }
    }
    for(const k of ['reloadSound','selectSound'])if(raw[k]!==undefined&&(!context?.assetIds?.has(raw[k])))fail(k,'missing installed recording');
    if(raw.wreck!==undefined&&!context?.spriteKeys?.has(raw.wreck))fail('wreck','missing wreck sprite');
    if(raw.decay!==undefined)number(raw.decay,'decay',0,1e6);
    if(raw.reloadTime!==undefined){number(raw.reloadTime,'reloadTime',0.001,3600);if(!raw.energy)fail('reloadTime','requires energy');}
    if(raw.dockRecharge!==undefined&&(typeof raw.dockRecharge!=='boolean'||!raw.energy))fail('dockRecharge','requires boolean and energy');
    if(raw.energy!==undefined){const e=raw.energy;
      if(!object(e)){fail('energy','expected energy configuration');return;}
      for(const k of Object.keys(e))if(!['max','start','regen','recharge','full','usage'].includes(k))fail('energy.'+k,'unknown energy field');
      number(e.max,'energy.max',0.001,1e8);number(e.start,'energy.start',0,1);number(e.regen,'energy.regen',0,1e8);number(e.recharge,'energy.recharge',0,1e8);
      if(typeof e.full!=='boolean')fail('energy.full','expected boolean');
      if(!object(e.usage)||Object.keys(e.usage).length>8)fail('energy.usage','expected weapon energy costs');
      else for(const [key,cost]of Object.entries(e.usage)){if(!context?.weaponIds?.includes(key))fail('energy.usage.'+key,'missing weapon');number(cost,'energy.usage.'+key,0.001,e.max);}
    }
    return structuredClone(raw);
  }
  function references(def,table,path,issues) {
    const c=def.extensions?.[id];if(!c)return;
    const fail=message=>issues.push({path:path+'.extensions.'+id,message});
    if(c.mine&&(def.kind!=='building'||def.mine===undefined||def.weapons.length!==1||def.weapons[0].dmg<=0))fail('mine requires a native mine base and one damaging weapon');
    if(c.mineLayer&&!table[c.mineLayer.unit]?.extensions?.[id]?.mine)fail('deployment must name a source mine');
    if(c.mine&&c.mineLayer)fail('a mine cannot lay mines');
  }
  return {capabilities:[{id,definition,references}]};
}
