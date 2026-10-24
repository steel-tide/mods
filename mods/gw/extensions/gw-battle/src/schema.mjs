// GW battle data: what a definition or a weapon carries for the `gw.battle-v1`
// runtime. Readers validate and return a clean copy; nothing here executes.
export default function () {
  const id = 'gw.battle-v1';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const STANCES = ['land', 'air', 'aqua'];
  const SIZES = ['large', 'small'];
  const KINDS = ['shell', 'beam', 'cqb'];
  const PILOTS = ['N', 'O', 'CNT', 'none'];
  const FIELDS = ['ifield', 'psa', 'abc'];
  const COMMANDS = ['com', 'atk', 'def'];
  const AIMS = ['ground', 'self'];
  const SKILLS = ['shot', 'drone', 'mines', 'area', 'emp', 'strike'];
  const DEFENCES = ['beam', 'shell', 'cqb', 'dp'];
  const PILOT_SKILLS = ['shoot', 'cqb', 'def', 'speed', 'accuracy', 'reaction', 'leadership', 'awakening'];
  const BOOSTS = ['accuracy', 'reaction', 'awakening', 'exp', 'leadership', 'shoot', 'cqb', 'def', 'speed', 'atk', 'exam'];
  const ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;

  function checker(issues) {
    const fail = (at, message) => issues.push({ path: at, message });
    const number = (value, at, low, high, optional = true) => {
      if (value === undefined && optional) return;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) fail(at, `expected a number in ${low}–${high}`);
    };
    const record = (value, at, keys, low, high) => {
      if (value === undefined) return;
      if (!object(value)) return fail(at, 'expected an object');
      for (const k of Object.keys(value)) {
        if (!keys.includes(k)) fail(at + '.' + k, 'unknown field');
        else number(value[k], at + '.' + k, low, high);
      }
    };
    const only = (raw, path, keys) => {
      for (const k of Object.keys(raw)) if (!keys.includes(k)) fail(path + '.' + k, 'unknown GW battle field');
    };
    const oneOf = (value, at, values) => {
      if (value !== undefined && !values.includes(value)) fail(at, 'expected one of ' + values.join(', '));
    };
    const flag = (value, at) => {
      if (value !== undefined && typeof value !== 'boolean') fail(at, 'expected a boolean');
    };
    const text = (value, at) => {
      if (value === undefined) return;
      if (!Array.isArray(value) || value.length < 1 || value.length > 3 || value.some(v => typeof v !== 'string' || v.length > 400)) fail(at, 'expected [en, zh, ko] text');
    };
    const ref = (value, at) => {
      if (value !== undefined && (typeof value !== 'string' || !ID.test(value))) fail(at, 'expected a def id');
    };
    return { fail, number, record, only, oneOf, flag, text, ref };
  }

  function definition(raw, path, issues) {
    const c = checker(issues);
    const { fail, number, record, only, oneOf, flag, ref } = c;
    if (!object(raw)) { fail(path, 'expected a GW battle configuration'); return; }
    only(raw, path, ['level', 'def', 'plus', 'stance', 'size', 'en', 'mp', 'building', 'supply', 'upkeep', 'hq', 'techPoint', 'research',
      'unitLevel', 'pilot', 'safety', 'parts', 'dp', 'shield', 'field', 'detect', 'boost', 'cmd', 'leads', 'moral', 'drain',
      'academy', 'ace', 'pilotUnit', 'sfs', 'drone', 'camo', 'beacon']);
    record(raw.level, path + '.level', ['shoot', 'cqb', 'accuracy', 'reaction'], 0, 10000);
    record(raw.def, path + '.def', DEFENCES, -1000, 100);
    record(raw.plus, path + '.plus', DEFENCES, -100000, 1000000);
    oneOf(raw.stance, path + '.stance', STANCES);
    oneOf(raw.size, path + '.size', SIZES);
    record(raw.en, path + '.en', ['max', 'move'], 0, 1000000);
    number(raw.mp, path + '.mp', 0, 1000);
    flag(raw.building, path + '.building');
    flag(raw.hq, path + '.hq');
    record(raw.supply, path + '.supply', ['range', 'hp', 'en'], 0, 100000);
    number(raw.upkeep, path + '.upkeep', 0, 100000);
    // TechPoint: what it earns a second, and on a lab what each node it researches asks
    number(raw.techPoint, path + '.techPoint', 0, 1000);
    if (raw.research !== undefined) {
      if (!object(raw.research)) fail(path + '.research', 'expected node id → TechPoint');
      else for (const [k, v] of Object.entries(raw.research)) {
        if (!ID.test(k)) fail(path + '.research.' + k, 'expected a research node id');
        number(v, path + '.research.' + k, 0, 10000000, false);
      }
    }
    number(raw.unitLevel, path + '.unitLevel', 0, 1000000);
    oneOf(raw.pilot, path + '.pilot', PILOTS);
    number(raw.safety, path + '.safety', 1, 10000);
    number(raw.parts, path + '.parts', 1, 10000);
    number(raw.dp, path + '.dp', 0, 10000000);
    if (raw.shield !== undefined) {
      if (!object(raw.shield)) fail(path + '.shield', 'expected a shield');
      else {
        only(raw.shield, path + '.shield', ['hp', 'block', 'size', 'speed', 'def', 'plus']);
        number(raw.shield.hp, path + '.shield.hp', 1, 10000000, false);
        number(raw.shield.block, path + '.shield.block', 0, 1, false);
        number(raw.shield.size, path + '.shield.size', 0, 1, false);
        number(raw.shield.speed, path + '.shield.speed', 0, 10);
        record(raw.shield.def, path + '.shield.def', DEFENCES, -1000, 100);
        record(raw.shield.plus, path + '.shield.plus', DEFENCES, -100000, 1000000);
      }
    }
    if (raw.field !== undefined) {
      if (!object(raw.field)) fail(path + '.field', 'expected a field');
      else {
        only(raw.field, path + '.field', ['kind', 'hp', 'level', 'regen']);
        oneOf(raw.field.kind, path + '.field.kind', FIELDS);
        number(raw.field.hp, path + '.field.hp', 1, 100000000, false);
        number(raw.field.level, path + '.field.level', 0, 1, false);
        number(raw.field.regen, path + '.field.regen', 0, 100000000);
      }
    }
    record(raw.detect, path + '.detect', ['range', 'anti'], -100000, 100000);
    if (raw.boost !== undefined) {
      if (!object(raw.boost)) fail(path + '.boost', 'expected a boost');
      else {
        only(raw.boost, path + '.boost', ['en', 'time', 'cd', 'speed', 'reaction', 'burn']);
        for (const k of ['en', 'time', 'cd', 'speed', 'reaction']) number(raw.boost[k], path + '.boost.' + k, 0, 100000, false);
        flag(raw.boost.burn, path + '.boost.burn');
      }
    }
    if (raw.cmd !== undefined) {
      if (!object(raw.cmd)) fail(path + '.cmd', 'expected a command aura');
      else { only(raw.cmd, path + '.cmd', ['kind', 'extra']); oneOf(raw.cmd.kind, path + '.cmd.kind', COMMANDS); number(raw.cmd.extra, path + '.cmd.extra', 0, 100000); }
    }
    flag(raw.leads, path + '.leads');
    number(raw.moral, path + '.moral', 0, 100000);
    if (raw.drain !== undefined) {
      if (!object(raw.drain)) fail(path + '.drain', 'expected a drain');
      else { only(raw.drain, path + '.drain', ['hp', 'en', 'back']); number(raw.drain.hp, path + '.drain.hp', 0, 1); number(raw.drain.en, path + '.drain.en', 0, 100000); ref(raw.drain.back, path + '.drain.back'); }
    }
    if (raw.academy !== undefined) {
      const a = raw.academy;
      if (!object(a)) fail(path + '.academy', 'expected an academy');
      else {
        only(a, path + '.academy', ['level', 'pilots']);
        number(a.level, path + '.academy.level', 0, 10, false);
        if (!object(a.pilots)) fail(path + '.academy.pilots', 'expected the pilots it trains');
        else for (const [k, v] of Object.entries(a.pilots)) {
          if (!['N', 'CNT'].includes(k) || !Array.isArray(v) || v.length !== 2 || v.some(x => typeof x !== 'number' || !(x >= 0 && x <= 100000))) fail(path + '.academy.pilots.' + k, 'expected [cost, seconds]');
        }
      }
    }
    if (raw.ace !== undefined) {
      const a = raw.ace;
      if (!object(a)) fail(path + '.ace', 'expected an ACE pilot');
      else {
        only(a, path + '.ace', ['code', 'skills', 'comprehension', 'need', 'returnCd', 'active']);
        if (typeof a.code !== 'string' || !/^[A-Z0-9_]{1,12}$/.test(a.code)) fail(path + '.ace.code', 'expected an ACE code');
        record(a.skills, path + '.ace.skills', PILOT_SKILLS, 0, 10000);
        number(a.comprehension, path + '.ace.comprehension', 0, 1000);
        number(a.need, path + '.ace.need', 0, 10000000);
        number(a.returnCd, path + '.ace.returnCd', 0, 100000);
        if (a.active !== undefined && (!Array.isArray(a.active) || a.active.some(x => !BOOSTS.includes(x)))) fail(path + '.ace.active', 'expected pilot skills');
      }
    }
    oneOf(raw.pilotUnit, path + '.pilotUnit', ['N', 'CNT']);
    if (raw.sfs !== undefined) {
      if (!object(raw.sfs)) fail(path + '.sfs', 'expected SFS slots');
      else { only(raw.sfs, path + '.sfs', ['slots', 'fire']); number(raw.sfs.slots, path + '.sfs.slots', 1, 8, false); flag(raw.sfs.fire, path + '.sfs.fire'); }
    }
    flag(raw.drone, path + '.drone');
    if (raw.camo !== undefined) {
      if (!object(raw.camo)) fail(path + '.camo', 'expected a camouflage');
      else { only(raw.camo, path + '.camo', ['en', 'anti']); number(raw.camo.en, path + '.camo.en', 0, 100000); number(raw.camo.anti, path + '.camo.anti', 0, 100000); }
    }
    if (raw.beacon !== undefined && (!Array.isArray(raw.beacon) || raw.beacon.length > 64 || raw.beacon.some(x => typeof x !== 'string' || !ID.test(x)))) fail(path + '.beacon', 'expected the ACE units it calls');
    return structuredClone(raw);
  }

  function weapon(raw, path, issues) {
    const { fail, number, record, only, oneOf, flag, text, ref } = checker(issues);
    if (!object(raw)) { fail(path, 'expected a GW weapon payload'); return; }
    only(raw, path, ['kind', 'shell', 'shellAp', 'beam', 'beamAp', 'cqb', 'cqbAp', 'cqbShell', 'cqbBeam', 'dp', 'accuracy',
      'cantDodge', 'anti', 'size', 'blast', 'en', 'enShot', 'partBreak', 'cockpit', 'pilotDmg', 'pilotTrue', 'stun', 'burn',
      'blastRange', 'blastMul', 'blastDp', 'pierce', 'pierceMul', 'hand', 'skill']);
    if (!KINDS.includes(raw.kind)) fail(path + '.kind', 'expected shell, beam or cqb');
    for (const k of ['shell', 'shellAp', 'beam', 'beamAp', 'cqb', 'cqbAp', 'cqbShell', 'cqbBeam', 'dp', 'blast', 'en', 'enShot',
      'pilotTrue', 'stun', 'burn', 'blastRange'])
      number(raw[k], path + '.' + k, 0, 10000000);
    for (const k of ['partBreak', 'cockpit', 'pilotDmg', 'blastMul', 'blastDp', 'pierceMul']) number(raw[k], path + '.' + k, 0, 1000);
    number(raw.pierce, path + '.pierce', 1, 100);
    number(raw.accuracy, path + '.accuracy', 0, 10000, false);
    flag(raw.cantDodge, path + '.cantDodge');
    flag(raw.hand, path + '.hand');
    record(raw.anti, path + '.anti', ['land', 'air', 'aqua', 'building'], 0, 1000);
    record(raw.size, path + '.size', ['large', 'small', 'largeAccuracy', 'smallAccuracy'], 0, 100);
    if (raw.skill !== undefined) {
      const s = raw.skill, at = path + '.skill';
      if (!object(s)) fail(at, 'expected a skill');
      else {
        only(s, at, ['label', 'aim', 'kind', 'area', 'en', 'cd', 'shots', 'windup', 'gap', 'min', 'ai', 'spawn', 'life', 'radius', 'needs']);
        oneOf(s.area, at + '.area', ['smoke', 'minovsky', 'detect']);
        text(s.label, at + '.label');
        oneOf(s.aim, at + '.aim', AIMS);
        oneOf(s.kind, at + '.kind', SKILLS);
        for (const k of ['en', 'cd', 'windup', 'gap', 'min', 'life', 'radius']) number(s[k], at + '.' + k, 0, 100000);
        number(s.shots, at + '.shots', 1, 200);
        flag(s.ai, at + '.ai');
        ref(s.spawn, at + '.spawn');
        if (s.needs !== undefined && (!Array.isArray(s.needs) || s.needs.some(x => !['head', 'armR', 'armL', 'awakening'].includes(x)))) fail(at + '.needs', 'expected parts');
      }
    }
    return structuredClone(raw);
  }

  return { capabilities: [{ id, definition, weapon }] };
}
