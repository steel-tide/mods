// Mod-owned source energy magazines. Native weapons, orders and damage stay authoritative.
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
    return {
      id:ID,
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
      onShot(e,d,w) {
        const c=config(e),cost=c?.energy?.usage[w.id];if(!cost)return;
        const s=ensure(e);s.energy=Math.max(0,s.energy-cost);
        const minimum=Math.min(...Object.values(c.energy.usage));
        if(s.energy+1e-8<minimum&&(c.energy.full||c.reloadTime))begin(c,s);
        if(s.recharging&&c.dockRecharge&&e.wingOf){const carrier=game.st.ents.get(e.wingOf),wing=carrier&&sdk.getDef(carrier.defId).wing;if(wing)e.sortie=Math.max(e.sortie??0,wing.sortie);}
      },
      actions(e) {
        const c=config(e);if(!c?.reloadTime)return[];
        const s=ensure(e);
        return[{id:'reload',label:['Reload magazine','更换弹夹','탄창 재장전'],enabled:!e.site&&!e.inside&&!s.recharging&&s.energy<c.energy.max}];
      },
      order(o) {
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
        return[{id:'energy',label:['Magazine / energy','弹夹 / 能量','탄창 / 에너지'],value:Math.round(s.energy*100)/100,fraction:s.energy/c.energy.max,tone:s.recharging?'warning':'normal'},
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
