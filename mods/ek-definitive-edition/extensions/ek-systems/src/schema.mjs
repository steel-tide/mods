// Strict data boundary for this mod's compiled RW subset. Never executes source expressions.
export default function () {
  const id='ek-definitive-edition.systems-v1';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const defaults={armor:0,minDamage:1,energyMax:0,energyRegen:0,energyStart:1,cargoHeal:0,regen:0,capacity:0,fullRecharge:false,airCargo:false,dieOnZeroEnergy:false,immortal:false,zeroHpAlive:false,singleSlot:false,triggerInterval:1,unloadCondition:['lit',true],initial:{},rearm:[],startCargo:[],targetTags:[],tags:[],shared:[],mounts:[],guns:[],actions:[],attachments:[]};
  const mountDefaults={x:0,y:0,parent:'',slave:false,rest:0,arc:Math.PI,turn:0,spin:0,recoil:0,recoilOut:0,recoilReturn:0};
  const gunDefaults={range:1,minRange:0,reload:1,warmup:0,costs:{},direct:0,area:0,radius:0,ignoreArmor:0,buildingMult:1,shieldMult:1,mutators:[],life:10,targetSpeed:1,acceleration:0,turnSpeed:Math.PI*60,spread:0,intercept:[],tags:[],nuclear:false,friendlyFire:false,bothLayers:false,noFalloff:false,linked:'',muzzle:0,lateral:0,manual:false,predicate:['lit',true],onShoot:[]};
  const actionDefaults={time:0,cost:0,stocks:{},cooldown:0,canCancel:true,queue:true,lock:false,ai:true,tag:'',hidden:false,effects:[],desc:['','','']};
  function read(raw,path,issues,context){const fail=(at,message)=>issues.push({path:at,message});
    if(!object(raw)){fail(path,'Expected EK configuration');return;}
    let nodes=0;
    function safe(v,at,depth=0){if(++nodes>60000||depth>40){fail(at,'Configuration exceeds structural budget');return;}
      if(typeof v==='number'&&!Number.isFinite(v))fail(at,'Non-finite number');
      else if(Array.isArray(v)){if(v.length>1024)fail(at,'List exceeds 1024 entries');for(const x of v)safe(x,at,depth+1);}
      else if(object(v)){for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail(at,'Unsafe key');safe(x,at+'.'+k,depth+1);}}
      else if(!['undefined','string','boolean','number'].includes(typeof v)&&v!==null)fail(at,'Not JSON data');
    }safe(raw,path);
    const c={...structuredClone(defaults),...structuredClone(raw)};
    for(const k of ['mounts','guns','actions','attachments','tags','shared'])if(!Array.isArray(c[k])){fail(path+'.'+k,'Expected list');return;}
    for(const k of ['armor','minDamage','energyMax','energyStart','cargoHeal','regen','capacity','triggerInterval'])if(!Number.isFinite(c[k])||c[k]<0||c[k]>1e12)fail(path+'.'+k,'Invalid nonnegative statistic');
    if(!Number.isFinite(c.energyRegen)||Math.abs(c.energyRegen)>1e12)fail(path+'.energyRegen','Invalid energy regeneration');
    function sprite(key,at){if(key&&context?.spriteKeys&&!context.spriteKeys.has(key))fail(at,'Missing sprite '+key);}
    c.mounts=c.mounts.map(m=>({...mountDefaults,...m}));c.guns=c.guns.map(g=>({...structuredClone(gunDefaults),...g}));c.actions=c.actions.map(a=>({...structuredClone(actionDefaults),...a}));
    const mounts=new Set(),guns=new Set(),actions=new Set();
    for(const m of c.mounts){if(typeof m.id!=='string'||mounts.has(m.id))fail(path+'.mounts','Invalid or duplicate mount');mounts.add(m.id);sprite(m.sprite,path+'.mounts');
      for(const k of ['x','y','rest','arc','turn','spin','recoil','recoilOut','recoilReturn'])if(!Number.isFinite(m[k])||Math.abs(m[k])>1e7)fail(path+'.mounts.'+k,'Invalid mount geometry');}
    for(const m of c.mounts){if(m.parent&&!mounts.has(m.parent))fail(path+'.mounts','Missing parent '+m.parent);let p=m.parent;const seen=new Set([m.id]);while(p){if(seen.has(p)){fail(path+'.mounts','Cyclic mount');break;}seen.add(p);p=c.mounts.find(m=>m.id===p)?.parent;}}
    for(const g of c.guns){if(typeof g.id!=='string'||guns.has(g.id)||!mounts.has(g.mount)||!object(g.weapon)){fail(path+'.guns','Invalid gun');continue;}guns.add(g.id);
      for(const k of ['range','minRange','reload','warmup','direct','area','radius','life','targetSpeed','acceleration','turnSpeed'])if(!Number.isFinite(g[k])||g[k]<0||g[k]>1e12)fail(path+'.guns.'+k,'Invalid gun statistic');
      if(!Array.isArray(g.weapon.targets)||g.weapon.targets.some(x=>!['ground','ship','sub','air'].includes(x)))fail(path+'.guns','Invalid targets');
      if(!object(g.costs)||Object.values(g.costs).some(n=>typeof n!=='number'||!Number.isFinite(n)))fail(path+'.guns.costs','Invalid ammunition cost');
      sprite(g.weapon.look?.sprite,path+'.guns.weapon.look');
    }
    for(const a of c.actions){if(typeof a.id!=='string'||actions.has(a.id))fail(path+'.actions','Invalid action');actions.add(a.id);
      if(!Array.isArray(a.name)||a.name.length!==3||a.name.some(t=>typeof t!=='string'||!t))fail(path+'.actions.name','Requires English, Chinese and Korean labels');
      for(const k of ['time','cost','cooldown'])if(!Number.isFinite(a[k])||a[k]<0||a[k]>1e12)fail(path+'.actions.'+k,'Invalid action statistic');
      if(!Array.isArray(a.effects)||a.effects.length>64)fail(path+'.actions.effects','Invalid effect list');
      for(const f of a.effects??[])if(f.fire&&!guns.has(f.fire))fail(path+'.actions.effects','Missing gun '+f.fire);
    }
    sprite(c.back,path+'.back');sprite(c.wreck,path+'.wreck');return c;
  }
  function references(def,table,path,issues,forms){const c=def.extensions?.[id];if(!c)return;
    const refs=[];
    for(const a of c.actions)for(const f of a.effects){if(f.morph)refs.push(f.morph);if(f.spawn)refs.push(...f.spawn.map(s=>s.unit));}
    for(const a of c.attachments)refs.push(...a.spawn.map(s=>s.unit));for(const g of c.guns)refs.push(...(g.spawn??[]).map(s=>s.unit));
    for(const ref of refs){if(!table[ref]||!ref.startsWith('ek-'))issues.push({path,message:'Missing or foreign EK reference '+ref});if(table[ref]?.kind==='unit')forms?.add(ref);}
  }
  return {capabilities:[{id,definition:read,references}]};
}
