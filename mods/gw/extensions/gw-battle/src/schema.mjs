// GW battle data: what a definition or a weapon carries for the `gw.battle-v1`
// runtime. Readers validate and return a clean copy; nothing here executes.
export default function () {
  const id = 'gw.battle-v1';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const STANCES = ['land', 'air', 'aqua'];
  const SIZES = ['large', 'small'];
  const KINDS = ['shell', 'beam', 'cqb'];

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
    return { fail, number, record, only };
  }

  function definition(raw, path, issues) {
    const { fail, number, record, only } = checker(issues);
    if (!object(raw)) { fail(path, 'expected a GW battle configuration'); return; }
    only(raw, path, ['level', 'def', 'plus', 'stance', 'size', 'en', 'mp', 'building', 'supply', 'upkeep', 'hq', 'techPoint', 'research']);
    record(raw.level, path + '.level', ['shoot', 'cqb', 'accuracy', 'reaction'], 0, 10000);
    record(raw.def, path + '.def', ['beam', 'shell', 'cqb', 'dp'], -1000, 100);
    record(raw.plus, path + '.plus', ['beam', 'shell', 'cqb', 'dp'], -100000, 1000000);
    if (raw.stance !== undefined && !STANCES.includes(raw.stance)) fail(path + '.stance', 'expected land, air or aqua');
    if (raw.size !== undefined && !SIZES.includes(raw.size)) fail(path + '.size', 'expected large or small');
    record(raw.en, path + '.en', ['max', 'move'], 0, 1000000);
    number(raw.mp, path + '.mp', 0, 1000);
    if (raw.building !== undefined && typeof raw.building !== 'boolean') fail(path + '.building', 'expected a boolean');
    if (raw.hq !== undefined && typeof raw.hq !== 'boolean') fail(path + '.hq', 'expected a boolean');
    record(raw.supply, path + '.supply', ['range', 'hp', 'en'], 0, 100000);
    number(raw.upkeep, path + '.upkeep', 0, 100000);
    // TechPoint: what it earns a second, and on a lab what each node it researches asks
    number(raw.techPoint, path + '.techPoint', 0, 1000);
    if (raw.research !== undefined) {
      if (!object(raw.research)) fail(path + '.research', 'expected node id → TechPoint');
      else for (const [k, v] of Object.entries(raw.research)) {
        if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(k)) fail(path + '.research.' + k, 'expected a research node id');
        number(v, path + '.research.' + k, 0, 10000000, false);
      }
    }
    return structuredClone(raw);
  }

  function weapon(raw, path, issues) {
    const { fail, number, record, only } = checker(issues);
    if (!object(raw)) { fail(path, 'expected a GW weapon payload'); return; }
    only(raw, path, ['kind', 'shell', 'shellAp', 'beam', 'beamAp', 'cqb', 'cqbAp', 'cqbShell', 'cqbBeam', 'dp', 'accuracy',
      'cantDodge', 'anti', 'size', 'blast', 'en', 'enShot', 'once']);
    if (!KINDS.includes(raw.kind)) fail(path + '.kind', 'expected shell, beam or cqb');
    for (const k of ['shell', 'shellAp', 'beam', 'beamAp', 'cqb', 'cqbAp', 'cqbShell', 'cqbBeam', 'dp', 'blast', 'en', 'enShot'])
      number(raw[k], path + '.' + k, 0, 10000000);
    number(raw.accuracy, path + '.accuracy', 0, 10000, false);
    for (const k of ['cantDodge', 'once']) if (raw[k] !== undefined && typeof raw[k] !== 'boolean') fail(path + '.' + k, 'expected a boolean');
    record(raw.anti, path + '.anti', ['land', 'air', 'aqua', 'building'], 0, 100);
    record(raw.size, path + '.size', ['large', 'small', 'largeAccuracy', 'smallAccuracy'], 0, 100);
    return structuredClone(raw);
  }

  return { capabilities: [{ id, definition, weapon }] };
}
