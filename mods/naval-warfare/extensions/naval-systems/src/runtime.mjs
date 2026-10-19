// All gameplay here belongs to this mod. Factories receive only the public host SDK.
export default function (sdk) {
  const ID='naval-warfare.systems-v1';
  const norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const text={energy:['Energy','能量','에너지'],ammo:['Ammunition','弹药','탄약'],busy:['Action progress','操作进度','행동 진행'],
    launch:['Launch aircraft','放飞舰载机','함재기 출격'],recover:['Recover aircraft','回收飞机','항공기 회수'],cancel:['Cancel action','取消操作','행동 취소']};
  function create(host) {
    const game=host.game, states=new Map(), rounds=new Map(), deaths=new Map(), publicMounts=new Map();
    let pending=null;
    const cfg=e=>host.config(sdk.getDef(e.defId));
    const alive=e=>e&&!e.dead;
    const priceLabel=a=>a.name.map((name,i)=>name+(a.spawns?' · '+a.spawns.map((s,j)=>(a.spawnNames?.[j]?.[i]??s.unit)+' ×'+s.count).join(', '):'')+(a.cost||a.time?' · '+Math.round(a.cost*100)/100+' '+['metal','金属','금속'][i]+' / '+Math.round(a.time*100)/100+['s','秒','초'][i]:''));
    const action=(c,id)=>c?.actions.find(a=>a.id===id)??(id.startsWith('construct/')?c?.construction?.filter(a=>a.unit===id.slice(10)).map(a=>({...a,id,build:a.unit,cooldown:0,canCancel:true,queue:false}))[0]:undefined);
    const fits=(stock,costs)=>Object.entries(costs??{}).every(([k,v])=>(stock[k]??0)+1e-8>=v);
    const take=(stock,costs)=>{for(const[k,v]of Object.entries(costs??{}))stock[k]=Math.max(0,(stock[k]??0)-v);};
    const ensure=e=>{
      const c=cfg(e);if(!c)return;
      let s=states.get(e.id);
      if(!s){s={definition:e.defId,stocks:{...c.initial,energy:c.energyMax*c.energyStart},guns:{},mounts:{},cooldowns:{},initialized:false,recharging:false,age:0};states.set(e.id,s);}
      if(s.definition!==e.defId){s.definition=e.defId;s.stocks.energy=Math.min(c.energyMax,s.stocks.energy??c.energyMax);}
      for(const m of c.mounts) s.mounts[m.id]??={angle:e.angle+m.rest,previous:e.angle+m.rest};
      for(const g of c.guns) s.guns[g.id]??={cd:0,warm:0,target:0};
      return s;
    };
    function mountPose(e,c,s,id,visited=new Set()) {
      const m=c.mounts.find(m=>m.id===id);if(!m||visited.has(id))return{x:e.x,y:e.y,angle:e.angle};
      visited.add(id);
      const parent=m.parent?mountPose(e,c,s,m.parent,visited):{x:e.x,y:e.y,angle:e.angle};
      const a=parent.angle+Math.PI/2;
      const angle=s.mounts[id]?.angle??e.angle+m.rest,age=game.st.time-(s.guns[id]?.firedAt??-1e9);
      const amount=m.recoilOut>0&&age<m.recoilOut?age/m.recoilOut:Math.max(0,1-(age-m.recoilOut)/Math.max(.001,m.recoilReturn));
      const recoil=(m.recoil??0)*amount;
      return{x:parent.x+m.x*Math.cos(a)-m.y*Math.sin(a)+Math.cos(angle)*recoil,y:parent.y+m.x*Math.sin(a)+m.y*Math.cos(a)+Math.sin(angle)*recoil,angle};
    }
    function rotateMounts(e,c,s,dt) {
      for(const m of c.mounts){const v=s.mounts[m.id];v.previous=v.angle;
        const parent=m.parent?s.mounts[m.parent]?.angle??e.angle:e.angle;
        const gun=c.guns.find(g=>g.mount===m.id)||c.guns.find(g=>c.mounts.find(a=>a.id===g.mount)?.parent===m.id);
        const target=game.st.ents.get(gun?s.guns[gun.id]?.target:0);
        const pose=mountPose(e,c,s,m.id);
        let desired=alive(target)?Math.atan2(target.y-pose.y,target.x-pose.x):parent+m.rest;
        if(m.slave){v.angle=norm(parent+m.rest);continue;}
        const rel=Math.max(-m.arc,Math.min(m.arc,norm(desired-parent-m.rest)));
        desired=parent+m.rest+rel;
        if(m.spin&&!alive(target))v.angle=norm(v.angle+m.spin*dt);
        else if(m.turn===0)v.angle=norm(parent+m.rest);
        else{const delta=norm(desired-v.angle);v.angle=norm(v.angle+Math.sign(delta)*Math.min(Math.abs(delta),m.turn*dt));}
      }
    }
    function permitted(e,c,s,g,target) {
      if(!alive(target)||target.inside||target.id===e.id||game.st.players[target.owner]?.team===game.st.players[e.owner]?.team)return false;
      if(!host.visible(target,game.st.players[e.owner].team))return false;
      const td=sdk.getDef(target.defId),cat=sdk.targetCat(game.st,target);
      if(!g.weapon.targets.includes(cat))return false;
      if(g.requiredTags?.length&&!g.requiredTags.some(tag=>(cfg(target)?.tags??[]).includes(tag)))return false;
      const dist=Math.hypot(target.x-e.x,target.y-e.y)-td.radius;
      if(dist>g.range*32||dist<(g.minRange??0)*32)return false;
      const m=c.mounts.find(m=>m.id===g.mount),parent=m.parent?s.mounts[m.parent]?.angle??e.angle:e.angle;
      const angle=Math.atan2(target.y-e.y,target.x-e.x);
      if(Math.abs(norm(angle-parent-m.rest))>m.arc+.01)return false;
      // A source runtime expression is never treated as an always-true predicate.
      if(g.condition&&g.condition.toLowerCase()==='if self.flying'&&(sdk.getDef(e.defId).domain!=='air'||e.inside))return false;
      if(g.condition&&!['true','if true','if self.flying'].includes(g.condition.toLowerCase()))return false;
      return host.canFire(e,host.effectiveDef(e),g.weapon,target,target);
    }
    function choose(e,c,s,g) {
      const current=game.st.ents.get(s.guns[g.id].target);
      if(permitted(e,c,s,g,current))return current;
      const explicit=game.st.ents.get(e.orders[0]?.targetId??e.targetId);
      if(permitted(e,c,s,g,explicit))return explicit;
      let best=null,distance=Infinity;
      for(const t of game.st.ents.values())if(permitted(e,c,s,g,t)){
        const d=Math.hypot(t.x-e.x,t.y-e.y);if(d<distance){best=t;distance=d;}
      }
      return best;
    }
    function fire(e,d,c,s,g,target,point,intercept) {
      const pose=mountPose(e,c,s,g.mount);
      const emitter={...e,x:pose.x,y:pose.y,angle:pose.angle,turretAngle:pose.angle};
      const weapon={...g.weapon,muzzleOffset:g.muzzle,muzzlePoints:[{forward:g.muzzle,lateral:g.lateral}],turret:true,
        range:g.range,reload:g.reload,splash:Math.min(500,g.radius),friendlyFire:g.friendlyFire};
      pending={gun:g,source:e.defId,intercept};
      try{host.fireShot(game.st,emitter,{...d,turretSprite:undefined,turretMounts:undefined},weapon,target,point??null);}finally{pending=null;}
      take(s.stocks,g.costs);
      if(c.fullRecharge&&s.stocks.energy<=1e-8)s.recharging=true;
      s.guns[g.id].cd=g.reload;s.guns[g.id].warm=0;
      s.guns[g.id].firedAt=game.st.time;
      if(g.linked&&s.guns[g.linked])s.guns[g.linked].cd=Math.max(s.guns[g.linked].cd,g.reload);
    }
    function hasSpace(e,c,batch) {
      const d=sdk.getDef(e.defId),cap=c.capacity??d.transportCap??0;
      const current=(e.cargo??[]).reduce((n,id)=>{const p=game.st.ents.get(id);return n+(alive(p)?(c.airCargo?1:sdk.cargoWeight(sdk.getDef(p.defId))):0);},0);
      const needed=batch.reduce((n,x)=>n+x.count*(c.airCargo?1:sdk.cargoWeight(sdk.getDef(x.unit))),0);
      return current+needed<=cap;
    }
    function spawnBatch(e,c,batch,inside) {
      const st=game.st;
      if(inside&&!hasSpace(e,c,batch))return false;
      const count=batch.reduce((n,x)=>n+x.count*sdk.getDef(x.unit).pop,0);
      const p=st.players[e.owner],used=[...st.ents.values()].filter(u=>alive(u)&&u.owner===e.owner).reduce((n,u)=>n+sdk.getDef(u.defId).pop,0);
      if(p.popCap!==undefined&&used+count>p.popCap)return false;
      const placements=[];
      if(!inside)for(const item of batch)for(let i=0;i<item.count;i++){
        const d=sdk.getDef(item.unit);let spot;
        for(let j=0;j<96&&!spot;j++){
          const a=j*2.399963229728653,dist=sdk.getDef(e.defId).radius+d.radius+12+Math.floor(j/12)*16;
          const x=e.x+Math.cos(a)*dist,y=e.y+Math.sin(a)*dist;
          if(sdk.passable(st,d.domain,Math.floor(x/32),Math.floor(y/32))&&!placements.some(p=>Math.hypot(p.x-x,p.y-y)<d.radius*2)&&![...st.ents.values()].some(t=>alive(t)&&!t.inside&&sdk.getDef(t.defId).domain!=='air'&&d.domain!=='air'&&Math.hypot(t.x-x,t.y-y)<d.radius+sdk.getDef(t.defId).radius))spot={x,y};
        }
        if(!spot)return false;placements.push(spot);
      }
      let place=0;
      for(const item of batch)for(let i=0;i<item.count;i++){
        const d=sdk.getDef(item.unit);
        let x=e.x,y=e.y;
        if(!inside){({x,y}=placements[place++]);}
        const u=sdk.newEnt(st,item.unit,e.owner,x,y,e.angle,'spawn');
        if(inside){u.inside=e.id;(e.cargo??=[]).push(u.id);}
      }
      return true;
    }
    function release(e,c) {
      let done=false,i=0;
      for(const id of [...(e.cargo??[])]){
        const u=game.st.ents.get(id);if(!alive(u)||sdk.getDef(u.defId).domain!=='air')continue;
        const angle=e.angle+(i++%3-1)*.5;
        u.inside=undefined;u.x=u.prevX=e.x+Math.cos(angle)*(sdk.getDef(e.defId).radius+24);u.y=u.prevY=e.y+Math.sin(angle)*(sdk.getDef(e.defId).radius+24);
        e.cargo=e.cargo.filter(v=>v!==id);u.orders=[];sdk.cmdMove(game,[id],u.x+Math.cos(angle)*80,u.y+Math.sin(angle)*80);done=true;
      }
      return done;
    }
    function affordable(e,s,a) {
      const player=game.st.players[e.owner];
      return (!s.job||a.queue&&(s.queue?.length??0)<32)&&(s.cooldowns[a.id]??0)<=0&&player.metal>=a.cost&&fits(s.stocks,a.stocks)&&(!a.spawns||!a.into||hasSpace(e,cfg(e),a.spawns));
    }
    function constructionSpot(e,c,a){const d=sdk.getDef(a.unit),limit=c.buildRange+d.radius;
      for(let i=0;i<100;i++){const angle=i*2.399963229728653,distance=Math.min(limit,32+Math.floor(i/10)*24),tx=Math.round((e.x+Math.cos(angle)*distance)/32-(d.fw??1)/2),ty=Math.round((e.y+Math.sin(angle)*distance)/32-(d.fh??1)/2);
        const x=(tx+(d.fw??1)/2)*32,y=(ty+(d.fh??1)/2)*32;
        if(Math.hypot(x-e.x,y-e.y)<=limit&&!sdk.canPlace(game.st,e.owner,a.unit,tx,ty,{builders:[e]}))return{x,y};
      }
    }
    function finish(e,c,s,job) {
      const actionCfg=job.origin?host.config(sdk.getDef(job.origin)):c;
      const a=action(actionCfg,job.action);if(!a){delete s.job;return;}
      if(a.build){const site=game.st.ents.get(job.siteId);if(alive(site)){site.site=undefined;site.hp=sdk.maxHp(site);}}
      if(a.spawns&&!spawnBatch(e,c,a.spawns,a.into)){s.job.remaining=.1;return;}
      if(a.gun){const g=c.guns.find(g=>g.id===a.gun);if(g)fire(e,sdk.getDef(e.defId),c,s,g,null,{x:job.x,y:job.y});}
      if(a.gain)game.st.players[e.owner].metal=Math.max(0,game.st.players[e.owner].metal+a.gain);
      for(const[k,v]of Object.entries(a.addStocks??{}))s.stocks[k]=(s.stocks[k]??0)+v;
      if(a.clearOrders){e.orders=[];e.targetId=0;}
      if(a.returnMorph){const hp=e.hp/sdk.getDef(e.defId).hp;sdk.setEntityDef(e,a.returnMorph);e.hp=hp*sdk.getDef(e.defId).hp;}
      s.cooldowns[a.id]=a.cooldown;delete s.job;if(s.queue?.length)s.job=s.queue.shift();
    }
    return {
      id:ID,
      beforeStep(dt) {
        for(const e of host.participants()){
          if(!alive(e))continue;const c=cfg(e),s=ensure(e);s.age+=dt;
          if(!s.initialized){s.initialized=true;if(c.startCargo.length){let room=c.capacity;const batch=[];for(const item of c.startCargo){const weight=c.airCargo?1:sdk.cargoWeight(sdk.getDef(item.unit));const count=Math.min(item.count,Math.floor(room/weight));if(count){batch.push({...item,count});room-=count*weight;}}spawnBatch(e,c,batch,true);}}
          if(e.site||e.inside)continue;
          const regen=s.recharging?(c.rechargingRegen??c.energyRegen):c.energyRegen;
          s.stocks.energy=Math.max(0,Math.min(c.energyMax,(s.stocks.energy??0)+regen*dt));
          if(s.stocks.energy>=c.energyMax-1e-8)s.recharging=false;
          if(c.dieOnZeroEnergy&&s.stocks.energy<=0)host.applyDamage(game.st,e,e.hp+1,undefined,e.owner,e.id,e.defId+'/meltdown');
          if(e.dead)continue;
          for(const t of c.transitions??[])if(t.above?s.stocks.energy>t.threshold:s.stocks.energy<t.threshold){const hp=e.hp/sdk.getDef(e.defId).hp;sdk.setEntityDef(e,t.to);e.hp=hp*sdk.getDef(e.defId).hp;break;}
          e.hp=Math.min(sdk.maxHp(e),e.hp+c.regen*dt);
          for(const [id,value]of Object.entries(s.cooldowns))s.cooldowns[id]=Math.max(0,value-dt);
          for(const r of c.rearm){if([...game.st.ents.values()].some(t=>alive(t)&&!t.inside&&t.owner===e.owner&&(cfg(t)?.tags??[]).includes(r.tag)&&Math.hypot(t.x-e.x,t.y-e.y)<=r.range))s.stocks[r.stock]=r.amount;}
          for(const id of e.cargo??[]){const u=game.st.ents.get(id);if(alive(u))u.hp=Math.min(sdk.maxHp(u),u.hp+c.cargoHeal*dt);}
          if(s.recover){const u=game.st.ents.get(s.recover);if(!alive(u)||u.owner!==e.owner||u.inside){delete s.recover;}
            else if(Math.hypot(u.x-e.x,u.y-e.y)<sdk.getDef(e.defId).radius+40&&hasSpace(e,c,[{unit:u.defId,count:1}])){
              u.inside=e.id;u.orders=[];u.targetId=0;u.x=u.prevX=e.x;u.y=u.prevY=e.y;(e.cargo??=[]).push(u.id);delete s.recover;
            }else sdk.cmdMove(game,[u.id],e.x,e.y);
          }
          if(s.job){
            if(s.job.siteId){const site=game.st.ents.get(s.job.siteId),a=action(host.config(sdk.getDef(s.job.origin)),s.job.action);
              if(!alive(site)){delete s.job;continue;}
              if(Math.hypot(site.x-e.x,site.y-e.y)>c.buildRange+sdk.getDef(site.defId).radius)continue;
              const maximum=sdk.maxHp(site);site.hp=Math.min(maximum,site.hp+maximum*dt/Math.max(.001,a.time));s.job.remaining=(maximum-site.hp)/maximum*a.time;
            }else s.job.remaining-=dt;
            if(s.job.remaining<=0)finish(e,c,s,s.job);
          }
          rotateMounts(e,c,s,dt);
        }
      },
      effectiveDef(e,d){const c=cfg(e);if(!c)return d;const s=ensure(e);
        return {...d,regen:0,weapons:c.guns.filter(g=>!g.manual).map(g=>({...g.weapon,range:g.range,reload:g.reload})),
          ...(c.airCargo?{transportDomain:'air',transportMaxWeight:1}:{}),...(s.job&&s.job.lock?{speed:0}:{})};
      },
      canFire(e,d,w){const c=cfg(e);if(!c)return true;const s=ensure(e),g=c.guns.find(g=>g.id===w.id);return !g||!s.recharging&&fits(s.stocks,g.costs);},
      wrapAI(next){return(g,player)=>{
        next(g,player);
        const own=[...g.st.ents.values()].filter(e=>alive(e)&&e.owner===player.idx);
        for(const e of host.participants())if(alive(e)&&e.owner===player.idx&&!e.site&&!e.inside){
          const c=cfg(e),s=ensure(e);if(s.job)continue;
          if(c.construction?.length){
            let choices=c.construction.filter(a=>player.metal>=a.cost&&!own.some(t=>t.defId===a.unit));
            if(c.mobileBuilder)choices=choices.filter(a=>host.config(sdk.getDef(a.unit))?.construction);
            else if(!own.some(t=>!sdk.getDef(t.defId).isHQ&&(sdk.getDef(t.defId).metalRate??0)>0))choices=choices.filter(a=>(sdk.getDef(a.unit).metalRate??0)>0).sort((a,b)=>(sdk.getDef(b.unit).metalRate??0)/Math.max(1,b.cost)-(sdk.getDef(a.unit).metalRate??0)/Math.max(1,a.cost));
            else choices=choices.filter(a=>host.config(sdk.getDef(a.unit))?.actions.some(a=>a.spawns)).sort((a,b)=>a.cost-b.cost);
            for(const a of choices){const point=constructionSpot(e,c,a);if(point&&sdk.cmdContentAction(g,ID,{owner:player.idx,ids:[e.id],action:'construct/'+a.unit,...point}))break;}
          }
          if(s.job)continue;
          if(c.airCargo&&e.cargo?.length&&[...g.st.ents.values()].some(t=>alive(t)&&g.st.players[t.owner]?.team!==player.team&&host.visible(t,player.team)&&Math.hypot(t.x-e.x,t.y-e.y)<1600)){
            sdk.cmdContentAction(g,ID,{owner:player.idx,ids:[e.id],action:'launch'});continue;
          }
          const candidates=c.actions.filter(a=>a.spawns&&affordable(e,s,a));
          if(candidates.length){const a=candidates[(g.st.tick+e.id)%candidates.length];sdk.cmdContentAction(g,ID,{owner:player.idx,ids:[e.id],action:a.id});}
        }
      };},
      wrapWeapons(next){return(st,e,d,target,dt,powerFactor,...rest)=>{
        const c=cfg(e);if(!c)return next(st,e,d,target,dt,powerFactor,...rest);
        if(e.holdFire||e.site||e.inside||e.dead||e.emp)return;
        const s=ensure(e);
        for(const g of c.guns){const clock=s.guns[g.id];clock.cd=Math.max(0,clock.cd-dt);if(g.manual||clock.cd>0||s.recharging||!fits(s.stocks,g.costs))continue;
          let intercepted;
          if(g.intercept.length)intercepted=st.projs.find(p=>!p.downed&&p.team!==st.players[e.owner].team&&Math.hypot(p.x-e.x,p.y-e.y)<=g.range*32&&g.intercept.some(tag=>rounds.get(p.id)?.gun.tags.includes(tag)||tag==='nuke'&&p.kind==='nuke'));
          if(intercepted){fire(e,d,c,s,g,null,{x:intercepted.x,y:intercepted.y},intercepted.id);continue;}
          const t=choose(e,c,s,g);if(!t){clock.target=0;clock.warm=0;continue;}
          if(clock.target!==t.id){clock.target=t.id;clock.warm=0;}
          clock.warm+=dt;
          const pose=mountPose(e,c,s,g.mount);const bearing=Math.atan2(t.y-pose.y,t.x-pose.x);
          if(clock.warm+1e-8<g.warmup||Math.abs(norm(bearing-pose.angle))>.3)continue;
          fire(e,d,c,s,g,t);
        }
      };},
      onShot(e,d,w,p){if(!pending||d.id!==pending.source||w.id!==pending.gun.id)return;
        p.id??=game.st.nextProjId++;const meta={gun:pending.gun,source:pending.source};rounds.set(p.id,meta);
        p.ttl=pending.gun.life;p.speed=pending.gun.weapon.speed;
        p.mult={light:1,medium:1,heavy:1,ship:1,sub:1,air:1,structure:1};
        if(pending.intercept)p.hitProj=pending.intercept;
      },
      guideProjectile(p,dt){const m=rounds.get(p.id);if(!m)return false;const g=m.gun;
        if(g.acceleration)p.speed=Math.min(g.targetSpeed,p.speed+g.acceleration*dt);
        else p.speed=g.targetSpeed||p.speed;
        if(!p.homing||!p.targetId)return false;const t=game.st.ents.get(p.targetId);if(!alive(t))return false;
        const delta=norm(Math.atan2(t.y-p.y,t.x-p.x)-p.angle);p.angle=norm(p.angle+Math.sign(delta)*Math.min(Math.abs(delta),g.turnSpeed*dt));p.tx=t.x;p.ty=t.y;return true;
      },
      wrapImpact(next){return(st,hash,p,direct,terrain)=>{
        const meta=rounds.get(p.id);if(!meta)return next(st,hash,p,direct,terrain);
        const g=meta.gun;
        const harm=(t,raw,area)=>{
          if(!alive(t)||t.inside||raw<=0)return;
          if(!g.friendlyFire&&st.players[t.owner]?.team===p.team)return;
          const td=sdk.getDef(t.defId),tc=cfg(t),tags=tc?.tags??[];
          if(area&&!g.bothLayers&&!g.weapon.targets.includes(sdk.targetCat(st,t)))return;
          let amount=raw*(td.kind==='building'?g.buildingMult:1);
          for(const m of g.mutators)if(m.tags.some(tag=>tags.includes(tag)))amount*=area?m.area:m.direct;
          if(tc)amount=Math.max(tc.minDamage,amount-Math.max(0,tc.armor-g.ignoreArmor));
          if(t.rs?.shield>0&&g.shieldMult!==1){const before=t.rs.shield,spent=Math.min(before,amount*g.shieldMult);t.rs.shield-=spent;amount=Math.max(0,amount-spent/Math.max(.000001,g.shieldMult));}
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
        sdk.addEffect(st,g.nuclear?'fx.nuke':'fx.expl.m',p.x,p.y,g.nuclear?3:.5,g.nuclear?10:6,g.nuclear?4:1);
        rounds.delete(p.id);
      };},
      onDamage(context){const e=context.target,c=cfg(e);if(e.dead&&c?.deathBlast&&!deaths.has(e.id))deaths.set(e.id,{id:e.id,owner:e.owner,x:e.x,y:e.y,definition:e.defId,blast:c.deathBlast});},
      afterStep(dt){
        const liveRounds=new Set(game.st.projs.map(p=>p.id));for(const id of rounds.keys())if(!liveRounds.has(id))rounds.delete(id);
        for(const [id,d]of deaths){deaths.delete(id);const b=d.blast;for(const t of game.st.ents.values())if(alive(t)&&!t.inside&&Math.hypot(t.x-d.x,t.y-d.y)<=b.radius)host.applyDamage(game.st,t,b.damage,undefined,d.owner,d.id,d.definition+'/death');sdk.addEffect(game.st,'fx.nuke',d.x,d.y,3,10,4);}
        for(const [id,s]of states){const e=game.st.ents.get(id);if(alive(e)){ensure(e);if(s.job?.siteId&&!alive(game.st.ents.get(s.job.siteId)))delete s.job;continue;}
          states.delete(id);
        }
      },
      actions(e){const c=cfg(e);if(!c)return[];const s=ensure(e);if(e.site||e.inside)return[];
        return [...c.actions.map(a=>({id:a.id,label:priceLabel(a),enabled:affordable(e,s,a),...(a.gun?{target:'ground'}:{})})),
          ...(c.mobileBuilder?[]:c.construction??[]).map(a=>{const id='construct/'+a.unit;return{id,label:priceLabel(a),enabled:affordable(e,s,action(c,id)),target:'ground'};}),
          ...(c.airCargo?[{id:'launch',label:text.launch,enabled:!!e.cargo?.length},{id:'recover',label:text.recover,enabled:!s.recover,target:'own'}]:[]),
          ...(s.job?[{id:'cancel',label:text.cancel,enabled:!!action(host.config(sdk.getDef(s.job.origin??e.defId)),s.job.action)?.canCancel}]:[])];
      },
      order(o){let changed=false;for(const id of o.ids){const e=game.st.ents.get(id);if(!alive(e)||e.owner!==o.owner||e.inside||e.site)continue;const c=cfg(e);if(!c)continue;const s=ensure(e);
        if(o.action==='cancel'&&s.job){const a=action(host.config(sdk.getDef(s.job.origin??e.defId)),s.job.action);if(!a?.canCancel)continue;game.st.players[e.owner].metal+=a?.cost??0;for(const[k,v]of Object.entries(a?.stocks??{}))s.stocks[k]=(s.stocks[k]??0)+v;if(s.job.siteId){const site=game.st.ents.get(s.job.siteId);if(alive(site)){sdk.markBlocked(game.st,site,0);game.st.ents.delete(site.id);}}if(a?.returnMorph){const hp=e.hp/sdk.getDef(e.defId).hp;sdk.setEntityDef(e,a.returnMorph);e.hp=hp*sdk.getDef(e.defId).hp;}delete s.job;if(s.queue?.length)s.job=s.queue.shift();changed=true;continue;}
        if(o.action==='launch'&&c.airCargo){changed=release(e,c)||changed;continue;}
        if(o.action==='recover'&&c.airCargo&&!s.recover){const u=game.st.ents.get(o.targetId);if(alive(u)&&u.owner===e.owner&&!u.inside&&sdk.getDef(u.defId).domain==='air'&&hasSpace(e,c,[{unit:u.defId,count:1}])){s.recover=u.id;changed=true;}continue;}
        const a=action(c,o.action);if(!a||!affordable(e,s,a))continue;
        if((a.gun||a.build)&&(!Number.isFinite(o.x)||!Number.isFinite(o.y)||o.x<0||o.y<0||o.x>game.st.map.w*32||o.y>game.st.map.h*32))continue;
        let foundation;
        if(a.build){const d=sdk.getDef(a.build),tx=Math.round(o.x/32-(d.fw??1)/2),ty=Math.round(o.y/32-(d.fh??1)/2),x=(tx+(d.fw??1)/2)*32,y=(ty+(d.fh??1)/2)*32;
          if(Math.hypot(x-e.x,y-e.y)>c.buildRange+d.radius||sdk.canPlace(game.st,e.owner,a.build,tx,ty,{builders:[e]}))continue;
          foundation={x,y};
        }
        game.st.players[e.owner].metal-=a.cost;game.st.players[e.owner].stats.metalSpent+=a.cost;take(s.stocks,a.stocks);
        const job={action:a.id,origin:e.defId,remaining:a.time,total:a.time,...(a.gun?{x:o.x,y:o.y}:{})};if(s.job)(s.queue??=[]).push(job);else s.job=job;
        if(foundation){const site=sdk.newEnt(game.st,a.build,e.owner,foundation.x,foundation.y,0,'site');site.site=true;site.hp=1;job.siteId=site.id;}
        if(a.temporaryMorph){const hp=e.hp/sdk.getDef(e.defId).hp;sdk.setEntityDef(e,a.temporaryMorph);e.hp=hp*sdk.getDef(e.defId).hp;}changed=true;
      }return changed;},
      inspect(e,privateView){if(!privateView)return[];const c=cfg(e),s=c&&ensure(e);if(!s)return[];
        return[...(c.energyMax?[{id:'energy',label:text.energy,value:s.stocks.energy,fraction:s.stocks.energy/c.energyMax}]:[]),
          ...Object.entries(s.stocks).filter(([k])=>k!=='energy').map(([k,v])=>({id:'stock/'+k,label:text.ammo,value:v})),
          ...(s.job?[{id:'job',label:text.busy,fraction:1-s.job.remaining/Math.max(.001,s.job.total)}]:[])];
      },
      render(e){if(publicMounts.has(e.id))return publicMounts.get(e.id);const c=cfg(e),s=c&&ensure(e);if(!s)return;
        const a=e.angle+Math.PI/2;
        return{mounts:c.mounts.filter(m=>m.sprite).map(m=>({...mountPose(e,c,s,m.id),previous:s.mounts[m.id].previous,sprite:m.sprite})),
          deck:(c.attachments??[]).flatMap((m,i)=>{const u=game.st.ents.get(e.cargo?.[i]);if(!alive(u))return[];const d=sdk.getDef(u.defId);return[{x:e.x+m.x*Math.cos(a)-m.y*Math.sin(a),y:e.y+m.x*Math.sin(a)+m.y*Math.cos(a),angle:e.angle+m.angle,sprite:d.sprite??'u.'+d.id}];})};
      },
      snapshot(view){const entities={},visuals={};for(const[id,s]of states)if(!view||view.privateEntity(id))entities[id]=structuredClone(s);
        if(view)for(const e of host.participants())if(view.visibleEntities.has(e.id)&&!view.privateEntity(e.id))visuals[e.id]=this.render(e);
        const projectiles={};for(const[id,m]of rounds)if(!view||view.visibleProjectiles.has(id))projectiles[id]={source:m.source,gun:m.gun.id};
        return{version:1,entities,projectiles,visuals};
      },
      restore(value){
        if(!value||value.version!==1||typeof value.entities!=='object'||typeof value.projectiles!=='object')throw Error('Invalid Naval Warfare state');
        const newStates=new Map(),newRounds=new Map();
        for(const[id,s]of Object.entries(value.entities)){
          const e=game.st.ents.get(+id),c=e&&cfg(e);if(!c||!s||s.definition!==e.defId||!s.stocks||!s.guns||!s.mounts||!s.cooldowns||!Number.isFinite(s.age)||s.age<0)throw Error('Invalid Naval Warfare entity '+id);
          for(const v of Object.values(s.stocks))if(!Number.isFinite(v)||v<0||v>1e12)throw Error('Invalid ammunition stock');
          for(const g of c.guns){const x=s.guns[g.id];if(!x||![x.cd,x.warm,x.target].every(Number.isFinite)||x.cd<0||x.warm<0)throw Error('Invalid firing clock');}
          for(const m of c.mounts){const x=s.mounts[m.id];if(!x||!Number.isFinite(x.angle)||!Number.isFinite(x.previous))throw Error('Invalid turret angle');}
          if(s.queue&&(!Array.isArray(s.queue)||s.queue.length>32))throw Error('Invalid action queue');
          for(const job of [s.job,...(s.queue??[])].filter(Boolean)){
            const jc=host.config(sdk.getDef(job.origin??e.defId)),a=action(jc,job.action);
            if(!a||!Number.isFinite(job.remaining)||!Number.isFinite(job.total)||job.remaining<0||job.total<0||job.remaining>job.total+.1||a.gun&&(!Number.isFinite(job.x)||!Number.isFinite(job.y)))throw Error('Invalid action job');
          }
          newStates.set(+id,structuredClone(s));
        }
        for(const[id,m]of Object.entries(value.projectiles)){const d=sdk.getDef(m.source),g=host.config(d)?.guns.find(g=>g.id===m.gun);if(!g)throw Error('Invalid source projectile');newRounds.set(+id,{source:m.source,gun:g});}
        states.clear();rounds.clear();publicMounts.clear();for(const[id,s]of newStates)states.set(id,s);for(const[id,s]of newRounds)rounds.set(id,s);
        for(const[id,v]of Object.entries(value.visuals??{}))if(game.st.ents.has(+id)&&v&&Array.isArray(v.mounts)&&v.mounts.every(m=>[m.x,m.y,m.angle,m.previous].every(Number.isFinite)))publicMounts.set(+id,structuredClone(v));
      },
      validateRestoredState(){for(const[id,s]of states){const e=game.st.ents.get(id);if(!e||!cfg(e))throw Error('Orphan Naval Warfare state');if(s.recover&&!game.st.ents.has(s.recover))throw Error('Missing recovery aircraft');}},
      dispose(){states.clear();rounds.clear();deaths.clear();publicMounts.clear();pending=null;}
    };
  }
  return {capabilities:[{id:ID,create}]};
}
