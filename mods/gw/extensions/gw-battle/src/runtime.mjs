// GW BattleUniverse's battle rules, as the source's damage checkers, battle
// framework, pilots and HQ resolve them. Every behavior here belongs to this
// mod; the factory receives only the public host SDK.
export default function (sdk) {
  const ID = 'gw.battle-v1';
  // Seconds a unit counts as in battle after it attacks or is hit (`inBattleTimer`).
  const BATTLE = 5;
  // A run of hits makes the next dodge likelier; ten quiet seconds clear it.
  const DODGE_CLEAR = 10;
  // This mod's world px per RW px.
  const PX = 0.75;
  // RW px a blast's falloff runs past its radius.
  const BLAST_EDGE = 40 * PX;
  // GW resolves the hit itself, so the armour matrix cell is always one.
  const ONE = Object.freeze({ light: 1, medium: 1, heavy: 1, structure: 1, ship: 1, sub: 1, air: 1, warhead: 1 });
  // The battle core's own checks run every 8 source ticks.
  const CORE = 8 / 60;
  const t3 = (en, zh, ko) => [en, zh, ko];
  const TEXT = {
    en: t3('EN', '能量', 'EN'), techPoint: t3('TechPoint', '科技', '테크 포인트'), moral: t3('MoralPoint', '士气', '사기 포인트'),
    shield: t3('Shield', '护盾', '실드'), field: { ifield: t3('I-Field', 'I力场', 'I필드'), psa: t3('PS Armor', 'PS装甲', 'PS 장갑'), abc: t3('Anti-Beam Coating', '抗光束涂层', '대빔 코팅') },
    dp: t3('DP', 'DP', 'DP'), pilot: t3('Pilot', '驾驶员', '파일럿'), noPilot: t3('No pilot', '无驾驶员', '파일럿 없음'),
    level: t3('Lv', '等级', '레벨'), exp: t3('EXP', '经验', '경험치'), parts: t3('Broken', '破损', '파손'),
    hangar: t3('Pilots in hangar', '机库驾驶员', '격납고 파일럿'), type: t3('Training', '培养方向', '육성 방향'),
    ready: t3('OK', 'OK', 'OK'), seconds: t3('s', '秒', '초'),
    boost: t3('FullBoost', '全力推进', '풀 부스트'), overBoost: t3('OverBoost', '超限推进', '오버 부스트'),
    psaOn: t3('SwitchON PSA', '开启PS装甲', 'PS 장갑 켜기'), psaOff: t3('SwitchOFF PSA', '关闭PS装甲', 'PS 장갑 끄기'),
    camoOn: t3('OpticalCamouflage[ON]', '光学迷彩[开]', '광학 미채[켜기]'), camoOff: t3('OpticalCamouflage[OFF]', '光学迷彩[关]', '광학 미채[끄기]'),
    repair: t3('Need Repair', '需要维修', '수리 필요'), unload: t3('Unload Pilot', '驾驶员脱出', '파일럿 하차'), suicide: t3('Suicide', '自爆', '자폭'),
    board: t3('Board', '搭乘', '탑승'), back: t3('Back To SL', '返回据点', '거점으로 귀환'),
    trainPilot: { N: t3('Pilot', '驾驶员', '파일럿'), CNT: t3('Cyber Newtype', '强化人', '강화인간') },
    cancel: t3('Cancel', '取消', '취소'), work: t3('Training', '训练中', '훈련 중'), call: t3('Called', '召集中', '소집 중'),
    head: t3('head', '头部', '머리'), armL: t3('left arm', '左臂', '왼팔'), armR: t3('right arm', '右臂', '오른팔'), legL: t3('left leg', '左腿', '왼다리'), legR: t3('right leg', '右腿', '오른다리'),
    types: {
      shoot: t3('ShootMaster', '射击专精', '사격 특화'), cqb: t3('CqbMaster', '格斗专精', '격투 특화'),
      leader: t3('Leader', '指挥官', '지휘관'), comprehension: t3('Comprehension', '悟性', '이해력'), none: t3('None', '无', '없음'),
    },
    aceSkill: {
      accuracy: t3('AccuracyUp', '命中提升', '명중 상승'), reaction: t3('ReactionUp', '反应提升', '반응 상승'), awakening: t3('AwakeningUp', '觉醒提升', '각성 상승'),
      exp: t3('ExpUp', '经验提升', '경험치 상승'), leadership: t3('LeadershipUp', '统率提升', '통솔 상승'), shoot: t3('ShootUp', '射击提升', '사격 상승'),
      cqb: t3('CqbUp', '格斗提升', '격투 상승'), def: t3('DefUp', '防御提升', '방어 상승'), speed: t3('SpeedUp', '速度提升', '속도 상승'),
      atk: t3('AtkUp', '攻击提升', '공격 상승'),
    },
  };
  // The parts a mobile suit loses, as bits, and the share of a part roll each takes (`rnd(0,71)`).
  const PART = { head: 1, backpack: 2, armL: 4, armR: 8, legL: 16, legR: 32 };
  const PART_ROLL = [[15, 'head'], [30, 'backpack'], [40, 'armL'], [50, 'armR'], [60, 'legL'], [70, 'legR']];
  // Pilot skill rolls (`Pilot_*_Base`): main skills, leadership, awakening, comprehension, exp needed.
  const ROLLS = {
    N: { main: [100, 110], leadership: [55, 75], awakening: [0, 0], comprehension: [110, 112.5], need: [2000, 3000] },
    O: { main: [45, 56], leadership: [100, 115], awakening: [0, 0], comprehension: [110, 112.5], need: [2000, 3000] },
    CNT: { main: [110, 120], leadership: [65, 85], awakening: [80, 85], comprehension: [110, 112.5], need: [4000, 5000] },
  };
  const MAIN = ['shoot', 'cqb', 'def', 'speed', 'accuracy', 'reaction'];
  // An Academy's training (`InitializeStats_PilotSkills_Type_*`): skill multipliers, and Comprehension's cheaper levels.
  const TRAINING = {
    shoot: { shoot: 1.10, cqb: 0.75, def: 1.05, reaction: 0.90 },
    cqb: { shoot: 0.75, cqb: 1.25, def: 1.10, speed: 1.25, reaction: 1.25 },
    leader: { def: 1.25, accuracy: 1.15, leadership: 1.30 },
    comprehension: { need: 0.7 },
  };
  const TRAINING_COST = 1500;
  // A factory within this many px of an Academy trains with it (450 RW px, and the factory's own reach).
  const ACADEMY_LINK = 450 * PX + 64;
  const HANGAR = 8;
  // A pilotless unit is given up after this long (`onSuicide`).
  const ABANDON = 180;
  // ACE active skills (`Skill_Pilot`): 100 EN, 15 s, 90 s cooldown, and what each multiplies.
  const ACE_SKILL = { en: 100, time: 15, cd: 90 };
  const ACE_BOOST = { accuracy: 1.75, reaction: 1.75, awakening: 1.75, exp: 1.75, leadership: 2, shoot: 1.35, cqb: 1.45, def: 1.35, speed: 1.35, atk: 1.2 };
  // The computer's handicap (`AIHard`), by the seat's difficulty: income, TechPoint and pilot skill.
  // The source's normal computer is `AIHard` 1; each harder seat takes the next bracket.
  const HARD = {
    relaxed: { income: 1, tech: 1, pilot: 0 }, standard: { income: 1, tech: 1, pilot: 0 },
    seasoned: { income: 1.5, tech: 1.1, pilot: 2 }, veteran: { income: 1.75, tech: 1.25, pilot: 4 },
  };
  // A computer side earns its income twice and three quarters of the TechPoint (`Gen_TechPoint`).
  const AI_INCOME = 2, AI_TECH = 0.75;
  const MORAL_START = 1000;
  const DETECT_HOLD = 5;
  const SUPPLY_REPAIR = 30;
  const SUPPLIED = 'gw-supplied';

  function create(host) {
    const game = host.game;
    const states = new Map();
    // TechPoint in hand, by owner; the node whose TechPoint a lab has taken, by lab
    const techPoint = new Map(), paid = new Map();
    // MoralPoint in hand, by owner; the unit a factory has paid it for, by factory
    const moral = new Map(), moralPaid = new Map();
    // an Academy's pilots waiting for new units, and its training, by Academy
    const hangars = new Map(), training = new Map();
    // ACE pilots on their way back to an Academy after losing their unit
    const returning = [];
    // shots a skill has queued: { at, id, wi, x, y, target }
    const queued = [];
    // smoke and particle clouds: { x, y, r, until, owner, kind }
    const areas = [];
    let clock = 0, core = 0;
    const st = () => game.st;
    const cfg = e => host.config(sdk.getDef(e.defId));
    const wcfg = w => host.config(w);
    const live = e => e && !e.dead;
    const now = () => game.st.time;
    const teamOf = owner => game.st.players[owner]?.team;
    const isAI = owner => !!game.st.players[owner] && !game.st.players[owner].isHuman;
    const hard = owner => HARD[game.st.players[owner]?.difficulty ?? 'standard'] ?? HARD.standard;
    const factionOf = owner => game.st.cfg.players[owner]?.faction;
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
    const exists = id => { try { sdk.getDef(id); return true; } catch { return false; } };
    const roll = ([a, b]) => Math.floor(game.st.rng.range(a, b));

    // ------------------------------------------------------------- state
    const state = e => {
      let s = states.get(e.id);
      if (!s) {
        const c = cfg(e);
        s = { en: c?.en?.max ?? 0, dodge: 0, dodgeUntil: 0, battle: -1e9, x: e.x, y: e.y, spent: [], born: now() };
        if (c?.shield) s.shield = c.shield.hp;
        if (c?.field) s.field = c.field.hp;
        if (c?.field?.kind === 'psa') s.psa = true;
        states.set(e.id, s);
        if (c && !c.building) seat(e, s, c);
      }
      return s;
    };
    const engage = e => { if (live(e) && cfg(e) && sdk.getDef(e.defId).kind === 'unit') state(e).battle = now(); };
    const inBattle = s => now() - s.battle < BATTLE;
    const normAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
    const flags = (e, on, flag) => {
      if (!e.rs) return;
      const has = e.rs.flags?.includes(flag);
      if (on && !has) (e.rs.flags ??= []).push(flag);
      else if (!on && has) { e.rs.flags = e.rs.flags.filter(f => f !== flag); if (!e.rs.flags.length) e.rs.flags = undefined; }
    };

    // ------------------------------------------------------------- pilots
    // The Academy a new unit trains with: the nearest of its side's, standing, within a factory's reach.
    function academyNear(owner, x, y) {
      let best, bestD = ACADEMY_LINK;
      for (const b of host.participants()) {
        if (!live(b) || b.site || b.owner !== owner || !cfg(b)?.academy) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < bestD) { bestD = d; best = b; }
      }
      return best;
    }
    function rollPilot(type, owner, academy) {
      const r = ROLLS[type] ?? ROLLS.N;
      const p = { t: type, leadership: roll(r.leadership), awakening: roll(r.awakening), comprehension: roll(r.comprehension), need: roll(r.need), exp: 0, level: 0, hp: 800 };
      for (const k of MAIN) p[k] = roll(r.main);
      train(p, owner, academy);
      return p;
    }
    // An Academy's level and training, and the computer's handicap, on a pilot just made.
    function train(p, owner, academy) {
      const ac = academy && cfg(academy)?.academy;
      if (ac) {
        const k = 1 + ac.level * 0.025;
        for (const s of [...MAIN, 'leadership']) p[s] *= k;
        const mul = TRAINING[training.get(academy.id)] ?? {};
        for (const [s, v] of Object.entries(mul)) p[s] *= v;
      }
      if (isAI(owner)) for (const s of MAIN) p[s] += hard(owner).pilot;
    }
    function acePilot(c, owner, academy) {
      const a = c.ace;
      const p = { t: 'ACE', ace: a.code, comprehension: a.comprehension ?? 110, need: a.need ?? 6000, exp: 0, level: 0, hp: 2000, returnCd: a.returnCd ?? 180, active: a.active ?? [] };
      for (const s of [...MAIN, 'leadership', 'awakening']) p[s] = a.skills?.[s] ?? 100;
      train(p, owner, academy);
      return p;
    }
    // A unit made on the field takes its pilot: an ACE's own, the Academy hangar's first, or a new one.
    function seat(e, s, c) {
      if (c.pilotUnit) { s.carry = rollPilot(c.pilotUnit, e.owner, academyNear(e.owner, e.x, e.y)); return; }
      if (!c.pilot || c.pilot === 'none') return;
      const academy = academyNear(e.owner, e.x, e.y);
      if (c.ace) { s.pilot = acePilot(c, e.owner, academy); markAce(e, s); return; }
      const hangar = academy && hangars.get(academy.id);
      if (hangar?.length && sdk.getDef(e.defId).kind === 'unit' && now() - (s.born ?? 0) < 1) { s.pilot = hangar.shift(); markAce(e, s); return; }
      s.pilot = rollPilot(c.pilot, e.owner, academy);
    }
    // An ACE aboard raises its flag, for the custom units only it may take.
    const markAce = (e, s) => { if (s.pilot?.ace) flags(e, true, 'gw-ace-' + s.pilot.ace.toLowerCase()); };
    // A skill as the host unit reads it: the pilot's, or leadership for a command unit,
    // halved for an ACE back too soon, with an ACE skill or an aura on top.
    function skill(e, s, c, name) {
      const p = s.pilot;
      if (!p) return c?.pilot && c.pilot !== 'none' ? 50 : 100;
      let v = c?.leads && name !== 'leadership' && name !== 'awakening' ? p.leadership : p[name];
      if (p.weak && p.weak > now()) v *= 0.5;
      if (s.aceSkill && s.aceSkill.until > now()) {
        const k = s.aceSkill.kind;
        if (k === name || (k === 'atk' && (name === 'shoot' || name === 'cqb'))) v *= ACE_BOOST[k];
      }
      return v;
    }
    const shootMul = v => 1 + (v - 100) * 0.005;
    const sharpMul = v => 1 + (Math.min(v, 175) - 100) * 0.0025 + Math.max(0, v - 175) * 0.00125;
    const speedMul = v => 1 + (v - 100) * 0.00105;
    const guardMul = v => Math.max(0.05, 1 - (v - 100) * 0.002);
    // Leadership auras on a unit: each kind's power, while it lasts.
    const aura = (s, kind) => s.aura && s.aura.until > now() ? s.aura[kind] ?? 1 : 1;
    // The levels a unit fights at, every source of them together.
    function levels(e, s, c) {
      const head = s.parts & PART.head ? 0.75 : 1;
      const smoke = inSmoke(e);
      const boost = s.boostUntil > now() ? c.boost?.reaction ?? 1 : 1;
      const shield = s.shield > 0 && c.shield ? c.shield.speed ?? 1 : 1;
      const atk = aura(s, 'atk'), com = aura(s, 'com');
      return {
        shoot: (c.level?.shoot ?? 100) * shootMul(skill(e, s, c, 'shoot')) * atk,
        cqb: (c.level?.cqb ?? 100) * shootMul(skill(e, s, c, 'cqb')) * atk,
        accuracy: (c.level?.accuracy ?? 100) * sharpMul(skill(e, s, c, 'accuracy')) * head * com,
        reaction: ((c.level?.reaction ?? 100) + (smoke ? 15 : 0)) * sharpMul(skill(e, s, c, 'reaction')) * head * boost * shield * com,
        guard: guardMul(skill(e, s, c, 'def')),
      };
    }
    // Experience from harm done (`Get_GiveDamageInfoExp`), and levels from experience.
    function gainExp(src, target, dealt) {
      const s = state(src), p = s.pilot, sc = cfg(src), tc = cfg(target);
      if (!p || !sc || !tc || tc.building || dealt <= 0) return;
      const per = Math.min(1, dealt / Math.max(1, sdk.maxHp(target)));
      const ts = states.get(target.id);
      const ratio = Math.min(2.5, Math.max((tc.unitLevel ?? 100) / ((sc.unitLevel ?? 100) + 0.001), 0.25));
      const aceUp = s.aceSkill && s.aceSkill.until > now() && s.aceSkill.kind === 'exp' ? ACE_BOOST.exp : 1;
      p.exp += per * 2000 * aura(s, 'com') * ratio * (1 + (ts?.pilot?.level ?? 0) * 0.5) * aceUp;
      while (p.level < 3 && p.exp >= p.need) {
        p.exp -= p.need;
        p.level += 1;
        p.need *= 1.5;
        for (const k of [...MAIN, 'leadership', 'awakening']) p[k] *= p.comprehension / 100;
        sdk.addEffect(game.st, 'fx.repair', src.x, src.y, 0.6, 6, 1);
      }
    }
    // A pilot killed in the cockpit leaves the unit without one: it stops, and is given up.
    function pilotHit(t, s, c, dmg, wc) {
      const p = s.pilot;
      if (!p) return;
      const top = sdk.maxHp(t);
      const safety = c.safety ?? 100;
      const threshold = 10 * safety / 100 * (1 + (skill(t, s, c, 'def') - 100) * 0.005);
      if (game.st.rng.range(0, 101) * (dmg / top) * 1.25 * (1 - t.hp / top) * (wc.cockpit ?? 1) > threshold) p.hp -= dmg * (wc.pilotDmg ?? 1) * 0.1;
      p.hp -= wc.pilotTrue ?? 0;
      if (p.hp <= 0) loseAce(t, s), abandon(t, s);
    }
    function abandon(e, s) {
      s.pilot = null;
      s.abandonAt = now() + ABANDON;
      e.targetId = 0;
      e.orders = [];
    }
    // An ACE whose unit is lost makes for the nearest Academy with room, and is back after its cooldown, at half its skill a while.
    function loseAce(e, s) {
      const p = s.pilot;
      if (!p?.ace) return;
      flags(e, false, 'gw-ace-' + p.ace.toLowerCase());
      returning.push({ owner: e.owner, at: now() + (isAI(e.owner) ? p.returnCd / 2 : p.returnCd), pilot: { ...p, exp: 0, hp: 2000, weak: 0 } });
    }

    // ------------------------------------------------------------- damage
    // DamageChecker: the round connects, grazes or misses, then each payload
    // part is reduced by the target's flat and percentage defence of its kind,
    // by a shield it blocks with, and by a field it carries.
    function resolve(t, tc, wc, src, sc, from) {
      const g = game.st;
      const impact = host.currentImpact;
      const primary = !impact || !impact.direct || impact.direct === t;
      const ss = src && sc && !sc.building ? state(src) : undefined;
      const lv = ss ? levels(src, ss, sc) : { shoot: sc?.level?.shoot ?? 100, cqb: sc?.level?.cqb ?? 100, accuracy: sc?.level?.accuracy ?? 100 };
      const accuracy = lv.accuracy / 100 * (wc.accuracy ?? 100) / 100 * (primary ? 1 : 0.75);
      const sizeAcc = tc.size === 'large' ? wc.size?.largeAccuracy ?? 1 : tc.size === 'small' ? wc.size?.smallAccuracy ?? 1 : 1;
      const k0 = (wc.kind === 'cqb' ? lv.cqb : lv.shoot) / 100;
      let falloff = 1;
      if (wc.blast && impact?.projectile) {
        const d = Math.hypot(impact.projectile.x - t.x, impact.projectile.y - t.y);
        falloff = d > wc.blast + BLAST_EDGE ? 0.75 : Math.max(1 - d / (wc.blast + BLAST_EDGE), 0.75);
      }
      // a bazooka round's blast round its point does a share of the hit (`ProjectileBlast*`)
      const splash = !primary && wc.blastRange ? wc.blastMul ?? 0.2 : 1;
      const splashDp = !primary && wc.blastRange ? wc.blastDp ?? 1 : 1;
      const ts = tc.building ? undefined : state(t);
      const tl = ts ? levels(t, ts, tc) : undefined;
      const guard = aura(ts ?? {}, 'def');
      const def = tc.def ?? {}, plusDef = tc.plus ?? {};
      const smoke = ts && inSmoke(t);
      const pct = k => 1 - Math.min(100, ((def[k] ?? 0) + (smoke ? 5 : 0)) * guard) / 100;
      const ap = k => 1 - Math.min(100, (def[k] ?? 0) * guard) / 400;
      const plus = k => ((plusDef[k] ?? 0) + (smoke ? 50 : 0)) * guard;
      if (tc.building) {
        const k = k0 * falloff * splash;
        let dmg = 0;
        if (wc.kind === 'shell') dmg = (wc.shell ?? 0) * k * pct('shell') + (wc.shellAp ?? 0) * k * ap('shell');
        else if (wc.kind === 'beam') dmg = (wc.beam ?? 0) * k * pct('beam') + (wc.beamAp ?? 0) * k * ap('beam');
        else dmg = (wc.cqb ?? 0) * k * pct('cqb') + (wc.cqbAp ?? 0) * k * ap('cqb') + (wc.cqbBeam ?? 0) * k * pct('beam') + (wc.cqbShell ?? 0) * k * pct('shell');
        return { hull: Math.max(0, dmg) * g.rng.range(0.75, 1) * (wc.anti?.building ?? 1) };
      }
      const s = ts;
      if (s.dodgeUntil < g.time) s.dodge = 0;
      let back = false;
      const ox = from?.x ?? src?.x, oy = from?.y ?? src?.y;
      if (ox !== undefined && oy !== undefined) back = Math.abs(normAngle(Math.atan2(oy - t.y, ox - t.x) - t.angle)) > Math.PI / 2;
      const reaction = tl.reaction / 100;
      if (!(accuracy * (back ? 1.5 : 1) > reaction * g.rng.range(0.35, 1.35) * (1 + s.dodge * 0.03))) {
        s.dodge = 0;
        return null;
      }
      s.dodge = Math.min(9, s.dodge + 1);
      s.dodgeUntil = g.time + DODGE_CLEAR;
      const graze = reaction * (back ? 0.75 : 1) * g.rng.range(0.25, 0.75) >= accuracy * sizeAcc;
      const tile = tc.stance === 'air' ? wc.anti?.air ?? 1 : tc.stance === 'aqua' ? wc.anti?.aqua ?? 1 : wc.anti?.land ?? 1;
      const size = tc.size === 'large' ? wc.size?.large ?? 1 : tc.size === 'small' ? wc.size?.small ?? 1 : 1;
      const k = k0 * falloff * tile * size * splash;
      // each part of the payload, before the field and the shield
      const parts = { shell: 0, shellAp: 0, beam: 0, beamAp: 0, cqbShell: 0, cqbBeam: 0, cqb: 0, cqbAp: 0 };
      if (wc.kind === 'shell') {
        parts.shell = ((wc.shell ?? 0) * k - plus('shell')) * pct('shell');
        parts.shellAp = (wc.shellAp ?? 0) * k * ap('shell');
      } else if (wc.kind === 'beam') {
        parts.beam = ((wc.beam ?? 0) * k - plus('beam')) * pct('beam');
        parts.beamAp = (wc.beamAp ?? 0) * k * ap('beam');
      } else {
        // A melee blow is three parts, each against the melee bonus: the zero
        // parts subtract it too, as the source's formula does.
        const p = plus('cqb');
        parts.cqb = ((wc.cqb ?? 0) * k - p) * pct('cqb');
        parts.cqbBeam = ((wc.cqbBeam ?? 0) * k - p) * pct('beam');
        parts.cqbShell = ((wc.cqbShell ?? 0) * k - p) * pct('shell');
        parts.cqbAp = (wc.cqbAp ?? 0) * k * ap('cqb');
      }
      let dpMul = 1, extraMul = 1;
      // the field: an I-Field turns shooting beams, PS armour shells, a coating beams
      const field = tc.field;
      if (field && s.field > 0 && (field.kind !== 'psa' || s.psa)) {
        const L = field.level;
        let absorbed = 0;
        const take = (key, share) => { const a = Math.max(0, parts[key]) * share; parts[key] -= a; absorbed += a; };
        if (field.kind === 'ifield' && wc.kind === 'beam') { take('beam', L); take('beamAp', 0.5); dpMul *= 1 - L; extraMul *= 1 - L; }
        else if (field.kind === 'psa') { take('shell', L); take('shellAp', L / 4); take('cqbShell', L / 2); if (wc.kind === 'shell') dpMul *= 1 - L / 4; }
        else if (field.kind === 'abc') { take('beam', L); take('beamAp', L / 4); take('cqbBeam', L / 2); if (wc.kind === 'beam') dpMul *= 1 - L / 4; }
        s.field -= absorbed;
        if (field.kind === 'ifield') s.field = Math.max(-field.hp * 0.25, s.field);
        if (field.kind === 'psa' && tc.en?.max) s.en = Math.max(0, s.en - (absorbed + 1) / field.hp * tc.en.max * 0.2);
        if (s.field <= 0 && field.kind === 'psa') s.psa = false;
      }
      let dmg = Object.values(parts).reduce((a, v) => a + Math.max(0, v), 0);
      if (back && !graze) dmg *= 1.25;
      if (graze) dmg *= wc.cantDodge ? 0.7 : 0.35;
      // an unseen unit is hit half as hard
      const undetected = src && !detected(t, teamOf(src.owner));
      if (undetected) dmg *= 0.5;
      const random = g.rng.range(0.75, 1);
      dmg = Math.max(0, dmg) * random * tl.guard * (s.pilot?.ace ? 0.75 : 1);
      // a shield it blocks with takes its share, the rest goes to the hull
      let shieldDp = 0;
      const sh = tc.shield;
      if (sh && s.shield > 0 && g.rng.range(0, 101) < sh.block * 100) {
        const kind = wc.kind === 'cqb' ? 'cqb' : wc.kind;
        const blocked = Math.max(0, (dmg * sh.size - (sh.plus?.[kind] ?? 0)) * (1 - (sh.def?.[kind] ?? 0) / 100));
        s.shield = Math.max(0, s.shield - blocked);
        dmg *= 1 - sh.size;
        shieldDp = sh.plus?.dp ?? 0;
        dpMul *= 1 - (sh.def?.dp ?? 0) / 100;
      }
      // DP: the blow's weight, toward a daze and a stagger
      if (tc.dp && wc.dp) {
        let dp = ((wc.dp ?? 0) * tile * size * splashDp - (plusDef.dp ?? 0) - shieldDp) * (1 - (def.dp ?? 0) / 100);
        if (wc.kind === 'shell' && tc.stance === 'air') dp *= 1.25;
        if (back && !graze) dp *= 1.25;
        if (graze) dp *= wc.cantDodge ? 0.7 : 0.35;
        if (undetected) dp *= 0.5;
        if (s.parts & (PART.legL | PART.legR)) dp /= 0.75;
        dp = Math.max(0, dp * dpMul * random * (s.pilot?.ace ? 0.75 : 1));
        if (dp > 0) addDp(t, s, tc, dp);
      }
      if (wc.stun) s.stunUntil = Math.max(s.stunUntil ?? 0, g.time + wc.stun);
      if (wc.burn) s.burnUntil = Math.max(s.burnUntil ?? 0, g.time + wc.burn);
      return { hull: dmg, extra: extraMul };
    }
    function addDp(t, s, tc, dp) {
      const g = game.st;
      if (g.time - (s.dpAt ?? -1e9) > 3) s.dp = 0;
      s.dp = (s.dp ?? 0) + dp;
      s.dpAt = g.time;
      if (s.dp >= tc.dp) { s.staggerUntil = g.time + 1; s.dp = 0; }
      else if (s.dp >= tc.dp * 0.6 && !(s.dazeUntil > g.time)) s.dazeUntil = g.time + 0.5;
    }
    // A hit on a mobile suit may break one of its parts (`BattleUnit_Framework_MS`).
    function breakPart(t, s, tc, dmg, wc) {
      const top = sdk.maxHp(t);
      if (!(game.st.rng.range(0, 101) * (dmg / top) * 2 * (1 - t.hp / top) * (wc.partBreak ?? 1) > 5 * tc.parts / 100)) return;
      const r = game.st.rng.range(0, 71);
      const hit = PART_ROLL.find(([edge]) => r < edge)?.[1];
      // the source never breaks a backpack: the roll only shakes it
      if (!hit || hit === 'backpack' || s.parts & PART[hit]) return;
      s.parts |= PART[hit];
      if (hit === 'armL' && tc.shield) s.shield = 0;
      flags(t, true, 'gw-cant-transform');
      sdk.addEffect(game.st, 'fx.spark', t.x, t.y, 0.5, 6, 1.4);
      sdk.addEffect(game.st, 'fx.smoke', t.x, t.y, 1.2, 8, 0.8);
    }

    // ------------------------------------------------------------- detection
    // Every unit hides until an enemy's detection finds it, and stays found five seconds.
    const detected = (e, team) => {
      const c = cfg(e);
      if (!c) return true;
      const s = states.get(e.id);
      return !s || (s.seen?.[team] ?? -1) > now();
    };
    function antiDetect(e, s, c) {
      let anti = c.detect?.anti ?? 0;
      if (inSmoke(e)) anti += 200 * PX;
      if (inMinovsky(e)) anti += 200 * PX;
      if (s.camo) anti += (c.camo?.anti ?? 200) * PX;
      if (now() - (s.fired ?? -1e9) < 1) anti -= 100 * PX * (c.size === 'large' ? 1.5 : c.size === 'small' ? 0.5 : 1);
      if (c.stance === 'air') anti -= 100 * PX;
      return anti;
    }
    function detectRange(e, s, c) {
      let r = c.detect?.range ?? 0;
      if (!r) return 0;
      if (s.parts & PART.head) r *= 0.75;
      if (inMinovsky(e)) r *= 0.5;
      if (s.pilot && skill(e, s, c, 'awakening') >= 100) r *= 1.15;
      return r;
    }
    function detect() {
      const g = game.st;
      const seekers = [];
      for (const e of host.participants()) {
        if (!live(e) || e.inside || e.site) continue;
        const c = cfg(e);
        if (!c) continue;
        const s = state(e), r = detectRange(e, s, c);
        if (r > 0) seekers.push({ e, r, team: teamOf(e.owner), stance: c.stance });
      }
      for (const e of host.participants()) {
        if (!live(e) || e.inside) continue;
        const c = cfg(e);
        if (!c) continue;
        const s = state(e), anti = antiDetect(e, s, c), team = teamOf(e.owner);
        for (const d of seekers) {
          if (d.team === team) continue;
          if ((s.seen?.[d.team] ?? -1) > g.time + DETECT_HOLD - 1) continue;
          // across the water line a detector reaches half as far without sonar
          const across = (c.stance === 'aqua') !== (d.stance === 'aqua') ? 0.5 : 1;
          if (Math.hypot(e.x - d.e.x, e.y - d.e.y) + anti < d.r * across) (s.seen ??= {})[d.team] = g.time + DETECT_HOLD;
        }
      }
    }

    // ------------------------------------------------------------- areas
    function inSmoke(e) {
      for (const a of areas) if (a.kind === 'smoke' && a.until > now() && teamOf(a.owner) === teamOf(e.owner) && Math.hypot(e.x - a.x, e.y - a.y) < a.r) return true;
      return false;
    }
    // Minovsky particles blind every detector inside the cloud, and hide what stands in it.
    function inMinovsky(e) {
      for (const a of areas) if (a.kind === 'minovsky' && a.until > now() && Math.hypot(e.x - a.x, e.y - a.y) < a.r) return true;
      return false;
    }
    // A detection sweep finds every enemy in its circle, as a detector would.
    function sweep(a) {
      const team = teamOf(a.owner);
      for (const t of host.participants()) {
        if (!live(t) || t.inside || teamOf(t.owner) === team || Math.hypot(t.x - a.x, t.y - a.y) > a.r) continue;
        (state(t).seen ??= {})[team] = now() + DETECT_HOLD;
      }
      sdk.addEffect(game.st, 'fx.emp', a.x, a.y, 0.8, 8, a.r / 64);
    }

    // ------------------------------------------------------------- supply and economy
    function supply() {
      const g = game.st;
      const units = host.participants().filter(e => live(e) && !e.inside && !e.site && sdk.getDef(e.defId).kind === 'unit');
      for (const b of host.participants()) {
        const c = cfg(b);
        if (!c?.supply || !live(b) || b.site) continue;
        const team = teamOf(b.owner);
        for (const u of units) {
          if (teamOf(u.owner) !== team) continue;
          if (Math.hypot(u.x - b.x, u.y - b.y) > c.supply.range) continue;
          const uc = cfg(u), s = state(u);
          s.supplied = g.time;
          flags(u, true, SUPPLIED);
          if (uc.en?.max) s.en = Math.min(uc.en.max, s.en + uc.en.max * (c.supply.en ?? 0));
          if (uc.shield && s.shield > 0 && !(s.parts & PART.armL)) s.shield = Math.min(uc.shield.hp, s.shield + uc.shield.hp * (c.supply.hp ?? 0));
          if (!inBattle(s) && c.supply.hp) {
            const top = sdk.maxHp(u);
            if (u.hp < top) u.hp = Math.min(top, u.hp + top * c.supply.hp);
          }
          // broken parts mend in supply, out of battle (`Need Repair` on its own)
          if (s.parts && !inBattle(s)) {
            s.mendAt ??= g.time + SUPPLY_REPAIR;
            if (g.time >= s.mendAt) mend(u, s, uc);
          }
        }
      }
    }
    function mend(e, s, c) {
      s.parts = 0;
      s.mendAt = undefined;
      s.repairUntil = undefined;
      flags(e, false, 'gw-cant-transform');
      if (c.shield) s.shield = Math.min(c.shield.hp, (s.shield ?? 0) + c.shield.hp * 0.5);
    }
    // HQ_Faction: a human side pays for every unit's MP and its buildings'
    // upkeep each second; a computer side earns its income twice, by its
    // handicap, and pays none. Headquarters and Institutes earn TechPoint.
    function economy() {
      const g = game.st;
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
      g.players.forEach((p, i) => {
        if (!p || !p.alive) return;
        if (!moral.has(i) && factionOf(i)?.startsWith('gw-')) moral.set(i, MORAL_START);
        if (p.isHuman) p.metal = Math.max(0, p.metal - (cost.get(i) ?? 0));
        else p.metal += (bonus.get(i) ?? 0) * ((AI_INCOME * hard(i).income) - 1);
        if (tech.has(i)) techPoint.set(i, (techPoint.get(i) ?? 0) + tech.get(i) * (p.isHuman ? 1 : AI_TECH * hard(i).tech));
      });
    }
    // Leadership (`CmdCom`/`CmdAtk`/`CmdDef`): a command unit's pilot lifts the allies round it.
    function auras() {
      const g = game.st;
      for (const e of host.participants()) {
        if (!live(e) || e.inside) continue;
        const c = cfg(e);
        if (!c?.cmd) continue;
        const s = state(e);
        if (!s.pilot) continue;
        const L = skill(e, s, c, 'leadership');
        if (L < 50) continue;
        const r = (100 + 2 * L) * PX + (c.cmd.extra ?? 0), power = 1 + L * 0.001, team = teamOf(e.owner);
        g.ents.forEach(o => {
          if (!live(o) || o.inside || teamOf(o.owner) !== team || Math.hypot(o.x - e.x, o.y - e.y) > r) return;
          const oc = cfg(o);
          if (!oc || oc.building) return;
          const os = state(o);
          os.aura ??= { until: 0 };
          if (os.aura.until < g.time) os.aura = { until: 0 };
          os.aura[c.cmd.kind] = Math.max(os.aura[c.cmd.kind] ?? 1, power);
          os.aura.until = g.time + 3;
        });
      }
    }

    // ------------------------------------------------------------- skills
    const SKILL_LOCK = { head: PART.head, armR: PART.armR, armL: PART.armL };
    const busy = s => s.stunUntil > now() || s.staggerUntil > now() || s.dazeUntil > now() || s.abandonAt;
    function skillsOf(def) {
      const out = [];
      def.weapons.forEach((w, i) => { const sk = wcfg(w)?.skill; if (sk) out.push({ w, i, sk }); });
      return out;
    }
    function skillReady(e, s, sk, w) {
      if (busy(s) || (s.cd?.[w.id] ?? 0) > now()) return false;
      if ((sk.en ?? 0) > s.en) return false;
      for (const need of sk.needs ?? []) {
        if (need === 'awakening' ? skill(e, s, cfg(e), 'awakening') < 75 : s.parts & SKILL_LOCK[need]) return false;
      }
      return true;
    }
    const countdown = (s, key) => {
      const left = (s.cd?.[key] ?? 0) - now();
      return left > 0 ? ` ${Math.ceil(left)}` : '';
    };
    const label = (text, s, key) => {
      const tail = countdown(s, key);
      return tail ? text.map((t, i) => t + tail + TEXT.seconds[i]) : text.map((t, i) => `${t} ${TEXT.ready[i]}`);
    };
    // A skill used: its EN, its cooldown, and the shots it queues at the point.
    function useSkill(e, s, def, entry, x, y, target) {
      const { w, i, sk } = entry;
      s.en = Math.max(0, s.en - (sk.en ?? 0));
      (s.cd ??= {})[w.id] = now() + (sk.cd ?? 0);
      s.battle = now();
      if (sk.kind === 'strike') return strike(e, target);
      if (sk.kind === 'emp') return emp(e, def, w, sk);
      if (sk.kind === 'area') {
        const at = sk.aim === 'ground' ? { x, y } : { x: e.x, y: e.y };
        const a = { ...at, r: (sk.radius ?? 100) * PX, until: now() + (sk.life ?? 20), owner: e.owner, kind: sk.area ?? 'smoke' };
        if (a.kind === 'detect') return sweep(a);
        return areas.push(a);
      }
      const shots = sk.shots ?? 1;
      for (let n = 0; n < shots; n++) queued.push({ at: now() + (sk.windup ?? 0) + n * (sk.gap ?? 0.1), id: e.id, wi: i, x, y, target: target?.id ?? 0 });
    }
    function fireQueued() {
      const g = game.st;
      for (let j = queued.length - 1; j >= 0; j--) {
        const q = queued[j];
        if (q.at > g.time) continue;
        queued.splice(j, 1);
        const e = g.ents.get(q.id);
        if (!live(e) || e.inside) continue;
        const def = host.effectiveDef(e), w = def.weapons[q.wi];
        const sk = w && wcfg(w)?.skill;
        if (!sk) continue;
        if (sk.kind === 'drone') { launchDrone(e, sk); continue; }
        if (sk.kind === 'mines') { layMine(e, sk); continue; }
        const target = q.target ? g.ents.get(q.target) : null;
        const aim = live(target) ? null : { x: q.x, y: q.y };
        e.angle = Math.atan2((live(target) ? target.y : q.y) - e.y, (live(target) ? target.x : q.x) - e.x);
        host.fireShot(g, e, def, w, live(target) ? target : null, aim);
        state(e).fired = g.time;
      }
    }
    function strike(e, target) {
      if (!live(target)) return;
      const a = Math.atan2(target.y - e.y, target.x - e.x);
      e.x = target.x + Math.cos(a) * 20 * PX;
      e.y = target.y + Math.sin(a) * 20 * PX;
      e.angle = a + Math.PI;
      e.path = null;
      sdk.addEffect(game.st, 'fx.spark', e.x, e.y, 0.4, 6, 1.2);
    }
    function emp(e, def, w, sk) {
      const g = game.st, r = (sk.radius ?? 175) * PX, team = teamOf(e.owner), wc = wcfg(w);
      sdk.addEffect(g, 'fx.emp', e.x, e.y, 0.8, 8, r / 32);
      for (const t of [...g.ents.values()]) {
        if (!live(t) || t.inside || teamOf(t.owner) === team || Math.hypot(t.x - e.x, t.y - e.y) > r) continue;
        host.applyDamage(g, t, w.dmg, ONE, e.owner, e.id, def.id + '/' + w.id, { x: e.x, y: e.y });
        const ts = cfg(t) && states.get(t.id);
        if (ts && wc.stun) ts.stunUntil = Math.max(ts.stunUntil ?? 0, g.time + wc.stun);
      }
    }
    // Funnels, bits and incoms: the unit's own drones, flown round what it fights until they come home.
    function launchDrone(e, sk) {
      if (!sk.spawn || !exists(sk.spawn)) return;
      const g = game.st, a = g.rng.range(0, Math.PI * 2);
      const d = sdk.newEnt(g, sk.spawn, e.owner, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, e.angle, 'spawn');
      const s = state(d);
      s.drone = { owner: e.id, until: g.time + (sk.life ?? 15), next: 0 };
      d.hp = sdk.maxHp(d) * Math.max(0.1, e.hp / sdk.maxHp(e));
    }
    function steerDrones() {
      const g = game.st;
      for (const d of host.participants()) {
        const s = live(d) ? states.get(d.id) : undefined;
        if (!s?.drone) continue;
        const owner = g.ents.get(s.drone.owner);
        if (!live(owner) || g.time > s.drone.until || s.en <= 0) { sdk.kill(g, d, -1, 'despawn'); continue; }
        if (g.time < s.drone.next) continue;
        s.drone.next = g.time + g.rng.range(2, 3);
        const t = owner.targetId ? g.ents.get(owner.targetId) : null;
        const c = live(t) ? t : owner, r = 250 * PX;
        sdk.cmdMove(game, [d.id], c.x + g.rng.range(-r, r), c.y + g.rng.range(-r, r), false, live(t));
      }
    }
    function layMine(e, sk) {
      if (!sk.spawn || !exists(sk.spawn)) return;
      const g = game.st, back = -24;
      sdk.newEnt(g, sk.spawn, e.owner, e.x + Math.cos(e.angle) * back + g.rng.range(-8, 8), e.y + Math.sin(e.angle) * back + g.rng.range(-8, 8), 0, 'spawn');
    }
    // The computer fires a skill when what it fights is in its reach.
    function aiSkills() {
      const g = game.st;
      for (const e of host.participants()) {
        if (!live(e) || e.inside || e.site || !isAI(e.owner)) continue;
        const def = host.effectiveDef(e), list = skillsOf(def);
        if (!list.length) continue;
        const t = e.targetId ? g.ents.get(e.targetId) : null;
        if (!live(t)) continue;
        const s = state(e), d = Math.hypot(t.x - e.x, t.y - e.y);
        for (const entry of list) {
          const { w, sk } = entry;
          if (!sk.ai || !skillReady(e, s, sk, w)) continue;
          if (sk.aim === 'ground' && (d > w.range * 32 || d < (sk.min ?? 0) * 32)) continue;
          if (sk.aim !== 'ground' && sk.kind !== 'area' && sk.kind !== 'emp' && d > w.range * 32) continue;
          useSkill(e, s, def, entry, t.x, t.y, t);
          break;
        }
      }
    }

    // ------------------------------------------------------------- SFS riders
    // A mobile suit riding a sub-flight system fires from it at what it is after.
    let weapons;
    function riders(dt) {
      const g = game.st;
      if (!weapons) return;
      for (const carrier of host.participants()) {
        if (!live(carrier) || !carrier.cargo?.length) continue;
        const c = cfg(carrier);
        if (!c?.sfs?.fire) continue;
        const target = carrier.targetId ? g.ents.get(carrier.targetId) : null;
        carrier.cargo.forEach((id, n) => {
          const r = g.ents.get(id);
          if (!live(r) || r.inside !== carrier.id) return;
          r.x = carrier.x + Math.cos(carrier.angle + Math.PI / 2) * (n - (carrier.cargo.length - 1) / 2) * 12;
          r.y = carrier.y + Math.sin(carrier.angle + Math.PI / 2) * (n - (carrier.cargo.length - 1) / 2) * 12;
          r.angle = carrier.angle;
          if (live(target)) weapons(g, r, host.effectiveDef(r), target, dt, 1, null, null, game.hash);
        });
      }
    }

    // ------------------------------------------------------------- per-tick upkeep
    function coreTick() {
      const g = game.st;
      for (const e of host.participants()) {
        if (!live(e) || e.site) continue;
        const c = cfg(e);
        if (!c || c.building) continue;
        const s = state(e);
        const top = sdk.maxHp(e);
        // fire on the hull: a share of its whole each check, harder on a weak frame (`CheckBurnedDamage`)
        const burning = s.burnUntil > g.time || (s.boostUntil > g.time + 0 && c.boost?.burn) || (c.boost?.burn && s.boostUntil > g.time - 2);
        if (burning) {
          e.hp -= top * 0.0025 * Math.max(0.1, (200 - (c.parts ?? 100)) * 0.01);
          if (s.pilot) s.pilot.hp -= 800 * 0.001 * Math.max(0.1, (200 - (c.safety ?? 100)) * 0.01);
          if (e.hp <= 0) { sdk.kill(g, e, -1, 'killed'); continue; }
          if (s.pilot && s.pilot.hp <= 0) loseAce(e, s), abandon(e, s);
        }
        // a system's run: EXAM and HADES wear the hull, ALICE the EN
        if (c.drain) {
          if (c.drain.hp) e.hp = Math.max(1, e.hp - top * c.drain.hp * CORE);
          if (c.drain.en) {
            s.en = Math.max(0, s.en - c.drain.en * CORE);
            if (s.en <= 0 && c.drain.back && exists(c.drain.back)) shift(e, c.drain.back);
          }
        }
        if (s.camo) {
          s.en = Math.max(0, s.en - (c.camo?.en ?? 4) * CORE);
          if (s.en <= 0 || s.parts) s.camo = false;
        }
        if (c.field?.regen && s.field < c.field.hp) s.field = Math.min(c.field.hp, s.field + c.field.regen * CORE);
      }
    }
    // A change of form the package makes itself, keeping the share of health.
    function shift(e, to) {
      const fraction = e.hp / sdk.maxHp(e);
      sdk.setEntityDef(e, to);
      e.hp = Math.max(1, fraction * sdk.maxHp(e));
    }
    function second() {
      const g = game.st;
      supply();
      economy();
      detect();
      auras();
      aiSkills();
      for (let j = areas.length - 1; j >= 0; j--) {
        const a = areas[j];
        if (a.until <= g.time) areas.splice(j, 1);
        else sdk.addEffect(g, 'fx.smoke', a.x + g.rng.range(-a.r, a.r) * 0.5, a.y + g.rng.range(-a.r, a.r) * 0.5, 2, 8, Math.min(6, a.r / 24));
      }
      // ACEs back from a lost unit wait in the first Academy with room
      for (let j = returning.length - 1; j >= 0; j--) {
        const r = returning[j];
        if (r.at > g.time) continue;
        const academy = host.participants().find(b => live(b) && !b.site && b.owner === r.owner && cfg(b)?.academy && (hangars.get(b.id)?.length ?? 0) < HANGAR);
        if (!academy) continue;
        r.pilot.weak = g.time + 300;
        (hangars.get(academy.id) ?? hangars.set(academy.id, []).get(academy.id)).push(r.pilot);
        returning.splice(j, 1);
      }
      for (const e of host.participants()) {
        if (!live(e)) continue;
        const s = states.get(e.id);
        // supplied within two seconds (`canSupply`): what a loadout switch or a conversion waits on
        if (e.rs?.flags?.includes(SUPPLIED) && !(g.time - (s?.supplied ?? -1e9) < 2)) flags(e, false, SUPPLIED);
        if (s?.abandonAt && g.time >= s.abandonAt) sdk.kill(g, e, -1, 'selfDestruct');
        // a pilot on foot sent aboard
        if (s?.boardTo) boarding(e, s);
        if (s?.backAt && g.time >= s.backAt) backToBase(e, s);
      }
      for (const id of [...states.keys()]) if (!live(g.ents.get(id))) states.delete(id);
      for (const id of [...paid.keys()]) if (!live(g.ents.get(id))) paid.delete(id);
      for (const id of [...moralPaid.keys()]) if (!live(g.ents.get(id))) moralPaid.delete(id);
      for (const id of [...hangars.keys()]) if (!live(g.ents.get(id))) hangars.delete(id);
      for (const id of [...training.keys()]) if (!live(g.ents.get(id))) training.delete(id);
    }
    function boarding(e, s) {
      const g = game.st, t = g.ents.get(s.boardTo);
      if (!live(t) || t.owner !== e.owner) { s.boardTo = undefined; return; }
      const tc = cfg(t), ts = state(t);
      const room = tc?.academy ? (hangars.get(t.id)?.length ?? 0) < HANGAR : tc?.pilot && tc.pilot !== 'none' && !ts.pilot;
      if (!room) { s.boardTo = undefined; return; }
      if (Math.hypot(t.x - e.x, t.y - e.y) > sdk.getDef(t.defId).radius + 48) { sdk.cmdMove(game, [e.id], t.x, t.y); return; }
      if (tc.academy) (hangars.get(t.id) ?? hangars.set(t.id, []).get(t.id)).push(s.carry);
      else { ts.pilot = s.carry; ts.abandonAt = undefined; markAce(t, ts); }
      s.carry = null;
      sdk.kill(g, e, -1, 'despawn');
    }
    function backToBase(e, s) {
      s.backAt = undefined;
      const hq = host.participants().find(b => live(b) && !b.site && b.owner === e.owner && cfg(b)?.hq);
      if (!hq) return;
      e.x = hq.x + game.st.rng.range(-48, 48);
      e.y = hq.y + sdk.getDef(hq.defId).radius + 24;
      e.path = null;
      e.orders = [];
    }

    // ------------------------------------------------------------- Academy and beacon
    // An Academy trains its faction's pilots, and the beacon calls the named
    // ACEs, each on a queue of its own: paid when ordered, one at a time,
    // stepping out beside the building when done.
    const MAX_JOBS = 5;
    function jobs(e, s) {
      const g = game.st, job = s.jobs?.[0];
      if (!job) return;
      if (job.start === undefined) job.start = g.time;
      if (g.time - job.start < job.time) return;
      s.jobs.shift();
      if (!job.def || !exists(job.def)) return;
      const r = sdk.getDef(e.defId).radius ?? 32;
      const u = sdk.newEnt(g, job.def, e.owner, e.x + g.rng.range(-r, r), e.y + r + 16, Math.PI / 2, 'spawn');
      state(u);
    }
    const aceTaken = (owner, def) => {
      for (const e of game.st.ents.values()) if (live(e) && e.owner === owner && e.defId === def) return true;
      for (const b of host.participants()) if (live(b) && b.owner === owner && states.get(b.id)?.jobs?.some(j => j.def === def)) return true;
      return false;
    };
    function buildingActions(e, s, c) {
      const g = game.st, metal = g.players[e.owner].metal, out = [];
      const room = (s.jobs?.length ?? 0) < MAX_JOBS;
      if (c.academy) {
        for (const k of Object.keys(TRAINING)) out.push({ id: 'train/' + k, label: TEXT.types[k].map(t => `${t} (${TRAINING_COST})`), enabled: training.get(e.id) !== k && metal >= TRAINING_COST });
        for (const [kind, [cost]] of Object.entries(c.academy.pilots ?? {})) {
          if (!pilotDef(e.owner, kind === 'CNT')) continue;
          out.push({ id: 'pilot/' + kind, label: TEXT.trainPilot[kind].map(t => `${t} (${cost})`), enabled: room && metal >= cost });
        }
      }
      for (const def of c.beacon ?? []) {
        if (!exists(def)) continue;
        const d = sdk.getDef(def);
        if (!sdk.techMet(g, e.owner, def)) continue;
        out.push({ id: 'ace/' + def, label: `${sdk.t(`unit.${def}.name`)} (${d.cost})`, enabled: room && metal >= d.cost && !aceTaken(e.owner, def) });
      }
      if (s.jobs?.length) out.push({ id: 'cancel', label: TEXT.cancel, enabled: true });
      return out;
    }
    function buildingOrder(e, s, c, action) {
      const g = game.st, p = g.players[e.owner];
      if ((s.jobs?.length ?? 0) >= MAX_JOBS && action !== 'cancel') return false;
      if (action === 'cancel') {
        const job = s.jobs?.pop();
        if (!job) return false;
        p.metal += job.cost;
        return true;
      }
      let job;
      if (c.academy && action.startsWith('pilot/')) {
        const kind = action.slice(6), price = c.academy.pilots?.[kind], def = pilotDef(e.owner, kind === 'CNT');
        if (!price || !def) return false;
        job = { def, cost: price[0], time: price[1] };
      } else if (action.startsWith('ace/')) {
        const def = action.slice(4);
        if (!c.beacon?.includes(def) || !exists(def) || !sdk.techMet(g, e.owner, def) || aceTaken(e.owner, def)) return false;
        const d = sdk.getDef(def);
        job = { def, cost: d.cost, time: d.buildTime ?? 30 };
      }
      if (!job || p.metal < job.cost) return false;
      p.metal -= job.cost;
      (s.jobs ??= []).push(job);
      return true;
    }

    // ------------------------------------------------------------- actions
    function unitActions(e, s, c, def) {
      const out = [];
      if (c.boost) {
        const text = c.boost.burn ? TEXT.overBoost : TEXT.boost;
        out.push({ id: 'boost', label: label(text, s, 'boost'), enabled: !busy(s) && s.en >= c.boost.en && (s.cd?.boost ?? 0) <= now() && !(c.boost.burn && s.parts & PART.backpack) });
      }
      for (const { w, sk } of skillsOf(def)) {
        const a = { id: 'skill/' + w.id, label: label(sk.label ?? [w.id], s, w.id), enabled: skillReady(e, s, sk, w) };
        if (sk.aim === 'ground') a.target = 'ground';
        else if (sk.kind === 'strike') a.target = 'enemy';
        out.push(a);
      }
      if (c.field?.kind === 'psa') out.push({ id: 'psa', label: s.psa ? TEXT.psaOff : TEXT.psaOn, enabled: s.psa || s.field > 0 });
      if (c.camo) out.push({ id: 'camo', label: s.camo ? TEXT.camoOff : TEXT.camoOn, enabled: s.camo || (s.en > 0 && !s.parts) });
      if (s.parts && s.supplied > now() - 2 && !(s.repairUntil > now())) out.push({ id: 'repair', label: TEXT.repair, enabled: !inBattle(s) });
      if (s.pilot?.active?.length) for (const k of s.pilot.active) {
        out.push({ id: 'ace/' + k, label: label(TEXT.aceSkill[k] ?? [k], s, 'ace'), enabled: s.en >= ACE_SKILL.en && (s.cd?.ace ?? 0) <= now() });
      }
      if (s.pilot && !s.pilot.ace && c.pilot !== 'none' && pilotDef(e.owner)) out.push({ id: 'unload', label: TEXT.unload, enabled: !busy(s) });
      return out;
    }
    const pilotDef = (owner, cnt) => {
      const f = factionOf(owner);
      if (!f?.startsWith('gw-')) return undefined;
      const id = `gw-pilot-${cnt ? 'cnt-' : ''}${f.slice(3)}`;
      return exists(id) ? id : undefined;
    };
    function order(o) {
      const g = game.st;
      let changed = false;
      for (const id of o.ids) {
        const e = g.ents.get(id);
        if (!live(e) || e.owner !== o.owner || e.inside || e.site) continue;
        const c = cfg(e);
        if (!c) continue;
        const s = state(e), def = host.effectiveDef(e);
        if ((c.academy || c.beacon) && !o.action.startsWith('train/')) {
          changed = buildingOrder(e, s, c, o.action) || changed;
          continue;
        }
        if (c.academy && o.action.startsWith('train/')) {
          const kind = o.action.slice(6);
          if (!TRAINING[kind] || training.get(e.id) === kind || g.players[e.owner].metal < TRAINING_COST) continue;
          g.players[e.owner].metal -= TRAINING_COST;
          training.set(e.id, kind);
          changed = true;
          continue;
        }
        if (c.pilotUnit) {
          if (o.action === 'board') {
            const t = g.ents.get(o.targetId);
            if (!live(t) || t.owner !== e.owner) continue;
            s.boardTo = t.id;
            sdk.cmdMove(game, [e.id], t.x, t.y);
            changed = true;
          } else if (o.action === 'back') {
            const hq = host.participants().find(b => live(b) && !b.site && b.owner === e.owner && cfg(b)?.hq);
            s.backAt = g.time + (hq && Math.hypot(hq.x - e.x, hq.y - e.y) < 150 * PX + sdk.getDef(hq.defId).radius ? 1 : 10);
            changed = true;
          }
          continue;
        }
        if (o.action === 'boost' && c.boost) {
          if (busy(s) || s.en < c.boost.en || (s.cd?.boost ?? 0) > g.time) continue;
          s.en -= c.boost.en;
          s.boostUntil = g.time + c.boost.time;
          (s.cd ??= {}).boost = g.time + c.boost.time + c.boost.cd;
          changed = true;
        } else if (o.action.startsWith('skill/')) {
          const entry = skillsOf(def).find(x => x.w.id === o.action.slice(6));
          if (!entry || !skillReady(e, s, entry.sk, entry.w)) continue;
          let x = o.x, y = o.y, target = o.targetId ? g.ents.get(o.targetId) : null;
          if (entry.sk.aim === 'ground') {
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            const d = Math.hypot(x - e.x, y - e.y);
            const reach = entry.w.range * 32, least = (entry.sk.min ?? 0) * 32;
            // a point past the reach is brought in to it
            if (d > reach) { x = e.x + (x - e.x) * reach / d; y = e.y + (y - e.y) * reach / d; }
            if (d < least) continue;
          } else {
            if (entry.sk.kind === 'strike' && (!live(target) || Math.hypot(target.x - e.x, target.y - e.y) > 150 * PX)) continue;
            const t = live(target) ? target : e.targetId ? g.ents.get(e.targetId) : null;
            target = live(t) ? t : null;
            x = target?.x ?? e.x + Math.cos(e.angle) * entry.w.range * 32;
            y = target?.y ?? e.y + Math.sin(e.angle) * entry.w.range * 32;
          }
          useSkill(e, s, def, entry, x, y, target);
          changed = true;
        } else if (o.action === 'psa' && c.field?.kind === 'psa') {
          s.psa = !s.psa && s.field > 0;
          changed = true;
        } else if (o.action === 'camo' && c.camo) {
          s.camo = !s.camo && s.en > 0 && !s.parts;
          changed = true;
        } else if (o.action === 'repair' && s.parts) {
          s.repairUntil = g.time + 10;
          e.orders = [];
          e.path = null;
          changed = true;
        } else if (o.action.startsWith('ace/') && s.pilot?.active?.includes(o.action.slice(4))) {
          if (s.en < ACE_SKILL.en || (s.cd?.ace ?? 0) > g.time) continue;
          s.en -= ACE_SKILL.en;
          s.aceSkill = { kind: o.action.slice(4), until: g.time + ACE_SKILL.time };
          (s.cd ??= {}).ace = g.time + ACE_SKILL.cd;
          changed = true;
        } else if (o.action === 'unload' && s.pilot && !s.pilot.ace) {
          const pd = pilotDef(e.owner, s.pilot.t === 'CNT');
          if (!pd) continue;
          const p = sdk.newEnt(g, pd, e.owner, e.x + sdk.getDef(e.defId).radius + 8, e.y, e.angle, 'spawn');
          state(p).carry = s.pilot;
          abandon(e, s);
          changed = true;
        }
      }
      return changed;
    }

    return {
      id: ID,
      // A plan asks TechPoint besides its Money and Resource, and a few units
      // MoralPoint: the lab or factory takes it when the order comes to the
      // head of its queue, and until there is enough the order waits, unworked
      // and unbilled. A plan taken off the queue unfinished gives its TechPoint back.
      wrapBuildingStep(next) {
        const research = (e, def, dt) => {
          const c = cfg(e);
          const r = e.research;
          if (!r || !c?.research) return next(e, def, dt);
          const took = paid.get(e.id);
          if (took !== undefined && took !== r.queue[0]) {
            if (!game.st.players[e.owner]?.tech?.includes(took)) techPoint.set(e.owner, (techPoint.get(e.owner) ?? 0) + (c.research[took] ?? 0));
            paid.delete(e.id);
          }
          if (r.queue.length === 0) return next(e, def, dt);
          const askTP = asks(e, c);
          if (askTP > (techPoint.get(e.owner) ?? 0)) {
            e.research = undefined;
            try { next(e, def, dt); } finally { e.research = r; }
            return;
          }
          if (paid.get(e.id) !== r.queue[0]) {
            techPoint.set(e.owner, (techPoint.get(e.owner) ?? 0) - askTP);
            paid.set(e.id, r.queue[0]);
          }
          next(e, def, dt);
        };
        // a unit asking MoralPoint is paid for when it comes to the head of its
        // factory's queue, and waits there while the side has too little
        return (e, def, dt) => {
          const prod = e.prod;
          if (!prod?.queue.length) return research(e, def, dt);
          const head = prod.queue[0];
          let ask = 0;
          try { ask = host.config(sdk.getDef(head))?.moral ?? 0; } catch { ask = 0; }
          if (ask && !moralPaid.has(e.id)) {
            if ((moral.get(e.owner) ?? MORAL_START) < ask) {
              e.prod = undefined;
              try { research(e, def, dt); } finally { e.prod = prod; }
              return;
            }
            moral.set(e.owner, (moral.get(e.owner) ?? MORAL_START) - ask);
            moralPaid.set(e.id, head);
          }
          const before = prod.queue.length;
          research(e, def, dt);
          // the head made (or the queue cut short): the next one pays its own
          if (!e.prod || e.prod.queue.length < before || e.prod.queue[0] !== moralPaid.get(e.id)) moralPaid.delete(e.id);
        };
      },
      // A unit held by a stun, a stagger, a repair or an empty cockpit does nothing of its own.
      wrapUnitStep(next) {
        return (e, def, dt) => {
          const s = cfg(e) ? states.get(e.id) : undefined;
          if (s && (s.stunUntil > now() || s.repairUntil > now() || s.abandonAt)) {
            e.path = null;
            return;
          }
          if (s?.repairUntil && s.repairUntil <= now()) mend(e, s, cfg(e));
          next(e, def, dt);
        };
      },
      wrapWeapons(next) {
        weapons = next;
        return next;
      },
      wrapDamage(next) {
        return (g, t, raw, mult, owner, sourceId = 0, gun = '', from, hit) => {
          const tc = live(t) ? cfg(t) : undefined;
          const weapon = gun ? weaponOfGun(gun) : undefined;
          const wc = weapon ? host.config(weapon) : undefined;
          if (!tc || !wc) return next(g, t, raw, mult, owner, sourceId, gun, from, hit);
          const src = g.ents.get(sourceId);
          const sdef = src ? sdk.getDef(src.defId) : defOfGun(gun);
          engage(t);
          engage(src);
          const out = resolve(t, tc, wc, src, sdef ? host.config(sdef) : undefined, from);
          if (out === null) return;
          if (!tc.building) {
            const s = state(t);
            if (tc.parts && out.hull > 0) breakPart(t, s, tc, out.hull * (out.extra ?? 1), wc);
            if (out.hull > 0) pilotHit(t, s, tc, out.hull * (out.extra ?? 1), wc);
          }
          return next(g, t, out.hull, ONE, owner, sourceId, gun, from, hit);
        };
      },
      onDamage(ctx) {
        if (!ctx.sourceId || ctx.dealt <= 0) return;
        const src = game.st.ents.get(ctx.sourceId);
        if (live(src) && cfg(src)) gainExp(src, ctx.target, ctx.dealt);
        // an ACE's unit lost sends the ACE home
        if (ctx.target.dead && cfg(ctx.target)) { const s = states.get(ctx.target.id); if (s?.pilot?.ace) loseAce(ctx.target, s); }
      },
      // What the unit is now: its pilot's speed and sight, a boost, broken
      // legs or head, a shield it carries, a daze or a stagger.
      effectiveDef(e, d) {
        const c = host.config(d);
        if (!c || c.building) return d;
        const s = states.get(e.id);
        if (!s) return d;
        let move = s.pilot ? speedMul(skill(e, s, c, 'speed')) : 1;
        if (s.boostUntil > now()) move *= c.boost?.speed ?? 1;
        if (s.parts & PART.legL) move *= 0.9;
        if (s.parts & PART.legR) move *= 0.9;
        if (s.shield > 0 && c.shield) move *= c.shield.speed ?? 1;
        if (s.staggerUntil > now()) move *= 0.25;
        else if (s.dazeUntil > now()) move *= 0.5;
        const head = s.parts & PART.head ? 0.75 : 1;
        const sight = head * (s.pilot && skill(e, s, c, 'awakening') >= 100 ? 1.15 : 1);
        if (move === 1 && sight === 1) return d;
        const key = d.id + '|' + move.toFixed(3) + '|' + sight;
        if (s.composed?.key === key) return s.composed.def;
        const out = { ...d, speed: d.speed * move, turnRate: d.turnRate * move, vision: Math.max(1, Math.round(d.vision * sight)) };
        if (head !== 1) out.weapons = d.weapons.map(w => ({ ...w, range: w.range * head }));
        s.composed = { key, def: out };
        return out;
      },
      canFire(entity, def, weapon) {
        const c = cfg(entity), wc = host.config(weapon);
        if (!c || !wc) return true;
        // a skill fires only when its button is pressed
        if (wc.skill) return false;
        const s = state(entity);
        if (busy(s) || s.repairUntil > now()) return false;
        if (wc.hand && s.parts & PART.armR) return false;
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
        s.battle = now();
        s.fired = now();
        s.camo = false;
        if (c.en?.max) s.en = Math.max(0, s.en - (wc.en ?? 0) - (wc.enShot ?? 0) * (w.burst ?? 1));
      },
      // GW's detection: an enemy is seen only while some detection has found it.
      filterVisibility(entity, team, visible) {
        if (!visible || teamOf(entity.owner) === team) return visible;
        return detected(entity, team);
      },
      afterEntities(dt) {
        riders(dt);
      },
      afterStep(dt) {
        const g = game.st;
        for (const e of host.participants()) {
          if (!live(e)) continue;
          const c = cfg(e);
          if (!c?.en?.max) continue;
          const s = state(e);
          const moved = Math.hypot(e.x - s.x, e.y - s.y) / Math.max(dt, 1e-6);
          // Moving drains EN (`Check_Move_EN`), at a quarter RW px a tick or more.
          if (!e.inside && moved > 0.25 * 60 * PX) s.en = Math.max(0, s.en - (c.en.move ?? 0) * dt);
          s.x = e.x; s.y = e.y;
        }
        fireQueued();
        for (const b of host.participants()) {
          const bs = live(b) && !b.site ? states.get(b.id) : undefined;
          if (bs?.jobs?.length) jobs(b, bs);
        }
        core += dt;
        while (core >= CORE) { core -= CORE; coreTick(); steerDrones(); }
        clock += dt;
        while (clock >= 1) { clock -= 1; second(); }
      },
      inspect(entity, privateView) {
        const c = cfg(entity);
        if (!c) return [];
        const s = state(entity);
        const rows = [];
        if (c.en?.max) {
          rows.push({ id: 'en', label: TEXT.en, value: Math.round(s.en) + ' / ' + Math.round(c.en.max), fraction: s.en / c.en.max,
            tone: s.en <= 0 ? 'danger' : s.en < c.en.max * 0.25 ? 'warning' : 'normal' });
        }
        if (c.shield) rows.push({ id: 'shield', label: TEXT.shield, value: Math.round(s.shield) + ' / ' + c.shield.hp, fraction: s.shield / c.shield.hp, tone: s.shield <= 0 ? 'danger' : 'normal' });
        if (c.field) rows.push({ id: 'field', label: TEXT.field[c.field.kind], value: Math.max(0, Math.round(s.field)) + ' / ' + c.field.hp, fraction: Math.max(0, s.field) / c.field.hp,
          tone: c.field.kind === 'psa' && !s.psa ? 'warning' : s.field <= 0 ? 'danger' : 'normal' });
        if (c.dp && s.dp && now() - (s.dpAt ?? -1e9) <= 3) rows.push({ id: 'dp', label: TEXT.dp, value: Math.round(s.dp) + ' / ' + c.dp, fraction: s.dp / c.dp, tone: s.dp >= c.dp * 0.6 ? 'warning' : 'normal' });
        if (privateView && c.pilot && c.pilot !== 'none') {
          const p = s.pilot;
          if (!p) rows.push({ id: 'pilot', label: TEXT.pilot, value: TEXT.noPilot, tone: 'danger' });
          else {
            const figures = ` · S${Math.round(skill(entity, s, c, 'shoot'))} C${Math.round(skill(entity, s, c, 'cqb'))} R${Math.round(skill(entity, s, c, 'reaction'))}`;
            rows.push({ id: 'pilot', label: TEXT.pilot, value: TEXT.level.map(l => `${l} ${p.level}${figures}`), fraction: p.level >= 3 ? 1 : p.exp / p.need });
          }
        }
        if (s.parts) {
          const broken = Object.entries(PART).filter(([k, b]) => k !== 'backpack' && s.parts & b).map(([k]) => TEXT[k]);
          rows.push({ id: 'parts', label: TEXT.parts, value: [0, 1, 2].map(i => broken.map(b => b[i]).join(', ')), tone: 'warning' });
        }
        // the owner's TechPoint, and on a waiting lab what its plan asks
        if (privateView && (c.techPoint || c.research)) {
          const have = techPoint.get(entity.owner) ?? 0, ask = asks(entity, c);
          rows.push(ask > have
            ? { id: 'techPoint', label: TEXT.techPoint, value: Math.floor(have) + ' / ' + Math.round(ask), fraction: have / ask, tone: 'warning' }
            : { id: 'techPoint', label: TEXT.techPoint, value: Math.floor(have) });
        }
        if (privateView && c.hq) rows.push({ id: 'moral', label: TEXT.moral, value: Math.floor(moral.get(entity.owner) ?? MORAL_START) });
        if (privateView && s.jobs?.length) {
          const job = s.jobs[0], done = job.start === undefined ? 0 : Math.min(1, (now() - job.start) / Math.max(0.1, job.time));
          const d = exists(job.def) ? sdk.getDef(job.def) : undefined;
          rows.push({ id: 'job', label: c.academy ? TEXT.work : TEXT.call, value: d ? `${sdk.t(`unit.${job.def}.name`)} ×${s.jobs.length}` : '', fraction: done });
        }
        if (privateView && c.academy) {
          rows.push({ id: 'training', label: TEXT.type, value: TEXT.types[training.get(entity.id) ?? 'none'] });
          rows.push({ id: 'hangar', label: TEXT.hangar, value: (hangars.get(entity.id)?.length ?? 0) + ' / ' + HANGAR });
        }
        return rows;
      },
      actions(entity) {
        const c = cfg(entity);
        if (!c || entity.inside || entity.site) return [];
        const s = state(entity);
        if (c.academy || c.beacon) return buildingActions(entity, s, c);
        if (c.pilotUnit) return [{ id: 'board', label: TEXT.board, enabled: !!s.carry, target: 'own' }, { id: 'back', label: TEXT.back, enabled: !s.backAt }];
        if (c.building) return [];
        return unitActions(entity, s, c, host.effectiveDef(entity));
      },
      order,
      snapshot(view) {
        const entities = {};
        for (const [id, s] of states) {
          const e = game.st.ents.get(id);
          if (!live(e)) continue;
          if (view?.player !== undefined && e.owner !== view.player) continue;
          const { composed, ...rest } = s;
          entities[id] = structuredClone(rest);
        }
        const mine = i => view?.player === undefined || view.player === +i;
        const tech = {}, labs = {}, morals = {}, factories = {}, hangarOut = {}, trainingOut = {};
        for (const [i, v] of techPoint) if (mine(i)) tech[i] = v;
        for (const [i, v] of moral) if (mine(i)) morals[i] = v;
        const owned = (map, out) => { for (const [id, v] of map) { const e = game.st.ents.get(id); if (live(e) && mine(e.owner)) out[id] = structuredClone(v); } };
        owned(paid, labs); owned(moralPaid, factories); owned(hangars, hangarOut); owned(training, trainingOut);
        return { version: 3, clock, core, entities, techPoint: tech, paid: labs, moral: morals, moralPaid: factories, hangars: hangarOut, training: trainingOut,
          returning: returning.filter(r => mine(r.owner)).map(r => structuredClone(r)),
          queued: queued.filter(q => mine(game.st.ents.get(q.id)?.owner ?? -1)).map(q => ({ ...q })),
          areas: areas.filter(a => mine(a.owner)).map(a => ({ ...a })) };
      },
      restore(value) {
        if (!value || ![1, 2, 3].includes(value.version) || typeof value.entities !== 'object' || !Number.isFinite(value.clock)) throw Error('Invalid GW battle state');
        const num = (v, what) => { if (!Number.isFinite(v)) throw Error('Invalid GW ' + what); return v; };
        const tech = new Map(), labs = new Map(), morals = new Map(), factories = new Map(), hangarIn = new Map(), trainingIn = new Map();
        for (const [i, v] of Object.entries(value.techPoint ?? {})) {
          if (!game.st.players[+i] || !Number.isFinite(v) || v < 0) throw Error('Invalid GW TechPoint ' + i);
          tech.set(+i, v);
        }
        for (const [i, v] of Object.entries(value.moral ?? {})) { if (!game.st.players[+i]) throw Error('Invalid GW MoralPoint ' + i); morals.set(+i, num(v, 'MoralPoint')); }
        for (const [id, node] of Object.entries(value.paid ?? {})) {
          const e = game.st.ents.get(+id);
          if (!e?.research || typeof node !== 'string' || !(cfg(e)?.research && node in cfg(e).research)) throw Error('Invalid GW research ' + id);
          labs.set(+id, node);
        }
        for (const [id, def] of Object.entries(value.moralPaid ?? {})) {
          if (!game.st.ents.get(+id) || typeof def !== 'string' || !exists(def)) throw Error('Invalid GW factory ' + id);
          factories.set(+id, def);
        }
        for (const [id, list] of Object.entries(value.hangars ?? {})) {
          if (!cfg(game.st.ents.get(+id) ?? { defId: '' })?.academy || !Array.isArray(list) || list.length > HANGAR) throw Error('Invalid GW hangar ' + id);
          hangarIn.set(+id, structuredClone(list));
        }
        for (const [id, kind] of Object.entries(value.training ?? {})) {
          if (!game.st.ents.get(+id) || !TRAINING[kind]) throw Error('Invalid GW training ' + id);
          trainingIn.set(+id, kind);
        }
        const next = new Map();
        for (const [id, s] of Object.entries(value.entities)) {
          const e = game.st.ents.get(+id);
          if (!e || !cfg(e) || !s || ![s.en, s.dodge, s.dodgeUntil, s.battle, s.x, s.y].every(Number.isFinite) || s.en < 0 || s.dodge < 0 || s.dodge > 9
            || !Array.isArray(s.spent) || s.spent.length > 8 || s.spent.some(w => !sdk.getDef(e.defId).weapons.some(x => x.id === w)))
            throw Error('Invalid GW battle entity ' + id);
          next.set(+id, structuredClone(s));
        }
        states.clear();
        for (const [id, s] of next) states.set(id, s);
        techPoint.clear(); for (const [i, v] of tech) techPoint.set(i, v);
        paid.clear(); for (const [id, node] of labs) paid.set(id, node);
        moral.clear(); for (const [i, v] of morals) moral.set(i, v);
        moralPaid.clear(); for (const [id, d] of factories) moralPaid.set(id, d);
        hangars.clear(); for (const [id, l] of hangarIn) hangars.set(id, l);
        training.clear(); for (const [id, k] of trainingIn) training.set(id, k);
        returning.length = 0; returning.push(...(value.returning ?? []).map(r => structuredClone(r)));
        queued.length = 0; queued.push(...(value.queued ?? []).map(q => ({ ...q })));
        areas.length = 0; areas.push(...(value.areas ?? []).map(a => ({ ...a })));
        clock = value.clock;
        core = Number.isFinite(value.core) ? value.core : 0;
      },
      dispose() { states.clear(); techPoint.clear(); paid.clear(); moral.clear(); moralPaid.clear(); hangars.clear(); training.clear(); returning.length = 0; queued.length = 0; areas.length = 0; },
    };

    // What the node at the head of a lab's queue still asks in TechPoint: none
    // once the lab has taken it.
    function asks(e, c) {
      const head = e.research?.queue[0];
      return head === undefined || paid.get(e.id) === head ? 0 : c.research?.[head] ?? 0;
    }
  }

  return { capabilities: [{ id: ID, create }] };
}
