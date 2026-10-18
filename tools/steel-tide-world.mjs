let read, references;
let loading;
let trustedPackages;
function grantTrustedExtensions(stamps) {
  if (!stamps.length) return;
  for (const stamp of stamps)
    if (typeof stamp === "string" && stamp.length <= 512 && !trustedPackages?.has(stamp)) {
      (trustedPackages ??= /* @__PURE__ */ new Set()).add(stamp);
    }
}
function isTrustedExtension(stamp) {
  return trustedPackages?.has(stamp) ?? false;
}
let prepareSchemas$1;
let checkPackages;
function registerContentSchema(reader, validator, checker) {
  read = reader;
  references = validator;
  checkPackages = checker;
}
function validateContentPackages(raw, issues) {
  if (!checkPackages)
    issues.push({ path: "mod.extensionPackages", message: "extension package schema must be prepared" });
  else checkPackages(raw, "mod.extensionPackages", issues);
}
function contentSchemaPrepared() {
  return read !== void 0;
}
function needsContentSchema(input) {
  if (typeof input === "string") {
    if (!/"v"\s*:\s*[34](?:\s*[,}])/.test(input)) return false;
    try {
      return needsContentSchema(JSON.parse(input));
    } catch {
      return false;
    }
  }
  if (Array.isArray(input)) return input.some(needsContentSchema);
  if (!input || typeof input !== "object") return false;
  const value = input;
  const configured = value.extensionPackages !== void 0 || Array.isArray(value.requiredCapabilities) && value.requiredCapabilities.length > 0 || Array.isArray(value.defs) && value.defs.some((def) => {
    if (!def || typeof def !== "object") return false;
    const d = def;
    return d.extensions !== void 0 || Array.isArray(d.weapons) && d.weapons.some((w2) => !!w2 && typeof w2 === "object" && "extensions" in w2);
  });
  return value.format === "steel-tide-mod" && (value.v === 3 || value.v === 4) && !!configured || Array.isArray(value.mods) && value.mods.some(needsContentSchema);
}
function prepareContentSchema(input, trust = false) {
  if (!needsContentSchema(input)) return null;
  if (prepareSchemas$1) return prepareSchemas$1(input, trust);
  if (!loading) {
    loading = Promise.resolve().then(() => schema).then((schema2) => {
      registerContentSchema(schema2.readExtensions, schema2.validateExtensionReferences, schema2.checkExtensionPackages);
      prepareSchemas$1 = schema2.prepareSchemas;
      schema2.preparedExtensionStamps;
    });
    loading.catch(() => {
      loading = void 0;
    });
  }
  return loading.then(async () => {
    await prepareSchemas$1?.(input, trust);
  });
}
function readExtensions$1(raw, pack, path, issues, context, weapon = false) {
  if (!read) {
    issues.push({ path, message: "content extension schema must be prepared before validation" });
    return;
  }
  return read(raw, pack, path, issues, context, weapon);
}
function validateExtensionReferences$1(def, table, path, issues, forms, pack) {
  references?.(def, table, path, issues, forms, pack);
}
const EXTENSION_HOST_VERSION = 1;
function validCapabilityId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
}
function extensionPackageStamp(pkg) {
  const resources = pkg.assets ? ":" + resourceFingerprint(pkg.assets) : "";
  return `${pkg.id}@${pkg.version}:${pkg.schema.sha256}:${pkg.runtime.sha256}:${pkg.presentation?.sha256 ?? ""}${resources}`;
}
function resourceFingerprint(assets) {
  const text = JSON.stringify(Object.entries(assets).sort(([a2], [b2]) => a2 < b2 ? -1 : a2 > b2 ? 1 : 0));
  let a = 2166136261, b = 2654435769, c = 2246822507, d = 3266489909;
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    a = Math.imul(a ^ n, 16777619);
    b = Math.imul(b ^ n, 2246822507);
    c = Math.imul(c ^ n, 3266489909);
    d = Math.imul(d ^ n, 668265263);
  }
  return [a, b, c, d].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
}
const K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
const rotate = (n, bits) => n >>> bits | n << 32 - bits;
function sha256Hex(input) {
  const size = Math.ceil((input.length + 9) / 64) * 64, bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  bytes.set(input);
  bytes[input.length] = 128;
  const bits = input.length * 8;
  view.setUint32(size - 8, Math.floor(bits / 4294967296));
  view.setUint32(size - 4, bits >>> 0);
  const hash = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]), words = new Uint32Array(64);
  for (let block = 0; block < size; block += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ x >>> 3) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ y >>> 10) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const first = h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + K[i] + words[i] >>> 0;
      const second = (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + first >>> 0;
      d = c;
      c = b;
      b = a;
      a = first + second >>> 0;
    }
    const values = [a, b, c, d, e, f, g, h];
    for (let i = 0; i < 8; i++) hash[i] = hash[i] + values[i] >>> 0;
  }
  return [...hash].map((n) => n.toString(16).padStart(8, "0")).join("");
}
const verifiedSources = /* @__PURE__ */ new Map();
const schemas = /* @__PURE__ */ new Map();
const pendingSchemas = /* @__PURE__ */ new Map();
const modules = /* @__PURE__ */ new Map();
const rawObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const maxSource = 512 * 1024;
function checkExtensionPackages(raw, path, issues) {
  const start = issues.length;
  if (!Array.isArray(raw) || raw.length > 16) {
    issues.push({ path, message: "must be a list of up to 16 extension packages" });
    return false;
  }
  const ids = /* @__PURE__ */ new Set(), capabilities = /* @__PURE__ */ new Set();
  for (const [i, value] of raw.entries()) {
    const p = `${path}[${i}]`;
    if (!rawObject(value)) {
      issues.push({ path: p, message: "must be an extension package" });
      continue;
    }
    for (const key of Object.keys(value))
      if (!["id", "version", "api", "capabilities", "schema", "runtime", "presentation", "assets"].includes(key))
        issues.push({ path: `${p}.${key}`, message: "unsupported field" });
    if (!validCapabilityId(value.id) || ids.has(value.id))
      issues.push({ path: `${p}.id`, message: "must be a unique bounded identifier" });
    else ids.add(value.id);
    if (typeof value.version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(value.version) || value.version.length > 32)
      issues.push({ path: `${p}.version`, message: "must be a semantic version" });
    if (value.api !== EXTENSION_HOST_VERSION)
      issues.push({ path: `${p}.api`, message: `requires unsupported extension host API ${String(value.api)}` });
    if (!Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.length > 32 || new Set(value.capabilities).size !== value.capabilities.length || value.capabilities.some((id2) => !validCapabilityId(id2) || capabilities.has(id2)))
      issues.push({ path: `${p}.capabilities`, message: "must declare unique bounded capability IDs" });
    else for (const id2 of value.capabilities) capabilities.add(id2);
    if (value.assets !== void 0) {
      if (!rawObject(value.assets) || Object.keys(value.assets).length > 256)
        issues.push({ path: `${p}.assets`, message: "must map up to 256 resource IDs to relative files" });
      else for (const [id2, file] of Object.entries(value.assets)) {
        if (!validCapabilityId(id2)) issues.push({ path: `${p}.assets.${id2}`, message: "must be a bounded resource identifier" });
        if (typeof file !== "string" || !/^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]{1,120}$/.test(file))
          issues.push({ path: `${p}.assets.${id2}`, message: "must be a relative path inside the owning mod" });
      }
    }
    for (const part of ["schema", "runtime", "presentation"]) {
      const code = value[part];
      if (part === "presentation" && code === void 0) continue;
      if (!rawObject(code) || Object.keys(code).some((key) => key !== "source" && key !== "sha256") || typeof code.source !== "string" || !code.source.length || code.source.length > maxSource || typeof code.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(code.sha256))
        issues.push({ path: `${p}.${part}`, message: "must contain bounded ES module source and its SHA-256 hash" });
    }
  }
  return issues.length === start;
}
async function verify(code) {
  if (verifiedSources.get(code.sha256) === code.source) return;
  const bytes = new TextEncoder().encode(code.source);
  const subtle = globalThis.crypto?.subtle;
  const actual = subtle ? [...new Uint8Array(await subtle.digest("SHA-256", bytes))].map((n) => n.toString(16).padStart(2, "0")).join("") : sha256Hex(bytes);
  if (actual !== code.sha256) throw new Error("Extension package integrity mismatch");
  verifiedSources.set(code.sha256, code.source);
}
async function importExtension(code, api) {
  await verify(code);
  let module = modules.get(code.sha256);
  if (!module) {
    const browser = typeof document !== "undefined" || "WorkerGlobalScope" in globalThis || "Bun" in globalThis;
    const url = browser ? URL.createObjectURL(new Blob([code.source], { type: "text/javascript" })) : `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(code.source)))}`;
    module = import(
      /* @vite-ignore */
      url
    ).finally(() => {
      if (browser) URL.revokeObjectURL(url);
    });
    modules.set(code.sha256, module);
    module.catch(() => modules.delete(code.sha256));
  }
  const loaded = await module;
  if (typeof loaded.default !== "function") throw new Error("Extension module must export a host factory");
  return loaded.default(api);
}
function preparedExtensionStamps() {
  return [...schemas.keys()].map((stamp) => "package:" + stamp);
}
function parts(pkg) {
  return [pkg.schema, pkg.runtime, ...pkg.presentation ? [pkg.presentation] : []];
}
function preparedPackage(pkg) {
  return parts(pkg).every((code) => verifiedSources.get(code.sha256) === code.source) ? schemas.get(extensionPackageStamp(pkg)) : void 0;
}
function preparePackageSchemas(packages, trust = false) {
  if (!trust && packages.some((pkg) => !isTrustedExtension(extensionPackageStamp(pkg))))
    return Promise.reject(new Error("Extension package code must be installed or approved locally before network use"));
  const work = packages.filter((pkg) => !preparedPackage(pkg)).map(async (pkg) => {
    const issues = [];
    if (!checkExtensionPackages([pkg], "extensionPackages", issues))
      throw new Error(issues.map((e) => `${e.path}: ${e.message}`).join("; "));
    await Promise.all(parts(pkg).map(verify));
    if (trust) grantTrustedExtensions([extensionPackageStamp(pkg)]);
    const stamp = extensionPackageStamp(pkg);
    let pending = pendingSchemas.get(stamp);
    if (!pending) {
      pending = (async () => {
        const schema2 = await importExtension(pkg.schema, Object.freeze({}));
        if (!schema2 || !Array.isArray(schema2.capabilities) || schema2.capabilities.length !== pkg.capabilities.length || new Set(schema2.capabilities.map((s) => s.id)).size !== pkg.capabilities.length || pkg.capabilities.some(
          (id2) => !schema2.capabilities.some(
            (s) => s.id === id2 && typeof s.definition === "function" && (s.weapon === void 0 || typeof s.weapon === "function") && (s.references === void 0 || typeof s.references === "function")
          )
        ))
          throw new Error(`Invalid schema exports: ${pkg.id}`);
        schemas.set(stamp, schema2);
      })();
      pendingSchemas.set(stamp, pending);
      pending.finally(() => pendingSchemas.delete(stamp)).catch(() => {
      });
    }
    return pending;
  });
  return work.length ? Promise.all(work).then(() => {
  }) : null;
}
function readExtensions(raw, pack, path, issues, context, weapon = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({ path, message: "must be an object" });
    return;
  }
  if (pack.v < 3) {
    issues.push({ path, message: "extensions require format 3 or later" });
    return;
  }
  const out = /* @__PURE__ */ Object.create(null);
  for (const [id2, value] of Object.entries(raw)) {
    if (!validCapabilityId(id2) || !pack.requiredCapabilities?.includes(id2)) {
      issues.push({ path: `${path}.${id2}`, message: "must be a valid ID declared in requiredCapabilities" });
      continue;
    }
    const pkg = pack.extensionPackages?.find((p) => p.capabilities.includes(id2));
    const schema2 = pkg && preparedPackage(pkg)?.capabilities.find((s) => s.id === id2);
    const reader = weapon ? schema2?.weapon : schema2?.definition;
    if (!reader) {
      issues.push({
        path: `${path}.${id2}`,
        message: schema2 ? "this capability has no weapon configuration" : "extension package schema has not been prepared"
      });
      continue;
    }
    const config = reader(value, `${path}.${id2}`, issues, { ...context, assetIds: new Set(Object.keys(pkg?.assets ?? {})) });
    if (config !== void 0) out[id2] = config;
  }
  return Object.keys(out).length ? out : void 0;
}
function validateExtensionReferences(def, table, path, issues, forms, pack) {
  for (const pkg of pack?.extensionPackages ?? [])
    for (const schema2 of preparedPackage(pkg)?.capabilities ?? []) {
      if (def.extensions?.[schema2.id]) schema2.references?.(def, table, `${path}.${schema2.id}`, issues, forms);
    }
}
function prepareSchemas(input, trust = false) {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  if (Array.isArray(raw)) {
    const work = raw.map((value2) => prepareSchemas(value2, trust)).filter((p) => p !== null);
    return work.length ? Promise.all(work).then(() => {
    }) : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const value = raw;
  if (Array.isArray(value.mods)) return prepareSchemas(value.mods, trust);
  if (value.extensionPackages === void 0) return null;
  if (value.format !== "steel-tide-mod" || value.v !== 4)
    return Promise.reject(new Error("Executable extension packages require definition pack format 4"));
  const { files: _files, ...metadata } = value;
  if (JSON.stringify(metadata).length > 1024 * 1024)
    return Promise.reject(new Error("Extension manifest is too large"));
  const issues = [];
  if (!checkExtensionPackages(value.extensionPackages, "extensionPackages", issues))
    return Promise.reject(new Error(issues.map((e) => `${e.path}: ${e.message}`).join("; ")));
  return preparePackageSchemas(value.extensionPackages, trust);
}
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  checkExtensionPackages,
  prepareSchemas,
  preparedExtensionStamps,
  readExtensions,
  validateExtensionReferences
}, Symbol.toStringTag, { value: "Module" }));
const WORLD_FORMAT = "steel-tide-world";
const WORLD_VERSION = 1;
const WORLD_EXT = ".steel-tide-world";
const WORLD_MAX_BYTES = 16 * 1024 * 1024;
const WORLD_EVENT_TYPES = ["start", "tick", "time", "destroyed", "created", "completed", "removed", "escaped", "enter", "leave", "objective", "projectile"];
const WORLD_ACTION_TYPES = ["set", "add", "if", "each", "call", "delay", "trigger", "spawn", "wave", "group", "remove", "damage", "order", "entity", "metal", "research", "dress", "objective", "announce", "ping", "sound", "launch", "result"];
const WORLD_EXPR_OPS = ["add", "sub", "mul", "div", "mod", "min", "max", "floor", "ceil", "eq", "ne", "lt", "lte", "gt", "gte", "all", "any", "not"];
const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const safeKey = (v) => typeof v === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(v) && !["__proto__", "constructor", "prototype"].includes(v);
function worldShapeChecks(fail, players = 8) {
  let nodes = 0;
  const bounded = (p, d) => {
    if (++nodes > 1e5 || d > 32) {
      fail(p, "Program exceeds the structural limit.");
      return false;
    }
    return true;
  };
  const text = (v, p) => {
    if (typeof v !== "string" || v.length > 2e4) fail(p, "Expected text.");
  };
  const key = (v, p) => {
    if (!safeKey(v)) fail(p, "Expected a safe identifier.");
  };
  const number = (min = -1e9, max = 1e9, integer = false) => (v, p) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer && !Number.isInteger(v)) fail(p, `Expected ${integer ? "an integer" : "a number"} between ${min} and ${max}.`);
  };
  const boolean = (v, p) => {
    if (typeof v !== "boolean") fail(p, "Expected true or false.");
  };
  const color = (v, p) => {
    if (typeof v !== "string" || !/^#[a-f0-9]{6}$/i.test(v)) fail(p, "Expected a #RRGGBB colour.");
  };
  const one = (...options) => (v, p) => {
    if (!options.includes(v)) fail(p, `Expected one of: ${options.join(", ")}.`);
  };
  const faction = number(0, players - 1, true);
  const array = (item, max = 2048, min = 0) => (v, p, d) => {
    if (!bounded(p, d)) return;
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      fail(p, `Expected an array of ${min} to ${max} items.`);
      return;
    }
    v.forEach((x, i) => item(x, `${p}[${i}]`, d + 1));
  };
  const table = (item, max = 4096) => (v, p, d) => {
    if (!bounded(p, d)) return;
    if (!isObject(v) || Object.keys(v).length > max) {
      fail(p, "Expected a bounded identifier table.");
      return;
    }
    for (const [k, x] of Object.entries(v)) {
      key(k, `${p}.${k}`);
      item(x, `${p}.${k}`, d + 1);
    }
  };
  const object2 = (required, optional = {}, extras = false) => (v, p, d) => {
    if (!bounded(p, d)) return;
    if (!isObject(v)) {
      fail(p, "Expected an object.");
      return;
    }
    for (const [k, check] of Object.entries(required)) check(v[k], `${p}.${k}`, d + 1);
    for (const [k, x] of Object.entries(v)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") {
        fail(`${p}.${k}`, "Reserved property.");
        continue;
      }
      if (optional[k] && x !== void 0) optional[k](x, `${p}.${k}`, d + 1);
      else if (!required[k] && !optional[k] && !extras) fail(`${p}.${k}`, "Unsupported property.");
    }
  };
  const scalar = (v, p, d) => {
    if (typeof v === "number") number()(v, p, d);
    else if (typeof v === "string") text(v, p);
    else boolean(v, p);
  };
  const ref = (v, p, d) => {
    if (typeof v === "string") key(v, p);
    else if (typeof v === "number") number(0, 1e9, true)(v, p, d);
    else if (isObject(v) && "event" in v) object2({ event: one(true) })(v, p, d);
    else object2({ variable: key })(v, p, d);
  };
  const query = object2({}, {
    instance: key,
    group: key,
    owner: faction,
    defId: key,
    prefix: text,
    kind: one("unit", "building"),
    domain: one("ground", "ship", "sub", "air", "amphibious"),
    yard: one("ground", "air", "ship"),
    armed: boolean,
    hq: boolean,
    notMine: boolean,
    complete: boolean,
    outside: boolean,
    region: key,
    alive: boolean,
    variable: key,
    event: one(true)
  });
  const expression = (v, p, d) => {
    if (!bounded(p, d)) return;
    if (!isObject(v)) {
      scalar(v, p, d);
      return;
    }
    const variants = {
      var: [{ var: key }],
      time: [{ time: one(true) }],
      count: [{ count: query }],
      random: [{ random: query }],
      stat: [{ stat: object2({ owner: faction, field: one("metal", "kills", "losses", "built", "trained", "pop") }) }],
      entity: [{ entity: ref, property: one("id", "hp", "x", "y", "alive", "owner") }],
      objective: [{ objective: key }],
      canRebuild: [{ canRebuild: faction }],
      projectile: [{ projectile: key, fate: one("flying", "landed", "downed") }],
      groupOutcome: [{ groupOutcome: key, outcome: one("destroyed", "escaped", "removed") }],
      op: [{ op: one(...WORLD_EXPR_OPS), args: array(expression, 128) }]
    };
    const variant = Object.keys(variants).filter((k) => k in v);
    if (variant.length !== 1) {
      fail(p, "Expected one expression operation.");
      return;
    }
    const [required, optional] = variants[variant[0]];
    object2(required, optional)(v, p, d + 1);
    if ("op" in v && Array.isArray(v.args)) {
      const count = ["floor", "ceil", "not"].includes(String(v.op)) ? 1 : ["sub", "div", "mod", "eq", "ne", "lt", "lte", "gt", "gte"].includes(String(v.op)) ? 2 : -1;
      if (count !== -1 && v.args.length !== count) fail(`${p}.args`, `This operator needs ${count} arguments.`);
    }
  };
  const openingOrder = (v, p, d) => {
    const base = { kind: one("move", "attackMove", "stop", "hold", "attack", "protect", "attackGround", "nukeDrop", "build", "buildSite", "repair", "board", "dig", "pickup", "rearm", "unload") };
    object2(base, { x: number(), y: number(), targetId: number(0), baseId: number(0), siteId: number(0), defId: key, tx: number(), ty: number(), warhead: key, rx: number(), ry: number(), auto: boolean, t: number(0), wait: number(0) })(v, p, d);
  };
  const instance = object2({ id: key, defId: key, owner: faction, x: number(-1e5, 1e5), y: number(-1e5, 1e5) }, {
    angle: number(),
    hp: number(0, 1e6),
    locked: boolean,
    holdPos: boolean,
    holdFire: boolean,
    aggressive: boolean,
    xp: number(0),
    scriptedFire: boolean,
    orders: array(openingOrder, 256)
  });
  const actions = array((v, p, d) => {
    if (!isObject(v) || typeof v.type !== "string") {
      fail(p, "Expected an action operation.");
      return;
    }
    const args = array(expression, 128);
    const list = {
      set: [{ variable: key, value: expression }],
      add: [{ variable: key, value: expression }],
      if: [{ condition: expression, then: actions }, { else: actions }],
      each: [{ query, variable: key, actions }, { limit: number(1, 12e3, true) }],
      call: [{ id: key }, { args: table(expression, 128) }],
      delay: [{ seconds: expression, actions }],
      trigger: [{ id: key, enabled: boolean }],
      spawn: [{ instances: array(instance, 2e3) }, { group: key }],
      wave: [{ owner: faction, units: array((u, up, ud) => {
        if (!Array.isArray(u) || u.length !== 2) {
          fail(up, "Expected a definition and count pair.");
          return;
        }
        key(u[0], `${up}[0]`);
        expression(u[1], `${up}[1]`, ud);
      }, 128), x: expression, y: expression }, { targetX: expression, targetY: expression, group: key, replaceGroup: boolean, attack: boolean, route: key }],
      group: [{ id: key, query }, { append: boolean }],
      remove: [{ query }, { reason: one("removed", "escaped") }],
      damage: [{ query, amount: expression }],
      order: [{ query, order: one("move", "attackMove", "stop", "hold") }, { x: expression, y: expression, route: key }],
      entity: [{ query, property: one("hp", "locked", "holdPos", "holdFire", "aggressive", "xp", "scriptedFire"), value: expression }],
      metal: [{ owner: faction, amount: expression }, { set: boolean }],
      research: [{ owner: faction, ids: array(key, 256) }],
      dress: [{ owner: faction }, { skins: table(key, 256), decals: table(array(key, 32), 256) }],
      objective: [{ id: key, state: one("show", "complete", "update") }, { params: args }],
      announce: [{ textKey: key }, { params: args, kind: one("info", "good", "warn", "bad"), owner: number(-1, players - 1, true) }],
      ping: [{ x: expression, y: expression }, { color: text, owner: number(-1, players - 1, true) }],
      sound: [{ sound: key }, { x: expression, y: expression }],
      launch: [{ id: key, from: ref, target: ref, weapon: key, damage: expression }, { speed: number(0, 1e5) }],
      result: [{ win: boolean }, { winnerTeam: number(0, 7, true) }]
    };
    const fields = list[v.type];
    if (!fields) {
      fail(`${p}.type`, "Unknown action.");
      return;
    }
    object2({ type: one(v.type), ...fields[0] }, fields[1])(v, p, d + 1);
  }, 2048);
  const event = (v, p, d) => {
    if (!isObject(v)) {
      fail(p, "Expected an event.");
      return;
    }
    const variants = {
      start: [{}],
      tick: [{}, { every: number(1 / 30) }],
      time: [{ at: number(0) }, { every: number(1 / 30) }],
      created: [{}, { query }],
      destroyed: [{}, { query }],
      completed: [{}, { query }],
      removed: [{}, { query }],
      escaped: [{}, { query }],
      enter: [{ region: key }, { query }],
      leave: [{ region: key }, { query }],
      objective: [{ id: key }],
      projectile: [{ id: key, fate: one("landed", "downed") }]
    };
    const fields = variants[String(v.type)];
    if (!fields) {
      fail(`${p}.type`, "Unknown event.");
      return;
    }
    object2({ type: one(v.type), ...fields[0] }, fields[1])(v, p, d + 1);
  };
  const filter = object2({}, { defId: key, prefix: text, yard: one("ground", "air", "ship"), kind: one("unit", "building"), armed: boolean, complete: boolean });
  const guideExpression = (v, p, d) => {
    if (!bounded(p, d)) return;
    if (!isObject(v)) {
      if (typeof v === "number") number()(v, p, d);
      else boolean(v, p);
      return;
    }
    const cases = {
      count: { count: one("owned", "selected", "planned"), filter },
      objective: { objective: key },
      objectiveParam: { objectiveParam: key, index: number(0, 128, true), fallback: number() },
      kills: { kills: one(true) },
      nearFaction: { nearFaction: faction, distance: number(0), filter },
      op: { op: one("all", "any", "not", "min", "max", "gte", "gt", "eq"), args: array(guideExpression, 128) }
    };
    const tag = Object.keys(cases).filter((k) => k in v);
    if (tag.length !== 1) {
      fail(p, "Unknown guide expression.");
      return;
    }
    object2(cases[tag[0]])(v, p, d + 1);
  };
  const focus = (v, p, d) => {
    if (!isObject(v)) {
      fail(p, "Expected guide focus.");
      return;
    }
    const cases = {
      entities: [{ filter }, { preferIdle: boolean }],
      build: [{ defId: key }, { deposit: boolean }],
      train: [{ defId: key, yard: one("ground", "air", "ship") }],
      faction: [{ owner: faction }, { command: one("attackMove"), select: filter }],
      literal: [{}, { ents: array(number(0), 1e3), spots: array(object2({ x: number(), y: number(), w: number(0), h: number(0) }), 256), cards: array(key, 256), actions: array(one("attackMove"), 32) }]
    };
    const fields = cases[String(v.type)];
    if (!fields) {
      fail(p, "Unknown guide focus.");
      return;
    }
    object2({ type: one(v.type), ...fields[0] }, fields[1])(v, p, d + 1);
  };
  const guide = (v, p, d) => {
    if (isObject(v) && "done" in v) object2({ id: key, titleKey: key, textKey: key, done: guideExpression, focus }, { touchTextKey: key, gesture: boolean, params: array(guideExpression, 128) })(v, p, d);
    else object2({ id: key, titleKey: key, textKey: key }, { condition: expression, selection: query, placement: key, highlight: key, panel: key })(v, p, d);
  };
  const config = object2({ mode: one("sandbox", "campaign", "breakthrough"), mapKey: text, seed: number(0, 4294967295, true), fog: boolean, popCap: number(1, 1e4, true), startMetal: number(0, 1e9), players: array(object2({ isHuman: boolean, team: number(0, 7, true) }, { faction: key, difficulty: one("relaxed", "standard", "seasoned", "veteran"), spawn: number(0, 7, true), scripted: boolean, spareHq: boolean }), 8, 1) }, {
    weather: one("clear", "rain", "snow", "random"),
    dayNight: boolean,
    hour: one("dawn", "noon", "midnight"),
    symmetric: boolean,
    productionSlotsPerHQ: number(1, 1e4, true),
    tech: boolean,
    buildRadius: boolean,
    checkpoints: number(1, 100),
    assaultChest: number(0, 1e9),
    clock: number(0),
    missionId: key,
    multiplayer: boolean,
    record: boolean,
    meritId: text,
    meritIneligible: boolean
  });
  const scenario = object2({ id: key, name: text, map: key, cfg: config, instances: array(instance, 12e3), triggers: array(object2({ id: key, event, actions }, { name: text, description: text, condition: expression, enabled: boolean, once: boolean, maxRuns: number(1, 1e9, true) }), 1024) }, {
    groups: table(array(key, 12e3)),
    regions: array(object2({ id: key, x: number(), y: number(), w: number(0.01), h: number(0.01) }, { name: text, marker: object2({}, { color }) }), 256),
    routes: array(object2({ id: key, points: array(object2({ x: number(), y: number() }), 512, 1) }, { name: text, attack: boolean }), 256),
    variables: table(scalar),
    objectives: array(object2({ id: key, textKey: key }, { params: array(expression, 128), team: number(0, 7, true), visible: boolean }), 256),
    actions: table(actions, 512),
    guide: array(guide, 256),
    briefing: object2({}, { titleKey: key, bodyKey: key, dateKey: key, locationKey: key, image: text, voice: text, paragraphs: array(text, 256) }),
    skyMinutes: number(0, 1440),
    resultPolicy: one("scripted", "conquest"),
    mapUnits: boolean,
    defaultBases: boolean,
    roster: table(array(key, 2e3), 8),
    buildRegions: table(array(key, 256), 8),
    counters: array(object2({ id: key, textKey: key, value: expression }, { team: number(0, 7, true) }), 256)
  });
  return { actions, expression, scenario };
}
function validateWorldShape(input) {
  const errors = [];
  const fail = (path, message) => {
    if (errors.length < 100) errors.push({ path, message });
  };
  if (!isObject(input)) return errors;
  if (input.cover !== void 0 && (typeof input.cover !== "string" || !isObject(input.assets) || !Object.hasOwn(input.assets, input.cover) || typeof input.assets[input.cover] !== "string" || !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(input.assets[input.cover]))) {
    fail("cover", "Expected an embedded image asset path.");
  }
  if (Array.isArray(input.scenarios)) input.scenarios.forEach((s, i) => {
    const players = isObject(s) && isObject(s.cfg) && Array.isArray(s.cfg.players) ? s.cfg.players.length : 8;
    worldShapeChecks(fail, players).scenario(s, `scenarios[${i}]`, 0);
  });
  if (input.dependencies !== void 0) {
    if (!Array.isArray(input.dependencies) || input.dependencies.length > 32) fail("dependencies", "Expected at most 32 dependencies.");
    else input.dependencies.forEach((d, i) => {
      if (!isObject(d) || !safeKey(d.id) || typeof d.version !== "string" || d.version.length > 80 || typeof d.hash !== "string" || !/^[a-f0-9]{8,128}$/i.test(d.hash)) fail(`dependencies[${i}]`, "Expected dependency identity, version and content fingerprint.");
    });
  }
  if (input.assets !== void 0) {
    if (!isObject(input.assets) || Object.keys(input.assets).length > 1024) fail("assets", "Expected an asset table.");
    else for (const [path, data] of Object.entries(input.assets)) {
      if (!/^(?!\/)(?!.*\.\.)[A-Za-z0-9_./ -]{1,160}$/.test(path) || typeof data !== "string" || !/^data:(image\/(png|jpeg|gif|webp)|audio\/[a-z0-9.+-]+);base64,/i.test(data) || data.length > 12 * 1024 * 1024) fail(`assets.${path}`, "Expected a relative asset path and an embedded image or audio data URL.");
    }
  }
  if (Array.isArray(input.campaigns)) input.campaigns.forEach((c, i) => {
    if (!isObject(c)) return;
    if (typeof c.name !== "string" || !c.name.trim() || c.name.length > 160) fail(`campaigns[${i}].name`, "Expected a campaign name.");
    if (c.carryVariables !== void 0 && (!Array.isArray(c.carryVariables) || c.carryVariables.length > 4096 || c.carryVariables.some((v) => !safeKey(v)))) fail(`campaigns[${i}].carryVariables`, "Expected variable identifiers.");
    if (c.branches !== void 0) {
      if (!Array.isArray(c.branches) || c.branches.length > 1024) fail(`campaigns[${i}].branches`, "Expected a branch list.");
      else c.branches.forEach((b, j) => {
        if (!isObject(b) || !safeKey(b.variable) || !Array.isArray(c.scenarios) || !c.scenarios.includes(b.from) || !c.scenarios.includes(b.to) || !["number", "string", "boolean"].includes(typeof b.equals) || typeof b.equals === "number" && !Number.isFinite(b.equals)) fail(`campaigns[${i}].branches[${j}]`, "Invalid campaign branch.");
      });
    }
  });
  return errors;
}
const ARMOR_MATRIX = {
  // rapid-fire small arms: shred soft skins, ping off armor plate
  mg: { light: 1.5, medium: 0.8, heavy: 0.4, structure: 0.35, ship: 0.5, air: 0.7 },
  // light autocannons: soft skins and light armor, poor against heavy plate;
  // at a helicopter (`lowFlying`, the only aircraft they reach) a third —
  // the BMP's 30 mm cocks up to 74° for exactly that, and hits it seldom
  autocannon: { light: 1.5, medium: 1, heavy: 0.5, structure: 0.5, ship: 0.7, air: 0.35 },
  // tank guns: built for armored duels, over-penetrate soft targets
  cannon: { light: 0.6, medium: 1.3, heavy: 1, structure: 0.8, ship: 0.9 },
  // shaped-charge guided missiles: heavy armor only, wasted on light vehicles,
  // and a hull is holed rather than broken — 0.75 since 2026-09-27 (it was
  // 1.0, and the Cobra sank whole fleets that could not shoot back): what
  // sinks a ship is the anti-ship missile and the torpedo
  at: { light: 0.4, medium: 1.1, heavy: 1.8, structure: 0.7, ship: 0.75 },
  // high explosive: blast shreds soft targets and buildings, heavy plate shrugs
  he: { light: 1.2, medium: 1, heavy: 0.75, structure: 1.6, ship: 1 },
  // unguided rocket pods: vehicles of any weight, poor against bunkers
  rocket: { light: 1.4, medium: 1.4, heavy: 0.9, structure: 0.7, ship: 0.9 },
  // naval guns: general-purpose bombardment of shore and ship. Dual-purpose
  // mounts (the destroyer's) also fire on aircraft at a little over half;
  // the Aegis's deck gun targets only the surface, with SAMs for the sky.
  navgun: { light: 1, medium: 1, heavy: 0.75, structure: 0.75, ship: 1, air: 0.6 },
  ashm: { ship: 1.6 },
  torpedo: { ship: 1.3, sub: 1.2 },
  aa: { air: 1 }
};
const w = (def) => ({ ...def, mult: { ...ARMOR_MATRIX[def.cls], ...def.mult } });
const BROADSIDE = 150 * Math.PI / 180;
const resolveWeapon = w;
const MG = w({
  id: "mg",
  cls: "mg",
  dmg: 7,
  reload: 0.4,
  range: 3.6,
  projectile: "bullet",
  speed: 500,
  targets: ["ground"],
  turret: true,
  muzzleOffset: 9.5,
  sound: "mg"
});
const ROOF_MG = w({
  id: "roofmg",
  cls: "mg",
  dmg: 9,
  reload: 0.3,
  range: 4.5,
  projectile: "bullet",
  speed: 520,
  targets: ["air"],
  lowOnly: true,
  mult: { air: 0.7, light: 0.7 },
  sound: "mg"
});
const WARHEAD_MOTOR = [
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "always" },
  { sprite: "dec.afterburner", layer: "under", y: 12, scale: 0.6, when: "night" }
];
const DEFS = {
  // ================================================================= LAND
  //
  // Every hull carries a `body` — the capsule `separation()` parts units by,
  // measured off the drawn silhouette. Land is mostly a question of *size*
  // rather than shape: a tank is only about 1.6 times as long as it is wide,
  // so its capsule is a short segment inside a much bigger circle than the
  // one it replaced (`radius` was around 60% of the drawn width). Aircraft
  // are the exception and keep their circles: a wing's widest span is across
  // the heading, which is the one shape a capsule along it cannot say, and
  // nothing in the air jams anyway.
  engineer: {
    id: "engineer",
    kind: "unit",
    aliases: ["eng", "builder"],
    domain: "ground",
    tier: 1,
    cost: 150,
    buildTime: 8,
    pop: 1,
    power: -1,
    hp: 200,
    armor: "light",
    detect: 3,
    speed: 70,
    turnRate: 5,
    vision: 7,
    radius: 8,
    weapons: [],
    body: { r: 8, len: 12 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    trail: "tread",
    sprite: "u.engineer"
  },
  buggy: {
    id: "buggy",
    kind: "unit",
    aliases: ["recon", "jeep"],
    domain: "ground",
    tier: 1,
    ability: "sprint",
    cost: 60,
    buildTime: 5,
    pop: 1,
    power: -1,
    hp: 150,
    armor: "light",
    detect: 4,
    speed: 120,
    turnRate: 6,
    vision: 10,
    radius: 7,
    body: { r: 10, len: 10 },
    weapons: [{ ...MG, sound: "mg" }],
    trail: "tire",
    sprite: "u.buggy"
  },
  ltank: {
    id: "ltank",
    kind: "unit",
    aliases: ["wolf", "light"],
    domain: "ground",
    tier: 1,
    ability: "smoke",
    cost: 120,
    buildTime: 9,
    pop: 1,
    power: -1,
    hp: 300,
    armor: "medium",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 75,
    turnRate: 4.5,
    vision: 7,
    radius: 9,
    fireOnMove: true,
    body: { r: 10, len: 10 },
    weapons: [w({
      id: "autocannon",
      cls: "autocannon",
      dmg: 18,
      reload: 0.55,
      range: 4,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 20.5,
      sound: "autocannon"
    })],
    trail: "tread",
    sprite: "u.ltank",
    turretSprite: "tur.ltank"
  },
  mbt: {
    id: "mbt",
    kind: "unit",
    aliases: ["bison", "tank"],
    domain: "ground",
    tier: 2,
    ability: "countermeasures",
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 620,
    armor: "heavy",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 60,
    turnRate: 3.6,
    vision: 7,
    radius: 10,
    fireOnMove: true,
    body: { r: 13, len: 12 },
    weapons: [w({
      id: "cannon",
      cls: "cannon",
      dmg: 60,
      reload: 1.8,
      range: 4.6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      recoil: 1.6,
      muzzleOffset: 35.7,
      splash: 12,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.mbt",
    turretSprite: "tur.mbt",
    // on the commander's hatch, measured on `tur.mbt`
    airMount: { sprite: "tur.pintle", x: -2.6, y: 0.54 }
  },
  htank: {
    id: "htank",
    kind: "unit",
    aliases: ["mammoth", "heavy"],
    domain: "ground",
    tier: 3,
    ability: "countermeasures",
    cost: 900,
    buildTime: 45,
    pop: 4,
    power: -4,
    hp: 1900,
    armor: "heavy",
    directionalArmor: { front: 0.8, side: 1, rear: 1.2 },
    speed: 42,
    turnRate: 2.6,
    vision: 7,
    radius: 12,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 21, len: 8 },
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 55,
      reload: 1.8,
      range: 5.2,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 1 },
      turret: true,
      recoil: 2,
      muzzleOffset: 40.47,
      bores: 2,
      boreSpacing: 11.05,
      splash: 14,
      burst: 2,
      burstDelay: 0.18,
      sound: "cannon"
    }), ROOF_MG],
    trail: "tread",
    sprite: "u.htank",
    turretSprite: "tur.htank",
    // on the right-hand roof mounting plate, measured on `tur.htank`
    airMount: { sprite: "tur.pintle", x: 3.58, y: -1.12 }
  },
  td: {
    id: "td",
    kind: "unit",
    aliases: ["viper", "at"],
    domain: "ground",
    tier: 2,
    ability: "smoke",
    cost: 320,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "medium",
    speed: 65,
    turnRate: 4,
    vision: 8,
    radius: 9,
    fireOnMove: true,
    body: { r: 16, len: 9 },
    weapons: [w({
      id: "atgm",
      cls: "at",
      dmg: 120,
      reload: 2.8,
      range: 7,
      projectile: "missile",
      speed: 300,
      // Twin canisters: concealed pivot (512,916), tips y=202, centres x=364/660;
      // a 16 × 18 art frame at scale 1.5625. One missile per reload, alternating.
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 13.0737,
      bores: 2,
      boreSpacing: 7.2266,
      homing: true,
      interceptable: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.td",
    turretSprite: "tur.td"
  },
  /**
   * The Flak Track (2026-10-01): a Gepard, a Shilka. Its guns reach a tile
   * past a helicopter's missiles (6.5 to the Cobra's 5.5), so a Cobra that
   * comes for the column comes into them first, and it is armoured to take
   * the reply (360). And they fire on the ground too, at what a light
   * cannon does to it — the ZSU-23-4 was the gun the Soviet columns in
   * Afghanistan and Grozny turned on the hillsides — so a Flak Track in an
   * army is a gun in the army, not a unit waiting on the sky. It looks to the
   * sky first (`skyFirst` in game/combat.ts): an aircraft in reach takes it
   * off a target on the ground.
   */
  flak: {
    id: "flak",
    kind: "unit",
    aliases: ["flaktrack", "aa"],
    domain: "ground",
    tier: 1,
    cost: 170,
    buildTime: 12,
    pop: 1,
    power: -1,
    hp: 360,
    armor: "medium",
    speed: 70,
    turnRate: 4.5,
    vision: 9,
    radius: 9,
    body: { r: 14, len: 5 },
    weapons: [w({
      id: "flakgun",
      cls: "aa",
      dmg: 24,
      reload: 0.7,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air", "ground", "ship"],
      mult: { air: 1, light: 0.9, medium: 0.6, heavy: 0.25, structure: 0.3, ship: 0.4 },
      turret: true,
      muzzleOffset: 19.3,
      sound: "flak"
    })],
    trail: "tread",
    sprite: "u.flak",
    turretSprite: "tur.flak"
  },
  sam: {
    id: "sam",
    kind: "unit",
    aliases: ["hawk", "aalauncher"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 240,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 10,
    radius: 9,
    body: { r: 13, len: 11 },
    // the blast is air-only, like every splash: it catches the flight round
    // the target and nothing under it (sam.test.ts). 125 dmg at 10 tiles since
    // 2026-09-17 (130 at 11.25 before): level with the SAM Site now, and still
    // two tiles past the longest thing in the air, the Albatross's missile
    weapons: [w({
      id: "sam",
      cls: "aa",
      dmg: 125,
      reload: 2.5,
      range: 10,
      projectile: "missile",
      speed: 420,
      targets: ["air"],
      turret: true,
      muzzleOffset: 21.7,
      bores: 2,
      boreSpacing: 7.44,
      splash: 24,
      homing: true,
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.sam",
    turretSprite: "tur.sam"
  },
  arty: {
    id: "arty",
    kind: "unit",
    aliases: ["thunder", "howitzer"],
    domain: "ground",
    tier: 2,
    ability: "barrage",
    cost: 420,
    buildTime: 24,
    pop: 2,
    power: -2,
    hp: 220,
    armor: "light",
    speed: 48,
    turnRate: 3,
    vision: 8,
    radius: 10,
    body: { r: 18, len: 17 },
    weapons: [w({
      id: "howitzer",
      cls: "he",
      dmg: 110,
      reload: 5,
      range: 11,
      minRange: 3,
      projectile: "shell",
      speed: 260,
      targets: ["ground", "ship"],
      muzzleOffset: 17,
      splash: 48,
      arc: true,
      spread: 26,
      sound: "arty"
    })],
    trail: "tread",
    sprite: "u.arty"
  },
  mlrs: {
    id: "mlrs",
    kind: "unit",
    aliases: ["tempest", "rockets"],
    domain: "ground",
    tier: 3,
    ability: "barrage",
    cost: 760,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 380,
    armor: "medium",
    speed: 45,
    turnRate: 2.8,
    vision: 8,
    radius: 11,
    requires: ["radar"],
    cargoWeight: 4,
    body: { r: 20, len: 7 },
    weapons: [w({
      id: "rockets",
      cls: "he",
      dmg: 54,
      reload: 8,
      range: 13,
      minRange: 4,
      projectile: "rocket",
      speed: 300,
      // Inclined 2×3 muzzle face: pivot (512,520), columns x414/610,
      // rows y291/431/584 on the 1024×1536 master. A 20×30 art frame
      // at scale 1.5625; fire left/right pairs from front to rear.
      targets: ["ground", "ship"],
      muzzlePoints: [
        { forward: 6.988525390625, lateral: -2.99072265625 },
        { forward: 6.988525390625, lateral: 2.99072265625 },
        { forward: 2.716064453125, lateral: -2.99072265625 },
        { forward: 2.716064453125, lateral: 2.99072265625 },
        { forward: -1.953125, lateral: -2.99072265625 },
        { forward: -1.953125, lateral: 2.99072265625 }
      ],
      splash: 48,
      arc: true,
      burst: 8,
      burstDelay: 0.16,
      spread: 36,
      turret: true,
      sound: "rocket"
    })],
    trail: "tread",
    sprite: "u.mlrs",
    turretSprite: "tur.mlrs"
  },
  /**
   * The radar station's circle on wheels — smaller (16 tiles to its 24) but
   * the same kind of circle: it sees by radio (`radar`), so neither the night
   * nor the rain shrinks it and a stealth aircraft shows inside `detect`, and
   * every gun standing in it fires at its full reach. That is the unit: a
   * Tempest sees 8 tiles and throws 13, and beside an Owl the other five are
   * a siege that sees. It pays with everything else — no gun, thin plate,
   * and slow, so it is where the column is and not out ahead of it, and
   * killing it is the answer to the column. Level 2 factory and a radar;
   * the AI never fields it.
   */
  radarcar: {
    id: "radarcar",
    kind: "unit",
    aliases: ["owl", "sensor"],
    domain: "ground",
    tier: 3,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "light",
    speed: 32,
    turnRate: 2.6,
    vision: 16,
    radius: 10,
    requires: ["radar"],
    radar: true,
    detect: 6,
    body: { r: 16, len: 10 },
    weapons: [],
    trail: "tread",
    sprite: "u.radarcar",
    turretSprite: "tur.radarcar",
    turretSpins: true
  },
  /**
   * Level 3 of the war factory. The Salamander is the siege piece for the
   * turtle Tier 3 builds — Bastions behind Interrupters, where the Tempest's
   * rockets are shot out of the sky: its round is a *shell*, which point
   * defence never touches, with a blast two tiles across that hits everything
   * in it at full value. The blast does not know whose side it is on
   * (`friendlyFire`): the Mammoths escorting it burn if they stand in the
   * footprint, and its minimum range is what keeps it from catching itself.
   * It reaches 6.5 tiles (4.5 until 2026-09-17: nobody built the Interrupter
   * turtle it was made for, and in the sieges people did fight it walked into
   * Cannon Turret range a tile and a half before it could answer, so nobody
   * built it either), past the Cannon Turret, the Gatling and the MG turret
   * and still under the Bastion, the HQ gun, the Viper and every artillery
   * piece, so it earns its price against clusters and only with something in
   * front of it (salamander.test.ts).
   */
  salamander: {
    id: "salamander",
    kind: "unit",
    aliases: ["sala", "mortar"],
    domain: "ground",
    tier: 3,
    cost: 800,
    buildTime: 42,
    pop: 3,
    power: -3,
    hp: 850,
    armor: "heavy",
    speed: 45,
    turnRate: 2.8,
    vision: 7,
    radius: 11,
    requires: ["radar"],
    body: { r: 19, len: 7 },
    weapons: [w({
      id: "thermobaric",
      cls: "he",
      dmg: 260,
      reload: 4,
      range: 6.5,
      minRange: 3,
      projectile: "shell",
      speed: 240,
      targets: ["ground", "ship"],
      mult: { heavy: 0.6 },
      // 72 and not the 77 the splash pass would give it: the nearest its own
      // round can land, less its hull, was 74 px away at the 4.5 tiles it
      // launched with, and is 78 now the spread scales over a longer reach
      // (`salamander.test.ts`)
      turret: true,
      muzzleOffset: 16,
      splash: 72,
      arc: true,
      spread: 16,
      friendlyFire: true,
      sound: "arty",
      // a fuel cloud that burns over the ground rather than a charge that digs into it
      mark: "thermo"
    })],
    trail: "tread",
    sprite: "u.salamander",
    turretSprite: "tur.salamander",
    // the ring its sheet paints, forward of the hull's centre. A body
    // whose turret *fires* declares it here rather than in the sprite
    // manifest: the manifest moves the drawing and the sim cannot read a
    // sheet, so a ring named only there put the round out of the barrel.
    turretMounts: [{ x: 0, y: -1 }]
  },
  /**
   * Point defence on tracks: the Interrupter's magazine on a hull and no gun
   * at all. Weaker than the tower on purpose — six rounds and one back every
   * 1.5 s against the tower's eight and one every 0.75 s — so one Bulwark
   * thins a Tempest's salvo (most of it down, never all of it: a rocket is
   * inside its ring for under a second, and the reload cannot make up two)
   * and two blank it; it never turns a bad fight into a good one alone
   * (bulwark.test.ts). Shells still land.
   */
  bulwark: {
    id: "bulwark",
    kind: "unit",
    aliases: ["interrupter", "pd"],
    domain: "ground",
    tier: 3,
    cost: 650,
    buildTime: 32,
    pop: 2,
    power: -2,
    hp: 520,
    armor: "medium",
    speed: 60,
    turnRate: 4,
    vision: 9,
    radius: 10,
    requires: ["radar"],
    body: { r: 9, len: 9 },
    weapons: [],
    interceptRange: 5,
    interceptMag: 6,
    interceptReload: 1.5,
    interceptMuzzleOffset: 12,
    trail: "tread",
    sprite: "u.bulwark",
    turretSprite: "tur.bulwark"
  },
  /**
   * The fire curtain, and the glass cannon that lays it. The Drake's weapon
   * does not fire, it *pours*: a glob of burning fuel every tick for a full
   * second, sprayed across an arc and falling short of the aim by up to half,
   * so what leaves the nozzle is one continuous tongue of flame — and the
   * ground it washes over keeps burning for eight seconds afterwards. It is
   * the only unit that denies ground rather than killing what stands on it,
   * and the only weapon whose damage goes on after the trigger is let go.
   *
   * That second is the whole unit, and everything else about it is what the
   * second costs:
   *
   * - **A cooldown, not a reload.** The bottles come back up to pressure over
   *   2.6 s, so for two thirds of every engagement the Drake is a tank with
   *   no gun standing three tiles from something that still has one. What it
   *   set alight is what fights while it waits.
   * - **A light tank's reach.** 4 tiles (3.4 until 2026-09-16, a quarter
   *   more since, floored): level with the Wolf, a hair past the Buggy's
   *   machine gun, and out-ranged by every heavier tank, every turret and
   *   every artillery piece there is, so it still has to be walked in behind
   *   something that can take the crossing.
   * - **Thin skin over a full fuel tank.** 260 hit points of *medium* armour
   *   at Tier 2 — less than the Tier-1 Wolf it is built to burn. A Bison's
   *   gun opens it in six seconds and it rarely sees a second cooldown out.
   *   It costs 400 metal since 2026-10-01 (300 before), and is meant to be
   *   spent.
   * - **Nothing for aircraft**, and a hull in the water does not burn.
   * - **The fire is nobody's friend.** A curtain a column could walk through
   *   unharmed would not be a curtain, so `force` rides on every patch and
   *   the Drake's own side burns in it exactly as the enemy does. The Drake
   *   itself burns at half (`burnMult`): it is built to work in its own
   *   fire, so driving forward into what it just laid costs it, but not
   *   what it costs the tanks beside it.
   *
   * What that buys is a raider, not a line unit. Against equal metal it eats
   * artillery, air defence, engineers' work and swarms — the things that sit
   * still or cannot answer at four tiles — and it is beaten by anything with
   * a tank gun and the reach to use it: two Bisons take four Drakes for a
   * quarter of their price. The AI does not field it, for the reason it does
   * not field the Salamander: keeping a line out of one's own fire is micro,
   * and it has none.
   *
   * Level 2 of the war factory, no radar, since 2026-09-17 (the Arsenal's
   * third unit before, behind the radar): a raider's prey — howitzers, air
   * defence, an engineer's camp — is a minute-5 thing, and by the time an
   * Arsenal stood it met Cannon Turrets and the HQ gun instead, so nobody
   * built one. The Tempest went the other way, to the Arsenal.
   */
  drake: {
    id: "drake",
    kind: "unit",
    aliases: ["flametank", "flamer"],
    domain: "ground",
    tier: 2,
    cost: 400,
    buildTime: 16,
    pop: 2,
    power: -2,
    hp: 260,
    armor: "medium",
    speed: 73.6,
    turnRate: 4.8,
    vision: 6,
    radius: 10,
    fireOnMove: true,
    burnMult: 0.5,
    body: { r: 15, len: 14 },
    weapons: [w({
      // `burst` is not a salvo here: a glob every tick for a full second, and
      // then the tank is empty. The reload is a **cooldown** — pressure back
      // in the bottles — and it is more than twice the pour, so two thirds of
      // the Drake's life is spent at four tiles from something it cannot
      // touch. The fire it left is what fights for it meanwhile. 7.8 a glob
      // since 2026-09-19 (9 before): 90 dps over the cycle, down from 104.
      id: "flamejet",
      cls: "he",
      dmg: 7.8,
      reload: 2.6,
      range: 4,
      projectile: "flame",
      speed: 260,
      targets: ["ground", "ship"],
      mult: { light: 1.5, medium: 1.1, heavy: 0.45, ship: 0.5, structure: 1.3 },
      turret: true,
      muzzleOffset: 18.5,
      splash: 38,
      burst: 30,
      burstDelay: 0.03,
      fan: 0.22,
      burn: 14,
      burnLife: 8,
      sound: "flame"
    })],
    trail: "tread",
    sprite: "u.drake",
    turretSprite: "tur.drake",
    turretMounts: [{ x: 0, y: -5 }]
  },
  /**
   * The amphibian: an eight-wheeled armoured car that swims. The one unit
   * with the `amphibious` domain — it drives on everything a tank drives on
   * and floats on everything a ship floats on, at `SWIM_FACTOR` of its road
   * speed in the water (`game/map.ts`), so a crossing is slow and the way
   * round by land is taken when it is quicker (the pathfinder weighs the
   * water, `terrCostAmphib`). Afloat it is a *ship* to every gun — a
   * torpedo, an anti-ship missile and a naval gun all find it — and ashore
   * a vehicle, judged by the tile under it (`targetCat`); it is medium
   * armour either way, and a Flak Track reaches it on both. It never boards a
   * transport: it is its own.
   *
   * Built at the level-2 naval yard *and* the level-2 war factory — it
   * leaves either by its own domain, the one off the slip already afloat
   * and the one off the ramp already rolling — and priced against the
   * landing it replaces. Its gun is the Wolf's class — a 30 mm autocannon, soft skins
   * and light armour, half value against heavy plate and a wall — on a hull
   * a quarter tougher, at 200 metal and twice the population: five Wolves
   * beat three Gators on land at equal metal. Three Gators cost 600 against
   * 700 for a landing craft and four Wolves, with no beach to load
   * from and none to unload onto, no hull that takes four tanks down with
   * it, and a crossing at 44 px/s against the craft's 70. A raider from the
   * sea — the howitzer line, the air defence, the engineer's outlying
   * extractor — and a beachhead's first armour, not a line unit: a Bison
   * opens it in five shots and a cannon turret outranges it. The AI never
   * fields it; its landings go by the lift (`manageLift`), and teaching a
   * commander to swim an assault is its own job. `gator.test.ts`.
   */
  gator: {
    id: "gator",
    kind: "unit",
    aliases: ["acv", "amphibian", "amtrac"],
    domain: "amphibious",
    tier: 2,
    ability: "smoke",
    cost: 200,
    buildTime: 15,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "medium",
    speed: 80,
    turnRate: 4.5,
    vision: 8,
    radius: 10,
    fireOnMove: true,
    // the sheet's hull is 20 by 36 world px with the wheels: a half-beam and
    // a pixel, and the length less the two round ends
    body: { r: 11, len: 14 },
    weapons: [w({
      // tur.gator: measured pivot y=1000, muzzle y=300 on the 1536px
      // master; 700/1536 * 21 art px * 1.5625 display scale
      id: "autocannon",
      cls: "autocannon",
      dmg: 20,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 14.95361328125,
      sound: "autocannon"
    })],
    trail: "tire",
    sprite: "u.gator",
    turretSprite: "tur.gator",
    // Aft ring at (512,880) on the 1024x1536 hull: (880/1536 - .5)*26.
    // Rendering and firing share this mount; the hull's frame size stays put.
    turretMounts: [{ x: 0, y: 1.8958333333333333 }]
  },
  // ------------------------------------------------------ the doctrines' own
  //
  // Three units the tech tree unlocks (`game/tech.ts`), one a doctrine, each a
  // rule the game already had put on a new hull the way the Bulwark put the
  // interrupter on tracks — so the new work stays in the tree and the
  // abilities. All three are real equipment: the eight-wheeled gun carrier,
  // the ballistic missile on its launcher truck, the armoured recovery tank.
  /**
   * **Lightning's suicide drone** (`suicideDrones`): a quadcopter with a
   * shaped charge slung under it — the FPV drone of the Ukrainian front, the
   * Lancet's poorer cousin — flown into what it is sent at and gone with it.
   * It never picks a target of its own (`kamikaze`): it hovers where it is
   * put until an order names a unit, a building or a spot on the ground,
   * then flies there and goes off. Cheap, quick and made of nothing: a Flak
   * Track or a Hawk swats it, and so does a machine gun or an autocannon,
   * since it comes in at treetop height (`lowFlying`); the charge is the
   * anti-tank one (`at`), wasted on a jeep. Eight a faction at most, those on
   * a line's queue counted (`limit`): fifty of them, each a fair trade for
   * a third of a tank and each certain to arrive, deleted any army (the
   * user's word, 2026-09-26). Off the
   * Advanced Airbase, where everything else that flies is built (the Jaguar
   * it replaced came off the Advanced War Factory, but a line is read by
   * what it turns out, `yardKind`, and a war factory with a drone on its
   * list reads as an airbase).
   */
  hornet: {
    id: "hornet",
    kind: "unit",
    aliases: ["fpv", "kamikaze", "suicidedrone", "quadcopter"],
    domain: "air",
    tier: 2,
    // light, not `air`: a foam-and-carbon frame is no armoured airframe, and
    // the small arms that reach it (`lowFlying`) tear it (×1.5) where they
    // only scratch a helicopter; anti-air hits it the same either way
    cost: 120,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 60,
    armor: "light",
    speed: 130,
    turnRate: 6,
    vision: 7,
    radius: 7,
    altitude: 8,
    hovers: true,
    kamikaze: true,
    lowFlying: true,
    limit: 10,
    requires: ["suicideDrones"],
    remoteVision: true,
    weapons: [w({
      // the charge: its range is the touch, and its shot is the drone itself
      id: "charge",
      cls: "at",
      dmg: 160,
      reload: 1,
      range: 0.5,
      projectile: "missile",
      speed: 130,
      targets: ["ground", "ship"],
      splash: 12,
      mark: "cannon",
      sound: "expl"
    })],
    sprite: "u.hornet"
  },
  /**
   * **Anvil's recovery tank** (`fieldRecovery`): the armoured recovery
   * vehicle — the M88A2 Hercules, the Büffel, the BREM — the Repair Tower's aura on tracks. It
   * mends vehicles and ships round it as the tower does, billed at the
   * tower's rate (`REPAIR_TOWER_COST_FRAC`), never a building and never an
   * aircraft: it is a crane and a welder, not an engineer. No gun and heavy
   * plate, so it follows the column into the fire; born with the emergency
   * repair that trebles the aura for six seconds. One Hercules does not mend
   * another, as one tower does not mend another.
   */
  hercules: {
    id: "hercules",
    kind: "unit",
    aliases: ["arv", "recovery", "m88", "buffel"],
    domain: "ground",
    tier: 2,
    ability: "emergencyRepair",
    cost: 350,
    buildTime: 18,
    pop: 1,
    power: -1,
    hp: 700,
    armor: "heavy",
    speed: 58,
    turnRate: 3.8,
    vision: 7,
    radius: 10,
    requires: ["fieldRecovery"],
    body: { r: 13, len: 12 },
    weapons: [],
    repairRange: 4,
    repairRate: 12,
    repairTargets: 2,
    trail: "tread",
    sprite: "u.hercules"
  },
  /**
   * **Hammer's ballistic missile** (`ballisticMissiles`, and the radar the
   * Arsenal already needs): the launcher truck and its two rounds — the
   * Iskander's pair. Eighteen tiles, past the Sovereign and everything else
   * that fires at the ground, one pair every thirty seconds, and a big blast
   * each. The answer is already standing in most bases: the missile is
   * ordnance, and point defence takes it out of the air one round a missile
   * (`interceptable`), so a Scorpion's siege starts with the interrupters.
   * It sees seven tiles and throws eighteen — a Scorpion is blind without a
   * radar car, a drone or a plane over the target. No turret: the erector
   * lays the launcher's whole hull on the bearing, as the howitzer does.
   */
  scorpion: {
    id: "scorpion",
    kind: "unit",
    aliases: ["tbm", "iskander", "ballistic"],
    domain: "ground",
    tier: 3,
    cost: 1100,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 320,
    armor: "light",
    speed: 40,
    turnRate: 2.4,
    vision: 7,
    radius: 12,
    requires: ["radar", "ballisticMissiles"],
    cargoWeight: 4,
    body: { r: 14, len: 18 },
    weapons: [w({
      id: "tbm",
      cls: "he",
      dmg: 400,
      reload: 30,
      range: 18,
      minRange: 6,
      projectile: "missile",
      speed: 230,
      targets: ["ground", "ship"],
      muzzleOffset: 6,
      splash: 64,
      arc: true,
      spread: 30,
      burst: 2,
      burstDelay: 0.9,
      interceptable: true,
      mark: "bomb",
      sound: "missile"
    })],
    trail: "tire",
    sprite: "u.scorpion"
  },
  // ================================================================== SEA
  //
  // Every hull carries a `body`: the capsule `separation()` parts ships by,
  // measured off the drawn silhouette. A circle cannot say "long and thin" —
  // the battleship's was 1.8x its own beam and 41% of its length, so a line
  // of them telescoped bow-to-stern while holding each other twice too far
  // apart abeam. `radius` is untouched and still the combat yardstick.
  gunboat: {
    id: "gunboat",
    kind: "unit",
    aliases: ["patrol", "boat"],
    domain: "ship",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    speed: 90,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    body: { r: 6, len: 20 },
    weapons: [w({
      // the 30 mm reaches aircraft too, at a quarter (since 2026-09-27): the
      // first yard's one answer to the sky, enough to see off a helicopter
      // with a few boats and never a Flak Track's worth per metal
      id: "autocannon",
      cls: "autocannon",
      dmg: 16,
      reload: 0.5,
      range: 4.2,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.8, air: 0.25 },
      turret: true,
      muzzleOffset: 10.4,
      sound: "autocannon"
    })],
    trail: "wake",
    sprite: "u.gunboat",
    turretSprite: "tur.gunboat",
    turretMounts: [{ x: 0, y: -2 }]
  },
  mboat: {
    id: "mboat",
    kind: "unit",
    aliases: ["missileboat", "corvette"],
    domain: "ship",
    tier: 1,
    cost: 280,
    buildTime: 18,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "ship",
    speed: 80,
    turnRate: 3,
    vision: 9,
    radius: 10,
    body: { r: 8, len: 29 },
    weapons: [w({
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 3.5,
      range: 8,
      projectile: "missile",
      speed: 320,
      targets: ["ship"],
      homing: true,
      turret: true,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.mboat"
  },
  frigate: {
    id: "frigate",
    kind: "unit",
    aliases: ["aegis", "escort"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 900,
    armor: "ship",
    speed: 65,
    turnRate: 2.6,
    vision: 10,
    sonar: 9,
    radius: 13,
    // measured at the ship's display scale (core/metrics.ts): a beam of 46.2
    // world px, over a tile, so it needs two tiles of water abeam
    body: { r: 23.1, len: 74.25 },
    weapons: [
      w({
        // The deck gun works the surface; the forward VLS answers the sky.
        id: "navgun",
        cls: "navgun",
        dmg: 40,
        reload: 1.5,
        range: 5.5,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship"],
        turret: true,
        muzzleOffset: 15.796,
        splash: 10,
        sound: "cannon"
      }),
      w({
        // vertical-launch cells on the forward deck: the missile is aimed once it is
        // out (`vertical`), never by the hull or the gun's ring, since a ship
        // never swings on the spot to point its bow at an aircraft. The cells
        // keep a target of their own (`hasAirMount` in combat.ts) and fire at
        // it while the gun is on a boat and while the ship is under way: they
        // used to wait on the gun's one target, and three patrol boats in
        // front of five helicopters sank three frigates that way
        id: "navsam",
        cls: "aa",
        dmg: 80,
        reload: 2,
        range: 8.5,
        projectile: "missile",
        speed: 430,
        // Hatch grid centre: 8.2 art px forward at the hull's 2.8875 scale.
        targets: ["air"],
        homing: true,
        vertical: true,
        muzzleOffset: 23.6775,
        sound: "missile"
      }),
      w({
        // The escort's torpedoes screen submerged threats; surface fighting
        // stays with its light deck gun and the fleet's offensive ships.
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["sub"],
        mult: { sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.frigate",
    turretSprite: "tur.frigate",
    // Measured forward ring: 422 / 2016 down the 42 px hull sheet.
    turretMounts: [{ x: 0, y: -12.2 }]
  },
  // Retained for existing saves and authored scenarios; absent from yard menus.
  // Ironworks supplies the buildable copy under its own ironworks-orca ID.
  destroyer: {
    id: "destroyer",
    kind: "unit",
    aliases: ["orca", "dd"],
    domain: "ship",
    tier: 2,
    ability: "damageControl",
    cost: 700,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 1300,
    armor: "ship",
    speed: 60,
    turnRate: 2.4,
    vision: 10,
    sonar: 9,
    radius: 15,
    // at the ship's display scale: a beam of 48 world px, two tiles of water abeam
    body: { r: 24, len: 63 },
    weapons: [
      w({
        // dual-purpose, like every naval gun (`ARMOR_MATRIX.navgun`)
        // 7 tiles, past the headquarters' gun (2026-09-27): the level-two
        // fleet's answer to a coast, so a navy threatens a shore before the
        // Sovereign. At 7.5 it outranged a howitzer battery three tiles inland
        id: "navgun",
        cls: "navgun",
        dmg: 70,
        reload: 1.8,
        range: 7,
        projectile: "shell",
        speed: 420,
        targets: ["ground", "ship", "air"],
        mult: { medium: 1.1, heavy: 0.8, structure: 0.8 },
        turret: true,
        muzzleOffset: 25.3125,
        splash: 12,
        sound: "cannon"
      }),
      w({
        // anti-submarine torpedoes: out-range the sub's own, bite hardest below
        id: "torpedo",
        cls: "torpedo",
        dmg: 160,
        reload: 3.2,
        range: 7,
        projectile: "torpedo",
        speed: 150,
        targets: ["ship", "sub"],
        mult: { ship: 1, sub: 1.9 },
        homing: true,
        sound: "torpedo"
      })
    ],
    trail: "wake",
    sprite: "u.destroyer",
    turretSprite: "tur.destroyer",
    // Measured gun ring: 620 / 1920 down the 48 px hull sheet.
    turretMounts: [{ x: 0, y: -8.5 }]
  },
  /**
   * The Barracuda hunts ships and nothing else. It carried a warhead of its
   * own until 2026-09-27; that went to the Kraken, the boat built to strike
   * the land.
   */
  sub: {
    id: "sub",
    kind: "unit",
    aliases: ["barracuda", "submarine"],
    domain: "ship",
    tier: 2,
    cost: 480,
    buildTime: 26,
    pop: 2,
    power: -2,
    hp: 550,
    armor: "sub",
    speed: 55,
    turnRate: 2.6,
    vision: 8,
    sonar: 8,
    radius: 12,
    underwater: true,
    body: { r: 7, len: 78 },
    weapons: [w({
      id: "torpedo",
      cls: "torpedo",
      dmg: 160,
      reload: 3.5,
      range: 6.5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      homing: true,
      sound: "torpedo"
    })],
    sprite: "u.sub"
  },
  /**
   * The Sovereign: three turrets on a long, narrow hull rather than one
   * enormous mounting amidships.
   *
   * `turretMounts` is the whole of it — A and B stepped up over the bow, X
   * abaft the superstructure — and the three-round burst it always fired now
   * walks them, so a salvo is three guns speaking a quarter of a second
   * apart. Each trains only within its own arc, which is why X sits round at
   * its stop while the forward pair are on something over the bow. Nothing
   * about the ship's numbers moved with the mounts: the reach and the shell
   * are what they were, and `radius` is still the collision circle rather
   * than the beam, so the fleet packs and closes exactly as it did. The
   * reload went 5 → 7 s afterwards, then to 20 s on 2026-10-08 alongside
   * a wider firing envelope (4–17 tiles) and the move to the Deepwater
   * Yard: a slower siege salvo with a larger blind zone close to the hull.
   *
   * The secondaries are its answer to the sky (since 2026-09-27): four
   * Cobras used to sink it without a loss and two Albatrosses likewise.
   * A battery of their own (`hasAirMount` in combat.ts), so they fire while
   * the main guns are on the shore and never pull the turrets round; 6.5
   * tiles, past a helicopter's missiles and short of the Albatross's, whose
   * answer is still the Aegis riding with it.
   */
  btlship: {
    id: "btlship",
    kind: "unit",
    aliases: ["sovereign", "battleship"],
    domain: "ship",
    tier: 3,
    ability: "barrage",
    cost: 1700,
    buildTime: 70,
    pop: 5,
    power: -5,
    hp: 2500,
    armor: "ship",
    speed: 45,
    turnRate: 1.6,
    vision: 10,
    radius: 20,
    requires: ["radar"],
    // the hull is drawn at its own display scale (core/metrics.ts), and the
    // capsule is measured off the drawing at that scale: 236 world px stem
    // to stern, over seven tiles, on a beam of 44 — over a tile, so two
    // tiles of water abeam and never a channel a tile wide (`hullBeam`)
    body: { r: 22, len: 192 },
    weapons: [w({
      id: "bigguns",
      cls: "he",
      dmg: 120,
      reload: 20,
      range: 17,
      minRange: 4,
      projectile: "shell",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { heavy: 1, ship: 1.2 },
      // 1024 × 1536 turret master: pivot y=921.6, tips y=86, barrel centres
      // x=425/598, mapped to the original 10 × 16 art frame at scale 3.8.
      turret: true,
      muzzleOffset: 33.076,
      bores: 2,
      boreSpacing: 6.42,
      splash: 54,
      arc: true,
      burst: 3,
      burstDelay: 0.25,
      spread: 40,
      sound: "arty"
    }), w({
      id: "secondaries",
      cls: "aa",
      dmg: 20,
      reload: 0.5,
      range: 6.5,
      projectile: "flak",
      speed: 460,
      targets: ["air"],
      turret: true,
      sound: "flak"
    })],
    trail: "wake",
    sprite: "u.btlship",
    turretSprite: "tur.btlship",
    // Rings measured at y=537/788/1739 on the 800 × 2400 master, mapped to
    // its 62 art-px height. The code-drawn hull uses the same offsets.
    turretMounts: [
      { x: 0, y: -17.1275, arc: BROADSIDE },
      // A, over the bow
      { x: 0, y: -10.6433, arc: BROADSIDE },
      // B, superfiring behind A
      { x: 0, y: 13.9242, rest: Math.PI, arc: BROADSIDE }
      // X, abaft the bridge
    ]
  },
  carrier: {
    id: "carrier",
    kind: "unit",
    aliases: ["aircraftcarrier", "cv"],
    domain: "ship",
    tier: 3,
    ability: "damageControl",
    cost: 2200,
    buildTime: 85,
    pop: 6,
    power: -6,
    hp: 2600,
    armor: "ship",
    speed: 40,
    turnRate: 1.3,
    vision: 11,
    radius: 24,
    requires: ["radar"],
    body: { r: 30, len: 180 },
    transportCap: 10,
    transportDomain: "air",
    rearmsAir: true,
    weapons: [w({
      id: "navgun",
      cls: "navgun",
      dmg: 35,
      reload: 2,
      range: 5.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      turret: true,
      muzzleOffset: 14,
      splash: 8,
      sound: "cannon"
    }), w({
      id: "aam",
      cls: "aa",
      dmg: 40,
      reload: 2,
      range: 5,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      homing: true,
      turret: true,
      muzzleOffset: 6,
      bores: 2,
      boreSpacing: 7,
      sound: "missile"
    })],
    trail: "wake",
    sprite: "u.carrier",
    turretSprite: "tur.carrier",
    airMount: { sprite: "tur.carrier-aa", x: 5.75, y: 20.7, on: "hull" },
    // Port-forward ring measured on the master at (332, 284), in its
    // 1024 × 1536 frame, mapped to the manifest's 32 × 62 art px.
    turretMounts: [{ x: -5.625, y: -19.536 }]
  },
  seatrans: {
    id: "seatrans",
    kind: "unit",
    aliases: ["landingcraft", "lst", "lcac"],
    domain: "ship",
    tier: 1,
    cost: 220,
    buildTime: 14,
    pop: 1,
    power: -1,
    hp: 500,
    armor: "ship",
    speed: 70,
    turnRate: 2.8,
    vision: 8,
    radius: 20,
    transportCap: 8,
    // a ramp against a beach has more give than a hoist: a tenth more reach
    // to board it, collect with it, and come to the shore it unloads on
    cargoReach: 1.1,
    // The cushion skirt overhangs the firm hull; retain one-tile beach access.
    body: { r: 14, len: 30 },
    weapons: [],
    trail: "wake",
    sprite: "u.seatrans"
  },
  /**
   * The engineer that works from the water. It builds and mends the same
   * things an engineer does, but only what stands within its arms of the
   * sea — which on a naval map is the ore: the fields out in open water,
   * which nothing else can reach (the offshore rig), and the deposits on
   * islets no engineer can drive to. Its `reach` is longer
   * than the engineer's, because the hull stops at the shoreline and the
   * site stands on the beach beyond it; long enough for one tile of beach
   * between the two, not for a deposit inland. Unarmed, and a builder for
   * `canRebuild` like any other pair of hands.
   */
  engboat: {
    id: "engboat",
    kind: "unit",
    aliases: ["workboat", "seabuilder"],
    domain: "ship",
    tier: 1,
    cost: 200,
    buildTime: 10,
    pop: 1,
    power: -1,
    hp: 260,
    armor: "ship",
    detect: 3,
    speed: 75,
    turnRate: 3.2,
    vision: 7,
    radius: 9,
    weapons: [],
    body: { r: 6, len: 18 },
    builds: ["extractor", "platform", "power", "factory", "factory3", "navyard", "navyard3", "airbase", "airbase3", "mgturret", "cannonturret", "aaturret", "interceptor", "repairtower", "sandbag", "landmine", "watermine", "warlab", "radar", "veil", "reactor", "nukesilo", "hq"],
    buildRate: 30,
    reach: 64,
    trail: "wake",
    sprite: "u.engboat"
  },
  /**
   * Level 3 of the naval yard. The Kraken shells the shore from under the
   * water — two cruise missiles every six seconds at ground targets only, no
   * torpedo, nothing to fight a ship with. They go up out of the six tubes
   * amidships and turn onto their bearing once out (`vertical`), so the boat
   * fires at any bearing without coming round. Vision 6 against range 13: it
   * shoots at what the team can see, or force-fires at a point the player
   * remembers. Every missile is `interceptable`, so an Interrupter over the
   * target blanks it the way it blanks a Tempest (kraken.test.ts).
   *
   * It is the second launcher (2026-09-27, the Barracuda's before): one
   * warhead of its own at the silo's price and pace, fired from wherever it
   * lies — but fabricated only alongside one of its own naval yards
   * (`armsAtBase`), so arming it is a trip home and the strike is the trip
   * out (nuke.test.ts).
   *
   * Priced as the naval Tempest with a stealth premium since 2026-09-17
   * (1500 · 60 s · pop 4 · range 12 before): sold beside the Sovereign at 88%
   * of its price, with a quarter of its hull and two tiles less reach, it was
   * never bought.
   */
  kraken: {
    id: "kraken",
    kind: "unit",
    aliases: ["cruisesub", "missilesub"],
    domain: "ship",
    tier: 3,
    cost: 1e3,
    buildTime: 45,
    pop: 3,
    power: -3,
    hp: 620,
    armor: "sub",
    speed: 50,
    turnRate: 2.4,
    vision: 6,
    sonar: 6,
    radius: 13,
    underwater: true,
    requires: ["radar"],
    body: { r: 9, len: 110 },
    nukeCapacity: 1,
    nukeCost: 2500,
    nukeTime: 180,
    armsAtBase: 4,
    weapons: [w({
      id: "cruise",
      cls: "he",
      dmg: 150,
      reload: 6,
      range: 13,
      minRange: 3,
      projectile: "missile",
      speed: 260,
      targets: ["ground"],
      homing: true,
      interceptable: true,
      vertical: true,
      splash: 43,
      burst: 2,
      burstDelay: 0.6,
      sound: "missile"
    })],
    sprite: "u.kraken"
  },
  /**
   * A transport that nobody without sonar can see: a hold of 4 — one
   * Mammoth, two Vipers, four engineers. The beach is the only door: boarding
   * is walking to it, and it unloads only onto ground near its hull, so it
   * has to come in close to a shore. Its hatch is on the surface: for as
   * long as its hold is working it is up, a ship anyone can see and shoot
   * (`surfacesForCargo`). Unarmed, and its cargo dies with it (moray.test.ts).
   */
  moray: {
    id: "moray",
    kind: "unit",
    aliases: ["spysub", "infiltrator"],
    domain: "ship",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 450,
    armor: "sub",
    speed: 62,
    turnRate: 2.8,
    vision: 6,
    sonar: 5,
    radius: 12,
    underwater: true,
    transportCap: 4,
    requires: ["radar"],
    // more give than the landing craft's 1.1 (2026-09-27): a squad boards
    // from further up the beach, and the hold sets it down a tile further out
    cargoReach: 1.5,
    body: { r: 8, len: 70 },
    weapons: [],
    sprite: "u.moray"
  },
  // ================================================================== AIR
  drone: {
    id: "drone",
    kind: "unit",
    aliases: ["scout", "uav"],
    domain: "air",
    tier: 1,
    remoteVision: true,
    cost: 40,
    buildTime: 4,
    pop: 1,
    power: -1,
    hp: 90,
    armor: "air",
    // a fixed wing: it cannot hover, so it loiters the way every other plane
    // does, circling the spot it was sent to
    speed: 130,
    turnRate: 3.2,
    vision: 12,
    radius: 8,
    altitude: 12,
    weapons: [],
    sprite: "u.drone"
  },
  fighter: {
    id: "fighter",
    kind: "unit",
    aliases: ["falcon", "cap"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 380,
    buildTime: 22,
    pop: 2,
    power: -2,
    hp: 320,
    armor: "air",
    speed: 190,
    turnRate: 2.8,
    vision: 11,
    radius: 9,
    altitude: 14,
    rearmTime: 12,
    weapons: [w({
      id: "aam",
      cls: "aa",
      dmg: 150,
      reload: 2.2,
      range: 6,
      projectile: "missile",
      speed: 480,
      targets: ["air"],
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.fighter",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 13, scale: 1.5, when: "ability" }]
  },
  /**
   * The Cobra (2026-10-01): off the Advanced Airbase, no longer the first
   * one; at treetop height (`lowFlying`), where the machine guns and the
   * light cannon of a column reach it as small arms reached every Apache of
   * the Karbala raid; eight missiles aboard, an AH-1's load, and then home
   * to the airbase for more (`ammo`, `game/ammo.ts`).
   */
  heli: {
    id: "heli",
    kind: "unit",
    aliases: ["cobra", "attackheli"],
    domain: "air",
    tier: 2,
    cost: 380,
    buildTime: 20,
    pop: 2,
    power: -2,
    hp: 300,
    armor: "air",
    speed: 95,
    turnRate: 3.4,
    vision: 9,
    radius: 9,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    rearmTime: 12,
    weapons: [w({
      // a raider as much as a tank hunter: keeps some bite against soft targets
      id: "atgm",
      cls: "at",
      dmg: 75,
      reload: 2.6,
      range: 5.5,
      projectile: "missile",
      speed: 300,
      targets: ["ground", "ship"],
      mult: { light: 0.6, structure: 0.8 },
      homing: true,
      ammo: 8,
      sound: "missile"
    })],
    sprite: "u.heli"
  },
  jet: {
    id: "jet",
    kind: "unit",
    aliases: ["thunderbolt", "strikejet"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 450,
    buildTime: 25,
    pop: 2,
    power: -2,
    hp: 360,
    armor: "air",
    speed: 160,
    turnRate: 2.4,
    vision: 10,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // six salvos of four, two pods' worth, then home (`ammo`)
      id: "rockets",
      cls: "rocket",
      dmg: 24,
      reload: 2.4,
      range: 4.5,
      projectile: "rocket",
      speed: 340,
      targets: ["ground", "ship"],
      burst: 4,
      burstDelay: 0.1,
      splash: 22,
      spread: 18,
      ammo: 6,
      sound: "rocket"
    })],
    sprite: "u.jet",
    decals: [{ sprite: "dec.afterburner", layer: "under", x: -2.5, y: 13, scale: 1.3, when: "ability" }, { sprite: "dec.afterburner", layer: "under", x: 2.5, y: 13, scale: 1.3, when: "ability" }]
  },
  mjet: {
    id: "mjet",
    kind: "unit",
    aliases: ["albatross", "antiship"],
    domain: "air",
    tier: 2,
    ability: "afterburner",
    cost: 520,
    buildTime: 28,
    pop: 2,
    power: -2,
    hp: 380,
    armor: "air",
    speed: 150,
    turnRate: 2.2,
    vision: 11,
    radius: 10,
    altitude: 14,
    rearmTime: 15,
    weapons: [w({
      // four anti-ship missiles, a maritime striker's load (`ammo`)
      id: "ashm",
      cls: "ashm",
      dmg: 170,
      reload: 4.5,
      range: 8,
      projectile: "missile",
      speed: 340,
      targets: ["ship"],
      mult: { ship: 1.7 },
      homing: true,
      ammo: 4,
      sound: "missile"
    })],
    sprite: "u.mjet",
    decals: [{ sprite: "dec.afterburner", layer: "under", y: 14, scale: 1.5, when: "ability" }]
  },
  bomber: {
    id: "bomber",
    kind: "unit",
    aliases: ["vulture", "levelbomber"],
    domain: "air",
    tier: 2,
    ability: "incendiary",
    // siege from the air is the strongest thing an airbase makes, and it is
    // priced and armoured so a SAM site is a real answer to it
    cost: 1e3,
    buildTime: 40,
    pop: 3,
    power: -3,
    hp: 560,
    armor: "air",
    speed: 110,
    turnRate: 1.8,
    vision: 9,
    radius: 12,
    altitude: 16,
    rearmTime: 20,
    weapons: [w({
      // heavy bombs: nothing on the ground shrugs them off. Two sticks of
      // five in the bay, then home for the next load (`ammo`)
      id: "bombs",
      cls: "he",
      dmg: 70,
      reload: 6,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { medium: 1.2, heavy: 1, ship: 1.1 },
      burst: 5,
      burstDelay: 0.14,
      splash: 42,
      spread: 20,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.bomber",
    // the canisters on the wing just aft of the inner engine pods
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: -1, when: "ability" }]
  },
  theli: {
    id: "theli",
    kind: "unit",
    aliases: ["pelican", "transportheli"],
    domain: "air",
    tier: 1,
    cost: 280,
    buildTime: 16,
    pop: 1,
    power: -1,
    hp: 380,
    armor: "air",
    speed: 100,
    turnRate: 3,
    vision: 8,
    radius: 11,
    altitude: 12,
    transportCap: 2,
    hovers: true,
    lowFlying: true,
    weapons: [],
    sprite: "u.theli"
  },
  c47: {
    id: "c47",
    kind: "unit",
    aliases: ["condor", "cargoplane", "skytrain", "dakota"],
    domain: "air",
    tier: 2,
    cost: 650,
    buildTime: 34,
    pop: 3,
    power: -3,
    hp: 720,
    armor: "air",
    speed: 120,
    turnRate: 1.9,
    vision: 9,
    radius: 15,
    altitude: 16,
    transportCap: 4,
    transportMaxWeight: 2,
    landsForCargo: true,
    weapons: [],
    sprite: "u.c47"
  },
  gunship: {
    id: "gunship",
    kind: "unit",
    aliases: ["spectre", "ac130"],
    domain: "air",
    tier: 3,
    cost: 1800,
    buildTime: 60,
    pop: 5,
    power: -5,
    hp: 1100,
    armor: "air",
    speed: 90,
    turnRate: 1.6,
    vision: 10,
    radius: 12,
    altitude: 16,
    requires: ["radar"],
    rearmTime: 25,
    weapons: [w({
      // Sustained fire support, strongest against light and medium armor.
      // The 150-round drum keeps it on station; heavy armor, fortifications
      // and ships call for the air wing's specialist weapons.
      id: "gatcannon",
      cls: "autocannon",
      dmg: 28,
      reload: 0.45,
      range: 5.5,
      projectile: "shell",
      speed: 480,
      targets: ["ground", "ship"],
      mult: { light: 1.2, medium: 1.2, heavy: 0.8, structure: 0.8, ship: 0.7 },
      ammo: 150,
      // side-firing: the gunship shoots out of its orbit instead of nose-on
      turret: true,
      splash: 10,
      sound: "autocannon"
    })],
    sprite: "u.gunship"
  },
  /**
   * Level 3 of the airbase. The Wraith carries two heavy bombs instead of
   * the Vulture's five: one pass puts 832 onto a building, which is a Radar
   * Station, a SAM Site or an Interrupter in a single run. Its `stealth` is
   * a range: an enemy sees it only within 4 tiles of one of their units or
   * buildings, or 8 of their radar (`detect`), so AA elsewhere in the base
   * never joins in and whatever stands at the target gets its shots late.
   * The counters are the cheap ones — flak and gatlings beside the things
   * worth keeping — and a Falcon patrol over them (wraith.test.ts).
   *
   * It also carries one nuclear gravity bomb (2026-09-27, `nukebomb`),
   * fabricated only while it circles one of its own airbases
   * (`armsAtBase`), and delivered the way a bomber delivers one: flown over
   * the point and let go, to lie there on its fuse (nuke-bomb.test.ts).
   */
  wraith: {
    id: "wraith",
    kind: "unit",
    aliases: ["stealth", "stealthbomber"],
    domain: "air",
    tier: 3,
    ability: "incendiary",
    cost: 1400,
    buildTime: 55,
    pop: 4,
    power: -4,
    hp: 450,
    armor: "air",
    speed: 135,
    turnRate: 2,
    vision: 9,
    radius: 11,
    altitude: 16,
    stealth: 4,
    requires: ["radar"],
    rearmTime: 20,
    // one nuclear gravity bomb (`nukebomb`), fabricated over its own airbases
    // — the ground its bombs are loaded on too (`game/ammo.ts`)
    nukeCapacity: 1,
    armsAtBase: 4,
    magazine: ["nukebomb"],
    weapons: [w({
      // two passes' worth of heavy bombs, then home (`ammo`)
      id: "heavybombs",
      cls: "he",
      dmg: 260,
      reload: 8,
      range: 2.4,
      projectile: "bomb",
      speed: 120,
      targets: ["ground", "ship"],
      mult: { light: 1, medium: 0.9, heavy: 0.6 },
      burst: 2,
      burstDelay: 0.2,
      splash: 43,
      spread: 10,
      ammo: 2,
      sound: "bomb"
    })],
    sprite: "u.wraith",
    decals: [{ sprite: "dec.incendiary", layer: "hull", y: 2, when: "ability" }]
  },
  /**
   * The first aircraft that can find a submarine: dipping sonar and homing
   * torpedoes that bite hardest below. A torpedo dropped over land fizzles on
   * the spot — the engine does that to every torpedo — so the Cormorant
   * attacks from over the sea, and its reach (5) is inside the Aegis
   * frigate's missiles (8.5), so a screened fleet is closed to it
   * (cormorant.test.ts).
   */
  cormorant: {
    id: "cormorant",
    kind: "unit",
    aliases: ["asw", "aswheli"],
    domain: "air",
    tier: 3,
    cost: 700,
    buildTime: 34,
    pop: 2,
    power: -2,
    hp: 340,
    armor: "air",
    // the longest sonar in the game — a tile past the Orca's, so it is the
    // one thing that hears a submarine before the submarine's escort hears it
    speed: 92,
    turnRate: 3.2,
    vision: 9,
    sonar: 10,
    radius: 10,
    altitude: 11,
    hovers: true,
    lowFlying: true,
    requires: ["radar"],
    rearmTime: 15,
    weapons: [w({
      // two torpedoes, a Seahawk's, then home for more (`ammo`)
      id: "airtorpedo",
      cls: "torpedo",
      dmg: 140,
      reload: 4,
      range: 5,
      projectile: "torpedo",
      speed: 150,
      targets: ["ship", "sub"],
      mult: { ship: 0.9, sub: 1.8 },
      homing: true,
      ammo: 2,
      sound: "torpedo"
    })],
    sprite: "u.cormorant"
  },
  /**
   * The nuclear warhead in flight. Not built at any factory: a silo or a
   * Kraken launches one, and from then on it is an aircraft with no
   * gun and no orders, flying a straight line at the point it was sent to:
   * a slow launch, cruise, then a faster terminal approach
   * (`Game.tickWarhead`, `warheadTravel`). Two things may shoot it down: a *veteran* — a unit
   * of rank 2 or better whose weapons reach the sky (`canEngage` in
   * combat.ts, `WARHEAD_MIN_RANK`) — and the SAM Site, the one emplacement a
   * def flag clears for the job (`antiWarhead`). A green unit and every other
   * building cannot lock on to it, fire at it or scratch it with a stray
   * burst. The hit points are the balance among those who can: one veteran
   * Hawk under its path is not enough and a row of them is, and the same goes
   * for a pair of SAM Sites under the line versus a cluster over the target
   * (nuke.test.ts pins all of it). They move with the SAM Site's damage —
   * raise its missile and this goes up in step, or one site alone gets the
   * vote the pair was meant to have.
   * Its `requires` is what every launcher needs to fabricate or fire one.
   */
  warhead: {
    id: "warhead",
    kind: "unit",
    aliases: ["nuke", "nuclear"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 0,
    buildTime: 0,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    sprite: "u.warhead",
    decals: WARHEAD_MOTOR
  },
  /**
   * The other thing a silo or a Kraken may put in the shaft: an
   * electromagnetic pulse where the nuclear warhead has a blast. Same
   * missile, same flight, same hit points against the same anti-air — and
   * where it comes down every circuit within `emp.radius` tiles is dead for
   * `emp.seconds` (`pulse` in combat.ts): a column stands still with its
   * guns silent, a radar goes blind, a repair tower and a turret line stop,
   * a plant makes nothing, its own side's included. Nothing in the air is
   * touched, which is what makes air the answer to it, and a wall draws no
   * power and stands as it stood. It leaves no crater and kills nothing,
   * which is why it is half the price and half the wait, needs only the
   * radar, and is the one a player who wants the base rather than the
   * ground it stood on reaches for. `cost` and `buildTime` are its own:
   * the nuclear warhead's are the launcher's (`warheadCost` in
   * game/warheads.ts).
   */
  emp: {
    id: "emp",
    kind: "unit",
    aliases: ["empwarhead", "pulse"],
    domain: "air",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 90,
    pop: 0,
    hp: 700,
    armor: "air",
    speed: 96,
    turnRate: 0,
    vision: 0,
    radius: 7,
    altitude: 36,
    weapons: [],
    requires: ["radar"],
    emp: { radius: 7, seconds: 12 },
    sprite: "u.emp",
    decals: WARHEAD_MOTOR
  },
  /**
   * The Wraith's nuclear bomb (2026-09-27): a free-fall weapon, not a missile
   * (`laydown`). The bomber carries it to the point and lets it go
   * (`nukeDrop`); it comes down under a parachute and lies there for its
   * fuse — the laydown delay a B61 has so the aircraft can get clear —
   * before it goes off. A tactical yield, about a sixth of the missile's by
   * the cube root that sizes a blast: half its rings (3 and 4 tiles against
   * 6 and 8) and two thirds of its punch at the point. Lying there it is a
   * heavy thing on the ground any gun may shoot apart, which it survives
   * for a few seconds of a tank's fire, and shot apart it does not go off.
   * Priced under half the missile's, being so much less of it.
   */
  nukebomb: {
    id: "nukebomb",
    kind: "unit",
    aliases: ["b61", "nuclearbomb", "gravitybomb"],
    domain: "ground",
    tier: 3,
    warhead: true,
    cost: 1200,
    buildTime: 120,
    pop: 0,
    hp: 800,
    armor: "heavy",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 8,
    weapons: [],
    requires: ["radar", "reactor", "nuclearProgram"],
    laydown: { fuse: 10, dmg: 2e3, inner: 4, outer: 5 },
    sprite: "u.nukebomb"
  },
  // ============================================================ BUILDINGS
  /**
   * The one footprint that is not square: the sheet's ground is four tiles
   * wide and three deep, and a fourth row only put a strip of walkable
   * ground under the south wall. `spawnFootprint` (game/state.ts) settles
   * the odd height against the spawn point.
   */
  /**
   * The headquarters defends itself, the way a tower does in a lane game:
   * a twin heavy machine gun on the roof ring where the helipad was, a
   * shade stronger than the Gatling (79 dps to its 71) and reaching farther
   * (7 tiles, measured from a centre that is already two
   * tiles from the wall, so five past it), so a buggy, a light tank, a
   * gunship or a machine-gun turret that comes for it pays while a howitzer
   * or a launcher standing off still outranges it. It was the Gatling's 5
   * until the recorded matches of 15 September 2026: a gunship at 5.5 hit
   * it for free, and an engineer flown in stood turrets 7 tiles out that
   * shot every engineer it made; the ground a side may build on is its
   * headquarters' (`hqGroundTiles` in `game/orders.ts`), which is what
   * answers that drop. The ring is the pad's centre on the sheet (`mount`
   * in the manifest is the same point, for the placement ghost); the muzzle
   * and the bore spacing are measured across `tur.hq`.
   */
  hq: {
    id: "hq",
    kind: "building",
    domain: "none",
    tier: 1,
    isHQ: true,
    cost: 2500,
    buildTime: 60,
    pop: 0,
    hp: 4e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 11,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 35,
      bores: 2,
      boreSpacing: 5.7,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    upgradesTo: "hq2",
    upgradeCost: 15e3,
    upgradeTime: 180,
    sprite: "u.hq",
    turretSprite: "tur.hq",
    turretMounts: [{ x: 26, y: -36 }]
  },
  hq2: {
    id: "hq2",
    kind: "building",
    domain: "none",
    tier: 2,
    isHQ: true,
    upgradeOnly: true,
    cost: 17500,
    buildTime: 240,
    pop: 0,
    hp: 6e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 10,
    radius: 60,
    fw: 4,
    fh: 3,
    weapons: [w({
      id: "hqgun",
      cls: "mg",
      dmg: 19.25,
      reload: 0.14,
      range: 7,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 45,
      bores: 2,
      boreSpacing: 8.4,
      sound: "mg"
    })],
    produces: ["engineer"],
    power: 10,
    metalRate: 0.5,
    requires: ["radar"],
    sound: "bld-hq",
    sprite: "u.hq2",
    turretSprite: "tur.hq2",
    turretMounts: [{ x: 26, y: -36 }]
  },
  extractor: {
    id: "extractor",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    power: -4,
    upgradesTo: "extractor2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.extractor"
  },
  extractor2: {
    id: "extractor2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    power: -8,
    upgradesTo: "extractor3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.extractor2"
  },
  extractor3: {
    id: "extractor3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    power: -15,
    sprite: "u.extractor3"
  },
  /**
   * The offshore rig: the extractor's line on its own legs over an ore field
   * at sea (`offshore`), laid from the water by the engineer boat — no
   * engineer stands on open sea and no aircraft sets one down there — and
   * worth exactly what the extractor at the same level
   * is: the same price, hit points, yield, draw and upgrades, so the only
   * question a field at sea asks is who holds the water round it. That is
   * the point of it (2026-09-27): with the ore on the islands a Pelican
   * could fly an engineer to, a side could skip the navy and win in the air;
   * a field in open water is mined by a fleet or not at all. An engineer
   * builds one too, where it can walk out to the field over a frozen sea
   * (`isRigTile`: the legs go down through the ice as through the water), and
   * never from a beach, since the maps keep three tiles of sea round every
   * field and its arms reach two. No turret stands on the water, so what
   * guards a rig is the ships anchored over it, which
   * since the same day shoot back at aircraft. The real thing is the Gulf's
   * and the Santa Barbara Channel's: platforms fought over by navies —
   * Nimble Archer and Praying Mantis in 1987 and 1988, the Ellwood field
   * shelled from a submarine in 1942. Exempt from the headquarters' ground
   * as an extractor is (`needsDeposit`); a naval gun, a missile or a bomb
   * reaches it, a torpedo does not (it is a building, `targetCat` ground).
   */
  platform: {
    id: "platform",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 120,
    buildTime: 10,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 1.4,
    needsDeposit: true,
    offshore: true,
    power: -4,
    upgradesTo: "platform2",
    upgradeCost: 190,
    upgradeTime: 16,
    sprite: "u.platform",
    sound: "bld-extractor"
  },
  platform2: {
    id: "platform2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 310,
    buildTime: 26,
    pop: 0,
    hp: 950,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 3,
    needsDeposit: true,
    offshore: true,
    power: -8,
    upgradesTo: "platform3",
    upgradeCost: 500,
    upgradeTime: 30,
    sprite: "u.platform2",
    sound: "bld-extractor2"
  },
  platform3: {
    id: "platform3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 810,
    buildTime: 56,
    pop: 0,
    hp: 1700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    metalRate: 8,
    needsDeposit: true,
    offshore: true,
    power: -15,
    sprite: "u.platform3",
    sound: "bld-extractor3"
  },
  /**
   * The plant line is 20 / 50 / 150: each level a shade dearer per unit of
   * power than a fresh plant (7, 8 and 7.3 metal a point), so an upgrade is
   * bought for the ground it gives back and the fewer targets it leaves,
   * never because it is the cheaper power. It was 20 / 60 / 210, and the
   * core at 5.2 a point was the best bargain on the map: every base went
   * there and the Reactor was never built for its output.
   */
  power: {
    id: "power",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 140,
    buildTime: 12,
    pop: 0,
    hp: 500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 20,
    upgradesTo: "power2",
    upgradeCost: 260,
    upgradeTime: 18,
    sprite: "u.power"
  },
  power2: {
    id: "power2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 400,
    buildTime: 30,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 5,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 50,
    upgradesTo: "power3",
    upgradeCost: 700,
    upgradeTime: 36,
    sprite: "u.power2",
    sound: "bld-power"
  },
  power3: {
    id: "power3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 66,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: 150,
    sprite: "u.power3",
    sound: "bld-power"
  },
  factory: {
    id: "factory",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 20,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engineer", "buggy", "ltank", "flak"],
    upgradesTo: "factory2",
    upgradeCost: 420,
    upgradeTime: 25,
    sprite: "u.factory",
    sound: "bld-extractor2"
  },
  factory2: {
    id: "factory2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 740,
    buildTime: 45,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules"],
    upgradesTo: "factory3",
    upgradeCost: 900,
    upgradeTime: 45,
    sprite: "u.factory2",
    sound: "bld-extractor2"
  },
  /**
   * Level 3. Each production line upgrades once more, in place, and the
   * upgrade needs a Radar Station (`requires`, checked by `cmdUpgrade` on the
   * target def) — the one gate Tier 3 has always had. The line produces
   * nothing while it upgrades, and 45–48 s at this stage is a wave: that
   * downtime is the real price. `cost` is cumulative, as on every upgraded
   * def, because the sell refund reads it.
   *
   * The Tempest is the Arsenal's since 2026-09-17, and the Drake the level
   * below's: the third level sold three specialists nobody bought while the
   * level under it sold the siege piece that took 22% of all value in the
   * first human records, so nobody upgraded. Now the line's second upgrade
   * is what the rocket artillery costs.
   */
  factory3: {
    id: "factory3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1640,
    buildTime: 90,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engineer", "buggy", "ltank", "flak", "mbt", "td", "sam", "arty", "drake", "gator", "htank", "radarcar", "hercules", "mlrs", "salamander", "bulwark", "scorpion"],
    sprite: "u.factory3",
    sound: "bld-extractor2"
  },
  airbase: {
    id: "airbase",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 380,
    buildTime: 24,
    pop: 0,
    hp: 1400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -8,
    // the scout and the lift; the Cobra is the Advanced Airbase's since
    // 2026-10-01, so the first attack helicopter is a tier-two decision
    produces: ["drone", "theli"],
    upgradesTo: "airbase2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.airbase"
  },
  airbase2: {
    id: "airbase2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 830,
    buildTime: 50,
    pop: 0,
    hp: 2e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -12,
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet"],
    upgradesTo: "airbase3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.airbase2",
    sound: "bld-airbase"
  },
  airbase3: {
    id: "airbase3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1780,
    buildTime: 96,
    pop: 0,
    hp: 2700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 60,
    fw: 4,
    fh: 4,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["drone", "heli", "theli", "fighter", "jet", "mjet", "bomber", "c47", "gunship", "hornet", "wraith", "cormorant"],
    sprite: "u.airbase3",
    sound: "bld-airbase"
  },
  navyard: {
    id: "navyard",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 350,
    buildTime: 22,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -8,
    produces: ["engboat", "gunboat", "mboat", "seatrans"],
    upgradesTo: "navyard2",
    upgradeCost: 450,
    upgradeTime: 26,
    sprite: "u.navyard",
    sound: "unit-ship"
  },
  navyard2: {
    id: "navyard2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 800,
    buildTime: 48,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -12,
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator"],
    upgradesTo: "navyard3",
    upgradeCost: 950,
    upgradeTime: 48,
    sprite: "u.navyard2",
    sound: "unit-ship"
  },
  navyard3: {
    id: "navyard3",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1750,
    buildTime: 96,
    pop: 0,
    hp: 3e3,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 45,
    fw: 3,
    fh: 3,
    weapons: [],
    power: -20,
    requires: ["radar"],
    produces: ["engboat", "gunboat", "mboat", "seatrans", "frigate", "sub", "gator", "btlship", "kraken", "moray", "carrier"],
    sprite: "u.navyard3",
    sound: "unit-ship"
  },
  /**
   * The MG Turret: a twin mount, and now firing like one.
   *
   * Both barrels were painted and only the middle of the gun ever shot, so
   * `bores` alternates them — `boreSpacing` is measured off `tur.mg`'s own
   * art, and a building is drawn 1:1 so that measurement is world px as it
   * stands. The cyclic rate went up with it (0.35 → 0.25 s, about a third
   * more damage a second): a gun feeding two barrels in turn is faster than
   * one feeding a single barrel, and the pad wanted the help. It stops short
   * of the Gatling it upgrades into, which reloads in 0.14 and has to stay
   * worth the upgrade.
   */
  mgturret: {
    id: "mgturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 130,
    buildTime: 10,
    pop: 0,
    hp: 400,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -2,
    weapons: [w({
      id: "turretmg",
      cls: "mg",
      dmg: 10,
      reload: 0.25,
      range: 5,
      projectile: "bullet",
      speed: 500,
      targets: ["ground", "ship", "air"],
      mult: { ship: 0.6, structure: 0.3 },
      turret: true,
      muzzleOffset: 24.7,
      bores: 2,
      boreSpacing: 5.75,
      sound: "mg"
    })],
    upgradesTo: "gatling",
    upgradeCost: 200,
    upgradeTime: 16,
    sprite: "u.mgturret",
    turretSprite: "tur.mg",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -4 }]
  },
  gatling: {
    id: "gatling",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 330,
    buildTime: 26,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -4,
    weapons: [w({
      id: "gatling",
      cls: "mg",
      dmg: 10,
      reload: 0.14,
      range: 6.5,
      projectile: "bullet",
      speed: 520,
      targets: ["ground", "ship", "air"],
      mult: { medium: 0.9, heavy: 0.5, air: 0.8, ship: 0.7, structure: 0.3 },
      turret: true,
      muzzleOffset: 27.2,
      sound: "mg"
    })],
    sprite: "u.gatling",
    turretSprite: "tur.gatling",
    sound: "bld-cannonturret",
    turretMounts: [{ x: 0, y: -5 }]
  },
  cannonturret: {
    id: "cannonturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 320,
    buildTime: 18,
    pop: 0,
    hp: 700,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 8,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      // static guns hit buildings softer than tanks do — no turret creep
      id: "cannon",
      cls: "cannon",
      dmg: 65,
      reload: 1.9,
      range: 6,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.1, structure: 0.6, ship: 1 },
      turret: true,
      recoil: 1.8,
      muzzleOffset: 29,
      splash: 12,
      sound: "cannon"
    })],
    upgradesTo: "cannonturret2",
    upgradeCost: 340,
    upgradeTime: 22,
    sprite: "u.cannonturret",
    turretSprite: "tur.cannon",
    turretMounts: [{ x: 0, y: -4 }]
  },
  cannonturret2: {
    id: "cannonturret2",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 660,
    buildTime: 40,
    pop: 0,
    hp: 1500,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -5,
    weapons: [w({
      id: "twincannon",
      cls: "cannon",
      dmg: 60,
      reload: 2,
      range: 7.5,
      projectile: "shell",
      speed: 420,
      targets: ["ground", "ship"],
      mult: { heavy: 1.2, structure: 0.6, ship: 1.1 },
      // Hidden swivel at (464,1100), tips at y20 with 228px separation;
      // the 928×1712 master is drawn in a 28×52 world-pixel frame.
      turret: true,
      recoil: 2.2,
      muzzleOffset: 32.8037,
      bores: 2,
      boreSpacing: 6.87931,
      splash: 14,
      burst: 2,
      burstDelay: 0.2,
      sound: "cannon"
    })],
    sprite: "u.cannonturret2",
    turretSprite: "tur.cannon2"
  },
  aaturret: {
    id: "aaturret",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 400,
    buildTime: 14,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -3,
    weapons: [w({
      id: "aaflak",
      cls: "aa",
      dmg: 33,
      reload: 0.8,
      range: 8,
      projectile: "flak",
      speed: 480,
      targets: ["air"],
      turret: true,
      muzzleOffset: 27.4,
      sound: "flak"
    })],
    upgradesTo: "samsite",
    upgradeCost: 600,
    upgradeTime: 20,
    sprite: "u.aaturret",
    turretSprite: "tur.aa",
    sound: "bld-cannonturret"
  },
  /**
   * The upgraded flak tower, and the one emplacement a nuclear warhead has to
   * answer to: `antiWarhead` lifts the rank gate that keeps every building
   * off one (`canEngageWarhead` in combat.ts), so a base that paid for its
   * strategic air defence gets a vote on the strike without a veteran Hawk
   * standing under the path. Its damage is what sets the price of that vote —
   * see nuke.test.ts for how many sites it takes.
   */
  samsite: {
    id: "samsite",
    kind: "building",
    domain: "none",
    tier: 2,
    upgradeOnly: true,
    cost: 1e3,
    buildTime: 34,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -6,
    antiWarhead: true,
    weapons: [w({
      id: "samsite",
      cls: "aa",
      dmg: 170,
      reload: 2.6,
      range: 10,
      projectile: "missile",
      speed: 460,
      targets: ["air"],
      turret: true,
      muzzleOffset: 20.5,
      bores: 4,
      boreSpacing: 3.5,
      splash: 29,
      homing: true,
      sound: "missile"
    })],
    sprite: "u.samsite",
    turretSprite: "tur.samsite",
    sound: "bld-cannonturret"
  },
  /**
   * Point defence. It cannot shoot at anything on the ground: its rounds are
   * spent on incoming rockets and Viper missiles, one round per round shot
   * down. A nuclear warhead is not its business at either tier — that is an
   * aircraft, and anti-air (a veteran, or a SAM Site) shoots it down or
   * nothing does.
   * The magazine is one Tempest salvo (8 rockets) so a barrage is absorbed
   * whole, and the reload is what sets the duel: one launcher throws 8
   * rockets every 8s (1/s) and one tower replaces 1.33 rounds a second,
   * so a single Tempest never lands a rocket and a second one breaks
   * through. Anything faster here makes the tower unanswerable; anything
   * slower and one launcher grinds it down alone. See interceptor.test.ts.
   */
  interceptor: {
    id: "interceptor",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 450,
    buildTime: 24,
    pop: 0,
    hp: 600,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 9,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -8,
    weapons: [],
    interceptRange: 7,
    interceptMag: 8,
    interceptReload: 0.75,
    interceptMuzzleOffset: 19,
    upgradesTo: "interceptor2",
    upgradeCost: 650,
    upgradeTime: 36,
    sprite: "u.interceptor",
    turretSprite: "tur.interceptor",
    sound: "bld-cannonturret"
  },
  interceptor2: {
    id: "interceptor2",
    kind: "building",
    domain: "none",
    tier: 3,
    upgradeOnly: true,
    cost: 1100,
    buildTime: 60,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 11,
    radius: 14,
    fw: 1,
    fh: 1,
    power: -12,
    weapons: [],
    interceptRange: 9,
    interceptMag: 12,
    interceptReload: 0.75,
    interceptMuzzleOffset: 21.5,
    sprite: "u.interceptor2",
    turretSprite: "tur.interceptor2",
    sound: "bld-cannonturret"
  },
  /**
   * The sandbag line: a tile of wall, and the cheapest hit points in the
   * game. It stands across a chokepoint so a column has to go round it or
   * shoot through it (`acquireTarget` puts it last on every gun's list, so
   * an attacker grinds through it only when nothing else is in reach), and
   * every tile laid beside another joins it — the sixteen joints are the
   * sheet's frames, picked off the neighbours (`game/walls.ts`). It has no
   * gun, draws no power (so a pulse leaves it standing), takes no
   * production slot, is built on the ground its headquarters hold like any
   * building, and comes down without a charge (`raze`). Structure armour:
   * a shell or a bomb takes it apart, small arms barely scratch it, which
   * is the point of stacking bags in front of a gun.
   */
  sandbag: {
    id: "sandbag",
    kind: "building",
    domain: "none",
    tier: 1,
    wall: true,
    cost: 40,
    buildTime: 4,
    pop: 0,
    hp: 500,
    armor: "structure",
    impactMaterial: "earth",
    speed: 0,
    turnRate: 0,
    vision: 3,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    sprite: "u.sandbag"
  },
  landmine: {
    id: "landmine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "light",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    weapons: [w({
      id: "mineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ground"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0.1, ship: 0 }
    })],
    sprite: "u.landmine"
  },
  watermine: {
    id: "watermine",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 60,
    buildTime: 4,
    pop: 0,
    hp: 45,
    armor: "ship",
    speed: 0,
    turnRate: 0,
    vision: 0,
    radius: 6,
    fw: 1,
    fh: 1,
    mine: 3,
    stealth: 0.5,
    offshore: true,
    weapons: [w({
      id: "navalmineblast",
      cls: "he",
      dmg: 200,
      reload: 1,
      range: 0.65,
      projectile: "shell",
      speed: 0,
      splash: 1.5 * 32,
      targets: ["ship", "sub"],
      mult: { light: 1.2, medium: 1, heavy: 0.25, structure: 0, ship: 1, sub: 1, air: 0 }
    })],
    sprite: "u.watermine"
  },
  /**
   * One tile, like a gun pad: a base wants it beside the turret line and at
   * the staging point, and a 2×2 was a footprint that did not fit either.
   */
  repairtower: {
    id: "repairtower",
    kind: "building",
    domain: "none",
    tier: 1,
    cost: 360,
    buildTime: 20,
    pop: 0,
    hp: 750,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 14,
    fw: 1,
    fh: 1,
    weapons: [],
    power: -8,
    repairRange: 5.5,
    repairRate: 20,
    repairTargets: 3,
    sprite: "u.repairtower"
  },
  /**
   * The radar lifts the fog for 24 tiles round it — three times a turret's
   * sight and the largest circle in the game, so one in the base shows the
   * whole approach and every gun and battery inside the circle fires at
   * what it could never see for itself. Short of power it falls back to a
   * turret's sight (`updateFog`).
   */
  radar: {
    id: "radar",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 400,
    buildTime: 20,
    pop: 0,
    hp: 800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 24,
    radius: 30,
    fw: 2,
    fh: 2,
    // and it sees through stealth: a Wraith is visible within 8 tiles of it
    weapons: [],
    power: -8,
    detect: 8,
    radar: true,
    sprite: "u.radar",
    turretSprite: "tur.radar",
    turretSpins: true
  },
  /**
   * The War Lab researches the tech tree (`game/tech.ts`): the doctrine a
   * faction fights by, the units and abilities it unlocks, and the economy
   * buffs any doctrine may take. One a faction (`unique`); what it has
   * researched stays researched when it falls, and only the head of its
   * queue is lost. A Tier-1 building, since the doctrine is a minute-three
   * decision; it draws a plant's worth of power, so the research is slowed
   * by a shortage as a factory's work is.
   */
  warlab: {
    id: "warlab",
    kind: "building",
    domain: "none",
    tier: 1,
    unique: true,
    lab: true,
    cost: 500,
    buildTime: 30,
    pop: 0,
    hp: 1200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -10,
    sprite: "u.warlab",
    sound: "bld-radar"
  },
  veil: {
    id: "veil",
    kind: "building",
    domain: "none",
    tier: 2,
    cost: 600,
    buildTime: 35,
    pop: 0,
    hp: 900,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -20,
    requires: ["radar"],
    jamRange: 8,
    sprite: "u.veil",
    turretSprite: "tur.veil",
    turretSpins: true
  },
  /**
   * The reactor breeds the cores a warhead is built round: with a radar it is
   * what a silo needs to be built, and what a silo or a submarine needs to
   * fabricate and fire. It feeds the grid as well, though dearer per unit of
   * power than the plant line, which it does not replace.
   */
  reactor: {
    id: "reactor",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1400,
    buildTime: 60,
    pop: 0,
    hp: 2200,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 6,
    radius: 44,
    fw: 3,
    fh: 3,
    weapons: [],
    power: 100,
    requires: ["radar"],
    sprite: "u.reactor",
    sound: "bld-extractor2"
  },
  /**
   * A silo the way one is in the ground: two tiles of concrete over one
   * shaft, a hatch that takes `hatch` seconds to slide open before the
   * warhead leaves (`Game.tickHatch`), and three warheads in the magazine.
   */
  nukesilo: {
    id: "nukesilo",
    kind: "building",
    domain: "none",
    tier: 3,
    cost: 1800,
    buildTime: 75,
    pop: 0,
    hp: 1800,
    armor: "structure",
    speed: 0,
    turnRate: 0,
    vision: 7,
    radius: 30,
    fw: 2,
    fh: 2,
    weapons: [],
    power: -40,
    requires: ["radar", "reactor", "nuclearProgram"],
    nukeCapacity: 3,
    nukeCost: 2500,
    nukeTime: 180,
    hatch: 1.2,
    sprite: "u.nukesilo",
    sound: "bld-extractor2"
  }
};
const ALL_DEF_IDS = Object.keys(DEFS);
const VANILLA_DEF_IDS = new Set(ALL_DEF_IDS);
function getDef(id2) {
  const d = DEFS[id2];
  if (!d) throw new Error(`unknown def: ${id2}`);
  return d;
}
const MAX_PLAYERS = 8;
const MIN_MAP_SIDE = 16;
const MAX_MAP_SIDE = 512;
var Terrain = /* @__PURE__ */ ((Terrain2) => {
  Terrain2[Terrain2["DeepWater"] = 0] = "DeepWater";
  Terrain2[Terrain2["Water"] = 1] = "Water";
  Terrain2[Terrain2["Sand"] = 2] = "Sand";
  Terrain2[Terrain2["Grass"] = 3] = "Grass";
  Terrain2[Terrain2["Forest"] = 4] = "Forest";
  Terrain2[Terrain2["Mountain"] = 5] = "Mountain";
  Terrain2[Terrain2["Road"] = 6] = "Road";
  Terrain2[Terrain2["Mud"] = 7] = "Mud";
  Terrain2[Terrain2["Marsh"] = 8] = "Marsh";
  Terrain2[Terrain2["Snow"] = 9] = "Snow";
  Terrain2[Terrain2["Rubble"] = 10] = "Rubble";
  Terrain2[Terrain2["Lava"] = 11] = "Lava";
  Terrain2[Terrain2["CliffNorth"] = 12] = "CliffNorth";
  Terrain2[Terrain2["CliffEast"] = 13] = "CliffEast";
  Terrain2[Terrain2["CliffSouth"] = 14] = "CliffSouth";
  Terrain2[Terrain2["CliffWest"] = 15] = "CliffWest";
  Terrain2[Terrain2["City"] = 16] = "City";
  Terrain2[Terrain2["Shallows"] = 17] = "Shallows";
  Terrain2[Terrain2["Ice"] = 18] = "Ice";
  Terrain2[Terrain2["Bridge"] = 19] = "Bridge";
  return Terrain2;
})(Terrain || {});
const TERRAIN_KINDS = 20;
({
  /** open pasture — the generator's old, and still most common, ground */
  meadow: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** conifer country: the same ground under a much lower treeline */
  boreal: { ground: Terrain.Grass, shore: Terrain.Sand, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** frozen open ground, snow all the way to the water — no beaches this far north */
  tundra: { ground: Terrain.Snow, shore: Terrain.Snow, hollow: Terrain.Mud, height: Terrain.Mountain },
  /** sand from the waterline to the ridges, and nothing growing on it but the palms at an oasis */
  dunes: { ground: Terrain.Sand, shore: Terrain.Sand, hollow: Terrain.Sand, height: Terrain.Mountain },
  /** waterlogged lowland: marsh for a shore and marsh again behind it */
  fen: { ground: Terrain.Grass, shore: Terrain.Marsh, hollow: Terrain.Marsh, height: Terrain.Mountain },
  /** ash flats over old flows, scree at the water and lava in the peaks */
  ashland: { ground: Terrain.Sand, shore: Terrain.Rubble, hollow: Terrain.Rubble, height: Terrain.Lava }
});
function mapUnitRect(u) {
  const def = getDef(u.id);
  return def.kind === "building" ? { x: u.x, y: u.y, fw: def.fw ?? 1, fh: def.fh ?? 1 } : { x: u.x, y: u.y, fw: 1, fh: 1 };
}
function normalizeTerrainLayers(m) {
  for (let i = 0; i < m.terrain.length; i++) if (m.terrain[i] === Terrain.Bridge) {
    (m.overlays ??= new Uint8Array(m.w * m.h))[i] = Terrain.Bridge;
    m.terrain[i] = Terrain.Water;
  }
}
const DECOR = {
  pole: { fw: 1, fh: 1, sprite: "d.pole", color: [96, 78, 58], hp: 20, shadow: 6 },
  tower: { fw: 1, fh: 1, sprite: "d.tower", color: [76, 80, 86], hp: 90, shadow: 14 },
  /** a date palm: the one tree that stands on sand, an obstacle a tile wide; three drawings, mixed */
  palm: { fw: 1, fh: 1, sprite: "d.palm", color: [86, 120, 60], hp: 40, variants: 3, shadow: 9 },
  /** a canvas field tent, sandbagged: the camp round a staging post */
  tent: { fw: 2, fh: 2, sprite: "d.tent", color: [128, 116, 84], hp: 90 },
  /** an arched aircraft shelter of concrete: what an airfield keeps beside its strip */
  hangar: { fw: 3, fh: 2, sprite: "d.hangar", color: [112, 108, 100], hp: 260 },
  /** a concrete bunker, half buried, the firing slit facing south */
  bunker: { fw: 2, fh: 2, sprite: "d.bunker", color: [98, 94, 86], hp: 340 },
  /**
   * A cargo ship going down by the stern, the bow still up and the boxes
   * sliding off her deck: what the open sea is dressed with. Four tiles long
   * and two across, lying north to south with the bow to the north; a hull,
   * so it takes a broadside to finish, and what finishes it is the sea
   * (`razeDecor`). The wash round her is the renderer's (the idle ripple a
   * ship at rest gets, `render/trails.ts`), not the sheet's.
   */
  freighter: { fw: 2, fh: 4, sprite: "d.freighter", water: true, color: [96, 60, 44], hp: 320 },
  /**
   * The same wreck lying east to west, the bow to the west: a kind of its own
   * rather than a variant, since a variant shares its kind's footprint and
   * this one is the footprint turned. Two on a map, one each way, and the
   * sea stops looking stamped.
   */
  freighter2: { fw: 4, fh: 2, sprite: "d.freighter2", water: true, color: [96, 60, 44], hp: 320 }
};
const RETIRED_DECOR = ["derrick"];
function isDecorKind(k) {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(DECOR, k);
}
function rleEncode(a) {
  const out = [];
  let i = 0;
  while (i < a.length) {
    const v = a[i];
    let run = 1;
    while (i + run < a.length && a[i + run] === v && run < 255) run++;
    out.push(run, v);
    i += run;
  }
  let s = "";
  for (let k = 0; k < out.length; k += 4096) {
    s += String.fromCharCode(...out.slice(k, k + 4096));
  }
  return btoa(s);
}
function rleDecode(s, len) {
  return rleDecodeInto(s, new Uint8Array(len));
}
function rleDecodeInto(s, out) {
  const len = out.length;
  if (!s) {
    out.fill(0);
    return out;
  }
  const raw = atob(s);
  let oi = 0;
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const run = raw.charCodeAt(i);
    const v = raw.charCodeAt(i + 1);
    out.fill(v, oi, Math.min(len, oi + run));
    oi += run;
  }
  if (oi < len) out.fill(0, oi);
  return out;
}
const TERRAIN_BASES = Object.freeze({
  grass: Terrain.Grass,
  sand: Terrain.Sand,
  road: Terrain.Road,
  mud: Terrain.Mud,
  marsh: Terrain.Marsh,
  snow: Terrain.Snow,
  rubble: Terrain.Rubble,
  ice: Terrain.Ice,
  city: Terrain.City
});
const CITY_FORMS = ["slab", "court", "terrace", "stepped"];
const VARIANT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
function readTerrainAssignments(value, path, issues) {
  if (value === void 0) return void 0;
  const start = issues.length;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push({ path, message: "must be an object of terrain base → variant id" });
    return void 0;
  }
  const entries = Object.entries(value);
  if (entries.length > Object.keys(TERRAIN_BASES).length) {
    issues.push({ path, message: `at most ${Object.keys(TERRAIN_BASES).length} terrain bindings` });
    return void 0;
  }
  const out = {};
  for (const [base, id2] of entries) {
    if (!Object.hasOwn(TERRAIN_BASES, base)) issues.push({ path: `${path}.${base}`, message: "unsupported terrain base" });
    else if (typeof id2 !== "string" || !VARIANT_ID_RE.test(id2) || !id2.includes("-"))
      issues.push({ path: `${path}.${base}`, message: "must be a namespaced terrain variant id, 2–40 characters" });
    else out[base] = id2;
  }
  return issues.length === start && entries.length > 0 ? out : void 0;
}
const CUSTOM_MAP_FORMAT = "steel-tide-map";
const CUSTOM_MAP_VERSION = 1;
const MAX_DEPOSITS = 400;
const MAX_DECOR = 4e3;
const MAX_MAP_UNITS = 400;
const MAX_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 240;
const MAP_LANG_RE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const MAX_TRANSLATIONS = 16;
function isMapUnitId(id2, only) {
  return (only ? only.has(id2) : id2 in DEFS) && !DEFS[id2]?.warhead;
}
function readDecor(list, w2, h) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad props";
  if (list.length > MAX_DECOR) return "too many props";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad props";
    const { kind, x, y } = item;
    if (typeof kind === "string" && RETIRED_DECOR.includes(kind)) continue;
    if (!isDecorKind(kind)) return "the map uses a prop this build does not know";
    const def = DECOR[kind];
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + def.fw > w2 || y + def.fh > h) {
      return "a prop lies outside the map";
    }
    const tx = x, ty = y;
    let free = true;
    for (let yy = ty; yy < ty + def.fh && free; yy++) {
      for (let xx = tx; xx < tx + def.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = ty; yy < ty + def.fh; yy++) for (let xx = tx; xx < tx + def.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ kind, x: tx, y: ty });
  }
  return out;
}
function readUnits(list, w2, h, only) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) return "bad units";
  if (list.length > MAX_MAP_UNITS) return "too many units";
  const taken = new Uint8Array(w2 * h);
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") return "bad units";
    const { id: id2, owner, x, y, a } = item;
    if (typeof id2 !== "string" || !isMapUnitId(id2, only)) return "the map stands a unit this build does not know";
    if (!Number.isInteger(owner) || owner < 0 || owner >= MAX_PLAYERS) return "a unit belongs to no faction";
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "bad units";
    const r = mapUnitRect({ id: id2, x, y });
    if (r.x < 0 || r.y < 0 || r.x + r.fw > w2 || r.y + r.fh > h) return "a unit lies outside the map";
    let facing;
    if (a !== void 0 && DEFS[id2].kind === "unit") {
      if (!Number.isInteger(a) || a < 0 || a >= 360) return "bad units";
      facing = a;
    }
    let free = true;
    for (let yy = r.y; yy < r.y + r.fh && free; yy++) {
      for (let xx = r.x; xx < r.x + r.fw; xx++) if (taken[yy * w2 + xx]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    for (let yy = r.y; yy < r.y + r.fh; yy++) for (let xx = r.x; xx < r.x + r.fw; xx++) taken[yy * w2 + xx] = 1;
    out.push({ id: id2, owner, x: r.x, y: r.y, ...facing !== void 0 ? { a: facing } : {} });
  }
  return out;
}
function cleanLine(name) {
  return name.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}
function cleanName(name) {
  return cleanLine(name) || "Untitled";
}
function cleanDescription(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_LENGTH);
}
function cleanTranslations(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return void 0;
  const out = {};
  let n = 0;
  for (const [key, given] of Object.entries(v)) {
    const lang = key.toLowerCase();
    if (!MAP_LANG_RE.test(lang) || lang in out || !given || typeof given !== "object") continue;
    const { name, description } = given;
    const text = {};
    const line = typeof name === "string" ? cleanLine(name) : "";
    if (line) text.name = line;
    const blurb = typeof description === "string" ? cleanDescription(description) : "";
    if (blurb) text.description = blurb;
    if (!text.name && !text.description) continue;
    if (++n > MAX_TRANSLATIONS) break;
    out[lang] = text;
  }
  return n ? out : void 0;
}
function parseCustomMap(json, opts = {}) {
  if (typeof json !== "string" || json.length === 0 || json.length > 4 * 1024 * 1024) {
    return { ok: false, error: "the file is empty or too large" };
  }
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "not a map file" };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "not a map file" };
  const r = raw;
  if (r.format !== CUSTOM_MAP_FORMAT) return { ok: false, error: "not a Steel Tide map" };
  if (r.v !== CUSTOM_MAP_VERSION) return { ok: false, error: `unsupported map version ${String(r.v)}` };
  if (!Number.isInteger(r.w) || !Number.isInteger(r.h) || r.w < MIN_MAP_SIDE || r.h < MIN_MAP_SIDE || r.w > MAX_MAP_SIDE || r.h > MAX_MAP_SIDE) {
    return { ok: false, error: `the map must be ${MIN_MAP_SIDE}–${MAX_MAP_SIDE} tiles a side` };
  }
  const w2 = r.w, h = r.h;
  if (typeof r.terrain !== "string" || r.terrain.length > 2 * 1024 * 1024) return { ok: false, error: "bad terrain data" };
  let terrain;
  try {
    terrain = rleDecode(r.terrain, w2 * h);
  } catch {
    return { ok: false, error: "bad terrain data" };
  }
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] >= TERRAIN_KINDS) return { ok: false, error: "the map uses a terrain this build does not know" };
  }
  const variantIssues = [];
  const terrainVariants = readTerrainAssignments(r.terrainVariants, "terrainVariants", variantIssues);
  if (variantIssues.length) return { ok: false, error: `${variantIssues[0].path}: ${variantIssues[0].message}` };
  let overlays;
  if (r.overlays !== void 0) {
    if (typeof r.overlays !== "string") return { ok: false, error: "bad overlay data" };
    try {
      overlays = rleDecode(r.overlays, w2 * h);
    } catch {
      return { ok: false, error: "bad overlay data" };
    }
    if (overlays.some((t) => t !== 0 && t !== Terrain.Bridge)) return { ok: false, error: "the map uses an overlay this build does not know" };
  }
  const layers = { w: w2, h, terrain, overlays };
  normalizeTerrainLayers(layers);
  overlays = layers.overlays;
  const points = (list, max, what) => {
    if (list === void 0) return [];
    if (!Array.isArray(list)) return `bad ${what}`;
    if (list.length > max) return `too many ${what}`;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const p of list) {
      if (!p || typeof p !== "object") return `bad ${what}`;
      const { x, y } = p;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= w2 || y >= h) {
        return `a ${what.replace(/s$/, "")} lies outside the map`;
      }
      const key = y * w2 + x;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ x, y });
    }
    return out;
  };
  const deposits = points(r.deposits, MAX_DEPOSITS, "deposits");
  if (typeof deposits === "string") return { ok: false, error: deposits };
  const spawns = points(r.spawns, MAX_PLAYERS, "spawns");
  if (typeof spawns === "string") return { ok: false, error: spawns };
  const decor = readDecor(r.decor, w2, h);
  if (typeof decor === "string") return { ok: false, error: decor };
  const units = readUnits(r.units, w2, h, opts.only);
  if (typeof units === "string") return { ok: false, error: units };
  const description = cleanDescription(typeof r.description === "string" ? r.description : "");
  const translations = cleanTranslations(r.translations);
  const author = typeof r.author === "string" ? cleanLine(r.author) : "";
  return {
    ok: true,
    data: {
      format: CUSTOM_MAP_FORMAT,
      v: CUSTOM_MAP_VERSION,
      name: cleanName(typeof r.name === "string" ? r.name : ""),
      ...author ? { author } : {},
      ...description ? { description } : {},
      ...translations ? { translations } : {},
      w: w2,
      h,
      terrain: rleEncode(terrain),
      ...terrainVariants ? { terrainVariants } : {},
      ...overlays?.some(Boolean) ? { overlays: rleEncode(overlays) } : {},
      deposits,
      spawns,
      ...decor.length ? { decor } : {},
      ...units.length ? { units } : {}
    }
  };
}
const MENU_CUT_IDS = ["flank", "sea", "winter", "raid", "landing", "rockets", "home", "nuke"];
const MAX_MENU_CUTS = 16;
const MAX_MENU_QUEUE = 32;
const MAX_MENU_MAP_SIDE = 128;
const CONTENT_MUSIC_SLOTS = ["menu", "setup", "battle"];
const MUSIC_FILES = {
  menu: ["menu", "glassline-drive"],
  setup: ["setup", "cold-front"],
  // the two the result plate stands on, held under it for as long as it is
  // up (`MUSIC_LOOP`): the match is over, so there is nothing for a gap
  // between files to make room for
  victory: ["victory"],
  defeat: ["defeat"],
  battle: [
    "battle-1",
    "battle-2",
    "assembly-gears",
    "disciplined-unease",
    "methodical-calm",
    "iron-standard",
    "danger-close",
    "dead-reckoning",
    "zero-hour",
    "stand-to",
    "stand-down"
  ]
};
const MUSIC_IDS = new Set(Object.values(MUSIC_FILES).flat());
function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  const seen = /* @__PURE__ */ new Map();
  const clone = (entry) => {
    if (typeof entry === "function" || typeof entry === "symbol") {
      throw new DOMException("Game data cannot contain functions or symbols", "DataCloneError");
    }
    if (entry === null || typeof entry !== "object") return entry;
    if (seen.has(entry)) return seen.get(entry);
    const array = Array.isArray(entry);
    if (!array && Object.prototype.toString.call(entry) !== "[object Object]") {
      throw new DOMException("Game data must contain records and arrays", "DataCloneError");
    }
    const copy = array ? new Array(entry.length) : {};
    seen.set(entry, copy);
    for (const key of Object.keys(entry)) {
      Object.defineProperty(copy, key, {
        value: clone(entry[key]),
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    return copy;
  };
  return clone(value);
}
const LANGS = ["en", "zh", "ko"];
function langIndex(l) {
  return LANGS.indexOf(l);
}
const ABILITIES = {
  /** the governor off and the throttle to the stop — the Recon Buggy, born with it */
  sprint: { id: "sprint", cooldown: 20, duration: 4, speedMul: 1.6, sound: "abSprint" },
  /** reheat: a fighter's dash to a fight or out of one; the turning circle opens with the speed */
  afterburner: { id: "afterburner", cooldown: 30, duration: 5, speedMul: 1.8, requires: ["afterburners"], sound: "abAfterburner" },
  /** grenade dischargers: a cloud round the hull that nothing outside it sees into */
  smoke: { id: "smoke", cooldown: 40, duration: 8, smoke: 2.5, requires: ["smokeDischargers"], sound: "abSmoke" },
  /** the bomb bay loaded with incendiaries for the next run */
  incendiary: { id: "incendiary", cooldown: 45, duration: 30, incendiary: true, requires: ["incendiaryBombs"], sound: "abArm" },
  /** the crew at the guns flat out: every reload halved */
  barrage: { id: "barrage", cooldown: 45, duration: 8, reloadMul: 0.5, requires: ["rapidBarrage"], sound: "abArm" },
  /**
   * A tank's two protections switched on together, the Trophy and the
   * Kontakt-5: the hard-kill launchers take three missiles or rockets out of
   * the air at the hull, and the reactive bricks take four tenths off every
   * shell that lands. It fights on the move; nothing is dropped.
   */
  countermeasures: {
    id: "countermeasures",
    cooldown: 40,
    duration: 10,
    takenMul: 0.6,
    takenFrom: ["shell"],
    intercepts: 3,
    interceptReach: 1.5,
    beacon: true,
    requires: ["activeProtection"],
    sound: "abCountermeasures"
  },
  /** the damage control parties at work: fires out, holes plugged */
  damageControl: { id: "damageControl", cooldown: 60, duration: 10, heal: 0.3, requires: ["damageParties"], sound: "abRepair" },
  /** every crew of the recovery vehicle at the wrecks at once — the Hercules, born with it */
  emergencyRepair: { id: "emergencyRepair", cooldown: 30, duration: 6, auraMul: 3, sound: "abRepair" }
};
const ABILITY_IDS = Object.keys(ABILITIES);
const TECH = {
  // ---- Lightning: speed, the raid, the air
  lightning: { id: "lightning", branch: "lightning", pick: true, cost: 300, time: 30, buff: { stat: "speed", mul: 1.08, kind: "unit" } },
  smokeDischargers: { id: "smokeDischargers", branch: "lightning", cost: 450, time: 40 },
  suicideDrones: { id: "suicideDrones", branch: "lightning", cost: 600, time: 45 },
  afterburners: { id: "afterburners", branch: "lightning", requires: ["radar"], cost: 700, time: 50 },
  // ---- Hammer: firepower, the siege, the bomb
  hammer: { id: "hammer", branch: "hammer", pick: true, cost: 300, time: 30, buff: { stat: "dmg", mul: 1.1, cls: ["he", "rocket"] } },
  incendiaryBombs: { id: "incendiaryBombs", branch: "hammer", cost: 450, time: 40 },
  ballisticMissiles: { id: "ballisticMissiles", branch: "hammer", cost: 600, time: 45 },
  rapidBarrage: { id: "rapidBarrage", branch: "hammer", requires: ["radar"], cost: 700, time: 50 },
  // ---- Anvil: endurance, the hold, the repair
  anvil: { id: "anvil", branch: "anvil", pick: true, cost: 300, time: 30, buff: { stat: "taken", mul: 0.85, kind: "building" } },
  activeProtection: { id: "activeProtection", branch: "anvil", cost: 450, time: 40 },
  fieldRecovery: { id: "fieldRecovery", branch: "anvil", cost: 600, time: 45 },
  damageParties: { id: "damageParties", branch: "anvil", requires: ["radar"], cost: 700, time: 50 },
  // ---- Logistics: any doctrine, any order
  deepDrilling: { id: "deepDrilling", cost: 500, time: 40, buff: { stat: "mine", mul: 1.15 } },
  gridTuning: { id: "gridTuning", cost: 450, time: 40, buff: { stat: "plant", mul: 1.2 } },
  fieldEngineering: { id: "fieldEngineering", cost: 350, time: 30, buff: { stat: "build", mul: 1.3 } },
  // ---- the last node, any doctrine's, behind its whole column
  nuclearProgram: { id: "nuclearProgram", final: true, gates: true, cost: 1e3, time: 60 }
};
function isTechId(id2) {
  return Object.prototype.hasOwnProperty.call(TECH, id2);
}
const RULE_EVENTS = ["created", "destroyed", "fired", "damaged", "kill", "morphed"];
const MAX_DEF_RULES = 24;
const MAX_RULE_EFFECTS = 8;
const MAX_DEF_BUTTONS = 8;
const RULE_SOUNDS = ["expl", "explBig", "upgrade"];
const VANILLA_FX = [
  "fx.expl.s",
  "fx.expl.m",
  "fx.expl.l",
  "fx.spark",
  "fx.flak",
  "fx.smoke",
  "fx.splash",
  "fx.splash.l",
  "fx.muzzle",
  "fx.repair",
  "fx.emp",
  "fx.nuke"
];
const RULE_SPECS = [
  { name: "on", type: "enum", values: RULE_EVENTS, doc: [
    "runs when this happens to it: made (`created`, and when a map stands it), killed (`destroyed`, where it fell), a shot fired (`fired`), hurt (`damaged`), a kill made (`kill`), or a change of form finished (`morphed`)",
    "在发生这些事时执行：被造出（`created`，地图上预置的也算）、被摧毁（`destroyed`，在倒下的地方）、开火（`fired`）、受伤（`damaged`）、击杀（`kill`）、变形完成（`morphed`）"
  ] },
  { name: "when", type: "cond", doc: [
    "runs when this condition becomes true, and again only after it has been false (see Conditions)",
    "当此条件变为成立时执行；须先变回不成立才会再次触发（见“条件”）"
  ] },
  { name: "every", type: "number", min: 0.25, max: 3600, doc: [
    "runs every so many seconds of its life",
    "在存活期间每隔若干秒执行一次"
  ] },
  { name: "button", type: "button", doc: [
    "a button on its card the player presses (see Buttons)",
    "卡片上由玩家按下的按钮（见“按钮”）"
  ] },
  { name: "if", type: "cond", doc: [
    "also checked when triggered: the rule runs only if this holds too; on a button, the button is greyed while it does not",
    "触发时同时检查：仅当它也成立时才执行；用于按钮时，不成立则按钮置灰"
  ] },
  { name: "chance", type: "number", min: 0, max: 1, def: "1", doc: ["the odds it runs when triggered", "触发时执行的概率"] },
  { name: "cooldown", type: "number", min: 0, max: 3600, doc: ["seconds before it may run again", "再次执行前的冷却秒数"] },
  { name: "max", type: "int", min: 1, max: 1e3, doc: ["times it may run on one unit, ever", "同一单位上最多执行的次数"] },
  { name: "do", type: "effects", required: true, doc: [
    `what it does: an effect or a list of up to ${MAX_RULE_EFFECTS}, in order (see Effects)`,
    `执行的效果：一个效果或最多 ${MAX_RULE_EFFECTS} 个效果的列表，依次执行（见“效果”）`
  ] }
];
const COND_SPECS = [
  { name: "moving", type: "bool", doc: ["is driving, flying or swimming (true) or standing (false)", "正在移动（true）或静止（false）"] },
  { name: "still", type: "number", min: 0, max: 3600, doc: ["has not moved for at least this many seconds", "已静止至少这么多秒"] },
  { name: "firedWithin", type: "number", min: 0, max: 3600, doc: ["fired within the last so many seconds", "最近这么多秒内开过火"] },
  { name: "quiet", type: "number", min: 0, max: 3600, doc: ["has not fired for at least this many seconds", "已至少这么多秒没有开火"] },
  { name: "hurtWithin", type: "number", min: 0, max: 3600, doc: ["was hurt within the last so many seconds", "最近这么多秒内受过伤"] },
  { name: "hpBelow", type: "number", min: 0, max: 1, doc: ["health below this share of its whole", "生命低于总量的此比例"] },
  { name: "hpAbove", type: "number", min: 0, max: 1, doc: ["health above this share of its whole", "生命高于总量的此比例"] },
  { name: "age", type: "number", min: 0, max: 36e3, doc: ["seconds since it was made, or last changed form", "自被造出或上次变形以来的秒数"] },
  { name: "flag", type: "string", max: 32, doc: ["a flag a rule has set on it is up", "规则设置的某个标记为开"] },
  { name: "noFlag", type: "string", max: 32, doc: ["that flag is down", "该标记为关"] },
  { name: "kills", type: "int", min: 0, max: 1e4, doc: ["it has made at least this many kills", "击杀数至少为此"] },
  { name: "rank", type: "int", min: 1, max: 3, doc: ["its veteran rank is at least this", "老兵等级至少为此"] },
  { name: "onWater", type: "bool", doc: ["stands on water (true) or on land (false)", "位于水面（true）或陆地（false）"] },
  { name: "enemyWithin", type: "number", min: 0.5, max: 32, doc: ["an enemy its side can see is within this many tiles", "己方可见的敌人在此格数之内"] },
  { name: "near", type: "near", doc: ["others stand near it: at least `count` of these `units` or this `kind`, on this `side`, `within` so many tiles (see Near)", "附近有其他单位：`within` 格之内至少有 `count` 个属于 `side` 一方的 `units` 或 `kind`（见“附近”）"] },
  { name: "night", type: "bool", doc: ["it is night (true) or day (false)", "是夜晚（true）或白天（false）"] },
  { name: "carrying", type: "int", min: 1, max: 50, doc: ["has at least this many units in its hold", "载有至少这么多单位"] },
  { name: "killedBy", type: "ids", doc: ["on `destroyed`: what killed it was one of these defs (the dead rise only when the dead killed them)", "用于 `destroyed`：击杀它的是这些定义之一（只有被丧尸杀死的才会尸变）"] },
  { name: "any", type: "cond", doc: ["a list of conditions, one of which must hold", "条件列表，其中任一成立即可"] },
  { name: "not", type: "cond", doc: ["a condition that must not hold", "必须不成立的条件"] }
];
const EFFECT_SPECS = [
  { name: "morph", type: "id", doc: [
    "become another def of this mod, in place: the same unit (its selection, its kills and rank, the orders the new form can carry out), its health keeping its share of the whole. A building only takes the form of a building of the same footprint",
    "原地变为本模组的另一个定义：仍是同一个单位（选中状态、击杀与等级、新形态能执行的命令都保留），生命值按比例保留。建筑只能变为占地相同的建筑"
  ] },
  { name: "spawn", type: "spawn", doc: ["units put down beside it, or into its hold (see Spawn)", "在其旁边或其载舱内生成单位（见“生成”）"] },
  { name: "heal", type: "number", min: -1e6, max: 1e6, doc: ["hit points given back; negative takes them, never the last one", "回复的生命值；负数为扣除，但不会致死"] },
  { name: "healPct", type: "number", min: -1, max: 1, doc: ["a share of its whole health given back", "按总生命比例回复"] },
  { name: "metal", type: "number", min: -99999, max: 99999, doc: ["metal to its side; negative takes it, never below nothing", "给予己方的金属；负数为扣除，最低为零"] },
  { name: "flag", type: "string", max: 32, doc: ["raise a flag on it, for a condition to read", "设置一个标记，供条件读取"] },
  { name: "unflag", type: "string", max: 32, doc: ["lower that flag", "清除该标记"] },
  { name: "buff", type: "buff", doc: [
    "multipliers held for `for` seconds: `speed`, the `damage` it deals, its `reload` time, and the harm it is `taken`; a new buff replaces the one it has",
    "持续 `for` 秒的倍率：`speed` 速度、`damage` 造成伤害、`reload` 装填时间、`taken` 承受伤害；新的增益会替换旧的"
  ] },
  { name: "explode", type: "explode", doc: [
    "a blast round it: `dmg` at the centre falling to half at the edge of `radius` (world px), through the armour row of `cls` (default he); its own side is spared unless `friendlyFire`",
    "以自身为中心爆炸：中心伤害 `dmg`，在 `radius`（世界像素）边缘降为一半，按 `cls`（默认 he）的装甲倍率计算；除非 `friendlyFire`，否则不伤己方"
  ] },
  { name: "fx", type: "string", max: 48, doc: [`an effect played where it stands: one of this mod's \`fx.<name>\` sheets, or ${VANILLA_FX.join(", ")}`, `在其位置播放的特效：本模组的 \`fx.<名字>\` 精灵图，或 ${VANILLA_FX.join("、")}`] },
  { name: "fxScale", type: "number", min: 0.05, max: 8, def: "1", doc: ["the effect drawn at this multiple", "特效的缩放倍数"] },
  { name: "sound", type: "string", max: 64, doc: ["a sound played where it stands: a weapon sound, expl, explBig, upgrade, or one of this mod's `sounds`", "在其位置播放的声音：武器音效、expl、explBig、upgrade，或本模组的 `sounds`"] },
  { name: "die", type: "bool", doc: ["it is destroyed, as if killed by nobody (its own `destroyed` rules run)", "被摧毁，如同无人击杀（其 `destroyed` 规则会执行）"] },
  { name: "remove", type: "bool", doc: ["it is gone without a trace: no wreck, no loss, no `destroyed`", "无痕消失：没有残骸、不计损失、不触发 `destroyed`"] }
];
const NEAR_SPECS = [
  { name: "units", type: "ids", doc: ["these defs only: the game's or any mod's", "仅限这些定义：原版或任何模组的"] },
  { name: "kind", type: "enum", values: ["unit", "building"], doc: ["only units, or only buildings", "仅限单位，或仅限建筑"] },
  { name: "side", type: "enum", values: ["friend", "enemy", "any"], def: "any", doc: ["whose: its own side and its allies (`friend`), an enemy's (only what its side can see), or anyone's", "归属：己方及盟友（`friend`）、敌方（仅限己方可见的），或任何一方"] },
  { name: "within", type: "number", min: 0.5, max: 32, required: true, doc: ["tiles from it to the other's edge", "从它到对方边缘的格数"] },
  { name: "count", type: "int", min: 1, max: 50, def: "1", doc: ["at least this many", "至少这么多个"] }
];
const SPAWN_SPECS = [
  { name: "unit", type: "id", required: true, doc: ["the unit: one of the game's or this mod's", "生成的单位：原版或本模组的"] },
  { name: "count", type: "int", min: 1, max: 16, def: "1", doc: ["how many", "数量"] },
  { name: "side", type: "enum", values: ["own", "killer"], def: "own", doc: ["whose they are: its own side's, or (on `destroyed`) the side that killed it", "归属：己方，或（在 `destroyed` 中）击杀者一方"] },
  { name: "into", type: "enum", values: ["hold"], doc: ["straight into its own hold, as far as the room goes, instead of beside it", "直接放进自身载舱（以剩余空间为限），而不是放在旁边"] },
  { name: "max", type: "int", min: 1, max: 64, doc: ["at most this many of the units this rule has spawned alive at once", "此规则生成的单位同时存活的上限"] }
];
const BUTTON_SPECS = [
  { name: "name", type: "text", def: "the form it makes", doc: ["the button's label", "按钮名称"] },
  { name: "desc", type: "text", doc: ["its tooltip line", "提示中的描述"] },
  { name: "cost", type: "number", min: 0, max: 99999, def: "0", doc: ["metal, paid as the work is done", "金属，随工作进度支付"] },
  { name: "time", type: "number", min: 0, max: 3600, def: "0", doc: ["seconds of work at full power; 0 is at once", "满电力下的工作秒数；0 为立即"] },
  { name: "requires", type: "ids", doc: ["buildings that must stand, or tech nodes researched, for it to be pressed (and to go on)", "按下（及持续进行）所需存在的建筑或已研究的科技"] },
  { name: "ai", type: "bool", doc: ["a computer side presses it too, when it can spare the metal", "电脑一方在有余钱时也会按下它"] }
];
const LOOK_SPECS = [
  { name: "sprite", type: "string", max: 48, doc: ["the round: one of this mod's `prj.<name>` sheets — its frames play as it flies, or, baked `rotated`, it is turned to its heading", "弹药图像：本模组的 `prj.<名字>` 精灵图——飞行时播放其帧；若为 `rotated`，则朝向飞行方向"] },
  { name: "scale", type: "number", min: 0.1, max: 8, def: "1", doc: ["the round and its flash drawn at this multiple", "弹药与枪口焰的缩放倍数"] },
  { name: "beam", type: "beam", doc: [
    "the round is light: `{ color, width, style, life }` — a line from the muzzle to where it strikes, `laser` straight or `lightning` jagged, held `life` seconds; it strikes at once",
    "弹药是光束：`{ color, width, style, life }`——从枪口到命中点的一条线，`laser` 为直线，`lightning` 为闪电折线，持续 `life` 秒；即时命中"
  ] },
  { name: "muzzle", type: "string", max: 48, def: "the class's flash", doc: ["the muzzle flash: one of this mod's `fx.<name>` sheets, or `none`", "枪口焰：本模组的 `fx.<名字>` 精灵图，或 `none`"] },
  { name: "impact", type: "string", max: 48, def: "the class's burst", doc: [`the burst where it lands: an \`fx.<name>\` sheet of this mod, one of ${VANILLA_FX.join(", ")}, or \`none\``, `命中处的爆炸：本模组的 \`fx.<名字>\` 精灵图、${VANILLA_FX.join("、")} 之一，或 \`none\``] },
  { name: "impactScale", type: "number", min: 0.1, max: 8, def: "1", doc: ["the burst drawn at this multiple", "爆炸的缩放倍数"] },
  { name: "impactLife", type: "number", min: 0.05, max: 5, def: "0.5", doc: ["seconds the burst plays over", "爆炸播放的秒数"] },
  { name: "trail", type: "enum", values: ["smoke", "none"], def: "smoke", doc: ["a rocket's or a missile's smoke trail, or none", "火箭或导弹的尾烟，或无"] }
];
const SHIELD_SPECS = [
  { name: "hp", type: "number", min: 1, max: 1e6, required: true, doc: ["what it takes before the hull does", "在船体受损前可吸收的伤害"] },
  { name: "regen", type: "number", min: 0, max: 1e5, def: "0", doc: ["recharged a second", "每秒恢复量"] },
  { name: "delay", type: "number", min: 0, max: 600, def: "3", doc: ["seconds unhurt before it starts to recharge", "未受伤多少秒后开始恢复"] }
];
const WING_SPECS = [
  { name: "unit", type: "id", required: true, doc: ['the plane: an aircraft of this mod with `"pop": 0` and `"producedBy": []`, made by its carrier alone', '舰载机：本模组的飞行器，须为 `"pop": 0`、`"producedBy": []`，只由母舰制造'] },
  { name: "count", type: "int", min: 1, max: 16, def: "1", doc: ["planes it keeps", "搭载的飞机数"] },
  { name: "rebuild", type: "number", min: 0.5, max: 600, def: "10", doc: ["seconds to make a lost one again, for nothing, one at a time", "损失后多少秒免费补充一架，逐架补充"] },
  { name: "sortie", type: "number", min: 1, max: 600, def: "15", doc: ["seconds a plane stays out before it comes back to rearm", "飞机出击多少秒后返航"] },
  { name: "rearm", type: "number", min: 0, max: 120, def: "3", doc: ["seconds a plane back aboard waits before it flies again, mended as it waits", "返航后多少秒才能再次出击，期间会被修复"] },
  { name: "range", type: "number", min: 1, max: 32, def: "10", doc: ["tiles from the carrier its planes go out to fight", "飞机在离母舰多少格内出击"] }
];
const ANIM_SPECS = [
  { name: "moving", type: "range", doc: ["`[first, last]` frames played while it moves, or `[first, last, fps]`", "移动时播放的帧 `[起, 止]`，或 `[起, 止, fps]`"] },
  { name: "idle", type: "range", def: "frame 0", doc: ["the frames while it stands", "静止时播放的帧"] },
  { name: "firing", type: "range", doc: ["the frames within a reload of its last shot; before moving and idle", "上次开火后一次装填时间内播放的帧；优先于移动与静止"] }
];
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v) => typeof v === "number" && Number.isFinite(v);
function checkRow(row, v, path, errors, ctx) {
  const bad = (message) => {
    errors.push({ path, message });
    return false;
  };
  const lo = row.min ?? -Infinity, hi = row.max ?? Infinity;
  switch (row.type) {
    case "number":
      return num(v) && v >= lo && v <= hi || bad(`must be a number between ${lo} and ${hi}`);
    case "int":
      return Number.isInteger(v) && v >= lo && v <= hi || bad(`must be a whole number between ${lo} and ${hi}`);
    case "bool":
      return typeof v === "boolean" || bad("must be true or false");
    case "enum":
      return typeof v === "string" && row.values.includes(v) || bad(`must be one of ${row.values.join(", ")}`);
    case "string":
      return typeof v === "string" && v.length > 0 && v.length <= (row.max ?? 64) || bad(`must be a string of at most ${row.max ?? 64} characters`);
    case "id":
      return typeof v === "string" && ctx.idRe.test(v) || bad("must be an id");
    case "ids":
      return Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === "string" && ctx.idRe.test(x)) || bad("must be a list of up to 64 ids");
    case "text":
      return ctx.isText(v) || bad("must be text: a string, [en, zh, ko] or { en, zh, ko }");
    default:
      return true;
  }
}
function checkKeys(raw, rows, path, errors) {
  const known = new Set(rows.map((r) => r.name));
  let ok = true;
  for (const k of Object.keys(raw)) {
    if (!known.has(k)) {
      errors.push({ path: `${path}.${k}`, message: `"${k}" is not a word it knows (${[...known].join(", ")})` });
      ok = false;
    }
  }
  return ok;
}
function readCond(raw, path, errors, ctx, depth = 0) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object of conditions" });
    return null;
  }
  if (depth > 3) {
    errors.push({ path, message: "conditions nest at most three deep" });
    return null;
  }
  if (!checkKeys(raw, COND_SPECS, path, errors)) return null;
  if (Object.keys(raw).length === 0) {
    errors.push({ path, message: "names no condition" });
    return null;
  }
  const out = {};
  for (const row of COND_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    if (row.name === "any") {
      if (!Array.isArray(v) || v.length === 0 || v.length > 8) {
        errors.push({ path: p, message: "must be a list of one to eight conditions" });
        return null;
      }
      const list = v.map((c, i) => readCond(c, `${p}[${i}]`, errors, ctx, depth + 1));
      if (list.some((c) => !c)) return null;
      out.any = list;
    } else if (row.name === "not") {
      const c = readCond(v, p, errors, ctx, depth + 1);
      if (!c) return null;
      out.not = c;
    } else if (row.name === "near") {
      const n = readNear(v, p, errors, ctx);
      if (!n) return null;
      out.near = n;
    } else if (checkRow(row, v, p, errors, ctx)) {
      if (row.name === "killedBy") {
        const bad = v.find((id2) => !ctx.find(id2));
        if (bad) {
          errors.push({ path: p, message: `"${bad}" is not a def` });
          return null;
        }
      }
      out[row.name] = v;
    } else return null;
  }
  return out;
}
function readNear(raw, path, errors, ctx) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { units, kind, side, within, count }" });
    return null;
  }
  if (!checkKeys(raw, NEAR_SPECS, path, errors)) return null;
  const out = {};
  for (const row of NEAR_SPECS) {
    const v = raw[row.name];
    const p = `${path}.${row.name}`;
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: p, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, p, errors, ctx)) return null;
    if (row.name === "units") {
      const list = v;
      if (list.length === 0) {
        errors.push({ path: p, message: "names no def" });
        return null;
      }
      const bad = list.find((id2) => !ctx.find(id2));
      if (bad) {
        errors.push({ path: p, message: `"${bad}" is not a def` });
        return null;
      }
    }
    out[row.name] = v;
  }
  return out;
}
function readEffect(raw, path, errors, ctx, rule) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, EFFECT_SPECS, path, errors)) return null;
  if (Object.keys(raw).length === 0) {
    errors.push({ path, message: "does nothing" });
    return null;
  }
  const out = {};
  const me = ctx.def;
  for (const row of EFFECT_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    switch (row.name) {
      case "morph": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        const to = ctx.find(v);
        if (!to || !ctx.ownDef(v)) {
          errors.push({ path: p, message: `"${String(v)}" is not a def of this mod: a unit takes only its own mod's forms` });
          return null;
        }
        if (to.id === me.id) {
          errors.push({ path: p, message: "a def cannot turn into itself" });
          return null;
        }
        if (to.kind !== me.kind) {
          errors.push({ path: p, message: `a ${me.kind} cannot turn into a ${to.kind}` });
          return null;
        }
        if (me.kind === "building" && ((to.fw ?? 2) !== (me.fw ?? 2) || (to.fh ?? 2) !== (me.fh ?? 2))) {
          errors.push({ path: p, message: "a building turns only into one of the same footprint" });
          return null;
        }
        out.morph = to.id;
        break;
      }
      case "spawn": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { unit, count, side, into, max }" });
          return null;
        }
        if (!checkKeys(v, SPAWN_SPECS, p, errors)) return null;
        const sp = {};
        for (const r of SPAWN_SPECS) {
          const x = v[r.name];
          if (x === void 0) {
            if (r.required) {
              errors.push({ path: `${p}.${r.name}`, message: "is required" });
              return null;
            }
            continue;
          }
          if (!checkRow(r, x, `${p}.${r.name}`, errors, ctx)) return null;
          sp[r.name] = x;
        }
        const u = ctx.find(sp.unit);
        if (!u || u.kind !== "unit" || u.warhead) {
          errors.push({ path: `${p}.unit`, message: `"${String(sp.unit)}" is not a unit it can spawn` });
          return null;
        }
        if (sp.into === "hold" && !me.transportCap) {
          errors.push({ path: `${p}.into`, message: "it has no hold (`transportCap`)" });
          return null;
        }
        if (sp.side === "killer" && rule.on !== "destroyed") {
          errors.push({ path: `${p}.side`, message: "only a `destroyed` rule knows who killed it" });
          return null;
        }
        out.spawn = sp;
        break;
      }
      case "buff": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { speed, damage, reload, taken, for }" });
          return null;
        }
        const b = {};
        for (const [k, x] of Object.entries(v)) {
          if (k === "for") {
            if (!num(x) || x < 0.1 || x > 600) {
              errors.push({ path: `${p}.for`, message: "must be seconds between 0.1 and 600" });
              return null;
            }
          } else if (["speed", "damage", "reload", "taken"].includes(k)) {
            if (!num(x) || x < 0.05 || x > 20) {
              errors.push({ path: `${p}.${k}`, message: "must be a multiplier between 0.05 and 20" });
              return null;
            }
          } else {
            errors.push({ path: `${p}.${k}`, message: "is not speed, damage, reload, taken or for" });
            return null;
          }
          b[k] = x;
        }
        if (b.for === void 0) {
          errors.push({ path: `${p}.for`, message: "is required" });
          return null;
        }
        if (Object.keys(b).length < 2) {
          errors.push({ path: p, message: "names no multiplier" });
          return null;
        }
        out.buff = b;
        break;
      }
      case "explode": {
        if (!isObj(v)) {
          errors.push({ path: p, message: "must be { dmg, radius, cls, friendlyFire }" });
          return null;
        }
        const dmg = v.dmg, radius = v.radius, cls = v.cls ?? "he";
        for (const k of Object.keys(v)) {
          if (!["dmg", "radius", "cls", "friendlyFire"].includes(k)) {
            errors.push({ path: `${p}.${k}`, message: "is not dmg, radius, cls or friendlyFire" });
            return null;
          }
        }
        if (!num(dmg) || dmg < 0 || dmg > 1e5) {
          errors.push({ path: `${p}.dmg`, message: "must be a number between 0 and 100000" });
          return null;
        }
        if (!num(radius) || radius < 1 || radius > 500) {
          errors.push({ path: `${p}.radius`, message: "must be world px between 1 and 500" });
          return null;
        }
        if (typeof cls !== "string" || !ctx.weaponClasses.includes(cls)) {
          errors.push({ path: `${p}.cls`, message: `must be one of ${ctx.weaponClasses.join(", ")}` });
          return null;
        }
        if (v.friendlyFire !== void 0 && typeof v.friendlyFire !== "boolean") {
          errors.push({ path: `${p}.friendlyFire`, message: "must be true or false" });
          return null;
        }
        out.explode = { dmg, radius, cls, ...v.friendlyFire ? { friendlyFire: true } : {} };
        break;
      }
      case "fx": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        if (!fxKnown(v, ctx)) {
          errors.push({ path: p, message: `"${String(v)}" is neither an fx.<name> sheet of this mod nor one of ${VANILLA_FX.join(", ")}` });
          return null;
        }
        out.fx = v;
        break;
      }
      case "sound": {
        if (!checkRow(row, v, p, errors, ctx)) return null;
        const s = v;
        if (!ctx.weaponSounds.includes(s) && !RULE_SOUNDS.includes(s) && !ctx.sounds.has(s)) {
          errors.push({ path: p, message: `"${s}" is not a sound the game has or this mod brings` });
          return null;
        }
        out.sound = s;
        break;
      }
      case "die":
      case "remove":
        if (v !== true) {
          errors.push({ path: p, message: "must be true" });
          return null;
        }
        out[row.name] = true;
        break;
      default:
        if (!checkRow(row, v, p, errors, ctx)) return null;
        out[row.name] = v;
    }
  }
  return out;
}
function fxKnown(key, ctx) {
  return key.startsWith("fx.") && ctx.sheets.has(key) || VANILLA_FX.includes(key);
}
function readRules(raw, path, ctx, into) {
  const out = [];
  const strings = {};
  const errors = [];
  const done = () => {
    into.push(...errors);
    return { rules: errors.length ? [] : out, strings };
  };
  if (!Array.isArray(raw)) {
    errors.push({ path, message: "must be a list of rules" });
    return done();
  }
  if (raw.length > MAX_DEF_RULES) {
    errors.push({ path, message: `at most ${MAX_DEF_RULES} rules` });
    return done();
  }
  let buttons = 0;
  raw.forEach((r, i) => {
    const rp = `${path}[${i}]`;
    if (!isObj(r)) {
      errors.push({ path: rp, message: "must be an object" });
      return;
    }
    if (!checkKeys(r, RULE_SPECS, rp, errors)) return;
    const triggers = ["on", "when", "every", "button"].filter((k) => r[k] !== void 0);
    if (triggers.length !== 1) {
      errors.push({ path: rp, message: "needs exactly one trigger: on, when, every or button" });
      return;
    }
    const rule = {};
    const before = errors.length;
    if (r.on !== void 0 && checkRow(RULE_SPECS[0], r.on, `${rp}.on`, errors, ctx)) rule.on = r.on;
    if (r.when !== void 0) rule.when = readCond(r.when, `${rp}.when`, errors, ctx) ?? void 0;
    if (r.every !== void 0 && checkRow(RULE_SPECS[2], r.every, `${rp}.every`, errors, ctx)) rule.every = r.every;
    if (r.button !== void 0) {
      const b = readButton(r.button, `${rp}.button`, errors, ctx);
      if (b) {
        rule.button = b.button;
        if (b.name !== void 0) strings[`rule.${ctx.def.id}.${i}.name`] = b.name;
        if (b.desc !== void 0) strings[`rule.${ctx.def.id}.${i}.desc`] = b.desc;
        buttons++;
      }
    }
    if (r.if !== void 0) rule.if = readCond(r.if, `${rp}.if`, errors, ctx) ?? void 0;
    for (const k of ["chance", "cooldown", "max"]) {
      const row = RULE_SPECS.find((x) => x.name === k);
      if (r[k] !== void 0 && checkRow(row, r[k], `${rp}.${k}`, errors, ctx)) rule[k] = r[k];
    }
    const list = r.do === void 0 ? void 0 : Array.isArray(r.do) ? r.do : [r.do];
    if (!list) {
      errors.push({ path: `${rp}.do`, message: "is required" });
      return;
    }
    if (list.length === 0 || list.length > MAX_RULE_EFFECTS) {
      errors.push({ path: `${rp}.do`, message: `must be one to ${MAX_RULE_EFFECTS} effects` });
      return;
    }
    const effects = list.map((x, k) => readEffect(x, Array.isArray(r.do) ? `${rp}.do[${k}]` : `${rp}.do`, errors, ctx, rule));
    if (effects.some((x) => !x) || errors.length > before) return;
    rule.do = effects;
    if (rule.button && !rule.do.some((x) => x.morph) && strings[`rule.${ctx.def.id}.${i}.name`] === void 0) {
      errors.push({ path: `${rp}.button.name`, message: "a button that changes no form needs a name" });
      return;
    }
    out[i] = rule;
  });
  if (buttons > MAX_DEF_BUTTONS) errors.push({ path, message: `at most ${MAX_DEF_BUTTONS} buttons` });
  return done();
}
function readButton(raw, path, errors, ctx) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, BUTTON_SPECS, path, errors)) return null;
  const b = { cost: 0, time: 0 };
  for (const row of BUTTON_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
    if (row.name === "cost" || row.name === "time") b[row.name] = v;
    if (row.name === "ai") b.ai = v;
    if (row.name === "requires") {
      const reqs = [];
      for (const id2 of v) {
        if (ctx.isTech(id2)) {
          reqs.push(id2);
          continue;
        }
        const d = ctx.find(id2);
        if (!d || d.kind !== "building") {
          errors.push({ path: `${path}.requires`, message: `"${id2}" is neither a building nor a tech node` });
          return null;
        }
        reqs.push(id2);
      }
      if (reqs.length) b.requires = reqs;
    }
  }
  return { button: b, name: raw.name, desc: raw.desc };
}
function readLook(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be an object" });
    return null;
  }
  if (!checkKeys(raw, LOOK_SPECS, path, errors)) return null;
  const out = {};
  for (const row of LOOK_SPECS) {
    const v = raw[row.name];
    if (v === void 0) continue;
    const p = `${path}.${row.name}`;
    if (row.name === "beam") {
      if (!isObj(v)) {
        errors.push({ path: p, message: "must be { color, width, style, life }" });
        return null;
      }
      const color = v.color ?? "#9cf", width = v.width ?? 2, style = v.style ?? "laser", life = v.life ?? 0.15;
      if (typeof color !== "string" || !/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        errors.push({ path: `${p}.color`, message: "must be a colour, #rgb or #rrggbb" });
        return null;
      }
      if (!num(width) || width < 0.5 || width > 16) {
        errors.push({ path: `${p}.width`, message: "must be world px between 0.5 and 16" });
        return null;
      }
      if (style !== "laser" && style !== "lightning") {
        errors.push({ path: `${p}.style`, message: "must be laser or lightning" });
        return null;
      }
      if (!num(life) || life < 0.03 || life > 3) {
        errors.push({ path: `${p}.life`, message: "must be seconds between 0.03 and 3" });
        return null;
      }
      out.beam = { color, width, style, life };
      continue;
    }
    if (!checkRow(row, v, p, errors, ctx)) return null;
    if (row.name === "sprite") {
      if (!v.startsWith("prj.") || !ctx.sheets.has(v)) {
        errors.push({ path: p, message: `"${String(v)}" is not a prj.<name> sheet of this mod` });
        return null;
      }
    }
    if ((row.name === "muzzle" || row.name === "impact") && v !== "none" && !fxKnown(v, ctx)) {
      errors.push({ path: p, message: `"${String(v)}" is neither an fx.<name> sheet of this mod, a game effect, nor none` });
      return null;
    }
    out[row.name] = v;
  }
  return out;
}
function readShield(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { hp, regen, delay }" });
    return null;
  }
  if (!checkKeys(raw, SHIELD_SPECS, path, errors)) return null;
  for (const row of SHIELD_SPECS) {
    const v = raw[row.name];
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: `${path}.${row.name}`, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
  }
  return { hp: raw.hp, regen: raw.regen ?? 0, delay: raw.delay ?? 3 };
}
function readWing(raw, path, ctx, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { unit, count, rebuild, sortie, rearm, range }" });
    return null;
  }
  if (!checkKeys(raw, WING_SPECS, path, errors)) return null;
  for (const row of WING_SPECS) {
    const v = raw[row.name];
    if (v === void 0) {
      if (row.required) {
        errors.push({ path: `${path}.${row.name}`, message: "is required" });
        return null;
      }
      continue;
    }
    if (!checkRow(row, v, `${path}.${row.name}`, errors, ctx)) return null;
  }
  if (ctx.def.kind !== "unit") {
    errors.push({ path, message: "only a unit carries a wing" });
    return null;
  }
  const unit = raw.unit;
  const plane = ctx.find(unit);
  const at = `${path}.unit`;
  if (!plane || !ctx.ownDef(unit)) {
    errors.push({ path: at, message: `"${unit}" is not a unit of this mod` });
    return null;
  }
  if (unit === ctx.def.id) {
    errors.push({ path: at, message: "a carrier is not its own plane" });
    return null;
  }
  if (plane.kind !== "unit" || plane.domain !== "air" || plane.warhead) {
    errors.push({ path: at, message: `"${unit}" is not an aircraft` });
    return null;
  }
  if (plane.pop > 0) {
    errors.push({ path: at, message: `"${unit}" counts population; a plane its carrier makes for nothing counts none (\`"pop": 0\`)` });
    return null;
  }
  return {
    unit,
    count: raw.count ?? 1,
    rebuild: raw.rebuild ?? 10,
    sortie: raw.sortie ?? 15,
    rearm: raw.rearm ?? 3,
    range: raw.range ?? 10
  };
}
function readAnims(raw, frames, path, errors) {
  if (!isObj(raw)) {
    errors.push({ path, message: "must be { moving, idle, firing }" });
    return null;
  }
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const p = `${path}.${k}`;
    if (!ANIM_SPECS.some((r) => r.name === k)) {
      errors.push({ path: p, message: "is not moving, idle or firing" });
      return null;
    }
    if (!Array.isArray(v) || v.length !== 2 && v.length !== 3 || !v.every(num)) {
      errors.push({ path: p, message: "must be [first, last] or [first, last, fps]" });
      return null;
    }
    const [a, b, fps] = v;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a || b >= frames) {
      errors.push({ path: p, message: `must name frames between 0 and ${frames - 1}, first before last` });
      return null;
    }
    if (fps !== void 0 && (fps < 0 || fps > 60)) {
      errors.push({ path: p, message: "fps must be between 0 and 60" });
      return null;
    }
    out[k] = v;
  }
  return out;
}
const MOD_FORMAT = "steel-tide-mod";
const MOD_FORMAT_VERSION = 4;
const MAX_MOD_DEFS = 200;
const MAX_MOD_SPRITES = 192;
const MAX_MOD_TERRAINS = 32;
const MAX_DEF_DECALS = 12;
const MAX_DEF_MOUNTS = 8;
const MAX_MOD_SOUNDS = 60;
const MAX_MOD_MUSIC_TRACKS = 32;
const MAX_MOD_MUSIC_QUEUE = 64;
const MAX_MOD_SCREENSHOTS = 8;
const MAX_MOD_MAPS = 8;
const MAX_MOD_MAP_BYTES = 512 * 1024;
const MIN_SCREENSHOT_WIDTH = 640;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const SOUND_KEY_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_MOD_FILES_BYTES = 24 * 1024 * 1024;
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const ATLAS_KEY_RE = /^(u|tur|dec|prj|fx|ter)\.[a-z0-9][a-z0-9_-]{1,39}$/;
const FILE_RE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]{1,120}$/;
const IMAGE_FILE_RE = /\.(png|jpe?g|webp)$/i;
const MAP_FILE_RE = /\.(steel-tide-map|json)$/i;
const ARMOR_CLASSES = ["light", "medium", "heavy", "ship", "sub", "air", "structure"];
const TARGET_DOMAINS = ["ground", "ship", "sub", "air"];
const WEAPON_CLASSES = ["mg", "autocannon", "cannon", "at", "he", "rocket", "navgun", "ashm", "torpedo", "aa"];
const PROJECTILES = ["bullet", "shell", "missile", "rocket", "bomb", "torpedo", "flak", "flame"];
const UNIT_DOMAINS = ["ground", "ship", "air", "amphibious"];
const TRAILS = ["tread", "tire", "wake", "none"];
const WEAPON_SOUNDS = ["mg", "autocannon", "cannon", "missile", "flak", "arty", "rocket", "torpedo", "bomb", "flame"];
const DECAL_LAYERS = ["under", "hull", "over"];
const DECAL_ANCHORS = ["hull", "turret"];
const DECAL_WHENS = ["always", "moving", "still", "firing", "damaged", "night", "ability"];
const MANIFEST_SPECS = [
  { name: "requiredCapabilities", type: "capabilities", min: 1, max: 32, doc: ["Required package-provided capability IDs", "由扩展包提供的必需能力 ID"] },
  { name: "extensionPackages", type: "extensionPackages", doc: ["Versioned extension packages with SHA-256 verified schema, simulation and optional presentation modules (format 4)", "含 SHA-256 校验的配置验证、模拟和可选显示模块的版本化扩展包（格式 4）"] },
  { name: "format", type: "string", required: true, doc: [`always "${MOD_FORMAT}"`, `固定为 "${MOD_FORMAT}"`] },
  { name: "v", type: "int", required: true, min: 1, max: MOD_FORMAT_VERSION, doc: ["format version: 1 remains supported; factions and headquarters require 2; capability data requires 3; executable extension packages require 4", "格式版本：仍支持 1；阵营和总部需要 2；扩展配置需要 3；可执行扩展包需要 4"] },
  { name: "id", type: "id", required: true, doc: ["the mod's id: lower case, letters, digits, `-`; also its folder in the registry", "模组 id：小写字母、数字和 `-`，也是它在仓库中的文件夹名"] },
  { name: "name", type: "text", required: true, doc: ["the name shown in the mod list", "模组列表中显示的名称"] },
  { name: "version", type: "string", required: true, max: 32, doc: ["e.g. `1.0.0`; the game offers an update when the registry's is newer", "如 `1.0.0`；仓库版本更新时游戏会提示更新"] },
  { name: "author", type: "string", max: 80, doc: ["who made it", "作者"] },
  { name: "description", type: "text", doc: ["one or two sentences for the list", "一两句话的介绍"] },
  { name: "homepage", type: "string", max: 200, doc: ["a link: a repository, a thread", "主页链接"] },
  { name: "license", type: "string", max: 80, def: "CC-BY-4.0", doc: ["the mod's licence (SPDX id)", "模组许可证（SPDX 标识）"] },
  { name: "minGame", type: "string", max: 32, doc: ["the oldest game version it is written for", "所需的最低游戏版本"] },
  { name: "defs", type: "defs", required: true, doc: ["the units, buildings and upgrade levels; may be empty when terrains, music queues or menu backgrounds are supplied", "单位、建筑与升级等级；提供 terrains、音乐队列或菜单背景时可为空"] },
  { name: "factions", type: "factions", doc: ["selectable factions, each with its own headquarters, starting builder and roster (format 2)", "可选阵营，各有自己的总部、初始建造单位和单位表（格式 2）"] },
  { name: "terrains", type: "terrains", doc: [`up to ${MAX_MOD_TERRAINS} map-selected terrain variants; preserve their base terrain’s gameplay`, `最多 ${MAX_MOD_TERRAINS} 种由地图选择的地形外观变体；保留基础地形的游戏规则`] },
  { name: "sprites", type: "sprites", doc: ["the sheets the defs draw with (see below)", "各定义使用的精灵图（见下）"] },
  { name: "music", type: "music", doc: ["custom BGM tracks and ordered menu, setup and battle queues (see below)", "自定义背景音乐及菜单、设置、战斗的顺序播放队列（见下）"] },
  { name: "menuBackground", type: "menuBackground", doc: ["ordered home-menu cut queue, mixing original scenes and this pack’s maps (see below)", "主页背景镜头的顺序队列，可混用原版场景与本模组地图（见下）"] },
  { name: "sounds", type: "sounds", doc: ["the recordings the weapons fire with (see below)", "武器开火时播放的录音（见下）"] },
  { name: "screenshots", type: "images", doc: [`pictures of the mod in play, relative to mod.json (\`screenshots/1.png\`): 4:3, at least ${MIN_SCREENSHOT_WIDTH} px wide, under ${MAX_SCREENSHOT_BYTES / 1048576} MB each, up to ${MAX_MOD_SCREENSHOTS}. The registry asks for at least one and shows them on the mod's page`, `模组游玩截图，路径相对 mod.json（\`screenshots/1.png\`）：4:3，宽至少 ${MIN_SCREENSHOT_WIDTH} 像素，每张不超过 ${MAX_SCREENSHOT_BYTES / 1048576} MB，最多 ${MAX_MOD_SCREENSHOTS} 张。仓库要求至少一张，并展示在模组页面上`] },
  { name: "maps", type: "maps", doc: [`maps the mod carries, relative to mod.json (\`maps/city.steel-tide-map\`): files exported from the Scenario Editor, up to ${MAX_MOD_MAPS}, each under ${MAX_MOD_MAP_BYTES / 1024} KB. A map may stand the mod's own units; the setup screens offer it beside the player's own map while the mod is on`, `模组自带的地图，路径相对 mod.json（\`maps/city.steel-tide-map\`）：场景编辑器导出的文件，最多 ${MAX_MOD_MAPS} 张，每张不超过 ${MAX_MOD_MAP_BYTES / 1024} KB。地图上可以预置本模组的单位；模组开启时，设置界面会把它列在自定义地图旁`] },
  { name: "files", type: "files", doc: ["single-file form only: the sheets, sounds, music and maps, embedded as data URLs by path", "仅单文件形式：按路径内嵌的图片、音频与地图（data URL）"] }
];
const DEF_SPECS = [
  { name: "extensions", type: "extensions", doc: ["Configuration keyed by a required engine capability (format 3)", "按必需引擎能力命名的配置（格式 3）"] },
  { name: "isHQ", type: "bool", only: "building", doc: ["a headquarters: holds territory and production slots, follows the ordinary HQ loss and sale rules; format 2", "总部：提供建造范围和生产槽位，遵循普通总部的失守与出售规则；格式 2"] },
  { name: "id", type: "id", required: true, doc: ["unique across every mod and the vanilla roster; prefix a generic word with your mod's id", "在所有模组和原版中唯一；通用名字前加上模组 id 前缀"] },
  { name: "name", type: "text", required: true, doc: ["as the HUD shows it", "HUD 中显示的名称"] },
  { name: "desc", type: "text", def: '""', doc: ["the tooltip line", "提示中的描述"] },
  { name: "extends", type: "id", doc: ["a vanilla def id (or an earlier def of this mod) to copy, then override field by field; inherits its art and where it is built", "要复制的原版定义 id（或本模组中前面的定义），再逐字段覆盖；继承其图像和生产位置"] },
  { name: "kind", type: "enum", values: ["unit", "building"], required: true, doc: ["a unit or a building (required unless `extends` says)", "单位或建筑（除非 `extends` 已说明，否则必填）"] },
  { name: "domain", type: "enum", values: UNIT_DOMAINS, only: "unit", def: "ground", doc: ["where it moves; a submarine is a `ship` with `underwater`, and an `amphibious` hull drives and swims (a ship target afloat, a ground one ashore)", "移动域；潜艇是带 `underwater` 的 `ship`，`amphibious` 既能行驶也能泅渡（在水上算舰船目标，上岸算地面目标）"] },
  { name: "tier", type: "int", min: 1, max: 3, def: "1", doc: ["the factory level it appears at, and the badge", "出现的工厂等级与徽标"] },
  { name: "cost", type: "number", required: true, min: 0, max: 99999, doc: ["metal", "金属造价"] },
  { name: "buildTime", type: "number", min: 0, max: 3600, def: "cost ÷ 14", doc: ["seconds at full power", "满电力下的建造秒数"] },
  { name: "pop", type: "int", min: 0, max: 50, def: "1 for a unit, 0 for a building", doc: ["population it counts for", "占用人口"] },
  { name: "hp", type: "number", required: true, min: 1, max: 1e6, doc: ["hit points", "生命值"] },
  { name: "armor", type: "enum", values: ARMOR_CLASSES, def: "by domain", doc: ["the armour class weapons are multiplied against", "武器倍率所针对的装甲类型"] },
  { name: "impactMaterial", type: "enum", values: ["armor", "earth", "concrete"], def: "concrete for structure armor, armor otherwise", doc: ["projectile-impact sound material; does not change damage. Both ordinary and heavy impacts use the matching recorded family", "弹体命中音效材质，不改变伤害；普通与重型爆炸使用对应的录音组"] },
  { name: "directionalArmor", type: "directionalArmor", only: "unit", doc: ["ground hull direct-hit multipliers `{front, side, rear}`, each 0–10; 90° front/rear arcs and 90° on each side. Arc fire, collateral blasts, mines and fire ignore facing. Enables slow reversing for short moves behind the hull", "地面车体直击倍率 `{front, side, rear}`，各为 0–10；正面、背面各 90°，两侧各 90°。抛射、溅射、地雷与火焰不计朝向。向车后短距离移动时会慢速倒车"] },
  { name: "speed", type: "number", only: "unit", min: 0, max: 1e3, def: "60", doc: ["world px/s (a tile is 32)", "世界像素/秒（一格 32）"] },
  { name: "turnRate", type: "number", only: "unit", min: 0, max: 50, def: "3.5", doc: ["rad/s", "弧度/秒"] },
  { name: "vision", type: "number", min: 0, max: 64, def: "8", doc: ["sight, in tiles; rounded to the nearest whole tile when activated", "视野（格）；启用内容时四舍五入为整格"] },
  { name: "radius", type: "number", min: 1, max: 200, def: "9, or the footprint", doc: ["collision radius, world px, and the *combat* yardstick: range, splash and hits are measured to it", "碰撞半径（世界像素），也是*战斗*基准：射程、溅射与命中都以它为准"] },
  { name: "body", type: "body", only: "unit", def: "the circle of `radius`", doc: ["the room the hull takes up when units push each other apart, world px: `r` its half-width, `len` its length less the two round ends. A long hull is what a circle cannot say. A ship whose beam (`r` twice) is over a tile (32) needs that many tiles of water abeam, rounded up: it never enters a channel narrower than itself", "单位互相推挤时所占的形状（世界像素）：`r` 为半宽，`len` 为去掉两端半圆后的长度。圆形无法表达细长的船体。船宽（`r` 的两倍）超过一格（32）的舰船需要相应格数的水面（向上取整），永远不会驶入比自身更窄的水道"] },
  { name: "weapons", type: "weapons", def: "[]", doc: ["the weapons (see below); an empty list is unarmed", "武器列表（见下）；空列表即无武装"] },
  { name: "fw", type: "int", only: "building", min: 1, max: 8, def: "2", doc: ["footprint width, tiles", "占地宽度（格）"] },
  { name: "fh", type: "int", only: "building", min: 1, max: 8, def: "2", doc: ["footprint height, tiles", "占地高度（格）"] },
  { name: "producedBy", type: "ids", only: "unit", def: "the line for its domain, from its tier up", doc: ["the buildings whose production list it joins (vanilla or this mod's), or units of this mod that train it (a carrier)", "加入哪些建筑的生产列表（原版或本模组的），或由本模组的哪些单位生产（航母）"] },
  { name: "produces", type: "ids", doc: ["a factory: the units it builds. On a unit, a carrier or a mothership that trains them itself: each is launched beside it, wherever it has got to", "工厂：可生产的单位。写在单位上，就是自己生产它们的航母或母舰：造好的单位在它当前的位置旁出现"] },
  { name: "builtBy", type: "ids", only: "building", def: '["engineer"]', doc: ["the builder units that may place it", "可建造它的工程单位"] },
  { name: "builds", type: "ids", only: "unit", doc: ["a builder unit: the buildings it can construct", "工程单位：可建造的建筑"] },
  { name: "buildRate", type: "number", only: "unit", min: 0, max: 1e4, doc: ["a builder unit: hp of work per second", "工程单位：每秒建造量"] },
  { name: "reach", type: "number", only: "unit", min: 0, max: 256, doc: ["a builder unit: how far past a target's radius it works from, world px (the engineer's 46 when unset; the engineer boat's 64)", "工程单位：超出目标半径多远即可施工（世界像素；默认工程车的 46，工程船为 64）"] },
  { name: "power", type: "number", min: -1e4, max: 1e4, def: "−pop for a unit, 0 for a building", doc: ["positive produces, negative draws; every unit draws its population", "正为发电，负为耗电；单位默认耗电等于其人口"] },
  { name: "metalRate", type: "number", min: 0, max: 1e3, doc: ["metal per second: an extractor, or a unit that earns (a supply ship)", "每秒金属：采矿场，或能赚钱的单位（补给舰）"] },
  { name: "needsDeposit", type: "bool", only: "building", doc: ["must stand on a deposit", "必须建在矿点上"] },
  { name: "offshore", type: "bool", only: "building", doc: ["stands in open water on its own legs: every footprint tile sea, no shore needed; with needsDeposit, an ore field at sea, which only a builder on the water (the engineer boat) can reach", "立于开阔海面：占地全为海水，无需岸边；配合 needsDeposit 即为海上矿点，只有水上的建造者（工程船）够得到"] },
  { name: "wall", type: "bool", only: "building", doc: ["a wall: one tile that joins its neighbours of the same def (its sheet is sixteen frames, one per set of neighbours: north 1, east 2, south 4, west 8), the last thing a gun shoots at, untouched by a pulse, and it falls without a charge", "墙：单格建筑，与相邻的同种建筑连成一体（精灵图为 16 帧，按相邻方向的掩码取帧：北 1、东 2、南 4、西 8），是火炮最后才会射击的目标，不受电磁脉冲影响，倒塌时没有爆炸"] },
  { name: "repairRange", type: "number", only: "building", min: 0, max: 64, doc: ["a repair aura, tiles", "维修光环范围（格）"] },
  { name: "repairRate", type: "number", only: "building", min: 0, max: 1e4, doc: ["hp per second per target", "每目标每秒维修量"] },
  { name: "repairTargets", type: "int", only: "building", min: 1, max: 50, doc: ["targets served at once", "同时维修的目标数"] },
  { name: "upgradeOf", type: "id", only: "building", doc: ["the building this is the next level of; that one gains the upgrade button", "作为哪座建筑的下一等级；那座建筑获得升级按钮"] },
  { name: "upgradeCost", type: "number", only: "building", min: 0, max: 99999, def: "cost − the source's cost", doc: ["with `upgradeOf`: the upgrade's price", "配合 `upgradeOf`：升级价格"] },
  { name: "upgradeTime", type: "number", only: "building", min: 0, max: 3600, def: "buildTime", doc: ["with `upgradeOf`: seconds", "配合 `upgradeOf`：升级秒数"] },
  { name: "requires", type: "ids", doc: ["building ids that must stand before it can be built, or tech node ids that must be researched (`suicideDrones`, `activeProtection`…)", "建造前必须存在的建筑 id，或必须研究完成的科技节点 id（`suicideDrones`、`activeProtection`…）"] },
  { name: "nukeCapacity", type: "int", min: 0, max: 10, doc: ["a launcher: warheads it holds", "发射器：可储存的弹头数"] },
  { name: "nukeCost", type: "number", min: 0, max: 99999, doc: ["a launcher: metal per warhead", "发射器：每枚弹头的金属"] },
  { name: "nukeTime", type: "number", min: 0, max: 3600, doc: ["a launcher: seconds per warhead", "发射器：每枚弹头的秒数"] },
  { name: "armsAtBase", type: "number", only: "unit", min: 0, max: 64, doc: ["a launcher: fabricates its warheads only within this many tiles of one of its own bases of its kind (a naval yard for a hull, an airbase for an aircraft; and, an `underwater` one, only on the surface), and holds the work otherwise (the Kraken's and the Wraith's 4)", "发射器：只在距己方同类基地（舰船为造船厂，飞机为机场）此格数内制造弹头（`underwater` 的还须浮出水面），否则暂停（海妖与幽魂为 4）"] },
  { name: "rearmTime", type: "number", min: 0.1, max: 600, def: "15", doc: ["seconds to fill every gun that carries `ammo` from empty, at a base of its kind", "在同类基地把所有带 `ammo` 的武器从空装满所需秒数"] },
  { name: "hatch", type: "number", min: 0, max: 30, doc: ["a launcher: seconds its doors take to open before the warhead leaves, and to close after; none fires on the spot", "发射器：发射前舱门打开所需秒数，发射后关闭亦然；不填则即刻发射"] },
  { name: "antiWarhead", type: "bool", doc: ["its anti-air may fire on a nuclear warhead without a veteran's rank", "其防空武器无需老兵等级即可攻击核弹头"] },
  { name: "interceptRange", type: "number", min: 0, max: 64, doc: ["point defence: reach in tiles", "拦截：范围（格）"] },
  { name: "interceptMag", type: "int", min: 1, max: 200, doc: ["point defence: rounds ready", "拦截：备弹数"] },
  { name: "interceptReload", type: "number", min: 0.05, max: 600, doc: ["point defence: seconds per round replaced", "拦截：每发补充秒数"] },
  { name: "interceptMuzzleOffset", type: "number", min: 0, max: 200, doc: ["point defence: launcher length, world px", "拦截：发射器长度（世界像素）"] },
  { name: "transportCap", type: "int", only: "unit", min: 1, max: 50, doc: ["a transport: hold, in cargo weight", "运输载具：载重"] },
  { name: "transportMaxWeight", type: "number", only: "unit", min: 0, max: 50, def: "transportCap", doc: ["a transport: maximum cargo weight of one passenger", "运输载具：单个乘员的最大载重"] },
  { name: "cargoReach", type: "number", only: "unit", min: 0.5, max: 4, def: "1", doc: ["a transport: how far its load and unload distances stretch, as a multiple of the default (the landing craft's 1.1, the Moray's 1.5); on a ship it widens the ground its ramp reaches too", "运输载具：装卸距离相对默认值的倍率（登陆艇 1.1，海鳗 1.5）；舰船的卸载落点范围也随之扩大"] },
  { name: "landsForCargo", type: "bool", only: "unit", doc: ["a cargo plane that touches down to load", "装卸时降落的运输机"] },
  { name: "cargoWeight", type: "number", only: "unit", min: 0, max: 50, def: "pop", doc: ["how much of a hold it takes", "占用的载重"] },
  { name: "underwater", type: "bool", only: "unit", doc: ["a submarine: seen only by sonar", "潜艇：仅声呐可见"] },
  { name: "sonar", type: "number", only: "unit", min: 0, max: 64, doc: ["sonar range, tiles", "声呐范围（格）"] },
  { name: "stealth", type: "number", only: "unit", min: 0, max: 64, doc: ["seen only within this many tiles of an enemy", "仅在敌方此距离内可见"] },
  { name: "detect", type: "number", min: 0, max: 64, doc: ["reveals stealth within this many tiles", "在此范围内揭示隐形"] },
  { name: "radar", type: "bool", doc: ["sees by radio: the sight circle ignores weather and the hour, and drops to 7 tiles when short of power", "靠无线电观测：视野不受天气与昼夜影响，电力不足时缩至 7 格"] },
  { name: "remoteVision", type: "bool", only: "unit", doc: ["remote camera feed: hostile jamming blocks its sight within the field", "远程图像传输：敌方干扰阻止其揭示干扰区内的视野"] },
  { name: "jamRange", type: "number", only: "building", min: 0, max: 64, doc: ["electronic-warfare radius in tiles; requires full power, reveals its location, blocks hostile radar and remote vision, never visual sight or sonar", "电子战半径（格）：需充足电力，会暴露自身位置，阻断敌方雷达与远程视野，不影响目视与声呐"] },
  { name: "hovers", type: "bool", only: "unit", doc: ["an aircraft that hovers instead of orbiting", "悬停而非盘旋的飞行器"] },
  { name: "kamikaze", type: "bool", only: "unit", doc: ["the unit is its own round: it never picks a target, and its one weapon flies it into what it is ordered at (the Hornet)", "自身即弹药：从不自行索敌，唯一的武器是被命令攻击时撞向目标（黄蜂）"] },
  { name: "lowFlying", type: "bool", only: "unit", doc: ["an aircraft at treetop height: machine guns and autocannons that fire on the ground reach it too (the helicopters and the Hornet)", "贴着树梢飞行的飞行器：对地的机枪与机炮也能打到它（直升机与黄蜂）"] },
  { name: "limit", type: "int", min: 1, max: 200, only: "unit", doc: ["at most this many a faction at once, alive and queued together (the Hornet's 10)", "每个阵营同时最多拥有的数量，在役与排队中合计（黄蜂为 10）"] },
  { name: "altitude", type: "number", only: "unit", min: 0, max: 64, def: "12", doc: ["an aircraft's drawn height, px", "飞行器的绘制高度（像素）"] },
  { name: "fireOnMove", type: "bool", only: "unit", doc: ["keeps shooting on a plain move", "移动时持续开火"] },
  { name: "burnMult", type: "number", only: "unit", min: 0, max: 4, def: "1", doc: ["what fire on the ground does to it, as a multiplier (the Drake's 0.5)", "地面火焰对它的伤害倍率（火龙为 0.5）"] },
  { name: "trail", type: "enum", values: TRAILS, only: "unit", def: "by domain", doc: ["the mark it leaves, and the sound of it: treads and tyres are heard rolling; `none` for a unit on foot or a hovercraft, which neither cuts a rut nor is heard as an engine", "留下的痕迹，也决定行驶声：履带与轮胎行驶时可闻；步行单位或气垫船用 `none`，既不留痕也没有引擎声"] },
  { name: "shadow", type: "bool", def: "true", doc: ["the shadow the game casts for it: a unit's hull and turret silhouettes, a step to the south-east on the ground, further off in the air; a building's gun's, on its roof; `false` when the art brings its own, or none is wanted (a submarine casts none)", "游戏为它投下的影子：单位是车体与炮塔的剪影，在地面上向东南偏一步，在空中则更远；建筑是其炮塔投在屋顶上的影子；图像自带阴影或不需要时设为 `false`（潜艇不投影）"] },
  { name: "sprite", type: "string", max: 48, def: "this mod's u.<id> sheet, else the base's art", doc: ["the body's atlas key: one of this mod's sheets, or a vanilla key to borrow its art", "主体图像键：本模组的精灵图，或借用原版的键"] },
  { name: "turretSprite", type: "string", max: 48, def: "this mod's tur.<id> sheet, else the base's (when its art is kept)", doc: ["the rotating part's key, if any", "旋转部件的图像键（若有）"] },
  { name: "turretMounts", type: "mounts", def: "one, where the body sheet's `mount` puts it (else the pivot); the base's, when its art is kept", doc: [`the rings its turret stands on and fires from, up to ${MAX_DEF_MOUNTS}: a hull with several guns names one each (a battleship's A, B and X), every one drawn with the one \`turretSprite\` and trained on the one target, as far round as its own arc goes (see below)`, `炮塔所在并由此开火的炮塔环，最多 ${MAX_DEF_MOUNTS} 个：有多门炮的车体每门各写一个（战列舰的 A、B、X 炮塔），每个都用同一个 \`turretSprite\` 绘制，并在各自射界之内瞄准同一个目标（见下）`] },
  { name: "decals", type: "decals", def: "the base's, when its art is kept", doc: [`pictures laid on the hull and the turret besides their own sheets (see below), up to ${MAX_DEF_DECALS}`, `除车体与炮塔本身之外贴在其上的图像（见下），最多 ${MAX_DEF_DECALS} 个`] },
  { name: "ability", type: "enum", values: ABILITY_IDS, only: "unit", def: "the base's", doc: ["its one active ability, a vanilla one by id (`sprint`, `smoke`, `countermeasures`…): the same click, clock and unlock as on the game's own units", "唯一的主动技能，按 id 取原版技能（`sprint`、`smoke`、`countermeasures`…）：点击、计时与解锁条件与原版单位相同"] },
  { name: "aliases", type: "strings", doc: ["other names the console's `give` accepts", "控制台 `give` 接受的别名"] },
  { name: "aiWeight", type: "number", only: "unit", min: 0, max: 10, def: "0", doc: ["how readily the AI builds it: a Bison is 3, a scout car 1; 0 never", "AI 生产它的倾向：野牛是 3，侦察车 1；0 为从不"] },
  { name: "rules", type: "rules", doc: [`its behaviour: rules that turn it into another form, spawn, heal, pay, buff or blow up, on an event, a condition, a clock or a button (see Behaviour), up to ${MAX_DEF_RULES}; never inherited through \`extends\``, `行为：在事件、条件、定时或按钮触发时让它变形、生成单位、回血、给钱、增益或爆炸的规则（见“行为”），最多 ${MAX_DEF_RULES} 条；不会通过 \`extends\` 继承`] },
  { name: "shield", type: "shield", doc: ["an energy shield, `{ hp, regen, delay }`: it takes harm before the hull does, and recharges `regen` a second once unhurt for `delay` seconds", "能量护盾 `{ hp, regen, delay }`：先于船体承受伤害，未受伤 `delay` 秒后每秒恢复 `regen`"] },
  { name: "regen", type: "number", min: 0, max: 1e4, doc: ["hit points a second it mends itself by", "每秒自我修复的生命值"] },
  { name: "untargetable", type: "bool", doc: ["nothing on the other side may pick it as a target or be ordered to attack it; a blast still reaches it (a disguise, a decoy)", "敌方无法将其选为目标或下令攻击它；爆炸仍能伤到它（伪装、诱饵）"] },
  { name: "wing", type: "wing", only: "unit", doc: ["a carrier: planes of this mod it keeps aboard, `{ unit, count, rebuild, sortie, rearm, range }`, sent out at what it fights, taken back to rearm and made again when lost; never the player's to order (see Behaviour); never inherited through `extends`", "母舰：搭载本模组的飞机 `{ unit, count, rebuild, sortie, rearm, range }`，出击它所攻击的目标，返航补给，损失后重新制造；玩家不能直接指挥（见“行为”）；不会通过 `extends` 继承"] }
];
const WEAPON_SPECS = [
  { name: "extensions", type: "extensions", doc: ["Optional engine weapon configuration (format 3)", "可选引擎武器配置（格式 3）"] },
  { name: "id", type: "string", max: 32, def: "w1, w2…", doc: ["a name for the weapon", "武器名"] },
  { name: "cls", type: "enum", values: WEAPON_CLASSES, required: true, doc: ["what it was built to kill; picks its row of the armour matrix", "设计用途，决定装甲倍率表中的行"] },
  { name: "dmg", type: "number", required: true, min: 0, max: 1e5, doc: ["damage per hit", "每次命中伤害"] },
  { name: "reload", type: "number", required: true, min: 0.05, max: 600, doc: ["seconds between shots or bursts", "两次射击/齐射间隔秒数"] },
  { name: "range", type: "number", required: true, min: 0.5, max: 64, doc: ["tiles", "射程（格）"] },
  { name: "minRange", type: "number", min: 0, max: 64, doc: ["tiles it cannot fire inside", "最小射程（格）"] },
  { name: "projectile", type: "enum", values: PROJECTILES, def: "by class", doc: ["the round drawn", "弹药样式"] },
  { name: "speed", type: "number", min: 1, max: 5e3, def: "by projectile", doc: ["round speed, world px/s", "弹速（世界像素/秒）"] },
  { name: "targets", type: "targets", def: "by class", doc: ["what it may fire at: ground, ship, sub, air", "可攻击目标：ground、ship、sub、air"] },
  { name: "mult", type: "mult", doc: ["overrides of the class row, by armour class", "按装甲类型覆盖倍率"] },
  { name: "splash", type: "number", min: 0, max: 500, doc: ["blast radius, world px", "溅射半径（世界像素）"] },
  { name: "burst", type: "int", min: 1, max: 32, doc: ["shots per burst", "每次齐射发数"] },
  { name: "burstDelay", type: "number", min: 0, max: 5, doc: ["seconds between the shots of a burst", "齐射内各发间隔秒数"] },
  { name: "ammo", type: "int", min: 1, max: 9999, doc: ["rounds carried, a burst one: dry, a unit goes home for more on its own (an airbase for an aircraft, a naval yard for a hull, a war factory for the rest) and a building refills where it stands; absent never runs dry", "携弹量，一次齐射算一发：打空后单位自行返回补给（飞机回机场，舰船回造船厂，其余回战车工厂），建筑原地补充；不填则永不耗尽"] },
  { name: "vsWarhead", type: "number", min: 0, max: 10, def: "1", doc: ["against a warhead in flight, this share of what it does to an aircraft", "对飞行中的弹头，造成对飞机伤害的此比例"] },
  { name: "homing", type: "bool", doc: ["the round tracks its target", "弹药追踪目标"] },
  { name: "interceptable", type: "bool", doc: ["point defence may shoot it down", "可被拦截"] },
  { name: "arc", type: "bool", doc: ["a ballistic arc (artillery)", "抛物线弹道（火炮）"] },
  { name: "turret", type: "bool", def: "true when the def has a turretSprite", doc: ["fired from the rotating part", "由旋转部件发射"] },
  { name: "recoil", type: "number", min: 0, max: 10, doc: ["cosmetic barrel recoil stroke, art px; requires barrel regions on the turret art, changes no weapon statistic", "炮管后坐的视觉行程（美术像素）；炮塔图像须带炮管区域，不改变武器属性"] },
  { name: "vertical", type: "bool", doc: ["launched straight up out of the hull, like a submarine's missile tubes: it fires at any bearing and the hull never turns for it; `muzzleOffset` then runs along the keel to the tubes", "从艇体垂直发射，如潜艇的导弹发射筒：任何方向都能开火，艇体无需转向；此时 `muzzleOffset` 沿艇身纵轴量到发射筒"] },
  { name: "muzzleOffset", type: "number", min: 0, max: 200, doc: ["pivot to muzzle, world px; a unit's art is drawn 1.5625×, so measure on the sheet and multiply", "枢轴到炮口距离（世界像素）；单位美术按 1.5625 倍绘制，量图后需乘以该倍数"] },
  { name: "bores", type: "int", min: 1, max: 8, def: "1", doc: ["barrels, fired one after another", "炮管数，逐根轮流开火"] },
  { name: "boreSpacing", type: "number", min: 0, max: 60, doc: ["gap between adjacent barrels, world px", "相邻炮管间距（世界像素）"] },
  { name: "muzzlePoints", type: "muzzles", min: 1, max: 8, doc: ["explicit muzzle positions, fired in list order: 1–8 `{ forward, lateral }` points in world px from the firing pivot (forward along the bore, lateral to its right; either may be negative); replaces `muzzleOffset`, `bores` and `boreSpacing`", "按列表顺序开火的炮口位置：1–8 个 `{ forward, lateral }` 点，单位为距开火枢轴的世界像素（forward 沿炮管向前，lateral 向右，均可为负）；替代 `muzzleOffset`、`bores` 和 `boreSpacing`"] },
  { name: "spread", type: "number", min: 0, max: 200, doc: ["inaccuracy at full range, world px", "最大射程处的散布（世界像素）"] },
  { name: "friendlyFire", type: "bool", doc: ["the blast hurts your own side too", "溅射也会伤及己方"] },
  { name: "fan", type: "number", min: 0, max: 1.5, doc: ["a `flame` jet: the half-angle it is sprayed across, radians", "`flame` 喷流：喷射张角的一半（弧度）"] },
  { name: "burn", type: "number", min: 0, max: 1e3, doc: ["a `flame` jet: damage a second the fire it leaves does, to both sides", "`flame` 喷流：残留火焰每秒伤害，敌我通吃"] },
  { name: "burnLife", type: "number", min: 0, max: 120, doc: ["a `flame` jet: seconds that fire keeps burning", "`flame` 喷流：火焰持续秒数"] },
  { name: "sound", type: "string", max: 64, def: "by class", doc: [`the firing sound: ${WEAPON_SOUNDS.join(", ")}, or the key of one of this mod's \`sounds\``, `开火音效：${WEAPON_SOUNDS.join("、")}，或本模组 \`sounds\` 中的一个键`] },
  { name: "look", type: "look", doc: ["how it looks, in place of its class: its own round, flash, burst where it lands, or a beam (see Weapon looks)", "外观，替代其类别默认的样子：自己的弹药、枪口焰、命中爆炸，或光束（见“武器外观”）"] }
];
const DECAL_SPECS = [
  { name: "sprite", type: "string", max: 48, required: true, doc: ["the sheet drawn: one of this mod's `dec.<name>` sheets, or any body or turret key", "所绘精灵图：本模组的 `dec.<名字>` 精灵图，或任一车体/炮塔键"] },
  { name: "on", type: "enum", values: DECAL_ANCHORS, def: "hull", doc: ["what it is fixed to and turns with; `turret` needs a `turretSprite`", "固定在何处并随之转动；`turret` 要求该定义有 `turretSprite`"] },
  { name: "layer", type: "enum", values: DECAL_LAYERS, def: "hull, or over when on a turret", doc: ["where it goes in the stack: under the body, on the hull under the turret, or over everything", "在图层中的位置：车体之下、车体之上炮塔之下、或最上层"] },
  { name: "x", type: "number", min: -256, max: 256, def: "0", doc: ["where it sits on the part's up-facing art: px right of the pivot, in the sheet's own px at its `fw`×`fh` size (the game scales it with the unit)", "在部件朝上图像上的位置：枢轴右侧的像素，按精灵图 `fw`×`fh` 尺寸计（游戏随单位一并缩放）"] },
  { name: "y", type: "number", min: -256, max: 256, def: "0", doc: ["px down from the pivot, toward the tail", "枢轴下方（车尾方向）的像素"] },
  { name: "angle", type: "number", min: -360, max: 360, def: "0", doc: ["turned this much further than what it is fixed to, degrees clockwise", "相对所固定部件再顺时针转动的角度"] },
  { name: "upright", type: "bool", doc: ["never turned: laid screen-up wherever its anchor is", "永不旋转：始终朝屏幕上方"] },
  { name: "scale", type: "number", min: 0.05, max: 8, def: "1", doc: ["drawn at this multiple of its sheet's size", "按精灵图尺寸的此倍数绘制"] },
  { name: "alpha", type: "number", min: 0, max: 1, def: "1", doc: ["opacity", "不透明度"] },
  { name: "when", type: "enum", values: DECAL_WHENS, def: "always", doc: ["shown only while the unit moves or stands (`moving`, `still`), within a reload of its last shot (`firing`), under half health (`damaged`), while its ability runs or is armed (`ability`), or after dusk (`night`: laid over the dark like a lamp, and the game's own headlights stay off a unit that has one)", "仅在移动/静止（`moving`/`still`）、上次开火后一次装填时间内（`firing`）、生命低于一半（`damaged`）、技能生效或待发时（`ability`）或天黑后（`night`：像灯一样亮于夜色之上，且游戏不再为该单位画自己的车灯）时显示"] }
];
const MOUNT_SPECS = [
  { name: "x", type: "number", min: -256, max: 256, def: "0", doc: ["where the ring is on the body's up-facing art: px right of its pivot, in the body sheet's own px at its `fw`×`fh` size (the game scales it with the unit)", "炮塔环在主体朝上图像上的位置：枢轴右侧的像素，按主体精灵图 `fw`×`fh` 尺寸计（游戏随单位一并缩放）"] },
  { name: "y", type: "number", min: -256, max: 256, def: "0", doc: ["px down from the pivot, toward the tail", "枢轴下方（车尾方向）的像素"] },
  { name: "rest", type: "number", min: -360, max: 360, def: "0", doc: ["the bearing it trains about, degrees clockwise from the bow: 0 forward, 90 to the right, 180 aft", "转动所围绕的朝向，自车头顺时针计的角度：0 向前、90 向右、180 向后"] },
  { name: "arc", type: "number", min: 0, max: 180, def: "180", doc: ["how far either side of `rest` it turns, degrees; 180 is all round. A ring that cannot bear on the target waits at the end of its arc, and the rings that can take the shots", "在 `rest` 两侧各能转动的角度；180 即全向。无法指向目标的炮塔停在射界尽头，由能指向目标的炮塔开火"] }
];
const SOUND_SPECS = [
  { name: "key", type: "string", max: 60, required: true, doc: ["`<mod id>-<name>`, lower case; what a weapon's `sound` names", "`<模组 id>-<名字>`，小写；武器 `sound` 引用的键"] },
  { name: "file", type: "string", max: 120, required: true, doc: ["the recording, relative to mod.json. An MP3 plays everywhere; WAV works, OGG not on Safari. Dry, close, under a second", "录音路径，相对 mod.json。MP3 处处可播；WAV 可用，OGG 在 Safari 上不行。干声、近距、一秒以内"] }
];
const SPRITE_SPECS = [
  { name: "key", type: "string", max: 48, required: true, doc: ["`u.<id>` for a body, `tur.<id>` for a rotating part, `dec.<name>` for a decal, `prj.<name>` for a round and `fx.<name>` for an effect a weapon's look or a rule plays; `ter.<mod id>-<name>` for terrain materials; never a vanilla key", "主体用 `u.<id>`，旋转部件用 `tur.<id>`，贴花用 `dec.<名字>`，弹药用 `prj.<名字>`，武器外观或规则播放的特效用 `fx.<名字>`；地形材质用 `ter.<模组 id>-<名字>`；不可与原版键重名"] },
  { name: "file", type: "string", max: 120, required: true, doc: ["the image, relative to mod.json (PNG, WebP or JPEG)", "图片路径，相对 mod.json（PNG、WebP 或 JPEG）"] },
  { name: "frames", type: "int", min: 1, max: 64, def: "1", doc: ["animation frames, left to right in one strip", "动画帧数，横向排列"] },
  { name: "fw", type: "number", min: 4, max: 512, def: "the footprint (a building) or the image", doc: ["in-game frame width, whole world px", "游戏内帧宽（世界像素，整数）"] },
  { name: "fh", type: "number", min: 4, max: 512, doc: ["in-game frame height, whole world px", "游戏内帧高（世界像素，整数）"] },
  { name: "rotated", type: "bool", doc: ["one up-facing image; the game bakes the 24 headings (hulls, turrets)", "一张朝上的图；游戏烘焙 24 个朝向（车体、炮塔）"] },
  { name: "pivotX", type: "number", min: 0, max: 1, def: "0.5", doc: ["rotation pivot, as a fraction of the frame", "旋转枢轴（帧宽比例）"] },
  { name: "pivotY", type: "number", min: 0, max: 1, def: "0.5", doc: ["rotation pivot, as a fraction of the frame", "旋转枢轴（帧高比例）"] },
  { name: "anchorY", type: "number", min: 0, max: 512, doc: ["px from the top to the footprint centre (tall buildings)", "顶部到占地中心的像素（高建筑）"] },
  { name: "mount", type: "pair", doc: ["a body: where its turret sits (or, with a repair aura, where the beam leaves), as `[fx, fy]`", "主体：炮塔安装位置（带维修光环时则是光束的起点），写作 `[fx, fy]`"] },
  { name: "barrels", type: "barrels", min: 1, max: 8, doc: ["exposed barrel rectangles, each `[left, top, right, bottom]` in 0–1 fractions of the up-facing source frame, in muzzle firing order; leave mantlets fixed. Pair with weapon `recoil` (art px)", "外露炮管矩形，每项为朝上原始帧中 0–1 比例的 `[左, 上, 右, 下]`，按炮口开火顺序排列；不含固定炮盾。搭配武器的 `recoil`（美术像素）"] },
  { name: "fps", type: "number", min: 0, max: 60, doc: ["animation speed", "动画速度"] },
  { name: "teams", type: "bool", def: "true", doc: ["recolour magenta per faction; `false` draws the sheet as painted for every faction, and for the wreck", "按阵营重着色品红部分；`false` 则各阵营（以及残骸）都按原图绘制"] },
  { name: "ss", type: "int", min: 1, max: 4, doc: ["supersample factor; omit to let the game choose", "超采样倍率；留空由游戏决定"] },
  { name: "fitFootprint", type: "bool", doc: ["scale the drawn content to fill the frame", "缩放内容以填满帧"] },
  { name: "animRegion", type: "quad", doc: ["where the animation lives, `[x0, y0, x1, y1]` fractions; the rest is frozen", "动画所在区域 `[x0, y0, x1, y1]`（比例）；其余部分冻结"] },
  { name: "stabilize", type: "bool", def: "true", doc: ["re-align drifting frames", "对齐漂移的帧"] },
  { name: "freezeStatic", type: "bool", doc: ["median-freeze pixels that barely change", "冻结几乎不变的像素"] },
  { name: "stripBg", type: "bool", doc: ["force background removal on or off", "强制开启/关闭背景去除"] },
  { name: "bgMinLuma", type: "number", min: 0, max: 255, doc: ["lightest colour still taken as background", "仍视为背景的最亮颜色"] },
  { name: "artifactCleanup", type: "bool", doc: ["sweep specks left by background removal", "清理背景去除后的杂点"] },
  { name: "anims", type: "anims", doc: ["a unit body's frames by what it is doing, `{ moving, idle, firing }`, each `[first, last]` or `[first, last, fps]`: a tank that is a tree when it stands, a walker whose legs move only when it does (see Animation states)", "单位主体按状态播放的帧 `{ moving, idle, firing }`，每项为 `[起, 止]` 或 `[起, 止, fps]`：静止时变成树的坦克、只在移动时迈腿的步行机（见“动画状态”）"] }
];
const MENU_BACKGROUND_SPECS = [
  { name: "cuts", type: "menuCuts", doc: [`up to ${MAX_MENU_CUTS} custom live scenes`, `最多 ${MAX_MENU_CUTS} 个自定义实时场景`] },
  { name: "queue", type: "menuQueue", required: true, doc: [`1–${MAX_MENU_QUEUE} cut IDs in repeating order; original IDs: ${MENU_CUT_IDS.join(", ")}`, `1–${MAX_MENU_QUEUE} 个循环播放的镜头 id；原版 id：${MENU_CUT_IDS.join("、")}`] }
];
const MENU_CAMERA_SPECS = [
  { name: "tx", type: "number", required: true, min: 0, max: MAX_MENU_MAP_SIDE, doc: ["horizontal camera centre in tiles, inside the map", "镜头中心的横向格坐标，须位于地图内"] },
  { name: "ty", type: "number", required: true, min: 0, max: MAX_MENU_MAP_SIDE, doc: ["vertical camera centre in tiles, inside the map", "镜头中心的纵向格坐标，须位于地图内"] },
  { name: "zoom", type: "number", required: true, min: 0.25, max: 4, doc: ["camera zoom, capped by the menu on small screens", "镜头缩放，小屏幕上由菜单限制最大值"] }
];
const MENU_ORDER_SPECS = [
  { name: "owner", type: "int", required: true, min: 0, max: MAX_PLAYERS - 1, doc: ["map spawn index; one opening attack-move per owner", "地图出生点序号；每方可指定一次初始攻击移动"] },
  ...MENU_CAMERA_SPECS.filter((s) => s.name !== "zoom").map((s) => ({ ...s, doc: [s.name === "tx" ? "target tile x" : "target tile y", s.name === "tx" ? "目标横向格坐标" : "目标纵向格坐标"] }))
];
const MENU_CUT_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique cut ID beginning with the mod ID and a dash", "唯一镜头 id，以模组 id 和连字符开头"] },
  { name: "map", type: "string", required: true, max: 120, doc: ["a path in this pack’s maps; at most 128 × 128 tiles and 200 placed units/buildings", "本模组 maps 中的路径；最多 128 × 128 格及 200 个预置单位/建筑"] },
  { name: "camera", type: "menuCamera", required: true, doc: ["opening framing: { tx, ty, zoom }", "初始构图：{ tx, ty, zoom }"] },
  { name: "cameraEnd", type: "menuCamera", doc: ["end framing for a 13-second drift; omitted holds camera", "13 秒镜头移动的终点构图；省略则固定镜头"] },
  { name: "weather", type: "enum", values: ["clear", "rain", "snow"], def: "clear", doc: ["weather held throughout the cut", "镜头期间保持的天气"] },
  { name: "minutes", type: "number", min: 0, max: 24, def: "6", doc: ["held day-cycle time: 0 dawn, 6 noon, 12 dusk, 18 midnight", "固定昼夜时刻：0 黎明、6 正午、12 黄昏、18 午夜"] },
  { name: "seed", type: "int", min: 0, max: 2147483647, def: "1", doc: ["simulation seed", "模拟随机种子"] },
  { name: "orders", type: "menuOrders", doc: ["opening attack-move targets for the map’s mobile units, by owner", "按所属方为地图上的移动单位指定初始攻击移动目标"] }
];
const MUSIC_SPECS = [
  { name: "tracks", type: "musicTracks", doc: [`up to ${MAX_MOD_MUSIC_TRACKS} custom recordings, each with an id and file`, `最多 ${MAX_MOD_MUSIC_TRACKS} 首自定义录音，每首包含 id 和 file`] },
  { name: "menu", type: "musicQueue", doc: ["ordered repeating queue for menus; also used for setup unless setup is supplied. Omitted keeps the previous queue; [] is silence", "菜单循环顺序队列；未指定 setup 时也用于对局设置。省略保留之前的队列；[] 表示静音"] },
  { name: "setup", type: "musicQueue", doc: ["optional separate queue for match setup", "可选的对局设置独立队列"] },
  { name: "battle", type: "musicQueue", doc: [`ordered repeating queue during battle. Omitted keeps the previous queue; [] is silence. Built-in IDs: ${Object.values(MUSIC_FILES).flat().join(", ")}`, `战斗中的循环顺序队列。省略保留之前的队列；[] 表示静音。原版曲目 id：${Object.values(MUSIC_FILES).flat().join("、")}`] }
];
const MUSIC_TRACK_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique track id: <mod id>-<name>; cannot replace a built-in ID", "唯一曲目 id：<模组 id>-<名字>；不能覆盖原版 id"] },
  { name: "file", type: "string", required: true, max: 120, doc: ["MP3, Ogg or WAV path relative to mod.json", "相对 mod.json 的 MP3、Ogg 或 WAV 路径"] }
];
const FACTION_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique faction id, prefixed with the mod id and a dash", "唯一阵营 id，以模组 id 和连字符开头"] },
  { name: "name", type: "text", required: true, doc: ["the faction name in game setup", "对局设置中的阵营名称"] },
  { name: "headquarters", type: "id", required: true, doc: ["this mod’s land headquarters definition", "本模组的陆地总部定义"] },
  { name: "builder", type: "id", required: true, doc: ["this mod’s ground or amphibious builder; the HQ must produce it and it must rebuild the HQ", "本模组的陆地或两栖建造单位；总部必须能生产它，它必须能重建总部"] },
  { name: "roster", type: "ids", max: MAX_MOD_DEFS, doc: ["permitted definitions, including prerequisites and upgrades; defaults to all definitions in this mod", "允许的定义，包括前置建筑与升级；默认为本模组的全部定义"] }
];
const TERRAIN_SPECS = [
  { name: "id", type: "id", required: true, doc: ["unique terrain variant id, prefixed with the mod id and a dash", "唯一地形变体 id，以模组 id 和连字符开头"] },
  { name: "name", type: "text", required: true, doc: ["the terrain style name in the editor", "编辑器中的地形外观名称"] },
  { name: "base", type: "enum", values: Object.keys(TERRAIN_BASES), required: true, doc: ["the existing terrain whose movement, construction and combat behavior stays unchanged", "基础地形；移动、建造和战斗规则保持不变"] },
  { name: "texture", type: "string", max: 48, doc: ["flat terrain material: a ter.<mod id>-<name> sheet in this pack; city uses its city materials instead", "平面地形材质：本模组中的 ter.<模组 id>-<名字> 图像；城市使用 city 材质"] },
  { name: "city", type: "cityTerrain", doc: ["materials, lights and optional visual architecture; only with base city", "材质、灯光与可选建筑外形；仅适用于 base city"] }
];
const CITY_TERRAIN_SPECS = [
  { name: "roof", type: "string", max: 7, doc: ["roof color, #RRGGBB", "屋顶颜色，#RRGGBB"] },
  { name: "wall", type: "string", max: 7, doc: ["wall color, #RRGGBB", "墙面颜色，#RRGGBB"] },
  { name: "window", type: "string", max: 7, doc: ["lit window color, #RRGGBB", "亮窗颜色，#RRGGBB"] },
  { name: "lamp", type: "string", max: 7, doc: ["streetlamp color, #RRGGBB", "路灯颜色，#RRGGBB"] },
  { name: "roofTexture", type: "string", max: 48, doc: ["roof material, a ter.<mod id>-<name> sheet in this pack", "屋顶材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "wallTexture", type: "string", max: 48, doc: ["wall material, a ter.<mod id>-<name> sheet in this pack", "墙面材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "groundTexture", type: "string", max: 48, doc: ["courtyard material, a ter.<mod id>-<name> sheet in this pack", "庭院地面材质，本模组中的 ter.<模组 id>-<名字> 图像"] },
  { name: "signTexture", type: "string", max: 48, doc: ["4×4 atlas of 16 square signs in row-major order, a ter.<mod id>-<name> sheet in this pack; custom architecture selects a cell per building", "4×4 排列的 16 个正方形招牌图集，按行排列，使用本模组的 ter.<模组 id>-<名字> 图像；自定义建筑按楼栋选取单格"] },
  { name: "accent", type: "string", max: 7, doc: ["primary architectural lighting color, #RRGGBB", "建筑主装饰灯颜色，#RRGGBB"] },
  { name: "accent2", type: "string", max: 7, doc: ["secondary architectural lighting color, #RRGGBB", "建筑副装饰灯颜色，#RRGGBB"] },
  { name: "architecture", type: "cityArchitecture", doc: ["optional building kit; omitted keeps ordinary city geometry", "可选建筑外形组合；省略时保留普通城市几何形状"] }
];
const CITY_ARCHITECTURE_SPECS = [
  { name: "forms", type: "enums", values: CITY_FORMS, min: 1, max: CITY_FORMS.length, def: "slab, court, terrace, stepped", doc: ["distinct building forms to mix: slab blocks, courtyard blocks, terraces and stepped towers", "混合使用的不同建筑形态：板楼、庭院街区、露台楼与阶梯塔楼"] },
  { name: "minStoreys", type: "int", min: 1, max: 4, def: "2", doc: ["minimum target storeys for the main building; smaller lots and wings may be shorter; must not exceed maxStoreys", "主楼目标楼层下限；小地块与附楼可更低；不能超过 maxStoreys"] },
  { name: "maxStoreys", type: "int", min: 1, max: 4, def: "4", doc: ["maximum target storeys for the main building; does not change terrain height or cover", "主楼目标楼层上限；不改变地形高度或掩护"] },
  { name: "coverage", type: "number", min: 0.35, max: 0.9, def: "0.72", doc: ["building coverage within each visual lot", "每个外观地块的建筑覆盖比例"] },
  { name: "greenery", type: "number", min: 0, max: 1, def: "0.1", doc: ["decorative vegetation density", "装饰植被密度"] },
  { name: "equipment", type: "number", min: 0, max: 1, def: "0.65", doc: ["rooftop machinery and service equipment density", "屋顶机械与附属设备密度"] },
  { name: "facade", type: "enum", values: ["ribbon", "panel", "industrial"], def: "panel", doc: ["wall structure: ribbon windows, panel cladding or industrial frames", "墙面结构：带状窗、面板外墙或工业框架"] }
];
function cloneTable(table) {
  return cloneData(table);
}
const VANILLA = cloneTable(DEFS);
const VANILLA_IDS = VANILLA_DEF_IDS;
function aliasesOf(table) {
  const out = /* @__PURE__ */ new Set();
  for (const d of Object.values(table)) for (const a of d.aliases ?? []) out.add(a);
  return out;
}
function spriteKeysOf(table) {
  const out = /* @__PURE__ */ new Set();
  for (const d of Object.values(table)) {
    out.add(d.sprite);
    if (d.turretSprite) out.add(d.turretSprite);
    for (const dc of d.decals ?? []) out.add(dc.sprite);
  }
  return out;
}
const VANILLA_SPRITE_KEYS = spriteKeysOf(VANILLA);
const LINES = {
  ground: [["factory"], ["factory2"], ["factory3"]],
  ship: [["navyard"], ["navyard2"], ["navyard3"]],
  air: [["airbase"], ["airbase2"], ["airbase3"]],
  amphibious: [["factory", "navyard"], ["factory2", "navyard2"], ["factory3", "navyard3"]]
};
function defaultProducers(domain, tier) {
  const line = LINES[domain] ?? LINES.ground;
  return line.slice(Math.max(0, Math.min(2, tier - 1))).flat();
}
const SOUND_BY_CLASS = {
  mg: "mg",
  autocannon: "autocannon",
  cannon: "cannon",
  at: "missile",
  he: "arty",
  rocket: "rocket",
  navgun: "cannon",
  ashm: "missile",
  torpedo: "torpedo",
  aa: "flak"
};
const PROJECTILE_BY_CLASS = {
  mg: "bullet",
  autocannon: "bullet",
  cannon: "shell",
  at: "missile",
  he: "shell",
  rocket: "rocket",
  navgun: "shell",
  ashm: "missile",
  torpedo: "torpedo",
  aa: "flak"
};
const SPEED_BY_PROJECTILE = {
  bullet: 500,
  shell: 420,
  missile: 320,
  rocket: 300,
  bomb: 120,
  torpedo: 150,
  flak: 460,
  nuke: 96,
  flame: 200,
  fire: 0
};
const TARGETS_BY_CLASS = {
  aa: ["air"],
  torpedo: ["ship", "sub"],
  ashm: ["ship"]
};
function contentText(v, fallback = "") {
  const given = (lang) => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[langIndex(lang)];
    if (v && typeof v === "object") return v[lang];
    return void 0;
  };
  const en = typeof given("en") === "string" ? given("en") : fallback;
  return LANGS.map((lang) => typeof given(lang) === "string" ? given(lang) : en);
}
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function isText(v) {
  if (typeof v === "string") return v.length <= 400;
  if (Array.isArray(v)) return v.length >= 1 && v.length <= LANGS.length && v.every((x) => typeof x === "string" && x.length <= 400);
  if (isPlainObject(v)) return typeof v.en === "string" && LANGS.every((lang) => v[lang] === void 0 || typeof v[lang] === "string");
  return false;
}
function checkField(spec, value, path, issues) {
  const bad = (message) => {
    issues.push({ path, message });
    return false;
  };
  const min = spec.min ?? -Infinity, max = spec.max ?? Infinity;
  switch (spec.type) {
    case "string":
      if (typeof value !== "string") return bad("must be a string");
      if (value.length === 0) return bad("must not be empty");
      if (value.length > (spec.max ?? 200)) return bad(`must be at most ${spec.max ?? 200} characters`);
      return true;
    case "text":
      return isText(value) || bad(`must be a string, [${LANGS.join(", ")}] or { ${LANGS.join(", ")} }`);
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return bad("must be a number");
      if (value < min || value > max) return bad(`must be between ${min} and ${max}`);
      return true;
    case "int":
      if (!Number.isInteger(value)) return bad("must be a whole number");
      if (value < min || value > max) return bad(`must be between ${min} and ${max}`);
      return true;
    case "bool":
      return typeof value === "boolean" || bad("must be true or false");
    case "enum":
      return typeof value === "string" && spec.values.includes(value) || bad(`must be one of ${spec.values.join(", ")}`);
    case "enums":
      if (!Array.isArray(value) || value.length < (spec.min ?? 1) || value.length > (spec.max ?? spec.values.length))
        return bad(`must list ${spec.min ?? 1}–${spec.max ?? spec.values.length} distinct choices`);
      if (new Set(value).size !== value.length) return bad("must not repeat a choice");
      return value.every((entry) => typeof entry === "string" && spec.values.includes(entry)) || bad(`every choice must be one of ${spec.values.join(", ")}`);
    case "id":
      return typeof value === "string" && ID_RE.test(value) || bad("must be an id: lower case letters, digits, - or _, 2–40 characters");
    case "ids":
      if (!Array.isArray(value) || value.length > (spec.max ?? 64)) return bad("must be a list of ids");
      for (const x of value) if (typeof x !== "string" || !ID_RE.test(x)) return bad(`"${String(x)}" is not an id`);
      return true;
    case "strings":
      if (!Array.isArray(value) || value.length > 32) return bad("must be a list of strings");
      for (const x of value) if (typeof x !== "string" || x.length === 0 || x.length > 40) return bad("every entry must be a short string");
      return true;
    case "images":
      if (!Array.isArray(value) || value.length > MAX_MOD_SCREENSHOTS) return bad(`must be a list of up to ${MAX_MOD_SCREENSHOTS} image paths`);
      for (const x of value) {
        if (typeof x !== "string" || !FILE_RE.test(x)) return bad(`"${String(x)}" is not a relative path inside the mod`);
        if (!IMAGE_FILE_RE.test(x)) return bad(`${x} is not a PNG, JPEG or WebP`);
      }
      return true;
    case "maps":
      if (!Array.isArray(value) || value.length > MAX_MOD_MAPS) return bad(`must be a list of up to ${MAX_MOD_MAPS} map paths`);
      for (const x of value) {
        if (typeof x !== "string" || !FILE_RE.test(x)) return bad(`"${String(x)}" is not a relative path inside the mod`);
        if (!MAP_FILE_RE.test(x)) return bad(`${x} is not a .steel-tide-map file`);
      }
      if (new Set(value).size !== value.length) return bad("names a map twice");
      return true;
    case "targets":
      if (!Array.isArray(value) || value.length === 0 || value.length > 4) return bad("must list one to four of ground, ship, sub, air");
      for (const x of value) if (!TARGET_DOMAINS.includes(x)) return bad(`"${String(x)}" is not a target domain`);
      return true;
    case "mult":
      if (!isPlainObject(value)) return bad("must be an object keyed by armour class");
      for (const [k, v] of Object.entries(value)) {
        if (!ARMOR_CLASSES.includes(k)) return bad(`"${k}" is not an armour class`);
        if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10) return bad(`${k} must be a number between 0 and 10`);
      }
      return true;
    case "directionalArmor":
      if (!isPlainObject(value)) return bad("must be { front, side, rear } damage multipliers");
      for (const k of Object.keys(value)) if (k !== "front" && k !== "side" && k !== "rear") return bad(`"${k}" is not an armour facing`);
      for (const k of ["front", "side", "rear"]) {
        const n = value[k];
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) return bad(`${k} must be a number between 0 and 10`);
      }
      return true;
    case "body": {
      if (!isPlainObject(value)) return bad('must be { "r": half-width, "len": length }, world px');
      for (const k of Object.keys(value)) if (k !== "r" && k !== "len") return bad(`"${k}" is not a field of a body`);
      const r = value.r, len = value.len;
      if (typeof r !== "number" || !Number.isFinite(r) || r < 1 || r > 200) return bad("r must be a number between 1 and 200");
      if (typeof len !== "number" || !Number.isFinite(len) || len < 0 || len > 400) return bad("len must be a number between 0 and 400");
      return true;
    }
    case "pair":
      return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number" && n >= 0 && n <= 1) || bad("must be [x, y] fractions between 0 and 1");
    case "quad":
      return Array.isArray(value) && value.length === 4 && value.every((n) => typeof n === "number" && n >= 0 && n <= 1) || bad("must be [x0, y0, x1, y1] fractions between 0 and 1");
    case "barrels":
      if (!Array.isArray(value) || value.length < min || value.length > max) return bad(`must list ${min}–${max} barrel rectangles`);
      for (let i = 0; i < value.length; i++) {
        const r = value[i];
        if (!Array.isArray(r) || r.length !== 4 || r.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1))
          return bad(`barrel ${i} must be [left, top, right, bottom] fractions between 0 and 1`);
        if (r[0] >= r[2] || r[1] >= r[3]) return bad(`barrel ${i} must have positive width and height`);
        for (let j = 0; j < i; j++) {
          const other = value[j];
          if (r[0] < other[2] && r[2] > other[0] && r[1] < other[3] && r[3] > other[1])
            return bad(`barrels ${j} and ${i} must not overlap`);
        }
      }
      return true;
    case "decals":
      return Array.isArray(value) && value.length <= MAX_DEF_DECALS || bad(`must be a list of up to ${MAX_DEF_DECALS} decals`);
    case "mounts":
      return Array.isArray(value) && value.length >= 1 && value.length <= MAX_DEF_MOUNTS || bad(`must be a list of one to ${MAX_DEF_MOUNTS} mounts`);
    case "muzzles":
      if (!Array.isArray(value) || value.length < min || value.length > max) return bad(`must list ${min}–${max} muzzle points`);
      for (const point of value) {
        if (!isPlainObject(point)) return bad("every muzzle point must be { forward, lateral }");
        for (const key of Object.keys(point)) if (key !== "forward" && key !== "lateral") return bad(`"${key}" is not a muzzle coordinate`);
        for (const key of ["forward", "lateral"]) {
          const n = point[key];
          if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 200) return bad(`${key} must be a number between -200 and 200`);
        }
      }
      return true;
    case "menuQueue":
      return Array.isArray(value) && value.length >= 1 && value.length <= MAX_MENU_QUEUE && value.every((id2) => typeof id2 === "string" && ID_RE.test(id2)) || bad(`must be a list of 1–${MAX_MENU_QUEUE} cut ids`);
    case "menuCuts":
      return Array.isArray(value) && value.length <= MAX_MENU_CUTS || bad(`must be a list of up to ${MAX_MENU_CUTS} cuts`);
    case "menuOrders":
      return Array.isArray(value) && value.length <= MAX_PLAYERS || bad(`must be a list of up to ${MAX_PLAYERS} opening orders`);
    case "musicQueue":
      return Array.isArray(value) && value.length <= MAX_MOD_MUSIC_QUEUE && value.every((id2) => typeof id2 === "string" && ID_RE.test(id2)) || bad(`must be a list of up to ${MAX_MOD_MUSIC_QUEUE} track ids`);
    case "musicTracks":
      return Array.isArray(value) && value.length <= MAX_MOD_MUSIC_TRACKS || bad(`must be a list of up to ${MAX_MOD_MUSIC_TRACKS} tracks`);
    case "weapons":
    case "factions":
    case "terrains":
    case "defs":
    case "sprites":
    case "sounds":
      return Array.isArray(value) || bad("must be a list");
    case "files":
      return isPlainObject(value) || bad("must be an object of path → data URL");
    // read word for word once the mod's defs and sheets are known (`game/ruleSpec.ts`)
    case "rules":
      return Array.isArray(value) || bad("must be a list of rules");
    case "capabilities":
      return Array.isArray(value) && value.length >= 1 && value.length <= 32 && value.every(validCapabilityId) && new Set(value).size === value.length || bad("must contain 1–32 unique bounded capability identifiers");
    case "extensionPackages":
      return Array.isArray(value) && value.length <= 16 || bad("must be a list of up to 16 extension packages");
    case "extensions":
    case "shield":
    case "look":
    case "anims":
    case "wing":
    case "cityTerrain":
    case "cityArchitecture":
    case "menuBackground":
    case "menuCamera":
    case "music":
      return isPlainObject(value) || bad("must be an object");
    // a rule's own words never stand in a table this checks: `game/ruleSpec.ts` reads them
    default:
      return true;
  }
}
function checkObject(raw, specs, path, issues, warnings, opts = {}) {
  const out = {};
  const known = new Set(specs.map((s) => s.name));
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) warnings.push({ path: `${path}.${key}`, message: "unknown field, ignored" });
  }
  for (const spec of specs) {
    const value = raw[spec.name];
    if (value === void 0 || value === null) {
      const needed = spec.required === true || spec.required && spec.required === opts.kind;
      if (needed && !opts.skipRequired?.has(spec.name)) issues.push({ path: `${path}.${spec.name}`, message: "is required" });
      continue;
    }
    if (spec.only && opts.kind && spec.only !== opts.kind) {
      warnings.push({ path: `${path}.${spec.name}`, message: `only applies to a ${spec.only}, ignored` });
      continue;
    }
    if (checkField(spec, value, `${path}.${spec.name}`, issues)) out[spec.name] = value;
  }
  return out;
}
function parseDefinitionPack(input) {
  let raw = input;
  if (typeof input === "string") {
    if (input.length > MAX_MANIFEST_BYTES + MAX_MOD_FILES_BYTES) return { ok: false, errors: [{ path: "", message: "the manifest is too large" }], warnings: [] };
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, errors: [{ path: "", message: "not valid JSON" }], warnings: [] };
    }
  }
  if (!isPlainObject(raw)) return { ok: false, errors: [{ path: "", message: "not a mod manifest" }], warnings: [] };
  const { files: embedded, ...metadata } = raw;
  try {
    if (JSON.stringify(metadata).length > MAX_MANIFEST_BYTES)
      return { ok: false, errors: [{ path: "", message: "the manifest is too large" }], warnings: [] };
  } catch {
    return { ok: false, errors: [{ path: "", message: "manifest metadata must be JSON data" }], warnings: [] };
  }
  if (isPlainObject(embedded) && Object.values(embedded).reduce((size, data) => size + (typeof data === "string" ? data.length : 0), 0) > MAX_MOD_FILES_BYTES)
    return { ok: false, errors: [{ path: "files", message: "the embedded files are too large" }], warnings: [] };
  if (raw.format !== MOD_FORMAT) return { ok: false, errors: [{ path: "format", message: `must be "${MOD_FORMAT}"` }], warnings: [] };
  if (raw.v !== 1 && raw.v !== 2 && raw.v !== 3 && raw.v !== MOD_FORMAT_VERSION) return { ok: false, errors: [{ path: "v", message: `unsupported format version ${String(raw.v)} (this game reads 1–${MOD_FORMAT_VERSION})` }], warnings: [] };
  if (needsContentSchema(raw) && !contentSchemaPrepared()) return { ok: false, errors: [{ path: "v", message: "content extension schema must be prepared before validation" }], warnings: [] };
  const errors = [];
  const warnings = [];
  const head = checkObject(raw, MANIFEST_SPECS, "mod", errors, warnings);
  if (errors.length > 0) return { ok: false, errors, warnings };
  if (head.requiredCapabilities !== void 0 && Number(head.v) < 3) errors.push({ path: "mod.requiredCapabilities", message: "engine capabilities require format 3" });
  if (head.extensionPackages !== void 0) {
    if (Number(head.v) < 4) errors.push({ path: "mod.extensionPackages", message: "executable extension packages require format 4" });
    validateContentPackages(head.extensionPackages, errors);
  }
  if (errors.length) return { ok: false, errors, warnings };
  const available = new Set((head.extensionPackages ?? []).flatMap((p) => p.capabilities ?? []));
  for (const id2 of head.requiredCapabilities ?? []) if (!available.has(id2)) errors.push({ path: "mod.requiredCapabilities", message: `no extension package provides ${id2}` });
  const defs = head.defs;
  const terrains = head.terrains ?? [];
  if (terrains.length > MAX_MOD_TERRAINS) errors.push({ path: "mod.terrains", message: `at most ${MAX_MOD_TERRAINS} terrain variants` });
  if (defs.length > MAX_MOD_DEFS) errors.push({ path: "mod.defs", message: `at most ${MAX_MOD_DEFS} defs` });
  const sprites = head.sprites ?? [];
  if (sprites.length > MAX_MOD_SPRITES) errors.push({ path: "mod.sprites", message: `at most ${MAX_MOD_SPRITES} sheets` });
  const sounds = head.sounds ?? [];
  if (sounds.length > MAX_MOD_SOUNDS) errors.push({ path: "mod.sounds", message: `at most ${MAX_MOD_SOUNDS} sounds` });
  if (errors.length > 0) return { ok: false, errors, warnings };
  const files = head.files;
  if (files) {
    for (const [k, v] of Object.entries(files)) {
      if (typeof v !== "string" || !v.startsWith("data:")) errors.push({ path: `mod.files.${k}`, message: "must be a data URL" });
    }
  }
  const mod = {
    ...head,
    defs,
    sprites,
    sounds,
    ...files ? { files } : {}
  };
  if (files) {
    for (const [i, pkg] of (mod.extensionPackages ?? []).entries())
      for (const [id2, file] of Object.entries(pkg.assets ?? {}))
        if (!Object.hasOwn(files, file)) errors.push({ path: `extensionPackages[${i}].assets.${id2}`, message: `"${file}" is not among the embedded files` });
  }
  const resolved = resolveDefinitions(mod, VANILLA);
  if (defs.length === 0 && terrains.length === 0 && !CONTENT_MUSIC_SLOTS.some((slot) => mod.music?.[slot] !== void 0) && !mod.menuBackground?.queue?.length) errors.push({ path: "mod.defs", message: "a mod needs at least one def, terrain variant, music queue or menu background" });
  errors.push(...resolved.errors);
  warnings.push(...resolved.warnings);
  return errors.length > 0 ? { ok: false, errors, warnings } : { ok: true, pack: mod, warnings };
}
function resolveDefinitions(mod, table = VANILLA) {
  const errors = [];
  const warnings = [];
  const defs = [];
  const patches = [];
  const strings = {};
  const placeholders = [];
  const built = /* @__PURE__ */ new Map();
  const aliases = aliasesOf(table);
  const tableSprites = spriteKeysOf(table);
  const sheetKeys = /* @__PURE__ */ new Set();
  const cleanSprites = [];
  (mod.sprites ?? []).forEach((raw, i) => {
    const path = `sprites[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, SPRITE_SPECS, path, errors, warnings);
    if (typeof clean.key !== "string" || typeof clean.file !== "string") return;
    if (!ATLAS_KEY_RE.test(clean.key)) {
      errors.push({ path: `${path}.key`, message: "must be u.<id>, tur.<id>, dec.<name>, prj.<name>, fx.<name> or ter.<mod id>-<name>" });
      return;
    }
    if (clean.key.startsWith("ter.")) {
      if (!clean.key.startsWith(`ter.${mod.id}-`) || clean.key.length <= `ter.${mod.id}-`.length) {
        errors.push({ path: `${path}.key`, message: `terrain materials must be named "ter.${mod.id}-<name>"` });
        return;
      }
      if ((clean.frames ?? 1) !== 1) errors.push({ path: `${path}.frames`, message: "terrain materials have one frame" });
      for (const field of ["rotated", "teams", "stripBg", "fitFootprint", "freezeStatic"]) {
        if (clean[field] === true) errors.push({ path: `${path}.${field}`, message: "terrain materials preserve their square image without rotation, recoloring or cleanup" });
        clean[field] = false;
      }
      if (!Number.isInteger(clean.fw) || !Number.isInteger(clean.fh) || clean.fw !== clean.fh)
        errors.push({ path, message: "terrain materials require equal whole fw and fh between 4 and 512 (128 recommended)" });
      for (const field of ["anchorY", "mount", "anims", "animRegion", "pivotX", "pivotY", "barrels"]) {
        if (clean[field] !== void 0) errors.push({ path: `${path}.${field}`, message: "not supported on a flat terrain material" });
      }
    }
    if (VANILLA_SPRITE_KEYS.has(clean.key) || tableSprites.has(clean.key) && !sheetKeys.has(clean.key) && !mod.defs.some((d) => d && (d.sprite === clean.key || d.turretSprite === clean.key || `u.${d.id}` === clean.key || `tur.${d.id}` === clean.key))) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is art the game already has; a mod adds art, it does not replace it` });
      return;
    }
    if (!FILE_RE.test(clean.file)) {
      errors.push({ path: `${path}.file`, message: "must be a relative path inside the mod" });
      return;
    }
    if (sheetKeys.has(clean.key)) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is listed twice` });
      return;
    }
    if (mod.files && !(clean.file in mod.files)) errors.push({ path: `${path}.file`, message: `"${clean.file}" is not among the embedded files` });
    for (const side of ["fw", "fh"]) {
      const v = clean[side];
      if (typeof v === "number" && !Number.isInteger(v)) warnings.push({ path: `${path}.${side}`, message: `${v} is not a whole number of pixels; the game bakes it as ${Math.round(v)}` });
    }
    if (clean.anims !== void 0) {
      const anims = readAnims(clean.anims, clean.frames ?? 1, `${path}.anims`, errors);
      if (!anims) return;
      clean.anims = anims;
    }
    sheetKeys.add(clean.key);
    cleanSprites.push({ ...clean, frames: clean.frames ?? 1 });
  });
  mod.sprites = cleanSprites;
  if (mod.terrains !== void 0) {
    const cleanTerrains = [];
    const terrainIds = /* @__PURE__ */ new Set();
    if (!Array.isArray(mod.terrains) || mod.terrains.length > MAX_MOD_TERRAINS)
      errors.push({ path: "terrains", message: `must be a list of up to ${MAX_MOD_TERRAINS} terrain variants` });
    else mod.terrains.forEach((raw, i) => {
      const path = `terrains[${i}]`;
      const before = errors.length;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: "must be an object" });
        return;
      }
      const clean = checkObject(raw, TERRAIN_SPECS, path, errors, warnings);
      if (!clean.id || !clean.base || clean.name === void 0) return;
      if (!clean.id.startsWith(`${mod.id}-`) || clean.id.length <= mod.id.length + 1 || terrainIds.has(clean.id))
        errors.push({ path: `${path}.id`, message: "must be unique and prefixed with the mod id and a dash" });
      terrainIds.add(clean.id);
      const material = (key, at) => {
        if (key !== void 0 && (!key.startsWith(`ter.${mod.id}-`) || !sheetKeys.has(key)))
          errors.push({ path: at, message: "must name a terrain material sheet belonging to this mod" });
      };
      material(clean.texture, `${path}.texture`);
      let city;
      if (clean.city !== void 0) {
        if (clean.base !== "city") errors.push({ path: `${path}.city`, message: "city materials require base city" });
        if (clean.city.architecture === null) errors.push({ path: `${path}.city.architecture`, message: "must be an object" });
        const fields = checkObject(clean.city, CITY_TERRAIN_SPECS, `${path}.city`, errors, warnings);
        for (const color of ["roof", "wall", "window", "lamp", "accent", "accent2"]) {
          if (fields[color] !== void 0 && !/^#[0-9a-fA-F]{6}$/.test(fields[color]))
            errors.push({ path: `${path}.city.${color}`, message: "must be a #RRGGBB color" });
        }
        for (const texture of ["roofTexture", "wallTexture", "groundTexture", "signTexture"]) material(fields[texture], `${path}.city.${texture}`);
        if (fields.architecture !== void 0) {
          for (const spec of CITY_ARCHITECTURE_SPECS) {
            if (fields.architecture[spec.name] === null)
              errors.push({ path: `${path}.city.architecture.${spec.name}`, message: "must not be null; omit the field to use its default" });
          }
          const architecture = checkObject(fields.architecture, CITY_ARCHITECTURE_SPECS, `${path}.city.architecture`, errors, warnings);
          if ((architecture.minStoreys ?? 2) > (architecture.maxStoreys ?? 4))
            errors.push({ path: `${path}.city.architecture.minStoreys`, message: "must not exceed maxStoreys (defaults: minStoreys 2, maxStoreys 4)" });
          if (architecture.forms) architecture.forms = Object.freeze([...architecture.forms]);
          fields.architecture = Object.freeze(architecture);
        }
        city = Object.freeze(fields);
      }
      if (clean.base === "city") {
        if (clean.texture !== void 0) errors.push({ path: `${path}.texture`, message: "city uses city.roofTexture, wallTexture and groundTexture" });
        if (!city || Object.keys(city).length === 0) errors.push({ path: `${path}.city`, message: "a city variant needs at least one material, color or architecture" });
      } else if (clean.texture === void 0) errors.push({ path: `${path}.texture`, message: "a flat terrain variant needs a texture" });
      if (errors.length !== before) return;
      cleanTerrains.push(Object.freeze({
        id: clean.id,
        name: Object.freeze(contentText(clean.name)),
        base: clean.base,
        ...clean.texture ? { texture: clean.texture } : {},
        ...city ? { city } : {}
      }));
    });
    mod.terrains = cleanTerrains;
  }
  const soundKeys = /* @__PURE__ */ new Set();
  const cleanSounds = [];
  (mod.sounds ?? []).forEach((raw, i) => {
    const path = `sounds[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, SOUND_SPECS, path, errors, warnings);
    if (typeof clean.key !== "string" || typeof clean.file !== "string") return;
    if (!SOUND_KEY_RE.test(clean.key) || !clean.key.startsWith(`${mod.id}-`)) {
      errors.push({ path: `${path}.key`, message: `must be "${mod.id}-<name>", lower case` });
      return;
    }
    if (!FILE_RE.test(clean.file)) {
      errors.push({ path: `${path}.file`, message: "must be a relative path inside the mod" });
      return;
    }
    if (soundKeys.has(clean.key)) {
      errors.push({ path: `${path}.key`, message: `"${clean.key}" is listed twice` });
      return;
    }
    if (mod.files && !(clean.file in mod.files)) errors.push({ path: `${path}.file`, message: `"${clean.file}" is not among the embedded files` });
    soundKeys.add(clean.key);
    cleanSounds.push({ key: clean.key, file: clean.file });
  });
  mod.sounds = cleanSounds;
  if (mod.music !== void 0) {
    if (!isPlainObject(mod.music)) errors.push({ path: "music", message: "must be an object" });
    else {
      const music = checkObject(mod.music, MUSIC_SPECS, "music", errors, warnings);
      const ids = /* @__PURE__ */ new Set();
      const tracks = [];
      (music.tracks ?? []).forEach((raw, i) => {
        const path = `music.tracks[${i}]`;
        if (!isPlainObject(raw)) {
          errors.push({ path, message: "must be an object" });
          return;
        }
        const track = checkObject(raw, MUSIC_TRACK_SPECS, path, errors, warnings);
        if (typeof track.id !== "string" || typeof track.file !== "string") return;
        if (!track.id.startsWith(`${mod.id}-`) || track.id.length <= mod.id.length + 1 || MUSIC_IDS.has(track.id)) errors.push({ path: `${path}.id`, message: `must be a new "${mod.id}-<name>" track id` });
        if (ids.has(track.id)) errors.push({ path: `${path}.id`, message: "track id is listed twice" });
        if (!FILE_RE.test(track.file) || !/\.(mp3|ogg|wav)$/i.test(track.file)) errors.push({ path: `${path}.file`, message: "must be a relative MP3, Ogg or WAV path inside the mod" });
        if (mod.files && !Object.prototype.hasOwnProperty.call(mod.files, track.file)) errors.push({ path: `${path}.file`, message: `"${track.file}" is not among the embedded files` });
        ids.add(track.id);
        tracks.push(track);
      });
      for (const slot of CONTENT_MUSIC_SLOTS) music[slot]?.forEach((id2, i) => {
        if (!MUSIC_IDS.has(id2) && !ids.has(id2)) errors.push({ path: `music.${slot}[${i}]`, message: `"${id2}" is neither a built-in track nor one of this pack's tracks` });
      });
      mod.music = { ...music, tracks };
    }
  }
  if (mod.menuBackground !== void 0) {
    const bg = checkObject(mod.menuBackground, MENU_BACKGROUND_SPECS, "menuBackground", errors, warnings);
    const ids = /* @__PURE__ */ new Set();
    const cuts = [];
    (bg.cuts ?? []).forEach((raw, i) => {
      const path = `menuBackground.cuts[${i}]`;
      if (!isPlainObject(raw)) {
        errors.push({ path, message: "must be an object" });
        return;
      }
      const cut = checkObject(raw, MENU_CUT_SPECS, path, errors, warnings);
      if (typeof cut.id !== "string") return;
      if (!cut.id.startsWith(`${mod.id}-`) || cut.id.length <= mod.id.length + 1 || MENU_CUT_IDS.includes(cut.id)) errors.push({ path: `${path}.id`, message: `must be a new "${mod.id}-<name>" cut id` });
      if (ids.has(cut.id)) errors.push({ path: `${path}.id`, message: "cut id is listed twice" });
      ids.add(cut.id);
      if (!mod.maps?.includes(cut.map)) errors.push({ path: `${path}.map`, message: "must name a file listed in this pack’s maps" });
      for (const key of ["camera", "cameraEnd"]) if (cut[key]) cut[key] = checkObject(cut[key], MENU_CAMERA_SPECS, `${path}.${key}`, errors, warnings);
      const owners = /* @__PURE__ */ new Set();
      cut.orders = (cut.orders ?? []).flatMap((raw2, k) => {
        const orderPath = `${path}.orders[${k}]`;
        if (!isPlainObject(raw2)) {
          errors.push({ path: orderPath, message: "must be an object" });
          return [];
        }
        const order = checkObject(raw2, MENU_ORDER_SPECS, orderPath, errors, warnings);
        if (owners.has(order.owner)) errors.push({ path: `${orderPath}.owner`, message: "owner is listed twice" });
        owners.add(order.owner);
        return [order];
      });
      cuts.push(cut);
    });
    const queue = bg.queue ?? [];
    queue.forEach((id2, i) => {
      if (!MENU_CUT_IDS.includes(id2) && !ids.has(id2)) errors.push({ path: `menuBackground.queue[${i}]`, message: `"${id2}" is neither an original cut nor one of this pack’s cuts` });
    });
    mod.menuBackground = { cuts, queue };
  }
  mod.defs.forEach((raw, i) => {
    const path = `defs[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const id2 = raw.id;
    if (typeof id2 !== "string" || !ID_RE.test(id2)) {
      errors.push({ path: `${path}.id`, message: "must be an id: lower case letters, digits, - or _, 2–40 characters" });
      return;
    }
    if (table[id2]) {
      errors.push({ path: `${path}.id`, message: `"${id2}" is already a def${VANILLA_IDS.has(id2) ? " of the game" : ` (mod ${table[id2].mod ?? "?"})`}` });
      return;
    }
    if (built.has(id2)) {
      errors.push({ path: `${path}.id`, message: `"${id2}" is defined twice` });
      return;
    }
    if (aliases.has(id2)) {
      errors.push({ path: `${path}.id`, message: `"${id2}" is an alias of a def of the game` });
      return;
    }
    let base;
    if (raw.extends !== void 0) {
      if (typeof raw.extends !== "string" || !(table[raw.extends] ?? built.get(raw.extends))) {
        errors.push({ path: `${path}.extends`, message: `"${String(raw.extends)}" is not a def it can extend` });
        return;
      }
      base = table[raw.extends] ?? built.get(raw.extends);
      if (base.warhead || base.isHQ && mod.v < 2) {
        errors.push({ path: `${path}.extends`, message: `"${raw.extends}" cannot be extended in this format` });
        return;
      }
    }
    const kind = raw.kind ?? base?.kind;
    if (kind !== "unit" && kind !== "building") {
      errors.push({ path: `${path}.kind`, message: 'must be "unit" or "building"' });
      return;
    }
    const clean = checkObject(raw, DEF_SPECS, path, errors, warnings, {
      kind,
      // the base supplies what a fresh def would have to state
      skipRequired: base ? /* @__PURE__ */ new Set(["kind", "cost", "hp"]) : void 0
    });
    const own = clean;
    if (own.isHQ && mod.v < 2) errors.push({ path: `${path}.isHQ`, message: "headquarters require format 2" });
    if (own.name === void 0) return;
    if (own.kind === void 0) own.kind = kind;
    const def = buildDef(own, kind, base, mod.id, soundKeys, path, errors, warnings);
    if (def?.isHQ && (def.kind !== "building" || def.offshore || def.needsDeposit)) errors.push({ path: `${path}.isHQ`, message: "a headquarters must be a land building without a deposit requirement" });
    if (!def) return;
    if (def.extensions !== void 0 || def.weapons.some((w2) => w2.extensions !== void 0)) {
      const extensionContext = { definition: { ...def, ...raw, extensions: def.extensions, weapons: def.weapons }, weaponIds: def.weapons.map((w2) => w2.id), defIds: /* @__PURE__ */ new Set([...Object.keys(table), ...mod.defs.map((d) => d.id)]), spriteKeys: /* @__PURE__ */ new Set([...tableSprites, ...sheetKeys]) };
      if (def.extensions !== void 0) def.extensions = readExtensions$1(def.extensions, mod, `${path}.extensions`, errors, extensionContext);
      def.weapons.forEach((w2, wi) => {
        if (w2.extensions !== void 0) w2.extensions = readExtensions$1(w2.extensions, mod, `${path}.weapons[${wi}].extensions`, errors, extensionContext, true);
      });
    }
    const lookCtx = ruleContext(def, table, built, sheetKeys, soundKeys);
    def.weapons.forEach((wp, k) => {
      if (!wp.look || !own.weapons?.[k]?.look) return;
      const look = readLook(wp.look, `${path}.weapons[${k}].look`, lookCtx, errors);
      if (!look) {
        delete wp.look;
        return;
      }
      wp.look = look;
      if (look.beam) wp.speed = 5e3;
    });
    if (own.shield !== void 0) {
      const shield = readShield(own.shield, `${path}.shield`, lookCtx, errors);
      if (shield) def.shield = shield;
      else delete def.shield;
    }
    const ownSheet = sheetKeys.has(`u.${id2}`);
    const bodyKey = own.sprite ?? (ownSheet ? `u.${id2}` : base?.sprite ?? `u.${id2}`);
    if (!sheetKeys.has(bodyKey) && !tableSprites.has(bodyKey)) {
      if (own.sprite) errors.push({ path: `${path}.sprite`, message: `"${bodyKey}" is neither a sheet of this mod nor art the game has` });
      else {
        warnings.push({ path: `${path}.sprite`, message: `no sheet u.${id2}: a placeholder is drawn until one is added` });
        placeholders.push(bodyKey);
      }
    }
    def.sprite = bodyKey;
    const ownTurret = sheetKeys.has(`tur.${id2}`);
    const turretKey = own.turretSprite ?? (ownTurret ? `tur.${id2}` : own.sprite !== void 0 || ownSheet ? void 0 : base?.turretSprite);
    if (turretKey !== void 0) {
      if (!sheetKeys.has(turretKey) && !tableSprites.has(turretKey)) {
        errors.push({ path: `${path}.turretSprite`, message: `"${turretKey}" is neither a sheet of this mod nor art the game has` });
      } else def.turretSprite = turretKey;
    } else delete def.turretSprite;
    for (const wp of def.weapons) if (wp.turret === void 0) wp.turret = !!def.turretSprite;
    if (own.turretMounts !== void 0) {
      const rings = [];
      own.turretMounts.forEach((rawMount, k) => {
        const mpath = `${path}.turretMounts[${k}]`;
        if (!isPlainObject(rawMount)) {
          errors.push({ path: mpath, message: "must be an object" });
          return;
        }
        const m = checkObject(rawMount, MOUNT_SPECS, mpath, errors, warnings);
        const ring = { x: m.x ?? 0, y: m.y ?? 0 };
        if (m.rest) ring.rest = m.rest * Math.PI / 180;
        if (m.arc !== void 0 && m.arc < 180) ring.arc = m.arc * Math.PI / 180;
        rings.push(ring);
      });
      if (rings.length > 0) def.turretMounts = rings;
      else delete def.turretMounts;
    } else if (own.sprite !== void 0 || ownSheet) delete def.turretMounts;
    const rawDecals = own.decals ?? (own.sprite !== void 0 || ownSheet ? void 0 : base?.decals);
    delete def.decals;
    if (rawDecals) {
      const list = [];
      rawDecals.forEach((rawDecal, k) => {
        const dpath = `${path}.decals[${k}]`;
        if (!isPlainObject(rawDecal)) {
          errors.push({ path: dpath, message: "must be an object" });
          return;
        }
        const dc = checkObject(rawDecal, DECAL_SPECS, dpath, errors, warnings);
        if (typeof dc.sprite !== "string") return;
        if (!sheetKeys.has(dc.sprite) && !tableSprites.has(dc.sprite)) {
          errors.push({ path: `${dpath}.sprite`, message: `"${dc.sprite}" is neither a sheet of this mod nor art the game has` });
          return;
        }
        if (dc.on === "turret" && !def.turretSprite) {
          errors.push({ path: `${dpath}.on`, message: "fixed to a turret the def does not have" });
          return;
        }
        list.push(dc);
      });
      if (list.length > 0) def.decals = list;
    }
    for (const a of def.aliases ?? []) {
      if (aliases.has(a) || table[a] || built.has(a)) errors.push({ path: `${path}.aliases`, message: `"${a}" is already a name of another def` });
      aliases.add(a);
    }
    built.set(id2, def);
    defs.push(def);
    strings[`unit.${id2}.name`] = contentText(own.name, id2);
    strings[`unit.${id2}.desc`] = contentText(own.desc, "");
  });
  const find = (id2) => table[id2] ?? built.get(id2);
  const forms = /* @__PURE__ */ new Set();
  mod.defs.forEach((raw, i) => {
    if (!isPlainObject(raw) || typeof raw.id !== "string") return;
    const def = built.get(raw.id);
    if (!def) return;
    const own = raw;
    const base = own.extends ? find(own.extends) : void 0;
    const path = `defs[${i}]`;
    const ids = (list, field, want) => {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const ref of list) {
        const other = find(ref);
        if (!other) errors.push({ path: `${path}.${field}`, message: `"${ref}" is not a def` });
        else if (other.kind !== want) errors.push({ path: `${path}.${field}`, message: `"${ref}" is not a ${want}` });
        else if (want === "unit" && other.warhead) errors.push({ path: `${path}.${field}`, message: `"${ref}" cannot be produced` });
        else out.push(ref);
      }
      return out;
    };
    const lines = (list) => {
      if (!Array.isArray(list)) return [];
      const out = [];
      for (const ref of list) {
        const other = find(ref);
        if (!other) errors.push({ path: `${path}.producedBy`, message: `"${ref}" is not a def` });
        else if (other.kind === "unit" && !built.has(ref)) errors.push({ path: `${path}.producedBy`, message: `"${ref}" is a unit of the game's own; only a building, or a unit of this mod, can train others` });
        else if (other.kind === "unit" && other.warhead) errors.push({ path: `${path}.producedBy`, message: `"${ref}" cannot train anything` });
        else out.push(ref);
      }
      return out;
    };
    delete def.rules;
    if (own.rules !== void 0) {
      const read2 = readRules(own.rules, `${path}.rules`, ruleContext(def, table, built, sheetKeys, soundKeys), errors);
      if (read2.rules.length) {
        def.rules = read2.rules;
        for (const r of read2.rules) {
          for (const x of r.do) {
            if (x.morph) forms.add(x.morph);
            if (x.spawn) forms.add(x.spawn.unit);
          }
        }
      }
      for (const [k, v] of Object.entries(read2.strings)) strings[k] = contentText(v, "");
    }
    delete def.wing;
    if (own.wing !== void 0) {
      const wing = readWing(own.wing, `${path}.wing`, ruleContext(def, table, built, sheetKeys, soundKeys), errors);
      if (wing) {
        def.wing = wing;
        forms.add(wing.unit);
      }
    }
    const nodes = (def.requires ?? []).filter((r) => isTechId(r));
    def.requires = [...ids((def.requires ?? []).filter((r) => !isTechId(r)), "requires", "building"), ...nodes];
    if (def.requires.length === 0) delete def.requires;
    if (def.kind === "building") {
      if (def.produces) def.produces = ids(def.produces, "produces", "unit");
      if (own.upgradeOf !== void 0) {
        const src = find(own.upgradeOf);
        if (!src || src.kind !== "building") errors.push({ path: `${path}.upgradeOf`, message: `"${own.upgradeOf}" is not a building` });
        else if (src.upgradesTo || patches.some((p) => p.kind === "upgrade" && p.target === src.id)) {
          errors.push({ path: `${path}.upgradeOf`, message: `"${own.upgradeOf}" already upgrades to ${src.upgradesTo ?? "another def of this mod"}` });
        } else if (own.upgradeOf === def.id) errors.push({ path: `${path}.upgradeOf`, message: "a building cannot upgrade to itself" });
        else {
          def.upgradeOnly = true;
          patches.push({
            kind: "upgrade",
            target: src.id,
            id: def.id,
            cost: own.upgradeCost ?? Math.max(0, def.cost - src.cost),
            time: own.upgradeTime ?? def.buildTime
          });
        }
      } else {
        const builders = own.builtBy !== void 0 ? ids(own.builtBy, "builtBy", "unit") : base ? Object.values({ ...table, ...Object.fromEntries(built) }).filter((d) => d.builds?.includes(base.id)).map((d) => d.id) : ["engineer"];
        for (const b of builders) {
          const unit = find(b);
          if (!unit.builds) {
            errors.push({ path: `${path}.builtBy`, message: `"${b}" is not a builder unit` });
            continue;
          }
          patches.push({ kind: "builds", target: b, id: def.id });
        }
        if (builders.length === 0) warnings.push({ path: `${path}.builtBy`, message: "nothing can build it" });
      }
    } else {
      if (def.builds) def.builds = ids(def.builds, "builds", "building");
      if (def.produces) def.produces = ids(def.produces, "produces", "unit");
      const producers = own.producedBy !== void 0 ? lines(own.producedBy) : base ? Object.values({ ...table, ...Object.fromEntries(built) }).filter((d) => d.produces?.includes(base.id)).map((d) => d.id) : defaultProducers(def.domain, def.tier).filter((b) => !!find(b));
      for (const b of producers) {
        const line = find(b);
        if (!line.produces && line.id !== def.id) {
          warnings.push({ path: `${path}.producedBy`, message: `"${b}" was not a factory; it becomes one` });
        }
        patches.push({ kind: "produces", target: b, id: def.id });
      }
      if (producers.length === 0 && !mod.defs.some((d) => isPlainObject(d) && Array.isArray(d.produces) && d.produces.includes(def.id))) {
        warnings.push({ path: `${path}.producedBy`, message: "nothing produces it" });
      }
    }
  });
  mod.defs.forEach((raw, i) => {
    const wing = isPlainObject(raw) && typeof raw.id === "string" ? built.get(raw.id)?.wing : void 0;
    if (!wing) return;
    const at = `defs[${i}].wing.unit`;
    const lines = patches.filter((p) => p.kind === "produces" && p.id === wing.unit).map((p) => p.target).concat(defs.filter((d) => d.produces?.includes(wing.unit)).map((d) => d.id));
    if (lines.length) errors.push({ path: at, message: `"${wing.unit}" is also built by ${lines.join(", ")}; a carrier's plane is made by its carrier alone (\`"producedBy": []\`)` });
    if (built.get(wing.unit)?.wing) errors.push({ path: at, message: `"${wing.unit}" carries a wing of its own; a carrier's plane carries none` });
  });
  if (mod.requiredCapabilities?.length) {
    const extensionTable = { ...table, ...Object.fromEntries(built) };
    defs.forEach((def, i) => validateExtensionReferences$1(def, extensionTable, `defs[${i}].extensions`, errors, forms, mod));
  }
  const quiet = warnings.filter((w2) => {
    const m = /^defs\[(\d+)\]\.producedBy$/.exec(w2.path);
    const d = m ? mod.defs[Number(m[1])] : void 0;
    return !(m && w2.message === "nothing produces it" && isPlainObject(d) && forms.has(d.id));
  });
  warnings.length = 0;
  warnings.push(...quiet);
  if (mod.factions !== void 0) {
    if (mod.v < 2) errors.push({ path: "factions", message: "factions require format 2" });
    if (!Array.isArray(mod.factions) || mod.factions.length > 16) errors.push({ path: "factions", message: "must be a list of up to 16 factions" });
    else {
      const resolved = cloneTable({ ...table, ...Object.fromEntries(built) });
      applyPatches(resolved, patches);
      const seen = /* @__PURE__ */ new Set();
      const factions = [];
      mod.factions.forEach((raw, i) => {
        const path = `factions[${i}]`;
        if (!isPlainObject(raw)) {
          errors.push({ path, message: "must be an object" });
          return;
        }
        const f = checkObject(raw, FACTION_SPECS, path, errors, warnings);
        if (!f.id || !f.headquarters || !f.builder || !f.name) return;
        if (!f.id.startsWith(`${mod.id}-`) || seen.has(f.id)) errors.push({ path: `${path}.id`, message: "must be unique and prefixed with the mod id and a dash" });
        seen.add(f.id);
        const hq = resolved[f.headquarters], builder = resolved[f.builder];
        if (!built.has(f.headquarters) || !hq?.isHQ || hq.kind !== "building" || hq.offshore || hq.needsDeposit || hq.upgradeOnly)
          errors.push({ path: `${path}.headquarters`, message: "must name this mod’s buildable land headquarters" });
        if (!built.has(f.builder) || builder?.kind !== "unit" || !["ground", "amphibious"].includes(builder.domain) || !builder.builds?.includes(f.headquarters) || !(builder.buildRate > 0) || !(builder.speed > 0))
          errors.push({ path: `${path}.builder`, message: "must name this mod’s mobile land builder that can rebuild its headquarters" });
        if (!hq?.produces?.includes(f.builder)) errors.push({ path: `${path}.headquarters`, message: "the headquarters must produce its starting builder" });
        if (hq?.requires?.length) errors.push({ path: `${path}.headquarters`, message: "a starting headquarters cannot require another building or research" });
        if (builder?.requires?.some((id2) => id2 !== f.headquarters)) errors.push({ path: `${path}.builder`, message: "the starting builder can require only its headquarters" });
        const roster = f.roster ?? defs.map((d) => d.id);
        if (!roster.includes(f.headquarters) || !roster.includes(f.builder)) errors.push({ path: `${path}.roster`, message: "must include the headquarters and starting builder" });
        for (const id2 of roster) {
          const def = resolved[id2];
          if (!def) {
            errors.push({ path: `${path}.roster`, message: `unknown definition "${id2}"` });
            continue;
          }
          for (const required of def.requires ?? []) if (!isTechId(required) && !roster.includes(required))
            errors.push({ path: `${path}.roster`, message: `"${id2}" requires "${required}" outside the roster` });
        }
        factions.push({ ...f, roster });
      });
      mod.factions = factions;
    }
  }
  return { ok: errors.length === 0, pack: mod, defs, patches, strings, placeholders, errors, warnings };
}
function ruleContext(def, table, built, sheets, sounds) {
  return {
    def,
    find: (id2) => table[id2] ?? built.get(id2),
    ownDef: (id2) => built.has(id2),
    isTech: isTechId,
    sheets,
    sounds,
    weaponSounds: WEAPON_SOUNDS,
    weaponClasses: WEAPON_CLASSES,
    isText,
    idRe: ID_RE
  };
}
function buildDef(own, kind, base, modId, soundKeys, path, errors, warnings) {
  const inherited = base ? cloneData(base) : {};
  delete inherited.id;
  delete inherited.aliases;
  delete inherited.mod;
  delete inherited.upgradesTo;
  delete inherited.upgradeCost;
  delete inherited.upgradeTime;
  delete inherited.upgradeOnly;
  delete inherited.warhead;
  delete inherited.emp;
  delete inherited.aiWeight;
  delete inherited.lab;
  delete inherited.unique;
  delete inherited.rules;
  if (base && base.kind !== kind) {
    errors.push({ path: `${path}.kind`, message: `a ${kind} cannot extend a ${base.kind}` });
    return null;
  }
  const domain = kind === "building" ? "none" : own.domain ?? inherited.domain ?? "ground";
  const fw = kind === "building" ? own.fw ?? inherited.fw ?? 2 : void 0;
  const fh = kind === "building" ? own.fh ?? inherited.fh ?? fw : void 0;
  const cost = own.cost ?? inherited.cost;
  const hp = own.hp ?? inherited.hp;
  if (cost === void 0 || hp === void 0) return null;
  const armor = own.armor ?? inherited.armor ?? (kind === "building" ? "structure" : domain === "air" ? "air" : domain === "ship" ? own.underwater ?? inherited.underwater ? "sub" : "ship" : "medium");
  const def = {
    ...inherited,
    ...stripModOnly(own),
    id: own.id,
    kind,
    domain,
    tier: own.tier ?? inherited.tier ?? 1,
    cost,
    buildTime: own.buildTime ?? inherited.buildTime ?? Math.max(2, Math.round(cost / 14)),
    pop: own.pop ?? inherited.pop ?? (kind === "unit" ? 1 : 0),
    hp,
    armor,
    speed: kind === "building" ? 0 : own.speed ?? inherited.speed ?? 60,
    turnRate: kind === "building" ? 0 : own.turnRate ?? inherited.turnRate ?? 3.5,
    // Fog rays and their cache use whole tile coordinates. Normalize authored
    // and inherited content here, before either simulation kernel sees it.
    vision: Math.round(own.vision ?? inherited.vision ?? 8),
    radius: own.radius ?? inherited.radius ?? (kind === "building" ? Math.max(fw, fh) * 15 : 9),
    weapons: [],
    sprite: "",
    mod: modId
  };
  if (kind === "building") {
    def.fw = fw;
    def.fh = fh;
    if (def.power === void 0) def.power = 0;
  } else {
    if (def.power === void 0) def.power = -def.pop;
    if (own.trail === void 0 && inherited.trail === void 0) {
      if (domain === "ground" || domain === "amphibious") def.trail = "tread";
      else if (domain === "ship" && !def.underwater) def.trail = "wake";
    }
  }
  if (def.aliases) def.aliases = def.aliases.map((a) => a.toLowerCase());
  if (def.directionalArmor && (kind !== "unit" || domain !== "ground")) {
    if (own.directionalArmor) errors.push({ path: `${path}.directionalArmor`, message: "directional armour requires a ground unit" });
    else delete def.directionalArmor;
  }
  const rawWeapons = own.weapons ?? (base ? inherited.weapons : []) ?? [];
  const hasTurret = !!(own.turretSprite ?? (own.sprite ? void 0 : inherited.turretSprite));
  rawWeapons.forEach((raw, i) => {
    const wpath = `${path}.weapons[${i}]`;
    if (!isPlainObject(raw)) {
      errors.push({ path: wpath, message: "must be an object" });
      return;
    }
    const clean = checkObject(raw, WEAPON_SPECS, wpath, errors, warnings);
    if (!clean.cls || clean.dmg === void 0 || clean.reload === void 0 || clean.range === void 0) return;
    if (clean.sound !== void 0 && !WEAPON_SOUNDS.includes(clean.sound) && !soundKeys.has(clean.sound)) {
      errors.push({ path: `${wpath}.sound`, message: `"${clean.sound}" is neither a game sound (${WEAPON_SOUNDS.join(", ")}) nor one of this mod's sounds` });
      return;
    }
    const projectile = clean.projectile ?? PROJECTILE_BY_CLASS[clean.cls];
    const wp = {
      ...clean,
      id: clean.id ?? `w${i + 1}`,
      cls: clean.cls,
      dmg: clean.dmg,
      reload: clean.reload,
      range: clean.range,
      projectile,
      speed: clean.speed ?? SPEED_BY_PROJECTILE[projectile] ?? 400,
      targets: clean.targets ?? TARGETS_BY_CLASS[clean.cls] ?? ["ground", "ship"],
      sound: clean.sound ?? SOUND_BY_CLASS[clean.cls]
    };
    if (clean.turret === void 0 && hasTurret) wp.turret = true;
    if (wp.minRange !== void 0 && wp.minRange >= wp.range) {
      errors.push({ path: `${wpath}.minRange`, message: "must be less than range" });
      return;
    }
    def.weapons.push(resolveWeapon(wp));
  });
  if (def.weapons.length > 8) {
    errors.push({ path: `${path}.weapons`, message: "at most 8 weapons" });
    return null;
  }
  return def;
}
function stripModOnly(own) {
  const { name: _n, desc: _d, extends: _e, weapons: _w, producedBy: _p, builtBy: _b, upgradeOf: _u, sprite: _s, turretSprite: _t, turretMounts: _tm, decals: _dc, rules: _r, wing: _wg, ...rest } = own;
  return rest;
}
function applyPatches(table, patches) {
  for (const p of patches) {
    const target = table[p.target];
    if (!target) continue;
    if (p.kind === "produces") {
      target.produces = target.produces ?? [];
      if (!target.produces.includes(p.id)) target.produces.push(p.id);
    } else if (p.kind === "builds") {
      target.builds = target.builds ?? [];
      if (!target.builds.includes(p.id)) target.builds.push(p.id);
    } else {
      target.upgradesTo = p.id;
      target.upgradeCost = p.cost;
      target.upgradeTime = p.time;
    }
  }
}
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const id = (v) => typeof v === "string" && /^[a-zA-Z0-9_.:-]{1,120}$/.test(v) && !["__proto__", "constructor", "prototype"].includes(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v);
function validateWorld(input) {
  const errors = [];
  const fail = (path, message) => {
    if (errors.length < 100) errors.push({ path, message });
  };
  if (!object(input)) return [{ path: "", message: "Expected a world project." }];
  if (input.format !== WORLD_FORMAT || input.v !== WORLD_VERSION) fail("format", "Unsupported world format or version.");
  if (!id(input.id)) fail("id", "Expected a stable project ID.");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 160) fail("name", "Expected a project name up to 160 characters.");
  if (typeof input.version !== "string" || input.version.length > 80) fail("version", "Expected a content version.");
  if (input.capabilities !== void 0 && (!Array.isArray(input.capabilities) || input.capabilities.some((c) => !["world-v1", "triggers", "guides", "mods", "multiplayer"].includes(String(c))))) fail("capabilities", "This build does not support a required capability.");
  const defs = new Set(VANILLA_DEF_IDS);
  const factions = /* @__PURE__ */ new Set(["vanilla"]);
  if (!Array.isArray(input.mods) || input.mods.length > 32) fail("mods", "Expected at most 32 mods.");
  else {
    const mods = /* @__PURE__ */ new Set();
    input.mods.forEach((m, i) => {
      const parsed = parseDefinitionPack(JSON.stringify(m));
      if (!parsed.ok) parsed.errors.forEach((e) => fail(`mods[${i}].${e.path}`, e.message));
      else {
        if (mods.has(parsed.pack.id)) fail(`mods[${i}].id`, "Duplicate mod identity.");
        mods.add(parsed.pack.id);
        parsed.pack.factions?.forEach((f) => factions.add(f.id));
        parsed.pack.defs.forEach((d, n) => {
          if (defs.has(d.id)) fail(`mods[${i}].defs[${n}].id`, "Duplicate definition identity.");
          defs.add(d.id);
        });
      }
    });
  }
  if (!object(input.maps) || Object.keys(input.maps).length > 128) fail("maps", "Expected at most 128 maps.");
  else for (const [key, map] of Object.entries(input.maps)) {
    if (!id(key)) fail(`maps.${key}`, "Invalid map ID.");
    const checkMap = object(map) ? { ...map, units: [] } : map;
    const parsed = parseCustomMap(JSON.stringify(checkMap));
    if (!parsed.ok) fail(`maps.${key}`, parsed.error);
    if (object(map) && map.units !== void 0) {
      if (!Array.isArray(map.units) || map.units.length > 400) fail(`maps.${key}.units`, "Expected at most 400 map forces.");
      else map.units.forEach((u, n) => {
        if (!object(u) || typeof u.id !== "string" || !defs.has(u.id) || !finite(u.x) || !finite(u.y) || !Number.isInteger(u.owner) || Number(u.owner) < 0 || Number(u.owner) > 7) fail(`maps.${key}.units[${n}]`, "Invalid map force.");
      });
    }
  }
  if (input.texts !== void 0) {
    if (!object(input.texts) || Object.keys(input.texts).length > 2e4) fail("texts", "Invalid text table.");
    else for (const [key, value] of Object.entries(input.texts)) {
      if (!id(key) || !Array.isArray(value) || value.length !== 3 || value.some((t) => typeof t !== "string" || t.length > 2e4)) fail(`texts.${key}`, "Expected English, Chinese and Korean text.");
    }
  }
  if (!Array.isArray(input.scenarios) || input.scenarios.length > 128) fail("scenarios", "Expected at most 128 scenarios.");
  else {
    const seen = /* @__PURE__ */ new Set();
    input.scenarios.forEach((s, i) => {
      const path = `scenarios[${i}]`;
      if (!object(s) || !id(s.id)) {
        fail(path, "Invalid scenario.");
        return;
      }
      if (seen.has(s.id)) fail(`${path}.id`, "Duplicate scenario ID.");
      seen.add(s.id);
      if (!object(input.maps) || typeof s.map !== "string" || !Object.hasOwn(input.maps, s.map)) fail(`${path}.map`, "Map reference is missing.");
      validateScenario(s, path, defs, fail);
      if (object(s.cfg) && Array.isArray(s.cfg.players)) s.cfg.players.forEach((p, n) => {
        if (object(p) && p.faction !== void 0 && (typeof p.faction !== "string" || !factions.has(p.faction))) fail(`${path}.cfg.players[${n}].faction`, "Unknown faction.");
      });
    });
    if (!Array.isArray(input.campaigns) || input.campaigns.length > 64) fail("campaigns", "Expected at most 64 campaigns.");
    else {
      const campaignIds = /* @__PURE__ */ new Set();
      input.campaigns.forEach((c, i) => {
        if (!object(c) || !id(c.id) || !Array.isArray(c.scenarios) || c.scenarios.some((s) => typeof s !== "string" || !seen.has(s))) fail(`campaigns[${i}]`, "Invalid campaign or scenario reference.");
        else {
          if (campaignIds.has(c.id)) fail(`campaigns[${i}].id`, "Duplicate campaign ID.");
          campaignIds.add(c.id);
        }
      });
    }
  }
  errors.push(...validateWorldShape(input));
  return errors.slice(0, 100);
}
function validateScenario(s, path, defs, fail) {
  const ids = (items, key, max) => {
    const out = /* @__PURE__ */ new Set();
    if (!Array.isArray(items) || items.length > max) {
      fail(`${path}.${key}`, `Expected at most ${max} items.`);
      return out;
    }
    items.forEach((v, i) => {
      if (!object(v) || !id(v.id) || out.has(v.id)) fail(`${path}.${key}[${i}].id`, "Missing or duplicate ID.");
      else out.add(v.id);
    });
    return out;
  };
  if (typeof s.name !== "string" || s.name.length > 160) fail(`${path}.name`, "Invalid scenario name.");
  if (!object(s.cfg) || !Array.isArray(s.cfg.players) || s.cfg.players.length < 1 || s.cfg.players.length > 8) fail(`${path}.cfg`, "Expected one to eight factions.");
  else {
    for (const key of ["seed", "startMetal", "popCap"]) if (!finite(s.cfg[key])) fail(`${path}.cfg.${key}`, "Expected a finite number.");
    s.cfg.players.forEach((p, i) => {
      if (!object(p) || !Number.isInteger(p.team) || Number(p.team) < 0 || Number(p.team) > 7 || typeof p.isHuman !== "boolean") fail(`${path}.cfg.players[${i}]`, "Invalid faction.");
    });
  }
  const players = object(s.cfg) && Array.isArray(s.cfg.players) ? s.cfg.players.length : 0;
  const instances = ids(s.instances, "instances", 12e3);
  const regions = ids(s.regions ?? [], "regions", 256);
  const routes = ids(s.routes ?? [], "routes", 256);
  const objectives = ids(s.objectives ?? [], "objectives", 256);
  const triggers = ids(s.triggers, "triggers", 1024);
  const checkInstance = (v, p) => {
    if (!object(v) || !id(v.id) || typeof v.defId !== "string" || !defs.has(v.defId) || !Number.isInteger(v.owner) || Number(v.owner) < 0 || Number(v.owner) >= players || !finite(v.x) || !finite(v.y) || Math.abs(v.x) > 1e5 || Math.abs(v.y) > 1e5) fail(p, "Invalid placed instance or unknown definition.");
  };
  if (Array.isArray(s.instances)) s.instances.forEach((v, i) => checkInstance(v, `${path}.instances[${i}]`));
  if (Array.isArray(s.regions)) s.regions.forEach((r, i) => {
    if (!object(r) || !["x", "y", "w", "h"].every((k) => finite(r[k])) || Number(r.w) <= 0 || Number(r.h) <= 0) fail(`${path}.regions[${i}]`, "Expected a nonempty rectangle.");
  });
  if (Array.isArray(s.routes)) s.routes.forEach((r, i) => {
    if (!object(r) || !Array.isArray(r.points) || r.points.length < 1 || r.points.length > 512 || r.points.some((p) => !object(p) || !finite(p.x) || !finite(p.y))) fail(`${path}.routes[${i}]`, "Invalid route points.");
  });
  if (s.groups !== void 0 && !object(s.groups)) fail(`${path}.groups`, "Invalid group table.");
  else for (const [key, values] of Object.entries(s.groups ?? {})) {
    if (!id(key) || !Array.isArray(values) || values.some((v) => typeof v !== "string" || !instances.has(v))) fail(`${path}.groups.${key}`, "Group refers to a missing instance.");
  }
  if (s.variables !== void 0 && !object(s.variables)) fail(`${path}.variables`, "Invalid variable table.");
  else for (const [key, v] of Object.entries(s.variables ?? {})) if (!id(key) || !(finite(v) || typeof v === "string" || typeof v === "boolean")) fail(`${path}.variables.${key}`, "Invalid variable.");
  let nodes = 0;
  const walk = (v, p, depth) => {
    if (++nodes > 6e4 || depth > 32) {
      fail(p, "Program complexity exceeds this build’s limit.");
      return;
    }
    if (typeof v === "number" && !finite(v)) fail(p, "Numbers must be finite.");
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}[${i}]`, depth + 1));
      return;
    }
    if (!object(v)) return;
    for (const [k, x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k)) fail(p, "Reserved property.");
      if (k === "region" && typeof x === "string" && !regions.has(x)) fail(`${p}.${k}`, "Missing region.");
      if (k === "route" && typeof x === "string" && !routes.has(x)) fail(`${p}.${k}`, "Missing route.");
      if (k === "op" && !WORLD_EXPR_OPS.includes(x)) fail(`${p}.${k}`, "Unknown expression operator.");
      walk(x, `${p}.${k}`, depth + 1);
    }
  };
  const calls = /* @__PURE__ */ new Map();
  const actions = (list, p, depth = 0, caller = "") => {
    if (!Array.isArray(list) || list.length > 2048 || depth > 24) {
      fail(p, "Invalid or excessively nested action list.");
      return;
    }
    list.forEach((a, i) => {
      const ap = `${p}[${i}]`;
      if (!object(a) || !WORLD_ACTION_TYPES.includes(a.type)) {
        fail(ap, "Unknown action.");
        return;
      }
      if ((a.type === "set" || a.type === "add" || a.type === "each") && !id(a.variable)) fail(`${ap}.variable`, "Invalid variable name.");
      if (a.type === "trigger" && (typeof a.id !== "string" || !triggers.has(a.id))) fail(`${ap}.id`, "Missing trigger.");
      if (a.type === "objective" && (typeof a.id !== "string" || !objectives.has(a.id))) fail(`${ap}.id`, "Missing objective.");
      if (a.type === "call") {
        if (!object(s.actions) || typeof a.id !== "string" || !Object.hasOwn(s.actions, a.id)) fail(`${ap}.id`, "Missing action group.");
        else if (caller) {
          if (!calls.has(caller)) calls.set(caller, /* @__PURE__ */ new Set());
          calls.get(caller).add(a.id);
        }
      }
      if (a.type === "spawn") {
        if (!Array.isArray(a.instances) || a.instances.length > 2e3) fail(`${ap}.instances`, "Invalid spawn list.");
        else a.instances.forEach((x, j) => checkInstance(x, `${ap}.instances[${j}]`));
      }
      if (a.type === "wave") {
        if (!Array.isArray(a.units) || a.units.length > 128 || a.units.some((u) => !Array.isArray(u) || typeof u[0] !== "string" || !defs.has(u[0]))) fail(`${ap}.units`, "Unknown wave definition.");
      }
      for (const k of ["then", "else", "actions"]) if (a[k] !== void 0) actions(a[k], `${ap}.${k}`, depth + 1, caller);
    });
  };
  if (Array.isArray(s.triggers)) s.triggers.forEach((t, i) => {
    if (!object(t)) return;
    const p = `${path}.triggers[${i}]`;
    if (!object(t.event) || !WORLD_EVENT_TYPES.includes(t.event.type)) fail(`${p}.event`, "Unknown event.");
    else if (t.event.type === "time" && (!finite(t.event.at) || t.event.at < 0)) fail(`${p}.event.at`, "Expected a nonnegative time.");
    if (object(t.event) && t.event.every !== void 0 && (!finite(t.event.every) || t.event.every < 1 / 30)) fail(`${p}.event.every`, "Repeat intervals must be at least one tick.");
    actions(t.actions, `${p}.actions`);
  });
  if (object(s.actions)) for (const [key, list] of Object.entries(s.actions)) {
    if (!id(key)) fail(`${path}.actions.${key}`, "Invalid action group ID.");
    actions(list, `${path}.actions.${key}`, 0, key);
  }
  const visit = (key, chain) => {
    if (chain.has(key)) {
      fail(`${path}.actions.${key}`, "Recursive action groups are not supported.");
      return;
    }
    if (chain.size > 32) return;
    const next = new Set(chain).add(key);
    for (const ref of calls.get(key) ?? []) visit(ref, next);
  };
  for (const key of calls.keys()) visit(key, /* @__PURE__ */ new Set());
  walk(s, path, 0);
}
function parseWorld(input) {
  let value;
  try {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    if (new TextEncoder().encode(text).length > WORLD_MAX_BYTES) return { ok: false, errors: [{ path: "", message: "World project exceeds the 16 MiB limit." }] };
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: "", message: "The file is not a JSON world project." }] };
  }
  const errors = validateWorld(value);
  return errors.length ? { ok: false, errors } : { ok: true, project: value };
}
const WORLD_REGISTRY_REPO = "steel-tide/mods";
const WORLD_REGISTRY_DIR = "worlds";
const WORLD_INDEX_FORMAT = "steel-tide-world-index";
const WORLD_INDEX_MAX_BYTES = 2 * 1024 * 1024;
const WORLD_PUBLISH_LICENSES = ["CC-BY-4.0", "CC0-1.0", "MIT", "PolyForm-Noncommercial-1.0.0"];
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;
const HASH = /^[0-9a-f]{64}$/;
const plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
async function worldPackageHash(contents) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contents)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function parseWorldIndex(input) {
  try {
    if (typeof input === "string" && new TextEncoder().encode(input).byteLength > WORLD_INDEX_MAX_BYTES) return null;
    const value = typeof input === "string" ? JSON.parse(input) : input;
    if (!plain(value) || value.format !== WORLD_INDEX_FORMAT || value.v !== 1 || !Array.isArray(value.worlds) || value.worlds.length > 2e3) return null;
    const seen = /* @__PURE__ */ new Set(), worlds = [];
    for (const raw of value.worlds) {
      if (!plain(raw) || typeof raw.id !== "string" || !ID.test(raw.id) || raw.id.length > 96 || seen.has(raw.id) || typeof raw.name !== "string" || !raw.name.trim() || raw.name.length > 96 || typeof raw.version !== "string" || !VERSION.test(raw.version) || typeof raw.description !== "string" || raw.description.length > 1200 || typeof raw.author !== "string" || !raw.author.trim() || raw.author.length > 96 || typeof raw.license !== "string" || !WORLD_PUBLISH_LICENSES.includes(raw.license) || typeof raw.hash !== "string" || !HASH.test(raw.hash) || !Number.isInteger(raw.bytes) || Number(raw.bytes) < 1 || Number(raw.bytes) > WORLD_MAX_BYTES || !Number.isInteger(raw.scenarios) || Number(raw.scenarios) < 0 || Number(raw.scenarios) > 128 || !Number.isInteger(raw.campaigns) || Number(raw.campaigns) < 0 || Number(raw.campaigns) > 128 || !Number.isInteger(raw.players) || Number(raw.players) < 0 || Number(raw.players) > 8 || raw.path !== `${WORLD_REGISTRY_DIR}/${raw.id}${WORLD_EXT}` || raw.sample !== void 0) return null;
      seen.add(raw.id);
      worlds.push({ id: raw.id, name: raw.name, version: raw.version, description: raw.description, author: raw.author, license: raw.license, hash: raw.hash, bytes: Number(raw.bytes), scenarios: Number(raw.scenarios), campaigns: Number(raw.campaigns), players: Number(raw.players), path: raw.path });
    }
    return { format: WORLD_INDEX_FORMAT, v: 1, worlds };
  } catch {
    return null;
  }
}
async function checkWorldFile(contents, fileId) {
  const bytes = new TextEncoder().encode(contents).byteLength;
  if (bytes > WORLD_MAX_BYTES) return { ok: false, reason: "size" };
  try {
    await prepareContentSchema(contents);
  } catch {
    return { ok: false, reason: "invalid", details: "mods.extensionPackages: package is not approved for registry validation" };
  }
  const parsed = parseWorld(contents);
  if (!parsed.ok) return { ok: false, reason: "invalid", details: parsed.errors[0]?.path };
  const p = parsed.project;
  if (!ID.test(p.id) || p.id.length > 96 || fileId !== void 0 && p.id !== fileId || !VERSION.test(p.version) || !p.author?.trim() || p.author.length > 96 || !p.description?.trim() || p.description.length > 1200 || !WORLD_PUBLISH_LICENSES.includes(p.license)) return { ok: false, reason: "metadata" };
  for (const dep of p.dependencies ?? []) {
    const mod = p.mods.find((m) => m.id === dep.id && m.version === dep.version);
    if (!mod || !HASH.test(dep.hash) || await worldPackageHash(JSON.stringify(mod)) !== dep.hash) return { ok: false, reason: "invalid", details: `dependencies.${dep.id}` };
  }
  return { ok: true, project: p, entry: { id: p.id, name: p.name, version: p.version, description: p.description, author: p.author, license: p.license, hash: await worldPackageHash(contents), bytes, scenarios: p.scenarios.length, campaigns: p.campaigns.length, players: Math.max(0, ...p.scenarios.map((s) => s.cfg.players.filter((p2) => p2.isHuman).length)), path: `${WORLD_REGISTRY_DIR}/${p.id}${WORLD_EXT}` } };
}
registerContentSchema(readExtensions, validateExtensionReferences, checkExtensionPackages);
export {
  WORLD_EXT,
  WORLD_FORMAT,
  WORLD_INDEX_FORMAT,
  WORLD_MAX_BYTES,
  WORLD_PUBLISH_LICENSES,
  WORLD_REGISTRY_DIR,
  WORLD_REGISTRY_REPO,
  WORLD_VERSION,
  checkWorldFile,
  parseWorld,
  parseWorldIndex,
  validateWorld,
  worldPackageHash
};
