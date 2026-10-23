// This range's opening only. Ordinary maps never receive test resources or pieces.
function createShowcase(sdk, host, balances) {
  const layout = /* SHOWCASE_LAYOUT */ null;
  const {game} = host, map = game.st.cfg.customMap;
  let hash = 2166136261;
  for (const c of JSON.stringify((map?.units ?? []).map(u=>[u.id,u.owner,u.x,u.y,u.a??0]))) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const active = !!map && map.name === layout.name && map.w === layout.w && map.h === layout.h && hash === layout.signature;
  let ready = false;
  const paused = new Set();
  return {
    active,
    paused(e) { return paused.has(e.id); },
    activate(e) { return paused.delete(e.id); },
    prepare() {
      if (!active) return;
      if (ready) {
        for (const id of paused) {
          const e = game.st.ents.get(id);
          if (!e || e.dead || !e.holdFire || e.orders.length || e.prod?.queue.length || e.research?.queue.length) paused.delete(id);
        }
        return;
      }
      ready = true;
      // Map owners name spawn slots, which need not equal the seated player index.
      const owner = game.st.cfg.players.findIndex((p, i) => (p.spawn ?? i) === 0);
      if (owner >= 0) {
        for (const [id, x, y, a] of layout.overflow) {
          const d = sdk.getDef(id), fw = d.kind === 'building' ? d.fw : 1, fh = d.kind === 'building' ? d.fh : 1;
          sdk.newEnt(game.st, id, owner, (x + fw/2)*32, (y + fh/2)*32, a*Math.PI/180, 'spawn');
        }
        game.st.players[owner].metal += 1000000;
        balances.set(owner, {...balances.get(owner), experimental: 100000});
      }
      for (const e of game.st.ents.values()) {
        e.holdFire = true; e.holdPos = true;
        if (sdk.getDef(e.defId).extensions?.[host.id]) paused.add(e.id);
      }
      game.recomputePop();
      return true;
    },
    snapshot(view) { return active ? {ready,paused:[...paused].filter(id=>game.st.ents.has(id)&&!game.st.ents.get(id).dead&&(!view||view.privateEntity(id)))} : undefined; },
    restore(value) {
      if (value !== undefined && (!active || typeof value?.ready !== 'boolean')) throw Error('Invalid EK showcase state');
      ready = value?.ready ?? false;
      if (value?.paused !== undefined && (!Array.isArray(value.paused) || value.paused.some(id=>!Number.isSafeInteger(id)||!game.st.ents.has(id)))) throw Error('Invalid EK showcase specimens');
      paused.clear();
      for (const id of value?.paused ?? []) paused.add(id);
    },
  };
}
