// Source magazines and Widow mines, using the host's orders, projectiles and damage.
export default function (sdk) {
  const ID = 'fg-rusted-league.source-v1';
  return {capabilities: [{id: ID, create(host) {
    const states = new Map(), game = host.game;
    const config = e => host.config(sdk.getDef(e.defId));
    const ensure = e => {
      const c = config(e); if (!c?.energy) return;
      let s = states.get(e.id);
      if (!s) { s = {energy:c.energy.max*c.energy.start, recharging:false, remaining:0, reloads:0}; states.set(e.id,s); }
      s.energy = Math.min(c.energy.max,s.energy);
      return s;
    };
    const begin = (c,s) => {
      if (s.recharging) return;
      s.recharging=true; s.remaining=c.reloadTime??0; s.reloads++;
    };
    const mineDef = p => sdk.DEFS[p.gun.split('/')[0]];
    const validTarget = (t,team,w) => t&&!t.dead&&!t.inside&&!t.locked&&
      game.st.players[t.owner]?.team!==team&&!sdk.getDef(t.defId).untargetable&&
      sdk.getDef(t.defId).domain!=='air'&&w.targets.includes(sdk.targetCat(game.st,t));
    const nearbyTarget = (at,team,w) => {
      let best=null,distance=Infinity;
      game.hash.query(at.x,at.y,w.range*sdk.TILE+200,t=>{
        if(!validTarget(t,team,w)||!host.visible(t,team))return;
        const d=Math.hypot(at.x-t.x,at.y-t.y)-sdk.getDef(t.defId).radius;
        if(d<=w.range*sdk.TILE&&(d<distance||(d===distance&&t.id<best.id))){best=t;distance=d;}
      });
      return best;
    };
    const canDeploy = e => {
      const c=config(e),p=game.st.players[e.owner];
      if(!c?.mineLayer||e.dead||e.site||e.inside||e.locked||e.emp||!p)return false;
      const s=ensure(e);
      return !s.recharging&&s.energy+1e-8>=c.mineLayer.energy&&p.metal>=c.mineLayer.cost;
    };
    return {
      id:ID,
      allowOrder(e) {return !config(e)?.mine;},
      wrapBuildingStep(next) {return (e,d,dt) => {
        if(!config(e)?.mine)return next(e,d,dt);
        if(e.dead||e.site)return;
        const target=nearbyTarget(e,game.st.players[e.owner].team,d.weapons[0]);
        if(target)host.fireShot(game.st,e,d,d.weapons[0],target);
      };},
      projectileStep(p,dt) {
        const d=mineDef(p),c=d&&host.config(d)?.mine;if(!c)return;
        if((p.ttl-=dt)<=0)return 'remove';
        const w=d.weapons[0];let target=game.st.ents.get(p.targetId);
        if(!validTarget(target,p.team,w)){
          target=nearbyTarget(p,p.team,w);p.targetId=target?.id??0;
        }
        if(target){p.tx=target.x;p.ty=target.y;}
        p.px=p.x;p.py=p.y;p.angle=Math.atan2(p.ty-p.y,p.tx-p.x);
        // RW's very slow initial round accelerates to its authored target speed.
        p.speed=Math.min(c.targetSpeed,p.speed+(c.targetSpeed-c.speed)*dt);
        const distance=Math.hypot(p.tx-p.x,p.ty-p.y),travel=p.speed*dt;
        if(distance<=travel+(target?sdk.getDef(target.defId).radius:0)){
          p.x=p.tx;p.y=p.ty;
          // Source directDamage and areaDamage are separate payloads. Resolve
          // the splash once through the host to keep native FX and accounting.
          if(target)host.applyDamage(game.st,target,c.directDamage*p.dmg/w.dmg,p.mult,p.owner,p.src,p.gun,p);
          host.resolveImpact(game.st,game.hash,p,null);
          return 'remove';
        }
        p.x+=Math.cos(p.angle)*travel;p.y+=Math.sin(p.angle)*travel;
        return 'keep';
      },
      beforeStep(dt) {
        for (const [id] of states) {const e=game.st.ents.get(id);if(!e||e.dead||!config(e)?.energy)states.delete(id);}
        for (const e of host.participants()) {
          if(e.dead||e.site)continue;
          const c=config(e),s=ensure(e);
          if(e.inside){if(s&&c.dockRecharge&&e.inside===e.wingOf){s.energy=c.energy.max;s.recharging=false;s.remaining=0;}continue;}
          if(c?.decay)host.applyDamage(game.st,e,c.decay*dt,undefined,e.owner,e.id,e.defId+'/decay');
          if(!s)continue;
          const energy=c.energy;
          if(s.recharging&&c.reloadTime) {
            s.remaining=Math.max(0,s.remaining-dt);
            if(s.remaining===0){s.energy=energy.max;s.recharging=false;}
          } else {
            s.energy=Math.max(0,Math.min(energy.max,s.energy+(s.recharging?energy.recharge:energy.regen)*dt));
            if(s.energy>=energy.max-1e-8)s.recharging=false;
          }
        }
      },
      afterStep() {for(const [id]of states){const e=game.st.ents.get(id);if(!e||e.dead||!config(e)?.energy)states.delete(id);}},
      canFire(e,d,w) {
        const c=config(e),cost=c?.energy?.usage[w.id]; if(!cost)return true;
        const s=ensure(e);return !s.recharging&&s.energy+1e-8>=cost;
      },
      // Also gate burst continuations: they bypass the native acquisition pass.
      wrapShot(next) {return (st,e,d,w,...args) => {
        const c=config(e),cost=c?.energy?.usage[w.id];
        if(cost){const s=ensure(e);if(s.recharging||s.energy+1e-8<cost)return;}
        return next(st,e,d,w,...args);
      };},
      onShot(e,d,w,p) {
        const c=config(e);
        if(c?.mine){
          // Native mine launch consumes the charge without a wreck or unit loss.
          // Turn its instantaneous impact into the source's travelling seeker.
          p.id=game.st.nextProjId++;p.speed=c.mine.speed;p.ttl=c.mine.life;p.homing=true;
          const target=game.st.ents.get(p.targetId);if(target){p.tx=target.x;p.ty=target.y;}
          p.angle=Math.atan2(p.ty-p.y,p.tx-p.x);
          return;
        }
        const cost=c?.energy?.usage[w.id];if(!cost)return;
        const s=ensure(e);s.energy=Math.max(0,s.energy-cost);
        const minimum=Math.min(...Object.values(c.energy.usage));
        if(s.energy+1e-8<minimum&&(c.energy.full||c.reloadTime))begin(c,s);
        if(s.recharging&&c.dockRecharge&&e.wingOf){const carrier=game.st.ents.get(e.wingOf),wing=carrier&&sdk.getDef(carrier.defId).wing;if(wing)e.sortie=Math.max(e.sortie??0,wing.sortie);}
      },
      actions(e) {
        const c=config(e);
        if(c?.mineLayer)return [{id:'lay-mine',label:[`Deploy Widow Mine (${c.mineLayer.cost} metal)`,'部署寡妇雷（'+c.mineLayer.cost+' 金属）','위도우 지뢰 설치 ('+c.mineLayer.cost+' 금속)'],enabled:canDeploy(e)}];
        if(!c?.reloadTime)return[];
        const s=ensure(e);
        return[{id:'reload',label:['Reload magazine','更换弹夹','탄창 재장전'],enabled:!e.site&&!e.inside&&!s.recharging&&s.energy<c.energy.max}];
      },
      order(o) {
        if(o.action==='lay-mine'){
          if(!o.ids.length||new Set(o.ids).size!==o.ids.length)return false;
          const selected=o.ids.map(id=>game.st.ents.get(id));
          if(selected.some(e=>!e||e.owner!==o.owner||!config(e)?.mineLayer))return false;
          let accepted=false;
          for(const e of selected){
            if(!canDeploy(e))continue;
            const c=config(e),m=c.mineLayer,s=ensure(e),player=game.st.players[e.owner];
            // Placement only arms the mine; its seeker owns the eventual blast.
            sdk.newEnt(game.st,m.unit,e.owner,e.x,e.y,e.angle,'produce');
            player.metal-=m.cost;player.stats.metalSpent+=m.cost;s.energy=Math.max(0,s.energy-m.energy);
            if(s.energy+1e-8<m.energy&&c.energy.full)begin(c,s);
            accepted=true;
          }
          return accepted;
        }
        if(o.action!=='reload'||!o.ids.length)return false;
        const selected=o.ids.map(id=>game.st.ents.get(id));
        if(selected.some(e=>!e||e.dead||e.owner!==o.owner||e.site||e.inside||!config(e)?.reloadTime))return false;
        let accepted=false;
        for(const e of selected){const c=config(e),s=ensure(e);if(!s.recharging&&s.energy<c.energy.max){begin(c,s);accepted=true;}}
        return accepted;
      },
      inspect(e,privateView) {
        const c=config(e);if(!privateView||!c?.energy)return[];
        const s=ensure(e);
        return[{id:'energy',label:c.mineLayer?['Mine charges','地雷装药','지뢰 충전']:['Magazine / energy','弹夹 / 能量','탄창 / 에너지'],value:Math.round(s.energy*100)/100,fraction:s.energy/c.energy.max,tone:s.recharging?'warning':'normal'},
          ...(s.recharging?[{id:'reload',label:['Reloading','装填中','재장전 중'],value:s.remaining||undefined}]:[])];
      },
      render(e,privateView) {const s=states.get(e.id);return privateView&&s?{reloads:s.reloads}:{};},
      snapshot(view) {
        const entities={};
        for(const [id,s]of states)if(!view||view.privateEntity(id))entities[id]={...s};
        return {entities};
      },
      restore(raw) {
        if(!raw||typeof raw!=='object'||Array.isArray(raw)||!raw.entities||typeof raw.entities!=='object'||Array.isArray(raw.entities))throw Error('Invalid source state');
        const next=new Map();
        for(const [key,s]of Object.entries(raw.entities)) {
          if(!/^[1-9]\d*$/.test(key)||!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['energy','recharging','remaining','reloads'].includes(k))||
            !Number.isFinite(s.energy)||s.energy<0||s.energy>1e8||typeof s.recharging!=='boolean'||!Number.isFinite(s.remaining)||s.remaining<0||s.remaining>3600||!Number.isSafeInteger(s.reloads)||s.reloads<0)throw Error('Invalid magazine state');
          next.set(Number(key),{...s});
        }
        states.clear();for(const [id,s]of next)states.set(id,s);
      },
      validateRestoredState() {
        for(const [id,s]of states){const e=game.st.ents.get(id),c=e&&config(e);if(!e||e.dead||!c?.energy||s.energy>c.energy.max+1e-8||s.remaining>(c.reloadTime??0)+1e-8)throw Error('Magazine state has no matching unit');}
      },
      dispose(){states.clear();}
    };
  }}]};
}
