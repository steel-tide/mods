export default function () {
  const id='fg-rusted-league.source-v1';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function definition(raw,path,issues,context) {
    const fail=(key,message)=>issues.push({path:path+(key?'.'+key:''),message});
    const number=(v,key,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(key,'invalid bounded number');};
    if(!object(raw)){fail('','expected source configuration');return;}
    for(const k of Object.keys(raw))if(!['energy','reloadTime','reloadSound','selectSound','wreck','decay','dockRecharge'].includes(k))fail(k,'unknown source field');
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
  return {capabilities:[{id,definition}]};
}
