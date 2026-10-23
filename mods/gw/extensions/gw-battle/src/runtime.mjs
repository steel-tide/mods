// GW BattleUniverse's battle rules, as the source's damage checkers, battle
// framework and HQ resolve them. Every behavior here belongs to this mod; the
// factory receives only the public host SDK.
export default function (sdk) {
  const ID = 'gw.battle-v1';
  // Seconds a unit counts as in battle after it attacks or is hit (`inBattleTimer`).
  const BATTLE = 5;
  // A run of hits makes the next dodge likelier; ten quiet seconds clear it.
  const DODGE_CLEAR = 10;
  // RW px a blast's falloff runs past its radius, at this mod's 0.75 world px per RW px.
  const BLAST_EDGE = 40 * 0.75;
  // GW resolves the hit itself, so the armour matrix cell is always one.
  const ONE = Object.freeze({ light: 1, medium: 1, heavy: 1, structure: 1, ship: 1, sub: 1, air: 1, warhead: 1 });
  const EN = ['EN', '能量', 'EN'];
  const TECH_POINT = ['TechPoint', '科技', '테크 포인트'];
  // A computer side earns three quarters of the TechPoint (`Gen_TechPoint`).
  const AI_TECH = 0.75;

  function create(host) {
    const game = host.game;
    const states = new Map();
    // TechPoint in hand, by owner; the node whose TechPoint a lab has taken, by lab
    const techPoint = new Map(), paid = new Map();
    let clock = 0;
    const cfg = e => host.config(sdk.getDef(e.defId));
    const live = e => e && !e.dead;
    const defOfGun = gun => {
      const cut = gun.indexOf('/');
      if (cut < 0) return undefined;
      try { return sdk.getDef(gun.slice(0, cut)); } catch { return undefined; }
    };
    const weaponOfGun = gun => {
      const def = defOfGun(gun);
      const id = gun.slice(gun.indexOf('/') + 1);
      return def?.weapons.find(w => w.id === id);
    };
    const state = e => {
      let s = states.get(e.id);
      if (!s) {
        const c = cfg(e);
        s = { en: c?.en?.max ?? 0, dodge: 0, dodgeUntil: 0, battle: -1e9, x: e.x, y: e.y, spent: [] };
        states.set(e.id, s);
      }
      return s;
    };
    const engage = e => { if (live(e) && cfg(e) && sdk.getDef(e.defId).kind === 'unit') state(e).battle = game.st.time; };
    const inBattle = (e, s) => game.st.time - s.battle < BATTLE;
    const normAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

    // DamageChecker: the round connects, grazes or misses, then each payload
    // part is reduced by the target's flat and percentage defence of its kind.
    function resolve(st, t, tc, wc, sc, from, src) {
      const level = sc?.level ?? {};
      const impact = host.currentImpact;
      const primary = !impact || !impact.direct || impact.direct === t;
      const accuracy = (level.accuracy ?? 100) / 100 * (wc.accuracy ?? 100) / 100 * (primary ? 1 : 0.75);
      const sizeAcc = tc.size === 'large' ? wc.size?.largeAccuracy ?? 1 : tc.size === 'small' ? wc.size?.smallAccuracy ?? 1 : 1;
      const lv = ((wc.kind === 'cqb' ? level.cqb : level.shoot) ?? 100) / 100;
      let falloff = 1;
      if (wc.blast && impact?.projectile) {
        const d = Math.hypot(impact.projectile.x - t.x, impact.projectile.y - t.y);
        falloff = d > wc.blast + BLAST_EDGE ? 0.75 : Math.max(1 - d / (wc.blast + BLAST_EDGE), 0.75);
      }
      const def = tc.def ?? {};
      const pct = k => 1 - (def[k] ?? 0) / 100;
      const ap = k => 1 - (def[k] ?? 0) / 400;
      if (tc.building) {
        const k = lv * falloff;
        let dmg = 0;
        if (wc.kind === 'shell') dmg = (wc.shell ?? 0) * k * pct('shell') + (wc.shellAp ?? 0) * k * ap('shell');
        else if (wc.kind === 'beam') dmg = (wc.beam ?? 0) * k * pct('beam') + (wc.beamAp ?? 0) * k * ap('beam');
        else dmg = (wc.cqb ?? 0) * k * pct('cqb') + (wc.cqbAp ?? 0) * k * ap('cqb') + (wc.cqbBeam ?? 0) * k * pct('beam') + (wc.cqbShell ?? 0) * k * pct('shell');
        return Math.max(0, dmg) * st.rng.range(0.75, 1) * (wc.anti?.building ?? 1);
      }
      const s = state(t);
      if (s.dodgeUntil < st.time) s.dodge = 0;
      let back = false;
      const ox = from?.x ?? src?.x, oy = from?.y ?? src?.y;
      if (ox !== undefined && oy !== undefined) back = Math.abs(normAngle(Math.atan2(oy - t.y, ox - t.x) - t.angle)) > Math.PI / 2;
      const reaction = (tc.level?.reaction ?? 100) / 100;
      if (!(accuracy * (back ? 1.5 : 1) > reaction * st.rng.range(0.35, 1.35) * (1 + s.dodge * 0.03))) {
        s.dodge = 0;
        return null;
      }
      s.dodge = Math.min(9, s.dodge + 1);
      s.dodgeUntil = st.time + DODGE_CLEAR;
      const graze = reaction * (back ? 0.75 : 1) * st.rng.range(0.25, 0.75) >= accuracy * sizeAcc;
      const tile = tc.stance === 'air' ? wc.anti?.air ?? 1 : tc.stance === 'aqua' ? wc.anti?.aqua ?? 1 : wc.anti?.land ?? 1;
      const size = tc.size === 'large' ? wc.size?.large ?? 1 : tc.size === 'small' ? wc.size?.small ?? 1 : 1;
      const k = lv * falloff * tile * size;
      const plus = tc.plus ?? {};
      let dmg;
      if (wc.kind === 'shell') dmg = ((wc.shell ?? 0) * k - (plus.shell ?? 0)) * pct('shell') + (wc.shellAp ?? 0) * k * ap('shell');
      else if (wc.kind === 'beam') dmg = ((wc.beam ?? 0) * k - (plus.beam ?? 0)) * pct('beam') + (wc.beamAp ?? 0) * k * ap('beam');
      else {
        // A melee blow is three parts, each against the melee bonus: the zero
        // parts subtract it too, as the source's formula does.
        const p = plus.cqb ?? 0;
        dmg = ((wc.cqb ?? 0) * k - p) * pct('cqb') + ((wc.cqbBeam ?? 0) * k - p) * pct('beam') + ((wc.cqbShell ?? 0) * k - p) * pct('shell')
          + (wc.cqbAp ?? 0) * k * ap('cqb');
      }
      if (back && !graze) dmg *= 1.25;
      if (graze) dmg *= wc.cantDodge ? 0.7 : 0.35;
      return Math.max(0, dmg) * st.rng.range(0.75, 1);
    }

    function supply(st) {
      const units = host.participants().filter(e => live(e) && !e.inside && !e.site && sdk.getDef(e.defId).kind === 'unit');
      for (const b of host.participants()) {
        const c = cfg(b);
        if (!c?.supply || !live(b) || b.site) continue;
        const team = st.players[b.owner]?.team;
        for (const u of units) {
          if (st.players[u.owner]?.team !== team) continue;
          if (Math.hypot(u.x - b.x, u.y - b.y) > c.supply.range) continue;
          const uc = cfg(u), s = state(u);
          if (uc.en?.max) s.en = Math.min(uc.en.max, s.en + uc.en.max * (c.supply.en ?? 0));
          if (!inBattle(u, s) && c.supply.hp) {
            const top = sdk.maxHp(u);
            if (u.hp < top) u.hp = Math.min(top, u.hp + top * c.supply.hp);
          }
        }
      }
    }

    // HQ_Faction: a human side pays for every unit's MP and its buildings'
    // upkeep each second; a computer side earns its income twice and pays none.
    // Headquarters and Institutes earn TechPoint, a computer side's at 0.75.
    function economy(st) {
      const cost = new Map(), bonus = new Map(), tech = new Map();
      for (const e of host.participants()) {
        if (!live(e) || e.site) continue;
        const c = cfg(e), d = sdk.getDef(e.defId);
        if (!c) continue;
        if (d.kind === 'unit') cost.set(e.owner, (cost.get(e.owner) ?? 0) + (c.mp ?? 0));
        else {
          cost.set(e.owner, (cost.get(e.owner) ?? 0) + (c.upkeep ?? 0));
          if (d.metalRate) bonus.set(e.owner, (bonus.get(e.owner) ?? 0) + d.metalRate);
          if (c.techPoint) tech.set(e.owner, (tech.get(e.owner) ?? 0) + c.techPoint);
        }
      }
      st.players.forEach((p, i) => {
        if (!p || !p.alive) return;
        if (p.isHuman) p.metal = Math.max(0, p.metal - (cost.get(i) ?? 0));
        else p.metal += bonus.get(i) ?? 0;
        if (tech.has(i)) techPoint.set(i, (techPoint.get(i) ?? 0) + tech.get(i) * (p.isHuman ? 1 : AI_TECH));
      });
    }

    // What the node at the head of a lab's queue still asks in TechPoint: none
    // once the lab has taken it.
    const asks = (e, c) => {
      const head = e.research?.queue[0];
      return head === undefined || paid.get(e.id) === head ? 0 : c.research?.[head] ?? 0;
    };

    return {
      id: ID,
      // A plan asks TechPoint besides its Money and Resource. The lab takes it
      // when the plan comes to the head of its queue, and until there is
      // enough the research waits, unworked and unbilled, while the lab's
      // production and guns go on. A plan taken off the queue unfinished
      // gives its TechPoint back.
      wrapBuildingStep(next) {
        return (e, def, dt) => {
          const r = e.research, c = cfg(e);
          if (!r || !c?.research) return next(e, def, dt);
          const took = paid.get(e.id);
          if (took !== undefined && took !== r.queue[0]) {
            if (!game.st.players[e.owner]?.tech?.includes(took)) techPoint.set(e.owner, (techPoint.get(e.owner) ?? 0) + (c.research[took] ?? 0));
            paid.delete(e.id);
          }
          if (r.queue.length === 0) return next(e, def, dt);
          const ask = asks(e, c);
          if (ask > (techPoint.get(e.owner) ?? 0)) {
            e.research = undefined;
            try { next(e, def, dt); } finally { e.research = r; }
            return;
          }
          if (paid.get(e.id) !== r.queue[0]) {
            techPoint.set(e.owner, (techPoint.get(e.owner) ?? 0) - ask);
            paid.set(e.id, r.queue[0]);
          }
          next(e, def, dt);
        };
      },
      wrapDamage(next) {
        return (st, t, raw, mult, owner, sourceId = 0, gun = '', from, hit) => {
          const tc = live(t) ? cfg(t) : undefined;
          const weapon = gun ? weaponOfGun(gun) : undefined;
          const wc = weapon ? host.config(weapon) : undefined;
          if (!tc || !wc) return next(st, t, raw, mult, owner, sourceId, gun, from, hit);
          const src = st.ents.get(sourceId);
          const sdef = src ? sdk.getDef(src.defId) : defOfGun(gun);
          engage(t);
          engage(src);
          const dmg = resolve(st, t, tc, wc, sdef ? host.config(sdef) : undefined, from, src);
          if (dmg === null) return;
          return next(st, t, dmg, ONE, owner, sourceId, gun, from, hit);
        };
      },
      canFire(entity, def, weapon) {
        const c = cfg(entity), wc = host.config(weapon);
        if (!c || !wc) return true;
        const s = state(entity);
        // A once-a-life weapon (the Zaku II C's warhead) never fires again.
        if (wc.once && s.spent.includes(weapon.id)) return false;
        if (!c.en?.max) return true;
        // A magazine turret pays per round and must hold the whole price; a
        // triggered weapon needs only some EN left to start its sequence.
        if (wc.enShot) return s.en >= wc.enShot;
        if (wc.en) return s.en > 0;
        return true;
      },
      spendRound(entity, def, index) {
        const c = cfg(entity), w = def.weapons[index], wc = w && host.config(w);
        if (!c || !wc) return;
        const s = state(entity);
        s.battle = game.st.time;
        if (wc.once && !s.spent.includes(w.id)) s.spent.push(w.id);
        if (c.en?.max) s.en = Math.max(0, s.en - (wc.en ?? 0) - (wc.enShot ?? 0) * (w.burst ?? 1));
      },
      afterStep(dt) {
        const st = game.st;
        for (const e of host.participants()) {
          if (!live(e)) continue;
          const c = cfg(e);
          if (!c?.en?.max) continue;
          const s = state(e);
          const moved = Math.hypot(e.x - s.x, e.y - s.y) / Math.max(dt, 1e-6);
          // Moving drains EN (`Check_Move_EN`), at a quarter RW px a tick or more.
          if (!e.inside && moved > 0.25 * 60 * 0.75) s.en = Math.max(0, s.en - (c.en.move ?? 0) * dt);
          s.x = e.x; s.y = e.y;
        }
        clock += dt;
        while (clock >= 1) {
          clock -= 1;
          supply(st);
          economy(st);
          for (const id of [...states.keys()]) if (!live(st.ents.get(id))) states.delete(id);
          for (const id of [...paid.keys()]) if (!live(st.ents.get(id))) paid.delete(id);
        }
      },
      inspect(entity, privateView) {
        const c = cfg(entity);
        const rows = [];
        if (c?.en?.max) {
          const s = state(entity);
          rows.push({ id: 'en', label: EN, value: Math.round(s.en) + ' / ' + Math.round(c.en.max), fraction: s.en / c.en.max,
            tone: s.en <= 0 ? 'danger' : s.en < c.en.max * 0.25 ? 'warning' : 'normal' });
        }
        // the owner's TechPoint, and on a waiting lab what its plan asks
        if (privateView && (c?.techPoint || c?.research)) {
          const have = techPoint.get(entity.owner) ?? 0, ask = asks(entity, c);
          rows.push(ask > have
            ? { id: 'techPoint', label: TECH_POINT, value: Math.floor(have) + ' / ' + Math.round(ask), fraction: have / ask, tone: 'warning' }
            : { id: 'techPoint', label: TECH_POINT, value: Math.floor(have) });
        }
        return rows;
      },
      snapshot(view) {
        const entities = {};
        for (const [id, s] of states) {
          const e = game.st.ents.get(id);
          if (!live(e)) continue;
          if (view?.player !== undefined && e.owner !== view.player) continue;
          entities[id] = { ...s, spent: [...s.spent] };
        }
        const tech = {}, labs = {};
        for (const [i, v] of techPoint) if (view?.player === undefined || view.player === i) tech[i] = v;
        for (const [id, node] of paid) {
          const e = game.st.ents.get(id);
          if (live(e) && (view?.player === undefined || e.owner === view.player)) labs[id] = node;
        }
        return { version: 2, clock, entities, techPoint: tech, paid: labs };
      },
      restore(value) {
        if (!value || (value.version !== 1 && value.version !== 2) || typeof value.entities !== 'object' || !Number.isFinite(value.clock)) throw Error('Invalid GW battle state');
        const tech = new Map(), labs = new Map();
        for (const [i, v] of Object.entries(value.techPoint ?? {})) {
          if (!game.st.players[+i] || !Number.isFinite(v) || v < 0) throw Error('Invalid GW TechPoint ' + i);
          tech.set(+i, v);
        }
        for (const [id, node] of Object.entries(value.paid ?? {})) {
          const e = game.st.ents.get(+id);
          if (!e?.research || typeof node !== 'string' || !(cfg(e)?.research && node in cfg(e).research)) throw Error('Invalid GW research ' + id);
          labs.set(+id, node);
        }
        const next = new Map();
        for (const [id, s] of Object.entries(value.entities)) {
          const e = game.st.ents.get(+id);
          if (!e || !cfg(e) || !s || ![s.en, s.dodge, s.dodgeUntil, s.battle, s.x, s.y].every(Number.isFinite) || s.en < 0 || s.dodge < 0 || s.dodge > 9
            || !Array.isArray(s.spent) || s.spent.length > 8 || s.spent.some(w => !sdk.getDef(e.defId).weapons.some(x => x.id === w)))
            throw Error('Invalid GW battle entity ' + id);
          next.set(+id, { en: s.en, dodge: s.dodge, dodgeUntil: s.dodgeUntil, battle: s.battle, x: s.x, y: s.y, spent: [...s.spent] });
        }
        states.clear();
        for (const [id, s] of next) states.set(id, s);
        techPoint.clear();
        for (const [i, v] of tech) techPoint.set(i, v);
        paid.clear();
        for (const [id, node] of labs) paid.set(id, node);
        clock = value.clock;
      },
      dispose() { states.clear(); techPoint.clear(); paid.clear(); },
    };
  }

  return { capabilities: [{ id: ID, create }] };
}
