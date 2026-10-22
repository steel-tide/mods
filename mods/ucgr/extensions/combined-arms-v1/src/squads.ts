import { canCarry, cmdBoard, contentRuntime, getDef, newEnt, normAngle, setEntityDef, turnToward } from './host';
import type { Ent } from '../../../../../../steel-tide/game/core/src/game/state';
import type { Game } from '../../../../../../steel-tide/game/core/src/game/sim';
import type { EngineModuleInstance, Json, ModuleHost, ModuleAction } from '../../../../../../steel-tide/game/core/src/game/extensions/contracts';
import { SQUADS_ID, type SquadDef, type SquadWeapon } from './squadsSpec';
import { record } from './sensorsSpec';
interface Group {
  members: number[]; created: number; scan: number; regen: number; morale: number;
  rushUntil: number; rushReady: number; chaotic: boolean; angle: number;
  job?: { trench: boolean; ready: number };
}
interface Soldier { parent: number; highMorale: boolean; searchingUntil: number; scan: number; destination?: number; boardUntil?: number }
const readers=new WeakMap<Game,(e:Ent)=>boolean>();
export function squadEntrenched(game:Game,e:Ent):boolean{return readers.get(game)?.(e)??false;}
export function createSquadsModule(host:ModuleHost):EngineModuleInstance {
  const st=host.game.st,groups=new Map<number,Group>(),soldiers=new Map<number,Soldier>(),disabled=new Set<number>(),committed=new Map<number,{x:number;y:number;angle:number}>();
  const cfg=(e:Ent|undefined)=>e?host.config<SquadDef>(getDef(e.defId)):undefined;
  const alive=(e:Ent|undefined):e is Ent=>!!e&&!e.dead&&!e.inside&&!e.site;
  const members=(g:Group)=>g.members.map(id=>st.ents.get(id)).filter(alive);
  const sourceTags=(e:Ent)=>(getDef(e.defId).extensions?.['usgr-re.targeting-v1'] as {tags?:string[]}|undefined)?.tags??[];
  const parent=(e:Ent)=>st.ents.get(soldiers.get(e.id)?.parent??0);
  readers.set(host.game,e=>{const p=parent(e);return !!(p&&cfg(p)?.controller?.entrenched);});
  function group(e:Ent):Group {
    let s=groups.get(e.id);
    if(!s){s={members:[],created:st.time,scan:st.time,regen:st.time,morale:60,rushUntil:0,rushReady:0,chaotic:false,angle:e.angle};groups.set(e.id,s);}
    return s;
  }
  function detach(e:Ent,search=0):void {
    const s=soldiers.get(e.id);if(s?.parent){const g=groups.get(s.parent);if(g)g.members=g.members.filter(id=>id!==e.id);s.parent=0;s.searchingUntil=search;}
  }
  function remove(e:Ent):void {
    const g=groups.get(e.id);if(g)for(const member of members(g))detach(member);
    groups.delete(e.id);e.dead=true;st.ents.delete(e.id);host.game.recomputePop();
  }
  function attach(e:Ent,p:Ent):void {
    const s=group(p),c=cfg(p)?.controller;if(!c||s.members.length>=c.capacity)return;
    detach(e);s.members.push(e.id);soldiers.set(e.id,{parent:p.id,highMorale:soldiers.get(e.id)?.highMorale??false,searchingUntil:0,scan:st.time+1});
    e.orders=[];e.path=null;
  }
  function position(p:Ent,s:Group):void {
    const c=cfg(p)?.controller;if(!c)return;
    const turn=normAngle(p.angle-s.angle),a=p.angle+Math.PI/2;
    for(let i=0;i<s.members.length;i++){
      const e=st.ents.get(s.members[i]);if(!alive(e))continue;
      const pos=c.positions[i];if(!pos)continue;
      e.x=p.x+pos.x*Math.cos(a)-pos.y*Math.sin(a);e.y=p.y+pos.x*Math.sin(a)+pos.y*Math.cos(a);
      e.angle=normAngle(e.angle+turn);
    }
    s.angle=p.angle;
  }
  function nearestGroup(e:Ent,trench=false):Ent|undefined {
    let found:Ent|undefined,distance=trench?80:40;
    for(const [id,g]of groups){const p=st.ents.get(id),c=p&&cfg(p)?.controller;if(!alive(p)||p.owner!==e.owner||!c||c.entrenched!==trench||g.members.length>=c.capacity)continue;
      const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<=distance){found=p;distance=d;}}
    return found;
  }
  function nearestVehicle(e:Ent,range=80):Ent|undefined {
    let found:Ent|undefined,distance=range;
    for(const t of st.ents.values()){
      const d=getDef(t.defId);
      if(!alive(t)||t.owner!==e.owner||t.id===e.id||cfg(t)?.controller||!d.transportCap||!canCarry(st,t,getDef(cfg(e)?.controller?members(group(e))[0]?.defId??e.defId:e.defId)))continue;
      const n=Math.hypot(t.x-e.x,t.y-e.y);if(n<=distance){found=t;distance=n;}
    }
    return found;
  }
  const ui=(id:string,label:string[],enabled=true):ModuleAction=>({id,label,enabled});
  const module:EngineModuleInstance={id:SQUADS_ID,
    beforeStep(){
      committed.clear();
      for(const e of host.participants())if(alive(e)&&cfg(e)?.controller)group(e);
      for(const [id,g]of groups){
        const p=st.ents.get(id);if(!p||p.dead){for(const e of members(g))detach(e);groups.delete(id);continue;}if(!alive(p))continue;
        const c=cfg(p)!.controller!;g.members=g.members.filter(id=>alive(st.ents.get(id)));
        if(disabled.has(p.owner)){remove(p);continue;}
        if(g.job&&st.time+1e-9>=g.job.ready){setEntityDef(p,g.job.trench?c.trench:c.mobile);if(!g.job.trench)g.chaotic=true;delete g.job;p.path=null;}
        if(st.time+1e-9<g.scan)continue;g.scan=st.time+8/60;
        if(g.morale<60&&st.time-g.regen>1){g.morale+=2+members(g).filter(e=>sourceTags(e).includes('特战')).length;g.regen=st.time;}
        if(g.morale<20)g.chaotic=true;else if(!sourceTags(p).includes('烟雾隐蔽'))g.chaotic=false;
        if(g.rushUntil&&st.time>g.rushUntil){g.rushUntil=0;g.rushReady=st.time+30;}
        for(const e of members(g)){
          const s=soldiers.get(e.id)!;if(g.morale>60)s.highMorale=true;else if(g.morale<40)s.highMorale=false;
          if(!p.targetId&&!e.targetId)e.angle=turnToward(e.angle,p.angle,getDef(e.defId).turnRate*8/60);
        }
        if(!g.members.length&&st.time-g.created>1){remove(p);continue;}
        // Source regrouping releases living members; their next search chooses
        // an existing incomplete group, never spawns replacement soldiers.
        if(!c.entrenched&&!p.orders.length&&g.members.length<c.capacity&&[...groups].some(([other,h])=>other!==id&&st.ents.get(other)?.owner===p.owner&&h.members.length<(cfg(st.ents.get(other)!)?.controller?.capacity??0)&&Math.hypot(st.ents.get(other)!.x-p.x,st.ents.get(other)!.y-p.y)<=40)
          &&![...st.ents.values()].some(e=>alive(e)&&st.players[e.owner]?.team!==st.players[p.owner]?.team&&Math.hypot(e.x-p.x,e.y-p.y)<=120))remove(p);
      }
      for(const e of host.participants()){
        const c=cfg(e)?.member;if(!c||!alive(e)||disabled.has(e.owner))continue;
        let s=soldiers.get(e.id);if(!s){s={parent:0,highMorale:false,searchingUntil:0,scan:st.time};soldiers.set(e.id,s);}
        if(s.destination){
          const destination=st.ents.get(s.destination);
          if(!alive(destination)||!e.orders.some(o=>o.kind==='board')||st.time>(s.boardUntil??0)){e.orders=e.orders.filter(o=>o.kind!=='board');delete s.destination;delete s.boardUntil;}
          else continue;
        }
        if(st.time<s.scan)continue;s.scan=st.time+1;
        if(s.parent||st.time<s.searchingUntil||e.orders[0]?.kind==='board'||sourceTags(e).includes('架设')
          ||(contentRuntime(host.game)?.module('articulation-v1')?.render?.(e) as {parentId?:number}|undefined)?.parentId)continue;
        let p=nearestGroup(e);
        if(!p){p=newEnt(st,c.controller,e.owner,e.x,e.y);p.angle=e.angle;group(p);}
        attach(e,p);
      }
    },
    wrapUnitStep(next){return(e,def,dt)=>{
      const c=cfg(e),s=soldiers.get(e.id),p=s?.parent?st.ents.get(s.parent):undefined;
      if(p&&alive(p)){
        const orders=e.orders;
        if(p.targetId&&st.ents.has(p.targetId)&&host.visible(st.ents.get(p.targetId)!,st.players[e.owner].team)){e.orders=[{kind:'attack',targetId:p.targetId}];}
        next(e,def,dt);e.orders=orders;return;
      }
      if(c?.controller){
        const first=e.orders[0];
        if(first?.kind==='attack'){
          const target=st.ents.get(first.targetId);e.targetId=alive(target)&&host.visible(target,st.players[e.owner].team)?target.id:0;
          if(!e.targetId){e.orders.shift();next(e,def,dt);return;}
          const orders=e.orders;e.orders=[];next(e,def,dt);e.orders=orders;e.targetId=target!.id;return;
        }
      }
      next(e,def,dt);
      if(c?.controller)committed.set(e.id,{x:e.x,y:e.y,angle:e.angle});
    };},
    wrapBoardPassenger(next){return(e,p,rearming)=>{
      const c=cfg(p)?.controller;
      if(c?.entrenched){if(cfg(e)?.member&&e.owner===p.owner&&group(p).members.length<c.capacity)attach(e,p);return;}
      next(e,p,rearming);
    };},
    effectiveDef(e,def){
      const s=soldiers.get(e.id),p=s?.parent?st.ents.get(s.parent):undefined;
      if(p&&alive(p)){return {...def,speed:0,weapons:s!.highMorale?def.weapons.map(w=>({...w,dmg:w.dmg*1.2,reload:w.reload*.8})):def.weapons,vision:def.vision};}
      const c=cfg(e)?.controller;if(!c)return def;const g=group(e);
      return {...def,vision:Math.max(0,...members(g).map(e=>getDef(e.defId).vision)),speed:c.entrenched||g.job?0:g.chaotic?2.4:g.rushUntil?30:18,weapons:[]};
    },
    canFire(e){const p=parent(e);return !p||!p.holdFire;},
    wrapDamage(next){return(...args)=>{if(cfg(args[1])?.controller)return;next(...args);};},
    filterVisibility(e,team,visible){return cfg(e)?.controller&&!cfg(e)!.controller!.entrenched&&st.players[e.owner]?.team!==team?false:visible;},
    onDamage(context){
      const s=soldiers.get(context.target.id),g=s?.parent?groups.get(s.parent):undefined;if(!g)return;
      const split=context.gun.lastIndexOf('/'),d=split>0?getDef(context.gun.slice(0,split)):undefined;
      const weapon=d?.weapons.find(w=>w.id===context.gun.slice(split+1));const loss=weapon?host.config<SquadWeapon>(weapon)?.moraleLoss??0:0;
      g.morale=Math.max(0,g.morale-loss);
    },
    afterEntities(){for(const [id,s]of groups){const p=st.ents.get(id);if(alive(p))position(p,s);}},
    afterStep(){for(const [id,s]of groups){const p=st.ents.get(id);if(alive(p)){const pose=committed.get(id);if(pose)Object.assign(p,pose);position(p,s);}}for(const id of soldiers.keys())if(!st.ents.has(id)||st.ents.get(id)!.dead)soldiers.delete(id);},
    allowOrder(e,order){if(cfg(e)?.controller)return false;if(order.kind==='board')detach(e,st.time+5);return true;},
    actions(e){
      const c=cfg(e);if(!alive(e))return[];
      if(c?.settings)return[ui('toggle',[disabled.has(e.owner)?'Enable squads':'Disable squads',disabled.has(e.owner)?'开启班组':'关闭班组',disabled.has(e.owner)?'분대 활성화':'분대 비활성화'])];
      if(!c?.controller)return[];const g=group(e);
      if(g.job)return[];
      return [ui('stop',['Stop moving','停止移动','이동 중지']),ui('rush',['Rush','冲刺','돌진'],!c.controller.entrenched&&!g.chaotic&&!g.rushUntil&&st.time>=g.rushReady),
        ui('weapons',e.holdFire?['Enable Weapons','允许开火','사격 허용']:['Disable Weapons','禁止开火','사격 금지']),
        ui('trench',c.controller.entrenched?['Exit trench','退出战壕','참호에서 나오기']:['Dig trench','挖掘战壕','참호 파기']),
        ui('vehicle',['Get in Vehicle','进入载具','차량 탑승'],!!nearestVehicle(e)),ui('enter-trench',['Get in Trench','进入战壕','참호 진입'],!!nearestGroup(e,true))];
    },
    order(order){let accepted=false;for(const id of order.ids){const e=st.ents.get(id);if(!alive(e)||e.owner!==order.owner)continue;const c=cfg(e);if(!c)continue;
      if(c.settings&&order.action==='toggle'){disabled.has(e.owner)?disabled.delete(e.owner):disabled.add(e.owner);accepted=true;continue;}
      if(!c.controller)continue;const g=group(e);if(g.job)continue;
      if(order.action==='stop'){e.orders=[];e.path=null;accepted=true;}
      else if(order.action==='weapons'){e.holdFire=!e.holdFire;accepted=true;}
      else if(order.action==='rush'&&!c.controller.entrenched&&!g.chaotic&&!g.rushUntil&&st.time>=g.rushReady){g.rushUntil=st.time+10;accepted=true;}
      else if(order.action==='trench'){g.job={trench:!c.controller.entrenched,ready:st.time+(c.controller.entrenched?c.controller.exitTime:c.controller.digTime)};accepted=true;}
      else if(order.action==='vehicle'){const vehicle=nearestVehicle(e);if(vehicle){for(const member of members(g)){detach(member,st.time+5);cmdBoard(host.game,[member.id],vehicle.id);}accepted=true;}}
      else if(order.action==='enter-trench'){const trench=nearestGroup(e,true);if(trench){for(const member of members(g)){if(group(trench).members.length>=cfg(trench)!.controller!.capacity)break;detach(member,st.time+10);cmdBoard(host.game,[member.id],trench.id);const state=soldiers.get(member.id)!;state.destination=trench.id;state.boardUntil=st.time+10;}accepted=true;}}
    }return accepted;},
    inspect(e,privateView){const s=groups.get(e.id),c=cfg(e)?.controller;if(!privateView||!s||!c)return[];return [{id:'members',label:['Soldiers','士兵','병사'],value:members(s).length},{id:'morale',label:['Morale','士气','사기'],value:s.morale,tone:s.morale<20?'danger':s.morale<40?'warning':'normal'}];},
    render(e){const c=cfg(e)?.controller;if(c)return{mounts:[],attachments:(groups.get(e.id)?.members??[]).map((childId,slot)=>({slot:String(slot),childId})),squad:!c.entrenched,fixedBody:c.entrenched?{y:c.groundOffset}:undefined};const p=parent(e);if(p)return{mounts:[],attachments:[],squad:false,parentId:p.id,selectParent:true};},
    snapshot(view){return {disabled:[...disabled].filter(id=>!view||view.player===id),groups:[...groups].filter(([id])=>!view||view.privateEntity(id)),soldiers:[...soldiers].filter(([id,s])=>!view||view.privateEntity(id)||view.visibleEntities.has(id)&&view.visibleEntities.has(s.parent)).map(([id,s])=>[id,!view||view.privateEntity(id)?s:{parent:s.parent}])} as unknown as Json;},
    restore(value){
      if(!record(value)||!Array.isArray(value.groups)||!Array.isArray(value.soldiers)||!Array.isArray(value.disabled))throw Error('Invalid source squads');
      const nextGroups=new Map<number,Group>(),nextSoldiers=new Map<number,Soldier>();
      const finite=(v:unknown,min=0,max=1e10):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
      for(const row of value.groups){if(!Array.isArray(row)||row.length!==2||!Number.isSafeInteger(row[0])||!record(row[1]))throw Error('Invalid squad');const [id,s]=row,e=st.ents.get(id),c=e&&cfg(e)?.controller;
        if(!c||nextGroups.has(id)||!Array.isArray(s.members)||s.members.length>c.capacity||new Set(s.members).size!==s.members.length||!s.members.every(id=>Number.isSafeInteger(id)&&id!==e!.id&&st.ents.get(id)?.owner===e!.owner)||![s.created,s.scan,s.regen,s.rushUntil,s.rushReady].every(v=>finite(v))||!finite(s.morale,0,100)||!finite(s.angle,-1e6,1e6)||typeof s.chaotic!=='boolean')throw Error('Invalid squad state');
        if(s.job!==undefined&&(!record(s.job)||typeof s.job.trench!=='boolean'||!finite(s.job.ready,0,st.time+600)))throw Error('Invalid trench queue');
        nextGroups.set(id,JSON.parse(JSON.stringify(s)) as Group);
      }
      for(const row of value.soldiers){if(!Array.isArray(row)||row.length!==2||!Number.isSafeInteger(row[0])||!record(row[1]))throw Error('Invalid squad soldier');const [id,s]=row,e=st.ents.get(id);
        if(Object.keys(s).length===1&&Number.isSafeInteger(s.parent)&&s.parent&&cfg(st.ents.get(s.parent as number))?.controller&&st.ents.get(s.parent as number)?.owner===e?.owner){nextSoldiers.set(id,{parent:s.parent as number,highMorale:false,searchingUntil:0,scan:st.time});continue;}
        if(!e||!cfg(e)?.member||nextSoldiers.has(id)||!Number.isSafeInteger(s.parent)||typeof s.highMorale!=='boolean'||!finite(s.searchingUntil)||!finite(s.scan)||s.destination!==undefined&&(!Number.isSafeInteger(s.destination)||!cfg(st.ents.get(s.destination as number)!)?.controller?.entrenched||!finite(s.boardUntil))||s.parent&&!nextGroups.get(s.parent as number)?.members.includes(id))throw Error('Invalid squad membership');
        nextSoldiers.set(id,{parent:s.parent as number,highMorale:s.highMorale,searchingUntil:s.searchingUntil,scan:s.scan as number,...(s.destination?{destination:s.destination as number,boardUntil:s.boardUntil as number}:{})});
      }
      for(const [id,g]of nextGroups)for(const member of g.members)if(nextSoldiers.get(member)?.parent!==id)throw Error('Inconsistent squad membership');
      if(!value.disabled.every(id=>Number.isSafeInteger(id)&&st.players[id as number]))throw Error('Invalid squad setting');
      groups.clear();soldiers.clear();disabled.clear();for(const [id,s]of nextGroups)groups.set(id,s);for(const [id,s]of nextSoldiers)soldiers.set(id,s);for(const id of value.disabled)disabled.add(id as number);
    },dispose(){groups.clear();soldiers.clear();disabled.clear();readers.delete(host.game);}
  };return module;
}
