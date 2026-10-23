// All gameplay here belongs to this mod. Factories receive only the public host SDK.
export default function (sdk) {
  const ID='ek-definitive-edition.systems-v1';
  const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // RW buildings face up; Steel Tide raises them at angle 0.
  const facing=e=>sdk.getDef(e.defId)?.kind==='building'?-Math.PI/2:e.angle;
  const text={energy:['Energy','能量','에너지'],ammo:['Ammunition','弹药','탄약'],busy:['Action progress','操作进度','행동 진행'],
    launch:['Launch aircraft','放飞舰载机','함재기 출격'],recover:['Recover aircraft','回收飞机','항공기 회수'],cancel:['Cancel action','取消操作','행동 취소'],
    startTest:['Start specimen test','启动单位测试','표본 시험 시작'],pausedTest:['Specimen paused — start a test to run its scripts','展示已暂停：启动测试后运行单位脚本','표본 일시 정지 — 시험을 시작하면 스크립트가 실행됩니다']};
  function create(host) {
    const game=host.game, states=new Map(), rounds=new Map(), deaths=new Map(), publicMounts=new Map();
    let pending=null;const pendingCascades=[];
    // Native factories expose package actions for EK's multi-resource units.
    // The original native definition and its normal production remain intact.
    const adapters=new Map();
    for(const d of Object.values(sdk.DEFS)){
      const c=host.config(d);if(!c?.nativeProducers?.length)continue;
      for(const factory of c.nativeProducers){
        let a=adapters.get(factory);
        if(!a){a={adapter:true,initial:{},energyMax:0,energyStart:0,energyRegen:0,regen:0,cargoHeal:0,armor:0,minDamage:0,capacity:0,shared:c.shared,mounts:[],guns:[],actions:[],attachments:[],tags:[],triggerInterval:1};adapters.set(factory,a);}
        const name=[sdk.t('unit.'+d.id+'.name')];
        a.actions.push({id:'recruit-'+d.id,name:c.recruitName??name.concat(name,name),cost:(c.sourceCost.credits??0)*.1,stocks:Object.fromEntries(Object.entries(c.sourceCost).filter(([k])=>k!=='credits')),time:d.buildTime,cooldown:0,canCancel:true,queue:true,ai:true,effects:[{spawn:[{unit:d.id,count:1}],into:false}]});
      }
    }
    const cfg=e=>e?.defId?(host.config(sdk.getDef(e.defId))??adapters.get(e.defId)):undefined;
    const members=()=>[...host.participants(),...[...game.st.ents.values()].filter(e=>adapters.has(e.defId))];
    const alive=e=>e&&!e.dead;
    const priceLabel=a=>a.name.map((name,i)=>name+(a.spawns?' · '+a.spawns.map((s,j)=>(a.spawnNames?.[j]?.[i]??s.unit)+' ×'+s.count).join(', '):'')+(a.cost||a.time?' · '+Math.round(a.cost*100)/100+' '+['metal','金属','금속'][i]+' / '+Math.round(a.time*100)/100+['s','秒','초'][i]:''));
    const action=(c,id)=>c?.actions.find(a=>a.id===id);
    const fits=(stock,costs)=>Object.entries(costs??{}).every(([k,v])=>(stock[k]??0)+1e-8>=v);
    const take=(stock,costs)=>{for(const[k,v]of Object.entries(costs??{}))stock[k]=Math.max(0,(stock[k]??0)-v);};
    const ensure=e=>{
      const c=cfg(e);if(!c)return;
      let s=states.get(e.id);
      if(!s){s={definition:e.defId,stocks:{...c.initial,energy:c.energyMax*c.energyStart},guns:{},mounts:{},cooldowns:{},initialized:false,recharging:false,age:0,flags:{},tags:{},memory:{},queue:[],timer:0,triggerClock:0,incomeClock:0,children:{},empActive:false};states.set(e.id,s);}
      if(s.definition!==e.defId){s.definition=e.defId;s.stocks.energy=Math.min(c.energyMax,s.stocks.energy??c.energyMax);}
      for(const m of c.mounts) s.mounts[m.id]??={angle:facing(e)+m.rest,previous:facing(e)+m.rest};
      for(const g of c.guns) s.guns[g.id]??={cd:0,warm:0,target:0};
      return s;
    };
    function mountPose(e,c,s,id,visited=new Set()) {
      const m=c.mounts.find(m=>m.id===id);if(!m||visited.has(id))return{x:e.x,y:e.y,angle:facing(e)};
      visited.add(id);
      const parent=m.parent?mountPose(e,c,s,m.parent,visited):{x:e.x,y:e.y,angle:facing(e)};
      const a=parent.angle+Math.PI/2;
      const angle=s.mounts[id]?.angle??facing(e)+m.rest,age=game.st.time-(s.guns[id]?.firedAt??-1e9);
      const amount=m.recoilOut>0&&age<m.recoilOut?age/m.recoilOut:Math.max(0,1-(age-m.recoilOut)/Math.max(.001,m.recoilReturn));
      const recoil=(m.recoil??0)*amount;
      return{x:parent.x+m.x*Math.cos(a)-m.y*Math.sin(a)+Math.cos(angle)*recoil,y:parent.y+m.x*Math.sin(a)+m.y*Math.cos(a)+Math.sin(angle)*recoil,angle};
    }
    function rotateMounts(e,c,s,dt) {
      for(const m of c.mounts){const v=s.mounts[m.id];v.previous=v.angle;
        const parent=m.parent?s.mounts[m.parent]?.angle??facing(e):facing(e);
        // A mount trains on what its own gun is aiming at, else on what a gun
        // carried on it is: RW's aiming base (`canShoot: 0`) turns for the
        // barrels attached to it.
        const aiming=g=>!g.manual&&(alive(game.st.ents.get(s.guns[g.id]?.target))||!!s.guns[g.id]?.aim);
        const carried=id=>{for(let x=c.mounts.find(a=>a.id===id),k=0;x&&k<8;x=c.mounts.find(a=>a.id===x.parent),k++)if(x.parent===m.id)return true;return false;};
        const gun=c.guns.find(g=>g.mount===m.id&&aiming(g))||c.guns.find(g=>carried(g.mount)&&aiming(g))||c.guns.find(g=>g.mount===m.id);
        const unit=game.st.ents.get(gun?s.guns[gun.id]?.target:0),target=alive(unit)?unit:gun?s.guns[gun.id]?.aim:undefined;
        const pose=mountPose(e,c,s,m.id);
        let desired=target?Math.atan2(target.y-pose.y,target.x-pose.x):parent+m.rest;
        if(m.slave){v.angle=norm(parent+m.rest);continue;}
        const rel=Math.max(-m.arc,Math.min(m.arc,norm(desired-parent-m.rest)));
        desired=parent+m.rest+rel;
        if(m.spin&&!alive(target))v.angle=norm(v.angle+m.spin*dt);
        else if(m.turn===0)v.angle=norm(parent+m.rest);
        else{const delta=norm(desired-v.angle);v.angle=norm(v.angle+Math.sign(delta)*Math.min(Math.abs(delta),m.turn*dt));}
      }
    }
    // what the player ordered it at, an ally included: an attack order, or an emplacement's lock
    const ordered=e=>e.orders[0]?.kind==='attack'?e.orders[0].targetId:e.manualTargetId??0;
    function permitted(e,c,s,g,target) {
      if(!alive(target)||target.inside||target.id===e.id)return false;
      if(game.st.players[target.owner]?.team===game.st.players[e.owner]?.team&&target.id!==ordered(e))return false;
      if(!host.visible(target,game.st.players[e.owner].team))return false;
      const td=sdk.getDef(target.defId),cat=sdk.targetCat(game.st,target);
      if(!g.weapon.targets.includes(cat))return false;
      if(g.requiredTags?.length&&!g.requiredTags.some(tag=>(cfg(target)?.tags??[]).includes(tag)))return false;
      const dist=Math.hypot(target.x-e.x,target.y-e.y)-td.radius;
      if(dist>g.range*32||dist<(g.minRange??0)*32)return false;
      const m=c.mounts.find(m=>m.id===g.mount),parent=m.parent?s.mounts[m.parent]?.angle??facing(e):facing(e);
      const angle=Math.atan2(target.y-e.y,target.x-e.x);
      if(Math.abs(norm(angle-parent-m.rest))>m.arc+.01)return false;
      // A source runtime expression is never treated as an always-true predicate.
      if(!logic(g.predicate,e)||!logic(g.targetPredicates?.[cat],e))return false;
      const required=cfg(target)?.targetTags;if(required?.length&&!required.some(t=>tags(e).includes(t)))return false;
      return host.canFire(e,host.effectiveDef(e),g.weapon,target,target);
    }
    function choose(e,c,s,g) {
      // the player's order first, then the gun's lock, then what the unit has picked
      const order=game.st.ents.get(ordered(e));
      if(permitted(e,c,s,g,order))return order;
      const current=game.st.ents.get(s.guns[g.id].target);
      if(permitted(e,c,s,g,current))return current;
      const explicit=game.st.ents.get(e.orders[0]?.targetId??e.targetId);
      if(permitted(e,c,s,g,explicit))return explicit;
      if(c.passive===false)return null;
      let best=null,distance=Infinity;
      for(const t of game.st.ents.values())if(permitted(e,c,s,g,t)){
        const d=Math.hypot(t.x-e.x,t.y-e.y);if(d<distance){best=t;distance=d;}
      }
      return best;
    }
    // a shot the player forced, at a spot or at an ally, hurts its own side as the game's do;
    // what the guns choose for themselves, cascades and scripted strikes spare it, as RW's do
    let forcing=false;
    function fire(e,d,c,s,g,target,point,intercept,origin,depth=0) {
      const shot=g.alt&&logic(g.altCondition,e)?c.guns.find(a=>a.id===g.alt)??g:g;
      const pose=origin??mountPose(e,c,s,g.mount);
      const emitter={...e,x:pose.x,y:pose.y,angle:pose.angle,turretAngle:pose.angle};
      const weapon={...shot.weapon,muzzleOffset:g.muzzle,muzzlePoints:[{forward:g.muzzle,lateral:g.lateral+((s.guns[g.id]?.shots??0)%2?(g.oddOffset??0):0)}],turret:true,spread:g.spread,
        range:g.range,reload:g.reload,splash:Math.min(500,g.radius),friendlyFire:g.friendlyFire};
      pending={gun:shot,source:e.defId,intercept,depth,...(origin?{angle:origin.angle}:{}),...(forcing?{forced:true}:{})};
      try{host.fireShot(game.st,emitter,{...d,turretSprite:undefined,turretMounts:undefined},weapon,target,point??null);}finally{pending=null;}
      pay(e,g.costs);
      // flags cleared before set: `setFlag=1,unsetFlag=1-2` leaves flag 1 up
      if(g.flags?.unsetflag)add(e,{unsetflag:g.flags.unsetflag});
      if(g.flags?.setflag)add(e,{setflag:g.flags.setflag});
      if(c.fullRecharge&&s.stocks.energy<=1e-8)s.recharging=true;
      s.guns[g.id].cd=Math.max(1/60,g.reload-g.warmup);s.guns[g.id].warm=0;
      if(g.linked&&s.guns[g.linked])s.guns[g.id].linkStamp=s.guns[g.linked].firedAt;
      s.guns[g.id].firedAt=game.st.time;s.guns[g.id].shots=(s.guns[g.id].shots??0)+1;
      for(const name of g.onShoot??[]){const a=c.actions.find(a=>a.id==='hiddenAction_'+name||a.id==='action_'+name);if(a)perform(e,a);}
      if(c.suicide&&!g.manual&&!e.dead){sdk.kill(game.st,e);death(e);}
    }
    function hasSpace(e,c,batch) {
      const d=sdk.getDef(e.defId),cap=c.capacity??d.transportCap??0;
      const current=(e.cargo??[]).reduce((n,id)=>{const p=game.st.ents.get(id);return n+(alive(p)?(c.singleSlot||c.airCargo?1:sdk.cargoWeight(sdk.getDef(p.defId))):0);},0);
      const needed=batch.reduce((n,x)=>n+x.count*(c.singleSlot||c.airCargo?1:sdk.cargoWeight(sdk.getDef(x.unit))),0);
      return current+needed<=cap;
    }
    function planBatch(e,c,batch,inside) {
      const st=game.st;
      if(inside&&!hasSpace(e,c,batch))return null;
      const count=batch.reduce((n,x)=>n+x.count*sdk.getDef(x.unit).pop,0);
      const p=st.players[e.owner],used=[...st.ents.values()].filter(u=>alive(u)&&u.owner===e.owner).reduce((n,u)=>n+sdk.getDef(u.defId).pop,0);
      if(p.popCap!==undefined&&used+count>p.popCap)return null;
      const placements=[];
      for(const item of batch)for(let i=0;i<Math.min(item.count,item.maxSpawnLimit??Infinity);i++){
        if(item.spawnChance!==undefined&&game.st.rng.next()>item.spawnChance)continue;
        const d=sdk.getDef(item.unit);let spot;
        const ox=(item.offsetX??0)+(item.offsetRandomX?game.st.rng.range(-item.offsetRandomX,item.offsetRandomX):0),oy=(item.offsetY??0)+(item.offsetRandomY?game.st.rng.range(-item.offsetRandomY,item.offsetRandomY):0);
        if(inside||'offsetX'in item||'offsetY'in item||item.skipifoverlapping===false)spot={x:e.x+ox,y:e.y+oy};
        for(let j=0;j<96&&!spot;j++){
          const a=j*2.399963229728653,dist=sdk.getDef(e.defId).radius+d.radius+12+Math.floor(j/12)*16;
          const x=e.x+Math.cos(a)*dist,y=e.y+Math.sin(a)*dist;
          if(sdk.passable(st,d.domain,Math.floor(x/32),Math.floor(y/32))&&!placements.some(p=>Math.hypot(p.x-x,p.y-y)<d.radius*2)&&![...st.ents.values()].some(t=>alive(t)&&!t.inside&&sdk.getDef(t.defId).domain!=='air'&&d.domain!=='air'&&Math.hypot(t.x-x,t.y-y)<d.radius+sdk.getDef(t.defId).radius))spot={x,y};
        }
        if(!spot)return null;
        if(item.gridalign)spot={x:(Math.floor(spot.x/32)+.5)*32,y:(Math.floor(spot.y/32)+.5)*32};
        placements.push({...spot,item});
      }
      return placements;
    }
    function spawnBatch(e,c,batch,inside,plan) {
      plan??=planBatch(e,c,batch,inside);if(!plan)return false;
      const st=game.st;
      for(const {x,y,item} of plan){
        const angle=(item.alwaysstartdiratzero||item.alwaystartdiratzero?0:facing(e))+(item.offsetDir??0)+(item.offsetRandomDir?st.rng.range(-item.offsetRandomDir,item.offsetRandomDir):0);
        const u=sdk.newEnt(st,item.unit,e.owner,x,y,angle,'spawn');
        const childState=ensure(u);if(childState)childState.home=e.id;
        if(item.resources)add(u,item.resources);
        if(inside){u.inside=e.id;(e.cargo??=[]).push(u.id);}
        if(item.transportedUnitsToTransfer){const transfer=(e.cargo??[]).splice(0,item.transportedUnitsToTransfer);for(const id of transfer){const child=st.ents.get(id);if(alive(child)){child.inside=u.id;(u.cargo??=[]).push(id);}}}
      }
      return true;
    }
    function release(e,c) {
      let done=false,i=0;
      for(const id of [...(e.cargo??[])]){
        const u=game.st.ents.get(id);if(!alive(u)||sdk.getDef(u.defId).domain!=='air')continue;
        const angle=facing(e)+(i++%3-1)*.5;
        u.inside=undefined;u.x=u.prevX=e.x+Math.cos(angle)*(sdk.getDef(e.defId).radius+24);u.y=u.prevY=e.y+Math.sin(angle)*(sdk.getDef(e.defId).radius+24);
        e.cargo=e.cargo.filter(v=>v!==id);u.orders=[];sdk.cmdMove(game,[id],u.x+Math.cos(angle)*80,u.y+Math.sin(angle)*80);done=true;
      }
      return done;
    }
    function cascade(p,meta,phase){if(meta.depth>=64)return;const source=game.st.ents.get(p.src),c=host.config(sdk.getDef(meta.source));if(!source||!c)return;
      for(const item of meta.gun.cascade?.[phase]??[]){const opts=item.options,limit=opts.recursionlimit??3;if(meta.depth>=limit)continue;const g=c.guns.find(g=>g.id===item.gun);if(!g)continue;
        for(let n=0;n<item.count;n++){const angle=p.angle+(opts.offsetdir??0)*Math.PI/180+game.st.rng.range(-(opts.offsetrandomdir??0),opts.offsetrandomdir??0)*Math.PI/180;
          const x=p.x+(opts.xoffsetabsolute??0)*.75+(opts.xoffsetrelative??0)*.75*Math.cos(p.angle+Math.PI/2)+(opts.yoffsetrelative??0)*.75*Math.cos(p.angle)+game.st.rng.range(-(opts.offsetrandomxy??0),opts.offsetrandomxy??0)*.75;
          const y=p.y+(opts.yoffsetabsolute??0)*.75+(opts.xoffsetrelative??0)*.75*Math.sin(p.angle+Math.PI/2)+(opts.yoffsetrelative??0)*.75*Math.sin(p.angle)+game.st.rng.range(-(opts.offsetrandomxy??0),opts.offsetrandomxy??0)*.75;
          fire(source,sdk.getDef(meta.source),c,ensure(source),g,game.st.ents.get(p.targetId)??null,{x:p.tx,y:p.ty},undefined,{x,y,angle},meta.depth+1);
        }
      }
    }
    // a point the player is shelling (force fire, or the trigger under the helm):
    // what this gun would answer there, as the game's own guns do (`weaponCanBombard`)
    function bombards(st,e,c,s,g,point){
      const cat=sdk.groundAimCat(st,point);
      if(!g.weapon.targets.includes(cat)&&!g.weapon.targets.includes('air'))return false;
      const dist=Math.hypot(point.x-e.x,point.y-e.y);
      if(dist>g.range*32||dist<(g.minRange??0)*32)return false;
      const m=c.mounts.find(m=>m.id===g.mount),parent=m.parent?s.mounts[m.parent]?.angle??facing(e):facing(e);
      if(Math.abs(norm(Math.atan2(point.y-e.y,point.x-e.x)-parent-m.rest))>m.arc+.01)return false;
      return logic(g.predicate,e)&&logic(g.targetPredicates?.[cat],e)&&host.canFire(e,host.effectiveDef(e),g.weapon,point,null);
    }
    function stepGuns(st,e,d,dt,point){const c=cfg(e);if(!c||e.holdFire||e.site||e.dead||ensure(e).empActive)return;
        const s=ensure(e);
        for(const g of c.guns){const clock=s.guns[g.id];clock.cd=Math.max(0,clock.cd-dt);if(g.manual||s.recharging||!canPay(e,g.costs))continue;
          const anchor=g.linked&&s.guns[g.linked];
          if(anchor){if(anchor.firedAt===undefined||clock.linkStamp===anchor.firedAt||st.time-anchor.firedAt+1e-8<g.warmup)continue;}else if(clock.cd>0)continue;
          let intercepted;
          if(g.intercept.length)intercepted=st.projs.find(p=>!p.downed&&p.team!==st.players[e.owner].team&&Math.hypot(p.x-e.x,p.y-e.y)<=g.range*32&&g.intercept.some(tag=>rounds.get(p.id)?.gun.tags.includes(tag)||tag==='nuke'&&p.kind==='nuke'));
          if(intercepted){fire(e,d,c,s,g,null,{x:intercepted.x,y:intercepted.y},intercepted.id);continue;}
          const shelling=!!point&&bombards(st,e,c,s,g,point);
          const t=shelling?{x:point.x,y:point.y}:choose(e,c,s,g);
          if(!t){clock.target=0;delete clock.aim;clock.warm=0;continue;}
          if(shelling){if(clock.target||clock.aim?.x!==t.x||clock.aim?.y!==t.y)clock.warm=0;clock.target=0;clock.aim=t;}
          else{if(clock.target!==t.id)clock.warm=0;clock.target=t.id;delete clock.aim;}
          clock.warm+=dt;
          // a slave barrel is aimed by the turret it follows, from that
          // turret's ring; a barrel that cannot turn is aimed by the hull
          const mount=c.mounts.find(a=>a.id===g.mount),pose=mountPose(e,c,s,g.mount);
          let aim=pose.angle,master=mount;for(let k=0;master?.slave&&k<8;k++){aim-=master.rest;master=c.mounts.find(a=>a.id===master.parent)??null;}
          const from=!mount?.slave?(mount&&!mount.turn&&!mount.spin&&!mount.parent?e:pose):master?mountPose(e,c,s,master.id):e;
          const bearing=Math.atan2(t.y-from.y,t.x-from.x);
          if(!anchor&&clock.warm+1e-8<g.warmup||Math.abs(norm(bearing-aim))>(g.maxAngle??.3))continue;
          forcing=shelling||game.st.players[t.owner]?.team===game.st.players[e.owner].team;
          try{if(shelling)fire(e,d,c,s,g,null,t);else fire(e,d,c,s,g,t);}finally{forcing=false;}
        }
    }
    const teams=new Map();
    const showcase=createShowcase(sdk,host,teams);
    const team=e=>{let v=teams.get(e.owner);if(!v){v={};teams.set(e.owner,v);}return v;};
    function stock(e,key){key=key.toLowerCase();
      if(key==='credits')return game.st.players[e.owner].metal/.1;
      if(key==='hp')return e.hp;if(key==='shield')return e.rs?.shield??0;
      const s=ensure(e);if(!s)return 0;
      return cfg(e).shared.includes(key)?team(e)[key]??0:s.stocks[key]??0;
    }
    function setStock(e,key,value){key=key.toLowerCase();value=Math.max(0,value);
      if(key==='credits'){game.st.players[e.owner].metal=value*.1;return;}
      if(key==='hp'){e.hp=Math.min(sdk.maxHp(e),value);if(e.hp<=0&&!cfg(e)?.zeroHpAlive){sdk.kill(game.st,e);if(cfg(e))death(e);}else if(e.hp<=0)e.hp=1;return;}
      if(key==='shield'){e.rs??={};e.rs.shield=Math.min(sdk.getDef(e.defId).shield?.hp??0,value);return;}
      const s=ensure(e);if(!s)return;
      if(key==='energy')value=Math.min(cfg(e).energyMax,value);
      (cfg(e).shared.includes(key)?team(e):s.stocks)[key]=value;
    }
    const canPay=(e,costs)=>Object.entries(costs??{}).every(([k,v])=>typeof v==='number'&&stock(e,k)+1e-8>=v);
    function add(e,delta){const s=ensure(e);if(!s)return;
      for(const[k,v]of Object.entries(delta??{})){
        if(k==='setflag'||k==='unsetflag'){for(const flag of v){if(k==='setflag')s.flags[flag]=true;else delete s.flags[flag];}}
        else setStock(e,k,stock(e,k)+v);
      }
    }
    const pay=(e,costs)=>{for(const[k,v]of Object.entries(costs??{}))setStock(e,k,stock(e,k)-v);};
    const tags=e=>[...(cfg(e)?.tags??[]),...Object.keys(states.get(e?.id)?.tags??{})].filter(t=>states.get(e?.id)?.tags?.[t]!==false);
    const parentOf=e=>game.st.ents.get(states.get(e?.id)?.parent??e?.inside);
    function logic(ast,e){if(!ast)return true;const s=ensure(e);if(!s)return false;
      const [kind,a,b,c]=ast;
      if(kind==='of'){const target=game.st.ents.get(logic(a,e));return target?logic(b,target):false;}
      if(kind==='lit')return a;
      if(kind==='unary'){const v=logic(b,e);return a==='not'?!v:a==='-'?-v:+v;}
      if(kind==='bin'){const l=logic(b,e);if(a==='and')return !!l&&!!logic(c,e);if(a==='or')return !!l||!!logic(c,e);const r=logic(c,e);
        return a==='=='?l===r:a==='!='?l!==r:a==='>'?l>r:a==='<'?l<r:a==='>='?l>=r:a==='<='?l<=r:a==='+'?l+r:a==='-'?l-r:a==='*'?l*r:a==='/'?(r?l/r:0):a==='%'?(r?l%r:0):false;}
      let who=e,path=a;
      if(path.startsWith('thisactiontarget.')){who=game.st.ents.get(s.actionTarget);path=path.slice(17);if(!who)return false;}
      if(path.startsWith('customtarget1.')){who=game.st.ents.get(s.home);path=path.slice(14);if(!who)return false;}
      if(path.startsWith('parent.')){who=parentOf(e);path=path.slice(7);if(!who)return false;}
      if(path.startsWith('self.'))path=path.slice(5);
      const state=ensure(who),def=sdk.getDef(who.defId),config=cfg(who);
      if(kind==='get'){
        if(path.startsWith('resource.'))return stock(who,path.slice(9));
        if(path.startsWith('memory.'))return s.memory[path.slice(7)]??0;
        if(path==='game.nukesenabled')return game.st.cfg.nukes!==false;
        if(path==='game.mapwidth')return game.st.map.w*32/.75;
        if(path==='game.mapheight')return game.st.map.h*32/.75;
      }
      const args=kind==='call'?Object.fromEntries(Object.entries(b).map(([k,v])=>[k,logic(v,e)])):{};
      const params=kind==='call'?c.map(v=>logic(v,e)):[];
      if(path==='select')return params[0]?params[1]:params[2];if(path==='min')return Math.min(...params);if(path==='max')return Math.max(...params);if(path==='int')return Math.trunc(params[0]);if(path==='rnd')return game.st.rng.range(params[0],params[1]);
      if(path==='distancebetween'){const x=game.st.ents.get(params[0]),y=game.st.ents.get(params[1]);return x&&y?Math.hypot(x.x-y.x,x.y-y.y)/.75:Infinity;}
      const compare=value=>{
        if(args.empty!==undefined&&((value===0)!==args.empty))return false;
        if(args.full!==undefined&&((value>=config.energyMax)!==args.full))return false;
        for(const[k,v]of Object.entries(args))if(k==='greaterthan'&&!(value>v)||k==='lessthan'&&!(value<v)||k==='equalto'&&value!==v||k==='laterthanseconds'&&!(value>v))return false;
        return Object.keys(args).some(k=>['empty','full','greaterthan','lessthan','equalto','laterthanseconds'].includes(k))?true:value;
      };
      if(path==='resource')return compare(stock(who,String(args.type??'')));
      if(path==='hasflag')return !!state.flags[args.id];
      if(path==='tags')return tags(who).includes(args.includes);
      if(path==='globalteamtags')return false;
      if(path==='hasparent'){const p=parentOf(who);return !!p&&(!args.withtag||tags(p).includes(args.withtag));}
      if(path==='attachment')return Object.values(state.children).find(id=>{const child=game.st.ents.get(id);return alive(child)&&(!args.withtag||tags(child).includes(args.withtag));})??null;
      if(['hasunitinteam','numberofunitsinteam','numberofunitsinenemyteam','numberofattachedunits'].includes(path)){
        let n=0;for(const t of game.st.ents.values()){if(!alive(t))continue;
          if(path==='numberofattachedunits'){if(states.get(t.id)?.parent!==who.id)continue;}
          else if(path==='numberofunitsinenemyteam'){if(game.st.players[t.owner]?.team===game.st.players[who.owner]?.team)continue;}
          else if(t.owner!==who.owner)continue;
          if(args.withtag&&!tags(t).includes(args.withtag))continue;
          if(args.withinrange!==undefined&&Math.hypot(t.x-who.x,t.y-who.y)>args.withinrange*.75)continue;n++;
        }return path==='hasunitinteam'&&!('greaterthan'in args)&&!('lessthan'in args)?n>0:compare(n);
      }
      const tile=game.st.map.terrain[Math.floor(who.y/32)*game.st.map.w+Math.floor(who.x/32)],water=tile===sdk.Terrain.Water||tile===sdk.Terrain.DeepWater;
      const moving=Math.hypot(who.x-who.prevX,who.y-who.prevY)>.001;
      const queued=state.job?[state.job,...state.queue]:state.queue;
      const queuedStock=k=>queued.reduce((n,j)=>n+(action(config,j.action)?.effects??[]).reduce((m,f)=>m+(f.add?.[k]??0),0),0);
      let value;
      switch(path){
        case 'self':return who.id;case 'parent':return parentOf(who)?.id??null;
        case 'customtarget1':return state.home??null;case 'activewaypointtarget':return who.orders[0]?.targetId??null;case 'thisactiontarget':return state.actionTarget??null;
        case 'hp':value=who.hp;break;case 'maxhp':value=sdk.maxHp(who);break;case 'maxenergy':value=config.energyMax;break;case 'maxshield':value=def.shield?.hp??0;break;case 'shield':value=who.rs?.shield??0;break;
        case 'ammo':value=stock(who,'ammo');break;case 'energy':value=stock(who,'energy');break;
        case 'ammoincludingqueued':value=stock(who,'ammo')+queuedStock('ammo');break;
        case 'energyincludingqueued':value=stock(who,'energy')+queuedStock('energy');break;
        case 'queuesize':value=queued.filter(j=>!args.withactiontag||action(config,j.action)?.tag===args.withactiontag).length;break;
        case 'transportingcount':value=who.cargo?.length??0;break;case 'kills':value=who.kills??0;break;
        case 'customtimer':value=state.age-state.timer;break;case 'timealive':value=state.age;break;
        case 'x':value=who.x/.75;break;case 'y':value=who.y/.75;break;case 'dir':value=facing(who)*180/Math.PI;break;case 'height':value=def.altitude??0;break;
        case 'hasactivewaypoint':return who.orders.length>0&&(!args.type||who.orders[0].kind===args.type);
        case 'numberofqueuedwaypoints':return who.orders.length;
        case 'ismoving':return moving;case 'isattacking':return !!who.targetId;case 'iscontrolledbyai':return !game.st.players[who.owner].isHuman;
        case 'isenergyfull':return stock(who,'energy')>=config.energyMax;case 'isenergyempty':return stock(who,'energy')<=0;case 'isenergyrecharging':return state.recharging;case 'isammoempty':return stock(who,'ammo')<=0;
        case 'isinwater':case 'overwater':case 'isoverwater':case 'isoverliquid':return water;case 'isoveropenland':return !water&&sdk.passable(game.st,'ground',Math.floor(who.x/32),Math.floor(who.y/32));
        case 'isovercliff':return !water&&!sdk.passable(game.st,'ground',Math.floor(who.x/32),Math.floor(who.y/32));
        case 'isoverpassabletile':return sdk.passable(game.st,args.type==='WATER'?'ship':args.type==='AIR'?'air':args.type==='HOVER'?'amphibious':'ground',Math.floor(who.x/32),Math.floor(who.y/32));
        case 'isatgroundheight':return def.domain!=='air';case 'isunderwater':return !!def.underwater;case 'isflying':case 'flying':return def.domain==='air';
        case 'isinmap':return who.x>=0&&who.y>=0&&who.x<game.st.map.w*32&&who.y<game.st.map.h*32;
        default:return false;
      }
      return compare(value);
    }
    function canMorph(e,to){const d=sdk.getDef(e.defId),next=sdk.getDef(to);return d.kind===next.kind&&(next.kind!=='building'||d.fw===next.fw&&d.fh===next.fh)&&(next.kind!=='unit'||sdk.passable(game.st,next.domain,Math.floor(e.x/32),Math.floor(e.y/32)));}
    function morph(e,to){const d=sdk.getDef(e.defId),next=sdk.getDef(to);if(!canMorph(e,to))return false;
      if(!sdk.passable(game.st,next.domain,Math.floor(e.x/32),Math.floor(e.y/32))&&next.kind==='unit')return false;
      const fraction=e.hp/sdk.maxHp(e);sdk.setEntityDef(e,to);e.hp=Math.max(1,fraction*sdk.maxHp(e));ensure(e);return true;
    }
    function allowed(e,s,a,visible=false){return !a.blocked&&(!visible||!a.hidden)&&(!visible||logic(a.isVisible,e))&&logic(a.isActive,e)&&logic(a.requireConditional,e)&&!logic(a.isLocked??['lit',false],e)&&!logic(a.isLockedAlt??['lit',false],e)&&!logic(a.isLockedAlt2??['lit',false],e);}
    function affordable(e,s,a){return allowed(e,s,a)&&(!s.job||a.queue&&s.queue.length<32)&&(s.cooldowns[a.id]??0)<=0&&game.st.players[e.owner].metal>=a.cost&&canPay(e,a.stocks);}
    function perform(e,a,job={},depth=0){if(depth>16)return false;const s=ensure(e),c=cfg(e);
      if(a.blocked||!logic(a.requireConditional,e))return true;
      // A spawn batch is all-or-nothing; do not replay earlier resource effects
      // while a launch point/hold is full.
      const plans=new Map();
      for(const f of a.effects){if(f.morph&&!canMorph(e,f.morph))return false;if(f.spawn){const plan=planBatch(e,c,f.spawn,f.into);if(!plan)return false;plans.set(f,plan);}}
      for(const f of a.effects){
        if(f.add)add(e,f.add);if(f.set)for(const[k,v]of Object.entries(f.set))setStock(e,k,v);
        if(f.logic)for(const[k,v]of Object.entries(f.logic))setStock(e,k,Number(logic(v,e)));
        if(f.memory)for(const[k,v]of Object.entries(f.memory))s.memory[k]=logic(v,e);
        if(f.addTags)for(const t of f.addTags)s.tags[t]=true;if(f.removeTags)for(const t of f.removeTags)s.tags[t]=false;
        if(f.clearOrders){e.orders=[];e.targetId=0;}if(f.clearWaypoint)e.orders.shift();
        if(f.resetTimer)s.timer=s.age;if(f.clearCooldowns)s.cooldowns={};
        if(f.spawn){if(!spawnBatch(e,c,f.spawn,f.into,plans.get(f)))return false;}
        if(f.fire){const g=c.guns.find(g=>g.id===f.fire);if(g){let point={x:job.x??e.x,y:job.y??e.y};if(f.offset){const angle=facing(e)+Math.PI/2;point={x:e.x+f.offset[0]*Math.cos(angle)+f.offset[1]*Math.cos(facing(e)),y:e.y+f.offset[0]*Math.sin(angle)+f.offset[1]*Math.sin(facing(e))};}fire(e,sdk.getDef(e.defId),c,s,g,null,point);}}
        if(f.triggerActions&&logic(f.condition,e))for(const id of f.triggerActions){const child=c.actions.find(a=>a.id==='hiddenAction_'+id||a.id==='action_'+id);if(child&&allowed(e,s,child))perform(e,child,job,depth+1);}
        if(f.queueActions&&logic(f.condition,e))for(const id of f.queueActions){const child=c.actions.find(a=>a.id==='hiddenAction_'+id||a.id==='action_'+id);if(child&&!child.blocked&&s.queue.length<32)s.queue.push({action:child.id,origin:e.defId,remaining:child.time,total:child.time,lock:child.lock});}
        if(f.parentResources){const p=parentOf(e);if(p)for(const[k,v]of Object.entries(f.parentResources))setStock(p,k,stock(p,k)-v);}
        if(f.take){const q=f.take,candidates=new Set();
          if(q.parent)candidates.add(parentOf(e));if(q.reference)candidates.add(game.st.ents.get(logic(q.reference,e)));
          if(q.cargo)for(const id of e.cargo??[])candidates.add(game.st.ents.get(id));
          if(q.range)for(const t of game.st.ents.values())if(alive(t)&&!t.inside&&Math.hypot(t.x-e.x,t.y-e.y)<=q.range&&(q.team==='ally'?game.st.players[t.owner].team===game.st.players[e.owner].team:t.owner===e.owner))candidates.add(t);
          let n=0;for(const t of candidates){if(!alive(t)||n>=q.limit||q.tag&&!tags(t).includes(q.tag)||Object.keys(q.exclude).length&&Object.entries(q.exclude).every(([k,v])=>stock(t,k)>=v)||Object.entries(q.resources).some(([k,v])=>v>0&&stock(t,k)<v))continue;
            n++;for(const[k,v]of Object.entries(q.resources)){setStock(t,k,stock(t,k)-v);if(!q.discard)setStock(e,k,stock(e,k)+v);}
          }
        }
        if(f.cooldowns)for(const[name,time]of Object.entries(f.cooldowns)){const action=c.actions.find(a=>a.id==='action_'+name||a.id==='hiddenAction_'+name);if(action)s.cooldowns[action.id]=time;}
        if(f.unload)sdk.cmdUnload(game,[e.id]);
        if(f.morph&&!morph(e,f.morph))return false;
        if(f.remove){sdk.markBlocked(game.st,e,0);game.st.ents.delete(e.id);return true;}
        if(f.rotation!==undefined)e.angle=f.rotation;
        if(f.detach){const p=parentOf(e);if(p){p.cargo=p.cargo?.filter(id=>id!==e.id);if(cfg(p))for(const[k,id]of Object.entries(ensure(p).children))if(id===e.id)delete ensure(p).children[k];}delete e.inside;delete s.parent;delete s.slot;}
        if(f.message){const target=game.st.ents.get(logic(f.message,e));if(target&&cfg(target))runEvent(target,'newMessage',f.tag);}
        if(f.waypoint){const w=f.waypoint;let target=w.reference?game.st.ents.get(logic(w.reference,e)):undefined;
          if(w.tag)target=[...game.st.ents.values()].filter(t=>alive(t)&&tags(t).includes(w.tag)&&(w.team==='own'?t.owner===e.owner:game.st.players[t.owner].team!==game.st.players[e.owner].team)).sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
          if(w.kind==='loadInto'&&alive(target)){s.recoverTo=target.id;s.home??=target.id;sdk.cmdMove(game,[e.id],target.x,target.y);}
          else if(w.kind==='move'||w.kind==='attackMove'){const x=target?.x??e.x+(w.offset?.[0]??0)+(w.random?game.st.rng.range(-w.random[0],w.random[0]):0),y=target?.y??e.y+(w.offset?.[1]??0)+(w.random?game.st.rng.range(-w.random[1],w.random[1]):0);sdk.cmdMove(game,[e.id],x,y,w.kind==='attackMove');}
          if(w.time)s.waypointUntil=s.age+w.time;
        }
        if(f.attach){const slots=c.attachments.filter(slot=>!f.slots[0]||f.slots.includes(slot.id.replace('attachment_','')));let count=0;for(const item of f.attach)for(let i=0;i<item.count;i++){const slot=slots[count++];if(!slot)break;const old=game.st.ents.get(s.children[slot.id]);if(alive(old))continue;const child=sdk.newEnt(game.st,item.unit,e.owner,e.x,e.y,facing(e)+slot.angle,'spawn'),cs=ensure(child);cs.parent=e.id;cs.slot=slot.id;cs.home=e.id;s.children[slot.id]=child.id;}}
      }
      const built=a.effects.find(f=>f.built!==undefined)?.built;if(built!==undefined){e.site=built<1;e.hp=Math.max(1,sdk.maxHp(e)*built);}
      return true;
    }
    function runEvent(e,event,tag){const s=ensure(e),c=cfg(e);if(!c||!s)return;for(const a of c.actions)if(a.event===event&&(!a.eventTag||a.eventTag===tag)&&allowed(e,s,a))perform(e,a);}
    function death(e){const c=cfg(e),s=c&&ensure(e);if(!s||s.deathHandled)return;s.deathHandled=true;
      runEvent(e,'destroyed');const gun=c.guns.find(g=>g.id===c.deathGun);if(gun)fire(e,sdk.getDef(e.defId),c,s,gun,null,{x:e.x,y:e.y});
      if(c.deathSpawn)spawnBatch(e,c,c.deathSpawn,false);
      if(c.deathBlast)deaths.set(e.id,{id:e.id,owner:e.owner,x:e.x,y:e.y,definition:e.defId,blast:c.deathBlast});
    }
    function startJob(e,s){const a=action(cfg({defId:s.job?.origin}),s.job?.action);if(!a||s.job.started)return;s.job.started=true;for(const name of a.onStart??[]){const child=cfg(e).actions.find(a=>a.id==='hiddenAction_'+name||a.id==='action_'+name);if(child)perform(e,child);}}
    function finish(e,c,s,job){const original=cfg({defId:job.origin}),a=action(original,job.action);if(!a){delete s.job;return;}
      if(!perform(e,a,job)){job.remaining=.1;return;}
      s.cooldowns[a.id]=a.cooldown;delete s.job;if(s.queue.length)s.job=s.queue.shift();
    }
    return {
      id:ID,
      beforeStep(dt) {
        // Give the complete roster its opening frame before source helper events.
        if(showcase.prepare())return;
        for(const e of members()){
          if(!alive(e)||showcase.paused(e))continue;let c=cfg(e),s=ensure(e);s.age+=dt;
          if(e.site){if(c.selfBuildTime>0){e.hp=Math.min(sdk.maxHp(e),e.hp+sdk.maxHp(e)*dt/c.selfBuildTime);if(e.hp>=sdk.maxHp(e))e.site=false;}if(e.site)continue;}
          if(!s.initialized){s.initialized=true;runEvent(e,'created');
            for(const slot of c.attachments)if(slot.spawn.length){const item=slot.spawn[0],child=sdk.newEnt(game.st,item.unit,e.owner,e.x,e.y,facing(e)+slot.angle,'spawn');const cs=ensure(child);cs.parent=e.id;cs.slot=slot.id;cs.home=e.id;s.children[slot.id]=child.id;}
          }
          if(!game.st.ents.has(e.id))continue;c=cfg(e);s=ensure(e);
          if(s.parent){const p=game.st.ents.get(s.parent),slot=(p?cfg(p):null)?.attachments.find(a=>a.id===s.slot);
            if(!alive(p)){if(slot?.keep){delete s.parent;delete s.slot;}else{sdk.markBlocked(game.st,e,0);game.st.ents.delete(e.id);continue;}}
            else if(slot){const angle=facing(p)+Math.PI/2;e.prevX=e.x;e.prevY=e.y;e.x=p.x+slot.x*Math.cos(angle)-slot.y*Math.sin(angle);e.y=p.y+slot.x*Math.sin(angle)+slot.y*Math.cos(angle);e.angle=facing(p)+slot.angle;e.orders=[];}
          }
          const emp=s.empActive;
          s.triggerClock+=dt;
          const regen=s.recharging?(c.rechargingRegen??c.energyRegen):c.energyRegen;
          setStock(e,'energy',stock(e,'energy')+regen*dt);
          if(stock(e,'energy')>=c.energyMax-1e-8)s.recharging=false;
          if(c.dieOnZeroEnergy&&stock(e,'energy')<=0){sdk.kill(game.st,e,undefined);death(e);continue;}
          if(!emp)e.hp=Math.min(sdk.maxHp(e),e.hp+c.regen*dt);
          for(const[id,v]of Object.entries(s.cooldowns))s.cooldowns[id]=Math.max(0,v-dt);
          if(c.income&&logic(c.income.condition,e)){s.incomeClock+=dt;while(s.incomeClock+1e-9>=c.income.every){s.incomeClock-=c.income.every;add(e,c.income.resources);}}
          while(s.triggerClock+1e-9>=c.triggerInterval){s.triggerClock=Math.max(0,s.triggerClock-c.triggerInterval);
            if(stock(e,'emp')>2){s.empActive=true;e.orders=[];e.targetId=0;}if(stock(e,'emp')>5)setStock(e,'emp',5);if(stock(e,'emp')>1.5)setStock(e,'emp',stock(e,'emp')-1);if(stock(e,'emp')>0&&stock(e,'emp')<2){setStock(e,'emp',0);s.empActive=false;}
            const original=e.defId;for(const a of c.actions)if(a.trigger&&logic(a.trigger,e)&&allowed(e,s,a)&&(s.cooldowns[a.id]??0)<=0){perform(e,a);s.cooldowns[a.id]=a.cooldown;if(e.defId!==original||!game.st.ents.has(e.id))break;}
            if(e.defId!==original||!game.st.ents.has(e.id))break;
          }
          for(const id of e.cargo??[]){const u=game.st.ents.get(id);if(alive(u))u.hp=Math.min(sdk.maxHp(u),u.hp+c.cargoHeal*dt);}
          if(s.waypointUntil&&s.age>=s.waypointUntil){e.orders.shift();delete s.waypointUntil;}
          if(s.recoverTo){const carrier=game.st.ents.get(s.recoverTo),cc=carrier&&cfg(carrier);if(!alive(carrier)||!cc)delete s.recoverTo;
            else if(Math.hypot(e.x-carrier.x,e.y-carrier.y)<=sdk.getDef(carrier.defId).radius+30&&hasSpace(carrier,cc,[{unit:e.defId,count:1}])){e.inside=carrier.id;e.orders=[];e.targetId=0;e.x=e.prevX=carrier.x;e.y=e.prevY=carrier.y;(carrier.cargo??=[]).push(e.id);delete s.recoverTo;runEvent(e,'enteredTransport');}
            else sdk.cmdMove(game,[e.id],carrier.x,carrier.y);
          }
          if(!s.job&&s.queue.length)s.job=s.queue.shift();
          if(s.job&&!emp){startJob(e,s);s.job.remaining-=dt;if(s.job.remaining<=0)finish(e,c,s,s.job);}
          if(c.defence&&!emp)for(const defence of c.defence){if(stock(e,'energy')<defence.energy)continue;const p=game.st.projs.find(p=>!p.downed&&p.interceptable&&p.team!==game.st.players[e.owner].team&&Math.hypot(p.x-e.x,p.y-e.y)<=defence.range);if(p){p.downed=true;setStock(e,'energy',stock(e,'energy')-defence.energy);}}
          if(game.st.ents.has(e.id))rotateMounts(e,cfg(e),ensure(e),dt);
        }
      },
      effectiveDef(e,d){const c=cfg(e);if(!c||c.adapter)return d;const s=ensure(e),emp=s.empActive;
        return {...d,regen:0,weapons:c.guns.filter(g=>!g.manual).map(g=>({...g.weapon,range:g.range,reload:g.reload})),
          ...(c.airCargo?{transportDomain:'air',transportMaxWeight:50}:{}),...(s.job?.lock||s.parent||emp?{speed:0,turnRate:0}:{}),...(emp?{repairRate:0,buildRate:0}:{}),
          ...(s.parent&&!(parentOf(e)?cfg(parentOf(e)):null)?.attachments.find(a=>a.id===s.slot)?.damageable?{untargetable:true}:{})};
      },
      canFire(e,d,w,point,target){const c=cfg(e);if(!c)return true;const s=ensure(e),g=c.guns.find(g=>g.id===w.id);return !s.empActive&&(!g||!s.recharging&&canPay(e,g.costs)&&logic(g.predicate,e));},
      wrapFirePolicy(next){return(e,d,w,point,target)=>{const tc=target&&cfg(target);if(tc?.targetTags?.length&&!tc.targetTags.some(t=>tags(e).includes(t)))return false;return next(e,d,w,point,target);};},
      allowOrder(e,order){if(order.kind!=='board')return true;const carrier=game.st.ents.get(order.targetId),c=carrier&&cfg(carrier);return !c?.cargoTags?.length||c.cargoTags.some(t=>tags(e).includes(t));},
      wrapBoardPassenger(next){return(passenger,carrier,...rest)=>{const c=cfg(carrier);if(c?.cargoTags?.length&&!c.cargoTags.some(t=>tags(passenger).includes(t)))return;next(passenger,carrier,...rest);if(cfg(passenger)){ensure(passenger).home??=carrier.id;runEvent(passenger,'enteredTransport');}};},
      wrapDamage(next){return(st,e,raw,mult,owner,src,gun,...rest)=>{const c=cfg(e),s=c&&ensure(e);if(c?.immortal)return;
        const parent=s?.parent&&st.ents.get(s.parent),slot=parent&&cfg(parent)?.attachments.find(a=>a.id===s.slot);
        if(slot&&!slot.damageable)return;if(slot?.redirect&&alive(parent))return next(st,parent,raw,mult,owner,src,gun,...rest);
        return next(st,e,raw,mult,owner,src,gun,...rest);
      };},
      wrapUnloadStep(next){return(e,d,o,dt)=>{const c=cfg(e);if(c&&!logic(c.unloadCondition,e))return false;return next(e,d,o,dt);};},
      wrapBuildingStep(next){return(e,d,dt)=>{if(!showcase.paused(e))next(e,d,dt);};},
      wrapUnitStep(next){return(e,d,dt)=>{if(showcase.paused(e))return;const order=e.orders[0];
        if(order?.kind==='buildSite'){const site=game.st.ents.get(order.siteId),c=site&&cfg(site);if(c){const extra=Object.fromEntries(Object.entries(c.sourceCost??{}).filter(([k])=>k!=='credits')),s=ensure(site);
          if(!s.constructionPaid&&Object.keys(extra).length){if(!canPay(site,extra))return;pay(site,extra);s.constructionPaid=true;}
        }}
        const x=e.x,y=e.y;next(e,d,dt);
        // The game parks a unit 85% into its reach and calls it arrived 14 px
        // short of that; a melee reach is shorter than the slack, so a fighter
        // left standing short of its target walks the last of the way in.
        const c=cfg(e);if(!c?.melee||e.holdPos||e.x!==x||e.y!==y||e.dead)return;
        const t=game.st.ents.get(e.orders[0]?.kind==='attack'?e.orders[0].targetId:e.targetId);if(!alive(t)||t.inside)return;
        const reach=Math.min(...c.guns.filter(g=>!g.manual).map(g=>g.range))*32,gap=Math.hypot(t.x-e.x,t.y-e.y)-sdk.getDef(t.defId).radius;
        if(gap>reach*.9&&gap<reach+96)sdk.moveToward(game.st,e,d,t.x,t.y,dt,sdk.getDef(t.defId).radius+reach*.5);
      };},
      wrapAI(next){return(g,p)=>{if(showcase.active)return;next(g,p);for(const e of members())if(alive(e)&&e.owner===p.idx&&!e.inside&&!e.site){const c=cfg(e),s=ensure(e);if(s.job)continue;const a=c.actions.find(a=>a.ai&&!a.hidden&&!a.target&&affordable(e,s,a)&&a.effects.some(f=>f.spawn||f.morph));if(a)sdk.cmdContentAction(g,ID,{owner:p.idx,ids:[e.id],action:a.id});}};},
      wrapWeapons(next){return(st,e,d,target,dt,powerFactor,...rest)=>{
        if(showcase.paused(e))return;
        const c=cfg(e);if(!c||c.adapter)return next(st,e,d,target,dt,powerFactor,...rest);if(e.inside)return;
        stepGuns(st,e,d,dt,rest[0]);
        let cargoIndex=0;
        for(const slot of c.attachments)if(slot.cargo){const child=st.ents.get(e.cargo?.[cargoIndex++]);if(!alive(child)||!slot.attack||!cfg(child))continue;
          const angle=facing(e)+Math.PI/2,proxy={...child,inside:undefined,x:e.x+slot.x*Math.cos(angle)-slot.y*Math.sin(angle),y:e.y+slot.x*Math.sin(angle)+slot.y*Math.cos(angle)};
          rotateMounts(proxy,cfg(child),ensure(child),dt);stepGuns(st,proxy,sdk.getDef(child.defId),dt);
        }
      };},
      onShot(e,d,w,p){if(!pending||d.id!==pending.source||w.id!==pending.gun.id)return;
        p.id??=game.st.nextProjId++;const meta={gun:pending.gun,source:pending.source,depth:pending.depth??0,...(pending.forced?{forced:true}:{})};rounds.set(p.id,meta);
        p.ttl=pending.gun.life;p.speed=pending.gun.weapon.speed;
        // a round that cannot turn flies to where it was aimed, as a shell does
        if(!pending.gun.turnSpeed)p.homing=false;
        if(pending.angle!==undefined)p.angle=pending.angle;
        p.mult={light:1,medium:1,heavy:1,ship:1,sub:1,air:1,structure:1};
        if(pending.intercept)p.hitProj=pending.intercept;
        if(meta.gun.cascade?.created)pendingCascades.push({projectile:{...p},meta,phase:'created'});
      },
      beforeProjectiles(){for(let i=0;i<512&&pendingCascades.length;i++){const task=pendingCascades.shift();cascade(task.projectile,task.meta,task.phase);}},
      projectileStep(p,dt){const meta=rounds.get(p.id);if(!meta)return;
        if(meta.gun.instant){const target=game.st.ents.get(p.targetId);p.x=p.tx;p.y=p.ty;host.resolveImpact(game.st,game.hash,p,alive(target)?target:null,false);return 'remove';}
        if(meta.gun.still){p.px=p.x;p.py=p.y;p.ttl-=dt;if(p.ttl>0)return 'hold';
          cascade(p,meta,'expired');if(meta.gun.explodeEnd)host.resolveImpact(game.st,game.hash,p,null,false);rounds.delete(p.id);return 'remove';}
        if(p.ttl>dt)return;
        // a round that outlives its life is gone, unless it bursts then
        cascade(p,meta,'expired');
        if(meta.gun.explodeEnd)host.resolveImpact(game.st,game.hash,p,null,false);
        rounds.delete(p.id);return 'remove';
      },
      guideProjectile(p,dt){const m=rounds.get(p.id);if(!m)return false;const g=m.gun;
        if(g.acceleration)p.speed=Math.min(g.targetSpeed,p.speed+g.acceleration*dt);
        else p.speed=g.targetSpeed||p.speed;
        if(!p.homing)return false;let t=game.st.ents.get(p.targetId);
        const retarget=alive(t)?g.retargetRange:g.retargetDeadRange;
        if(retarget&&(m.nextSearch??0)<=game.st.time){m.nextSearch=game.st.time+(g.retargetDelay??.5);
          let distance=retarget;for(const candidate of game.st.ents.values())if(alive(candidate)&&!candidate.inside&&game.st.players[candidate.owner].team!==p.team&&g.weapon.targets.includes(sdk.targetCat(game.st,candidate))&&host.visible(candidate,p.team)){const d=Math.hypot(candidate.x-p.x,candidate.y-p.y);if(d<distance){t=candidate;distance=d;}}
          if(alive(t))p.targetId=t.id;
        }
        if(!alive(t))return false;
        const delta=norm(Math.atan2(t.y-p.y,t.x-p.x)-p.angle);p.angle=norm(p.angle+Math.sign(delta)*Math.min(Math.abs(delta),g.turnSpeed*dt));p.tx=t.x;p.ty=t.y;return true;
      },
      wrapImpact(next){return(st,hash,p,direct,terrain)=>{
        const meta=rounds.get(p.id);if(!meta)return next(st,hash,p,direct,terrain);
        const g=meta.gun;
        const harm=(t,raw,area)=>{
          if(!alive(t)||t.inside||raw<=0)return;
          if(!g.friendlyFire&&!meta.forced&&st.players[t.owner]?.team===p.team)return;
          const td=sdk.getDef(t.defId),tc=cfg(t),tags=tc?.tags??[];
          if(area&&!g.bothLayers&&!g.weapon.targets.includes(sdk.targetCat(st,t))&&!(g.underwaterArea&&sdk.targetCat(st,t)==='sub'))return;
          let amount=raw*(td.kind==='building'?g.buildingMult:1);
          for(const m of g.mutators)if(m.tags.some(tag=>tags.includes(tag))){amount*=area?m.area:m.direct;if(area&&m.add)add(t,m.add);}
          if(tc)amount=Math.max(tc.minDamage,amount-Math.max(0,tc.armor-g.ignoreArmor));
          if(t.rs?.shield>0&&g.shieldMult!==1){const before=t.rs.shield,spent=Math.min(before,amount*g.shieldMult);t.rs.shield-=spent;amount=Math.max(0,amount-spent/Math.max(.000001,g.shieldMult));}
          if(!(t.rs?.shield>0))amount*=g.hullMult??1;
          host.applyDamage(st,t,amount,{light:1,medium:1,heavy:1,ship:1,sub:1,air:1,structure:1},p.owner,p.src,p.gun,{x:p.x,y:p.y});
        };
        let struck=direct;
        if(!struck&&!terrain&&g.direct>0){
          const intended=st.ents.get(p.targetId);
          if(alive(intended)&&!intended.inside&&Math.hypot(intended.x-p.x,intended.y-p.y)<=sdk.getDef(intended.defId).radius+2)struck=intended;
          else struck=[...st.ents.values()].find(t=>alive(t)&&!t.inside&&g.weapon.targets.includes(sdk.targetCat(st,t))&&Math.hypot(t.x-p.x,t.y-p.y)<=sdk.getDef(t.defId).radius+2)??null;
        }
        if(struck)harm(struck,g.direct,false);
        if(g.area>0&&g.radius>0)for(const t of st.ents.values()){
          const distance=Math.max(0,Math.hypot(t.x-p.x,t.y-p.y)-sdk.getDef(t.defId).radius);
          if(distance<=g.radius)harm(t,g.area*(g.noFalloff?1:1-.5*distance/g.radius),true);
        }
        if(g.spawn){const source=st.ents.get(p.src);if(source)spawnBatch({...source,x:p.x,y:p.y},host.config(sdk.getDef(meta.source)),g.spawn,false);}
        if(g.teleport){const source=st.ents.get(p.src);if(alive(source)&&sdk.passable(st,sdk.getDef(source.defId).domain,Math.floor(p.x/32),Math.floor(p.y/32))){source.x=source.prevX=p.x;source.y=source.prevY=p.y;runEvent(source,'teleported');}}
        cascade(p,meta,'impact');
        sdk.addEffect(st,g.nuclear?'fx.nuke':'fx.expl.m',p.x,p.y,g.nuclear?3:.5,g.nuclear?10:6,g.nuclear?4:1);
        rounds.delete(p.id);
      };},
      onDamage(context){const e=context.target,c=cfg(e);if(c)runEvent(e,'tookDamage');if(e.dead&&c){death(e);const killer=game.st.ents.get(context.sourceId);if(killer&&cfg(killer))runEvent(killer,'killedAnyUnit');}},
      afterStep(dt){
        const liveRounds=new Set(game.st.projs.map(p=>p.id));for(const id of rounds.keys())if(!liveRounds.has(id))rounds.delete(id);
        for(const [id,d]of deaths){deaths.delete(id);const b=d.blast;for(const t of game.st.ents.values())if(alive(t)&&!t.inside&&Math.hypot(t.x-d.x,t.y-d.y)<=b.radius)host.applyDamage(game.st,t,b.damage,undefined,d.owner,d.id,d.definition+'/death');sdk.addEffect(game.st,'fx.nuke',d.x,d.y,3,10,4);}
        for(const [id,s]of states){const e=game.st.ents.get(id);if(alive(e)){ensure(e);if(s.job?.siteId&&!alive(game.st.ents.get(s.job.siteId)))delete s.job;continue;}
          if(e)death(e);states.delete(id);
        }
      },
      actions(e){const c=cfg(e);if(!c)return[];const s=ensure(e);if(e.site||e.inside)return[];
        const own=c.actions.filter(a=>!a.hidden&&logic(a.isVisible,e)).map(a=>({id:a.id,label:priceLabel(a),enabled:affordable(e,s,a),...(a.target?{target:a.target}:{})}));
        if(showcase.paused(e))own.unshift({id:'showcase-start',label:text.startTest,enabled:true});
        for(const[slotId,childId]of Object.entries(s.children)){const slot=c.attachments.find(a=>a.id===slotId),child=game.st.ents.get(childId);if(alive(child)&&logic(slot?.actions,e))for(const a of this.actions(child))own.push({...a,id:'child/'+childId+'/'+a.id});}
        if(s.job)own.push({id:'cancel',label:text.cancel,enabled:!!action(cfg({defId:s.job.origin}),s.job.action)?.canCancel});
        return own;
      },
      order(o){let changed=false;for(const id of o.ids){const e=game.st.ents.get(id);if(!alive(e)||e.owner!==o.owner||e.inside||e.site)continue;const c=cfg(e);if(!c)continue;const s=ensure(e);
        if(o.action==='showcase-start'&&showcase.activate(e)){e.holdFire=false;changed=true;continue;}
        if(o.action.startsWith('child/')){const[,childId,...parts]=o.action.split('/');const child=game.st.ents.get(+childId),slot=c.attachments.find(a=>s.children[a.id]===+childId);if(alive(child)&&slot&&logic(slot.actions,e))changed=sdk.cmdContentAction(game,ID,{...o,ids:[child.id],action:parts.join('/')})||changed;continue;}
        if(o.action==='cancel'&&s.job){const a=action(cfg({defId:s.job.origin}),s.job.action);if(!a?.canCancel)continue;if(s.job.paid){game.st.players[e.owner].metal+=a.cost;add(e,a.stocks);}delete s.job;if(s.queue.length)s.job=s.queue.shift();runEvent(e,'queueItemCancelled',a.tag);changed=true;continue;}
        const a=action(c,o.action);if(!a||a.hidden||!logic(a.isVisible,e)||!affordable(e,s,a))continue;
        if(a.target&&(!Number.isFinite(o.x)||!Number.isFinite(o.y)||o.x<0||o.y<0||o.x>game.st.map.w*32||o.y>game.st.map.h*32))continue;
        if(a.targetDomain&&!sdk.passable(game.st,a.targetDomain,Math.floor(o.x/32),Math.floor(o.y/32)))continue;
        showcase.activate(e);
        game.st.players[e.owner].metal-=a.cost;game.st.players[e.owner].stats.metalSpent+=a.cost;pay(e,a.stocks);
        const job={action:a.id,origin:e.defId,remaining:a.time,total:a.time,lock:a.lock,paid:true,...(a.target?{x:o.x,y:o.y}:{})};if(s.job)s.queue.push(job);else s.job=job;runEvent(e,'queueItemAdded',a.tag);changed=true;
      }return changed;},
      inspect(e,privateView){if(!privateView)return[];const c=cfg(e),s=c&&ensure(e);if(!s)return[];
        if(showcase.paused(e))return[{id:'showcase-paused',label:text.pausedTest}];
        const names={experimental:['Experimental technology','实验科技','실험 기술'],msite:['Military satellites','军用卫星资源','군용 위성'],esite:['Energy satellites','能量卫星资源','에너지 위성'],eksef:['Space elevator orbital nodes','太空升降机轨道节点','우주 엘리베이터 궤도 노드']};
        return[...(c.energyMax?[{id:'energy',label:text.energy,value:s.stocks.energy,fraction:s.stocks.energy/c.energyMax}]:[]),
          ...Object.entries(s.stocks).filter(([k])=>k==='ammo').map(([k,v])=>({id:'stock/'+k,label:text.ammo,value:v})),
          ...Object.entries(team(e)).map(([k,v])=>({id:'team/'+k,label:names[k]??[k,k,k],value:v})),
          ...(s.job?[{id:'job',label:text.busy,fraction:Math.max(0,1-s.job.remaining/Math.max(.001,s.job.total))}]:[])];
      },
      render(e){if(publicMounts.has(e.id))return publicMounts.get(e.id);const c=cfg(e),s=c&&ensure(e);if(!s)return;
        const a=facing(e)+Math.PI/2;
        const parent=parentOf(e),slot=parent&&cfg(parent)?.attachments.find(m=>m.id===s.slot);
        return{hidden:!logic(c.visible,e)||!!slot&&!logic(slot.draw,parent),mounts:c.mounts.filter(m=>m.sprite&&!logic(m.hidden??['lit',false],e)).map(m=>({...mountPose(e,c,s,m.id),previous:s.mounts[m.id].previous,sprite:m.sprite,under:m.under})),
          deck:(c.attachments??[]).filter(m=>m.cargo&&logic(m.draw,e)).flatMap((m,i)=>{const u=game.st.ents.get(e.cargo?.[i]);if(!alive(u))return[];const d=sdk.getDef(u.defId);return[{x:e.x+m.x*Math.cos(a)-m.y*Math.sin(a),y:e.y+m.x*Math.sin(a)+m.y*Math.cos(a),angle:facing(e)+m.angle,sprite:d.sprite??'u.'+d.id}];})};
      },
      snapshot(view){const entities={},visuals={};for(const[id,s]of states)if(alive(game.st.ents.get(id))&&(!view||view.privateEntity(id)))entities[id]=structuredClone(s);
        if(view)for(const e of host.participants())if(view.visibleEntities.has(e.id)&&!view.privateEntity(e.id))visuals[e.id]=this.render(e);
        const projectiles={};for(const[id,m]of rounds)if(!view||view.visibleProjectiles.has(id))projectiles[id]={source:m.source,gun:m.gun.id,depth:m.depth??0,...(m.nextSearch!==undefined?{nextSearch:m.nextSearch}:{}),...(m.forced?{forced:true}:{})};
        const balances={};for(const[owner,v]of teams)if(!view||view.player===undefined||view.player===owner)balances[owner]=structuredClone(v);return{version:1,entities,projectiles,visuals,balances,...(showcase.active?{showcase:showcase.snapshot(view)}:{}),cascades:pendingCascades.filter(task=>!view||view.visibleProjectiles.has(task.projectile.id)).map(task=>({projectile:task.projectile,source:task.meta.source,gun:task.meta.gun.id,depth:task.meta.depth,phase:task.phase}))};
      },
      restore(value){
        if(!value||value.version!==1||typeof value.entities!=='object'||typeof value.projectiles!=='object')throw Error('Invalid EK Definitive Edition state');
        showcase.restore(value.showcase);
        const newStates=new Map(),newRounds=new Map();
        for(const[id,s]of Object.entries(value.entities)){
          const e=game.st.ents.get(+id),c=e&&cfg(e);if(!c||!s||s.definition!==e.defId||!s.stocks||!s.guns||!s.mounts||!s.cooldowns||!Number.isFinite(s.age)||s.age<0)throw Error('Invalid EK Definitive Edition entity '+id);
          for(const v of Object.values(s.stocks))if(!Number.isFinite(v)||v<0||v>1e12)throw Error('Invalid ammunition stock');
          if(!s.flags||!s.tags||!s.memory||!Array.isArray(s.queue)||!s.children)throw Error('Invalid EK state fields');
          for(const g of c.guns){const x=s.guns[g.id];if(!x||![x.cd,x.warm,x.target].every(Number.isFinite)||x.cd<0||x.warm<0)throw Error('Invalid firing clock');}
          for(const m of c.mounts){const x=s.mounts[m.id];if(!x||!Number.isFinite(x.angle)||!Number.isFinite(x.previous))throw Error('Invalid turret angle');}
          if(s.queue&&(!Array.isArray(s.queue)||s.queue.length>32))throw Error('Invalid action queue');
          for(const job of [s.job,...(s.queue??[])].filter(Boolean)){
            const jc=cfg({defId:job.origin??e.defId}),a=action(jc,job.action);
            if(!a||!Number.isFinite(job.remaining)||!Number.isFinite(job.total)||job.remaining<0||job.total<0||job.remaining>job.total+.1||a.target&&(!Number.isFinite(job.x)||!Number.isFinite(job.y)))throw Error('Invalid action job');
          }
          newStates.set(+id,structuredClone(s));
        }
        for(const[id,m]of Object.entries(value.projectiles)){const d=sdk.getDef(m.source),g=host.config(d)?.guns.find(g=>g.id===m.gun);if(!g)throw Error('Invalid source projectile');newRounds.set(+id,{source:m.source,gun:g,depth:m.depth??0,...(m.nextSearch!==undefined?{nextSearch:m.nextSearch}:{}),...(m.forced===true?{forced:true}:{})});}
        teams.clear();for(const[k,v]of Object.entries(value.balances??{})){if(!Object.values(v).every(n=>Number.isFinite(n)&&n>=0))throw Error('Invalid team resource');teams.set(+k,structuredClone(v));}states.clear();rounds.clear();publicMounts.clear();for(const[id,s]of newStates)states.set(id,s);for(const[id,s]of newRounds)rounds.set(id,s);
        pendingCascades.length=0;
        for(const task of value.cascades??[]){const gun=host.config(sdk.getDef(task.source))?.guns.find(g=>g.id===task.gun);if(!gun||!['created','expired','impact'].includes(task.phase)||!Number.isInteger(task.depth)||task.depth<0||task.depth>64)throw Error('Invalid cascade state');pendingCascades.push({projectile:structuredClone(task.projectile),meta:{source:task.source,gun,depth:task.depth},phase:task.phase});}
        for(const[id,v]of Object.entries(value.visuals??{}))if(game.st.ents.has(+id)&&v&&Array.isArray(v.mounts)&&v.mounts.every(m=>[m.x,m.y,m.angle,m.previous].every(Number.isFinite)))publicMounts.set(+id,structuredClone(v));
      },
      validateRestoredState(){for(const[id,s]of states){const e=game.st.ents.get(id);if(!e||!cfg(e))throw Error('Orphan EK Definitive Edition state');if(s.recover&&!game.st.ents.has(s.recover))throw Error('Missing recovery aircraft');}},
      dispose(){pendingCascades.length=0;teams.clear();states.clear();rounds.clear();deaths.clear();publicMounts.clear();pending=null;}
    };
  }
  return {capabilities:[{id:ID,create}]};
}
